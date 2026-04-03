import { EscalationLevel, TopicKey } from "../../../types.js";
import type { TopicProfile } from "../types.js";
import { AssignmentStatus } from "./types.js";

export interface SchoolReminderTimeline {
  reminder_at: Date;
  follow_up_at: Date;
  parent_escalation_at: Date;
}

export const SCHOOL_TOPIC_PROFILE: TopicProfile = {
  tone: "organized and encouraging for students, concise and actionable for parents",
  format: "deadline trackers and communication summaries",
  initiative_style: "deadline-driven reminders with parent awareness when needed",
  escalation_level: EscalationLevel.Medium,
  framework_grounding: null,
  response_format: "audience-specific updates by assignment status",
  cross_topic_connections: [TopicKey.Calendar],
};

export function routeSchoolStudentThread(student_entity_id: string): string {
  return `${student_entity_id}_private`;
}

export function routeSchoolParentThread(parent_entity_id: string): string {
  return `${parent_entity_id}_private`;
}

export function buildSchoolReminderTimeline(due_date: Date): SchoolReminderTimeline {
  return {
    reminder_at: new Date(due_date.getTime() - 2 * 24 * 60 * 60_000),
    follow_up_at: new Date(due_date.getTime() - 24 * 60 * 60_000),
    parent_escalation_at: new Date(due_date.getTime()),
  };
}

export function shouldEscalateSchoolToParent(
  status: AssignmentStatus,
  due_date: Date,
  now: Date = new Date(),
): boolean {
  if (status === AssignmentStatus.Completed) {
    return false;
  }
  return due_date <= now;
}
