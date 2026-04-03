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
  normalized_start?: Date;
  normalized_end?: Date;
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

export interface CalendarReminderPlan {
  reminder_offsets_minutes: number[];
  follow_up_offset_minutes: number;
  stale_after_minutes: number;
}

export interface CalendarConflictCheckRequest {
  start: Date;
  end: Date;
  concerning: string[];
  ignore_event_id?: string;
}

export interface CalendarConflictResult {
  has_conflicts: boolean;
  conflicting_event_ids: string[];
}

export interface CalendarQueryFilters {
  date_range?: { start: Date; end: Date };
  concerning?: string[];
  status?: CalendarEventStatus[];
}

export interface CalendarRescheduleCandidate {
  event_id: string;
  title: string;
  starts_at: Date;
}

export type CalendarRescheduleLookup =
  | {
      kind: "resolved";
      event_id: string;
    }
  | {
      kind: "clarification_required";
      candidates: CalendarRescheduleCandidate[];
      reason: "multiple_matches";
    };

export type CalendarAction =
  | {
      type: "create_event";
      title: string;
      date_start: Date;
      date_end?: Date;
      location?: string;
      concerning: string[];
    }
  | { type: "reschedule_event"; event_id: string; new_start: Date; new_end?: Date }
  | { type: "cancel_event"; event_id: string; reason?: string }
  | { type: "query_events"; filters?: CalendarQueryFilters };
