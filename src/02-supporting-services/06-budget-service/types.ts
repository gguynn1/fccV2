import type { TopicKey } from "../../types.js";

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
