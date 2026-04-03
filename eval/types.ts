import type { ClassifierIntent, DispatchPriority, TopicKey } from "../src/index.js";

export type EvalScenarioCategory =
  | "classification"
  | "routing"
  | "composition"
  | "confirmation"
  | "pipeline";

export type EvalScenarioStatus =
  | "queued"
  | "running"
  | "passed"
  | "fixed"
  | "deferred"
  | "failed"
  | "regressed";

export type EvalRunStatus = "queued" | "running" | "completed" | "failed";

export type EvalLogLevel = "info" | "warn" | "error";

export interface EvalScenarioPromptInput {
  message: string;
  concerning: string[];
  origin_thread: string;
}

export interface EvalScenarioExpectation {
  topic: TopicKey;
  intent: ClassifierIntent;
  target_thread: string;
  priority: DispatchPriority;
  confirmation_required: boolean;
  tone_markers?: string[];
  format_markers?: string[];
  must_not?: string[];
}

export interface EvalScenarioSimulation {
  actual_overrides?: Partial<EvalScenarioActual>;
  tuning_scope?: "prompt" | "structural";
}

export interface EvalScenarioDefinition {
  id: string;
  title: string;
  category: EvalScenarioCategory;
  prompt_input: EvalScenarioPromptInput;
  expected: EvalScenarioExpectation;
  notes?: string;
  simulation?: EvalScenarioSimulation;
}

export interface EvalScenarioActual {
  topic: TopicKey;
  intent: ClassifierIntent;
  target_thread: string;
  priority: DispatchPriority;
  confirmation_required: boolean;
  composed_message: string;
}

export interface EvalScenarioFailure {
  field:
    | keyof Omit<EvalScenarioActual, "composed_message">
    | "tone_markers"
    | "format_markers"
    | "must_not";
  expected: string | boolean | string[];
  actual: string | boolean | string[] | null;
  prompt_fixable: boolean;
  message: string;
}

export interface EvalScenarioLogEvent {
  seq: number;
  timestamp: string;
  level: EvalLogLevel;
  phase: string;
  scenario_id?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface EvalCandidateSummary {
  path: string;
  title: string;
  summary: string;
}

export interface EvalTunerOutcome {
  status: Extract<EvalScenarioStatus, "fixed" | "deferred" | "failed">;
  summary: string;
  failing_dimensions: string[];
  candidate?: EvalCandidateSummary;
}

export interface EvalScenarioResult {
  id: string;
  title: string;
  category: EvalScenarioCategory;
  status: EvalScenarioStatus;
  raw_outcome: "pass" | "fail";
  started_at: string | null;
  completed_at: string | null;
  expected: EvalScenarioExpectation;
  actual: EvalScenarioActual | null;
  failures: EvalScenarioFailure[];
  tuner: EvalTunerOutcome | null;
}

export interface EvalRunSummary {
  total: number;
  queued: number;
  running: number;
  passed: number;
  fixed: number;
  deferred: number;
  failed: number;
  regressed: number;
}

export interface EvalArtifactSet {
  json_path: string;
  markdown_path: string | null;
}

export interface EvalRunState {
  id: string;
  scenario_set: string;
  status: EvalRunStatus;
  started_at: string;
  completed_at: string | null;
  summary: EvalRunSummary;
  scenarios: EvalScenarioResult[];
  logs: EvalScenarioLogEvent[];
  artifacts: EvalArtifactSet;
}
