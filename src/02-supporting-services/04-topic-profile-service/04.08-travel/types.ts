export enum TripStatus {
  Planning = "planning",
  Active = "active",
  Completed = "completed",
  Cancelled = "cancelled",
}

export enum ChecklistItemStatus {
  NotStarted = "not_started",
  InProgress = "in_progress",
  Done = "done",
  Skipped = "skipped",
}

export interface ChecklistItem {
  item: string;
  status: ChecklistItemStatus;
  completed_at?: Date;
  topic_link?: string;
}

export interface Trip {
  id: string;
  name: string;
  dates: { start: Date; end: Date };
  travelers: string[];
  status: TripStatus;
  checklist: ChecklistItem[];
  budget_link: string;
  notes: string[];
}

export interface TravelState {
  trips: Trip[];
}

export type TravelAction =
  | { type: "create_trip"; name: string; dates: { start: Date; end: Date }; travelers: string[] }
  | {
      type: "update_trip";
      trip_id: string;
      changes: Partial<Pick<Trip, "name" | "dates" | "travelers" | "notes">>;
    }
  | { type: "cancel_trip"; trip_id: string }
  | { type: "update_checklist"; trip_id: string; item: string; status: ChecklistItemStatus }
  | { type: "query_trips"; status?: TripStatus };
