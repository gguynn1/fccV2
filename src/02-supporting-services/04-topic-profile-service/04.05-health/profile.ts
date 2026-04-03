import { EscalationLevel, TopicKey } from "../../../types.js";
import type { TopicProfile } from "../types.js";
import type { HealthAppointment } from "./types.js";

export const HEALTH_TOPIC_PROFILE: TopicProfile = {
  tone: "attentive and specific",
  format: "structured notes for visits, medication, and follow-up",
  initiative_style: "care-driven reminders and follow-up",
  escalation_level: EscalationLevel.Medium,
  framework_grounding: null,
  response_format: "appointment-focused summaries",
  cross_topic_connections: [TopicKey.Calendar],
};

export function healthReminderTime(appointment: HealthAppointment): Date {
  return new Date(appointment.date.getTime() - 24 * 60 * 60_000);
}

export function healthFollowUpTime(appointment: HealthAppointment): Date {
  return new Date(appointment.date.getTime() + 4 * 60 * 60_000);
}

export function isHealthPrivateThread(thread_id: string, entity_id: string): boolean {
  return thread_id === `${entity_id}_private`;
}
