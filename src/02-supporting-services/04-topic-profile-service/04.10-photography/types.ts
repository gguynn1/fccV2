export enum PhotoLeadStatus {
  New = "new",
  AwaitingReply = "awaiting_reply",
  InConversation = "in_conversation",
  Booked = "booked",
  Declined = "declined",
  Archived = "archived",
}

export interface PhotoLead {
  id: string;
  client_name: string;
  inquiry_date: Date;
  event_type: string;
  event_date: Date | null;
  status: PhotoLeadStatus;
  last_contact: Date;
  draft_reply: string | null;
  follow_up_due?: Date;
  draft_approved?: boolean;
  notes: string;
}

export interface PhotographyState {
  leads: PhotoLead[];
}
