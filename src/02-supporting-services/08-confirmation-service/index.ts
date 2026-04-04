import { Queue } from "bullmq";
import { pino, type Logger } from "pino";

import { type PendingQueueItem } from "../../01-service-stack/04-queue/types.js";
import type { StackQueueItem } from "../../01-service-stack/types.js";
import { resolveRequesterPrivateThread } from "../../config/topic-delivery-policy.js";
import { toRedisConnection } from "../../lib/redis.js";
import { QueueItemSource, QueueItemType } from "../../types.js";
import type { ConfirmationRequest, ConfirmationService, StateService } from "../types.js";
import {
  ConfirmationReplyDecision,
  ConfirmationResult,
  ConfirmationStatus,
  type ConfirmationActionType,
  type ConfirmationExpiryNotification,
  type ConfirmationGates,
  type ConfirmationHistoryRecord,
  type ConfirmationRecoveryResult,
  type ConfirmationReplyOption,
  type ExpiredConfirmation,
  type PendingConfirmation,
  type ResolvedConfirmation,
} from "./types.js";

const DEFAULT_LOGGER = pino({ name: "confirmation-service" });
const DEFAULT_TIMER_QUEUE = "fcc-confirmation-timers";

const APPROVAL_TOKENS = [
  "yes",
  "y",
  "yeah",
  "yep",
  "approve",
  "approved",
  "ok",
  "okay",
  "looks good",
  "do it",
  "send it",
  "confirm",
  "positive",
  "positive reaction",
] as const;

const REJECTION_TOKENS = [
  "no",
  "n",
  "nope",
  "reject",
  "rejected",
  "decline",
  "declined",
  "dont",
  "don't",
  "stop",
  "cancel",
  "negative",
  "negative reaction",
] as const;

interface ConfirmationTimerJob {
  confirmation_id: string;
}

export interface ConfirmationServiceOptions {
  redis_url: string;
  gates: ConfirmationGates;
  state_service: StateService;
  logger?: Logger;
  timer_queue_name?: string;
}

interface PendingConfirmationStateUpdate {
  pending: PendingConfirmation[];
  recent: ConfirmationHistoryRecord[];
  expired: ExpiredConfirmation[];
}

interface ConfirmationReplyMatch {
  confirmation: PendingConfirmation;
  result: ConfirmationResult.Approved | ConfirmationResult.Rejected;
  matched_thread_policy: "exact_thread" | "requester_private_allowed";
}

export function isAllowedConfirmationReplyThread(
  confirmation: Pick<PendingConfirmation, "approval_thread_policy" | "requested_by">,
  attemptedThread: string,
): boolean {
  if (confirmation.approval_thread_policy !== "requester_private_allowed") {
    return false;
  }
  const requesterPrivateThread = resolveRequesterPrivateThread(confirmation.requested_by);
  if (!requesterPrivateThread) {
    return false;
  }
  return requesterPrivateThread === attemptedThread;
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function defaultReplyOptions(): ConfirmationReplyOption[] {
  return [
    {
      key: "yes",
      label: "Yes, approve",
      aliases: ["1", "a", ...APPROVAL_TOKENS],
      decision: ConfirmationReplyDecision.Approve,
    },
    {
      key: "no",
      label: "No, reject",
      aliases: ["2", "b", ...REJECTION_TOKENS],
      decision: ConfirmationReplyDecision.Reject,
    },
  ];
}

function uniqueNormalized(values: string[]): string[] {
  return [
    ...new Set(values.map((value) => normalizeText(value)).filter((value) => value.length > 0)),
  ];
}

function normalizeReplyOptions(options?: ConfirmationReplyOption[]): ConfirmationReplyOption[] {
  const source = options && options.length > 0 ? options : defaultReplyOptions();
  return source.map((option) => ({
    ...option,
    aliases: uniqueNormalized([option.key, option.label, ...option.aliases]),
  }));
}

function buildConfirmationId(now: Date): string {
  return `confirm_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractReplyText(queueItem: StackQueueItem): string | null {
  return typeof queueItem.content === "string" ? normalizeText(queueItem.content) : null;
}

export class BullConfirmationService implements ConfirmationService {
  private readonly logger: Logger;

  private readonly stateService: StateService;

  private readonly gates: ConfirmationGates;

  private readonly timerQueue: Queue<ConfirmationTimerJob>;

  public constructor(options: ConfirmationServiceOptions) {
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.stateService = options.state_service;
    this.gates = options.gates;
    this.timerQueue = new Queue<ConfirmationTimerJob>(
      options.timer_queue_name ?? DEFAULT_TIMER_QUEUE,
      {
        connection: toRedisConnection(options.redis_url),
      },
    );
  }

  public async getState() {
    const state = await this.stateService.getSystemState();
    return {
      pending: state.confirmations.pending.map((confirmation) =>
        this.normalizePendingConfirmation(confirmation),
      ),
      recent: state.confirmations.recent,
    };
  }

  public requiresConfirmation(type: ConfirmationActionType): boolean {
    return this.gates.always_require_approval.includes(type);
  }

  public async openConfirmation(request: ConfirmationRequest): Promise<PendingConfirmation> {
    const state = await this.stateService.getSystemState();
    const requestedAt = request.requested_at ?? new Date();
    const expiresAt =
      request.expires_at ?? new Date(requestedAt.getTime() + this.gates.expiry_minutes * 60_000);
    const confirmation: PendingConfirmation = {
      id: buildConfirmationId(requestedAt),
      type: request.type,
      action: request.action,
      requested_by: request.requested_by,
      requested_in_thread: request.requested_in_thread,
      origin_thread: request.origin_thread ?? request.requested_in_thread,
      approval_thread_policy: request.approval_thread_policy ?? "exact_thread",
      requested_at: requestedAt,
      expires_at: expiresAt,
      status: ConfirmationStatus.Pending,
      result: ConfirmationResult.NotYetApproved,
      reply_options: normalizeReplyOptions(request.reply_options),
      expiry_message: request.expiry_message ?? this.gates.on_expiry,
    };

    state.confirmations.pending = [
      ...state.confirmations.pending.map((pending) => this.normalizePendingConfirmation(pending)),
      confirmation,
    ];
    await this.stateService.saveSystemState(state);
    await this.scheduleExpiryTimer(confirmation);
    this.logger.info(
      {
        confirmation_id: confirmation.id,
        requested_in_thread: confirmation.requested_in_thread,
        expires_at: confirmation.expires_at.toISOString(),
      },
      "Confirmation opened.",
    );
    return confirmation;
  }

  public async resolveFromQueueItem(
    queueItem: StackQueueItem,
  ): Promise<ResolvedConfirmation | null> {
    const state = await this.stateService.getSystemState();
    const expiredState = this.expireOverduePending(
      state.confirmations.pending,
      state.confirmations.recent,
      queueItem.created_at,
    );
    let pending = expiredState.pending;
    let recent = expiredState.recent;
    const replyMatch =
      this.findReplyMatch(queueItem, pending, false) ??
      this.findReplyMatch(queueItem, pending, true);

    if (!replyMatch) {
      if (expiredState.expired.length > 0) {
        state.confirmations.pending = pending;
        state.confirmations.recent = recent;
        await this.stateService.saveSystemState(state);
      }
      return null;
    }

    const resolved = this.resolveConfirmation(
      replyMatch.confirmation,
      replyMatch.result,
      queueItem.target_thread,
      queueItem.created_at,
    );

    pending = pending.filter((confirmation) => confirmation.id !== replyMatch.confirmation.id);
    recent = [...recent, resolved];
    state.confirmations.pending = pending;
    state.confirmations.recent = recent;
    await this.stateService.saveSystemState(state);
    await this.removeExpiryTimer(replyMatch.confirmation.id);
    this.logger.info(
      {
        confirmation_id: replyMatch.confirmation.id,
        result: resolved.result,
        resolved_in_thread: resolved.resolved_in_thread,
      },
      "Confirmation resolved from queue item.",
    );
    return resolved;
  }

  public async expirePending(now: Date): Promise<ExpiredConfirmation[]> {
    const state = await this.stateService.getSystemState();
    const update = this.expireOverduePending(
      state.confirmations.pending,
      state.confirmations.recent,
      now,
    );
    if (update.expired.length === 0) {
      return [];
    }

    state.confirmations.pending = update.pending;
    state.confirmations.recent = update.recent;
    await this.stateService.saveSystemState(state);
    this.logger.info({ expired: update.expired.length }, "Pending confirmations expired.");
    return update.expired;
  }

  public async reconcileOnStartup(now: Date): Promise<ConfirmationRecoveryResult> {
    const expired = await this.expirePending(now);
    const notifications = expired.map((confirmation) =>
      this.buildExpiryNotification(confirmation, now),
    );
    return {
      expired,
      notifications,
    };
  }

  public async close(): Promise<void> {
    await this.timerQueue.close();
  }

  private normalizePendingConfirmation(confirmation: PendingConfirmation): PendingConfirmation {
    const requestedAt = confirmation.requested_at;
    const expiresAt =
      confirmation.expires_at ??
      new Date(requestedAt.getTime() + this.gates.expiry_minutes * 60_000);
    return {
      ...confirmation,
      requested_at: requestedAt,
      expires_at: expiresAt,
      status: ConfirmationStatus.Pending,
      result: ConfirmationResult.NotYetApproved,
      reply_options: normalizeReplyOptions(confirmation.reply_options),
      expiry_message: confirmation.expiry_message ?? this.gates.on_expiry,
    };
  }

  // Confirmation replies are scoped to the originating thread so a later "yes" elsewhere cannot
  // accidentally authorize a protected action.
  private findReplyMatch(
    queueItem: StackQueueItem,
    pending: PendingConfirmation[],
    allowWrongThreadMatch: boolean,
  ): ConfirmationReplyMatch | null {
    const sorted = [...pending].sort(
      (left, right) => right.requested_at.getTime() - left.requested_at.getTime(),
    );

    for (const confirmation of sorted) {
      const exactThread = confirmation.requested_in_thread === queueItem.target_thread;
      const fallbackThreadAllowed =
        !exactThread &&
        allowWrongThreadMatch &&
        this.isApprovalReplyThreadAllowed(confirmation, queueItem.target_thread);
      if ((!exactThread && !fallbackThreadAllowed) || (exactThread && allowWrongThreadMatch)) {
        continue;
      }
      if (!queueItem.concerning.includes(confirmation.requested_by)) {
        continue;
      }

      const result = this.matchReplyToConfirmation(queueItem, confirmation);
      if (!result) {
        continue;
      }

      return {
        confirmation,
        result,
        matched_thread_policy: exactThread ? "exact_thread" : "requester_private_allowed",
      };
    }

    return null;
  }

  private matchReplyToConfirmation(
    queueItem: StackQueueItem,
    confirmation: PendingConfirmation,
  ): ConfirmationResult.Approved | ConfirmationResult.Rejected | null {
    const normalizedReply = extractReplyText(queueItem);
    if (normalizedReply) {
      for (const option of confirmation.reply_options) {
        if (option.aliases.includes(normalizedReply)) {
          return option.decision === ConfirmationReplyDecision.Approve
            ? ConfirmationResult.Approved
            : ConfirmationResult.Rejected;
        }
      }
    }

    if (queueItem.source !== QueueItemSource.Reaction || !normalizedReply) {
      return null;
    }

    if (normalizedReply.includes("positive")) {
      return ConfirmationResult.Approved;
    }
    if (normalizedReply.includes("negative")) {
      return ConfirmationResult.Rejected;
    }

    return null;
  }

  private resolveConfirmation(
    confirmation: PendingConfirmation,
    result: ConfirmationResult.Approved | ConfirmationResult.Rejected,
    resolvedInThread: string,
    resolvedAt: Date,
  ): ResolvedConfirmation {
    return {
      ...confirmation,
      status: ConfirmationStatus.Resolved,
      result,
      resolved_at: resolvedAt,
      resolved_in_thread: resolvedInThread,
    };
  }

  private isApprovalReplyThreadAllowed(
    confirmation: PendingConfirmation,
    attemptedThread: string,
  ): boolean {
    return isAllowedConfirmationReplyThread(confirmation, attemptedThread);
  }

  // Expiry is recorded before any later reply is considered so downtime or delayed delivery never
  // causes an expired protected action to execute.
  private expireOverduePending(
    pendingConfirmations: PendingConfirmation[],
    recentConfirmations: ConfirmationHistoryRecord[],
    now: Date,
  ): PendingConfirmationStateUpdate {
    const pending: PendingConfirmation[] = [];
    const expired: ExpiredConfirmation[] = [];

    for (const pendingConfirmation of pendingConfirmations.map((confirmation) =>
      this.normalizePendingConfirmation(confirmation),
    )) {
      if (pendingConfirmation.expires_at <= now) {
        expired.push({
          ...pendingConfirmation,
          status: ConfirmationStatus.Expired,
          result: ConfirmationResult.Expired,
          expired_at: now,
        });
        continue;
      }

      pending.push(pendingConfirmation);
    }

    return {
      pending,
      recent: [...recentConfirmations, ...expired],
      expired,
    };
  }

  private buildExpiryNotification(
    confirmation: ExpiredConfirmation,
    now: Date,
  ): ConfirmationExpiryNotification {
    const message = `${confirmation.action} expired. ${confirmation.expiry_message ?? this.gates.on_expiry}`;
    const queueItem: PendingQueueItem = {
      id: `confirm_expired_${confirmation.id}_${now.getTime()}`,
      source: QueueItemSource.InternalStateChange,
      type: QueueItemType.Outbound,
      concerning: [confirmation.requested_by],
      content: message,
      target_thread: confirmation.requested_in_thread,
      created_at: now,
      idempotency_key: `confirmation-expired:${confirmation.id}`,
    };

    return {
      confirmation_id: confirmation.id,
      target_thread: confirmation.requested_in_thread,
      message,
      queue_item: queueItem,
    };
  }

  private async scheduleExpiryTimer(confirmation: PendingConfirmation): Promise<void> {
    const delayMs = Math.max(0, confirmation.expires_at.getTime() - Date.now());
    await this.timerQueue.add(
      "confirmation_expiry",
      {
        confirmation_id: confirmation.id,
      },
      {
        delay: delayMs,
        jobId: confirmation.id,
      },
    );
  }

  private async removeExpiryTimer(confirmationId: string): Promise<void> {
    const job = await this.timerQueue.getJob(confirmationId);
    await job?.remove();
  }
}

export function createConfirmationService(
  options: ConfirmationServiceOptions,
): BullConfirmationService {
  return new BullConfirmationService(options);
}
