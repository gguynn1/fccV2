import { EscalationLevel, TopicKey } from "../../../types.js";
import type { TopicProfile } from "../types.js";
import type {
  CalendarConflictCheckRequest,
  CalendarConflictResult,
  CalendarEvent,
  CalendarReminderPlan,
} from "./types.js";

export const CALENDAR_TOPIC_PROFILE: TopicProfile = {
  tone: "precise and logistical",
  format: "structured confirmation with date, time, location, and participants",
  initiative_style: "event-driven reminders before events and follow-ups after",
  escalation_level: EscalationLevel.Medium,
  framework_grounding: null,
  response_format: "confirmation blocks and concise updates",
  cross_topic_connections: [TopicKey.Health, TopicKey.School, TopicKey.Travel, TopicKey.Business],
};

export const CALENDAR_REMINDER_PLAN: CalendarReminderPlan = {
  reminder_offsets_minutes: [24 * 60, 2 * 60],
  follow_up_offset_minutes: 2 * 60,
  stale_after_minutes: 60,
};

export function detectCalendarConflicts(
  existing_events: CalendarEvent[],
  request: CalendarConflictCheckRequest,
): CalendarConflictResult {
  const conflicting_event_ids = existing_events
    .filter((event) => event.id !== request.ignore_event_id)
    .filter((event) => event.concerning.some((entity) => request.concerning.includes(entity)))
    .filter((event) => {
      const eventStart = event.normalized_start ?? event.date_start ?? event.date;
      const eventEnd = event.normalized_end ?? event.date_end ?? event.date;
      if (!eventStart || !eventEnd) {
        return false;
      }
      return request.start < eventEnd && eventStart < request.end;
    })
    .map((event) => event.id);

  return {
    has_conflicts: conflicting_event_ids.length > 0,
    conflicting_event_ids,
  };
}

export function isCalendarReminderStale(
  event_start: Date,
  reminder_for: Date,
  now: Date,
  plan: CalendarReminderPlan = CALENDAR_REMINDER_PLAN,
): boolean {
  if (now <= reminder_for) {
    return false;
  }
  const latestRelevant = new Date(event_start.getTime() + plan.stale_after_minutes * 60_000);
  return now > latestRelevant;
}
