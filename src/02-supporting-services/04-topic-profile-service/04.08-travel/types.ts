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
