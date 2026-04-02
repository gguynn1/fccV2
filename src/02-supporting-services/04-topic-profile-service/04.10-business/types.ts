export enum BusinessLeadStatus {
  New = "new",
  AwaitingReply = "awaiting_reply",
  InConversation = "in_conversation",
  Booked = "booked",
  Declined = "declined",
  Archived = "archived",
}

export interface BusinessProfile {
  entity: string;
  business_type: string;
  business_name: string;
  follow_up_quiet_period: string;
}

export interface BusinessLead {
  id: string;
  owner: string;
  client_name: string;
  inquiry_date: Date;
  event_type: string;
  event_date: Date | null;
  status: BusinessLeadStatus;
  last_contact: Date;
  draft_reply: string | null;
  follow_up_due?: Date;
  draft_approved?: boolean;
  notes: string;
}

export interface BusinessState {
  profiles: BusinessProfile[];
  leads: BusinessLead[];
}
