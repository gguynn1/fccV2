import { ThreadType, type Thread } from "../02-supporting-services/05-routing-service/types.js";
import { TopicKey } from "../types.js";
import { runtimeSystemConfig } from "./runtime-system-config.js";

export enum TopicPrivacyScope {
  Private = "private",
  RestrictedShared = "restricted_shared",
  Shared = "shared",
}

export type TopicThreadDeliveryKind =
  | "response"
  | "proactive"
  | "awareness"
  | "confirmation"
  | "digest";

export type TopicAwarenessPolicy = "none" | "summary";

export type ConfirmationApprovalThreadPolicy = "exact_thread" | "requester_private_allowed";

export interface QuietHoursWindow {
  start: string;
  end: string;
}

export interface TopicNotificationQuota {
  max_unprompted_per_person_per_day?: number;
  cooldown_minutes?: number;
}

export interface TopicDeliveryPolicy {
  topic: TopicKey;
  privacy_scope: TopicPrivacyScope;
  response_thread_policy: "origin_thread";
  follow_up_thread_policy: "same_or_narrowest_allowed";
  awareness_policy: TopicAwarenessPolicy;
  allowed_thread_ids: string[];
  denied_thread_ids: string[];
  digest_policy: "same_target" | "private_if_available";
  confirmation_policy: ConfirmationApprovalThreadPolicy;
  notification_quota?: TopicNotificationQuota;
  quiet_hours?: QuietHoursWindow;
}

export interface TopicThreadPolicyCheck {
  topic: TopicKey;
  thread_id: string;
  concerning: string[];
  delivery_kind: TopicThreadDeliveryKind;
  requested_by?: string;
}

const DEFAULT_QUIET_HOURS: QuietHoursWindow = {
  start: "21:00",
  end: "07:00",
};

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function routingRecord(topic: TopicKey): Record<string, unknown> {
  const topicConfig = runtimeSystemConfig.topics[topic];
  if (!topicConfig || typeof topicConfig !== "object") {
    return {};
  }
  const routing = "routing" in topicConfig ? topicConfig.routing : {};
  if (typeof routing !== "object" || routing === null) {
    return {};
  }
  return routing as Record<string, unknown>;
}

function threadById(threadId: string): Thread | null {
  return runtimeSystemConfig.threads.find((thread) => thread.id === threadId) ?? null;
}

function collectHintedSharedThreadIds(topic: TopicKey): string[] {
  const routing = routingRecord(topic);
  const knownSharedThreads = new Set(
    runtimeSystemConfig.threads
      .filter((thread) => thread.type === ThreadType.Shared)
      .map((thread) => thread.id),
  );
  const hinted = Object.values(routing)
    .filter((value): value is string => typeof value === "string")
    .filter((value) => knownSharedThreads.has(value));
  return uniqueStrings(hinted);
}

function deniedThreadIds(topic: TopicKey): string[] {
  const never = routingRecord(topic).never;
  if (!Array.isArray(never)) {
    return [];
  }
  return uniqueStrings(never.filter((value): value is string => typeof value === "string"));
}

export function parseDurationToMinutes(raw: string | null | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)\s*([mhd])$/u);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  const quantity = Number.parseInt(match[1], 10);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return undefined;
  }
  if (match[2] === "m") {
    return quantity;
  }
  if (match[2] === "h") {
    return quantity * 60;
  }
  return quantity * 24 * 60;
}

export function getThreadById(threadId: string): Thread | null {
  return threadById(threadId);
}

export function isSharedThreadId(threadId: string): boolean {
  return threadById(threadId)?.type === ThreadType.Shared;
}

export function isPrivateThreadId(threadId: string): boolean {
  return threadById(threadId)?.type === ThreadType.Private;
}

function allowsPrivateThread(topic: TopicKey, deliveryKind: TopicThreadDeliveryKind): boolean {
  switch (topic) {
    case TopicKey.Relationship:
      return false;
    case TopicKey.Finances:
      return deliveryKind === "response" || deliveryKind === "confirmation";
    case TopicKey.Grocery:
      return deliveryKind === "response" || deliveryKind === "confirmation";
    default:
      return true;
  }
}

function privateThreadMatchesAudience(
  thread: Thread,
  concerning: string[],
  requestedBy?: string,
): boolean {
  const participantId = thread.participants[0];
  if (!participantId) {
    return false;
  }
  if (requestedBy && participantId === requestedBy) {
    return true;
  }
  return concerning.includes(participantId);
}

function sharedThreadMatchesAudience(thread: Thread, concerning: string[]): boolean {
  return concerning.every((entityId) => thread.participants.includes(entityId));
}

function defaultNotificationQuota(topic: TopicKey): TopicNotificationQuota | undefined {
  switch (topic) {
    case TopicKey.Relationship: {
      const minimumGap = runtimeSystemConfig.topics.relationship?.minimum_gap_between_nudges;
      return {
        max_unprompted_per_person_per_day: 1,
        cooldown_minutes: parseDurationToMinutes(minimumGap) ?? 5 * 24 * 60,
      };
    }
    case TopicKey.Health:
      return { max_unprompted_per_person_per_day: 2, cooldown_minutes: 120 };
    case TopicKey.Pets:
      return { max_unprompted_per_person_per_day: 1, cooldown_minutes: 240 };
    case TopicKey.FamilyStatus:
      return { max_unprompted_per_person_per_day: 2, cooldown_minutes: 60 };
    default:
      return undefined;
  }
}

export function getTopicDeliveryPolicy(topic: TopicKey): TopicDeliveryPolicy {
  const allowedShared = collectHintedSharedThreadIds(topic);
  const denied = deniedThreadIds(topic);

  switch (topic) {
    case TopicKey.Health:
      return {
        topic,
        privacy_scope: TopicPrivacyScope.Private,
        response_thread_policy: "origin_thread",
        follow_up_thread_policy: "same_or_narrowest_allowed",
        awareness_policy: "none",
        allowed_thread_ids: [],
        denied_thread_ids: uniqueStrings([
          ...denied,
          ...runtimeSystemConfig.threads
            .filter((thread) => thread.type === ThreadType.Shared)
            .map((thread) => thread.id),
        ]),
        digest_policy: "private_if_available",
        confirmation_policy: "exact_thread",
        notification_quota: defaultNotificationQuota(topic),
        quiet_hours: DEFAULT_QUIET_HOURS,
      };
    case TopicKey.Relationship:
      return {
        topic,
        privacy_scope: TopicPrivacyScope.RestrictedShared,
        response_thread_policy: "origin_thread",
        follow_up_thread_policy: "same_or_narrowest_allowed",
        awareness_policy: "none",
        allowed_thread_ids: uniqueStrings(["couple", ...allowedShared]),
        denied_thread_ids: uniqueStrings(["family", ...denied]),
        digest_policy: "same_target",
        confirmation_policy: "exact_thread",
        notification_quota: defaultNotificationQuota(topic),
        quiet_hours: DEFAULT_QUIET_HOURS,
      };
    case TopicKey.Finances:
      return {
        topic,
        privacy_scope: TopicPrivacyScope.RestrictedShared,
        response_thread_policy: "origin_thread",
        follow_up_thread_policy: "same_or_narrowest_allowed",
        awareness_policy: "none",
        allowed_thread_ids: uniqueStrings(["couple", ...allowedShared]),
        denied_thread_ids: uniqueStrings(["family", "participant_3_private", ...denied]),
        digest_policy: "same_target",
        confirmation_policy: "exact_thread",
        quiet_hours: DEFAULT_QUIET_HOURS,
      };
    case TopicKey.Pets: {
      const routing = routingRecord(topic);
      const sharedAwareness =
        typeof routing.shared_awareness === "string" && routing.shared_awareness.length > 0;
      return {
        topic,
        privacy_scope: TopicPrivacyScope.RestrictedShared,
        response_thread_policy: "origin_thread",
        follow_up_thread_policy: "same_or_narrowest_allowed",
        awareness_policy: sharedAwareness ? "summary" : "none",
        allowed_thread_ids: uniqueStrings(allowedShared),
        denied_thread_ids: denied,
        digest_policy: "private_if_available",
        confirmation_policy: "exact_thread",
        notification_quota: defaultNotificationQuota(topic),
      };
    }
    case TopicKey.Grocery:
    case TopicKey.Calendar:
    case TopicKey.Chores:
    case TopicKey.School:
    case TopicKey.Travel:
    case TopicKey.Vendors:
    case TopicKey.Business:
    case TopicKey.FamilyStatus:
    case TopicKey.Meals:
    case TopicKey.Maintenance:
      return {
        topic,
        privacy_scope: TopicPrivacyScope.Shared,
        response_thread_policy: "origin_thread",
        follow_up_thread_policy: "same_or_narrowest_allowed",
        awareness_policy: "summary",
        allowed_thread_ids: uniqueStrings(allowedShared),
        denied_thread_ids: denied,
        digest_policy: topic === TopicKey.Business ? "private_if_available" : "same_target",
        confirmation_policy:
          topic === TopicKey.Business ? "requester_private_allowed" : "exact_thread",
        notification_quota: defaultNotificationQuota(topic),
        quiet_hours:
          topic === TopicKey.Grocery || topic === TopicKey.Meals ? DEFAULT_QUIET_HOURS : undefined,
      };
    default:
      return {
        topic,
        privacy_scope: TopicPrivacyScope.Shared,
        response_thread_policy: "origin_thread",
        follow_up_thread_policy: "same_or_narrowest_allowed",
        awareness_policy: "none",
        allowed_thread_ids: [],
        denied_thread_ids: denied,
        digest_policy: "same_target",
        confirmation_policy: "exact_thread",
      };
  }
}

export function isThreadAllowedForTopicDelivery(input: TopicThreadPolicyCheck): boolean {
  const thread = threadById(input.thread_id);
  if (!thread) {
    return false;
  }

  const policy = getTopicDeliveryPolicy(input.topic);
  if (policy.denied_thread_ids.includes(thread.id)) {
    return false;
  }

  if (thread.type === ThreadType.Private) {
    if (!allowsPrivateThread(input.topic, input.delivery_kind)) {
      return false;
    }
    if (policy.privacy_scope === TopicPrivacyScope.Private) {
      return privateThreadMatchesAudience(thread, input.concerning, input.requested_by);
    }
    return true;
  }

  if (policy.privacy_scope === TopicPrivacyScope.Private) {
    return false;
  }
  if (input.delivery_kind === "awareness" && policy.awareness_policy === "none") {
    return false;
  }
  if (policy.allowed_thread_ids.length > 0 && !policy.allowed_thread_ids.includes(thread.id)) {
    return false;
  }
  return sharedThreadMatchesAudience(thread, input.concerning);
}

export function resolveRequesterPrivateThread(requestedBy: string): string | null {
  const expected = `${requestedBy}_private`;
  return isPrivateThreadId(expected) ? expected : null;
}

export function getDefaultQuietHours(): QuietHoursWindow {
  return DEFAULT_QUIET_HOURS;
}
