export enum BusinessPipelineStage {
  Inquiry = "inquiry",
  Qualified = "qualified",
  DraftPrepared = "draft_prepared",
  AwaitingClientReply = "awaiting_client_reply",
  Booked = "booked",
  Lost = "lost",
  Archived = "archived",
}

export enum BusinessLeadStatus {
  New = "new",
  AwaitingReply = "awaiting_reply",
  InConversation = "in_conversation",
  Booked = "booked",
  Declined = "declined",
  Archived = "archived",
}

export enum BookingStatus {
  NotBooked = "not_booked",
  Tentative = "tentative",
  Confirmed = "confirmed",
  Declined = "declined",
}

export interface BusinessProfile {
  entity: string;
  business_type: string;
  business_name: string;
  follow_up_quiet_period_days: number;
}

export interface LeadContact {
  full_name: string;
  preferred_channel: "phone_native_message" | "email";
  contact_value: string;
}

export interface BusinessEventDetails {
  summary: string;
  requested_date: Date | null;
  location: string | null;
  budget_notes: string | null;
}

export interface BusinessFollowUpEntry {
  at: Date;
  note: string;
  by: string;
}

export interface BusinessLead {
  id: string;
  owner: string;
  contact?: LeadContact;
  client_name?: string;
  inquiry_date: Date;
  event_type?: string;
  event_date?: Date | null;
  event_details?: BusinessEventDetails;
  status?: BusinessLeadStatus;
  pipeline_stage?: BusinessPipelineStage;
  booking_status?: BookingStatus;
  last_contact: Date;
  draft_reply: string | null;
  draft_requires_confirmation?: boolean;
  draft_approved?: boolean;
  follow_up_due?: Date | null;
  follow_up_history?: BusinessFollowUpEntry[];
  notes: string | string[];
}

export interface BusinessState {
  profiles: BusinessProfile[];
  leads: BusinessLead[];
}

export type BusinessAction =
  | {
      type: "add_lead";
      owner: string;
      contact?: LeadContact;
      client_name?: string;
      event_type?: string;
      event_date?: Date;
      event_details?: BusinessEventDetails;
    }
  | {
      type: "update_lead";
      lead_id: string;
      changes: Partial<
        Pick<
          BusinessLead,
          | "event_details"
          | "pipeline_stage"
          | "booking_status"
          | "draft_reply"
          | "follow_up_due"
          | "notes"
        >
      >;
    }
  | { type: "stage_client_draft"; lead_id: string; draft_reply: string }
  | { type: "approve_client_draft"; lead_id: string; approved_by: string }
  | { type: "record_follow_up"; lead_id: string; entry: BusinessFollowUpEntry }
  | { type: "archive_lead"; lead_id: string }
  | {
      type: "query_leads";
      owner?: string;
      stage?: BusinessPipelineStage;
      status?: BusinessLeadStatus;
    };
