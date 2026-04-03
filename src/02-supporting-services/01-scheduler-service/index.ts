import { Queue } from "bullmq";
import { pino, type Logger } from "pino";

import {
  ClassifierIntent,
  DispatchPriority,
  EntityType,
  QueueItemSource,
  QueueItemType,
} from "../../types.js";
import { runtimeSystemConfig } from "../../config/runtime-system-config.js";
import { type PendingQueueItem } from "../../01-service-stack/04-queue/types.js";
import { toRedisConnection } from "../../lib/redis.js";
import type { StateService } from "../types.js";
import type {
  DailyRhythm,
  DigestDay,
  SchedulerStartupRecoveryResult,
  ScheduledEvent,
} from "./types.js";
import { ScheduledEventType } from "./types.js";

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
    await this.queue.add(
      "morning_digest",
      {
        id: "morning_digest",
        type: ScheduledEventType.MorningDigest,
        due_at: new Date(),
        payload: { timezone: this.timezone },
      },
      {
        repeat: {
          pattern: "0 0 7 * * *",
        },
      },
    );
    await this.queue.add(
      "evening_checkin",
      {
        id: "evening_checkin",
        type: ScheduledEventType.EveningCheckin,
        due_at: new Date(),
        payload: { timezone: this.timezone },
      },
      {
        repeat: {
          pattern: "0 0 20 * * *",
        },
      },
    );

    this.logger.info("Scheduler repeatable jobs initialized.");
  }

  public async stop(): Promise<void> {
    await this.queue.close();
  }

  public async produceScheduledItems(reference_time: Date): Promise<PendingQueueItem[]> {
    const state = await this.stateService.getSystemState();
    const eligibility = this.dailyRhythm.digest_eligibility;
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
    const items: PendingQueueItem[] = [];
    for (const pendingItem of state.queue.pending) {
      if (eligibility.exclude_stale) {
        const age = reference_time.getTime() - pendingItem.created_at.getTime();
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

      items.push({
        ...pendingItem,
        id: `sched_${pendingItem.id}_${reference_time.getTime()}`,
        source: QueueItemSource.ScheduledTrigger,
        type: QueueItemType.Outbound,
        created_at: reference_time,
      });
    }

    if (eligibility.include_unresolved_from_yesterday) {
      const unresolvedYesterday = state.queue.recently_dispatched
        .filter((item) => item.response_received !== true)
        .map<PendingQueueItem>((item) => ({
          id: `sched_unresolved_${item.id}_${reference_time.getTime()}`,
          source: QueueItemSource.ScheduledTrigger,
          type: QueueItemType.Outbound,
          topic: item.topic,
          intent: ClassifierIntent.Query,
          concerning: this.inferConcerningFromThread(item.target_thread),
          content: item.content,
          priority: DispatchPriority.Batched,
          target_thread: item.target_thread,
          created_at: reference_time,
        }));
      items.push(...unresolvedYesterday);
    }

    return items;
  }

  public async reconcileDowntime(since: Date, until: Date): Promise<PendingQueueItem[]> {
    const recovered = await this.recoverMissedWindows(until);
    this.logger.info(
      { since: since.toISOString(), until: until.toISOString(), recovered: recovered.length },
      "Scheduler downtime reconciliation completed.",
    );
    return recovered;
  }

  public async recoverMissedWindows(now: Date): Promise<PendingQueueItem[]> {
    const morningTime = this.dailyRhythm.morning_digest.times.default ?? "07:00";
    const eveningTime = this.dailyRhythm.evening_checkin.times.default ?? "20:00";
    const morningBoundary = parseClockToToday(morningTime, now);
    const eveningBoundary = parseClockToToday(eveningTime, now);

    const recovery: PendingQueueItem[] = [];
    if (now > morningBoundary && this.isWindowRelevant(now, morningBoundary, 4)) {
      recovery.push(...(await this.produceScheduledItems(now)));
    } else if (now > morningBoundary) {
      this.logger.info("Morning digest window is stale; startup recovery skipped.");
    }

    if (now > eveningBoundary && this.isWindowRelevant(now, eveningBoundary, 4)) {
      recovery.push(...(await this.produceScheduledItems(now)));
    } else if (now > eveningBoundary) {
      this.logger.info("Evening check-in window is stale; startup recovery skipped.");
    }

    return recovery;
  }

  public async recoverMissedWindowsDetailed(now: Date): Promise<SchedulerStartupRecoveryResult> {
    const items = await this.recoverMissedWindows(now);
    const morningTime = this.dailyRhythm.morning_digest.times.default ?? "07:00";
    const eveningTime = this.dailyRhythm.evening_checkin.times.default ?? "20:00";
    const morningBoundary = parseClockToToday(morningTime, now);
    const eveningBoundary = parseClockToToday(eveningTime, now);

    let staleSkipped = 0;
    if (now > morningBoundary && !this.isWindowRelevant(now, morningBoundary, 4)) {
      staleSkipped += 1;
    }
    if (now > eveningBoundary && !this.isWindowRelevant(now, eveningBoundary, 4)) {
      staleSkipped += 1;
    }

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
