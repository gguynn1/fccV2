import { z } from "zod";

import {
  ClassifierIntent,
  DispatchPriority,
  QueueItemSource,
  QueueItemType,
  TopicKey,
} from "../../types.js";

export { QueueItemSource, QueueItemType };

export enum QueuePendingStatus {
  PendingClassification = "pending_classification",
  PendingProcessing = "pending_processing",
  Processing = "processing",
  Failed = "failed",
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
  topic?: TopicKey;
  intent?: ClassifierIntent;
  concerning: string[];
  content: string | InboundEmailContent;
  priority?: DispatchPriority;
  target_thread: string;
  created_at: Date;
  hold_until?: Date;
  status?: QueuePendingStatus;
  idempotency_key?: string;
  clarification_of?: string;
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

const queueDateSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return value;
}, z.date());

export const inboundEmailContentSchema = z.object({
  from: z.string().min(1),
  subject: z.string().min(1),
  extracted: z.record(z.string(), z.string()),
});

export const pendingQueueItemSchema = z.object({
  id: z.string().min(1),
  source: z.nativeEnum(QueueItemSource),
  type: z.nativeEnum(QueueItemType),
  topic: z.nativeEnum(TopicKey).optional(),
  intent: z.nativeEnum(ClassifierIntent).optional(),
  concerning: z.array(z.string().min(1)).min(1),
  content: z.union([z.string().min(1), inboundEmailContentSchema]),
  priority: z.nativeEnum(DispatchPriority).optional(),
  target_thread: z.string().min(1),
  created_at: queueDateSchema,
  hold_until: queueDateSchema.optional(),
  status: z.nativeEnum(QueuePendingStatus).optional(),
  idempotency_key: z.string().min(1).optional(),
  clarification_of: z.string().min(1).optional(),
});

export const dispatchedQueueItemSchema = z.object({
  id: z.string().min(1),
  topic: z.nativeEnum(TopicKey),
  target_thread: z.string().min(1),
  content: z.string().min(1),
  dispatched_at: queueDateSchema,
  priority: z.nativeEnum(DispatchPriority),
  included_in: z.string().optional(),
  response_received: z.boolean().optional(),
  escalation_step: z.number().int().nonnegative().optional(),
});

export const queueStateSchema = z.object({
  pending: z.array(pendingQueueItemSchema),
  recently_dispatched: z.array(dispatchedQueueItemSchema),
});

export type PendingQueueItemInput = z.input<typeof pendingQueueItemSchema>;

export interface QueueRetryPolicy {
  attempts: number;
  backoff_ms: number;
}

export interface QueueConsumerOptions {
  concurrency: number;
  retry: QueueRetryPolicy;
}
