export type EntityType = "adult" | "child" | "pet";

export type Permission =
  | "approve_financial"
  | "approve_sends"
  | "modify_system"
  | "assign_tasks"
  | "view_all_topics"
  | "complete_tasks"
  | "add_items"
  | "ask_questions";

export type EscalationLevel = "high" | "medium" | "low" | "none";

export type TopicKey =
  | "calendar"
  | "chores"
  | "finances"
  | "grocery"
  | "health"
  | "pets"
  | "school"
  | "travel"
  | "vendors"
  | "photography"
  | "relationship"
  | "family_status";

export interface PetProfile {
  species: string;
  breed: string | null;
  vet: string | null;
  medications: string[];
  care_schedule: string[];
}

export interface DigestSchedule {
  morning: string;
  evening: string | null;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  messaging_identity: string | null;
  permissions: Permission[];
  digest?: DigestSchedule;
  profile?: PetProfile;
  routes_to?: string[];
}

export interface Thread {
  id: string;
  type: "private" | "shared";
  participants: string[];
  description: string;
}

export interface TopicRouting {
  [key: string]: string | boolean | string[];
}

export interface TopicBehavior {
  [key: string]: string;
}

export interface TopicConfig {
  label: string;
  description: string;
  routing: TopicRouting;
  behavior: TopicBehavior;
  escalation: EscalationLevel;
  proactive?: Record<string, string | boolean>;
  escalation_ladder?: Record<string, string | boolean | null>;
  confirmation_required?: boolean;
  sections?: string[];
  cross_topic_connections?: TopicKey[];
  confirmation_required_for_sends?: boolean;
  follow_up_quiet_period?: string;
  on_ignored?: string;
  minimum_gap_between_nudges?: string;
  status_expiry?: string;
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

export interface DispatchConfig {
  priority_levels: {
    immediate: PriorityLevel;
    batched: PriorityLevel;
    silent: PriorityLevel;
  };
  outbound_budget: OutboundBudget;
  routing_rules: Record<string, string>;
  collision_avoidance: { description: string };
}

export interface ConfirmationGates {
  always_require_approval: string[];
  expiry_minutes: number;
  on_expiry: string;
}

export interface InputRecognition {
  text: { description: string };
  structured_choice: { description: string; formats: string[] };
  reaction: { positive: string; negative: string };
  image: { description: string; examples: Record<string, string> };
  forwarded_content: { description: string };
  silence: {
    high_accountability: string;
    low_accountability: string;
    never: string;
  };
}

export interface DataIngestSourceConfig {
  inboxes?: string[];
  calendars?: string[];
  poll_interval_minutes?: number;
  sync_interval_minutes?: number;
}

export interface DataIngestSource {
  id: string;
  type: string;
  description: string;
  active: boolean;
  config?: DataIngestSourceConfig;
}

export interface DataIngestConfig {
  sources: DataIngestSource[];
  future: string[];
}

export interface DigestScheduleBlock {
  description: string;
  times: Record<string, string | null>;
}

export interface DailyRhythm {
  morning_digest: DigestScheduleBlock;
  evening_checkin: DigestScheduleBlock;
  default_state: string;
}

export interface WorkerStep {
  step: number;
  action: string;
  service?: string;
  description: string;
}

export interface WorkerConfig {
  processing_sequence: WorkerStep[];
}

export interface EscalationProfile {
  label: string;
  applies_to: TopicKey[];
  steps: string[];
}

export interface EscalationProfiles {
  high: EscalationProfile;
  medium: EscalationProfile;
  low: EscalationProfile;
  none: EscalationProfile;
}

export interface ScenarioTesting {
  description: string;
  parts: string[];
}

export interface SystemConfig {
  system: {
    timezone: string;
    locale: string;
    version: string;
  };
  assistant: {
    messaging_identity: string;
    name: string | null;
    description: string;
  };
  entities: Entity[];
  threads: Thread[];
  topics: Record<TopicKey, TopicConfig>;
  dispatch: DispatchConfig;
  confirmation_gates: ConfirmationGates;
  input_recognition: InputRecognition;
  data_ingest: DataIngestConfig;
  daily_rhythm: DailyRhythm;
  worker: WorkerConfig;
  escalation_profiles: EscalationProfiles;
  scenario_testing: ScenarioTesting;
}
