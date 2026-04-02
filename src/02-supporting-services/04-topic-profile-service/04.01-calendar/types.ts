import type { TopicKey } from "../../../types.js";

export enum CalendarEventStatus {
  Planning = "planning",
  Upcoming = "upcoming",
  Completed = "completed",
  Cancelled = "cancelled",
  Rescheduled = "rescheduled",
}

export interface CalendarEvent {
  id: string;
  title: string;
  date?: Date;
  date_start?: Date;
  date_end?: Date;
  time?: string | null;
  location?: string | null;
  concerning: string[];
  topic: TopicKey;
  status: CalendarEventStatus;
  follow_up_due?: Date;
  follow_up_sent?: boolean;
  responsible?: string;
  created_by: string;
  created_in_thread?: string;
  created_at: Date;
}

export interface CalendarState {
  events: CalendarEvent[];
}
