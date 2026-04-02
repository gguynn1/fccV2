export {
  TopicKey,
  EscalationLevel,
  DispatchPriority,
  GrocerySection,
  ConfirmationActionType,
} from "./system-config-types.js";

import type {
  TopicKey,
  EscalationLevel,
  DispatchPriority,
  GrocerySection,
  ConfirmationActionType,
} from "./system-config-types.js";

export enum QueueItemType {
  Outbound = "outbound",
  Inbound = "inbound",
}

export enum QueueItemSource {
  ScheduledTrigger = "scheduled_trigger",
  EmailMonitor = "email_monitor",
}

export enum QueuePendingStatus {
  PendingClassification = "pending_classification",
}

export enum CalendarEventStatus {
  Completed = "completed",
  Upcoming = "upcoming",
  Planning = "planning",
}

export enum ChoreStatus {
  Overdue = "overdue",
  Pending = "pending",
}

export enum ChoreEventType {
  Assigned = "assigned",
  ReminderSent = "reminder_sent",
  DeadlinePassed = "deadline_passed",
  FollowUpSent = "follow_up_sent",
}

export enum BillStatus {
  Upcoming = "upcoming",
}

export enum RecurringInterval {
  Monthly = "monthly",
}

export enum InputMethod {
  Text = "text",
  Image = "image",
}

export enum PaceStatus {
  OnTrack = "on_track",
  Steady = "steady",
}

export enum AssignmentStatus {
  NotStarted = "not_started",
  InProgress = "in_progress",
}

export enum ChecklistItemStatus {
  Done = "done",
  NotStarted = "not_started",
}

export enum TripStatus {
  Planning = "planning",
}

export enum VendorJobStatus {
  Completed = "completed",
  WaitingForQuote = "waiting_for_quote",
}

export enum PhotoLeadStatus {
  AwaitingReply = "awaiting_reply",
  New = "new",
}

export enum NudgeType {
  AppreciationPrompt = "appreciation_prompt",
  DateNightSuggestion = "date_night_suggestion",
  ConversationStarter = "conversation_starter",
}

export enum ConfirmationResult {
  Expired = "expired",
  NotYetApproved = "not_yet_approved",
}

export enum EscalationStepAction {
  ReminderSent = "reminder_sent",
  FollowUpSent = "follow_up_sent",
  EscalateToBroaderThread = "escalate_to_broader_thread",
}

export enum HealthProviderType {
  Dentist = "dentist",
  Primary = "primary",
}

export interface InboundEmailContent {
  from: string;
  subject: string;
  extracted: Record<string, string>;
}

export interface PendingQueueItem {
  id: string;
  source: QueueItemSource;
  type: QueueItemType;
  topic: TopicKey;
  concerning: string[];
  content: string | InboundEmailContent;
  priority?: DispatchPriority;
  target_thread?: string;
  created_at: Date;
  hold_until?: Date;
  status?: QueuePendingStatus;
}

export interface DispatchedQueueItem {
  id: string;
  topic: TopicKey;
  target_thread: string;
  content: string;
  dispatched_at: Date;
  priority: DispatchPriority;
  included_in?: string;
  response_received?: boolean;
  escalation_step?: number;
}

export interface QueueState {
  pending: PendingQueueItem[];
  recently_dispatched: DispatchedQueueItem[];
}

export interface BudgetMessage {
  id: string;
  topic: string;
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

export interface EscalationHistoryEntry {
  step: number;
  action: EscalationStepAction;
  thread: string;
  at: Date;
}

export interface ActiveEscalation {
  id: string;
  topic: TopicKey;
  item_ref: string;
  profile: EscalationLevel;
  concerning: string[];
  current_step: number;
  history: EscalationHistoryEntry[];
  next_action: EscalationStepAction;
  next_action_at: Date;
  target_thread_for_escalation: string;
}

export interface EscalationStatus {
  active: ActiveEscalation[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date?: Date;
  date_start?: Date;
  date_end?: Date;
  time?: string | null;
  location?: string | null;
  concerning: string[];
  topic: TopicKey;
  status: CalendarEventStatus;
  follow_up_due?: Date;
  follow_up_sent?: boolean;
  responsible?: string;
  created_by: string;
  created_in_thread?: string;
  created_at: Date;
}

export interface CalendarState {
  events: CalendarEvent[];
}

export interface ChoreHistoryEntry {
  event: ChoreEventType;
  at: Date;
  thread?: string;
}

export interface ActiveChore {
  id: string;
  task: string;
  assigned_to: string;
  assigned_by: string;
  assigned_in_thread: string;
  due: Date;
  status: ChoreStatus;
  escalation_step: number;
  history?: ChoreHistoryEntry[];
}

export interface CompletedChore {
  id: string;
  task: string;
  assigned_to: string;
  completed_at: Date;
  completed_via: InputMethod;
  response: string;
}

export interface ChoresState {
  active: ActiveChore[];
  completed_recent: CompletedChore[];
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  due_date: Date;
  status: BillStatus;
  reminder_sent: boolean;
  reminder_sent_at?: Date;
  recurring: RecurringInterval;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: Date;
  logged_by: string;
  logged_via: InputMethod;
  confirmed: boolean;
}

export interface SavingsContribution {
  amount: number;
  date: Date;
  logged_by: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  percent: number;
  deadline: Date | null;
  last_contribution?: SavingsContribution;
  pace_status: PaceStatus;
}

export interface FinancesState {
  bills: Bill[];
  expenses_recent: Expense[];
  savings_goals: SavingsGoal[];
}

export interface GroceryItem {
  id: string;
  item: string;
  section: GrocerySection;
  added_by: string;
  added_at: Date;
}

export interface PurchasedItem {
  item: string;
  purchased_by: string;
  purchased_at: Date;
}

export interface GroceryState {
  list: GroceryItem[];
  recently_purchased: PurchasedItem[];
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  reminder: boolean;
}

export interface HealthProvider {
  type: HealthProviderType;
  name: string;
  location: string;
  last_visit: Date;
}

export interface HealthProfile {
  entity: string;
  medications: Medication[];
  allergies: string[];
  providers: HealthProvider[];
  upcoming_appointments: string[];
  notes: string[];
}

export interface HealthState {
  profiles: HealthProfile[];
}

export interface CareLogEntry {
  activity: string;
  by: string;
  at: Date;
}

export interface PetStateProfile {
  entity: string;
  species: string;
  vet: string | null;
  last_vet_visit: Date;
  medications: string[];
  care_log_recent: CareLogEntry[];
  upcoming: string[];
  notes: string[];
}

export interface PetsState {
  profiles: PetStateProfile[];
}

export interface Assignment {
  id: string;
  title: string;
  due_date: Date;
  status: AssignmentStatus;
  source: string;
  parent_notified: boolean;
}

export interface CompletedAssignment {
  title: string;
  completed_at: Date;
  completed_via: InputMethod;
}

export interface StudentRecord {
  entity: string;
  assignments: Assignment[];
  completed_recent: CompletedAssignment[];
}

export interface SchoolState {
  students: StudentRecord[];
}

export interface ChecklistItem {
  item: string;
  status: ChecklistItemStatus;
  completed_at?: Date;
  topic_link?: string;
}

export interface Trip {
  id: string;
  name: string;
  dates: { start: Date; end: Date };
  travelers: string[];
  status: TripStatus;
  checklist: ChecklistItem[];
  budget_link: string;
  notes: string[];
}

export interface TravelState {
  trips: Trip[];
}

export interface VendorJob {
  description: string;
  date: Date;
  cost: number | null;
  status: VendorJobStatus;
  notes: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  type: string;
  jobs: VendorJob[];
  contact: string;
  managed_by: string;
  follow_up_pending: boolean;
  follow_up_due?: Date;
}

export interface VendorsState {
  records: VendorRecord[];
}

export interface PhotoLead {
  id: string;
  client_name: string;
  inquiry_date: Date;
  event_type: string;
  event_date: Date | null;
  status: PhotoLeadStatus;
  last_contact: Date;
  draft_reply: string | null;
  follow_up_due?: Date;
  draft_approved?: boolean;
  notes: string;
}

export interface PhotographyState {
  leads: PhotoLead[];
}

export interface NudgeHistoryEntry {
  date: Date;
  type: NudgeType;
  responded: boolean;
}

export interface RelationshipState {
  last_nudge: {
    date: Date;
    thread: string;
    content: string;
    response_received: boolean;
  };
  next_nudge_eligible: Date;
  nudge_history: NudgeHistoryEntry[];
}

export interface FamilyStatusEntry {
  entity: string;
  status: string;
  updated_at: Date;
  expires_at: Date;
}

export interface FamilyStatusState {
  current: FamilyStatusEntry[];
}

export interface Confirmation {
  id: string;
  type: ConfirmationActionType;
  action: string;
  requested_by: string;
  requested_in_thread?: string;
  requested_at: Date;
  expires_at?: Date;
  expired_at?: Date;
  status?: string;
  result?: ConfirmationResult;
}

export interface ConfirmationsState {
  pending: Confirmation[];
  recent: Confirmation[];
}

export interface ThreadMessage {
  id: string;
  from: string;
  content: string;
  at: Date;
  topic_context: string;
  dispatch_ref?: string;
  state_ref?: string;
  confirmation_ref?: string;
  escalation_ref?: string;
}

export interface ThreadHistory {
  active_topic_context: string;
  last_activity: Date;
  recent_messages: ThreadMessage[];
}

export interface ProcessedIngestItem {
  source_id: string;
  from?: string;
  subject?: string;
  content_type?: string;
  received_at: Date;
  processed_at: Date;
  queue_item_created?: string;
  topic_classified: string;
  state_ref?: string;
}

export interface IngestSourceState {
  active: boolean;
  last_poll?: Date | null;
  last_poll_result?: string;
  last_sync?: Date | null;
  last_received?: Date;
  processed: ProcessedIngestItem[];
  watermark?: Date | null;
  total_processed?: number;
}

export interface DataIngestState {
  email_monitor: IngestSourceState;
  calendar_sync: IngestSourceState;
  forwarded_messages: IngestSourceState;
}

export interface DigestDelivery {
  delivered_at: Date;
  thread: string;
  included: string[];
}

export interface DigestDay {
  date: Date;
  morning: Record<string, DigestDelivery>;
  evening: Record<string, DigestDelivery> | null;
}

export interface DigestsState {
  history: DigestDay[];
}

export interface SystemState {
  metadata: {
    snapshot_time: Date;
    description: string;
  };
  queue: QueueState;
  outbound_budget_tracker: OutboundBudgetTracker;
  escalation_status: EscalationStatus;
  calendar: CalendarState;
  chores: ChoresState;
  finances: FinancesState;
  grocery: GroceryState;
  health: HealthState;
  pets: PetsState;
  school: SchoolState;
  travel: TravelState;
  vendors: VendorsState;
  photography: PhotographyState;
  relationship: RelationshipState;
  family_status: FamilyStatusState;
  confirmations: ConfirmationsState;
  threads: Record<string, ThreadHistory>;
  data_ingest_state: DataIngestState;
  digests: DigestsState;
}
