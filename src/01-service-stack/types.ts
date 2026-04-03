export * from "./01-transport-layer/types.js";
export * from "./02-identity-service/types.js";
export * from "./03-classifier-service/types.js";
export * from "./04-queue/types.js";
export * from "./05-worker/types.js";
export * from "./06-action-router/types.js";

import { z } from "zod";

import { ClassifierIntent, TopicKey } from "../types.js";
import type { ClarificationReason } from "../types.js";
import type { CollisionPrecedence, DispatchPriority } from "./06-action-router/types.js";
import { QueueItemSource } from "./04-queue/types.js";

export const stackQueueItemSchema = z.object({
  source: z.nativeEnum(QueueItemSource),
  content: z.union([z.string(), z.record(z.string(), z.unknown())]),
  concerning: z.array(z.string()).min(1),
  target_thread: z.string().min(1),
  created_at: z.date(),
  topic: z.nativeEnum(TopicKey).optional(),
  intent: z.nativeEnum(ClassifierIntent).optional(),
  idempotency_key: z.string().min(1).optional(),
  clarification_of: z.string().min(1).optional(),
});

export type StackQueueItem = z.infer<typeof stackQueueItemSchema>;

export interface TransportInboundEnvelope {
  source: QueueItemSource;
  content: StackQueueItem["content"];
  concerning: string[];
  target_thread: string;
  created_at: Date;
  idempotency_key?: string;
}

export interface TransportOutboundEnvelope {
  target_thread: string;
  content: string;
  priority: DispatchPriority;
  concerning: string[];
}

export interface IdentityResolutionResult {
  source_entity_id: string;
  source_entity_type: string;
  thread_id: string;
  concerning: string[];
}

export interface StackClassificationResult {
  topic: TopicKey;
  intent: ClassifierIntent;
  concerning: string[];
  confidence?: number;
}

export interface ClarificationRequest {
  reason: ClarificationReason;
  message_to_participant: string;
  options?: string[];
  original_queue_item_id: string;
  context: Record<string, unknown>;
}

export interface WorkerDecision {
  queue_item: StackQueueItem;
  classification: StackClassificationResult;
  identity: IdentityResolutionResult;
  clarification_request?: ClarificationRequest;
  action: ActionRouterResult;
}

export interface DispatchAction {
  decision: "dispatch";
  outbound: TransportOutboundEnvelope;
}

export interface HoldAction {
  decision: "hold";
  queue_item: StackQueueItem;
  hold_until: Date;
  reason: string;
}

export interface StoreAction {
  decision: "store";
  queue_item: StackQueueItem;
  reason: string;
}

export type ActionRouterResult = DispatchAction | HoldAction | StoreAction;

export enum SamePrecedenceStrategy {
  Batch = "batch",
  SpaceOut = "space_out",
  LatestWins = "latest_wins",
}

export interface CollisionPolicy {
  precedence_order: CollisionPrecedence[];
  same_precedence_strategy: SamePrecedenceStrategy;
}

export interface TransportServiceContract {
  normalizeInbound(input: TransportInboundEnvelope): StackQueueItem;
  sendOutbound(output: TransportOutboundEnvelope): Promise<void>;
}

export interface IdentityServiceContract {
  resolve(item: StackQueueItem): Promise<IdentityResolutionResult>;
}

export interface ClassifierServiceContract {
  classify(item: StackQueueItem): Promise<StackClassificationResult>;
}

export interface QueueServiceContract {
  enqueue(item: StackQueueItem): Promise<void>;
  dequeue(): Promise<StackQueueItem | null>;
  requeue(item: StackQueueItem): Promise<void>;
}

export interface ActionRouterContract {
  route(decision: WorkerDecision, collision_policy: CollisionPolicy): Promise<ActionRouterResult>;
}
