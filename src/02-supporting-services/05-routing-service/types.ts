import type { ClassifierIntent, TopicKey } from "../../types.js";

export enum ThreadType {
  Private = "private",
  Shared = "shared",
}

export interface Thread {
  id: string;
  type: ThreadType;
  participants: string[];
  description: string;
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

export interface ContextTransitionPolicy {
  switch_on_new_topic: boolean;
  idle_reset_minutes: number;
  explicit_switch_signals: string[];
}

export interface ThreadHistory {
  active_topic_context: string;
  last_activity: Date;
  recent_messages: ThreadMessage[];
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
