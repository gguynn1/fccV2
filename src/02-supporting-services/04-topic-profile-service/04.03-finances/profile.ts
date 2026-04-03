import { EscalationLevel } from "../../../types.js";
import type { TopicProfile } from "../types.js";
import type { FinanceAction } from "./types.js";

export const FINANCES_TOPIC_PROFILE: TopicProfile = {
  tone: "calm and factual",
  format: "numbered snapshots with due dates",
  initiative_style: "deadline-driven alerts and milestone updates",
  escalation_level: EscalationLevel.High,
  framework_grounding: null,
  response_format: "concise financial snapshots",
  cross_topic_connections: [],
};

export const FINANCES_ALLOWED_THREADS = ["couple"] as const;

export function isFinanceThreadAllowed(thread_id: string): boolean {
  return FINANCES_ALLOWED_THREADS.includes(thread_id as (typeof FINANCES_ALLOWED_THREADS)[number]);
}

export function requiresFinanceConfirmation(action: FinanceAction): boolean {
  return action.type !== "query_finances";
}
