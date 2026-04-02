import type { TopicKey } from "../../types.js";
import type { DispatchPriority } from "../06-action-router/types.js";

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
