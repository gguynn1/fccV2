import type { TopicKey, ClassifierIntent } from "../../types.js";
import type { DispatchPriority } from "../06-action-router/types.js";

export enum QueueItemType {
  Outbound = "outbound",
  Inbound = "inbound",
}

export enum QueueItemSource {
  HumanMessage = "human_message",
  Reaction = "reaction",
  ForwardedMessage = "forwarded_message",
  ImageAttachment = "image_attachment",
  EmailMonitor = "email_monitor",
  InternalStateChange = "internal_state_change",
  ScheduledTrigger = "scheduled_trigger",
  CrossTopic = "cross_topic",
}

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
