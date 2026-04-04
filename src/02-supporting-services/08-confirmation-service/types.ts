import type { PendingQueueItem } from "../../01-service-stack/04-queue/types.js";
import type { TopicAction } from "../04-topic-profile-service/types.js";

export enum ConfirmationActionType {
  SendingOnBehalf = "sending_on_behalf",
  FinancialAction = "financial_action",
  SystemChange = "system_change",
}

export enum ConfirmationResult {
  Approved = "approved",
  Rejected = "rejected",
  Expired = "expired",
  NotYetApproved = "not_yet_approved",
}

export enum ConfirmationStatus {
  Pending = "pending",
  Resolved = "resolved",
  Expired = "expired",
}

export enum ConfirmationReplyDecision {
  Approve = "approve",
  Reject = "reject",
}

export type ConfirmationApprovalPolicy = "exact_thread" | "requester_private_allowed";

export interface ConfirmationReplyOption {
  key: string;
  label: string;
  aliases: string[];
  decision: ConfirmationReplyDecision;
}

export interface ConfirmationGates {
  always_require_approval: ConfirmationActionType[];
  expiry_minutes: number;
  on_expiry: string;
}

export interface ConfirmationRecordBase {
  id: string;
  type: ConfirmationActionType;
  action: string;
  requested_action_payload?: TopicAction;
  requested_by: string;
  requested_in_thread: string;
  origin_thread?: string;
  approval_thread_policy?: ConfirmationApprovalPolicy;
  requested_at: Date;
  expires_at?: Date;
  resolved_in_thread?: string;
  reply_options?: ConfirmationReplyOption[];
  expiry_message?: string;
}

export interface PendingConfirmation extends ConfirmationRecordBase {
  status: ConfirmationStatus.Pending;
  result: ConfirmationResult.NotYetApproved;
  expires_at: Date;
  reply_options: ConfirmationReplyOption[];
}

export interface ResolvedConfirmation extends ConfirmationRecordBase {
  status: ConfirmationStatus.Resolved;
  result: ConfirmationResult.Approved | ConfirmationResult.Rejected;
  expires_at: Date;
  resolved_at: Date;
  resolved_in_thread: string;
  reply_options: ConfirmationReplyOption[];
}

export interface ExpiredConfirmation extends ConfirmationRecordBase {
  status: ConfirmationStatus.Expired;
  result: ConfirmationResult.Expired;
  expires_at: Date;
  expired_at: Date;
  reply_options: ConfirmationReplyOption[];
}

// Keep older persisted confirmation records readable while the service writes explicit state slices.
export interface LegacyConfirmationRecord extends ConfirmationRecordBase {
  status?: undefined;
  result?: ConfirmationResult;
  expired_at?: Date;
  resolved_at?: Date;
}

export type ConfirmationHistoryRecord =
  | ResolvedConfirmation
  | ExpiredConfirmation
  | LegacyConfirmationRecord;

export type Confirmation =
  | PendingConfirmation
  | ResolvedConfirmation
  | ExpiredConfirmation
  | LegacyConfirmationRecord;

export interface ConfirmationsState {
  pending: PendingConfirmation[];
  recent: ConfirmationHistoryRecord[];
}

export interface ConfirmationExpiryNotification {
  confirmation_id: string;
  target_thread: string;
  message: string;
  queue_item: PendingQueueItem;
}

export interface ConfirmationRecoveryResult {
  expired: ExpiredConfirmation[];
  notifications: ConfirmationExpiryNotification[];
}
