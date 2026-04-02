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

export interface ConfirmationGates {
  always_require_approval: ConfirmationActionType[];
  expiry_minutes: number;
  on_expiry: string;
}

export interface Confirmation {
  id: string;
  type: ConfirmationActionType;
  action: string;
  requested_by: string;
  requested_in_thread?: string;
  requested_at: Date;
  expires_at?: Date;
  expired_at?: Date;
  status?: string;
  result?: ConfirmationResult;
}

export interface ConfirmationsState {
  pending: Confirmation[];
  recent: Confirmation[];
}
