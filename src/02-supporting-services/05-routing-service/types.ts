import type { ClarificationReason, ClassifierIntent, TopicKey } from "../../types.js";

export enum ThreadType {
  Private = "private",
  Shared = "shared",
}

export interface Thread {
  id: string;
  type: ThreadType;
  participants: string[];
  description: string;
  conversation_sid?: string;
}

export interface ThreadMessage {
  id: string;
  from: string;
  content: string;
  at: Date;
  topic_context: string;
  dispatch_ref?: string;
  state_ref?: string;
  confirmation_ref?: string;
  escalation_ref?: string;
}

export interface PendingClarificationSession {
  original_queue_item_id: string;
  topic: TopicKey;
  intent: ClassifierIntent;
  reason: ClarificationReason;
  message_to_participant: string;
  requested_at: Date;
  source_thread: string;
  source_entity_id: string;
  source_concerning: string[];
  source_message: string;
  context: Record<string, unknown>;
}

export interface ContextTransitionPolicy {
  switch_on_new_topic: boolean;
  idle_reset_minutes: number;
  explicit_switch_signals: string[];
}

export interface ThreadHistory {
  active_topic_context: string;
  last_activity: Date;
  recent_messages: ThreadMessage[];
  pending_clarification?: PendingClarificationSession | null;
}

export interface RoutingDecisionInput {
  topic: TopicKey;
  intent: ClassifierIntent;
  concerning: string[];
  origin_thread: string;
  is_response: boolean;
}

export enum RoutingRule {
  ResponseInPlace = "response_in_place",
  ProactiveNarrowest = "proactive_narrowest",
}

export interface ThreadTarget {
  thread_id: string;
  rule_applied: RoutingRule;
  reason: string;
}

export interface RoutingDecision {
  target: ThreadTarget;
  follow_up_target?: ThreadTarget;
  reply_policy?: {
    action: "reply_here" | "notify_there" | "suppress_duplicate" | "defer_to_digest";
    dedupe_key?: string;
    cooldown_seconds?: number;
    reason: string;
  };
}
