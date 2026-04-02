export enum TripStatus {
  Planning = "planning",
}

export enum ChecklistItemStatus {
  Done = "done",
  NotStarted = "not_started",
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
