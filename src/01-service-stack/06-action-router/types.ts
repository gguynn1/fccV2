import { DispatchPriority } from "../../types.js";

export { DispatchPriority };

export interface DispatchResult {
  decision: "dispatch";
  outbound: {
    target_thread: string;
    content: string;
    priority: DispatchPriority;
    concerning: string[];
  };
}

export interface HoldResult {
  decision: "hold";
  queue_item: {
    id?: string;
    target_thread: string;
    concerning: string[];
    created_at: Date;
  };
  hold_until: Date;
  reason: string;
}

export interface StoreResult {
  decision: "store";
  queue_item: {
    id?: string;
    target_thread: string;
    concerning: string[];
    created_at: Date;
  };
  reason: string;
}

export interface PriorityLevel {
  description: string;
  examples: string[];
}

export interface OutboundBudget {
  max_unprompted_per_person_per_day: number;
  max_messages_per_thread_per_hour: number;
  batch_window_minutes: number;
  quiet_hours?: {
    start: string;
    end: string;
  };
  description: string;
}

export enum CollisionPrecedence {
  SafetyAndHealth = "safety_and_health",
  TimeSensitiveDeadline = "time_sensitive_deadline",
  ActiveConversation = "active_conversation",
  ScheduledReminder = "scheduled_reminder",
  ProactiveOutbound = "proactive_outbound",
}

export interface CollisionPolicy {
  description: string;
  precedence_order: CollisionPrecedence[];
  same_precedence_strategy: string;
}

export interface RoutingRules {
  rule_1: string;
  rule_2: string;
}

export interface DispatchConfig {
  priority_levels: Record<DispatchPriority, PriorityLevel>;
  outbound_budget: OutboundBudget;
  routing_rules: RoutingRules;
  collision_avoidance: CollisionPolicy;
}
