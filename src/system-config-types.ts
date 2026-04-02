export enum EntityType {
  Adult = "adult",
  Child = "child",
  Pet = "pet",
}

export enum ThreadType {
  Private = "private",
  Shared = "shared",
}

export enum Permission {
  ApproveFinancial = "approve_financial",
  ApproveSends = "approve_sends",
  ModifySystem = "modify_system",
  AssignTasks = "assign_tasks",
  ViewAllTopics = "view_all_topics",
  CompleteTasks = "complete_tasks",
  AddItems = "add_items",
  AskQuestions = "ask_questions",
}

export enum TopicKey {
  Calendar = "calendar",
  Chores = "chores",
  Finances = "finances",
  Grocery = "grocery",
  Health = "health",
  Pets = "pets",
  School = "school",
  Travel = "travel",
  Vendors = "vendors",
  Photography = "photography",
  Relationship = "relationship",
  FamilyStatus = "family_status",
}

export enum EscalationLevel {
  High = "high",
  Medium = "medium",
  Low = "low",
  None = "none",
}

export enum DispatchPriority {
  Immediate = "immediate",
  Batched = "batched",
  Silent = "silent",
}

export enum GrocerySection {
  Produce = "produce",
  Dairy = "dairy",
  Meat = "meat",
  Pantry = "pantry",
  Frozen = "frozen",
  Household = "household",
  Other = "other",
}

export enum ConfirmationActionType {
  SendingOnBehalf = "sending_on_behalf",
  FinancialAction = "financial_action",
  SystemChange = "system_change",
}

export enum DataIngestSourceType {
  Email = "email",
  Calendar = "calendar",
  Forwarded = "forwarded",
}

export enum WorkerAction {
  ClassifyTopic = "classify_topic",
  IdentifyEntities = "identify_entities",
  DetermineActionType = "determine_action_type",
  CheckOutboundBudget = "check_outbound_budget",
  CheckEscalation = "check_escalation",
  ApplyBehaviorProfile = "apply_behavior_profile",
  RouteAndDispatch = "route_and_dispatch",
}

export enum WorkerService {
  Classifier = "classifier",
  Identity = "identity",
  Budget = "budget",
  Escalation = "escalation",
  TopicProfile = "topic_profile",
  Routing = "routing",
}

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
  type: ThreadType;
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
  sections?: GrocerySection[];
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
  priority_levels: Record<DispatchPriority, PriorityLevel>;
  outbound_budget: OutboundBudget;
  routing_rules: Record<string, string>;
  collision_avoidance: { description: string };
}

export interface ConfirmationGates {
  always_require_approval: ConfirmationActionType[];
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
  type: DataIngestSourceType;
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
  action: WorkerAction;
  service?: WorkerService;
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
  escalation_profiles: Record<EscalationLevel, EscalationProfile>;
  scenario_testing: ScenarioTesting;
}
