import type {
  ActionRouterResult,
  CollisionPolicy,
  StackClassificationResult,
  StackQueueItem,
  WorkerDecision,
} from "../01-service-stack/types.js";
import type { SystemConfig } from "../index.js";
import type { ClassifierIntent, DispatchPriority, TopicKey } from "../types.js";
import type { DigestDay } from "./01-scheduler-service/types.js";
import type { DataIngestState, ExtractedIngestPayload } from "./02-data-ingest-service/types.js";
import type { SystemState } from "./03-state-service/types.js";
import type { TopicAction, TopicProfileConfig } from "./04-topic-profile-service/types.js";
import type { RoutingDecision, Thread, ThreadHistory } from "./05-routing-service/types.js";
import type { OutboundBudgetTracker } from "./06-budget-service/types.js";
import type { ActiveEscalation, EscalationStatus } from "./07-escalation-service/types.js";
import type {
  Confirmation,
  ConfirmationActionType,
  ConfirmationApprovalPolicy,
  ConfirmationRecoveryResult,
  ConfirmationReplyOption,
  ConfirmationsState,
  ResolvedConfirmation,
} from "./08-confirmation-service/types.js";

export * from "./01-scheduler-service/types.js";
export * from "./02-data-ingest-service/types.js";
export * from "./03-state-service/types.js";
export * from "./04-topic-profile-service/types.js";
export * from "./05-routing-service/types.js";
export * from "./06-budget-service/types.js";
export * from "./07-escalation-service/types.js";
export * from "./08-confirmation-service/types.js";

export interface SchedulerQueueProducer {
  produceScheduledItems(reference_time: Date): Promise<StackQueueItem[]>;
}

export interface DataIngestQueueProducer {
  produceIngestItems(reference_time: Date): Promise<StackQueueItem[]>;
}

export interface SchedulerService extends SchedulerQueueProducer {
  reconcileDowntime(since: Date, until: Date): Promise<StackQueueItem[]>;
  recordDigestDelivery(day: DigestDay): Promise<void>;
}

export interface DataIngestService extends DataIngestQueueProducer {
  getIngestState(): Promise<DataIngestState>;
  updateIngestState(state: DataIngestState): Promise<void>;
  extractForwardedPayload(content: string): Promise<ExtractedIngestPayload>;
}

export interface StateService {
  getSystemConfig(): Promise<SystemConfig>;
  saveSystemConfig(config: SystemConfig): Promise<void>;
  getSystemState(): Promise<SystemState>;
  saveSystemState(state: SystemState): Promise<void>;
  getThreadHistory(thread_id: string): Promise<ThreadHistory | null>;
  saveThreadHistory(thread_id: string, history: ThreadHistory): Promise<void>;
  appendDispatchResult(queue_item: StackQueueItem, action: ActionRouterResult): Promise<void>;
}

export interface TopicProfileService {
  getTopicConfig(topic: TopicKey): Promise<TopicProfileConfig[TopicKey]>;
  classifyFallback(
    queue_item: StackQueueItem,
    thread_history: ThreadHistory | null,
  ): Promise<StackClassificationResult>;
  composeMessage(decision: WorkerDecision): Promise<string>;
}

export interface RoutingRequest {
  topic: TopicKey;
  intent: ClassifierIntent;
  concerning: string[];
  origin_thread: string;
  is_response: boolean;
}

export interface RoutingService {
  getThreadDefinitions(): Promise<Thread[]>;
  resolveTargetThread(request: RoutingRequest): Promise<string>;
  resolveRoutingDecision(request: RoutingRequest): RoutingDecision;
  shouldResetActiveTopicContext(
    history: ThreadHistory | null,
    next_topic: string,
    now?: Date,
    message?: string,
  ): boolean;
}

export interface BudgetDecision {
  priority: DispatchPriority;
  hold_until?: Date;
  included_queue_item_ids?: string[];
  reason: string;
  reason_codes?: string[];
}

export interface BudgetService {
  getBudgetTracker(): Promise<OutboundBudgetTracker>;
  recordHumanSignal?(
    queue_item: StackQueueItem,
    classification?: StackClassificationResult,
  ): Promise<void>;
  evaluateOutbound(
    queue_item: StackQueueItem,
    target_thread: string,
    collision_policy: CollisionPolicy,
  ): Promise<BudgetDecision>;
  recordDispatch(queue_item: StackQueueItem, dispatched_at: Date): Promise<void>;
}

export interface EscalationDecision {
  should_escalate: boolean;
  current?: ActiveEscalation;
  next_action_at?: Date;
  next_target_thread?: string;
}

export interface EscalationService {
  getStatus(): Promise<EscalationStatus>;
  evaluate(queue_item: StackQueueItem, target_thread: string): Promise<EscalationDecision>;
  reconcileOnStartup(now: Date): Promise<StackQueueItem[]>;
}

export interface ConfirmationRequest {
  type: ConfirmationActionType;
  action: string;
  requested_action_payload?: TopicAction;
  requested_by: string;
  requested_in_thread: string;
  origin_thread?: string;
  approval_thread_policy?: ConfirmationApprovalPolicy;
  expires_at: Date;
  requested_at?: Date;
  reply_options?: ConfirmationReplyOption[];
  expiry_message?: string;
}

export interface ConfirmationService {
  getState(): Promise<ConfirmationsState>;
  requiresConfirmation(type: ConfirmationActionType): boolean;
  openConfirmation(request: ConfirmationRequest): Promise<Confirmation>;
  resolveFromQueueItem(queue_item: StackQueueItem): Promise<ResolvedConfirmation | null>;
  expirePending(now: Date): Promise<Confirmation[]>;
  reconcileOnStartup(now: Date): Promise<ConfirmationRecoveryResult>;
  close(): Promise<void>;
}
