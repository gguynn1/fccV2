import { pino, type Logger } from "pino";
import { z } from "zod";

import { CalendarEventStatus } from "../../02-supporting-services/04-topic-profile-service/04.01-calendar/types.js";
import { ChoreStatus } from "../../02-supporting-services/04-topic-profile-service/04.02-chores/types.js";
import { HealthProviderType } from "../../02-supporting-services/04-topic-profile-service/04.05-health/types.js";
import { PetCareCategory } from "../../02-supporting-services/04-topic-profile-service/04.06-pets/types.js";
import {
  AssignmentStatus,
  SchoolInputSource,
} from "../../02-supporting-services/04-topic-profile-service/04.07-school/types.js";
import {
  TravelInputSource,
  TripStatus,
} from "../../02-supporting-services/04-topic-profile-service/04.08-travel/types.js";
import {
  BookingStatus,
  BusinessLeadStatus,
  BusinessPipelineStage,
} from "../../02-supporting-services/04-topic-profile-service/04.10-business/types.js";
import {
  computeRelationshipBackoff,
  isRelationshipQuietWindow,
  nextRelationshipNudgeEligibleAt,
  selectNextRelationshipNudgeType,
} from "../../02-supporting-services/04-topic-profile-service/04.11-relationship/profile.js";
import { NudgeType } from "../../02-supporting-services/04-topic-profile-service/04.11-relationship/types.js";
import { extractGroceryItemsFromMealDescription } from "../../02-supporting-services/04-topic-profile-service/04.13-meals/profile.js";
import {
  MealPlanStatus,
  MealType,
} from "../../02-supporting-services/04-topic-profile-service/04.13-meals/types.js";
import {
  MaintenanceAssetType,
  MaintenanceStatus,
} from "../../02-supporting-services/04-topic-profile-service/04.14-maintenance/types.js";
import {
  type TopicAction,
  type TopicProfile,
} from "../../02-supporting-services/04-topic-profile-service/types.js";
import {
  RoutingRule,
  ThreadType,
  type PendingClarificationSession,
  type RoutingDecision,
  type ThreadHistory,
} from "../../02-supporting-services/05-routing-service/types.js";
import {
  ConfirmationActionType,
  ConfirmationResult,
} from "../../02-supporting-services/08-confirmation-service/types.js";
import {
  type BudgetDecision,
  type BudgetService,
  type ConfirmationService,
  type EscalationService,
  type RoutingService,
  type StateService,
  type TopicProfileService,
} from "../../02-supporting-services/types.js";
import { runtimeSystemConfig } from "../../config/runtime-system-config.js";
import {
  getTopicDeliveryPolicy,
  isThreadAllowedForTopicDelivery,
  resolveRequesterPrivateThread,
  type ConfirmationApprovalThreadPolicy,
} from "../../config/topic-delivery-policy.js";
import {
  ClarificationReason,
  ClassifierIntent,
  DispatchPriority,
  EntityType,
  GrocerySection,
  InputMethod,
  QueueItemSource,
  TopicKey,
} from "../../types.js";
import { createIdentityService } from "../02-identity-service/index.js";
import { createActionRouter } from "../06-action-router/index.js";
import {
  SamePrecedenceStrategy,
  type ActionRouterContract,
  type ActionRouterResult,
  type ClassifierServiceContract,
  type CollisionPolicy,
  type DispatchAction,
  type HoldAction,
  type IdentityResolutionResult,
  type StackClassificationResult,
  type StackQueueItem,
  type StoreAction,
  type TransportServiceContract,
  type WorkerDecision,
} from "../types.js";
import {
  WorkerAction,
  WorkerService,
  type ClarificationRequest,
  type ProcessingOutcome,
  type ProcessingTrace,
  type ProcessingTraceStep,
  type WorkerConfig,
} from "./types.js";

const DEFAULT_LOGGER = pino({ name: "worker" });
const DEFAULT_MAX_THREAD_HISTORY_MESSAGES = 15;
const DEFAULT_STALE_AFTER_HOURS = 24;
const DEFAULT_URGENT_RELEVANCE_MINUTES = 120;
const HISTORY_LIMIT = 40;
const NEGATIVE_SIGNAL_PATTERN =
  /\b(?:not now|quiet|pause|leave me alone|too much|enough|mute|maybe later)\b|^(?:later|stop|stop please|please stop)$/iu;
const STRESS_SIGNAL_PATTERN = /\b(?:busy|stressed|stressful|overwhelmed|not a good time)\b/iu;
const CLARIFICATION_PROMPTS = [
  "Which event should I cancel?",
  "What should I move it to?",
  "What date and time should I put on the calendar?",
  "Which chore did you complete?",
  "Which chore should I cancel?",
  "What amount should I log?",
  "What should I add to the list?",
  "When is the appointment?",
  "When is it due?",
  "What dates should I use for the trip?",
  "Who should this be for?",
];

function parseSamePrecedenceStrategy(raw: string | undefined): SamePrecedenceStrategy {
  const normalized = raw?.trim().toLowerCase().replace(/\s+/gu, "_");
  switch (normalized) {
    case SamePrecedenceStrategy.SpaceOut:
      return SamePrecedenceStrategy.SpaceOut;
    case SamePrecedenceStrategy.LatestWins:
      return SamePrecedenceStrategy.LatestWins;
    case SamePrecedenceStrategy.Batch:
    default:
      return SamePrecedenceStrategy.Batch;
  }
}

function isNegativeHumanSignal(content: string): boolean {
  return NEGATIVE_SIGNAL_PATTERN.test(content.trim().toLowerCase());
}

function isRelationshipStressSignal(content: string): boolean {
  return STRESS_SIGNAL_PATTERN.test(content.trim().toLowerCase());
}

function detectAssistantIntrospectionToken(content: string, threadId: string): string | null {
  const normalized = content.trim().toLowerCase();
  if (normalized.includes("what did you see today")) {
    return "__ingest__";
  }
  if (normalized.includes("why did you message me")) {
    return `__dispatch_reason__:${threadId}`;
  }
  if (normalized.includes("what are you holding for later")) {
    return `__held__:${threadId}`;
  }
  return null;
}

function extractCalendarChangeNotification(content: StackQueueItem["content"]): {
  change_type: "created" | "updated" | "removed";
  event_id: string;
  title: string;
  concerning: string[];
  starts_at?: Date;
  ends_at?: Date;
  location?: string;
} | null {
  if (typeof content !== "object" || content === null) {
    return null;
  }
  if (
    !("change_type" in content) ||
    !("event_id" in content) ||
    !("summary" in content) ||
    !("concerning" in content)
  ) {
    return null;
  }
  const changeType = content.change_type;
  const eventId = content.event_id;
  const summary = content.summary;
  const concerning = content.concerning;
  if (
    (changeType !== "created" && changeType !== "updated" && changeType !== "removed") ||
    typeof eventId !== "string" ||
    typeof summary !== "string" ||
    !Array.isArray(concerning)
  ) {
    return null;
  }
  const startsAt =
    typeof content.starts_at === "string" && content.starts_at.length > 0
      ? new Date(content.starts_at)
      : undefined;
  const endsAt =
    typeof content.ends_at === "string" && content.ends_at.length > 0
      ? new Date(content.ends_at)
      : undefined;
  return {
    change_type: changeType,
    event_id: eventId,
    title: summary,
    concerning: concerning.filter((entry): entry is string => typeof entry === "string"),
    starts_at: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : undefined,
    ends_at: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : undefined,
    location:
      typeof content.location === "string" && content.location.length > 0
        ? content.location
        : undefined,
  };
}

const INTERPRETER_RESPONSE_ACTIONS_BY_TOPIC: Record<TopicKey, Set<string>> = {
  [TopicKey.Calendar]: new Set([
    "query_events",
    "cancel_event",
    "reschedule_event",
    "create_event",
  ]),
  [TopicKey.Chores]: new Set(["query_chores", "complete_chore", "cancel_chore", "assign_chore"]),
  [TopicKey.Finances]: new Set(["query_finances", "log_expense"]),
  [TopicKey.Grocery]: new Set(["query_list", "remove_items", "add_items"]),
  [TopicKey.Health]: new Set(["query_health", "log_visit", "add_appointment"]),
  [TopicKey.Pets]: new Set(["query_pets"]),
  [TopicKey.School]: new Set(["query_school", "add_assignment"]),
  [TopicKey.Travel]: new Set(["query_trips", "create_trip"]),
  [TopicKey.Vendors]: new Set(["query_vendors"]),
  [TopicKey.Business]: new Set(["query_leads"]),
  [TopicKey.Relationship]: new Set([
    "query_nudge_history",
    "dispatch_nudge",
    "respond_to_nudge",
    "record_nudge_ignored",
    "set_quiet_window",
  ]),
  [TopicKey.FamilyStatus]: new Set(["query_status", "update_status"]),
  [TopicKey.Meals]: new Set(["query_plans"]),
  [TopicKey.Maintenance]: new Set(["query_maintenance"]),
};

const INTERPRETER_SUPPORTED_ACTIONS_BY_TOPIC: Record<TopicKey, Set<string>> = {
  [TopicKey.Calendar]: new Set([
    "query_events",
    "cancel_event",
    "reschedule_event",
    "create_event",
  ]),
  [TopicKey.Chores]: new Set(["query_chores", "complete_chore", "cancel_chore", "assign_chore"]),
  [TopicKey.Finances]: new Set(["query_finances", "log_expense"]),
  [TopicKey.Grocery]: new Set(["query_list", "remove_items", "add_items"]),
  [TopicKey.Health]: new Set(["query_health", "log_visit", "add_appointment"]),
  [TopicKey.Pets]: new Set(["query_pets", "log_care"]),
  [TopicKey.School]: new Set(["query_school", "add_assignment"]),
  [TopicKey.Travel]: new Set(["query_trips", "create_trip"]),
  [TopicKey.Vendors]: new Set(["query_vendors", "add_vendor"]),
  [TopicKey.Business]: new Set(["query_leads", "add_lead"]),
  [TopicKey.Relationship]: new Set([
    "query_nudge_history",
    "dispatch_nudge",
    "respond_to_nudge",
    "record_nudge_ignored",
    "set_quiet_window",
  ]),
  [TopicKey.FamilyStatus]: new Set(["query_status", "update_status"]),
  [TopicKey.Meals]: new Set(["query_plans", "plan_meal"]),
  [TopicKey.Maintenance]: new Set(["query_maintenance", "add_asset"]),
};

const nonEmptyStringSchema = z.string().trim().min(1);
const nonNegativeNumberSchema = z.number().min(0);
const dateSchema = z.coerce.date();

const INTERPRETER_ACTION_SCHEMA_BY_TYPE: Record<string, z.ZodTypeAny> = {
  query_events: z.object({ type: z.literal("query_events") }),
  create_event: z.object({
    type: z.literal("create_event"),
    title: nonEmptyStringSchema,
    date_start: dateSchema,
    concerning: z.array(nonEmptyStringSchema).min(1),
  }),
  notify_calendar_change: z.object({
    type: z.literal("notify_calendar_change"),
    change_type: z.enum(["created", "updated", "removed"]),
    event_id: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    concerning: z.array(nonEmptyStringSchema).min(1),
    starts_at: dateSchema.optional(),
    ends_at: dateSchema.optional(),
    location: nonEmptyStringSchema.optional(),
  }),
  reschedule_event: z.object({
    type: z.literal("reschedule_event"),
    event_id: nonEmptyStringSchema,
    new_start: dateSchema,
  }),
  cancel_event: z.object({
    type: z.literal("cancel_event"),
    event_id: nonEmptyStringSchema,
  }),
  query_chores: z.object({ type: z.literal("query_chores") }),
  assign_chore: z.object({
    type: z.literal("assign_chore"),
    task: nonEmptyStringSchema,
    assigned_to: nonEmptyStringSchema,
    due: dateSchema,
  }),
  complete_chore: z.object({ type: z.literal("complete_chore"), chore_id: nonEmptyStringSchema }),
  cancel_chore: z.object({ type: z.literal("cancel_chore"), chore_id: nonEmptyStringSchema }),
  query_finances: z.object({ type: z.literal("query_finances") }),
  log_expense: z.object({
    type: z.literal("log_expense"),
    description: nonEmptyStringSchema,
    amount: nonNegativeNumberSchema,
    logged_by: nonEmptyStringSchema,
    requires_confirmation: z.literal(true).default(true),
  }),
  query_list: z.object({ type: z.literal("query_list") }),
  add_items: z.object({
    type: z.literal("add_items"),
    items: z.array(z.object({ item: nonEmptyStringSchema })).min(1),
  }),
  remove_items: z.object({
    type: z.literal("remove_items"),
    item_ids: z.array(nonEmptyStringSchema).min(1),
  }),
  query_health: z.object({
    type: z.literal("query_health"),
    entity: nonEmptyStringSchema.optional(),
  }),
  add_appointment: z.object({
    type: z.literal("add_appointment"),
    entity: nonEmptyStringSchema,
    provider_type: z.nativeEnum(HealthProviderType),
    date: dateSchema,
  }),
  log_visit: z.object({
    type: z.literal("log_visit"),
    entity: nonEmptyStringSchema,
    provider_type: z.nativeEnum(HealthProviderType),
    notes: nonEmptyStringSchema,
  }),
  query_pets: z.object({
    type: z.literal("query_pets"),
    entity: nonEmptyStringSchema.optional(),
  }),
  log_care: z.object({
    type: z.literal("log_care"),
    entity: nonEmptyStringSchema,
    activity: nonEmptyStringSchema,
    by: nonEmptyStringSchema,
    category: z.nativeEnum(PetCareCategory),
  }),
  query_school: z.object({
    type: z.literal("query_school"),
    entity: nonEmptyStringSchema.optional(),
  }),
  add_assignment: z.object({
    type: z.literal("add_assignment"),
    entity: nonEmptyStringSchema,
    parent_entity: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    due_date: dateSchema,
    source: z.nativeEnum(SchoolInputSource),
  }),
  query_trips: z.object({
    type: z.literal("query_trips"),
    status: z.nativeEnum(TripStatus).optional(),
  }),
  create_trip: z.object({
    type: z.literal("create_trip"),
    name: nonEmptyStringSchema,
    dates: z.object({ start: dateSchema, end: dateSchema }),
    travelers: z.array(nonEmptyStringSchema).min(1),
    source: z.nativeEnum(TravelInputSource),
  }),
  query_vendors: z.object({ type: z.literal("query_vendors") }),
  add_vendor: z.object({
    type: z.literal("add_vendor"),
    name: nonEmptyStringSchema,
    vendor_type: nonEmptyStringSchema,
    contact: nonEmptyStringSchema,
    managed_by: nonEmptyStringSchema,
  }),
  query_leads: z.object({
    type: z.literal("query_leads"),
    owner: nonEmptyStringSchema.optional(),
    status: z.nativeEnum(BusinessLeadStatus).optional(),
  }),
  add_lead: z.object({
    type: z.literal("add_lead"),
    owner: nonEmptyStringSchema,
    client_name: nonEmptyStringSchema,
  }),
  query_nudge_history: z.object({
    type: z.literal("query_nudge_history"),
    nudge_type: z.nativeEnum(NudgeType).optional(),
  }),
  dispatch_nudge: z.object({
    type: z.literal("dispatch_nudge"),
    nudge_type: z.nativeEnum(NudgeType),
  }),
  respond_to_nudge: z.object({
    type: z.literal("respond_to_nudge"),
    acknowledged: z.boolean(),
  }),
  record_nudge_ignored: z.object({
    type: z.literal("record_nudge_ignored"),
    ignored_at: dateSchema,
  }),
  set_quiet_window: z.object({
    type: z.literal("set_quiet_window"),
    quiet_window: z.object({
      is_busy_period: z.boolean(),
      is_stressful_period: z.boolean(),
    }),
  }),
  query_status: z.object({
    type: z.literal("query_status"),
    entity: nonEmptyStringSchema.optional(),
  }),
  update_status: z.object({
    type: z.literal("update_status"),
    entity: nonEmptyStringSchema,
    status: nonEmptyStringSchema,
    expires_at: dateSchema,
  }),
  query_plans: z.object({ type: z.literal("query_plans") }),
  plan_meal: z.object({
    type: z.literal("plan_meal"),
    date: dateSchema,
    meal_type: z.nativeEnum(MealType),
    description: nonEmptyStringSchema,
    planned_by: nonEmptyStringSchema,
  }),
  query_maintenance: z.object({
    type: z.literal("query_maintenance"),
    asset_type: z.nativeEnum(MaintenanceAssetType).optional(),
    status: z.nativeEnum(MaintenanceStatus).optional(),
  }),
  add_asset: z.object({
    type: z.literal("add_asset"),
    asset_type: z.nativeEnum(MaintenanceAssetType),
    name: nonEmptyStringSchema,
    details: z.record(z.string(), z.string()),
  }),
};

interface WorkerIdentityService {
  resolve(item: StackQueueItem): Promise<IdentityResolutionResult>;
}

export interface WorkerOptions {
  classifier_service: ClassifierServiceContract;
  identity_service: WorkerIdentityService;
  topic_profile_service: TopicProfileService;
  routing_service: RoutingService;
  budget_service: BudgetService;
  escalation_service: EscalationService;
  confirmation_service: ConfirmationService;
  state_service: StateService;
  queue_service: { enqueue(item: StackQueueItem): Promise<void> };
  transport_service: TransportServiceContract;
  action_router?: ActionRouterContract;
  logger?: Logger;
  config?: WorkerConfig;
  now?: () => Date;
}

interface DeterminedAction {
  is_response: boolean;
  typed_action: TopicAction;
  resolved_topic?: TopicKey;
  resolved_intent?: ClassifierIntent;
  resolved_from_clarification?: boolean;
  additional_actions?: SupplementalAction[];
}

interface SupplementalAction {
  is_response: boolean;
  typed_action: TopicAction;
  resolved_topic: TopicKey;
  resolved_intent: ClassifierIntent;
}

interface MutationSummary {
  topic: TopicKey;
  action_type: string;
  lines: string[];
}

interface TopicBatchPolicy {
  same_topic_mode: "single" | "batched_items";
  cross_topic_companions: TopicKey[];
  duplicate_removal: "remove_all_exact_matches" | "clarify_duplicates";
  confirmation_mode: "single_required_action" | "allow_non_confirming_companions";
}

const TOPIC_BATCH_POLICIES: Record<TopicKey, TopicBatchPolicy> = {
  [TopicKey.Calendar]: {
    same_topic_mode: "single",
    cross_topic_companions: [TopicKey.Grocery],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "single_required_action",
  },
  [TopicKey.Chores]: {
    same_topic_mode: "single",
    cross_topic_companions: [],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "single_required_action",
  },
  [TopicKey.Finances]: {
    same_topic_mode: "single",
    cross_topic_companions: [TopicKey.Grocery],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "allow_non_confirming_companions",
  },
  [TopicKey.Grocery]: {
    same_topic_mode: "batched_items",
    cross_topic_companions: [TopicKey.Finances, TopicKey.Meals],
    duplicate_removal: "remove_all_exact_matches",
    confirmation_mode: "allow_non_confirming_companions",
  },
  [TopicKey.Health]: {
    same_topic_mode: "single",
    cross_topic_companions: [],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "single_required_action",
  },
  [TopicKey.Pets]: {
    same_topic_mode: "single",
    cross_topic_companions: [TopicKey.Grocery],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "allow_non_confirming_companions",
  },
  [TopicKey.School]: {
    same_topic_mode: "single",
    cross_topic_companions: [TopicKey.FamilyStatus],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "allow_non_confirming_companions",
  },
  [TopicKey.Travel]: {
    same_topic_mode: "single",
    cross_topic_companions: [TopicKey.Grocery, TopicKey.Calendar],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "single_required_action",
  },
  [TopicKey.Vendors]: {
    same_topic_mode: "single",
    cross_topic_companions: [TopicKey.Maintenance],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "single_required_action",
  },
  [TopicKey.Business]: {
    same_topic_mode: "single",
    cross_topic_companions: [TopicKey.Finances, TopicKey.Calendar],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "single_required_action",
  },
  [TopicKey.Relationship]: {
    same_topic_mode: "single",
    cross_topic_companions: [],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "single_required_action",
  },
  [TopicKey.FamilyStatus]: {
    same_topic_mode: "single",
    cross_topic_companions: [TopicKey.School, TopicKey.Calendar, TopicKey.Chores],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "allow_non_confirming_companions",
  },
  [TopicKey.Meals]: {
    same_topic_mode: "single",
    cross_topic_companions: [TopicKey.Grocery],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "allow_non_confirming_companions",
  },
  [TopicKey.Maintenance]: {
    same_topic_mode: "single",
    cross_topic_companions: [TopicKey.Vendors, TopicKey.Finances],
    duplicate_removal: "clarify_duplicates",
    confirmation_mode: "single_required_action",
  },
};

interface ClarificationDispatch {
  clarification: ClarificationRequest;
  routing_target: string;
}

class ClarificationSignal extends Error {
  public readonly clarification: ClarificationRequest;

  public constructor(clarification: ClarificationRequest) {
    super(clarification.message_to_participant);
    this.name = "ClarificationSignal";
    this.clarification = clarification;
  }
}

function extractQueueItemId(queueItem: StackQueueItem): string {
  if (queueItem.id) {
    return queueItem.id;
  }
  return `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeContent(content: StackQueueItem["content"]): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

function sentenceCaseResponse(content: string): string {
  const trimmed = stripConversationalLeadIns(content).trim();
  if (trimmed.length === 0) {
    return "Noted.";
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function joinNaturalLanguageList(items: string[]): string {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0] ?? "";
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function extractWeekdayReference(content: string): string | null {
  const match = content.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/iu);
  return match?.[1] ?? null;
}

function extractSchoolFocus(content: string): string | null {
  const normalized = content.toLowerCase();
  if (normalized.includes("field trip")) {
    return "field trip";
  }
  if (normalized.includes("homework")) {
    return "homework";
  }
  if (normalized.includes("pickup")) {
    return "pickup";
  }
  return normalized.includes("school") ? "school" : null;
}

type OverviewScope = "today" | "tonight" | "this_week";

interface QueryTimeWindow {
  start: Date;
  end: Date;
  label: string;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function detectOverviewScope(content: string): OverviewScope | null {
  const normalized = content.toLowerCase();
  const hasTimeScope =
    /\btoday\b/u.test(normalized) ||
    /\btonight\b/u.test(normalized) ||
    /\bthis\s+week\b/u.test(normalized) ||
    /\bright\s+now\b/u.test(normalized);
  const hasOverviewCue =
    /\b(digest|summary|recap|overview)\b/u.test(normalized) ||
    ((/\bwhat'?s up\b/u.test(normalized) ||
      /\bwhat is up\b/u.test(normalized) ||
      /\bwhat do i have\b/u.test(normalized)) &&
      hasTimeScope);
  if (!hasOverviewCue) {
    return null;
  }
  if (/\bthis\s+week\b/u.test(normalized)) {
    return "this_week";
  }
  if (/\btonight\b/u.test(normalized)) {
    return "tonight";
  }
  return "today";
}

function buildQueryTimeWindow(content: string, fallback: Date): QueryTimeWindow | null {
  const normalized = content.toLowerCase();
  if (/\btonight\b/u.test(normalized)) {
    const start = new Date(fallback);
    start.setHours(Math.max(start.getHours(), 17), 0, 0, 0);
    return { start, end: endOfLocalDay(fallback), label: "tonight" };
  }
  if (/\btoday\b/u.test(normalized)) {
    return { start: startOfLocalDay(fallback), end: endOfLocalDay(fallback), label: "today" };
  }
  if (/\bthis\s+week\b/u.test(normalized)) {
    const start = startOfLocalDay(fallback);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: "this week" };
  }
  const weekday = extractWeekdayReference(content);
  if (weekday) {
    const day = nextWeekdayFromFallback(fallback, weekday);
    if (day) {
      return { start: startOfLocalDay(day), end: endOfLocalDay(day), label: weekday };
    }
  }
  const explicit = extractDateHint(content, fallback);
  if (explicit) {
    return {
      start: startOfLocalDay(explicit),
      end: endOfLocalDay(explicit),
      label: explicit.toDateString(),
    };
  }
  return null;
}

function dateFallsWithinWindow(
  date: Date | null | undefined,
  window: QueryTimeWindow | null,
): boolean {
  if (!date) {
    return false;
  }
  if (!window) {
    return true;
  }
  return date.getTime() >= window.start.getTime() && date.getTime() <= window.end.getTime();
}

function isVagueCalendarRequest(content: string): boolean {
  const normalized = stripConversationalLeadIns(content).toLowerCase();
  const hasGenericSubject = /\b(?:thing|something|stuff|event)\b/u.test(normalized);
  const hasUncertainty = normalized.includes("i think") || normalized.includes("maybe");
  return hasGenericSubject && hasUncertainty;
}

function dayPartToHour(dayPart: string | undefined): number {
  switch (dayPart?.toLowerCase()) {
    case "morning":
      return 9;
    case "afternoon":
      return 15;
    case "evening":
      return 18;
    case "tonight":
      return 20;
    default:
      return 12;
  }
}

function nextWeekdayFromFallback(fallback: Date, weekday: string, dayPart?: string): Date | null {
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const normalizedWeekday = weekday.toLowerCase();
  const targetDay = dayMap[normalizedWeekday];
  if (targetDay === undefined) {
    return null;
  }
  const parsed = new Date(fallback);
  const currentDay = parsed.getDay();
  let delta = (targetDay - currentDay + 7) % 7;
  if (delta === 0) {
    delta = 7;
  }
  parsed.setDate(parsed.getDate() + delta);
  parsed.setHours(dayPartToHour(dayPart), 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toCollisionPolicy(): CollisionPolicy {
  return {
    precedence_order: runtimeSystemConfig.dispatch.collision_avoidance.precedence_order,
    same_precedence_strategy: parseSamePrecedenceStrategy(
      runtimeSystemConfig.dispatch.collision_avoidance.same_precedence_strategy,
    ),
  };
}

function extractDateHint(content: string, fallback: Date): Date | null {
  const normalized = content.trim();
  const isoMatch = content.match(/\b(20\d{2}-\d{2}-\d{2})\b/u);
  if (isoMatch?.[1]) {
    const parsed = new Date(`${isoMatch[1]}T12:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const mdTimeMatch = normalized.match(
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/iu,
  );
  if (mdTimeMatch) {
    const month = Number(mdTimeMatch[1]);
    const day = Number(mdTimeMatch[2]);
    const yearRaw = mdTimeMatch[3];
    const year = yearRaw
      ? yearRaw.length === 2
        ? 2000 + Number(yearRaw)
        : Number(yearRaw)
      : fallback.getFullYear();
    const hour12 = Number(mdTimeMatch[4]);
    const minute = mdTimeMatch[5] ? Number(mdTimeMatch[5]) : 0;
    const meridiem = mdTimeMatch[6]?.toLowerCase();
    const hour24 =
      meridiem === "pm" ? (hour12 % 12) + 12 : meridiem === "am" ? hour12 % 12 : hour12;
    const parsed = new Date(year, month - 1, day, hour24, minute, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const mdMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/u);
  if (mdMatch) {
    const month = Number(mdMatch[1]);
    const day = Number(mdMatch[2]);
    const yearRaw = mdMatch[3];
    const year = yearRaw
      ? yearRaw.length === 2
        ? 2000 + Number(yearRaw)
        : Number(yearRaw)
      : fallback.getFullYear();
    const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const monthNameMatch = normalized.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,\s*(\d{4}))?(?:\s+at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/iu,
  );
  if (monthNameMatch) {
    const monthToken = monthNameMatch[1]?.toLowerCase().slice(0, 3);
    const monthMap: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const month = monthToken ? monthMap[monthToken] : undefined;
    if (month !== undefined) {
      const day = Number(monthNameMatch[2]);
      const year = monthNameMatch[3] ? Number(monthNameMatch[3]) : fallback.getFullYear();
      const hourRaw = monthNameMatch[4] ? Number(monthNameMatch[4]) : 12;
      const minute = monthNameMatch[5] ? Number(monthNameMatch[5]) : 0;
      const meridiem = monthNameMatch[6]?.toLowerCase();
      const hour24 =
        meridiem === "pm" ? (hourRaw % 12) + 12 : meridiem === "am" ? hourRaw % 12 : hourRaw;
      const parsed = new Date(year, month, day, hour24, minute, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  const weekdayMatch = normalized.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(morning|afternoon|evening|tonight))?\b/iu,
  );
  if (weekdayMatch?.[1]) {
    return nextWeekdayFromFallback(fallback, weekdayMatch[1], weekdayMatch[2] ?? undefined);
  }
  if (/\btomorrow\b/iu.test(content)) {
    return new Date(fallback.getTime() + 24 * 60 * 60 * 1000);
  }
  if (/\btonight\b/iu.test(content)) {
    const next = new Date(fallback);
    next.setHours(19, 0, 0, 0);
    return next;
  }
  const timeOnlyMatch = normalized.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/iu);
  if (timeOnlyMatch) {
    const hour12 = Number(timeOnlyMatch[1]);
    const minute = timeOnlyMatch[2] ? Number(timeOnlyMatch[2]) : 0;
    const meridiem = timeOnlyMatch[3]?.toLowerCase();
    const hour24 =
      meridiem === "pm" ? (hour12 % 12) + 12 : meridiem === "am" ? hour12 % 12 : hour12;
    const parsed = new Date(fallback);
    parsed.setHours(hour24, minute, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function extractAmount(content: string): number | null {
  const cleaned = content.replace(/,/gu, "");
  const withCurrency = cleaned.match(
    /\$?\s*(\d+(?:\.\d{1,2})?)(?:\s*(k|m))?(?:\s*(?:dollars?|bucks?|usd))?/iu,
  );
  if (!withCurrency?.[1]) {
    return null;
  }
  const base = Number(withCurrency[1]);
  const suffix = withCurrency[2]?.toLowerCase();
  const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : 1;
  const parsed = base * multiplier;
  return Number.isFinite(parsed) ? parsed : null;
}

const GROCERY_COMPOUND_PHRASES = new Set([
  "cream cheese",
  "ice cream",
  "olive oil",
  "paper towels",
  "toilet paper",
  "dish soap",
  "garlic bread",
  "brown sugar",
  "green beans",
  "sweet potatoes",
  "sour cream",
  "ground beef",
  "chicken breast",
  "almond milk",
  "peanut butter",
  "orange juice",
  "sparkling water",
]);

const GROCERY_DESCRIPTOR_WORDS = new Set([
  "baby",
  "black",
  "blue",
  "brown",
  "cream",
  "dish",
  "extra",
  "fresh",
  "frozen",
  "garlic",
  "green",
  "ground",
  "ice",
  "olive",
  "orange",
  "paper",
  "peanut",
  "red",
  "shredded",
  "sour",
  "sparkling",
  "sweet",
  "toilet",
  "white",
  "yellow",
]);

function splitMessageClauses(content: string): string[] {
  return content
    .split(/,|;|\n|\bthen\b|\balso\b|&|\+/iu)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function expandCompactGroceryPhrase(part: string): string[] {
  const normalized = canonicalizeGroceryItem(part);
  const words = normalized.split(/\s+/u).filter((word) => word.length > 0);
  if (words.length <= 1) {
    return [normalized];
  }
  if (GROCERY_COMPOUND_PHRASES.has(normalized)) {
    return [normalized];
  }
  const hasDescriptor = words.some((word) => GROCERY_DESCRIPTOR_WORDS.has(word));
  const hasQuantity = words.some((word) => /\d/u.test(word));
  if (hasDescriptor || hasQuantity || words.length > 4) {
    return [normalized];
  }
  return words;
}

function splitListItems(content: string): string[] {
  const containsRemovalCue = /\b(?:remove|delete|drop|take off|cross off|not)\b/iu.test(content);
  return splitMessageClauses(content)
    .flatMap((clause) => clause.split(/\band\b/iu))
    .map((part) =>
      part
        .trim()
        .replace(
          /^(?:please\s+)?(?:add|get|buy|grab|pick up|put|remove|delete|drop|take off|cross off)\s+(?:me\s+)?(?:some\s+)?/iu,
          "",
        )
        .replace(
          /\s+(?:to|onto|on|from|off)\s+(?:the\s+)?(?:grocery|shopping)?\s*(?:list|cart)\.?$/iu,
          "",
        )
        .replace(/^(?:and|also)\s+/iu, "")
        .replace(/^(?:actually|just|okay|ok)\s*,?\s*/iu, "")
        .replace(/^(?:not|no)\s+/iu, containsRemovalCue ? "" : "$&")
        .replace(/\b(?:note|remind(?: me)?|track|log)\s+\$?\d[\d,.]*(?:\.\d{1,2})?.*$/iu, "")
        .replace(/\b(?:bill|invoice|payment|pay|due)\b.*$/iu, "")
        .replace(
          /\s+\b(?:on|for)\s+(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*\s+\d{1,2}(?:,\s*\d{4})?)\b.*$/iu,
          "",
        )
        .replace(/^(?:the\s+)?/iu, "")
        .trim(),
    )
    .filter((part) => !isLikelyNonGroceryClause(part))
    .filter((part) => part.length > 0)
    .flatMap((part) => expandCompactGroceryPhrase(part))
    .slice(0, 6);
}

function canonicalizeGroceryItem(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/^(?:and|also)\s+/iu, "")
    .replace(/^(?:not|no)\s+/iu, "")
    .replace(/^(?:the\s+)/iu, "")
    .replace(/\s+(?:at|from)\s+(?:the\s+)?store$/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function isLikelyNonGroceryClause(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }
  if (
    /^(?:actually|calendar|it|that|this|them|these|those|one|ones|please|thanks|thank you)$/u.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /\b(?:bill|invoice|payment|pay|due|owed|budget|expense|refund|reimburse|mortgage|rent)\b/u.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/\$\s*\d/u.test(normalized)) {
    return true;
  }
  return false;
}

function normalizeLegacyGroceryItemForStorage(value: string): string | null {
  const normalized = canonicalizeGroceryItem(value)
    .replace(/^(?:please\s+)?(?:add|get|buy|grab|pick up|put)\s+(?:me\s+)?(?:some\s+)?/iu, "")
    .replace(
      /\s+\b(?:on|for)\s+(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*\s+\d{1,2}(?:,\s*\d{4})?)\b.*$/iu,
      "",
    )
    .trim();
  if (normalized.length === 0) {
    return null;
  }
  return isLikelyNonGroceryClause(normalized) ? null : normalized;
}

function isLikelyMixedIntent(content: string): boolean {
  const text = content.toLowerCase();
  const hasClauseSeparator = /,|\band\b|\bthen\b|\balso\b|\n/u.test(text);
  if (!hasClauseSeparator) {
    return false;
  }

  const groceryCue = /\b(grocery|shopping|list|cart|buy|get|pick up|grab)\b/u.test(text);
  const financeCue = /\b(\$|bill|invoice|payment|pay|expense|due|budget)\b/u.test(text);
  const calendarCue =
    /\b(calendar|appointment|schedule|meeting|at\s+\d{1,2}(?::\d{2})?\s*(am|pm))\b/u.test(text);
  const choresCue = /\b(chore|trash|laundry|dishes|vacuum|clean|yard)\b/u.test(text);
  const schoolCue = /\b(school|homework|assignment|field trip|pickup)\b/u.test(text);
  const familyStatusCue =
    /\b(running late|on my way|eta|home in|home around|at the store|at practice|pickup line)\b/u.test(
      text,
    );

  const domains = [
    groceryCue,
    financeCue,
    calendarCue,
    choresCue,
    schoolCue,
    familyStatusCue,
  ].filter(Boolean).length;
  return domains >= 2;
}

function clauseLooksLikeGrocery(content: string): boolean {
  return /\b(grocery|shopping|list|cart|buy|get|pick up|grab|add|remove|delete|drop)\b/iu.test(
    content,
  );
}

function clauseLooksLikeFinance(content: string): boolean {
  return /\b(\$|bill|invoice|payment|pay|expense|due|budget)\b/iu.test(content);
}

function clauseLooksLikeCalendar(content: string): boolean {
  return /\b(calendar|appointment|schedule|meeting)\b/iu.test(content);
}

function clauseLooksLikeSchool(content: string): boolean {
  return /\b(school|homework|assignment|field trip|pickup)\b/iu.test(content);
}

function clauseLooksLikeFamilyStatus(content: string): boolean {
  return /\b(running late|on my way|eta|home in|home around|at the store|at practice|pickup line)\b/iu.test(
    content,
  );
}

function stripTemporalPhrases(content: string): string {
  return content
    .replace(
      /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b/giu,
      " ",
    )
    .replace(
      /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b/giu,
      " ",
    )
    .replace(
      /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:morning|afternoon|evening|tonight))?\b/giu,
      " ",
    )
    .replace(/\b(?:tomorrow|tonight|today|next\s+week|this\s+week)\b/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function stripConversationalLeadIns(content: string): string {
  return content
    .replace(/^(?:actually|just|okay|ok|well|so|yeah|yep|nope)\s*,?\s*/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function isDigestRequest(content: string): boolean {
  const normalized = content.toLowerCase();
  return (
    /\b(digest|summary|recap|highlights|overview)\b/u.test(normalized) &&
    /\b(today|tonight|this\s+day|this\s+week|right\s+now|now)\b/u.test(normalized)
  );
}

function buildClarification(
  queueItem: StackQueueItem,
  reason: ClarificationReason,
  message: string,
  context: Record<string, unknown> = {},
  options?: string[],
): ClarificationRequest {
  return {
    reason,
    message_to_participant: message,
    options,
    original_queue_item_id: extractQueueItemId(queueItem),
    context,
  };
}

function normalizeEntityToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/giu, "");
}

function tokenizeNormalizedWords(content: string): string[] {
  const tokens = content
    .toLowerCase()
    .split(/[^a-z0-9]+/giu)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  return Array.from(new Set(tokens));
}

function isWithinEditDistance(candidate: string, target: string, maxDistance: number): boolean {
  if (candidate === target) {
    return true;
  }
  if (Math.abs(candidate.length - target.length) > maxDistance) {
    return false;
  }

  const rows = candidate.length + 1;
  const columns = target.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }
  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    let rowBest = Number.POSITIVE_INFINITY;
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = candidate[row - 1] === target[column - 1] ? 0 : 1;
      const value = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );
      matrix[row][column] = value;
      if (value < rowBest) {
        rowBest = value;
      }
    }
    if (rowBest > maxDistance) {
      return false;
    }
  }

  return matrix[rows - 1][columns - 1] <= maxDistance;
}

function getEntityIdByType(entityType: EntityType): string | null {
  return runtimeSystemConfig.entities.find((entity) => entity.type === entityType)?.id ?? null;
}

function getDefaultHumanEntityId(): string {
  return (
    getEntityIdByType(EntityType.Adult) ??
    getEntityIdByType(EntityType.Child) ??
    runtimeSystemConfig.entities[0]?.id ??
    "participant_1"
  );
}

export class Worker {
  private readonly classifierService: ClassifierServiceContract;

  private readonly identityService: WorkerIdentityService;

  private readonly topicProfileService: TopicProfileService;

  private readonly routingService: RoutingService;

  private readonly budgetService: BudgetService;

  private readonly escalationService: EscalationService;

  private readonly confirmationService: ConfirmationService;

  private readonly stateService: StateService;

  private readonly queueService: { enqueue(item: StackQueueItem): Promise<void> };

  private readonly transportService: TransportServiceContract;

  private readonly actionRouter?: ActionRouterContract;

  private readonly logger: Logger;

  private readonly config: Required<WorkerConfig>;

  private readonly now: () => Date;

  public constructor(options: WorkerOptions) {
    this.classifierService = options.classifier_service;
    this.identityService = options.identity_service;
    this.topicProfileService = options.topic_profile_service;
    this.routingService = options.routing_service;
    this.budgetService = options.budget_service;
    this.escalationService = options.escalation_service;
    this.confirmationService = options.confirmation_service;
    this.stateService = options.state_service;
    this.queueService = options.queue_service;
    this.transportService = options.transport_service;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.actionRouter = options.action_router ?? createActionRouter({ logger: this.logger });
    this.now = options.now ?? (() => new Date());
    this.config = {
      max_thread_history_messages:
        options.config?.max_thread_history_messages ?? DEFAULT_MAX_THREAD_HISTORY_MESSAGES,
      stale_after_hours: options.config?.stale_after_hours ?? DEFAULT_STALE_AFTER_HOURS,
      urgent_relevance_minutes:
        options.config?.urgent_relevance_minutes ?? DEFAULT_URGENT_RELEVANCE_MINUTES,
      clarification_timeout_minutes: options.config?.clarification_timeout_minutes ?? 10,
      ai_action_interpreter_enabled:
        options.config?.ai_action_interpreter_enabled ??
        runtimeSystemConfig.worker.ai_action_interpreter_enabled ??
        true,
      ai_action_interpreter_topic_allowlist:
        options.config?.ai_action_interpreter_topic_allowlist ??
        runtimeSystemConfig.worker.ai_action_interpreter_topic_allowlist ??
        [],
    };
  }

  public async process(queue_item: StackQueueItem): Promise<ProcessingTrace> {
    const startedAt = this.now();
    const traceSteps: ProcessingTraceStep[] = [];
    const queueItemId = extractQueueItemId(queue_item);
    const normalizedQueueItem = { ...queue_item, id: queueItemId };
    const threadHistory = await this.stateService.getThreadHistory(
      normalizedQueueItem.target_thread,
    );
    const contentText =
      typeof normalizedQueueItem.content === "string"
        ? normalizedQueueItem.content
        : JSON.stringify(normalizedQueueItem.content);
    const cappedHistory = threadHistory
      ? {
          active_topic_context: this.shouldResetTopicContext(
            threadHistory,
            normalizedQueueItem.topic ?? "",
            startedAt,
            contentText,
          )
            ? ""
            : threadHistory.active_topic_context,
          last_activity: threadHistory.last_activity,
          recent_messages: threadHistory.recent_messages.slice(
            -this.config.max_thread_history_messages,
          ),
        }
      : null;
    const activeClarificationSession = this.getActiveClarificationSession(
      normalizedQueueItem,
      threadHistory,
    );

    let classificationSource: ProcessingTrace["classification_source"] = "worker";

    const classification = await this.traceStep(
      traceSteps,
      1,
      WorkerAction.ClassifyTopic,
      WorkerService.Classifier,
      `topic=${normalizedQueueItem.topic ?? "unclassified"}`,
      async () => {
        if (
          normalizedQueueItem.topic &&
          [QueueItemSource.EmailMonitor, QueueItemSource.DataIngest].includes(
            normalizedQueueItem.source,
          )
        ) {
          classificationSource = "preclassified_email";
          return {
            topic: normalizedQueueItem.topic,
            intent: normalizedQueueItem.intent ?? ClassifierIntent.Request,
            concerning: normalizedQueueItem.concerning,
            confidence: 0.95,
          } satisfies StackClassificationResult;
        }
        if (
          normalizedQueueItem.topic &&
          normalizedQueueItem.source === QueueItemSource.ScheduledTrigger
        ) {
          classificationSource = "preclassified_scheduled";
          return {
            topic: normalizedQueueItem.topic,
            intent: normalizedQueueItem.intent ?? ClassifierIntent.Request,
            concerning: normalizedQueueItem.concerning,
            confidence: 0.99,
          } satisfies StackClassificationResult;
        }
        return this.classifierService.classify(normalizedQueueItem, cappedHistory);
      },
      (output) => ({
        output_summary: `${output.topic}/${output.intent}`,
        metadata: {
          topic: output.topic,
          intent: output.intent,
          concerning: output.concerning,
          history_count: cappedHistory?.recent_messages.length ?? 0,
          classification_source: classificationSource,
        },
      }),
    );

    const classifiedQueueItem: StackQueueItem = {
      ...normalizedQueueItem,
      topic: classification.topic,
      intent: classification.intent,
      concerning: classification.concerning,
    };

    const identity = await this.traceStep(
      traceSteps,
      2,
      WorkerAction.IdentifyEntities,
      WorkerService.Identity,
      summarizeContent(classifiedQueueItem.content),
      async () => this.identityService.resolve(classifiedQueueItem),
      (output) => ({
        output_summary: `${output.source_entity_id}->${output.thread_id}`,
        metadata: { concerning: output.concerning },
      }),
    );

    if (this.isStale(classifiedQueueItem)) {
      const staleAction = this.toStoreAction(
        classifiedQueueItem,
        "Item exceeded its relevance window.",
      );
      await this.stateService.appendDispatchResult(classifiedQueueItem, staleAction);
      await this.appendInboundHistory(classifiedQueueItem, classification.topic);
      const completedAt = this.now();
      this.logger.info({ queue_item_id: queueItemId }, "Worker dropped stale item.");
      return {
        queue_item_id: queueItemId,
        started_at: startedAt,
        completed_at: completedAt,
        outcome: "dropped_stale",
        steps: traceSteps,
        classification_source: classificationSource,
      };
    }

    const actionContent = await this.resolveActionContent(
      classifiedQueueItem,
      classification,
      cappedHistory,
    );

    let determined: DeterminedAction | ClarificationDispatch;
    try {
      determined = await this.traceStep(
        traceSteps,
        3,
        WorkerAction.DetermineActionType,
        undefined,
        `${classification.topic}/${classification.intent}`,
        () =>
          this.resolveAction(
            classifiedQueueItem,
            classification,
            identity,
            cappedHistory,
            actionContent,
            activeClarificationSession,
          ),
        (output) => ({
          output_summary: output.is_response ? "response" : "proactive",
          metadata: {
            typed_action: output.typed_action,
            typed_action_type: output.typed_action.type,
            resolved_topic: output.resolved_topic ?? classification.topic,
            resolved_intent: output.resolved_intent ?? classification.intent,
            is_response: output.is_response ? "true" : "false",
          },
        }),
      );
    } catch (error: unknown) {
      if (!(error instanceof ClarificationSignal)) {
        throw error;
      }
      determined = await this.dispatchClarification(
        classifiedQueueItem,
        classification,
        identity,
        error.clarification,
      );
    }

    if (this.isClarificationDispatch(determined)) {
      const completedAt = this.now();
      return {
        queue_item_id: queueItemId,
        started_at: startedAt,
        completed_at: completedAt,
        outcome: "clarification_requested",
        steps: traceSteps,
        classification_source: classificationSource,
      };
    }

    const effectiveIsResponse =
      determined.is_response || this.isParticipantInitiatedSource(classifiedQueueItem.source);
    const effectiveClassification: StackClassificationResult = {
      ...classification,
      topic: determined.resolved_topic ?? classification.topic,
      intent: determined.resolved_intent ?? classification.intent,
    };
    const effectiveQueueItem: StackQueueItem = {
      ...classifiedQueueItem,
      topic: effectiveClassification.topic,
      intent: effectiveClassification.intent,
      concerning: effectiveClassification.concerning,
    };

    if (typeof this.budgetService.recordHumanSignal === "function") {
      await this.budgetService.recordHumanSignal(effectiveQueueItem, effectiveClassification);
    }

    const provisionalTargetThread = await this.routingService.resolveTargetThread({
      topic: effectiveClassification.topic,
      intent: effectiveClassification.intent,
      concerning: effectiveClassification.concerning,
      origin_thread: effectiveQueueItem.target_thread,
      is_response: effectiveIsResponse,
    });

    const budget = await this.traceStep(
      traceSteps,
      4,
      WorkerAction.CheckOutboundBudget,
      WorkerService.Budget,
      provisionalTargetThread,
      async () =>
        this.budgetService.evaluateOutbound(
          effectiveQueueItem,
          provisionalTargetThread,
          toCollisionPolicy(),
        ),
      (output) => ({
        output_summary: output.priority,
        metadata: { hold_until: output.hold_until?.toISOString(), reason: output.reason },
      }),
    );

    const escalation = await this.traceStep(
      traceSteps,
      5,
      WorkerAction.CheckEscalation,
      WorkerService.Escalation,
      provisionalTargetThread,
      async () => this.escalationService.evaluate(effectiveQueueItem, provisionalTargetThread),
      (output) => ({
        output_summary: output.should_escalate ? "escalating" : "no_escalation",
        metadata: {
          next_action_at: output.next_action_at?.toISOString(),
          next_target_thread: output.next_target_thread,
        },
      }),
    );

    const escalationTargetThread =
      escalation.should_escalate && escalation.next_target_thread
        ? escalation.next_target_thread
        : provisionalTargetThread;
    const additionalActions = determined.additional_actions ?? [];
    const additionalMutationSummaries: MutationSummary[] = [];
    for (const additionalAction of additionalActions) {
      if (
        TOPIC_BATCH_POLICIES[effectiveClassification.topic].confirmation_mode ===
          "single_required_action" &&
        this.confirmationTypeForAction(additionalAction.typed_action) !== null
      ) {
        continue;
      }
      const summary = await this.applyStateMutation(
        {
          ...effectiveQueueItem,
          topic: additionalAction.resolved_topic,
          intent: additionalAction.resolved_intent,
        },
        additionalAction.typed_action,
      );
      if (summary) {
        additionalMutationSummaries.push(summary);
      }
    }

    const confirmationResult = await this.traceStep(
      traceSteps,
      6,
      WorkerAction.CheckConfirmation,
      WorkerService.Confirmation,
      determined.typed_action.type,
      async () =>
        this.handleConfirmation(
          effectiveQueueItem,
          effectiveClassification,
          identity,
          determined.typed_action,
          escalationTargetThread,
          additionalMutationSummaries.flatMap((summary) => summary.lines),
        ),
      (output) => ({
        output_summary: output.kind,
        metadata: output.metadata,
      }),
    );

    if (confirmationResult.kind === "confirmation_prompted") {
      const completedAt = this.now();
      return {
        queue_item_id: queueItemId,
        started_at: startedAt,
        completed_at: completedAt,
        outcome: "held",
        steps: traceSteps,
        classification_source: classificationSource,
      };
    }

    if (
      confirmationResult.kind === "resolved_reply" &&
      confirmationResult.resolution !== ConfirmationResult.Approved
    ) {
      const haltedAction = this.toStoreAction(
        { ...classifiedQueueItem, target_thread: escalationTargetThread },
        `Confirmation resolved as ${confirmationResult.resolution}; action execution halted.`,
      );
      await this.appendInboundHistory(effectiveQueueItem, effectiveClassification.topic);
      await this.stateService.appendDispatchResult(effectiveQueueItem, haltedAction);
      const completedAt = this.now();
      return {
        queue_item_id: queueItemId,
        started_at: startedAt,
        completed_at: completedAt,
        outcome: "stored",
        steps: traceSteps,
        classification_source: classificationSource,
      };
    }

    const actionToExecute =
      confirmationResult.kind === "resolved_reply" &&
      confirmationResult.resolution === ConfirmationResult.Approved &&
      confirmationResult.approved_action_payload
        ? confirmationResult.approved_action_payload
        : determined.typed_action;

    if (determined.resolved_from_clarification) {
      await this.clearPendingClarificationSession(effectiveQueueItem.target_thread);
    }

    const mutationSummaries: MutationSummary[] = [...additionalMutationSummaries];
    const primaryMutationSummary = await this.applyStateMutation(
      effectiveQueueItem,
      actionToExecute,
    );
    if (primaryMutationSummary) {
      mutationSummaries.push(primaryMutationSummary);
    }

    const profileResult = await this.traceStep(
      traceSteps,
      7,
      WorkerAction.ApplyBehaviorProfile,
      WorkerService.TopicProfile,
      effectiveClassification.topic,
      async () => {
        const profile = await this.topicProfileService.getTopicConfig(
          effectiveClassification.topic,
        );
        const placeholderAction = this.toStoreAction(
          effectiveQueueItem,
          "Pre-dispatch composition.",
        );
        const decision: WorkerDecision = {
          queue_item: effectiveQueueItem,
          classification: effectiveClassification,
          identity,
          action: placeholderAction,
        };
        let composed = await this.topicProfileService.composeMessage(decision);
        const stateBackedMessage = await this.composeStateBackedMessage(
          actionToExecute,
          effectiveQueueItem,
          mutationSummaries,
        );
        if (stateBackedMessage) {
          composed = stateBackedMessage;
        }
        const classifierWithComposer = this.classifierService as {
          planTopicResponse?: (input: {
            topic: TopicKey;
            intent: ClassifierIntent;
            source_message: string;
            recent_messages: Array<{
              from: string;
              content: string;
              at: string;
              topic_context: string | null;
            }>;
          }) => Promise<{
            carryover_context: string[];
            unresolved_references: string[];
            commitments_to_track: string[];
            reply_strategy:
              | "direct_answer"
              | "confirm_then_act"
              | "ask_one_question"
              | "brief_status_then_next_step";
            style_notes: string[];
          } | null>;
          composeTopicMessage?: (input: {
            topic: TopicKey;
            intent: ClassifierIntent;
            source_message: string;
            proposed_message: string;
            behavior: {
              tone: string;
              format: string;
              initiative_style: string;
              framework_grounding: string | null;
            };
            recent_messages: Array<{
              from: string;
              content: string;
              at: string;
              topic_context: string | null;
            }>;
            conversation_plan?: {
              carryover_context: string[];
              unresolved_references: string[];
              commitments_to_track: string[];
              reply_strategy:
                | "direct_answer"
                | "confirm_then_act"
                | "ask_one_question"
                | "brief_status_then_next_step";
              style_notes: string[];
            } | null;
          }) => Promise<string | null>;
        };
        if (typeof classifierWithComposer.composeTopicMessage === "function") {
          const sourceMessage =
            typeof effectiveQueueItem.content === "string"
              ? effectiveQueueItem.content
              : JSON.stringify(effectiveQueueItem.content);
          const recentMessages = (cappedHistory?.recent_messages ?? []).map((message) => ({
            from: message.from,
            content: message.content,
            at: message.at.toISOString(),
            topic_context: message.topic_context ?? null,
          }));
          const conversationPlan =
            typeof classifierWithComposer.planTopicResponse === "function"
              ? await classifierWithComposer.planTopicResponse({
                  topic: effectiveClassification.topic,
                  intent: effectiveClassification.intent,
                  source_message: sourceMessage,
                  recent_messages: recentMessages,
                })
              : null;
          const composedFromModel = await classifierWithComposer.composeTopicMessage({
            topic: effectiveClassification.topic,
            intent: effectiveClassification.intent,
            source_message: sourceMessage,
            proposed_message: composed,
            behavior: {
              tone: profile.tone,
              format: profile.format,
              initiative_style: profile.initiative_style,
              framework_grounding: profile.framework_grounding,
            },
            recent_messages: recentMessages,
            conversation_plan: conversationPlan,
          });
          if (typeof composedFromModel === "string" && composedFromModel.trim().length > 0) {
            composed = composedFromModel.trim();
          }
        }
        await this.enqueueCrossTopicEvents(effectiveQueueItem, effectiveClassification, profile, {
          ...determined,
          typed_action: actionToExecute,
        });
        return { profile, composed };
      },
      (output) => ({
        output_summary: output.profile.tone,
        metadata: {
          format: output.profile.format,
          initiative_style: output.profile.initiative_style,
          framework_grounding: output.profile.framework_grounding,
        },
      }),
    );

    const finalRouting = await this.traceStep(
      traceSteps,
      8,
      WorkerAction.RouteAndDispatch,
      WorkerService.Routing,
      escalationTargetThread,
      async () => {
        const routingDecision = this.resolveRoutingDecision({
          topic: effectiveClassification.topic,
          intent: effectiveClassification.intent,
          concerning: effectiveClassification.concerning,
          origin_thread: effectiveQueueItem.target_thread,
          is_response: effectiveIsResponse,
        });
        const routedTargetThread =
          escalation.should_escalate && escalation.next_target_thread
            ? escalation.next_target_thread
            : routingDecision.target.thread_id;
        const effectiveRoutingDecision =
          routedTargetThread === routingDecision.target.thread_id
            ? routingDecision
            : {
                ...routingDecision,
                target: {
                  ...routingDecision.target,
                  thread_id: routedTargetThread,
                },
              };
        const effectiveBudget =
          effectiveRoutingDecision.target.thread_id === provisionalTargetThread
            ? budget
            : await this.budgetService.evaluateOutbound(
                effectiveQueueItem,
                effectiveRoutingDecision.target.thread_id,
                toCollisionPolicy(),
              );
        const finalAction = await this.routeToAction(
          effectiveQueueItem,
          effectiveClassification,
          identity,
          effectiveRoutingDecision,
          effectiveBudget,
          profileResult.composed,
        );

        await this.persistOutcome(
          effectiveQueueItem,
          effectiveClassification,
          finalAction,
          profileResult.composed,
          effectiveRoutingDecision,
          effectiveBudget,
        );

        return {
          routingDecision: effectiveRoutingDecision,
          action: finalAction,
          budget: effectiveBudget,
          escalation,
        };
      },
      (output) => ({
        output_summary: `${output.action.decision}:${output.routingDecision.target.thread_id}`,
        metadata: {
          topic: effectiveClassification.topic,
          intent: effectiveClassification.intent,
          typed_action_type: actionToExecute.type,
          action_decision: output.action.decision,
          follow_up_target: output.routingDecision.follow_up_target?.thread_id,
          budget_priority: output.budget.priority,
          escalation_target: output.escalation.next_target_thread,
        },
      }),
    );

    const completedAt = this.now();
    return {
      queue_item_id: queueItemId,
      started_at: startedAt,
      completed_at: completedAt,
      outcome: this.toOutcome(finalRouting.action),
      steps: traceSteps,
      classification_source: classificationSource,
    };
  }

  private getFirstEntityIdByType(entityType: EntityType): string | null {
    return getEntityIdByType(entityType);
  }

  private extractMentionedEntities(
    content: string,
    options: { includePets?: boolean; onlyTypes?: EntityType[] } = {},
  ): string[] {
    const includePets = options.includePets ?? false;
    const allowedTypes = options.onlyTypes ?? null;
    const normalizedWords = tokenizeNormalizedWords(content);
    const normalizedContent = normalizeEntityToken(content);
    const matches = new Set<string>();

    for (const entity of runtimeSystemConfig.entities) {
      if (!includePets && entity.type === EntityType.Pet) {
        continue;
      }
      if (allowedTypes && !allowedTypes.includes(entity.type)) {
        continue;
      }

      const aliases = [entity.id, entity.name];
      const aliasTokens = aliases
        .flatMap((alias) => alias.split(/[_\s-]+/u))
        .map((alias) => normalizeEntityToken(alias))
        .filter((alias) => alias.length >= 3);

      const isMatch = aliasTokens.some((alias) => {
        if (normalizedWords.includes(alias)) {
          return true;
        }
        if (alias.length >= 5 && normalizedContent.includes(alias)) {
          return true;
        }
        const maxDistance = alias.length >= 7 ? 2 : 1;
        return normalizedWords.some(
          (word) => word.length >= 4 && isWithinEditDistance(word, alias, maxDistance),
        );
      });

      if (isMatch) {
        matches.add(entity.id);
      }
    }

    return Array.from(matches);
  }

  private resolveConcerningForAction(
    content: string,
    classifiedConcerning: string[],
    fallbackEntityId: string,
    options: {
      includePets?: boolean;
      onlyTypes?: EntityType[];
      threadHistory?: ThreadHistory | null;
    } = {},
  ): string[] {
    const mentioned = this.extractMentionedEntities(content, options);
    if (mentioned.length > 0) {
      return mentioned;
    }
    if (classifiedConcerning.length > 0) {
      return classifiedConcerning;
    }

    const historyEntities = this.inferEntitiesFromHistory(options.threadHistory);
    if (historyEntities.length > 0) {
      return historyEntities;
    }

    return [fallbackEntityId];
  }

  private normalizeConcerningForDelivery(concerning: string[]): string[] {
    const normalized = concerning.map((entityId) => {
      if (entityId !== "pet" && !entityId.startsWith("pet_")) {
        return entityId;
      }
      const petEntity = runtimeSystemConfig.entities.find((entity) => entity.id === entityId);
      if (
        petEntity?.type === EntityType.Pet &&
        Array.isArray(petEntity.routes_to) &&
        petEntity.routes_to.length > 0 &&
        typeof petEntity.routes_to[0] === "string"
      ) {
        return petEntity.routes_to[0];
      }
      return entityId;
    });
    return [...new Set(normalized)];
  }

  private shouldResetTopicContext(
    history: ThreadHistory | null,
    nextTopic: string,
    now: Date,
    message: string,
  ): boolean {
    return this.routingService.shouldResetActiveTopicContext(history, nextTopic, now, message);
  }

  private inferEntitiesFromHistory(
    threadHistory: ThreadHistory | null | undefined,
    lookbackCount: number = 3,
  ): string[] {
    if (!threadHistory || threadHistory.recent_messages.length === 0) {
      return [];
    }
    const recentParticipant = threadHistory.recent_messages
      .filter((msg) => msg.from === "participant")
      .slice(-lookbackCount);

    for (let i = recentParticipant.length - 1; i >= 0; i--) {
      const msg = recentParticipant[i];
      if (!msg) continue;
      const found = this.extractMentionedEntities(msg.content, { includePets: true });
      if (found.length > 0) {
        return found;
      }
    }
    return [];
  }

  private async resolveActionContent(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    threadHistory: ThreadHistory | null,
  ): Promise<string> {
    const fallback = summarizeContent(queueItem.content);
    if (
      classification.intent === ClassifierIntent.Query ||
      classification.intent === ClassifierIntent.Confirmation
    ) {
      return fallback;
    }
    if (!isLikelyMixedIntent(fallback)) {
      return fallback;
    }

    const classifierWithScopedContent = this.classifierService as {
      extractTopicScopedContent?: (
        item: StackQueueItem,
        classification: StackClassificationResult,
        thread_history?: ThreadHistory | null,
      ) => Promise<string | null>;
    };
    if (typeof classifierWithScopedContent.extractTopicScopedContent !== "function") {
      return fallback;
    }
    const scoped = await classifierWithScopedContent.extractTopicScopedContent(
      queueItem,
      classification,
      threadHistory,
    );
    if (typeof scoped !== "string" || scoped.trim().length === 0) {
      return fallback;
    }
    this.logger.debug(
      {
        topic: classification.topic,
        intent: classification.intent,
        original: fallback,
        scoped,
      },
      "Using AI-scoped content for action resolution.",
    );
    return scoped;
  }

  private buildGroceryActionFromContent(content: string): TopicAction | null {
    const items = splitListItems(content);
    if (items.length === 0) {
      return null;
    }
    const removalCue = /\b(?:remove|delete|drop|take off|cross off)\b/iu.test(content);
    return removalCue
      ? {
          type: "remove_items",
          item_ids: items,
        }
      : {
          type: "add_items",
          items: items.map((item) => ({ item })),
        };
  }

  private buildCalendarActionFromContent(
    content: string,
    fallbackDate: Date,
    concerning: string[],
  ): TopicAction | null {
    const dateHint = extractDateHint(content, fallbackDate);
    if (!dateHint || !clauseLooksLikeCalendar(content)) {
      return null;
    }
    const title = stripTemporalPhrases(stripConversationalLeadIns(content))
      .replace(/^(?:please\s+)?(?:add|put|set|schedule)\s+/iu, "")
      .replace(/\s+(?:to|on)\s+(?:my\s+)?calendar$/iu, "")
      .replace(/\s+/gu, " ")
      .trim();
    return {
      type: "create_event",
      title: title.length > 0 ? title.slice(0, 80) : "Calendar item",
      date_start: dateHint,
      concerning,
    };
  }

  private buildSchoolActionFromContent(
    content: string,
    fallbackDate: Date,
    childEntity: string | undefined,
    parentEntity: string,
  ): TopicAction | null {
    if (!clauseLooksLikeSchool(content) || !childEntity) {
      return null;
    }
    const dueDate = extractDateHint(content, fallbackDate);
    if (!dueDate) {
      return null;
    }
    return {
      type: "add_assignment",
      entity: childEntity,
      parent_entity: parentEntity,
      title: stripConversationalLeadIns(content).slice(0, 120),
      due_date: dueDate,
      source: SchoolInputSource.Conversation,
    };
  }

  private buildFamilyStatusActionFromContent(
    content: string,
    fallbackDate: Date,
    entity: string,
  ): TopicAction | null {
    if (!clauseLooksLikeFamilyStatus(content)) {
      return null;
    }
    return {
      type: "update_status",
      entity,
      status: stripConversationalLeadIns(content).slice(0, 120),
      expires_at: new Date(fallbackDate.getTime() + 6 * 60 * 60 * 1000),
    };
  }

  private resolveMixedActionPlan(input: {
    queueItem: StackQueueItem;
    classification: StackClassificationResult;
    actor: string;
    content: string;
  }): DeterminedAction | null {
    if (!isLikelyMixedIntent(input.content)) {
      return null;
    }
    const policy = TOPIC_BATCH_POLICIES[input.classification.topic];
    if (policy.cross_topic_companions.length === 0) {
      return null;
    }

    const clauses = splitMessageClauses(input.content);
    const groceryClauses = clauses.filter((clause) => clauseLooksLikeGrocery(clause));
    const financeClauses = clauses.filter((clause) => clauseLooksLikeFinance(clause));
    const calendarClauses = clauses.filter((clause) => clauseLooksLikeCalendar(clause));
    const schoolClauses = clauses.filter((clause) => clauseLooksLikeSchool(clause));
    const familyStatusClauses = clauses.filter((clause) => clauseLooksLikeFamilyStatus(clause));

    if (policy.cross_topic_companions.length === 0) {
      return null;
    }

    const supplementalActions: SupplementalAction[] = [];
    const groceryActions = groceryClauses
      .map((clause) => this.buildGroceryActionFromContent(clause))
      .filter((action): action is TopicAction => action !== null);

    if (input.classification.topic === TopicKey.Grocery && groceryActions.length > 1) {
      const [primaryGroceryAction, ...remainingGroceryActions] = groceryActions;
      if (primaryGroceryAction) {
        return {
          is_response: true,
          typed_action: primaryGroceryAction,
          resolved_topic: TopicKey.Grocery,
          resolved_intent:
            primaryGroceryAction.type === "remove_items"
              ? ClassifierIntent.Cancellation
              : ClassifierIntent.Request,
          additional_actions: remainingGroceryActions.map((action) => ({
            is_response: true,
            typed_action: action,
            resolved_topic: TopicKey.Grocery,
            resolved_intent:
              action.type === "remove_items"
                ? ClassifierIntent.Cancellation
                : ClassifierIntent.Request,
          })),
        };
      }
    }

    for (const action of groceryActions) {
      supplementalActions.push({
        is_response: true,
        typed_action: action,
        resolved_topic: TopicKey.Grocery,
        resolved_intent:
          action.type === "remove_items" ? ClassifierIntent.Cancellation : ClassifierIntent.Request,
      });
    }

    const firstFinanceClause = financeClauses[0];
    if (firstFinanceClause && supplementalActions.length > 0) {
      const amount = extractAmount(firstFinanceClause);
      if (amount !== null) {
        return {
          is_response: true,
          typed_action: {
            type: "log_expense",
            description: stripConversationalLeadIns(firstFinanceClause).slice(0, 120),
            amount,
            logged_by: input.actor,
            requires_confirmation: true,
          },
          resolved_topic: TopicKey.Finances,
          resolved_intent: ClassifierIntent.Request,
          additional_actions: supplementalActions,
        };
      }
    }

    if (input.classification.topic === TopicKey.Grocery && financeClauses.length > 0) {
      const financeClause = financeClauses[0];
      if (financeClause) {
        const amount = extractAmount(financeClause);
        if (amount !== null) {
          return {
            is_response: true,
            typed_action: {
              type: "log_expense",
              description: stripConversationalLeadIns(financeClause).slice(0, 120),
              amount,
              logged_by: input.actor,
              requires_confirmation: true,
            },
            resolved_topic: TopicKey.Finances,
            resolved_intent: ClassifierIntent.Request,
            additional_actions: supplementalActions,
          };
        }
      }
    }

    if (
      input.classification.topic === TopicKey.Calendar &&
      policy.cross_topic_companions.includes(TopicKey.Grocery)
    ) {
      const primaryCalendarAction = calendarClauses
        .map((clause) =>
          this.buildCalendarActionFromContent(
            clause,
            input.queueItem.created_at,
            input.classification.concerning,
          ),
        )
        .find((action): action is TopicAction => action !== null);
      if (primaryCalendarAction && supplementalActions.length > 0) {
        return {
          is_response: true,
          typed_action: primaryCalendarAction,
          resolved_topic: TopicKey.Calendar,
          resolved_intent: ClassifierIntent.Request,
          additional_actions: supplementalActions,
        };
      }
    }

    if (
      input.classification.topic === TopicKey.FamilyStatus &&
      policy.cross_topic_companions.includes(TopicKey.School)
    ) {
      const primaryStatusAction = familyStatusClauses
        .map((clause) =>
          this.buildFamilyStatusActionFromContent(clause, input.queueItem.created_at, input.actor),
        )
        .find((action): action is TopicAction => action !== null);
      const schoolAction = schoolClauses
        .map((clause) =>
          this.buildSchoolActionFromContent(
            clause,
            input.queueItem.created_at,
            input.classification.concerning[0],
            input.actor,
          ),
        )
        .find((action): action is TopicAction => action !== null);
      if (primaryStatusAction && schoolAction) {
        return {
          is_response: true,
          typed_action: primaryStatusAction,
          resolved_topic: TopicKey.FamilyStatus,
          resolved_intent: ClassifierIntent.Update,
          additional_actions: [
            {
              is_response: true,
              typed_action: schoolAction,
              resolved_topic: TopicKey.School,
              resolved_intent: ClassifierIntent.Request,
            },
          ],
        };
      }
    }

    if (
      input.classification.topic === TopicKey.School &&
      policy.cross_topic_companions.includes(TopicKey.FamilyStatus)
    ) {
      const primarySchoolAction = schoolClauses
        .map((clause) =>
          this.buildSchoolActionFromContent(
            clause,
            input.queueItem.created_at,
            input.classification.concerning[0],
            input.actor,
          ),
        )
        .find((action): action is TopicAction => action !== null);
      const familyStatusAction = familyStatusClauses
        .map((clause) =>
          this.buildFamilyStatusActionFromContent(clause, input.queueItem.created_at, input.actor),
        )
        .find((action): action is TopicAction => action !== null);
      if (primarySchoolAction && familyStatusAction) {
        return {
          is_response: true,
          typed_action: primarySchoolAction,
          resolved_topic: TopicKey.School,
          resolved_intent: ClassifierIntent.Request,
          additional_actions: [
            {
              is_response: true,
              typed_action: familyStatusAction,
              resolved_topic: TopicKey.FamilyStatus,
              resolved_intent: ClassifierIntent.Update,
            },
          ],
        };
      }
    }

    return null;
  }

  private async resolveAction(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    identity: IdentityResolutionResult,
    threadHistory: ThreadHistory | null,
    actionContent?: string,
    activeClarificationSession?: PendingClarificationSession | null,
  ): Promise<DeterminedAction> {
    const content = stripConversationalLeadIns(
      actionContent ?? summarizeContent(queueItem.content),
    );
    if (activeClarificationSession) {
      return this.resolveActionFromClarification(queueItem, activeClarificationSession);
    }
    const mixedPlan = this.resolveMixedActionPlan({
      queueItem,
      classification,
      actor: identity.source_entity_id,
      content,
    });
    if (mixedPlan) {
      return mixedPlan;
    }
    const interpreted = await this.resolveActionViaInterpreter(
      queueItem,
      classification,
      threadHistory,
      content,
    );
    if (interpreted) {
      return interpreted;
    }

    if (
      queueItem.source === QueueItemSource.ImageAttachment &&
      classification.image_extraction &&
      classification.image_extraction.type !== "unknown" &&
      classification.image_extraction.confidence >= 0.5
    ) {
      const imageAction = this.resolveImageAction(classification, identity.source_entity_id);
      if (imageAction) {
        return imageAction;
      }
    }

    const explicitDateHint = extractDateHint(content, queueItem.created_at);
    const inferredReference = this.inferClarificationReference(queueItem, threadHistory);
    const referenceId =
      queueItem.clarification_of ?? inferredReference ?? extractQueueItemId(queueItem);
    const hasReference = queueItem.clarification_of !== undefined || inferredReference !== null;
    const actor = identity.source_entity_id;
    const humanConcerning = this.resolveConcerningForAction(
      content,
      classification.concerning,
      actor,
    );
    const adultConcerning = this.resolveConcerningForAction(
      content,
      classification.concerning,
      actor,
      { onlyTypes: [EntityType.Adult] },
    );
    const childConcerning = this.resolveConcerningForAction(
      content,
      classification.concerning,
      this.getFirstEntityIdByType(EntityType.Child) ?? actor,
      { onlyTypes: [EntityType.Child] },
    );
    const petConcerning = this.resolveConcerningForAction(
      content,
      classification.concerning,
      this.getFirstEntityIdByType(EntityType.Pet) ?? actor,
      { includePets: true, onlyTypes: [EntityType.Pet] },
    );
    const dateHint =
      explicitDateHint ?? this.inferDateFromHistory(threadHistory, content, queueItem.created_at);
    const amountHint = this.resolveAmountHint(content, threadHistory);
    const introspectionToken =
      classification.intent === ClassifierIntent.Query
        ? detectAssistantIntrospectionToken(content, queueItem.target_thread)
        : null;

    if (introspectionToken) {
      return {
        is_response: true,
        typed_action: { type: "query_status", entity: introspectionToken },
      };
    }
    const overviewScope =
      classification.intent === ClassifierIntent.Query ? detectOverviewScope(content) : null;
    if (overviewScope) {
      return {
        is_response: true,
        typed_action: { type: "query_status", entity: `__overview__:${overviewScope}` },
      };
    }

    const calendarChange =
      queueItem.source === QueueItemSource.DataIngest && classification.topic === TopicKey.Calendar
        ? extractCalendarChangeNotification(queueItem.content)
        : null;
    if (calendarChange) {
      return {
        is_response: false,
        typed_action: {
          type: "notify_calendar_change",
          change_type: calendarChange.change_type,
          event_id: calendarChange.event_id,
          title: calendarChange.title,
          concerning: calendarChange.concerning,
          starts_at: calendarChange.starts_at,
          ends_at: calendarChange.ends_at,
          location: calendarChange.location,
        },
      };
    }

    switch (classification.topic) {
      case TopicKey.Calendar: {
        if (
          classification.intent === ClassifierIntent.Update &&
          !hasReference &&
          /\b(?:grocery|shopping|buy|get|grab|pick up|list)\b/iu.test(content)
        ) {
          const groceryItems = splitListItems(content);
          if (groceryItems.length > 0) {
            return {
              is_response: true,
              typed_action: { type: "add_items", items: groceryItems.map((item) => ({ item })) },
            };
          }
        }
        if (classification.intent === ClassifierIntent.Query) {
          const dateWindow = buildQueryTimeWindow(content, queueItem.created_at);
          return {
            is_response: true,
            typed_action: {
              type: "query_events",
              filters: {
                concerning: humanConcerning,
                date_range: dateWindow
                  ? {
                      start: dateWindow.start,
                      end: dateWindow.end,
                    }
                  : undefined,
              },
            },
          };
        }
        if (classification.intent === ClassifierIntent.Cancellation) {
          if (!hasReference) {
            throw new ClarificationSignal(
              buildClarification(
                queueItem,
                ClarificationReason.AmbiguousReference,
                "Which event should I cancel?",
              ),
            );
          }
          return {
            is_response: true,
            typed_action: { type: "cancel_event", event_id: referenceId },
          };
        }
        if (classification.intent === ClassifierIntent.Update) {
          if (!hasReference || !dateHint) {
            throw new ClarificationSignal(
              buildClarification(
                queueItem,
                ClarificationReason.MissingRequiredField,
                "What should I move it to?",
                {
                  action_type: "reschedule_event",
                  event_id: hasReference ? referenceId : null,
                  base_date_hint: dateHint?.toISOString() ?? null,
                },
              ),
            );
          }
          return {
            is_response: true,
            typed_action: { type: "reschedule_event", event_id: referenceId, new_start: dateHint },
          };
        }
        if (isVagueCalendarRequest(content)) {
          throw new ClarificationSignal(
            buildClarification(
              queueItem,
              ClarificationReason.MissingRequiredField,
              "What date and time should I put on the calendar?",
              {
                action_type: "create_event",
                concerning: humanConcerning,
                base_date_hint: dateHint?.toISOString() ?? null,
              },
            ),
          );
        }
        if (!dateHint) {
          throw new ClarificationSignal(
            buildClarification(
              queueItem,
              ClarificationReason.MissingRequiredField,
              "What date and time should I put on the calendar?",
              {
                action_type: "create_event",
                concerning: humanConcerning,
              },
            ),
          );
        }
        const titleFromCurrent = stripTemporalPhrases(content)
          .replace(/^(?:please\s+)?(?:add|put|set|schedule)\s+/iu, "")
          .replace(/\s+(?:to|on)\s+(?:my\s+)?calendar$/iu, "")
          .replace(
            /^(?:please\s+)?(?:add|put|set|schedule)\s+(?:that|it|this)\s+(?:to|on)?\s*(?:my\s+)?calendar$/iu,
            "",
          )
          .replace(/^(?:actually|just|okay|ok)\s*,?\s*/iu, "")
          .trim();
        const inferredTitle =
          titleFromCurrent.length > 0
            ? titleFromCurrent.slice(0, 80)
            : this.inferCalendarTitleFromHistory(threadHistory, content);
        return {
          is_response: true,
          typed_action: {
            type: "create_event",
            title: inferredTitle && inferredTitle.length > 0 ? inferredTitle : "Calendar item",
            date_start: dateHint,
            concerning: humanConcerning,
          },
        };
      }
      case TopicKey.Chores: {
        if (classification.intent === ClassifierIntent.Query) {
          return {
            is_response: true,
            typed_action: {
              type: "query_chores",
              assigned_to: childConcerning[0] ?? humanConcerning[0] ?? actor,
            },
          };
        }
        if (classification.intent === ClassifierIntent.Completion) {
          if (!hasReference) {
            throw new ClarificationSignal(
              buildClarification(
                queueItem,
                ClarificationReason.AmbiguousReference,
                "Which chore did you complete?",
              ),
            );
          }
          return {
            is_response: true,
            typed_action: { type: "complete_chore", chore_id: referenceId },
          };
        }
        if (classification.intent === ClassifierIntent.Cancellation) {
          if (!hasReference) {
            throw new ClarificationSignal(
              buildClarification(
                queueItem,
                ClarificationReason.AmbiguousReference,
                "Which chore should I cancel?",
              ),
            );
          }
          return {
            is_response: true,
            typed_action: { type: "cancel_chore", chore_id: referenceId },
          };
        }
        return {
          is_response: true,
          typed_action: {
            type: "assign_chore",
            task: content.slice(0, 120),
            assigned_to: humanConcerning[0] ?? actor,
            due: dateHint ?? new Date(queueItem.created_at.getTime() + 24 * 60 * 60 * 1000),
          },
        };
      }
      case TopicKey.Finances: {
        if (classification.intent === ClassifierIntent.Query) {
          return { is_response: true, typed_action: { type: "query_finances" } };
        }
        if (amountHint === null) {
          throw new ClarificationSignal(
            buildClarification(
              queueItem,
              ClarificationReason.MissingRequiredField,
              "What amount should I log?",
              {
                action_type: "log_expense",
                description: content.slice(0, 120),
                logged_by: actor,
              },
            ),
          );
        }
        return {
          is_response: true,
          typed_action: {
            type: "log_expense",
            description: content.slice(0, 120),
            amount: amountHint,
            logged_by: actor,
            requires_confirmation: true,
          },
        };
      }
      case TopicKey.Grocery: {
        if (classification.intent === ClassifierIntent.Query) {
          return { is_response: true, typed_action: { type: "query_list" } };
        }
        const items = splitListItems(content);
        if (items.length === 0) {
          throw new ClarificationSignal(
            buildClarification(
              queueItem,
              ClarificationReason.MissingRequiredField,
              "What should I add to the list?",
            ),
          );
        }
        if (classification.intent === ClassifierIntent.Cancellation) {
          return {
            is_response: true,
            typed_action: { type: "remove_items", item_ids: items },
          };
        }
        return {
          is_response: true,
          typed_action: { type: "add_items", items: items.map((item) => ({ item })) },
        };
      }
      case TopicKey.Health: {
        if (classification.intent === ClassifierIntent.Query) {
          return {
            is_response: true,
            typed_action: { type: "query_health", entity: humanConcerning[0] },
          };
        }
        if (
          classification.intent === ClassifierIntent.Completion ||
          (classification.intent === ClassifierIntent.Update && !dateHint)
        ) {
          return {
            is_response: true,
            typed_action: {
              type: "log_visit",
              entity: humanConcerning[0] ?? actor,
              provider_type: this.inferHealthProvider(content),
              notes: content,
            },
          };
        }
        if (!dateHint) {
          throw new ClarificationSignal(
            buildClarification(
              queueItem,
              ClarificationReason.MissingRequiredField,
              "When is the appointment?",
              {
                action_type: "add_appointment",
                entity: humanConcerning[0] ?? actor,
                provider_type: this.inferHealthProvider(content),
              },
            ),
          );
        }
        return {
          is_response: true,
          typed_action: {
            type: "add_appointment",
            entity: humanConcerning[0] ?? actor,
            provider_type: this.inferHealthProvider(content),
            date: dateHint,
          },
        };
      }
      case TopicKey.Pets: {
        if (classification.intent === ClassifierIntent.Query) {
          return {
            is_response: true,
            typed_action: { type: "query_pets", entity: petConcerning[0] },
          };
        }
        return {
          is_response: false,
          typed_action: {
            type: "log_care",
            entity: petConcerning[0],
            activity: content.slice(0, 120),
            by: actor,
            category: PetCareCategory.GeneralCare,
          },
        };
      }
      case TopicKey.School: {
        if (classification.intent === ClassifierIntent.Query) {
          return {
            is_response: true,
            typed_action: { type: "query_school", entity: childConcerning[0] ?? actor },
          };
        }
        if (!dateHint) {
          throw new ClarificationSignal(
            buildClarification(
              queueItem,
              ClarificationReason.MissingRequiredField,
              "When is it due?",
              {
                action_type: "add_assignment",
                entity: childConcerning[0],
                parent_entity: actor,
                title: content.slice(0, 120),
                source:
                  queueItem.source === QueueItemSource.EmailMonitor
                    ? SchoolInputSource.EmailParsing
                    : SchoolInputSource.Conversation,
              },
            ),
          );
        }
        return {
          is_response: true,
          typed_action: {
            type: "add_assignment",
            entity: childConcerning[0],
            parent_entity: actor,
            title: content.slice(0, 120),
            due_date: dateHint,
            source:
              queueItem.source === QueueItemSource.EmailMonitor
                ? SchoolInputSource.EmailParsing
                : SchoolInputSource.Conversation,
          },
        };
      }
      case TopicKey.Travel: {
        if (classification.intent === ClassifierIntent.Query) {
          return {
            is_response: true,
            typed_action: { type: "query_trips", status: TripStatus.Planning },
          };
        }
        if (!dateHint) {
          throw new ClarificationSignal(
            buildClarification(
              queueItem,
              ClarificationReason.MissingRequiredField,
              "What dates should I use for the trip?",
              {
                action_type: "create_trip",
                name: content.slice(0, 80),
                travelers: humanConcerning,
              },
            ),
          );
        }
        return {
          is_response: true,
          typed_action: {
            type: "create_trip",
            name: content.slice(0, 80),
            dates: {
              start: dateHint,
              end: new Date(dateHint.getTime() + 24 * 60 * 60 * 1000),
            },
            travelers: humanConcerning,
            source:
              queueItem.source === QueueItemSource.EmailMonitor
                ? TravelInputSource.EmailParsing
                : TravelInputSource.Conversation,
          },
        };
      }
      case TopicKey.Vendors: {
        if (classification.intent === ClassifierIntent.Query) {
          return { is_response: true, typed_action: { type: "query_vendors" } };
        }
        return {
          is_response: false,
          typed_action: {
            type: "add_vendor",
            name: content.slice(0, 60),
            vendor_type: "general_service",
            contact: "unknown",
            managed_by: adultConcerning[0] ?? actor,
          },
        };
      }
      case TopicKey.Business: {
        if (classification.intent === ClassifierIntent.Query) {
          return {
            is_response: true,
            typed_action: {
              type: "query_leads",
              owner: adultConcerning[0],
              status: BusinessLeadStatus.New,
            },
          };
        }
        return {
          is_response: false,
          typed_action: {
            type: "add_lead",
            owner: adultConcerning[0] ?? actor,
            client_name: content.slice(0, 80),
          },
        };
      }
      case TopicKey.Relationship: {
        if (classification.intent === ClassifierIntent.Query) {
          return {
            is_response: true,
            typed_action: {
              type: "query_nudge_history",
              nudge_type: NudgeType.AppreciationPrompt,
            },
          };
        }
        if (classification.intent === ClassifierIntent.Nudge) {
          return {
            is_response: false,
            typed_action: { type: "dispatch_nudge", nudge_type: NudgeType.ConnectionPrompt },
          };
        }
        if (isRelationshipStressSignal(content) || isNegativeHumanSignal(content)) {
          return {
            is_response: true,
            typed_action: {
              type: "set_quiet_window",
              quiet_window: {
                is_busy_period: true,
                is_stressful_period: isRelationshipStressSignal(content),
              },
            },
          };
        }
        return {
          is_response: true,
          typed_action: { type: "respond_to_nudge", acknowledged: !isNegativeHumanSignal(content) },
        };
      }
      case TopicKey.FamilyStatus: {
        if (classification.intent === ClassifierIntent.Query) {
          if (isDigestRequest(content)) {
            return {
              is_response: true,
              typed_action: { type: "query_status", entity: "__digest__" },
            };
          }
          return {
            is_response: true,
            typed_action: { type: "query_status", entity: humanConcerning[0] },
          };
        }
        return {
          is_response: true,
          typed_action: {
            type: "update_status",
            entity: humanConcerning[0] ?? actor,
            status: content.slice(0, 120),
            expires_at: new Date(queueItem.created_at.getTime() + 6 * 60 * 60 * 1000),
          },
        };
      }
      case TopicKey.Meals: {
        if (classification.intent === ClassifierIntent.Query) {
          return { is_response: true, typed_action: { type: "query_plans" } };
        }
        return {
          is_response: false,
          typed_action: {
            type: "plan_meal",
            date: dateHint ?? queueItem.created_at,
            meal_type: MealType.Dinner,
            description: content.slice(0, 120),
            planned_by: actor,
          },
        };
      }
      case TopicKey.Maintenance: {
        if (classification.intent === ClassifierIntent.Query) {
          return {
            is_response: true,
            typed_action: {
              type: "query_maintenance",
              asset_type: MaintenanceAssetType.Home,
              status: MaintenanceStatus.DueSoon,
            },
          };
        }
        return {
          is_response: false,
          typed_action: {
            type: "add_asset",
            asset_type: content.toLowerCase().includes("car")
              ? MaintenanceAssetType.Vehicle
              : MaintenanceAssetType.Home,
            name: content.slice(0, 80),
            details: {},
          },
        };
      }
      default:
        throw new ClarificationSignal(
          buildClarification(
            queueItem,
            ClarificationReason.AmbiguousIntent,
            "I need a little more detail before I act on that.",
          ),
        );
    }
  }

  private async resolveActionViaInterpreter(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    threadHistory: ThreadHistory | null,
    scopedContent: string,
  ): Promise<DeterminedAction | null> {
    if (!this.config.ai_action_interpreter_enabled) {
      this.logger.debug(
        { queue_item_id: extractQueueItemId(queueItem), interpreter_fallback_reason: "disabled" },
        "Interpreter skipped; deterministic fallback active.",
      );
      return null;
    }
    const allowlist = this.config.ai_action_interpreter_topic_allowlist;
    if (allowlist.length > 0 && !allowlist.includes(classification.topic)) {
      this.logger.debug(
        {
          queue_item_id: extractQueueItemId(queueItem),
          topic: classification.topic,
          interpreter_fallback_reason: "topic_not_allowlisted",
        },
        "Interpreter skipped by topic allowlist; deterministic fallback active.",
      );
      return null;
    }
    if (typeof this.classifierService.interpretAction !== "function") {
      this.logger.debug(
        {
          queue_item_id: extractQueueItemId(queueItem),
          interpreter_fallback_reason: "interpreter_not_implemented",
        },
        "Interpreter unavailable; deterministic fallback active.",
      );
      return null;
    }

    const interpreted = await this.classifierService.interpretAction({
      queue_item: queueItem,
      classification,
      thread_history: threadHistory,
      scoped_content: scopedContent,
    });
    if (!interpreted) {
      this.logger.debug(
        {
          queue_item_id: extractQueueItemId(queueItem),
          topic: classification.topic,
          interpreter_failed: true,
          fallback_used: true,
        },
        "AI action interpreter returned no result; using deterministic fallback.",
      );
      return null;
    }
    if (interpreted.kind === "clarification_required") {
      this.logger.info(
        {
          queue_item_id: extractQueueItemId(queueItem),
          topic: classification.topic,
          reason: interpreted.clarification.reason,
          clarification_from_interpreter: true,
        },
        "AI action interpreter requested clarification.",
      );
      throw new ClarificationSignal(interpreted.clarification);
    }

    if (allowlist.length > 0 && !allowlist.includes(interpreted.topic)) {
      this.logger.warn(
        {
          queue_item_id: extractQueueItemId(queueItem),
          classifier_topic: classification.topic,
          interpreter_topic: interpreted.topic,
          fallback_used: true,
        },
        "Interpreter returned topic outside allowlist; using deterministic fallback.",
      );
      return null;
    }

    const normalized = this.normalizeInterpretedAction(
      interpreted.topic,
      interpreted.intent,
      interpreted.action,
    );
    if (!normalized) {
      this.logger.warn(
        {
          queue_item_id: extractQueueItemId(queueItem),
          topic: classification.topic,
          interpreter_topic: interpreted.topic,
          schema_error: true,
          fallback_used: true,
        },
        "AI action interpreter returned unsupported action payload; using deterministic fallback.",
      );
      return null;
    }
    this.logger.info(
      {
        queue_item_id: extractQueueItemId(queueItem),
        topic: interpreted.topic,
        action_type: normalized.typed_action.type,
        intent: interpreted.intent,
        interpreter_used: true,
      },
      "Resolved action via AI action interpreter.",
    );
    return normalized;
  }

  private normalizeInterpretedAction(
    topic: TopicKey,
    intent: ClassifierIntent,
    action: Record<string, unknown> & { type: string },
  ): DeterminedAction | null {
    const type = action.type;
    if (!INTERPRETER_SUPPORTED_ACTIONS_BY_TOPIC[topic].has(type)) {
      return null;
    }
    const normalized: Record<string, unknown> = { ...action };
    if (typeof normalized.new_start === "string") {
      normalized.new_start = new Date(normalized.new_start);
    }
    if (typeof normalized.date_start === "string") {
      normalized.date_start = new Date(normalized.date_start);
    }
    if (typeof normalized.due === "string") {
      normalized.due = new Date(normalized.due);
    }
    if (typeof normalized.date === "string") {
      normalized.date = new Date(normalized.date);
    }
    if (typeof normalized.due_date === "string") {
      normalized.due_date = new Date(normalized.due_date);
    }
    if (typeof normalized.expires_at === "string") {
      normalized.expires_at = new Date(normalized.expires_at);
    }
    if (
      normalized.dates &&
      typeof normalized.dates === "object" &&
      !Array.isArray(normalized.dates)
    ) {
      const dates = normalized.dates as { start?: unknown; end?: unknown };
      normalized.dates = {
        start: typeof dates.start === "string" ? new Date(dates.start) : dates.start,
        end: typeof dates.end === "string" ? new Date(dates.end) : dates.end,
      };
    }
    if (typeof normalized.amount === "string") {
      const parsed = Number(normalized.amount);
      if (Number.isFinite(parsed)) {
        normalized.amount = parsed;
      }
    }
    if (Array.isArray(normalized.items)) {
      normalized.items = normalized.items
        .map((entry) => {
          if (typeof entry === "string") {
            return { item: entry };
          }
          if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            const item = (entry as { item?: unknown }).item;
            if (typeof item === "string" && item.trim().length > 0) {
              return { item: item.trim() };
            }
          }
          return null;
        })
        .filter((value): value is { item: string } => value !== null);
    }
    if (Array.isArray(normalized.item_ids)) {
      normalized.item_ids = normalized.item_ids.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      );
    }
    const schema = INTERPRETER_ACTION_SCHEMA_BY_TYPE[type];
    if (!schema) {
      return null;
    }
    const parsed = schema.safeParse(normalized);
    if (!parsed.success) {
      return null;
    }
    return {
      is_response: INTERPRETER_RESPONSE_ACTIONS_BY_TOPIC[topic].has(type),
      typed_action: parsed.data as TopicAction,
      resolved_topic: topic,
      resolved_intent: intent,
    };
  }

  private inferHealthProvider(content: string): HealthProviderType {
    const normalized = content.toLowerCase();
    if (normalized.includes("dent")) {
      return HealthProviderType.Dentist;
    }
    if (normalized.includes("eye") || normalized.includes("vision")) {
      return HealthProviderType.Optometrist;
    }
    if (normalized.includes("therapy")) {
      return HealthProviderType.Therapist;
    }
    if (normalized.includes("urgent")) {
      return HealthProviderType.Urgent;
    }
    if (normalized.includes("special")) {
      return HealthProviderType.Specialist;
    }
    return HealthProviderType.Primary;
  }

  private inferClarificationReference(
    queueItem: StackQueueItem,
    threadHistory: ThreadHistory | null,
  ): string | null {
    if (queueItem.clarification_of) {
      return queueItem.clarification_of;
    }
    if (!threadHistory || threadHistory.recent_messages.length < 2) {
      return null;
    }

    const recent = threadHistory.recent_messages;
    let lastAssistantIndex = -1;
    for (let index = recent.length - 1; index >= 0; index -= 1) {
      if (recent[index]?.from === "assistant") {
        lastAssistantIndex = index;
        break;
      }
    }
    if (lastAssistantIndex < 0) {
      return null;
    }

    const assistantMessage = recent[lastAssistantIndex];
    const assistantContent = assistantMessage?.content?.trim() ?? "";

    const isExactClarification = CLARIFICATION_PROMPTS.some(
      (prompt) => assistantContent.toLowerCase() === prompt.toLowerCase(),
    );
    const isQuestionFromAssistant = assistantContent.endsWith("?");

    if (!isExactClarification && !isQuestionFromAssistant) {
      return null;
    }

    if (!isExactClarification && isQuestionFromAssistant) {
      const currentContent = typeof queueItem.content === "string" ? queueItem.content : "";
      const wordCount = currentContent.trim().split(/\s+/u).length;
      const isShortResponse = wordCount <= 12;
      const startsWithDeterminer = /^(the|that|this|it|yes|yeah|no|nah|ok|okay|sure)\b/iu.test(
        currentContent.trim(),
      );
      if (!isShortResponse && !startsWithDeterminer) {
        return null;
      }
    }

    for (let index = lastAssistantIndex - 1; index >= 0; index -= 1) {
      const message = recent[index];
      if (message?.from !== "participant") {
        continue;
      }
      return message.state_ref ?? message.id ?? null;
    }

    return null;
  }

  private getActiveClarificationSession(
    queueItem: StackQueueItem,
    threadHistory: ThreadHistory | null,
  ): PendingClarificationSession | null {
    const session = threadHistory?.pending_clarification ?? null;
    if (!session) {
      return null;
    }
    if (
      queueItem.clarification_of &&
      queueItem.clarification_of !== session.original_queue_item_id
    ) {
      return null;
    }
    if (session.source_thread !== queueItem.target_thread) {
      return null;
    }
    return this.looksLikeClarificationReply(queueItem) ? session : null;
  }

  private looksLikeClarificationReply(queueItem: StackQueueItem): boolean {
    if (queueItem.clarification_of) {
      return true;
    }
    if (
      queueItem.source === QueueItemSource.Reaction ||
      queueItem.source === QueueItemSource.ForwardedMessage
    ) {
      return true;
    }
    const content = summarizeContent(queueItem.content).trim();
    if (content.length === 0) {
      return false;
    }
    if (/^\d+$/u.test(content) || /^[a-z]$/iu.test(content)) {
      return true;
    }
    if (
      /^(?:yes|yeah|yep|no|nope|nah|ok|okay|sure|tomorrow|today|tonight|morning|afternoon|evening)\b/iu.test(
        content,
      )
    ) {
      return true;
    }
    return content.split(/\s+/u).length <= 12;
  }

  private contextString(context: Record<string, unknown>, key: string): string | null {
    const value = context[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }

  private contextStringArray(context: Record<string, unknown>, key: string): string[] {
    const value = context[key];
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : [];
  }

  private contextDate(context: Record<string, unknown>, key: string): Date | null {
    const value = context[key];
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  private resolveActionFromClarification(
    queueItem: StackQueueItem,
    session: PendingClarificationSession,
  ): DeterminedAction {
    const content = stripConversationalLeadIns(summarizeContent(queueItem.content));
    const context = session.context;
    const actionType = this.contextString(context, "action_type");
    if (!actionType) {
      throw new ClarificationSignal(
        buildClarification(queueItem, session.reason, session.message_to_participant, context),
      );
    }

    switch (actionType) {
      case "add_assignment": {
        const dueDate = extractDateHint(content, queueItem.created_at);
        if (!dueDate) {
          throw new ClarificationSignal(
            buildClarification(queueItem, session.reason, session.message_to_participant, context),
          );
        }
        const entity = this.contextString(context, "entity") ?? session.source_concerning[0] ?? "";
        const parentEntity =
          this.contextString(context, "parent_entity") ?? session.source_entity_id;
        const title = this.contextString(context, "title") ?? session.source_message;
        const source =
          this.contextString(context, "source") === SchoolInputSource.EmailParsing
            ? SchoolInputSource.EmailParsing
            : SchoolInputSource.Conversation;
        return {
          is_response: true,
          typed_action: {
            type: "add_assignment",
            entity,
            parent_entity: parentEntity,
            title,
            due_date: dueDate,
            source,
          },
          resolved_topic: session.topic,
          resolved_intent: session.intent,
          resolved_from_clarification: true,
        };
      }
      case "log_expense": {
        const amount = extractAmount(content);
        if (amount === null) {
          throw new ClarificationSignal(
            buildClarification(queueItem, session.reason, session.message_to_participant, context),
          );
        }
        return {
          is_response: true,
          typed_action: {
            type: "log_expense",
            description: this.contextString(context, "description") ?? session.source_message,
            amount,
            logged_by: this.contextString(context, "logged_by") ?? session.source_entity_id,
            requires_confirmation: true,
          },
          resolved_topic: session.topic,
          resolved_intent: session.intent,
          resolved_from_clarification: true,
        };
      }
      case "add_appointment": {
        const baseDate = this.contextDate(context, "base_date_hint") ?? queueItem.created_at;
        const appointmentDate = extractDateHint(content, baseDate);
        if (!appointmentDate) {
          throw new ClarificationSignal(
            buildClarification(queueItem, session.reason, session.message_to_participant, context),
          );
        }
        const entity = this.contextString(context, "entity") ?? session.source_entity_id;
        const providerTypeRaw =
          this.contextString(context, "provider_type") ?? HealthProviderType.Primary;
        const providerType = Object.values(HealthProviderType).includes(
          providerTypeRaw as HealthProviderType,
        )
          ? (providerTypeRaw as HealthProviderType)
          : HealthProviderType.Primary;
        return {
          is_response: true,
          typed_action: {
            type: "add_appointment",
            entity,
            provider_type: providerType,
            date: appointmentDate,
          },
          resolved_topic: session.topic,
          resolved_intent: session.intent,
          resolved_from_clarification: true,
        };
      }
      case "create_event": {
        const baseDate = this.contextDate(context, "base_date_hint") ?? queueItem.created_at;
        const eventDate = extractDateHint(content, baseDate);
        if (!eventDate) {
          throw new ClarificationSignal(
            buildClarification(queueItem, session.reason, session.message_to_participant, context),
          );
        }
        const title =
          this.contextString(context, "title") ??
          stripTemporalPhrases(session.source_message).replace(/\s+/gu, " ").trim() ??
          session.source_message;
        const concerning = this.contextStringArray(context, "concerning");
        return {
          is_response: true,
          typed_action: {
            type: "create_event",
            title,
            date_start: eventDate,
            concerning: concerning.length > 0 ? concerning : session.source_concerning,
          },
          resolved_topic: session.topic,
          resolved_intent: session.intent,
          resolved_from_clarification: true,
        };
      }
      case "create_trip": {
        const tripDate = extractDateHint(content, queueItem.created_at);
        if (!tripDate) {
          throw new ClarificationSignal(
            buildClarification(queueItem, session.reason, session.message_to_participant, context),
          );
        }
        const name = this.contextString(context, "name") ?? session.source_message;
        const travelers = this.contextStringArray(context, "travelers");
        return {
          is_response: true,
          typed_action: {
            type: "create_trip",
            name,
            dates: {
              start: tripDate,
              end: new Date(tripDate.getTime() + 24 * 60 * 60 * 1000),
            },
            travelers: travelers.length > 0 ? travelers : session.source_concerning,
            source: TravelInputSource.Conversation,
          },
          resolved_topic: session.topic,
          resolved_intent: session.intent,
          resolved_from_clarification: true,
        };
      }
      case "reschedule_event": {
        const baseDate = this.contextDate(context, "base_date_hint") ?? queueItem.created_at;
        const eventDate = extractDateHint(content, baseDate);
        const eventId = this.contextString(context, "event_id");
        if (!eventDate || !eventId) {
          throw new ClarificationSignal(
            buildClarification(queueItem, session.reason, session.message_to_participant, context),
          );
        }
        return {
          is_response: true,
          typed_action: {
            type: "reschedule_event",
            event_id: eventId,
            new_start: eventDate,
          },
          resolved_topic: session.topic,
          resolved_intent: session.intent,
          resolved_from_clarification: true,
        };
      }
      default:
        throw new ClarificationSignal(
          buildClarification(queueItem, session.reason, session.message_to_participant, context),
        );
    }
  }

  private inferCalendarTitleFromHistory(
    threadHistory: ThreadHistory | null,
    currentContent: string,
  ): string | null {
    if (!threadHistory) {
      return null;
    }
    const normalizedCurrent = currentContent.trim().toLowerCase();
    const genericCalendarCommandPattern =
      /^(?:add|put|set|schedule)?\s*(?:that|it|this)\s+(?:to|on)?\s*(?:my\s+)?calendar$/iu;

    for (let index = threadHistory.recent_messages.length - 1; index >= 0; index -= 1) {
      const message = threadHistory.recent_messages[index];
      if (!message || message.from !== "participant") {
        continue;
      }
      const candidate = message.content.trim();
      if (candidate.length === 0 || candidate.toLowerCase() === normalizedCurrent) {
        continue;
      }
      if (genericCalendarCommandPattern.test(candidate)) {
        continue;
      }
      const temporalStripped = stripTemporalPhrases(candidate)
        .replace(/^(?:actually|just|okay|ok)\s*,?\s*/iu, "")
        .replace(/^(?:please\s+)?(?:add|put|get|buy|grab|pick up|schedule)\s+/iu, "")
        .replace(/\s+/gu, " ")
        .trim();
      if (temporalStripped.length > 0) {
        return temporalStripped.slice(0, 80);
      }
    }
    return null;
  }

  private inferDateFromHistory(
    threadHistory: ThreadHistory | null,
    currentContent: string,
    fallback: Date,
  ): Date | null {
    if (!threadHistory) {
      return null;
    }
    const normalizedCurrent = currentContent.trim().toLowerCase();
    for (let index = threadHistory.recent_messages.length - 1; index >= 0; index -= 1) {
      const message = threadHistory.recent_messages[index];
      if (!message || message.from !== "participant") {
        continue;
      }
      const candidate = message.content.trim();
      if (candidate.length === 0 || candidate.toLowerCase() === normalizedCurrent) {
        continue;
      }
      const parsed = extractDateHint(candidate, fallback);
      if (parsed) {
        return parsed;
      }
    }
    return null;
  }

  private resolveAmountHint(content: string, threadHistory: ThreadHistory | null): number | null {
    const direct = extractAmount(content);
    if (direct !== null) {
      return direct;
    }
    if (!threadHistory) {
      return null;
    }
    const normalizedCurrent = content.trim().toLowerCase();
    for (let index = threadHistory.recent_messages.length - 1; index >= 0; index -= 1) {
      const message = threadHistory.recent_messages[index];
      if (!message || message.from !== "participant") {
        continue;
      }
      const candidate = message.content.trim();
      if (candidate.length === 0 || candidate.toLowerCase() === normalizedCurrent) {
        continue;
      }
      const inferred = extractAmount(candidate);
      if (inferred !== null) {
        return inferred;
      }
    }
    return null;
  }

  private async applyStateMutation(
    queueItem: StackQueueItem,
    action: TopicAction,
  ): Promise<MutationSummary | null> {
    const state = await this.stateService.getSystemState();
    const now = this.now();
    const actor = queueItem.concerning[0] ?? getDefaultHumanEntityId();
    let mutated = false;
    let summary: MutationSummary | null = null;

    switch (action.type) {
      case "create_event": {
        state.calendar.events.push({
          id: `cal_${now.getTime()}`,
          title: action.title,
          date_start: action.date_start,
          date_end: action.date_end,
          location: action.location,
          status: CalendarEventStatus.Upcoming,
          topic: TopicKey.Calendar,
          concerning: action.concerning,
          created_by: actor,
          created_at: now,
        });
        mutated = true;
        summary = {
          topic: TopicKey.Calendar,
          action_type: action.type,
          lines: [
            `Calendar event recorded: ${action.title} on ${action.date_start.toLocaleString()}.`,
          ],
        };
        break;
      }
      case "reschedule_event": {
        const event = state.calendar.events.find((entry) => entry.id === action.event_id);
        if (event) {
          event.date_start = action.new_start;
          event.date_end = action.new_end ?? event.date_end;
          event.status = CalendarEventStatus.Rescheduled;
          mutated = true;
        }
        break;
      }
      case "cancel_event": {
        const event = state.calendar.events.find((entry) => entry.id === action.event_id);
        if (event) {
          event.status = CalendarEventStatus.Cancelled;
          mutated = true;
        }
        break;
      }
      case "assign_chore": {
        state.chores.active.push({
          id: `chore_${now.getTime()}`,
          task: action.task,
          assigned_to: action.assigned_to,
          assigned_by: actor,
          assigned_in_thread: queueItem.target_thread,
          due: action.due,
          status: ChoreStatus.Pending,
          escalation_step: 0,
        });
        mutated = true;
        break;
      }
      case "complete_chore": {
        const idx = state.chores.active.findIndex((entry) => entry.id === action.chore_id);
        if (idx >= 0) {
          const [active] = state.chores.active.splice(idx, 1);
          if (active) {
            state.chores.completed_recent.unshift({
              id: active.id,
              task: active.task,
              assigned_to: active.assigned_to,
              completed_at: now,
              completed_via: InputMethod.Text,
              response: summarizeContent(queueItem.content),
            });
            mutated = true;
          }
        }
        break;
      }
      case "cancel_chore": {
        const idx = state.chores.active.findIndex((entry) => entry.id === action.chore_id);
        if (idx >= 0) {
          state.chores.active.splice(idx, 1);
          mutated = true;
        }
        break;
      }
      case "log_expense": {
        state.finances.expenses_recent.unshift({
          id: `exp_${now.getTime()}`,
          description: action.description,
          amount: action.amount,
          date: now,
          logged_by: action.logged_by,
          logged_via: InputMethod.Text,
          confirmed: true,
        });
        mutated = true;
        break;
      }
      case "add_items": {
        const addedItems: string[] = [];
        const skippedItems: string[] = [];
        const rebuiltList: typeof state.grocery.list = [];
        const rebuiltNormalized = new Set<string>();
        for (const entry of state.grocery.list) {
          const normalized = normalizeLegacyGroceryItemForStorage(entry.item);
          if (!normalized || rebuiltNormalized.has(normalized)) {
            mutated = true;
            continue;
          }
          rebuiltList.push({ ...entry, item: normalized });
          rebuiltNormalized.add(normalized);
          if (normalized !== entry.item) {
            mutated = true;
          }
        }
        if (rebuiltList.length !== state.grocery.list.length || mutated) {
          state.grocery.list = rebuiltList;
        }

        const existing = new Set(
          state.grocery.list.map((entry) => canonicalizeGroceryItem(entry.item)),
        );
        for (const [index, candidate] of action.items.entries()) {
          const itemName = candidate.item.trim();
          if (itemName.length === 0) {
            continue;
          }
          const normalized = canonicalizeGroceryItem(itemName);
          if (normalized.length === 0) {
            continue;
          }
          if (existing.has(normalized)) {
            skippedItems.push(normalized);
            continue;
          }
          state.grocery.list.push({
            id: `g_${now.getTime()}_${index}`,
            item: normalized,
            section: candidate.section ?? GrocerySection.Other,
            added_by: actor,
            added_at: now,
          });
          existing.add(normalized);
          addedItems.push(normalized);
          mutated = true;
        }
        const lines: string[] = [];
        if (addedItems.length > 0) {
          lines.push(`Added to the grocery list: ${joinNaturalLanguageList(addedItems)}.`);
        }
        if (skippedItems.length > 0) {
          lines.push(`Already on the grocery list: ${joinNaturalLanguageList(skippedItems)}.`);
        }
        summary =
          lines.length > 0
            ? {
                topic: TopicKey.Grocery,
                action_type: action.type,
                lines,
              }
            : null;
        break;
      }
      case "remove_items": {
        const removals = action.item_ids
          .map((item) => canonicalizeGroceryItem(item))
          .filter((item) => item.length > 0);
        if (removals.length > 0) {
          const matchedItems = new Map<string, number>();
          const before = state.grocery.list.length;
          for (const removal of removals) {
            const matchCount = state.grocery.list.filter(
              (entry) => canonicalizeGroceryItem(entry.item) === removal,
            ).length;
            matchedItems.set(removal, matchCount);
          }
          state.grocery.list = state.grocery.list.filter(
            (entry) => !removals.some((removal) => canonicalizeGroceryItem(entry.item) === removal),
          );
          mutated = state.grocery.list.length !== before;
          const removedItems = [...matchedItems.entries()]
            .filter(([, count]) => count > 0)
            .map(([item, count]) => (count > 1 ? `${item} (${count})` : item));
          const unmatchedItems = [...matchedItems.entries()]
            .filter(([, count]) => count === 0)
            .map(([item]) => item);
          const lines: string[] = [];
          if (removedItems.length > 0) {
            lines.push(`Removed from the grocery list: ${joinNaturalLanguageList(removedItems)}.`);
          }
          if (unmatchedItems.length > 0) {
            lines.push(
              `No exact grocery match found for: ${joinNaturalLanguageList(unmatchedItems)}.`,
            );
          }
          summary =
            lines.length > 0
              ? {
                  topic: TopicKey.Grocery,
                  action_type: action.type,
                  lines,
                }
              : null;
        }
        break;
      }
      case "add_appointment": {
        let profile = state.health.profiles.find((entry) => entry.entity === action.entity);
        if (!profile) {
          profile = {
            entity: action.entity,
            medications: [],
            allergies: [],
            providers: [],
            upcoming_appointments: [],
            notes: [],
          };
          state.health.profiles.push(profile);
        }
        profile.upcoming_appointments.push({
          id: `health_${now.getTime()}`,
          entity: action.entity,
          provider_type: action.provider_type,
          date: action.date,
          location: action.location,
        });
        mutated = true;
        break;
      }
      case "log_visit": {
        let profile = state.health.profiles.find((entry) => entry.entity === action.entity);
        if (!profile) {
          profile = {
            entity: action.entity,
            medications: [],
            allergies: [],
            providers: [],
            upcoming_appointments: [],
            notes: [],
          };
          state.health.profiles.push(profile);
        }
        profile.notes.push(action.notes);
        mutated = true;
        break;
      }
      case "log_care": {
        let profile = state.pets.profiles.find((entry) => entry.entity === action.entity);
        if (!profile) {
          profile = {
            entity: action.entity,
            species: "pet",
            vet: null,
            last_vet_visit: now,
            medications: [],
            care_log_recent: [],
            upcoming: [],
            notes: [],
          };
          state.pets.profiles.push(profile);
        }
        profile.care_log_recent.unshift({
          category: action.category ?? PetCareCategory.GeneralCare,
          activity: action.activity,
          by: action.by,
          at: now,
          notes: action.notes,
        });
        mutated = true;
        break;
      }
      case "add_assignment": {
        let student = state.school.students.find((entry) => entry.entity === action.entity);
        if (!student) {
          student = {
            entity: action.entity,
            parent_entity: action.parent_entity,
            assignments: [],
            completed_recent: [],
          };
          state.school.students.push(student);
        }
        student.assignments.push({
          id: `school_${now.getTime()}`,
          title: action.title,
          student_entity: action.entity,
          parent_entity: action.parent_entity,
          due_date: action.due_date,
          status: AssignmentStatus.NotStarted,
          source: action.source,
          parent_notified: false,
        });
        mutated = true;
        summary = {
          topic: TopicKey.School,
          action_type: action.type,
          lines: [
            `School task recorded for ${action.entity}: ${action.title} due ${action.due_date.toLocaleDateString()}.`,
          ],
        };
        break;
      }
      case "create_trip": {
        state.travel.trips.push({
          id: `trip_${now.getTime()}`,
          name: action.name,
          dates: action.dates,
          travelers: action.travelers,
          status: TripStatus.Planning,
          source: action.source,
          checklist: [],
          notes: [],
          budget_link: null,
        });
        mutated = true;
        break;
      }
      case "add_vendor": {
        state.vendors.records.push({
          id: `vendor_${now.getTime()}`,
          name: action.name,
          type: action.vendor_type,
          jobs: [],
          contact: action.contact,
          managed_by: action.managed_by,
          follow_up_pending: false,
        });
        mutated = true;
        break;
      }
      case "add_lead": {
        state.business.leads.push({
          id: `lead_${now.getTime()}`,
          owner: action.owner,
          contact: action.contact,
          client_name: action.client_name,
          inquiry_date: now,
          event_type: action.event_type,
          event_date: action.event_date ?? null,
          event_details: action.event_details,
          status: BusinessLeadStatus.New,
          pipeline_stage: BusinessPipelineStage.Inquiry,
          booking_status: BookingStatus.NotBooked,
          last_contact: now,
          draft_reply: null,
          notes: [],
        });
        mutated = true;
        break;
      }
      case "dispatch_nudge": {
        const selectedNudgeType = selectNextRelationshipNudgeType(state.relationship.nudge_history);
        state.relationship.last_nudge = {
          date: now,
          thread: queueItem.target_thread,
          content: summarizeContent(queueItem.content),
          response_received: false,
          quiet_window_valid: isRelationshipQuietWindow(
            state.relationship.quiet_window ?? {
              is_busy_period: false,
              is_stressful_period: false,
            },
          ),
        };
        state.relationship.nudge_history.unshift({
          date: now,
          type: selectedNudgeType,
          responded: false,
        });
        const baseCooldownDays = state.relationship.cooldown_days ?? 5;
        const effectiveCooldown = computeRelationshipBackoff(
          state.relationship.nudge_history,
          baseCooldownDays,
        );
        state.relationship.next_nudge_eligible = nextRelationshipNudgeEligibleAt(
          now,
          effectiveCooldown,
        );
        mutated = true;
        break;
      }
      case "respond_to_nudge": {
        state.relationship.last_nudge.response_received = action.acknowledged;
        state.relationship.quiet_window = {
          is_busy_period: false,
          is_stressful_period: false,
        };
        const unreplied = state.relationship.nudge_history.find((entry) => !entry.responded);
        if (unreplied) {
          unreplied.responded = action.acknowledged;
        } else {
          state.relationship.nudge_history.unshift({
            date: now,
            type: NudgeType.ConnectionPrompt,
            responded: action.acknowledged,
          });
        }
        const baseResetCooldown = state.relationship.cooldown_days ?? 5;
        state.relationship.next_nudge_eligible = nextRelationshipNudgeEligibleAt(
          now,
          baseResetCooldown,
        );
        mutated = true;
        break;
      }
      case "record_nudge_ignored": {
        const latest = state.relationship.nudge_history.find((entry) => !entry.responded);
        if (latest) {
          latest.ignored = true;
        } else {
          state.relationship.nudge_history.unshift({
            date: action.ignored_at,
            type: NudgeType.ConnectionPrompt,
            responded: false,
            ignored: true,
          });
        }
        state.relationship.last_nudge.response_received = false;
        const baseCooldownDays = state.relationship.cooldown_days ?? 5;
        const effectiveCooldown = computeRelationshipBackoff(
          state.relationship.nudge_history,
          baseCooldownDays,
        );
        state.relationship.next_nudge_eligible = nextRelationshipNudgeEligibleAt(
          now,
          effectiveCooldown,
        );
        mutated = true;
        break;
      }
      case "set_quiet_window": {
        state.relationship.quiet_window = action.quiet_window;
        const baseCooldownDays = state.relationship.cooldown_days ?? 5;
        state.relationship.next_nudge_eligible = nextRelationshipNudgeEligibleAt(
          now,
          baseCooldownDays,
        );
        mutated = true;
        break;
      }
      case "update_status": {
        const next = {
          entity: action.entity,
          status: action.status,
          eta: action.eta ?? null,
          location_snapshot: action.location_snapshot ?? null,
          updated_at: now,
          expires_at: action.expires_at,
        };
        const idx = state.family_status.current.findIndex(
          (entry) => entry.entity === action.entity,
        );
        if (idx >= 0) {
          state.family_status.current[idx] = next;
        } else {
          state.family_status.current.push(next);
        }
        mutated = true;
        summary = {
          topic: TopicKey.FamilyStatus,
          action_type: action.type,
          lines: [`Family status recorded: ${action.status}.`],
        };
        break;
      }
      case "plan_meal": {
        state.meals.planned.push({
          id: `meal_${now.getTime()}`,
          date: action.date,
          meal_type: action.meal_type,
          description: action.description,
          planned_by: action.planned_by,
          status: MealPlanStatus.Planned,
        });
        mutated = true;
        break;
      }
      case "add_asset": {
        state.maintenance.assets.push({
          id: `asset_${now.getTime()}`,
          type: action.asset_type,
          name: action.name,
          details: action.details,
        });
        mutated = true;
        break;
      }
      default:
        break;
    }

    if (mutated) {
      await this.stateService.saveSystemState(state);
    }
    return summary;
  }

  private async composeGroceryListMessage(
    section?: GrocerySection,
    options?: { prefix?: string },
  ): Promise<string> {
    const state = await this.stateService.getSystemState();
    const entries = state.grocery.list.filter((entry) =>
      section ? entry.section === section : true,
    );
    if (entries.length === 0) {
      return section ? `No grocery items in ${section} right now.` : "Your grocery list is empty.";
    }

    const lines = entries.map((entry, index) => `${index + 1}. ${entry.item}`);
    const prefix = options?.prefix ?? (section ? `Grocery list (${section}):` : "Grocery list:");
    return `${prefix}\n${lines.join("\n")}`;
  }

  private participantsForThread(threadId: string): string[] {
    return runtimeSystemConfig.threads.find((thread) => thread.id === threadId)?.participants ?? [];
  }

  private overviewWindow(scope: OverviewScope, referenceAt: Date): QueryTimeWindow {
    if (scope === "tonight") {
      const start = new Date(referenceAt);
      start.setHours(Math.max(start.getHours(), 17), 0, 0, 0);
      return { start, end: endOfLocalDay(referenceAt), label: "tonight" };
    }
    if (scope === "this_week") {
      const start = startOfLocalDay(referenceAt);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: "this week" };
    }
    return { start: startOfLocalDay(referenceAt), end: endOfLocalDay(referenceAt), label: "today" };
  }

  private composeOverviewMessage(
    state: Awaited<ReturnType<StateService["getSystemState"]>>,
    scope: OverviewScope,
    threadId: string,
    referenceAt: Date,
  ): string {
    const window = this.overviewWindow(scope, referenceAt);
    const audience = new Set(this.participantsForThread(threadId));
    const sections: string[] = [];

    const relevantEvents = state.calendar.events
      .filter((event) => event.status !== CalendarEventStatus.Cancelled)
      .filter((event) =>
        event.concerning.some((entity) => audience.size === 0 || audience.has(entity)),
      )
      .filter((event) =>
        dateFallsWithinWindow(event.date_start ?? event.date ?? event.normalized_start, window),
      )
      .sort((left, right) => {
        const leftDate =
          left.date_start?.getTime() ??
          left.date?.getTime() ??
          left.normalized_start?.getTime() ??
          0;
        const rightDate =
          right.date_start?.getTime() ??
          right.date?.getTime() ??
          right.normalized_start?.getTime() ??
          0;
        return leftDate - rightDate;
      });
    if (relevantEvents.length > 0) {
      const lines = relevantEvents.slice(0, 4).map((event) => {
        const at = event.date_start ?? event.date ?? event.normalized_start;
        const timeLabel =
          at instanceof Date
            ? at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : "time TBD";
        return `- ${timeLabel} - ${event.title}`;
      });
      const conflictDetected = relevantEvents.some((event, index) => {
        const current = event.date_start ?? event.date ?? event.normalized_start;
        const next = relevantEvents[index + 1]?.date_start ?? relevantEvents[index + 1]?.date;
        return (
          current instanceof Date && next instanceof Date && current.getTime() === next.getTime()
        );
      });
      sections.push(
        `Schedule\n${lines.join("\n")}${conflictDetected ? "\n- Potential conflict to resolve." : ""}`,
      );
    }

    const dueChores = state.chores.active
      .filter((chore) => audience.size === 0 || audience.has(chore.assigned_to))
      .filter(
        (chore) => dateFallsWithinWindow(chore.due, window) || chore.status === ChoreStatus.Overdue,
      );
    if (dueChores.length > 0) {
      sections.push(
        `Chores\n${dueChores
          .slice(0, 4)
          .map((chore) => `- ${chore.task}`)
          .join("\n")}`,
      );
    }

    const schoolAssignments = state.school.students
      .filter(
        (student) =>
          audience.size === 0 ||
          audience.has(student.entity) ||
          (student.parent_entity ? audience.has(student.parent_entity) : false),
      )
      .flatMap((student) =>
        student.assignments.map((assignment) => ({
          student: student.entity,
          assignment,
        })),
      )
      .filter(({ assignment }) => dateFallsWithinWindow(assignment.due_date, window));
    if (schoolAssignments.length > 0) {
      sections.push(
        `School\n${schoolAssignments
          .slice(0, 4)
          .map(
            ({ student, assignment }) =>
              `- ${student}: ${assignment.title} due ${assignment.due_date.toLocaleDateString()}`,
          )
          .join("\n")}`,
      );
    }

    const statusLines = state.family_status.current
      .filter((entry) => audience.size === 0 || audience.has(entry.entity))
      .map((entry) => `- ${entry.entity}: ${entry.status}`);
    if (statusLines.length > 0) {
      sections.push(`Status\n${statusLines.slice(0, 4).join("\n")}`);
    }

    if (sections.length === 0) {
      return `All clear for ${window.label}. Nothing urgent right now.`;
    }

    return sections.join("\n\n");
  }

  private composeDigestMessage(
    state: Awaited<ReturnType<StateService["getSystemState"]>>,
    threadId: string,
    referenceAt: Date,
  ): string {
    return this.composeOverviewMessage(state, "today", threadId, referenceAt);
  }

  private async composeStateBackedMessage(
    action: TopicAction,
    queueItem: StackQueueItem,
    mutationSummaries: MutationSummary[] = [],
  ): Promise<string | null> {
    const state = await this.stateService.getSystemState();
    const rawSourceMessage = summarizeContent(queueItem.content).trim();
    const normalizedSource = rawSourceMessage.toLowerCase();
    const sourceSentence = sentenceCaseResponse(rawSourceMessage);
    const summaryText = mutationSummaries.flatMap((summary) => summary.lines).join("\n");
    const prependSummary = (body: string): string =>
      summaryText.length > 0 ? `${summaryText}\n${body}` : body;
    const entityLabel = (entityId: string): string => {
      const configured = runtimeSystemConfig.entities.find((entry) => entry.id === entityId);
      return configured?.name ?? entityId;
    };
    switch (action.type) {
      case "query_events": {
        const relevantEvents = state.calendar.events
          .filter((event) => event.status !== CalendarEventStatus.Cancelled)
          .filter((event) =>
            action.filters?.concerning?.length
              ? event.concerning.some((entity) => action.filters?.concerning?.includes(entity))
              : true,
          )
          .filter((event) =>
            action.filters?.date_range
              ? dateFallsWithinWindow(event.date_start ?? event.date ?? event.normalized_start, {
                  start: action.filters.date_range.start,
                  end: action.filters.date_range.end,
                  label: "query",
                })
              : true,
          )
          .sort((left, right) => {
            const leftDate =
              left.date_start?.getTime() ??
              left.date?.getTime() ??
              left.normalized_start?.getTime() ??
              0;
            const rightDate =
              right.date_start?.getTime() ??
              right.date?.getTime() ??
              right.normalized_start?.getTime() ??
              0;
            return leftDate - rightDate;
          });
        const window = buildQueryTimeWindow(rawSourceMessage, queueItem.created_at);
        const weekdayReference = extractWeekdayReference(rawSourceMessage);
        if (relevantEvents.length === 0) {
          if (window?.label === "today") {
            return "No scheduled events for today. Your calendar is clear.";
          }
          if (window?.label === "tonight") {
            return "No scheduled events for tonight. Your calendar is clear.";
          }
          return weekdayReference
            ? `Schedule summary for ${weekdayReference}: no calendar events right now.`
            : "Schedule summary: no calendar events right now.";
        }
        const heading =
          window?.label === "today"
            ? "Today's schedule:"
            : window?.label === "tonight"
              ? "Tonight's schedule:"
              : "Schedule summary (calendar):";
        const conflictDetected = relevantEvents.some((event, index) => {
          const current = event.date_start ?? event.date ?? event.normalized_start;
          const next =
            relevantEvents[index + 1]?.date_start ??
            relevantEvents[index + 1]?.date ??
            relevantEvents[index + 1]?.normalized_start;
          return (
            current instanceof Date && next instanceof Date && current.getTime() === next.getTime()
          );
        });
        return `${heading}\n${relevantEvents
          .slice(0, 8)
          .map((entry, i) => {
            const when =
              entry.date_start instanceof Date
                ? ` (${entry.date_start.toLocaleString()})`
                : entry.date instanceof Date
                  ? ` (${entry.date.toLocaleDateString()})`
                  : "";
            return `${i + 1}. ${entry.title}${when}`;
          })
          .join("\n")}${conflictDetected ? "\n\nPotential conflict to resolve." : ""}`;
      }
      case "create_event":
      case "cancel_event":
      case "reschedule_event": {
        return prependSummary(`Schedule summary (calendar): ${sourceSentence}`);
      }
      case "notify_calendar_change": {
        const when = action.starts_at ? ` on ${action.starts_at.toLocaleString()}` : "";
        const location = action.location ? ` at ${action.location}` : "";
        const audience =
          action.concerning.length > 0
            ? ` for ${action.concerning.map((entityId) => entityLabel(entityId)).join(", ")}`
            : "";
        return `Calendar ${action.change_type}: ${action.title}${when}${location}${audience}.`;
      }
      case "query_chores": {
        const activeChores = state.chores.active.filter((entry) =>
          action.assigned_to ? entry.assigned_to === action.assigned_to : true,
        );
        if (activeChores.length === 0) return "No active chores right now.";
        return `Active chores task list:\n${activeChores
          .slice(0, 8)
          .map((entry, i) => `${i + 1}. ${entry.task}`)
          .join("\n")}`;
      }
      case "assign_chore":
      case "complete_chore":
      case "cancel_chore": {
        if (state.chores.active.length === 0) return "No active chores right now.";
        return `Active chores task list:\n${state.chores.active
          .slice(0, 8)
          .map((entry, i) => `${i + 1}. ${entry.task}`)
          .join("\n")}`;
      }
      case "query_finances": {
        const recentTotal = state.finances.expenses_recent
          .slice(0, 10)
          .reduce((sum, expense) => sum + expense.amount, 0);
        return `Finance snapshot: ${state.finances.bills.length} bills, ${state.finances.expenses_recent.length} recent expenses ($${recentTotal.toFixed(2)} recent total), ${state.finances.savings_goals.length} savings goals.`;
      }
      case "log_expense": {
        const recentTotal = state.finances.expenses_recent
          .slice(0, 10)
          .reduce((sum, expense) => sum + expense.amount, 0);
        return `Finance snapshot: ${state.finances.bills.length} bills, ${state.finances.expenses_recent.length} recent expenses ($${recentTotal.toFixed(2)} recent total), ${state.finances.savings_goals.length} savings goals.`;
      }
      case "query_list":
        return this.composeGroceryListMessage(action.section);
      case "add_items":
        return summaryText.length > 0
          ? summaryText
          : this.composeGroceryListMessage(undefined, { prefix: "Added to grocery list:" });
      case "remove_items":
        return summaryText.length > 0
          ? summaryText
          : this.composeGroceryListMessage(undefined, { prefix: "Updated grocery list:" });
      case "query_health": {
        const profiles = action.entity
          ? state.health.profiles.filter((entry) => entry.entity === action.entity)
          : state.health.profiles;
        if (profiles.length === 0) return "Health summary: no health records found right now.";
        const appointmentLines = profiles.flatMap((profile) =>
          profile.upcoming_appointments.slice(0, 2).map((appointment) => {
            const when =
              appointment.date instanceof Date ? appointment.date.toLocaleString() : "date TBD";
            return `- ${profile.entity}: appointment on ${when}`;
          }),
        );
        if (appointmentLines.length > 0) {
          return `Health summary:\n${appointmentLines.join("\n")}`;
        }
        const noteLines = profiles
          .flatMap((profile) =>
            profile.notes.slice(-1).map((note) => `- ${profile.entity}: ${note}`),
          )
          .slice(0, 4);
        return noteLines.length > 0
          ? `Health summary:\n${noteLines.join("\n")}`
          : "Health summary: no upcoming appointments right now.";
      }
      case "add_appointment":
      case "log_visit": {
        const profiles = action.entity
          ? state.health.profiles.filter((entry) => entry.entity === action.entity)
          : state.health.profiles;
        if (profiles.length === 0) return `Health record: ${sourceSentence}`;
        return `Health record: ${sourceSentence} Upcoming appointments: ${profiles.reduce((n, p) => n + p.upcoming_appointments.length, 0)}.`;
      }
      case "query_pets": {
        const profiles = action.entity
          ? state.pets.profiles.filter((entry) => entry.entity === action.entity)
          : state.pets.profiles;
        if (profiles.length === 0) return "Pet update: no pet records found right now.";
        const lines = profiles.slice(0, 4).map((entry) => {
          const latestCare = entry.care_log_recent[0];
          const latestText =
            latestCare && latestCare.activity
              ? ` latest: ${String(latestCare.activity)}`
              : " no recent care logged";
          const upcomingCount = entry.upcoming.length;
          const upcomingText = upcomingCount > 0 ? `, ${upcomingCount} upcoming item(s)` : "";
          return `- ${entityLabel(entry.entity)}:${latestText}${upcomingText}.`;
        });
        return `Pet update:\n${lines.join("\n")}`;
      }
      case "log_care": {
        const profile = state.pets.profiles.find((entry) => entry.entity === action.entity);
        const recentCount = profile?.care_log_recent.length ?? 0;
        return `Logged for ${entityLabel(action.entity)}: ${action.activity}.${recentCount > 0 ? ` (${recentCount} recent care log entr${recentCount === 1 ? "y" : "ies"})` : ""}`;
      }
      case "query_school": {
        const window = buildQueryTimeWindow(rawSourceMessage, queueItem.created_at);
        const assignments = state.school.students
          .filter((student) => (action.entity ? student.entity === action.entity : true))
          .flatMap((student) =>
            student.assignments
              .filter((assignment) => (action.status ? assignment.status === action.status : true))
              .filter((assignment) => dateFallsWithinWindow(assignment.due_date, window))
              .map((assignment) => ({
                student: student.entity,
                assignment,
              })),
          );
        const communications = state.school.communications
          .filter((communication) =>
            action.entity ? communication.student_entity === action.entity : true,
          )
          .filter((communication) => communication.action_needed);
        if (assignments.length === 0) {
          if (communications.length > 0) {
            return `School summary:\n${communications
              .slice(0, 4)
              .map((communication) => `- ${communication.student_entity}: ${communication.summary}`)
              .join("\n")}`;
          }
          const focus = extractSchoolFocus(rawSourceMessage);
          return focus && focus !== "school"
            ? `School summary: no school assignments or ${focus} items right now.`
            : "School summary: no school assignments right now.";
        }
        return `School summary:\n${assignments
          .slice(0, 8)
          .map(
            ({ student, assignment }, i) =>
              `${i + 1}. ${student}: ${assignment.title} due ${assignment.due_date.toLocaleDateString()}`,
          )
          .join("\n")}`;
      }
      case "add_assignment": {
        const assignments = state.school.students.flatMap((student) => student.assignments);
        if (assignments.length === 0) return "School summary: no school assignments right now.";
        return prependSummary(
          `School summary:\n${assignments
            .slice(0, 8)
            .map((assignment, i) => `${i + 1}. ${assignment.title}`)
            .join("\n")}`,
        );
      }
      case "query_trips": {
        if (state.travel.trips.length === 0) return "Travel summary: no trips planned right now.";
        return `Travel summary:\n${state.travel.trips
          .slice(0, 8)
          .map((trip, i) => {
            const start =
              trip.dates.start instanceof Date
                ? trip.dates.start.toLocaleDateString()
                : "start TBD";
            const end =
              trip.dates.end instanceof Date ? trip.dates.end.toLocaleDateString() : "end TBD";
            return `${i + 1}. ${trip.name} (${trip.status}, ${start} - ${end})`;
          })
          .join("\n")}`;
      }
      case "create_trip": {
        if (state.travel.trips.length === 0) return `Travel summary: ${sourceSentence}`;
        return `Travel summary:\n${state.travel.trips
          .slice(0, 8)
          .map((trip, i) => `${i + 1}. ${trip.name} (${trip.status})`)
          .join("\n")}`;
      }
      case "query_vendors": {
        if (state.vendors.records.length === 0) return "No vendors on file yet.";
        return `Vendors record:\n${state.vendors.records
          .slice(0, 8)
          .map((vendor, i) => `${i + 1}. ${vendor.name}`)
          .join("\n")}`;
      }
      case "add_vendor": {
        if (state.vendors.records.length === 0) return `Vendors record:\n1. ${rawSourceMessage}`;
        return `Vendors record:\n${state.vendors.records
          .slice(0, 8)
          .map((vendor, i) => `${i + 1}. ${vendor.name}`)
          .join("\n")}`;
      }
      case "query_leads": {
        if (state.business.leads.length === 0) return "No leads right now.";
        return `Leads: ${state.business.leads.length} total.`;
      }
      case "add_lead": {
        if (normalizedSource.includes("draft") && normalizedSource.includes("reply")) {
          return `Leads warm client draft reply: ${sourceSentence}`;
        }
        if (state.business.leads.length === 0) return "No leads right now.";
        return `Leads:\n${state.business.leads
          .slice(0, 8)
          .map((lead, i) => `${i + 1}. ${lead.client_name}`)
          .join("\n")}`;
      }
      case "dispatch_nudge": {
        const nudgePrompts: Record<NudgeType, string[]> = {
          [NudgeType.AppreciationPrompt]: [
            "One small thing you appreciated about each other this week?",
            "What's something your partner did recently that made your day a little easier?",
            "Quick appreciation moment: name one thing you're grateful for about each other today.",
          ],
          [NudgeType.ConversationStarter]: [
            "What's something on your mind that you haven't had a chance to share yet this week?",
            "If you could plan a perfect evening together, what would it look like?",
            "What's been making you laugh lately?",
          ],
          [NudgeType.ConnectionPrompt]: [
            "It's been a busy stretch. Five minutes to just check in with each other?",
            "When was the last time you two had a real conversation that wasn't about logistics?",
            "Take a breath together. How are you both really doing?",
          ],
          [NudgeType.DateNightSuggestion]: [
            "When was the last time you had an evening just for the two of you? Even an hour counts.",
            "Date night idea: cook something new together this weekend?",
            "Sometimes connection is just sitting on the couch together without screens. Worth a try tonight?",
          ],
          [NudgeType.GratitudeExercise]: [
            "Try this: each share three things you're grateful for right now. They don't have to be deep.",
            "Gratitude check: what's one thing going well in your life together right now?",
            "Quick gratitude round: one thing about your relationship that you'd never want to change.",
          ],
        };
        const prompts = nudgePrompts[action.nudge_type] ?? nudgePrompts[NudgeType.ConnectionPrompt];
        const prompt =
          prompts[state.relationship.nudge_history.length % prompts.length] ?? prompts[0];
        return prompt;
      }
      case "query_nudge_history": {
        if (state.relationship.nudge_history.length === 0)
          return "Couple calendar reminder summary: no relationship nudges in history.";
        return `Couple reminder history: ${state.relationship.nudge_history.length} relationship item(s).`;
      }
      case "record_nudge_ignored":
      case "set_quiet_window": {
        return "Understood. I will keep relationship nudges quiet for now.";
      }
      case "query_status": {
        if (action.entity === "__digest__") {
          return this.composeDigestMessage(state, queueItem.target_thread, queueItem.created_at);
        }
        if (action.entity?.startsWith("__overview__:")) {
          const scope = action.entity.slice("__overview__:".length);
          if (scope === "today" || scope === "tonight" || scope === "this_week") {
            return this.composeOverviewMessage(
              state,
              scope,
              queueItem.target_thread,
              queueItem.created_at,
            );
          }
        }
        if (action.entity === "__ingest__") {
          const processed = [
            ...state.data_ingest_state.email_monitor.processed.slice(-3),
            ...state.data_ingest_state.forwarded_messages.processed.slice(-3),
            ...state.data_ingest_state.calendar_sync.processed.slice(-3),
          ]
            .sort((left, right) => left.received_at.getTime() - right.received_at.getTime())
            .slice(-6);
          if (processed.length === 0) {
            return "I have not ingested anything recently.";
          }
          return `Here is what I processed recently:\n${processed
            .map((entry) => {
              const origin = entry.origin ?? "unknown";
              const topic = entry.topic_classified ?? "unclassified";
              const status = entry.status ?? "processed";
              return `- ${origin}: ${topic} (${status})`;
            })
            .join("\n")}`;
        }
        if (action.entity?.startsWith("__dispatch_reason__:")) {
          const threadId = action.entity.slice("__dispatch_reason__:".length);
          const recentForThread = state.queue.recently_dispatched.filter(
            (entry) => entry.target_thread === threadId,
          );
          const latest = recentForThread[0];
          if (!latest) {
            return "I have not sent anything to this thread recently.";
          }
          const pendingCount = state.queue.pending.filter(
            (entry) => entry.target_thread === threadId,
          ).length;
          return `I recently checked in with this thread about ${latest.topic}.${pendingCount > 0 ? ` I am also holding ${pendingCount} item(s) for later here.` : ""}`;
        }
        if (action.entity?.startsWith("__held__:")) {
          const threadId = action.entity.slice("__held__:".length);
          const heldItems = state.queue.pending.filter((entry) => entry.target_thread === threadId);
          if (heldItems.length === 0) {
            return "I am not holding anything for later in this thread.";
          }
          return `I am holding these for later:\n${heldItems
            .slice(0, 6)
            .map((entry) => {
              const holdUntil =
                entry.hold_until instanceof Date ? entry.hold_until.toLocaleString() : "later";
              const topic = entry.topic ?? TopicKey.FamilyStatus;
              return `- ${topic} until ${holdUntil}`;
            })
            .join("\n")}`;
        }
        if (state.family_status.current.length === 0) {
          return "Family status summary: no current family status entries.";
        }
        return `Family status summary:\n${state.family_status.current
          .map((entry, i) => `${i + 1}. ${entry.entity}: ${entry.status}`)
          .join("\n")}`;
      }
      case "update_status": {
        if (state.family_status.current.length === 0)
          return prependSummary(`Family status recorded: ${sourceSentence}`);
        return prependSummary(
          `Family status recorded:\n${state.family_status.current
            .map((entry, i) => `${i + 1}. ${entry.entity}: ${entry.status}`)
            .join("\n")}`,
        );
      }
      case "query_plans": {
        if (state.meals.planned.length === 0) return "Meal list: no meal plans right now.";
        return `Meal list:\n${state.meals.planned
          .slice(0, 8)
          .map((plan, i) => `${i + 1}. ${plan.description}`)
          .join("\n")}`;
      }
      case "plan_meal": {
        if (state.meals.planned.length === 0) return `Meal list:\n1. ${rawSourceMessage}`;
        return `Meal list:\n${state.meals.planned
          .slice(0, 8)
          .map((plan, i) => `${i + 1}. ${plan.description}`)
          .join("\n")}`;
      }
      case "query_maintenance": {
        if (state.maintenance.items.length === 0) return "No maintenance items right now.";
        return `Maintenance record summary:\n${state.maintenance.items
          .slice(0, 6)
          .map((item, i) => {
            const due =
              item.next_due instanceof Date ? item.next_due.toLocaleDateString() : "due date TBD";
            return `${i + 1}. ${item.task} (${due})`;
          })
          .join("\n")}`;
      }
      case "add_asset": {
        if (state.maintenance.assets.length === 0)
          return `Maintenance record:\n1. ${rawSourceMessage}`;
        return `Maintenance record:\n${state.maintenance.assets
          .slice(0, 8)
          .map((asset, i) => `${i + 1}. ${asset.name}`)
          .join("\n")}`;
      }
      default:
        return null;
    }
  }

  private async handleConfirmation(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    identity: IdentityResolutionResult,
    action: TopicAction,
    targetThread: string,
    prefaceLines: string[] = [],
  ): Promise<
    | { kind: "none"; metadata: Record<string, unknown>; resolution?: undefined }
    | {
        kind: "resolved_reply";
        metadata: Record<string, unknown>;
        resolution: ConfirmationResult;
        approved_action_payload?: TopicAction;
      }
    | { kind: "confirmation_prompted"; metadata: Record<string, unknown> }
  > {
    const replyResolution = await this.confirmationService.resolveFromQueueItem(queueItem);
    if (replyResolution) {
      return {
        kind: "resolved_reply",
        metadata: { result: replyResolution.result },
        resolution: replyResolution.result,
        approved_action_payload:
          replyResolution.result === ConfirmationResult.Approved
            ? replyResolution.requested_action_payload
            : undefined,
      };
    }

    const confirmationType = this.confirmationTypeForAction(action);
    if (!confirmationType) {
      return { kind: "none", metadata: {} };
    }

    const approvalThreadPolicy = this.confirmationApprovalPolicyForAction(
      confirmationType,
      queueItem,
      targetThread,
    );
    const confirmation = await this.confirmationService.openConfirmation({
      type: confirmationType,
      action: action.type,
      requested_action_payload: action,
      requested_by: queueItem.concerning[0] ?? getDefaultHumanEntityId(),
      requested_in_thread: targetThread,
      origin_thread: queueItem.target_thread,
      approval_thread_policy: approvalThreadPolicy,
      expires_at: new Date(
        queueItem.created_at.getTime() + this.config.clarification_timeout_minutes * 60_000,
      ),
    });
    const requesterPrivateThread = resolveRequesterPrivateThread(
      queueItem.concerning[0] ?? getDefaultHumanEntityId(),
    );
    const actionSummary =
      action.type === "log_expense" && typeof action.description === "string"
        ? `log expense for ${action.description}`
        : action.type.replaceAll("_", " ");
    const prompt =
      approvalThreadPolicy === "requester_private_allowed" &&
      requesterPrivateThread &&
      requesterPrivateThread !== targetThread
        ? `Approval needed: please confirm ${actionSummary}. Reply yes or no here or in your private thread.`
        : `Approval needed: please confirm ${actionSummary}. Reply yes or no.`;
    const combinedPrompt =
      prefaceLines.length > 0 ? `${prefaceLines.join("\n")}\n${prompt}` : prompt;
    await this.persistSystemDispatch({
      queue_item: queueItem,
      classification,
      identity,
      target_thread: targetThread,
      content: combinedPrompt,
      reason: "confirmation prompt",
    });
    return {
      kind: "confirmation_prompted",
      metadata: {
        confirmation_id: confirmation.id,
        target_thread: targetThread,
        approval_thread_policy: approvalThreadPolicy,
      },
    };
  }

  private confirmationApprovalPolicyForAction(
    confirmationType: ConfirmationActionType,
    queueItem: StackQueueItem,
    targetThread: string,
  ): ConfirmationApprovalThreadPolicy {
    if (
      confirmationType === ConfirmationActionType.SendingOnBehalf &&
      !targetThread.endsWith("_private") &&
      resolveRequesterPrivateThread(queueItem.concerning[0] ?? getDefaultHumanEntityId()) !== null
    ) {
      return "requester_private_allowed";
    }
    return "exact_thread";
  }

  private confirmationTypeForAction(action: TopicAction): ConfirmationActionType | null {
    if ("requires_confirmation" in action && action.requires_confirmation === true) {
      return ConfirmationActionType.FinancialAction;
    }
    if (action.type === "stage_client_draft" || action.type === "approve_client_draft") {
      return ConfirmationActionType.SendingOnBehalf;
    }
    if (
      [
        "add_data_source",
        "modify_dispatch_rules",
        "change_escalation_timing",
        "add_entity",
      ].includes(action.type)
    ) {
      return ConfirmationActionType.SystemChange;
    }
    return null;
  }

  private async enqueueCrossTopicEvents(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    profile: TopicProfile,
    determined: DeterminedAction,
  ): Promise<void> {
    if (queueItem.source === QueueItemSource.CrossTopic) {
      return;
    }
    if (classification.intent === ClassifierIntent.Query) {
      return;
    }
    if (profile.cross_topic_connections.length === 0) {
      return;
    }
    const sourceId = extractQueueItemId(queueItem);

    const enqueuePromises: Promise<void>[] = [];
    for (const targetTopic of profile.cross_topic_connections) {
      const content = this.buildCrossTopicContent(classification.topic, targetTopic, determined);
      if (content === null) {
        continue;
      }
      const crossTopicRef = `${sourceId}__to__${targetTopic}`;

      enqueuePromises.push(
        this.queueService.enqueue({
          id: crossTopicRef,
          source: QueueItemSource.CrossTopic,
          content,
          concerning: classification.concerning,
          target_thread: queueItem.target_thread,
          created_at: queueItem.created_at,
          topic: targetTopic,
          intent: ClassifierIntent.Request,
          idempotency_key: crossTopicRef,
        }),
      );
    }

    await Promise.all(enqueuePromises);
  }

  private buildCrossTopicContent(
    sourceTopic: TopicKey,
    targetTopic: TopicKey,
    determined: DeterminedAction,
  ): string | null {
    if (sourceTopic === TopicKey.Meals && targetTopic === TopicKey.Grocery) {
      const description =
        "description" in determined.typed_action ? String(determined.typed_action.description) : "";
      const items = extractGroceryItemsFromMealDescription(description);
      return items.length > 0 ? items.join(", ") : null;
    }

    if (sourceTopic === TopicKey.Calendar && targetTopic === TopicKey.School) {
      if ("title" in determined.typed_action && typeof determined.typed_action.title === "string") {
        return `Calendar-linked school event: ${determined.typed_action.title}`;
      }
      return "Calendar update relevant to school schedule.";
    }

    if (sourceTopic === TopicKey.Calendar && targetTopic === TopicKey.Health) {
      if ("title" in determined.typed_action && typeof determined.typed_action.title === "string") {
        return `Calendar-linked health appointment: ${determined.typed_action.title}`;
      }
      return "Calendar update relevant to health tracking.";
    }

    if (sourceTopic === TopicKey.Health && targetTopic === TopicKey.Calendar) {
      if ("date" in determined.typed_action) {
        return "Create or update a calendar appointment tied to the health record.";
      }
      return "Health follow-up may require a calendar reminder.";
    }

    if (sourceTopic === TopicKey.Travel && targetTopic === TopicKey.Calendar) {
      if ("name" in determined.typed_action && typeof determined.typed_action.name === "string") {
        return `Travel itinerary checkpoint for ${determined.typed_action.name}`;
      }
      return "Travel update that should be reflected on the calendar.";
    }

    if (sourceTopic === TopicKey.Travel && targetTopic === TopicKey.Grocery) {
      return "Travel prep groceries reminder (snacks, toiletries, trip supplies).";
    }

    if (sourceTopic === TopicKey.Maintenance && targetTopic === TopicKey.Vendors) {
      if ("name" in determined.typed_action && typeof determined.typed_action.name === "string") {
        return `Maintenance task may require a vendor for ${determined.typed_action.name}`;
      }
      return "Maintenance update that may require vendor follow-up.";
    }

    if (sourceTopic === TopicKey.Maintenance && targetTopic === TopicKey.Finances) {
      return "Maintenance update likely to impact expenses/budget.";
    }

    // Only emit explicit cross-topic payloads. Generic placeholders create noisy
    // follow-up clarifications in downstream topics without actionable context.
    return null;
  }

  private resolveRoutingDecision(request: {
    topic: TopicKey;
    intent: ClassifierIntent;
    concerning: string[];
    origin_thread: string;
    is_response: boolean;
  }): RoutingDecision {
    const decision = this.routingService.resolveRoutingDecision(request);
    if (request.is_response && this.shouldCreateFollowUpTarget(request.intent)) {
      const followUpTarget = this.routingService.resolveRoutingDecision({
        ...request,
        is_response: false,
      }).target;
      const dedupeKey = `${request.topic}:${[...request.concerning].sort().join(",")}:${request.origin_thread}:${followUpTarget.thread_id}`;
      return {
        ...decision,
        follow_up_target: followUpTarget,
        reply_policy:
          followUpTarget.thread_id === request.origin_thread
            ? {
                action: "suppress_duplicate",
                dedupe_key: dedupeKey,
                cooldown_seconds: 20 * 60,
                reason: "Follow-up target matches origin thread; duplicate notice suppressed.",
              }
            : {
                action: "notify_there",
                dedupe_key: dedupeKey,
                cooldown_seconds: 20 * 60,
                reason: "Primary reply stays here; concise notice may be sent to paired thread.",
              },
      };
    }
    return decision;
  }

  private shouldCreateFollowUpTarget(intent: ClassifierIntent): boolean {
    return ![ClassifierIntent.Query, ClassifierIntent.Confirmation].includes(intent);
  }

  private resolveImageAction(
    classification: StackClassificationResult,
    actor: string,
  ): DeterminedAction | null {
    const extraction = classification.image_extraction;
    if (!extraction) return null;

    switch (extraction.type) {
      case "receipt": {
        const amount = parseFloat(extraction.extracted_fields.amount?.replace(/,/gu, "") ?? "0");
        if (amount <= 0) return null;
        return {
          is_response: true,
          typed_action: {
            type: "log_expense",
            description: extraction.extracted_fields.vendor
              ? `Receipt from ${extraction.extracted_fields.vendor}`
              : "Receipt photo expense",
            amount,
            logged_by: actor,
            requires_confirmation: true,
          },
        };
      }
      case "school_flyer":
        return {
          is_response: true,
          typed_action: {
            type: "add_assignment",
            entity: this.getFirstEntityIdByType(EntityType.Child) ?? actor,
            parent_entity: actor,
            title: "School notice (from photo)",
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60_000),
            source: SchoolInputSource.Conversation,
          },
        };
      case "maintenance_photo":
        return {
          is_response: true,
          typed_action: {
            type: "add_asset",
            asset_type: MaintenanceAssetType.Home,
            name: "Maintenance item (from photo)",
            details: extraction.extracted_fields,
          },
        };
      default:
        return null;
    }
  }

  private isParticipantInitiatedSource(source: QueueItemSource): boolean {
    return (
      source === QueueItemSource.HumanMessage ||
      source === QueueItemSource.Reaction ||
      source === QueueItemSource.ForwardedMessage ||
      source === QueueItemSource.ImageAttachment
    );
  }

  private async routeToAction(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    identity: IdentityResolutionResult,
    routingDecision: RoutingDecision,
    budget: BudgetDecision,
    composedMessage: string,
  ): Promise<ActionRouterResult> {
    const deliveryConcerning = this.normalizeConcerningForDelivery(queueItem.concerning);
    if (this.actionRouter) {
      const routedQueueItem: StackQueueItem = {
        ...queueItem,
        target_thread: routingDecision.target.thread_id,
        priority: budget.priority,
      };
      const candidateAction: ActionRouterResult =
        budget.priority === DispatchPriority.Silent
          ? this.toStoreAction(routedQueueItem, budget.reason)
          : budget.priority === DispatchPriority.Batched
            ? this.toHoldAction(
                routedQueueItem,
                budget.hold_until ?? new Date(queueItem.created_at.getTime() + 30 * 60 * 1000),
                budget.reason,
              )
            : {
                decision: "dispatch",
                outbound: {
                  target_thread: routingDecision.target.thread_id,
                  content: composedMessage,
                  priority: budget.priority,
                  concerning: deliveryConcerning,
                },
              };
      const workerDecision: WorkerDecision = {
        queue_item: routedQueueItem,
        classification,
        identity,
        action: candidateAction,
      };
      const routedAction = await this.actionRouter.route(workerDecision, toCollisionPolicy());
      return this.enforceDispatchPolicy(queueItem, classification, routedAction, routingDecision);
    }

    if (budget.priority === DispatchPriority.Silent) {
      return this.toStoreAction(
        { ...queueItem, target_thread: routingDecision.target.thread_id },
        budget.reason,
      );
    }
    if (budget.priority === DispatchPriority.Batched) {
      return this.toHoldAction(
        { ...queueItem, target_thread: routingDecision.target.thread_id },
        budget.hold_until ?? new Date(queueItem.created_at.getTime() + 30 * 60 * 1000),
        budget.reason,
      );
    }
    return this.enforceDispatchPolicy(
      queueItem,
      classification,
      {
        decision: "dispatch",
        outbound: {
          target_thread: routingDecision.target.thread_id,
          content: composedMessage,
          priority: budget.priority,
          concerning: deliveryConcerning,
        },
      },
      routingDecision,
    );
  }

  private enforceDispatchPolicy(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    action: ActionRouterResult,
    routingDecision: RoutingDecision,
  ): ActionRouterResult {
    if (action.decision !== "dispatch") {
      return action;
    }

    const deliveryKind =
      routingDecision.target.rule_applied === RoutingRule.ResponseInPlace
        ? "response"
        : "proactive";
    const targetThread = action.outbound.target_thread;
    const deliveryConcerning = this.normalizeConcerningForDelivery(queueItem.concerning);
    if (
      isThreadAllowedForTopicDelivery({
        topic: classification.topic,
        thread_id: targetThread,
        concerning: deliveryConcerning,
        delivery_kind: deliveryKind,
      })
    ) {
      return action;
    }

    const safePrivateThread = this.resolveSafePrivateThread(deliveryConcerning);
    if (
      safePrivateThread &&
      safePrivateThread !== targetThread &&
      isThreadAllowedForTopicDelivery({
        topic: classification.topic,
        thread_id: safePrivateThread,
        concerning: deliveryConcerning,
        delivery_kind: deliveryKind,
      })
    ) {
      this.logger.warn(
        {
          queue_item_id: extractQueueItemId(queueItem),
          topic: classification.topic,
          blocked_thread: targetThread,
          rerouted_thread: safePrivateThread,
        },
        "Outbound rerouted to a safer private thread by topic delivery policy.",
      );
      return {
        decision: "dispatch",
        outbound: {
          ...action.outbound,
          target_thread: safePrivateThread,
        },
      };
    }

    this.logger.warn(
      {
        queue_item_id: extractQueueItemId(queueItem),
        topic: classification.topic,
        blocked_thread: targetThread,
      },
      "Outbound blocked by topic delivery policy.",
    );
    return this.toStoreAction(
      { ...queueItem, target_thread: targetThread },
      `Outbound blocked by topic delivery policy for ${classification.topic}.`,
    );
  }

  private resolveSafePrivateThread(concerning: string[]): string | null {
    if (concerning.length !== 1) {
      return null;
    }
    const only = concerning[0];
    if (!only) {
      return null;
    }
    const candidate = `${only}_private`;
    return runtimeSystemConfig.threads.some((thread) => thread.id === candidate) ? candidate : null;
  }

  private async persistSystemDispatch(input: {
    queue_item: StackQueueItem;
    classification: StackClassificationResult;
    identity: IdentityResolutionResult;
    target_thread: string;
    content: string;
    reason: string;
  }): Promise<void> {
    const routingDecision: RoutingDecision = {
      target: {
        thread_id: input.target_thread,
        rule_applied:
          input.classification.intent === ClassifierIntent.Query
            ? RoutingRule.ResponseInPlace
            : RoutingRule.ProactiveNarrowest,
        reason: input.reason,
      },
    };
    const budget: BudgetDecision = {
      priority: DispatchPriority.Immediate,
      reason: input.reason,
    };
    const action = await this.routeToAction(
      input.queue_item,
      input.classification,
      input.identity,
      routingDecision,
      budget,
      input.content,
    );

    if (action.decision !== "dispatch") {
      const forcedDispatch: ActionRouterResult = {
        decision: "dispatch",
        outbound: {
          target_thread: input.target_thread,
          content: input.content,
          priority: DispatchPriority.Immediate,
          concerning: input.queue_item.concerning,
        },
      };
      await this.persistOutcome(
        input.queue_item,
        input.classification,
        forcedDispatch,
        input.content,
        routingDecision,
        budget,
      );
      return;
    }

    await this.persistOutcome(
      input.queue_item,
      input.classification,
      action,
      input.content,
      routingDecision,
      budget,
    );
  }

  private async persistOutcome(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    action: ActionRouterResult,
    composedMessage: string,
    routingDecision: RoutingDecision,
    budget: BudgetDecision,
  ): Promise<void> {
    await this.appendInboundHistory(queueItem, classification.topic);
    if (action.decision === "dispatch") {
      await this.transportService.sendOutbound(action.outbound);
      await this.budgetService.recordDispatch(
        { ...queueItem, target_thread: action.outbound.target_thread },
        this.now(),
      );
      await this.stateService.appendDispatchResult(
        { ...queueItem, target_thread: action.outbound.target_thread },
        action,
      );
      await this.appendOutboundHistory(
        action.outbound.target_thread,
        composedMessage,
        classification.topic,
      );
      await this.maybeDispatchFollowUpThreadNotice(
        queueItem,
        classification,
        action.outbound.target_thread,
        routingDecision,
      );
      this.logger.info(
        {
          queue_item_id: extractQueueItemId(queueItem),
          target_thread: action.outbound.target_thread,
          follow_up_target: routingDecision.follow_up_target?.thread_id,
          budget_priority: budget.priority,
        },
        "Worker dispatched outbound message.",
      );
      return;
    }

    await this.stateService.appendDispatchResult(
      { ...queueItem, target_thread: routingDecision.target.thread_id },
      action,
    );
  }

  private async appendInboundHistory(queueItem: StackQueueItem, topic: TopicKey): Promise<void> {
    const history = await this.stateService.getThreadHistory(queueItem.target_thread);
    const recent = history?.recent_messages ?? [];
    recent.push({
      id: extractQueueItemId(queueItem),
      from: "participant",
      content: summarizeContent(queueItem.content),
      at: queueItem.created_at,
      topic_context: topic,
      state_ref: extractQueueItemId(queueItem),
    });
    await this.stateService.saveThreadHistory(queueItem.target_thread, {
      active_topic_context: topic,
      last_activity: queueItem.created_at,
      recent_messages: recent.slice(-HISTORY_LIMIT),
      pending_clarification: history?.pending_clarification ?? null,
    });
  }

  private async appendOutboundHistory(
    threadId: string,
    content: string,
    topic: TopicKey,
  ): Promise<void> {
    const history = await this.stateService.getThreadHistory(threadId);
    const recent = history?.recent_messages ?? [];
    recent.push({
      id: `dispatch_${Date.now()}`,
      from: "assistant",
      content,
      at: this.now(),
      topic_context: topic,
    });
    await this.stateService.saveThreadHistory(threadId, {
      active_topic_context: topic,
      last_activity: this.now(),
      recent_messages: recent.slice(-HISTORY_LIMIT),
      pending_clarification: history?.pending_clarification ?? null,
    });
  }

  private async savePendingClarificationSession(
    threadId: string,
    session: PendingClarificationSession,
  ): Promise<void> {
    const history = await this.stateService.getThreadHistory(threadId);
    await this.stateService.saveThreadHistory(threadId, {
      active_topic_context: history?.active_topic_context ?? session.topic,
      last_activity: history?.last_activity ?? session.requested_at,
      recent_messages: history?.recent_messages ?? [],
      pending_clarification: session,
    });
  }

  private async clearPendingClarificationSession(threadId: string): Promise<void> {
    const history = await this.stateService.getThreadHistory(threadId);
    if (!history?.pending_clarification) {
      return;
    }
    await this.stateService.saveThreadHistory(threadId, {
      ...history,
      pending_clarification: null,
    });
  }

  private static readonly SHARED_AWARENESS_TOPICS = new Set<TopicKey>([
    TopicKey.Calendar,
    TopicKey.Chores,
    TopicKey.Finances,
    TopicKey.Grocery,
    TopicKey.Meals,
    TopicKey.Travel,
    TopicKey.Maintenance,
  ]);

  private static readonly SHARED_AWARENESS_INTENTS = new Set<ClassifierIntent>([
    ClassifierIntent.Request,
    ClassifierIntent.Update,
    ClassifierIntent.Cancellation,
    ClassifierIntent.Completion,
  ]);

  private async maybeDispatchFollowUpThreadNotice(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    primaryTargetThread: string,
    routingDecision: RoutingDecision,
  ): Promise<void> {
    if (
      !this.isParticipantInitiatedSource(queueItem.source) ||
      classification.intent === ClassifierIntent.Query ||
      classification.intent === ClassifierIntent.Confirmation
    ) {
      return;
    }

    const isPrivateOrigin = primaryTargetThread.endsWith("_private");

    if (isPrivateOrigin) {
      await this.maybeDispatchSharedAwareness(queueItem, classification, primaryTargetThread);
      return;
    }

    if (routingDecision.reply_policy?.action !== "notify_there") {
      return;
    }
    const followUpThread = routingDecision.follow_up_target?.thread_id;
    if (!followUpThread || followUpThread === primaryTargetThread) {
      return;
    }

    const state = await this.stateService.getSystemState();
    const now = this.now();
    const cooldownMs = (routingDecision.reply_policy?.cooldown_seconds ?? 20 * 60) * 1000;
    const dedupeKey = routingDecision.reply_policy?.dedupe_key;
    const hasRecentNotice = state.queue.recently_dispatched.some(
      (record) =>
        record.target_thread === followUpThread &&
        record.topic === TopicKey.FamilyStatus &&
        now.getTime() - record.dispatched_at.getTime() <= cooldownMs &&
        record.content.toLowerCase().includes("follow-up will stay in this thread"),
    );
    if (hasRecentNotice) {
      return;
    }

    const notice = "Quick note: follow-up will stay in this thread to avoid duplicate alerts.";
    const outbound: DispatchAction = {
      decision: "dispatch",
      outbound: {
        target_thread: followUpThread,
        content: notice,
        priority: DispatchPriority.Batched,
        concerning: queueItem.concerning,
      },
    };
    await this.transportService.sendOutbound(outbound.outbound);
    await this.stateService.appendDispatchResult(
      { ...queueItem, target_thread: followUpThread, topic: TopicKey.FamilyStatus },
      outbound,
    );
    await this.appendOutboundHistory(followUpThread, notice, TopicKey.FamilyStatus);
    this.logger.debug(
      {
        queue_item_id: extractQueueItemId(queueItem),
        follow_up_thread: followUpThread,
        dedupe_key: dedupeKey,
      },
      "Sent follow-up thread notice with reply policy dedupe metadata.",
    );
  }

  private async maybeDispatchSharedAwareness(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    privateThread: string,
  ): Promise<void> {
    if (!Worker.SHARED_AWARENESS_TOPICS.has(classification.topic)) {
      return;
    }
    const policy = getTopicDeliveryPolicy(classification.topic);
    if (policy.awareness_policy === "none") {
      return;
    }
    if (!Worker.SHARED_AWARENESS_INTENTS.has(classification.intent)) {
      return;
    }

    const narrowestShared = this.resolveNarrowestSharedThread(queueItem.concerning);
    if (!narrowestShared || narrowestShared === privateThread) {
      return;
    }

    const state = await this.stateService.getSystemState();
    const now = this.now();
    const cooldownMs = 20 * 60 * 1000;
    const dedupeKey = `awareness:${classification.topic}:${[...queueItem.concerning].sort().join(",")}`;
    const hasRecentAwareness = state.queue.recently_dispatched.some(
      (record) =>
        record.target_thread === narrowestShared &&
        now.getTime() - record.dispatched_at.getTime() <= cooldownMs &&
        record.content.toLowerCase().includes("update:"),
    );
    if (hasRecentAwareness) {
      return;
    }
    if (
      !isThreadAllowedForTopicDelivery({
        topic: classification.topic,
        thread_id: narrowestShared,
        concerning: queueItem.concerning,
        delivery_kind: "awareness",
      })
    ) {
      return;
    }

    const topicLabel =
      runtimeSystemConfig.topics[classification.topic]?.label ?? classification.topic;
    const intentLabel =
      classification.intent === ClassifierIntent.Cancellation
        ? "cancelled"
        : classification.intent === ClassifierIntent.Completion
          ? "completed"
          : "updated";
    const notice = `${topicLabel} update: an item was ${intentLabel}.`;

    const outbound: DispatchAction = {
      decision: "dispatch",
      outbound: {
        target_thread: narrowestShared,
        content: notice,
        priority: DispatchPriority.Batched,
        concerning: queueItem.concerning,
      },
    };
    await this.transportService.sendOutbound(outbound.outbound);
    await this.stateService.appendDispatchResult(
      { ...queueItem, target_thread: narrowestShared, topic: classification.topic },
      outbound,
    );
    await this.appendOutboundHistory(narrowestShared, notice, classification.topic);
    this.logger.debug(
      {
        queue_item_id: extractQueueItemId(queueItem),
        private_thread: privateThread,
        awareness_thread: narrowestShared,
        dedupe_key: dedupeKey,
      },
      "Dispatched shared awareness notice from private-origin action.",
    );
  }

  private resolveNarrowestSharedThread(concerning: string[]): string | null {
    const sharedThreads = runtimeSystemConfig.threads
      .filter((thread) => thread.type === ThreadType.Shared)
      .filter((thread) => concerning.every((entity) => thread.participants.includes(entity)))
      .sort((a, b) => a.participants.length - b.participants.length);
    return sharedThreads[0]?.id ?? null;
  }

  private async dispatchClarification(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    identity: IdentityResolutionResult,
    clarification: ClarificationRequest,
  ): Promise<ClarificationDispatch> {
    const targetThread = await this.routingService.resolveTargetThread({
      topic: classification.topic,
      intent: ClassifierIntent.Query,
      concerning: queueItem.concerning,
      origin_thread: queueItem.target_thread,
      is_response: true,
    });
    await this.persistSystemDispatch({
      queue_item: queueItem,
      classification,
      identity,
      target_thread: targetThread,
      content: clarification.message_to_participant,
      reason: "clarification prompt",
    });
    await this.savePendingClarificationSession(targetThread, {
      original_queue_item_id: clarification.original_queue_item_id,
      topic: classification.topic,
      intent: classification.intent,
      reason: clarification.reason,
      message_to_participant: clarification.message_to_participant,
      requested_at: this.now(),
      source_thread: targetThread,
      source_entity_id: identity.source_entity_id,
      source_concerning: queueItem.concerning,
      source_message: summarizeContent(queueItem.content),
      context: clarification.context,
    });
    return { clarification, routing_target: targetThread };
  }

  private isClarificationDispatch(
    value: DeterminedAction | ClarificationDispatch,
  ): value is ClarificationDispatch {
    return "clarification" in value;
  }

  private toStoreAction(queueItem: StackQueueItem, reason: string): StoreAction {
    return {
      decision: "store",
      queue_item: queueItem,
      reason,
    };
  }

  private toHoldAction(queueItem: StackQueueItem, holdUntil: Date, reason: string): HoldAction {
    return {
      decision: "hold",
      queue_item: queueItem,
      hold_until: holdUntil,
      reason,
    };
  }

  private toOutcome(action: ActionRouterResult): ProcessingOutcome {
    switch (action.decision) {
      case "dispatch":
        return "dispatched";
      case "hold":
        return "held";
      case "store":
        return "stored";
    }
  }

  private isStale(queueItem: StackQueueItem): boolean {
    const ageMs = this.now().getTime() - queueItem.created_at.getTime();
    const staleByAge = ageMs > this.config.stale_after_hours * 60 * 60 * 1000;
    if (!staleByAge) {
      return false;
    }
    const content = summarizeContent(queueItem.content).toLowerCase();
    if (
      content.includes("in 30 minutes") ||
      content.includes("today") ||
      content.includes("pickup")
    ) {
      return true;
    }
    return queueItem.source !== QueueItemSource.HumanMessage;
  }

  private async traceStep<T>(
    steps: ProcessingTraceStep[],
    step: number,
    action: WorkerAction,
    service: WorkerService | undefined,
    inputSummary: string,
    run: () => Promise<T>,
    summarize: (output: T) => { output_summary: string; metadata?: Record<string, unknown> },
  ): Promise<T> {
    const startedAt = this.now().getTime();
    const output = await run();
    const finishedAt = this.now().getTime();
    const summary = summarize(output);
    steps.push({
      step,
      action,
      service,
      input_summary: inputSummary,
      output_summary: summary.output_summary,
      duration_ms: finishedAt - startedAt,
      metadata: summary.metadata,
    });
    return output;
  }
}

export function createWorker(options: WorkerOptions): Worker {
  return new Worker(options);
}

export function createWorkerIdentityService(): WorkerIdentityService {
  return {
    resolve(item: StackQueueItem): Promise<IdentityResolutionResult> {
      const identity = createIdentityService();
      const firstEntity = item.concerning[0] ?? getDefaultHumanEntityId();
      const entity = identity.getEntity(firstEntity);
      return Promise.resolve({
        source_entity_id: firstEntity,
        source_entity_type: entity?.type ?? "adult",
        thread_id: item.target_thread,
        concerning: item.concerning,
      });
    },
  };
}
