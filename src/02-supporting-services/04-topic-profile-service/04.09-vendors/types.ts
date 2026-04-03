export enum VendorJobStatus {
  WaitingForQuote = "waiting_for_quote",
  Quoted = "quoted",
  Scheduled = "scheduled",
  InProgress = "in_progress",
  Completed = "completed",
  Cancelled = "cancelled",
}

export enum VendorFollowUpStage {
  NotNeeded = "not_needed",
  Pending = "pending",
  ReminderSent = "reminder_sent",
  Resolved = "resolved",
}

export interface VendorJob {
  id?: string;
  description: string;
  date: Date;
  cost: number | null;
  status: VendorJobStatus;
  notes: string[];
}

export interface VendorFollowUpRecord {
  at: Date;
  note: string;
  stage: VendorFollowUpStage;
}

export interface VendorRecord {
  id: string;
  name: string;
  type: string;
  jobs: VendorJob[];
  contact: string;
  managed_by: string;
  follow_up_pending: boolean;
  follow_up_stage?: VendorFollowUpStage;
  follow_up_history?: VendorFollowUpRecord[];
  follow_up_due?: Date;
}

export interface VendorsState {
  records: VendorRecord[];
}

export type VendorAction =
  | { type: "add_vendor"; name: string; vendor_type: string; contact: string; managed_by: string }
  | {
      type: "log_job";
      vendor_id: string;
      description: string;
      date: Date;
      cost?: number;
      status?: VendorJobStatus;
    }
  | { type: "update_job_status"; vendor_id: string; job_index: number; status: VendorJobStatus }
  | {
      type: "mark_follow_up_pending";
      vendor_id: string;
      due_at: Date;
      note: string;
    }
  | { type: "resolve_follow_up"; vendor_id: string; note: string }
  | { type: "query_vendors"; vendor_type?: string };
