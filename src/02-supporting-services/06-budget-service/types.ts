import type { TopicKey } from "../../types.js";
import type { DispatchPriority } from "../../01-service-stack/06-action-router/types.js";

export type BudgetTopicKey = TopicKey | "digest";

export interface BudgetMessage {
  id: string;
  topic: BudgetTopicKey;
  at: Date;
  included_in?: string;
}

export interface PersonBudget {
  unprompted_sent: number;
  max: number;
  messages: BudgetMessage[];
}

export interface ThreadBudget {
  last_hour_count: number;
  max_per_hour: number;
  last_sent_at: Date | null;
}

export interface OutboundBudgetTracker {
  date: Date;
  by_person: Record<string, PersonBudget>;
  by_thread: Record<string, ThreadBudget>;
}

export interface BudgetCounterSnapshot {
  person_daily_count: number;
  thread_hourly_count: number;
}

export interface BudgetCollisionCheck {
  pending_item_ids: string[];
  recently_dispatched_ids: string[];
}

export interface BudgetDecisionTyped {
  priority: DispatchPriority;
  reason: string;
  hold_until?: Date;
  included_queue_item_ids?: string[];
}
