import type { TopicKey, EscalationLevel } from "../../types.js";

export enum EscalationStepAction {
  ReminderSent = "reminder_sent",
  FollowUpSent = "follow_up_sent",
  EscalateToBroaderThread = "escalate_to_broader_thread",
}

export interface EscalationProfile {
  label: string;
  applies_to: TopicKey[];
  steps: string[];
}

export interface EscalationHistoryEntry {
  step: number;
  action: EscalationStepAction;
  thread: string;
  at: Date;
}

export interface ActiveEscalation {
  id: string;
  topic: TopicKey;
  item_ref: string;
  profile: EscalationLevel;
  concerning: string[];
  current_step: number;
  history: EscalationHistoryEntry[];
  next_action: EscalationStepAction;
  next_action_at: Date;
  target_thread_for_escalation: string;
}

export interface EscalationStatus {
  active: ActiveEscalation[];
}
