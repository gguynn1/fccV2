import { pino, type Logger } from "pino";

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
import type { RoutingDecision } from "../../02-supporting-services/05-routing-service/types.js";
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
  type TransportOutboundEnvelope,
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
}

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

function toCollisionPolicy(): CollisionPolicy {
  return {
    precedence_order: runtimeSystemConfig.dispatch.collision_avoidance.precedence_order,
    same_precedence_strategy: SamePrecedenceStrategy.Batch,
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
        meridiem === "pm"
          ? (hourRaw % 12) + 12
          : meridiem === "am"
            ? hourRaw % 12
            : hourRaw;
      const parsed = new Date(year, month, day, hour24, minute, 0, 0);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  if (/\btomorrow\b/iu.test(content)) {
    return new Date(fallback.getTime() + 24 * 60 * 60 * 1000);
  }
  if (/\btonight\b/iu.test(content)) {
    const next = new Date(fallback);
    next.setHours(19, 0, 0, 0);
    return next;
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

function splitListItems(content: string): string[] {
  return content
    .split(/,| and |\n/iu)
    .map((part) =>
      part
        .trim()
        .replace(
          /^(?:please\s+)?(?:add|get|buy|grab|pick up|put)\s+(?:me\s+)?(?:some\s+)?/iu,
          "",
        )
        .replace(
          /\s+(?:to|onto|on)\s+(?:the\s+)?(?:grocery|shopping)\s+(?:list|cart)\.?$/iu,
          "",
        )
        .trim(),
    )
    .filter((part) => part.length > 0)
    .slice(0, 6);
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
    matrix[row]![0] = row;
  }
  for (let column = 0; column < columns; column += 1) {
    matrix[0]![column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    let rowBest = Number.POSITIVE_INFINITY;
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = candidate[row - 1] === target[column - 1] ? 0 : 1;
      const value = Math.min(
        matrix[row - 1]![column]! + 1,
        matrix[row]![column - 1]! + 1,
        matrix[row - 1]![column - 1]! + substitutionCost,
      );
      matrix[row]![column] = value;
      if (value < rowBest) {
        rowBest = value;
      }
    }
    if (rowBest > maxDistance) {
      return false;
    }
  }

  return matrix[rows - 1]![columns - 1]! <= maxDistance;
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
      processing_sequence:
        options.config?.processing_sequence ?? runtimeSystemConfig.worker.processing_sequence,
      max_thread_history_messages:
        options.config?.max_thread_history_messages ?? DEFAULT_MAX_THREAD_HISTORY_MESSAGES,
      stale_after_hours: options.config?.stale_after_hours ?? DEFAULT_STALE_AFTER_HOURS,
      urgent_relevance_minutes:
        options.config?.urgent_relevance_minutes ?? DEFAULT_URGENT_RELEVANCE_MINUTES,
      clarification_timeout_minutes: options.config?.clarification_timeout_minutes ?? 10,
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
    const cappedHistory = threadHistory
      ? {
          active_topic_context: threadHistory.active_topic_context,
          last_activity: threadHistory.last_activity,
          recent_messages: threadHistory.recent_messages.slice(
            -this.config.max_thread_history_messages,
          ),
        }
      : null;

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

    let determined: DeterminedAction | ClarificationDispatch;
    try {
      determined = await this.traceStep(
        traceSteps,
        3,
        WorkerAction.DetermineActionType,
        undefined,
        `${classification.topic}/${classification.intent}`,
        () =>
          Promise.resolve(
            this.resolveAction(classifiedQueueItem, classification, identity, cappedHistory),
          ),
        (output) => ({
          output_summary: output.is_response ? "response" : "proactive",
          metadata: { typed_action: output.typed_action },
        }),
      );
    } catch (error: unknown) {
      if (!(error instanceof ClarificationSignal)) {
        throw error;
      }
      determined = await this.dispatchClarification(
        classifiedQueueItem,
        classification.topic,
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

    const provisionalTargetThread = await this.routingService.resolveTargetThread({
      topic: classification.topic,
      intent: classification.intent,
      concerning: classification.concerning,
      origin_thread: classifiedQueueItem.target_thread,
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
          classifiedQueueItem,
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
      async () => this.escalationService.evaluate(classifiedQueueItem, provisionalTargetThread),
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

    const confirmationResult = await this.traceStep(
      traceSteps,
      6,
      WorkerAction.CheckConfirmation,
      WorkerService.Confirmation,
      determined.typed_action.type,
      async () =>
        this.handleConfirmation(
          classifiedQueueItem,
          determined.typed_action,
          escalationTargetThread,
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
      await this.appendInboundHistory(classifiedQueueItem, classification.topic);
      await this.stateService.appendDispatchResult(classifiedQueueItem, haltedAction);
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

    await this.applyStateMutation(classifiedQueueItem, determined.typed_action);

    const profileResult = await this.traceStep(
      traceSteps,
      7,
      WorkerAction.ApplyBehaviorProfile,
      WorkerService.TopicProfile,
      classification.topic,
      async () => {
        const profile = await this.topicProfileService.getTopicConfig(classification.topic);
        const placeholderAction = this.toStoreAction(
          classifiedQueueItem,
          "Pre-dispatch composition.",
        );
        const decision: WorkerDecision = {
          queue_item: classifiedQueueItem,
          classification,
          identity,
          action: placeholderAction,
        };
        let composed = await this.topicProfileService.composeMessage(decision);
        const stateBackedMessage = await this.composeStateBackedMessage(determined.typed_action);
        if (stateBackedMessage) {
          composed = stateBackedMessage;
        }
        await this.enqueueCrossTopicEvents(
          classifiedQueueItem,
          classification,
          profile,
          determined,
        );
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
          topic: classification.topic,
          intent: classification.intent,
          concerning: classification.concerning,
          origin_thread: classifiedQueueItem.target_thread,
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
                classifiedQueueItem,
                effectiveRoutingDecision.target.thread_id,
                toCollisionPolicy(),
              );
        const finalAction = await this.routeToAction(
          classifiedQueueItem,
          classification,
          identity,
          effectiveRoutingDecision,
          effectiveBudget,
          profileResult.composed,
        );

        await this.persistOutcome(
          classifiedQueueItem,
          classification,
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
    options: { includePets?: boolean; onlyTypes?: EntityType[] } = {},
  ): string[] {
    const mentioned = this.extractMentionedEntities(content, options);
    if (mentioned.length > 0) {
      return mentioned;
    }
    if (classifiedConcerning.length > 0) {
      return classifiedConcerning;
    }
    return [fallbackEntityId];
  }

  private resolveAction(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    identity: IdentityResolutionResult,
    threadHistory: {
      recent_messages: Array<{
        id: string;
        from: string;
        content: string;
        state_ref?: string;
      }>;
    } | null,
  ): DeterminedAction {
    const content = summarizeContent(queueItem.content);
    const dateHint = extractDateHint(content, queueItem.created_at);
    const inferredReference = this.inferClarificationReference(queueItem, threadHistory);
    const referenceId = queueItem.clarification_of ?? inferredReference ?? extractQueueItemId(queueItem);
    const hasReference = queueItem.clarification_of !== undefined || inferredReference !== null;
    const actor = identity.source_entity_id;
    const humanConcerning = this.resolveConcerningForAction(content, classification.concerning, actor);
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

    switch (classification.topic) {
      case TopicKey.Calendar: {
        if (classification.intent === ClassifierIntent.Query) {
          return { is_response: true, typed_action: { type: "query_events" } };
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
              ),
            );
          }
          return {
            is_response: true,
            typed_action: { type: "reschedule_event", event_id: referenceId, new_start: dateHint },
          };
        }
        if (!dateHint) {
          throw new ClarificationSignal(
            buildClarification(
              queueItem,
              ClarificationReason.MissingRequiredField,
              "What date and time should I put on the calendar?",
            ),
          );
        }
        return {
          is_response: true,
          typed_action: {
            type: "create_event",
            title: content.slice(0, 80),
            date_start: dateHint,
            concerning: humanConcerning,
          },
        };
      }
      case TopicKey.Chores: {
        if (classification.intent === ClassifierIntent.Query) {
          return { is_response: true, typed_action: { type: "query_chores" } };
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
        const amount = extractAmount(content);
        if (amount === null) {
          throw new ClarificationSignal(
            buildClarification(
              queueItem,
              ClarificationReason.MissingRequiredField,
              "What amount should I log?",
            ),
          );
        }
        return {
          is_response: true,
          typed_action: {
            type: "log_expense",
            description: content.slice(0, 120),
            amount,
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
        if (classification.intent === ClassifierIntent.Completion) {
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
            typed_action: { type: "query_school", entity: childConcerning[0] },
          };
        }
        if (!dateHint) {
          throw new ClarificationSignal(
            buildClarification(
              queueItem,
              ClarificationReason.MissingRequiredField,
              "When is it due?",
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
        return {
          is_response: false,
          typed_action: { type: "respond_to_nudge", acknowledged: true },
        };
      }
      case TopicKey.FamilyStatus: {
        if (classification.intent === ClassifierIntent.Query) {
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
    threadHistory: {
      recent_messages: Array<{
        id: string;
        from: string;
        content: string;
        state_ref?: string;
      }>;
    } | null,
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
    const assistantContent = assistantMessage?.content?.trim().toLowerCase() ?? "";
    const isClarificationPrompt = CLARIFICATION_PROMPTS.some(
      (prompt) => assistantContent === prompt.toLowerCase(),
    );
    if (!isClarificationPrompt) {
      return null;
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

  private async applyStateMutation(queueItem: StackQueueItem, action: TopicAction): Promise<void> {
    const state = await this.stateService.getSystemState();
    const now = this.now();
    const actor = queueItem.concerning[0] ?? getDefaultHumanEntityId();
    let mutated = false;

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
        const existing = new Set(state.grocery.list.map((entry) => entry.item.toLowerCase().trim()));
        for (const [index, candidate] of action.items.entries()) {
          const itemName = candidate.item.trim();
          if (itemName.length === 0) {
            continue;
          }
          const normalized = itemName.toLowerCase();
          if (existing.has(normalized)) {
            continue;
          }
          state.grocery.list.push({
            id: `g_${now.getTime()}_${index}`,
            item: itemName,
            section: candidate.section ?? GrocerySection.Other,
            added_by: actor,
            added_at: now,
          });
          existing.add(normalized);
          mutated = true;
        }
        break;
      }
      case "remove_items": {
        const removals = new Set(action.item_ids.map((item) => item.toLowerCase().trim()));
        if (removals.size > 0) {
          const before = state.grocery.list.length;
          state.grocery.list = state.grocery.list.filter(
            (entry) => !removals.has(entry.item.toLowerCase().trim()),
          );
          mutated = state.grocery.list.length !== before;
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
      case "respond_to_nudge": {
        state.relationship.last_nudge.response_received = action.acknowledged;
        state.relationship.nudge_history.unshift({
          date: now,
          type: NudgeType.ConnectionPrompt,
          responded: action.acknowledged,
        });
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
        const idx = state.family_status.current.findIndex((entry) => entry.entity === action.entity);
        if (idx >= 0) {
          state.family_status.current[idx] = next;
        } else {
          state.family_status.current.push(next);
        }
        mutated = true;
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
  }

  private async composeGroceryListMessage(section?: GrocerySection): Promise<string> {
    const state = await this.stateService.getSystemState();
    const entries = state.grocery.list.filter((entry) =>
      section ? entry.section === section : true,
    );
    if (entries.length === 0) {
      return section ? `No grocery items in ${section} right now.` : "Your grocery list is empty.";
    }

    const lines = entries.map((entry, index) => `${index + 1}. ${entry.item}`);
    const prefix = section ? `Grocery list (${section}):` : "Grocery list:";
    return `${prefix}\n${lines.join("\n")}`;
  }

  private async composeStateBackedMessage(action: TopicAction): Promise<string | null> {
    const state = await this.stateService.getSystemState();
    switch (action.type) {
      case "query_events": {
        if (state.calendar.events.length === 0) return "No calendar events right now.";
        return `Calendar:\n${state.calendar.events
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
          .join("\n")}`;
      }
      case "query_chores": {
        if (state.chores.active.length === 0) return "No active chores right now.";
        return `Active chores:\n${state.chores.active
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
      case "query_list":
        return this.composeGroceryListMessage(action.section);
      case "query_health": {
        const profiles = action.entity
          ? state.health.profiles.filter((entry) => entry.entity === action.entity)
          : state.health.profiles;
        if (profiles.length === 0) return "No health records found.";
        return `Health: ${profiles.length} profile(s), ${profiles.reduce((n, p) => n + p.upcoming_appointments.length, 0)} upcoming appointment(s).`;
      }
      case "query_pets": {
        const profiles = action.entity
          ? state.pets.profiles.filter((entry) => entry.entity === action.entity)
          : state.pets.profiles;
        if (profiles.length === 0) return "No pet records found.";
        return `Pets: ${profiles.map((entry) => entry.entity).join(", ")}.`;
      }
      case "query_school": {
        const assignments = state.school.students.flatMap((student) => student.assignments);
        if (assignments.length === 0) return "No school assignments right now.";
        return `School assignments: ${assignments.length} active item(s).`;
      }
      case "query_trips": {
        if (state.travel.trips.length === 0) return "No trips planned right now.";
        return `Trips:\n${state.travel.trips
          .slice(0, 8)
          .map((trip, i) => `${i + 1}. ${trip.name} (${trip.status})`)
          .join("\n")}`;
      }
      case "query_vendors": {
        if (state.vendors.records.length === 0) return "No vendors on file yet.";
        return `Vendors:\n${state.vendors.records
          .slice(0, 8)
          .map((vendor, i) => `${i + 1}. ${vendor.name}`)
          .join("\n")}`;
      }
      case "query_leads": {
        if (state.business.leads.length === 0) return "No leads right now.";
        return `Leads: ${state.business.leads.length} total.`;
      }
      case "query_nudge_history": {
        if (state.relationship.nudge_history.length === 0) return "No relationship nudges in history.";
        return `Nudge history: ${state.relationship.nudge_history.length} item(s).`;
      }
      case "query_status": {
        if (state.family_status.current.length === 0) return "No current family status entries.";
        return `Family status:\n${state.family_status.current
          .map((entry, i) => `${i + 1}. ${entry.entity}: ${entry.status}`)
          .join("\n")}`;
      }
      case "query_plans": {
        if (state.meals.planned.length === 0) return "No meal plans right now.";
        return `Meal plans:\n${state.meals.planned
          .slice(0, 8)
          .map((plan, i) => `${i + 1}. ${plan.description}`)
          .join("\n")}`;
      }
      case "query_maintenance": {
        if (state.maintenance.items.length === 0) return "No maintenance items right now.";
        return `Maintenance: ${state.maintenance.items.length} tracked item(s).`;
      }
      default:
        return null;
    }
  }

  private async handleConfirmation(
    queueItem: StackQueueItem,
    action: TopicAction,
    targetThread: string,
  ): Promise<
    | { kind: "none"; metadata: Record<string, unknown>; resolution?: undefined }
    | {
        kind: "resolved_reply";
        metadata: Record<string, unknown>;
        resolution: ConfirmationResult;
      }
    | { kind: "confirmation_prompted"; metadata: Record<string, unknown> }
  > {
    const replyResolution = await this.confirmationService.resolveFromQueueItem(queueItem);
    if (replyResolution) {
      return {
        kind: "resolved_reply",
        metadata: { result: replyResolution },
        resolution: replyResolution,
      };
    }

    const confirmationType = this.confirmationTypeForAction(action);
    if (!confirmationType) {
      return { kind: "none", metadata: {} };
    }

    const confirmation = await this.confirmationService.openConfirmation({
      type: confirmationType,
      action: action.type,
      requested_by: queueItem.concerning[0] ?? getDefaultHumanEntityId(),
      requested_in_thread: targetThread,
      expires_at: new Date(
        queueItem.created_at.getTime() + this.config.clarification_timeout_minutes * 60_000,
      ),
    });
    const prompt = `Please confirm: ${action.type.replaceAll("_", " ")}. Reply yes or no.`;
    const outbound: TransportOutboundEnvelope = {
      target_thread: targetThread,
      content: prompt,
      priority: DispatchPriority.Immediate,
      concerning: queueItem.concerning,
    };
    await this.transportService.sendOutbound(outbound);
    await this.stateService.appendDispatchResult(queueItem, {
      decision: "dispatch",
      outbound,
    } satisfies DispatchAction);
    await this.appendOutboundHistory(
      targetThread,
      prompt,
      queueItem.topic ?? TopicKey.FamilyStatus,
    );
    return {
      kind: "confirmation_prompted",
      metadata: { confirmation_id: confirmation.id, target_thread: targetThread },
    };
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

      enqueuePromises.push(
        this.queueService.enqueue({
          id: `${sourceId}:${targetTopic}`,
          source: QueueItemSource.CrossTopic,
          content,
          concerning: classification.concerning,
          target_thread: queueItem.target_thread,
          created_at: queueItem.created_at,
          topic: targetTopic,
          intent: ClassifierIntent.Request,
          idempotency_key: `${sourceId}:${targetTopic}`,
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
      return {
        ...decision,
        follow_up_target: this.routingService.resolveRoutingDecision({
          ...request,
          is_response: false,
        }).target,
      };
    }
    return decision;
  }

  private shouldCreateFollowUpTarget(intent: ClassifierIntent): boolean {
    return ![ClassifierIntent.Query, ClassifierIntent.Confirmation].includes(intent);
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
                  concerning: queueItem.concerning,
                },
              };
      const workerDecision: WorkerDecision = {
        queue_item: routedQueueItem,
        classification,
        identity,
        action: candidateAction,
      };
      return this.actionRouter.route(workerDecision, toCollisionPolicy());
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
    return {
      decision: "dispatch",
      outbound: {
        target_thread: routingDecision.target.thread_id,
        content: composedMessage,
        priority: budget.priority,
        concerning: queueItem.concerning,
      },
    };
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
    });
  }

  private async dispatchClarification(
    queueItem: StackQueueItem,
    topic: TopicKey,
    clarification: ClarificationRequest,
  ): Promise<ClarificationDispatch> {
    const targetThread = await this.routingService.resolveTargetThread({
      topic,
      intent: ClassifierIntent.Query,
      concerning: queueItem.concerning,
      origin_thread: queueItem.target_thread,
      is_response: true,
    });
    const outbound: TransportOutboundEnvelope = {
      target_thread: targetThread,
      content: clarification.message_to_participant,
      priority: DispatchPriority.Immediate,
      concerning: queueItem.concerning,
    };
    await this.transportService.sendOutbound(outbound);
    await this.stateService.appendDispatchResult(queueItem, {
      decision: "dispatch",
      outbound,
    } satisfies DispatchAction);
    await this.appendInboundHistory(queueItem, topic);
    await this.appendOutboundHistory(targetThread, clarification.message_to_participant, topic);
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
