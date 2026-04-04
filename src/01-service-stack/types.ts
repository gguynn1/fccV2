import { z } from "zod";

import type { ThreadHistory } from "../02-supporting-services/05-routing-service/types.js";
import {
  ClassifierIntent,
  DispatchPriority,
  QueueItemSource,
  TopicKey,
  type ClarificationReason,
} from "../types.js";
import { inboundEmailContentSchema } from "./04-queue/types.js";
import type { CollisionPrecedence } from "./06-action-router/types.js";

export * from "./01-transport-layer/types.js";
export * from "./02-identity-service/types.js";
export * from "./03-classifier-service/types.js";
export * from "./04-queue/types.js";
export * from "./05-worker/types.js";
export * from "./06-action-router/types.js";

export const stackQueueItemSchema = z.object({
  id: z.string().min(1).optional(),
  source: z.nativeEnum(QueueItemSource),
  content: z.union([z.string(), z.record(z.string(), z.unknown()), inboundEmailContentSchema]),
  concerning: z.array(z.string()).min(1),
  target_thread: z.string().min(1),
  created_at: z.date(),
  topic: z.nativeEnum(TopicKey).optional(),
  intent: z.nativeEnum(ClassifierIntent).optional(),
  priority: z.nativeEnum(DispatchPriority).optional(),
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

export interface ImageExtraction {
  type: "receipt" | "school_flyer" | "maintenance_photo" | "unknown";
  extracted_fields: Record<string, string>;
  confidence: number;
}

export interface StackClassificationResult {
  topic: TopicKey;
  intent: ClassifierIntent;
  concerning: string[];
  confidence?: number;
  image_extraction?: ImageExtraction;
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
  classify(
    item: StackQueueItem,
    thread_history?: ThreadHistory | null,
  ): Promise<StackClassificationResult>;
  extractTopicScopedContent?(
    item: StackQueueItem,
    classification: StackClassificationResult,
    thread_history?: ThreadHistory | null,
  ): Promise<string | null>;
  planTopicResponse?(input: {
    topic: TopicKey;
    intent: ClassifierIntent;
    source_message: string;
    recent_messages: Array<{
      from: string;
      content: string;
      at: string;
      topic_context: string | null;
    }>;
  }): Promise<{
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
  interpretAction?(input: {
    queue_item: StackQueueItem;
    classification: StackClassificationResult;
    thread_history?: ThreadHistory | null;
    scoped_content: string;
  }): Promise<
    | {
        kind: "resolved";
        topic: TopicKey;
        intent: ClassifierIntent;
        action: Record<string, unknown> & { type: string };
      }
    | {
        kind: "clarification_required";
        clarification: ClarificationRequest;
      }
    | null
  >;
}

export interface QueueServiceContract {
  enqueue(item: StackQueueItem): Promise<void>;
  dequeue(): Promise<StackQueueItem | null>;
  requeue(item: StackQueueItem): Promise<void>;
}

export interface ActionRouterContract {
  route(decision: WorkerDecision, collision_policy: CollisionPolicy): Promise<ActionRouterResult>;
}
