export enum DispatchPriority {
  Immediate = "immediate",
  Batched = "batched",
  Silent = "silent",
}

export interface PriorityLevel {
  description: string;
  examples: string[];
}

export interface OutboundBudget {
  max_unprompted_per_person_per_day: number;
  max_messages_per_thread_per_hour: number;
  batch_window_minutes: number;
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

export interface DispatchConfig {
  priority_levels: Record<DispatchPriority, PriorityLevel>;
  outbound_budget: OutboundBudget;
  routing_rules: Record<string, string>;
  collision_avoidance: CollisionPolicy;
}
