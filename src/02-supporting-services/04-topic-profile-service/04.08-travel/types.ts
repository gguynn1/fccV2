export enum TripStatus {
  Planning = "planning",
  Active = "active",
  Completed = "completed",
  Cancelled = "cancelled",
}

export enum TravelInputSource {
  Conversation = "conversation",
  EmailParsing = "email_parsing",
}

export enum ChecklistItemStatus {
  NotStarted = "not_started",
  InProgress = "in_progress",
  Done = "done",
  Skipped = "skipped",
}

export interface ChecklistItem {
  id?: string;
  item: string;
  status: ChecklistItemStatus;
  due_at?: Date;
  completed_at?: Date;
  topic_link?: "calendar" | "pets" | "finances" | "grocery";
}

export interface ItinerarySegment {
  id: string;
  type: "flight" | "lodging" | "ground_transport" | "activity" | "other";
  start_at: Date;
  end_at: Date;
  provider: string;
  confirmation_code: string | null;
}

export interface Trip {
  id: string;
  name: string;
  dates: { start: Date; end: Date };
  travelers: string[];
  status: TripStatus;
  source?: TravelInputSource;
  itinerary?: ItinerarySegment[];
  checklist: ChecklistItem[];
  budget_link: string | null;
  countdown_reminder_dates?: Date[];
  post_trip_follow_up_due?: Date | null;
  notes: string[];
}

export interface TravelState {
  trips: Trip[];
}

export type TravelAction =
  | {
      type: "create_trip";
      name: string;
      dates: { start: Date; end: Date };
      travelers: string[];
      source: TravelInputSource;
    }
  | {
      type: "update_trip";
      trip_id: string;
      changes: Partial<Pick<Trip, "name" | "dates" | "travelers" | "notes" | "itinerary">>;
    }
  | { type: "cancel_trip"; trip_id: string }
  | {
      type: "update_checklist";
      trip_id: string;
      item_id: string;
      status: ChecklistItemStatus;
      completed_at?: Date;
    }
  | { type: "add_itinerary_segment"; trip_id: string; segment: ItinerarySegment }
  | { type: "mark_post_trip_follow_up_complete"; trip_id: string }
  | { type: "query_trips"; status?: TripStatus };
