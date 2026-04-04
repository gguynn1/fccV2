import type { ClarificationReason } from "../../types.js";

export enum WorkerAction {
  ClassifyTopic = "classify_topic",
  IdentifyEntities = "identify_entities",
  DetermineActionType = "determine_action_type",
  CheckOutboundBudget = "check_outbound_budget",
  CheckEscalation = "check_escalation",
  CheckConfirmation = "check_confirmation",
  ApplyBehaviorProfile = "apply_behavior_profile",
  RouteAndDispatch = "route_and_dispatch",
}

export enum WorkerService {
  Classifier = "classifier",
  Identity = "identity",
  Budget = "budget",
  Escalation = "escalation",
  Confirmation = "confirmation",
  TopicProfile = "topic_profile",
  Routing = "routing",
}

export interface WorkerConfig {
  max_thread_history_messages?: number;
  stale_after_hours?: number;
  urgent_relevance_minutes?: number;
  clarification_timeout_minutes?: number;
  ai_action_interpreter_enabled?: boolean;
  ai_action_interpreter_topic_allowlist?: string[];
}

export interface ClarificationRequest {
  reason: ClarificationReason;
  message_to_participant: string;
  options?: string[];
  original_queue_item_id: string;
  context: Record<string, unknown>;
}

export interface ProcessingTraceStep {
  step: number;
  action: WorkerAction;
  service?: WorkerService;
  input_summary: string;
  output_summary: string;
  duration_ms: number;
  metadata?: Record<string, unknown>;
}

export type ProcessingOutcome =
  | "dispatched"
  | "held"
  | "stored"
  | "clarification_requested"
  | "dropped_stale";

export interface ProcessingTrace {
  queue_item_id: string;
  started_at: Date;
  completed_at: Date;
  outcome: ProcessingOutcome;
  steps: ProcessingTraceStep[];
  classification_source?: "worker" | "preclassified_email" | "preclassified_scheduled";
}
