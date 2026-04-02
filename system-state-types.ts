export interface InboundEmailContent {
  from: string;
  subject: string;
  extracted: Record<string, string>;
}

export interface PendingQueueItem {
  id: string;
  source: string;
  type: string;
  topic: string;
  concerning: string[];
  content: string | InboundEmailContent;
  priority?: string;
  target_thread?: string;
  created_at: string;
  hold_until?: string;
  status?: string;
}

export interface DispatchedQueueItem {
  id: string;
  topic: string;
  target_thread: string;
  content: string;
  dispatched_at: string;
  priority: string;
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
  at: string;
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
  last_sent_at: string | null;
}

export interface OutboundBudgetTracker {
  date: string;
  by_person: Record<string, PersonBudget>;
  by_thread: Record<string, ThreadBudget>;
}

export interface EscalationHistoryEntry {
  step: number;
  action: string;
  thread: string;
  at: string;
}

export interface ActiveEscalation {
  id: string;
  topic: string;
  item_ref: string;
  profile: string;
  concerning: string[];
  current_step: number;
  history: EscalationHistoryEntry[];
  next_action: string;
  next_action_at: string;
  target_thread_for_escalation: string;
}

export interface EscalationStatus {
  active: ActiveEscalation[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date?: string;
  date_start?: string;
  date_end?: string;
  time?: string | null;
  location?: string | null;
  concerning: string[];
  topic: string;
  status: string;
  follow_up_due?: string;
  follow_up_sent?: boolean;
  responsible?: string;
  created_by: string;
  created_in_thread?: string;
  created_at: string;
}

export interface CalendarState {
  events: CalendarEvent[];
}

export interface ChoreHistoryEntry {
  event: string;
  at: string;
  thread?: string;
}

export interface ActiveChore {
  id: string;
  task: string;
  assigned_to: string;
  assigned_by: string;
  assigned_in_thread: string;
  due: string;
  status: string;
  escalation_step: number;
  history?: ChoreHistoryEntry[];
}

export interface CompletedChore {
  id: string;
  task: string;
  assigned_to: string;
  completed_at: string;
  completed_via: string;
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
  due_date: string;
  status: string;
  reminder_sent: boolean;
  reminder_sent_at?: string;
  recurring: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  logged_by: string;
  logged_via: string;
  confirmed: boolean;
}

export interface SavingsContribution {
  amount: number;
  date: string;
  logged_by: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  percent: number;
  deadline: string | null;
  last_contribution?: SavingsContribution;
  pace_status: string;
}

export interface FinancesState {
  bills: Bill[];
  expenses_recent: Expense[];
  savings_goals: SavingsGoal[];
}

export interface GroceryItem {
  id: string;
  item: string;
  section: string;
  added_by: string;
  added_at: string;
}

export interface PurchasedItem {
  item: string;
  purchased_by: string;
  purchased_at: string;
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
  type: string;
  name: string;
  location: string;
  last_visit: string;
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
  at: string;
}

export interface PetStateProfile {
  entity: string;
  species: string;
  vet: string | null;
  last_vet_visit: string;
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
  due_date: string;
  status: string;
  source: string;
  parent_notified: boolean;
}

export interface CompletedAssignment {
  title: string;
  completed_at: string;
  completed_via: string;
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
  status: string;
  completed_at?: string;
  topic_link?: string;
}

export interface Trip {
  id: string;
  name: string;
  dates: { start: string; end: string };
  travelers: string[];
  status: string;
  checklist: ChecklistItem[];
  budget_link: string;
  notes: string[];
}

export interface TravelState {
  trips: Trip[];
}

export interface VendorJob {
  description: string;
  date: string;
  cost: number | null;
  status: string;
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
  follow_up_due?: string;
}

export interface VendorsState {
  records: VendorRecord[];
}

export interface PhotoLead {
  id: string;
  client_name: string;
  inquiry_date: string;
  event_type: string;
  event_date: string | null;
  status: string;
  last_contact: string;
  draft_reply: string | null;
  follow_up_due?: string;
  draft_approved?: boolean;
  notes: string;
}

export interface PhotographyState {
  leads: PhotoLead[];
}

export interface NudgeHistoryEntry {
  date: string;
  type: string;
  responded: boolean;
}

export interface RelationshipState {
  last_nudge: {
    date: string;
    thread: string;
    content: string;
    response_received: boolean;
  };
  next_nudge_eligible: string;
  nudge_history: NudgeHistoryEntry[];
}

export interface FamilyStatusEntry {
  entity: string;
  status: string;
  updated_at: string;
  expires_at: string;
}

export interface FamilyStatusState {
  current: FamilyStatusEntry[];
}

export interface Confirmation {
  id: string;
  type: string;
  action: string;
  requested_by: string;
  requested_in_thread?: string;
  requested_at: string;
  expires_at?: string;
  expired_at?: string;
  status?: string;
  result?: string;
}

export interface ConfirmationsState {
  pending: Confirmation[];
  recent: Confirmation[];
}

export interface ThreadMessage {
  id: string;
  from: string;
  content: string;
  at: string;
  topic_context: string;
  dispatch_ref?: string;
  state_ref?: string;
  confirmation_ref?: string;
  escalation_ref?: string;
}

export interface ThreadHistory {
  active_topic_context: string;
  last_activity: string;
  recent_messages: ThreadMessage[];
}

export interface ProcessedIngestItem {
  source_id: string;
  from?: string;
  subject?: string;
  content_type?: string;
  received_at: string;
  processed_at: string;
  queue_item_created?: string;
  topic_classified: string;
  state_ref?: string;
}

export interface IngestSourceState {
  active: boolean;
  last_poll?: string | null;
  last_poll_result?: string;
  last_sync?: string | null;
  last_received?: string;
  processed: ProcessedIngestItem[];
  watermark?: string | null;
  total_processed?: number;
}

export interface DataIngestState {
  email_monitor: IngestSourceState;
  calendar_sync: IngestSourceState;
  forwarded_messages: IngestSourceState;
}

export interface DigestDelivery {
  delivered_at: string;
  thread: string;
  included: string[];
}

export interface DigestDay {
  date: string;
  morning: Record<string, DigestDelivery>;
  evening: Record<string, DigestDelivery> | null;
}

export interface DigestsState {
  history: DigestDay[];
}

export interface SystemState {
  metadata: {
    snapshot_time: string;
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
