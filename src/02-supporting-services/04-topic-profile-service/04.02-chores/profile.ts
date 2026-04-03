import { EscalationLevel } from "../../../types.js";
import type { TopicProfile } from "../types.js";
import { ChoreEscalationStage } from "./types.js";

export const CHORES_TOPIC_PROFILE: TopicProfile = {
  tone: "direct and operational",
  format: "clear task ownership and deadline",
  initiative_style: "structured reminders with follow-up and escalation",
  escalation_level: EscalationLevel.High,
  framework_grounding: null,
  response_format: "assignment confirmations and completion checks",
  cross_topic_connections: [],
};

export interface ChoreEscalationTimeline {
  reminder_at: Date;
  follow_up_at: Date;
  escalation_at: Date;
}

export function buildChoreEscalationTimeline(due: Date): ChoreEscalationTimeline {
  const reminder_at = new Date(due.getTime() - 2 * 60 * 60_000);
  const follow_up_at = new Date(due.getTime() - 30 * 60_000);
  const escalation_at = new Date(due.getTime() + 1 * 60_000);
  return { reminder_at, follow_up_at, escalation_at };
}

export function nextChoreEscalationStage(
  current: ChoreEscalationStage | null,
): ChoreEscalationStage {
  if (current === null) {
    return ChoreEscalationStage.Reminder;
  }
  switch (current) {
    case ChoreEscalationStage.Reminder:
      return ChoreEscalationStage.FollowUp;
    case ChoreEscalationStage.FollowUp:
      return ChoreEscalationStage.BroaderThread;
    case ChoreEscalationStage.BroaderThread:
      return ChoreEscalationStage.DigestFlag;
    case ChoreEscalationStage.DigestFlag:
      return ChoreEscalationStage.DigestFlag;
  }
}
