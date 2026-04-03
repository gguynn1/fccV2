import { pino, type Logger } from "pino";

import { HealthProviderType } from "../../02-supporting-services/04-topic-profile-service/04.05-health/types.js";
import { PetCareCategory } from "../../02-supporting-services/04-topic-profile-service/04.06-pets/types.js";
import { SchoolInputSource } from "../../02-supporting-services/04-topic-profile-service/04.07-school/types.js";
import {
  TravelInputSource,
  TripStatus,
} from "../../02-supporting-services/04-topic-profile-service/04.08-travel/types.js";
import { BusinessLeadStatus } from "../../02-supporting-services/04-topic-profile-service/04.10-business/types.js";
import { NudgeType } from "../../02-supporting-services/04-topic-profile-service/04.11-relationship/types.js";
import { extractGroceryItemsFromMealDescription } from "../../02-supporting-services/04-topic-profile-service/04.13-meals/profile.js";
import { MealType } from "../../02-supporting-services/04-topic-profile-service/04.13-meals/types.js";
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
  const isoMatch = content.match(/\b(20\d{2}-\d{2}-\d{2})\b/u);
  if (isoMatch?.[1]) {
    const parsed = new Date(`${isoMatch[1]}T12:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const match = content.match(/\$?(\d+(?:\.\d{1,2})?)/u);
  if (!match?.[1]) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitListItems(content: string): string[] {
  return content
    .split(/,| and |\n/iu)
    .map((part) => part.trim())
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
        () => Promise.resolve(this.resolveAction(classifiedQueueItem, classification, identity)),
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

    const provisionalTargetThread = await this.routingService.resolveTargetThread({
      topic: classification.topic,
      intent: classification.intent,
      concerning: classification.concerning,
      origin_thread: classifiedQueueItem.target_thread,
      is_response: determined.is_response,
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
        const composed = await this.topicProfileService.composeMessage(decision);
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
          is_response: determined.is_response,
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

  private resolveAction(
    queueItem: StackQueueItem,
    classification: StackClassificationResult,
    identity: IdentityResolutionResult,
  ): DeterminedAction {
    const content = summarizeContent(queueItem.content);
    const dateHint = extractDateHint(content, queueItem.created_at);
    const referenceId = queueItem.clarification_of ?? extractQueueItemId(queueItem);
    const actor = identity.source_entity_id;

    switch (classification.topic) {
      case TopicKey.Calendar: {
        if (classification.intent === ClassifierIntent.Query) {
          return { is_response: true, typed_action: { type: "query_events" } };
        }
        if (classification.intent === ClassifierIntent.Cancellation) {
          if (!queueItem.clarification_of) {
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
          if (!queueItem.clarification_of || !dateHint) {
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
            concerning: classification.concerning,
          },
        };
      }
      case TopicKey.Chores: {
        if (classification.intent === ClassifierIntent.Query) {
          return { is_response: true, typed_action: { type: "query_chores" } };
        }
        if (classification.intent === ClassifierIntent.Completion) {
          if (!queueItem.clarification_of) {
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
          if (!queueItem.clarification_of) {
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
            assigned_to: classification.concerning[0] ?? actor,
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
            typed_action: { type: "query_health", entity: classification.concerning[0] },
          };
        }
        if (classification.intent === ClassifierIntent.Completion) {
          return {
            is_response: true,
            typed_action: {
              type: "log_visit",
              entity: classification.concerning[0] ?? actor,
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
            entity: classification.concerning[0] ?? actor,
            provider_type: this.inferHealthProvider(content),
            date: dateHint,
          },
        };
      }
      case TopicKey.Pets: {
        if (classification.intent === ClassifierIntent.Query) {
          return {
            is_response: true,
            typed_action: { type: "query_pets", entity: classification.concerning[0] },
          };
        }
        return {
          is_response: false,
          typed_action: {
            type: "log_care",
            entity: classification.concerning[0] ?? "pet_1",
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
            typed_action: { type: "query_school", entity: classification.concerning[0] },
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
            entity: classification.concerning[0] ?? "participant_3",
            parent_entity: "participant_1",
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
            travelers: classification.concerning,
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
            managed_by: classification.concerning[0] ?? actor,
          },
        };
      }
      case TopicKey.Business: {
        if (classification.intent === ClassifierIntent.Query) {
          return {
            is_response: true,
            typed_action: {
              type: "query_leads",
              owner: classification.concerning[0],
              status: BusinessLeadStatus.New,
            },
          };
        }
        return {
          is_response: false,
          typed_action: {
            type: "add_lead",
            owner: classification.concerning[0] ?? actor,
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
            typed_action: { type: "query_status", entity: classification.concerning[0] },
          };
        }
        return {
          is_response: true,
          typed_action: {
            type: "update_status",
            entity: classification.concerning[0] ?? actor,
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
      requested_by: queueItem.concerning[0] ?? "participant_1",
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

    return `${sourceTopic} -> ${targetTopic}: ${determined.typed_action.type}`;
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
  const identity = createIdentityService();
  return {
    resolve(item: StackQueueItem): Promise<IdentityResolutionResult> {
      const firstEntity = item.concerning[0] ?? "participant_1";
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
