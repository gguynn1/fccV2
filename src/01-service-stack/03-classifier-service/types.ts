import { z } from "zod";

import type { ClassifierIntent, EscalationLevel, GrocerySection, TopicKey } from "../../types.js";

export interface ClassificationResult {
  topic: TopicKey;
  intent: ClassifierIntent;
  entities: string[];
  confidence?: number;
}

export interface ClassifierContextMessage {
  from: string;
  content: string;
  at: Date;
  topic_context?: string;
}

export interface ClassifierInput {
  content: string;
  thread_id: string;
  concerning: string[];
  recent_messages: ClassifierContextMessage[];
}

export interface TopicRouting {
  [key: string]: string | boolean | string[];
}

export interface TopicBehavior {
  [key: string]: string;
}

export interface BaseTopicConfig<
  TTopicRouting extends TopicRouting = TopicRouting,
  TTopicBehavior extends TopicBehavior = TopicBehavior,
> {
  label: string;
  description: string;
  routing: TTopicRouting;
  behavior: TTopicBehavior;
  escalation: EscalationLevel;
}

export interface CalendarTopicRouting extends TopicRouting {
  personal_appointment: string;
  couple_event: string;
  family_event: string;
}

export interface CalendarTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
}

export interface CalendarTopicProactive {
  reminder_before: string;
  follow_up_after: string;
  conflict_detection: boolean;
}

export interface CalendarTopicConfig extends BaseTopicConfig<
  CalendarTopicRouting,
  CalendarTopicBehavior
> {
  proactive: CalendarTopicProactive;
  cross_topic_connections: TopicKey[];
}

export interface ChoresTopicRouting extends TopicRouting {
  assigned_task: string;
  escalation: string;
  assignment_announcement: string;
}

export interface ChoresTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
}

export interface ChoresTopicEscalationLadder {
  first_reminder: string;
  follow_up: string;
  escalate_to_broader_thread: string;
  flag_in_digest: boolean;
}

export interface ChoresTopicConfig extends BaseTopicConfig<
  ChoresTopicRouting,
  ChoresTopicBehavior
> {
  escalation_ladder: ChoresTopicEscalationLadder;
}

export interface FinancesTopicRouting extends TopicRouting {
  default: string;
  never: string[];
}

export interface FinancesTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
}

export interface FinancesTopicEscalationLadder {
  first_reminder: string;
  follow_up: string;
  escalate_to_broader_thread: null;
  flag_in_digest: boolean;
}

export interface FinancesTopicConfig extends BaseTopicConfig<
  FinancesTopicRouting,
  FinancesTopicBehavior
> {
  escalation_ladder: FinancesTopicEscalationLadder;
  confirmation_required: boolean;
}

export interface GroceryTopicRouting extends TopicRouting {
  default: string;
  response: string;
}

export interface GroceryTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
}

export interface GroceryTopicConfig extends BaseTopicConfig<
  GroceryTopicRouting,
  GroceryTopicBehavior
> {
  sections: GrocerySection[];
  cross_topic_connections: TopicKey[];
}

export interface HealthTopicRouting extends TopicRouting {
  default: string;
  never_share_across_people: boolean;
}

export interface HealthTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
}

export interface HealthTopicProactive {
  appointment_reminder: string;
  post_visit_follow_up: string;
  medication_reminder: string;
  routine_checkup_flag: string;
}

export interface HealthTopicConfig extends BaseTopicConfig<
  HealthTopicRouting,
  HealthTopicBehavior
> {
  proactive: HealthTopicProactive;
  cross_topic_connections: TopicKey[];
}

export interface PetsTopicRouting extends TopicRouting {
  default: string;
  shared_awareness: string;
}

export interface PetsTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
}

export interface PetsTopicConfig extends BaseTopicConfig<PetsTopicRouting, PetsTopicBehavior> {
  cross_topic_connections: TopicKey[];
}

export interface SchoolTopicRouting extends TopicRouting {
  student_tasks: string;
  parent_awareness: string;
  escalation: string;
}

export interface SchoolTopicBehavior extends TopicBehavior {
  tone_to_student: string;
  tone_to_parent: string;
  format: string;
  initiative: string;
}

export interface SchoolTopicEscalationLadder {
  first_reminder: string;
  follow_up: string;
  escalate_to_parent: string;
  flag_in_digest: boolean;
}

export interface SchoolTopicConfig extends BaseTopicConfig<
  SchoolTopicRouting,
  SchoolTopicBehavior
> {
  escalation_ladder: SchoolTopicEscalationLadder;
  cross_topic_connections: TopicKey[];
}

export interface TravelTopicRouting extends TopicRouting {
  family_trip: string;
  couple_trip: string;
  individual_trip: string;
}

export interface TravelTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
}

export interface TravelTopicConfig extends BaseTopicConfig<
  TravelTopicRouting,
  TravelTopicBehavior
> {
  cross_topic_connections: TopicKey[];
}

export interface VendorsTopicRouting extends TopicRouting {
  default: string;
}

export interface VendorsTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
}

export interface VendorsTopicConfig extends BaseTopicConfig<
  VendorsTopicRouting,
  VendorsTopicBehavior
> {
  cross_topic_connections: TopicKey[];
}

export interface BusinessTopicRouting extends TopicRouting {
  default: string;
}

export interface BusinessTopicBehavior extends TopicBehavior {
  tone_internal: string;
  tone_client_drafts: string;
  format: string;
  initiative: string;
}

export interface BusinessTopicConfig extends BaseTopicConfig<
  BusinessTopicRouting,
  BusinessTopicBehavior
> {
  confirmation_required_for_sends: boolean;
  cross_topic_connections: TopicKey[];
}

export interface RelationshipTopicRouting extends TopicRouting {
  default: string;
  never: string[];
}

export interface RelationshipTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
  framework: string;
}

export interface RelationshipTopicConfig extends BaseTopicConfig<
  RelationshipTopicRouting,
  RelationshipTopicBehavior
> {
  on_ignored: string;
  minimum_gap_between_nudges: string;
}

export interface FamilyStatusTopicRouting extends TopicRouting {
  personal_eta: string;
  general_update: string;
  readback: string;
}

export interface FamilyStatusTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
}

export interface FamilyStatusTopicConfig extends BaseTopicConfig<
  FamilyStatusTopicRouting,
  FamilyStatusTopicBehavior
> {
  status_expiry: string;
}

export interface MealsTopicRouting extends TopicRouting {
  meal_planning: string;
  dietary_note: string;
  readback: string;
}

export interface MealsTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
}

export interface MealsTopicConfig extends BaseTopicConfig<MealsTopicRouting, MealsTopicBehavior> {
  grocery_linking: boolean;
  cross_topic_connections: TopicKey[];
}

export interface MaintenanceTopicRouting extends TopicRouting {
  individual_item: string;
  household_item: string;
  readback: string;
}

export interface MaintenanceTopicBehavior extends TopicBehavior {
  tone: string;
  format: string;
  initiative: string;
}

export interface MaintenanceTopicConfig extends BaseTopicConfig<
  MaintenanceTopicRouting,
  MaintenanceTopicBehavior
> {
  cross_topic_connections: TopicKey[];
}

export interface TopicConfigMap {
  [TopicKey.Calendar]: CalendarTopicConfig;
  [TopicKey.Chores]: ChoresTopicConfig;
  [TopicKey.Finances]: FinancesTopicConfig;
  [TopicKey.Grocery]: GroceryTopicConfig;
  [TopicKey.Health]: HealthTopicConfig;
  [TopicKey.Pets]: PetsTopicConfig;
  [TopicKey.School]: SchoolTopicConfig;
  [TopicKey.Travel]: TravelTopicConfig;
  [TopicKey.Vendors]: VendorsTopicConfig;
  [TopicKey.Business]: BusinessTopicConfig;
  [TopicKey.Relationship]: RelationshipTopicConfig;
  [TopicKey.FamilyStatus]: FamilyStatusTopicConfig;
  [TopicKey.Meals]: MealsTopicConfig;
  [TopicKey.Maintenance]: MaintenanceTopicConfig;
}

export type TopicConfig = TopicConfigMap[TopicKey];

export const classificationResultSchema = z.object({
  topic: z.string().min(1),
  intent: z.string().min(1),
  entities: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export const topicScopedContentSchema = z.object({
  scoped_content: z.string().trim().min(1),
  mixed_intent: z.boolean().optional(),
});

export const topicMessageSchema = z.object({
  composed_message: z.string().trim().min(1),
});

export interface ClassifierServiceOptions {
  anthropic_api_key: string;
  model?: string;
  context_window_limit?: number;
}
