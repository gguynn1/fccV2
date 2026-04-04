import BetterSqlite3 from "better-sqlite3";
import { Queue } from "bullmq";
import { pino, type Logger } from "pino";

import type {
  CollisionPolicy,
  StackClassificationResult,
  StackQueueItem,
} from "../../01-service-stack/types.js";
import { runtimeSystemConfig } from "../../config/runtime-system-config.js";
import {
  getDefaultQuietHours,
  getTopicDeliveryPolicy,
} from "../../config/topic-delivery-policy.js";
import { toRedisConnection } from "../../lib/redis.js";
import { DispatchPriority, QueueItemSource } from "../../types.js";
import type { BudgetDecision, BudgetService, StateService } from "../types.js";
import type { OutboundBudgetTracker } from "./types.js";

const DEFAULT_LOGGER = pino({ name: "budget-service" });
const DEFAULT_QUEUE_NAME = "fcc-budget-counters";
const DEFAULT_QUIET_WINDOW_MINUTES = 20;
const DEFAULT_TOPIC_COOLDOWN_MINUTES = 30;
const DEFAULT_PARTICIPANT_PAUSE_HOURS = 12;
const DEFAULT_TOPIC_PAUSE_HOURS = 24;
const NEGATIVE_SIGNAL_PATTERN =
  /\b(?:not now|quiet|pause|leave me alone|too much|enough|mute|maybe later)\b|^(?:later|stop|stop please|please stop)$/iu;

function parseClockToMinutes(raw: string): number {
  const [hourRaw = "0", minuteRaw = "0"] = raw.split(":");
  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

export function quietHoursRemainingMs(
  now: Date,
  quietHours: { start: string; end: string },
): number {
  const startMinutes = parseClockToMinutes(quietHours.start);
  const endMinutes = parseClockToMinutes(quietHours.end);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const wraps = startMinutes >= endMinutes;
  const inQuietHours = wraps
    ? nowMinutes >= startMinutes || nowMinutes < endMinutes
    : nowMinutes >= startMinutes && nowMinutes < endMinutes;
  if (!inQuietHours) {
    return 0;
  }
  const endDate = new Date(now);
  if (wraps && nowMinutes >= startMinutes) {
    endDate.setDate(endDate.getDate() + 1);
  }
  endDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  return Math.max(0, endDate.getTime() - now.getTime());
}

export function matchesBudgetPauseSignal(content: string): boolean {
  return NEGATIVE_SIGNAL_PATTERN.test(content.trim().toLowerCase());
}

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

  private readonly reconstructionLookbackHours: number;

  private hasCheckedReconstruction = false;

  public constructor(options: BudgetServiceOptions) {
    this.queue = new Queue(DEFAULT_QUEUE_NAME, {
      connection: toRedisConnection(options.redis_url),
    });
    this.stateService = options.state_service;
    this.databasePath = options.database_path;
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
        max: this.getOutboundBudget().max_unprompted_per_person_per_day,
        messages: [],
      };
    }

    const byThread: OutboundBudgetTracker["by_thread"] = {};
    for (const thread of runtimeSystemConfig.threads) {
      const count = this.asNumber(await client.get(this.threadHourlyKey(thread.id, now)));
      byThread[thread.id] = {
        last_hour_count: count,
        max_per_hour: this.getOutboundBudget().max_messages_per_thread_per_hour,
        last_sent_at: null,
      };
    }

    return {
      date: now,
      by_person: byPerson,
      by_thread: byThread,
    };
  }

  public async recordHumanSignal(
    queue_item: StackQueueItem,
    classification?: StackClassificationResult,
  ): Promise<void> {
    if (!this.isParticipantInitiated(queue_item.source)) {
      return;
    }

    const client = await this.queue.client;
    const pipeline = client.multi();
    const quietSeconds = DEFAULT_QUIET_WINDOW_MINUTES * 60;
    pipeline.set(this.threadQuietKey(queue_item.target_thread), "1");
    pipeline.expire(this.threadQuietKey(queue_item.target_thread), quietSeconds);
    for (const participantId of queue_item.concerning) {
      pipeline.set(this.personQuietKey(participantId), "1");
      pipeline.expire(this.personQuietKey(participantId), quietSeconds);
    }

    const topic = classification?.topic ?? queue_item.topic;
    const content = this.readContentText(queue_item);
    if (topic && this.isNegativeHumanSignal(content)) {
      const personPauseSeconds = DEFAULT_PARTICIPANT_PAUSE_HOURS * 60 * 60;
      const topicPauseSeconds = DEFAULT_TOPIC_PAUSE_HOURS * 60 * 60;
      for (const participantId of queue_item.concerning) {
        pipeline.set(this.personPauseKey(participantId), "1");
        pipeline.expire(this.personPauseKey(participantId), personPauseSeconds);
        pipeline.set(this.personTopicPauseKey(participantId, topic), "1");
        pipeline.expire(this.personTopicPauseKey(participantId, topic), topicPauseSeconds);
      }
    }

    await pipeline.exec();
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
    const topicQuota = this.resolveTopicQuota(queue_item);
    const [threadCount, personCounts, topicCounts, collisionIds] = await Promise.all([
      client.get(this.threadHourlyKey(target_thread, now)),
      Promise.all(
        concerning.map(async (participantId) =>
          this.asNumber(await client.get(this.personDailyKey(participantId, now))),
        ),
      ),
      Promise.all(
        concerning.map(async (participantId) =>
          topicQuota && queue_item.topic
            ? this.asNumber(
                await client.get(this.topicDailyKey(participantId, queue_item.topic, now)),
              )
            : 0,
        ),
      ),
      this.collectCollisionIds(queue_item, target_thread),
    ]);
    const [threadQuietMs, personQuietMs, personPauseMs, topicPauseMs, state] = await Promise.all([
      this.getThreadQuietRemainingMs(target_thread),
      Promise.all(
        queue_item.concerning.map((participantId) => this.getPersonQuietRemainingMs(participantId)),
      ),
      Promise.all(
        queue_item.concerning.map((participantId) => this.getPersonPauseRemainingMs(participantId)),
      ),
      Promise.all(
        queue_item.concerning.map((participantId) =>
          queue_item.topic
            ? this.getTopicPauseRemainingMs(participantId, queue_item.topic)
            : Promise.resolve(0),
        ),
      ),
      this.stateService.getSystemState(),
    ]);

    const budget = this.getOutboundBudget();
    const isThreadAtLimit = this.asNumber(threadCount) >= budget.max_messages_per_thread_per_hour;
    const isPersonAtLimit = personCounts.some(
      (count) => count >= budget.max_unprompted_per_person_per_day,
    );
    const topicQuotaMax = topicQuota?.max_unprompted_per_person_per_day;
    const isTopicAtLimit =
      topicQuotaMax !== undefined && topicCounts.some((count) => count >= topicQuotaMax);
    const quietHoursMs = this.getQuietHoursRemainingMs(now);
    const participantPauseMs = Math.max(...personPauseMs, ...topicPauseMs, 0);
    const suppressionSignals = this.collectSuppressionSignals({
      queue_item,
      state,
      quiet_window_ms: Math.max(threadQuietMs, ...personQuietMs, 0),
      quiet_hours_ms: quietHoursMs,
      participant_pause_ms: participantPauseMs,
      collision_count: collisionIds.length,
      is_thread_at_limit: isThreadAtLimit,
      is_person_at_limit: isPersonAtLimit,
      is_topic_at_limit: Boolean(isTopicAtLimit),
    });
    if (
      (isThreadAtLimit || isPersonAtLimit || isTopicAtLimit || collisionIds.length > 0) &&
      priority !== DispatchPriority.Immediate
    ) {
      return {
        priority: DispatchPriority.Batched,
        hold_until: isTopicAtLimit
          ? this.nextLocalDayStart(now)
          : new Date(now.getTime() + budget.batch_window_minutes * 60_000),
        included_queue_item_ids: collisionIds,
        reason: "Collision or budget limit detected; item moved into batch window.",
        reason_codes: suppressionSignals,
      };
    }

    const quietWindowMs = Math.max(threadQuietMs, ...personQuietMs, 0);
    const topicCooldownUntil = this.detectTopicCooldownUntil(queue_item, target_thread, state, now);
    const topicCooldownMs = topicCooldownUntil ? topicCooldownUntil.getTime() - now.getTime() : 0;
    if (
      priority !== DispatchPriority.Immediate &&
      !this.isParticipantInitiated(queue_item.source) &&
      participantPauseMs > 0
    ) {
      return {
        priority: DispatchPriority.Batched,
        hold_until: new Date(now.getTime() + participantPauseMs),
        included_queue_item_ids: collisionIds,
        reason:
          "Recent participant quiet signal is still active; deferred to reduce alert fatigue.",
        reason_codes: suppressionSignals,
      };
    }
    const shouldSuppressForNoise =
      priority !== DispatchPriority.Immediate &&
      !this.isParticipantInitiated(queue_item.source) &&
      (quietWindowMs > 0 || topicCooldownMs > 0 || quietHoursMs > 0);
    if (shouldSuppressForNoise) {
      const holdUntil = new Date(
        now.getTime() + Math.max(quietWindowMs, topicCooldownMs, quietHoursMs),
      );
      return {
        priority: DispatchPriority.Batched,
        hold_until: holdUntil,
        included_queue_item_ids: collisionIds,
        reason: "Active quiet window or topic cooldown; deferred to reduce alert fatigue.",
        reason_codes: suppressionSignals.length > 0 ? suppressionSignals : ["noise_suppression"],
      };
    }

    return {
      priority,
      reason:
        priority === DispatchPriority.Immediate
          ? "Immediate item bypasses batching and sends now."
          : "Within budget and no collision pressure.",
      reason_codes:
        priority === DispatchPriority.Immediate ? ["immediate_bypass"] : ["within_budget"],
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
      if (queue_item.topic) {
        const topicKey = this.topicDailyKey(participantId, queue_item.topic, dispatched_at);
        pipeline.incr(topicKey);
        pipeline.expire(topicKey, this.secondsUntilEndOfDay(dispatched_at));
      }
    }

    const threadKey = this.threadHourlyKey(queue_item.target_thread, dispatched_at);
    pipeline.incr(threadKey);
    pipeline.expire(threadKey, this.secondsUntilEndOfHour(dispatched_at));
    if (this.isParticipantInitiated(queue_item.source)) {
      const quietSeconds = DEFAULT_QUIET_WINDOW_MINUTES * 60;
      const threadQuietKey = this.threadQuietKey(queue_item.target_thread);
      pipeline.set(threadQuietKey, "1");
      pipeline.expire(threadQuietKey, quietSeconds);
      for (const participantId of queue_item.concerning) {
        const personQuietKey = this.personQuietKey(participantId);
        pipeline.set(personQuietKey, "1");
        pipeline.expire(personQuietKey, quietSeconds);
      }
    }
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

  private getOutboundBudget() {
    return runtimeSystemConfig.dispatch.outbound_budget;
  }

  private resolvePriority(queue_item: StackQueueItem): DispatchPriority {
    const maybePriority = queue_item.priority;
    if (maybePriority === DispatchPriority.Immediate) {
      return DispatchPriority.Immediate;
    }
    if (maybePriority === DispatchPriority.Silent) {
      return DispatchPriority.Silent;
    }
    if (
      queue_item.source === QueueItemSource.HumanMessage ||
      queue_item.source === QueueItemSource.Reaction ||
      queue_item.source === QueueItemSource.ForwardedMessage ||
      queue_item.source === QueueItemSource.ImageAttachment
    ) {
      return DispatchPriority.Immediate;
    }
    return DispatchPriority.Batched;
  }

  private personDailyKey(participantId: string, at: Date): string {
    const stamp = at.toISOString().slice(0, 10);
    return `fcc:budget:person:${participantId}:${stamp}`;
  }

  private topicDailyKey(participantId: string, topic: string, at: Date): string {
    const stamp = at.toISOString().slice(0, 10);
    return `fcc:budget:topic:${participantId}:${topic}:${stamp}`;
  }

  private threadHourlyKey(threadId: string, at: Date): string {
    const hourStamp = at.toISOString().slice(0, 13);
    return `fcc:budget:thread:${threadId}:${hourStamp}`;
  }

  private threadQuietKey(threadId: string): string {
    return `fcc:budget:quiet:thread:${threadId}`;
  }

  private personQuietKey(participantId: string): string {
    return `fcc:budget:quiet:person:${participantId}`;
  }

  private personPauseKey(participantId: string): string {
    return `fcc:budget:pause:person:${participantId}`;
  }

  private personTopicPauseKey(participantId: string, topic: string): string {
    return `fcc:budget:pause:topic:${participantId}:${topic}`;
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

  private nextLocalDayStart(at: Date): Date {
    return new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, 7, 0, 0, 0);
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
      participantKeys.length === 0 ? [] : client.mget(participantKeys),
      threadKeys.length === 0 ? [] : client.mget(threadKeys),
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

  private async getThreadQuietRemainingMs(threadId: string): Promise<number> {
    const client = await this.queue.client;
    const ttlMs = await client.pttl(this.threadQuietKey(threadId));
    return typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : 0;
  }

  private async getPersonQuietRemainingMs(participantId: string): Promise<number> {
    const client = await this.queue.client;
    const ttlMs = await client.pttl(this.personQuietKey(participantId));
    return typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : 0;
  }

  private async getPersonPauseRemainingMs(participantId: string): Promise<number> {
    const client = await this.queue.client;
    const ttlMs = await client.pttl(this.personPauseKey(participantId));
    return typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : 0;
  }

  private async getTopicPauseRemainingMs(participantId: string, topic: string): Promise<number> {
    const client = await this.queue.client;
    const ttlMs = await client.pttl(this.personTopicPauseKey(participantId, topic));
    return typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : 0;
  }

  private getQuietHoursRemainingMs(now: Date): number {
    return quietHoursRemainingMs(
      now,
      this.getOutboundBudget().quiet_hours ?? getDefaultQuietHours(),
    );
  }

  private detectTopicCooldownUntil(
    queueItem: StackQueueItem,
    targetThread: string,
    state: Awaited<ReturnType<StateService["getSystemState"]>>,
    now: Date,
  ): Date | null {
    const topic = queueItem.topic;
    if (!topic) {
      return null;
    }
    const cooldownMinutes =
      getTopicDeliveryPolicy(topic).notification_quota?.cooldown_minutes ??
      DEFAULT_TOPIC_COOLDOWN_MINUTES;
    const cooldownStartMs = now.getTime() - cooldownMinutes * 60_000;
    const concerning = new Set(queueItem.concerning);
    let latestMatch: Date | null = null;

    for (const dispatched of state.queue.recently_dispatched) {
      if (dispatched.dispatched_at.getTime() < cooldownStartMs) {
        continue;
      }
      if (dispatched.topic !== topic) {
        continue;
      }
      const sameThread = dispatched.target_thread === targetThread;
      const intersects = this.resolveParticipantsForThread(dispatched.target_thread).some(
        (entityId) => concerning.has(entityId),
      );
      if (!sameThread && !intersects) {
        continue;
      }
      if (latestMatch === null || dispatched.dispatched_at > latestMatch) {
        latestMatch = dispatched.dispatched_at;
      }
    }

    if (!latestMatch) {
      return null;
    }
    return new Date(latestMatch.getTime() + cooldownMinutes * 60_000);
  }

  private isParticipantInitiated(source: QueueItemSource): boolean {
    return (
      source === QueueItemSource.HumanMessage ||
      source === QueueItemSource.Reaction ||
      source === QueueItemSource.ForwardedMessage ||
      source === QueueItemSource.ImageAttachment
    );
  }

  private collectSuppressionSignals(input: {
    queue_item: StackQueueItem;
    state: Awaited<ReturnType<StateService["getSystemState"]>>;
    quiet_window_ms: number;
    quiet_hours_ms: number;
    participant_pause_ms: number;
    collision_count: number;
    is_thread_at_limit: boolean;
    is_person_at_limit: boolean;
    is_topic_at_limit: boolean;
  }): string[] {
    const reasonCodes: string[] = [];
    if (input.collision_count > 0) {
      reasonCodes.push("collision_pressure");
    }
    if (input.is_thread_at_limit) {
      reasonCodes.push("thread_budget_exhausted");
    }
    if (input.is_person_at_limit) {
      reasonCodes.push("participant_budget_exhausted");
    }
    if (input.is_topic_at_limit) {
      reasonCodes.push("topic_budget_exhausted");
    }
    if (input.quiet_window_ms > 0) {
      reasonCodes.push("quiet_window_active");
    }
    if (input.quiet_hours_ms > 0) {
      reasonCodes.push("quiet_hours_active");
    }
    if (input.participant_pause_ms > 0) {
      reasonCodes.push("participant_pause_active");
    }
    const hasPendingConfirmation = input.state.confirmations.pending.some((confirmation) =>
      input.queue_item.concerning.includes(confirmation.requested_by),
    );
    if (hasPendingConfirmation) {
      reasonCodes.push("pending_confirmation_pressure");
    }
    const hasActiveEscalation = input.state.escalation_status.active.length > 0;
    if (hasActiveEscalation) {
      reasonCodes.push("active_escalation_pressure");
    }
    return reasonCodes;
  }

  private resolveTopicQuota(queueItem: StackQueueItem) {
    if (!queueItem.topic) {
      return null;
    }
    return getTopicDeliveryPolicy(queueItem.topic).notification_quota ?? null;
  }

  private readContentText(queueItem: StackQueueItem): string {
    if (typeof queueItem.content === "string") {
      return queueItem.content;
    }
    if (
      typeof queueItem.content === "object" &&
      queueItem.content !== null &&
      "summary" in queueItem.content &&
      typeof queueItem.content.summary === "string"
    ) {
      return queueItem.content.summary;
    }
    return JSON.stringify(queueItem.content);
  }

  private isNegativeHumanSignal(content: string): boolean {
    return matchesBudgetPauseSignal(content);
  }
}

export function createBudgetService(options: BudgetServiceOptions): RedisBudgetService {
  return new RedisBudgetService(options);
}
