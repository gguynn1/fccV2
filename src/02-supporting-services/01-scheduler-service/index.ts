import { Queue, Worker, type Job } from "bullmq";
import { pino, type Logger } from "pino";

import { type PendingQueueItem } from "../../01-service-stack/04-queue/types.js";
import { runtimeSystemConfig } from "../../config/runtime-system-config.js";
import { toRedisConnection } from "../../lib/redis.js";
import {
  ClassifierIntent,
  DispatchPriority,
  EntityType,
  QueueItemSource,
  QueueItemType,
} from "../../types.js";
import type { StateService } from "../types.js";
import {
  ScheduledEventType,
  type DailyRhythm,
  type DigestDay,
  type ScheduledEvent,
  type SchedulerStartupRecoveryResult,
} from "./types.js";

const DEFAULT_LOGGER = pino({ name: "scheduler-service" });
const SCHEDULER_JOB_QUEUE = "fcc-scheduler";

export interface SchedulerServiceOptions {
  redis_url: string;
  timezone: string;
  daily_rhythm: DailyRhythm;
  state_service: StateService;
  logger?: Logger;
}

function parseClockToToday(time: string, now: Date): Date {
  const [hour, minute] = time.split(":").map((part) => Number(part));
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Number.isNaN(hour) ? 0 : hour,
    Number.isNaN(minute) ? 0 : minute,
    0,
    0,
  );
}

function formatClock(date: Date): string {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

interface SchedulerTickWindow {
  type: ScheduledEventType.MorningDigest | ScheduledEventType.EveningCheckin;
  due_at: Date;
  entity_ids: string[];
}

export class BullSchedulerService {
  private readonly queue: Queue<ScheduledEvent>;

  private readonly stateService: StateService;

  private readonly logger: Logger;

  private readonly timezone: string;

  private readonly dailyRhythm: DailyRhythm;

  public constructor(options: SchedulerServiceOptions) {
    this.queue = new Queue<ScheduledEvent>(SCHEDULER_JOB_QUEUE, {
      connection: toRedisConnection(options.redis_url),
    });
    this.stateService = options.state_service;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.timezone = options.timezone;
    this.dailyRhythm = options.daily_rhythm;
  }

  public async start(): Promise<void> {
    await this.queue.waitUntilReady();
    await this.queue.obliterate({ force: true });
    await this.queue.add(
      "morning_digest_tick",
      {
        id: "morning_digest_tick",
        type: ScheduledEventType.MorningDigest,
        due_at: new Date(),
        payload: { timezone: this.timezone },
      },
      {
        repeat: {
          pattern: "0 * * * * *",
        },
      },
    );
    await this.queue.add(
      "evening_checkin_tick",
      {
        id: "evening_checkin_tick",
        type: ScheduledEventType.EveningCheckin,
        due_at: new Date(),
        payload: { timezone: this.timezone },
      },
      {
        repeat: {
          pattern: "0 * * * * *",
        },
      },
    );

    this.logger.info("Scheduler repeatable jobs initialized.");
  }

  public async stop(): Promise<void> {
    await this.queue.close();
  }

  public async produceScheduledItems(reference_time: Date): Promise<PendingQueueItem[]> {
    const dueEntityIds = this.resolveDueEntityIds(ScheduledEventType.MorningDigest, reference_time);
    if (dueEntityIds.length === 0) {
      return [];
    }
    return this.produceScheduledItemsForWindow({
      type: ScheduledEventType.MorningDigest,
      due_at: reference_time,
      entity_ids: dueEntityIds,
    });
  }

  public registerWorker(
    processor: (event: ScheduledEvent, items: PendingQueueItem[]) => Promise<void>,
  ): Worker<ScheduledEvent> {
    return new Worker<ScheduledEvent>(
      SCHEDULER_JOB_QUEUE,
      async (job: Job<ScheduledEvent>) => {
        const event = this.toScheduledEvent(job.data, job.timestamp);
        const items = await this.produceScheduledItemsForEvent(event);
        await processor(event, items);
      },
      {
        connection: this.queue.opts.connection,
        concurrency: 1,
      },
    );
  }

  public async produceScheduledItemsForEvent(event: ScheduledEvent): Promise<PendingQueueItem[]> {
    if (
      event.type !== ScheduledEventType.MorningDigest &&
      event.type !== ScheduledEventType.EveningCheckin
    ) {
      return [];
    }
    const dueAt = this.toEventDueAt(event);
    const dueEntityIds = this.resolveDueEntityIds(event.type, dueAt);
    if (dueEntityIds.length === 0) {
      return [];
    }
    return this.produceScheduledItemsForWindow({
      type: event.type,
      due_at: dueAt,
      entity_ids: dueEntityIds,
    });
  }

  public async produceScheduledItemsForWindow(
    window: SchedulerTickWindow,
  ): Promise<PendingQueueItem[]> {
    const state = await this.stateService.getSystemState();
    const eligibility = this.dailyRhythm.digest_eligibility;
    const relevantEntityIds = new Set(window.entity_ids);
    const dispatchedIds = new Set(
      eligibility.exclude_already_dispatched
        ? state.queue.recently_dispatched.map((item) => item.id)
        : [],
    );
    const previousDigestIds = new Set(
      eligibility.suppress_repeats_from_previous_digest
        ? state.digests.history.flatMap((day) =>
            Object.values(day.morning).flatMap((digest) => digest.included),
          )
        : [],
    );

    const staleThresholdMs = eligibility.staleness_threshold_hours * 60 * 60 * 1000;
    const items = new Map<string, PendingQueueItem>();
    for (const pendingItem of state.queue.pending) {
      if (!pendingItem.hold_until || pendingItem.hold_until.getTime() > window.due_at.getTime()) {
        continue;
      }
      if (
        !this.isRelevantToEntities(
          pendingItem.concerning,
          pendingItem.target_thread,
          relevantEntityIds,
        )
      ) {
        continue;
      }
      if (eligibility.exclude_stale) {
        const age = window.due_at.getTime() - pendingItem.created_at.getTime();
        if (age > staleThresholdMs) {
          continue;
        }
      }
      if (dispatchedIds.has(pendingItem.id)) {
        continue;
      }
      if (previousDigestIds.has(pendingItem.id)) {
        continue;
      }

      items.set(pendingItem.id, {
        ...pendingItem,
        source: QueueItemSource.ScheduledTrigger,
        type: QueueItemType.Outbound,
        created_at: window.due_at,
        hold_until: undefined,
        idempotency_key: `scheduled_release:${pendingItem.id}:${window.type}:${formatClock(
          window.due_at,
        )}`,
      });
    }

    if (
      window.type === ScheduledEventType.MorningDigest &&
      eligibility.include_unresolved_from_yesterday
    ) {
      const todayStart = startOfLocalDay(window.due_at).getTime();
      const unresolvedYesterday = state.queue.recently_dispatched
        .filter(
          (item) =>
            item.response_received !== true &&
            item.dispatched_at.getTime() < todayStart &&
            this.isThreadRelevantToEntities(item.target_thread, relevantEntityIds),
        )
        .map<PendingQueueItem>((item) => ({
          id: `sched_unresolved_${item.id}_${window.due_at.getTime()}`,
          source: QueueItemSource.ScheduledTrigger,
          type: QueueItemType.Outbound,
          topic: item.topic,
          intent: ClassifierIntent.Query,
          concerning: this.inferConcerningFromThread(item.target_thread),
          content: item.content,
          priority: DispatchPriority.Batched,
          target_thread: item.target_thread,
          created_at: window.due_at,
          idempotency_key: `scheduled_unresolved:${item.id}:${window.type}:${window.due_at
            .toISOString()
            .slice(0, 10)}`,
        }));
      for (const item of unresolvedYesterday) {
        items.set(item.id, item);
      }
    }

    return [...items.values()];
  }

  public async reconcileDowntime(since: Date, until: Date): Promise<PendingQueueItem[]> {
    const windows = this.collectDueWindows(since, until).filter((window) =>
      this.isWindowRelevant(until, window.due_at, 4),
    );
    const recovered = (
      await Promise.all(windows.map((window) => this.produceScheduledItemsForWindow(window)))
    ).flat();
    const deduped = this.dedupeById(recovered);
    this.logger.info(
      { since: since.toISOString(), until: until.toISOString(), recovered: deduped.length },
      "Scheduler downtime reconciliation completed.",
    );
    return deduped;
  }

  public async recoverMissedWindows(now: Date): Promise<PendingQueueItem[]> {
    const dayStart = startOfLocalDay(now);
    return this.reconcileDowntime(dayStart, now);
  }

  public async recoverMissedWindowsDetailed(now: Date): Promise<SchedulerStartupRecoveryResult> {
    const items = await this.recoverMissedWindows(now);
    const dayStart = startOfLocalDay(now);
    const staleSkipped = this.collectDueWindows(dayStart, now).filter(
      (window) => !this.isWindowRelevant(now, window.due_at, 4),
    ).length;

    return { produced: items, skipped_stale: staleSkipped };
  }

  public async recordDigestDelivery(day: DigestDay): Promise<void> {
    const state = await this.stateService.getSystemState();
    state.digests.history.push(day);
    await this.stateService.saveSystemState(state);
  }

  private isWindowRelevant(now: Date, window: Date, maxHoursPast: number): boolean {
    const elapsedMs = now.getTime() - window.getTime();
    return elapsedMs <= maxHoursPast * 60 * 60 * 1000;
  }

  private collectDueWindows(since: Date, until: Date): SchedulerTickWindow[] {
    const windows = new Map<string, SchedulerTickWindow>();
    for (const type of [
      ScheduledEventType.MorningDigest,
      ScheduledEventType.EveningCheckin,
    ] as const) {
      const block =
        type === ScheduledEventType.MorningDigest
          ? this.dailyRhythm.morning_digest
          : this.dailyRhythm.evening_checkin;
      for (const [entityId, time] of Object.entries(block.times)) {
        if (time === null) {
          continue;
        }
        const dueAt = parseClockToToday(time, until);
        if (dueAt < since || dueAt > until) {
          continue;
        }
        const key = `${type}:${time}`;
        const existing = windows.get(key);
        if (existing) {
          existing.entity_ids.push(entityId);
          continue;
        }
        windows.set(key, {
          type,
          due_at: dueAt,
          entity_ids: [entityId],
        });
      }
    }
    return [...windows.values()];
  }

  private dedupeById(items: PendingQueueItem[]): PendingQueueItem[] {
    return [...new Map(items.map((item) => [item.id, item])).values()];
  }

  private resolveDueEntityIds(
    type: ScheduledEventType.MorningDigest | ScheduledEventType.EveningCheckin,
    referenceTime: Date,
  ): string[] {
    const block =
      type === ScheduledEventType.MorningDigest
        ? this.dailyRhythm.morning_digest
        : this.dailyRhythm.evening_checkin;
    const clock = formatClock(referenceTime);
    return Object.entries(block.times)
      .filter(([, time]) => time === clock)
      .map(([entityId]) => entityId);
  }

  private toScheduledEvent(payload: ScheduledEvent, timestamp: number): ScheduledEvent {
    return {
      ...payload,
      due_at: payload.due_at instanceof Date ? payload.due_at : new Date(timestamp),
    };
  }

  private toEventDueAt(event: ScheduledEvent): Date {
    return event.due_at instanceof Date ? event.due_at : new Date();
  }

  private isRelevantToEntities(
    concerning: string[],
    targetThread: string,
    entityIds: Set<string>,
  ): boolean {
    return (
      concerning.some((entityId) => entityIds.has(entityId)) ||
      this.isThreadRelevantToEntities(targetThread, entityIds)
    );
  }

  private isThreadRelevantToEntities(targetThread: string, entityIds: Set<string>): boolean {
    if (targetThread.endsWith("_private")) {
      const participantId = targetThread.replace(/_private$/u, "");
      return entityIds.has(participantId);
    }
    const thread = runtimeSystemConfig.threads.find((candidate) => candidate.id === targetThread);
    return thread?.participants.some((entityId) => entityIds.has(entityId)) ?? false;
  }

  private inferConcerningFromThread(threadId: string): string[] {
    if (threadId.endsWith("_private")) {
      const participantId = threadId.replace(/_private$/u, "");
      return [participantId];
    }

    const thread = runtimeSystemConfig.threads.find((candidate) => candidate.id === threadId);
    if (thread?.participants.length) {
      return thread.participants;
    }

    const fallback = runtimeSystemConfig.entities.find((entity) => entity.type !== EntityType.Pet);
    return fallback ? [fallback.id] : [];
  }
}

export function createSchedulerService(options: SchedulerServiceOptions): BullSchedulerService {
  return new BullSchedulerService(options);
}
