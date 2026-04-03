import BetterSqlite3 from "better-sqlite3";
import { Queue } from "bullmq";
import { pino, type Logger } from "pino";

import type { CollisionPolicy, StackQueueItem } from "../../01-service-stack/types.js";
import { runtimeSystemConfig } from "../../config/runtime-system-config.js";
import { toRedisConnection } from "../../lib/redis.js";
import { DispatchPriority } from "../../types.js";
import type { BudgetDecision, BudgetService, StateService } from "../types.js";
import type { OutboundBudgetTracker } from "./types.js";

const DEFAULT_LOGGER = pino({ name: "budget-service" });
const DEFAULT_QUEUE_NAME = "fcc-budget-counters";

interface RecentDispatchRecord {
  id: string;
  dispatched_at: Date;
  target_thread: string;
  concerning: string[];
}

export interface BudgetServiceOptions {
  redis_url: string;
  state_service: StateService;
  database_path?: string;
  max_unprompted_per_person_per_day?: number;
  max_messages_per_thread_per_hour?: number;
  batch_window_minutes?: number;
  reconstruction_lookback_hours?: number;
  logger?: Logger;
}

export class RedisBudgetService implements BudgetService {
  private readonly queue: Queue;

  private readonly logger: Logger;

  private readonly stateService: StateService;

  private readonly databasePath?: string;

  private readonly maxPerPersonPerDay: number;

  private readonly maxPerThreadPerHour: number;

  private readonly batchWindowMinutes: number;

  private readonly reconstructionLookbackHours: number;

  private hasCheckedReconstruction = false;

  public constructor(options: BudgetServiceOptions) {
    this.queue = new Queue(DEFAULT_QUEUE_NAME, {
      connection: toRedisConnection(options.redis_url),
    });
    this.stateService = options.state_service;
    this.databasePath = options.database_path;
    this.maxPerPersonPerDay = options.max_unprompted_per_person_per_day ?? 5;
    this.maxPerThreadPerHour = options.max_messages_per_thread_per_hour ?? 2;
    this.batchWindowMinutes = options.batch_window_minutes ?? 30;
    this.reconstructionLookbackHours = options.reconstruction_lookback_hours ?? 24;
    this.logger = options.logger ?? DEFAULT_LOGGER;
  }

  public async getBudgetTracker(): Promise<OutboundBudgetTracker> {
    await this.reconstructCountersIfMissing();
    const now = new Date();
    const client = await this.queue.client;
    const byPerson: OutboundBudgetTracker["by_person"] = {};
    for (const participantId of this.participantIds()) {
      const count = this.asNumber(await client.get(this.personDailyKey(participantId, now)));
      byPerson[participantId] = {
        unprompted_sent: count,
        max: this.maxPerPersonPerDay,
        messages: [],
      };
    }

    const byThread: OutboundBudgetTracker["by_thread"] = {};
    for (const thread of runtimeSystemConfig.threads) {
      const count = this.asNumber(await client.get(this.threadHourlyKey(thread.id, now)));
      byThread[thread.id] = {
        last_hour_count: count,
        max_per_hour: this.maxPerThreadPerHour,
        last_sent_at: null,
      };
    }

    return {
      date: now,
      by_person: byPerson,
      by_thread: byThread,
    };
  }

  public async evaluateOutbound(
    queue_item: StackQueueItem,
    target_thread: string,
    _collision_policy: CollisionPolicy,
  ): Promise<BudgetDecision> {
    await this.reconstructCountersIfMissing();
    const priority = this.resolvePriority(queue_item);
    if (priority === DispatchPriority.Silent) {
      return {
        priority,
        reason: "Silent-priority item is stored without outbound dispatch.",
      };
    }

    const client = await this.queue.client;
    const now = new Date();
    const concerning = queue_item.concerning;
    const [threadCount, personCounts, collisionIds] = await Promise.all([
      client.get(this.threadHourlyKey(target_thread, now)),
      Promise.all(
        concerning.map(async (participantId) =>
          this.asNumber(await client.get(this.personDailyKey(participantId, now))),
        ),
      ),
      this.collectCollisionIds(queue_item, target_thread),
    ]);

    const isThreadAtLimit = this.asNumber(threadCount) >= this.maxPerThreadPerHour;
    const isPersonAtLimit = personCounts.some((count) => count >= this.maxPerPersonPerDay);
    if (
      (isThreadAtLimit || isPersonAtLimit || collisionIds.length > 0) &&
      priority !== DispatchPriority.Immediate
    ) {
      return {
        priority: DispatchPriority.Batched,
        hold_until: new Date(now.getTime() + this.batchWindowMinutes * 60_000),
        included_queue_item_ids: collisionIds,
        reason: "Collision or budget limit detected; item moved into batch window.",
      };
    }

    return {
      priority,
      reason:
        priority === DispatchPriority.Immediate
          ? "Immediate item bypasses batching and sends now."
          : "Within budget and no collision pressure.",
    };
  }

  public async recordDispatch(queue_item: StackQueueItem, dispatched_at: Date): Promise<void> {
    await this.reconstructCountersIfMissing();
    const client = await this.queue.client;
    const pipeline = client.multi();

    for (const participantId of queue_item.concerning) {
      const key = this.personDailyKey(participantId, dispatched_at);
      pipeline.incr(key);
      pipeline.expire(key, this.secondsUntilEndOfDay(dispatched_at));
    }

    const threadKey = this.threadHourlyKey(queue_item.target_thread, dispatched_at);
    pipeline.incr(threadKey);
    pipeline.expire(threadKey, this.secondsUntilEndOfHour(dispatched_at));
    await pipeline.exec();
  }

  public async close(): Promise<void> {
    await this.queue.close();
  }

  private async collectCollisionIds(
    queue_item: StackQueueItem,
    target_thread: string,
  ): Promise<string[]> {
    const state = await this.stateService.getSystemState();
    const collidingIds = new Set<string>();
    const concerning = new Set(queue_item.concerning);

    for (const pending of state.queue.pending) {
      const sameThread = pending.target_thread === target_thread;
      const intersects = pending.concerning.some((entityId) => concerning.has(entityId));
      if (sameThread || intersects) {
        collidingIds.add(pending.id);
      }
    }

    for (const dispatched of state.queue.recently_dispatched) {
      const sameThread = dispatched.target_thread === target_thread;
      if (sameThread) {
        collidingIds.add(dispatched.id);
      }
    }

    return [...collidingIds];
  }

  private participantIds(): string[] {
    return runtimeSystemConfig.entities
      .filter((entity) => entity.messaging_identity !== null)
      .map((entity) => entity.id);
  }

  private resolvePriority(queue_item: StackQueueItem): DispatchPriority {
    const maybePriority = queue_item.priority;
    if (maybePriority === DispatchPriority.Immediate) {
      return DispatchPriority.Immediate;
    }
    if (maybePriority === DispatchPriority.Silent) {
      return DispatchPriority.Silent;
    }
    return DispatchPriority.Batched;
  }

  private personDailyKey(participantId: string, at: Date): string {
    const stamp = at.toISOString().slice(0, 10);
    return `fcc:budget:person:${participantId}:${stamp}`;
  }

  private threadHourlyKey(threadId: string, at: Date): string {
    const hourStamp = at.toISOString().slice(0, 13);
    return `fcc:budget:thread:${threadId}:${hourStamp}`;
  }

  private secondsUntilEndOfDay(at: Date): number {
    const end = new Date(at);
    end.setUTCHours(23, 59, 59, 999);
    return Math.max(1, Math.ceil((end.getTime() - at.getTime()) / 1000));
  }

  private secondsUntilEndOfHour(at: Date): number {
    const end = new Date(at);
    end.setUTCMinutes(59, 59, 999);
    return Math.max(1, Math.ceil((end.getTime() - at.getTime()) / 1000));
  }

  private async reconstructCountersIfMissing(): Promise<void> {
    if (this.hasCheckedReconstruction) {
      return;
    }
    this.hasCheckedReconstruction = true;

    const now = new Date();
    const client = await this.queue.client;
    const participantKeys = this.participantIds().map((id) => this.personDailyKey(id, now));
    const threadKeys = runtimeSystemConfig.threads.map((thread) =>
      this.threadHourlyKey(thread.id, now),
    );
    const [personValues, threadValues] = await Promise.all([
      client.mget(participantKeys),
      client.mget(threadKeys),
    ]);
    const personEntries = this.asNullableStringArray(personValues);
    const threadEntries = this.asNullableStringArray(threadValues);
    const hasAnyCounter = [...personEntries, ...threadEntries].some((value) => value !== null);
    if (hasAnyCounter) {
      return;
    }

    const records = await this.readDispatchHistoryForReconstruction(now);
    const personCounts = new Map<string, number>();
    const threadCounts = new Map<string, number>();
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const hourStart = new Date(now);
    hourStart.setUTCMinutes(0, 0, 0);

    for (const record of records) {
      if (record.dispatched_at >= dayStart) {
        for (const participantId of record.concerning) {
          personCounts.set(participantId, (personCounts.get(participantId) ?? 0) + 1);
        }
      }
      if (record.dispatched_at >= hourStart) {
        threadCounts.set(record.target_thread, (threadCounts.get(record.target_thread) ?? 0) + 1);
      }
    }

    const pipeline = client.multi();
    for (const participantId of this.participantIds()) {
      const value = personCounts.get(participantId) ?? 0;
      const key = this.personDailyKey(participantId, now);
      pipeline.set(key, value);
      pipeline.expire(key, this.secondsUntilEndOfDay(now));
    }
    for (const thread of runtimeSystemConfig.threads) {
      const value = threadCounts.get(thread.id) ?? 0;
      const key = this.threadHourlyKey(thread.id, now);
      pipeline.set(key, value);
      pipeline.expire(key, this.secondsUntilEndOfHour(now));
    }
    await pipeline.exec();
    this.logger.warn(
      {
        reconstructed_records: records.length,
        lookback_hours: this.reconstructionLookbackHours,
      },
      "Budget counters reconstructed from SQLite dispatch history.",
    );
  }

  private async readDispatchHistoryForReconstruction(now: Date): Promise<RecentDispatchRecord[]> {
    const from = new Date(now.getTime() - this.reconstructionLookbackHours * 60 * 60 * 1000);
    const fromIso = from.toISOString();
    const dedupe = new Set<string>();
    const records: RecentDispatchRecord[] = [];

    if (this.databasePath) {
      const db = new BetterSqlite3(this.databasePath, { readonly: true });
      try {
        const rows = db
          .prepare(
            "SELECT id, payload, dispatched_at FROM queue_recently_dispatched WHERE dispatched_at >= ?",
          )
          .all(fromIso) as Array<{ id: string; payload: string; dispatched_at: string }>;

        for (const row of rows) {
          if (dedupe.has(row.id)) {
            continue;
          }
          dedupe.add(row.id);
          records.push(
            this.normalizeDispatchRecord(row.id, row.payload, new Date(row.dispatched_at)),
          );
        }
      } finally {
        db.close();
      }
      return records;
    }

    const state = await this.stateService.getSystemState();
    for (const item of state.queue.recently_dispatched) {
      if (item.dispatched_at < from || dedupe.has(item.id)) {
        continue;
      }
      dedupe.add(item.id);
      records.push({
        id: item.id,
        dispatched_at: item.dispatched_at,
        target_thread: item.target_thread,
        concerning: this.resolveParticipantsForThread(item.target_thread),
      });
    }
    return records;
  }

  private normalizeDispatchRecord(
    id: string,
    payloadRaw: string,
    dispatchedAt: Date,
  ): RecentDispatchRecord {
    const parsed = JSON.parse(payloadRaw) as Record<string, unknown>;
    const outbound = this.recordValue(parsed.outbound);
    const targetThread =
      this.stringValue(outbound?.target_thread) ??
      this.stringValue(parsed.target_thread) ??
      "family";
    const concerningCandidate = this.arrayStringValue(outbound?.concerning) ?? [];
    const concerning =
      concerningCandidate.length > 0
        ? concerningCandidate
        : this.resolveParticipantsForThread(targetThread);
    return {
      id,
      dispatched_at: dispatchedAt,
      target_thread: targetThread,
      concerning,
    };
  }

  private resolveParticipantsForThread(threadId: string): string[] {
    const thread = runtimeSystemConfig.threads.find((candidate) => candidate.id === threadId);
    if (!thread) {
      return [];
    }
    return thread.participants;
  }

  private stringValue(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private arrayStringValue(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }
    const filtered = value.filter((entry): entry is string => typeof entry === "string");
    return filtered;
  }

  private recordValue(value: unknown): Record<string, unknown> | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private asNumber(value: unknown): number {
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private asNullableStringArray(value: unknown): Array<string | null> {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry) => (typeof entry === "string" ? entry : null));
  }
}

export function createBudgetService(options: BudgetServiceOptions): RedisBudgetService {
  return new RedisBudgetService(options);
}
