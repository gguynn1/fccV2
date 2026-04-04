import type { PendingQueueItem } from "../../01-service-stack/04-queue/types.js";

export interface DigestScheduleBlock {
  times: Record<string, string | null>;
}

export interface DigestEligibility {
  exclude_already_dispatched: boolean;
  exclude_stale: boolean;
  staleness_threshold_hours: number;
  suppress_repeats_from_previous_digest: boolean;
  include_unresolved_from_yesterday: boolean;
}

export interface DailyRhythm {
  morning_digest: DigestScheduleBlock;
  evening_checkin: DigestScheduleBlock;
  default_state: string;
  digest_eligibility: DigestEligibility;
}

export interface DigestDelivery {
  delivered_at: Date;
  thread: string;
  included: string[];
}

export interface DigestDay {
  date: Date;
  morning: Record<string, DigestDelivery>;
  evening: Record<string, DigestDelivery> | null;
}

export interface DigestsState {
  history: DigestDay[];
}

export enum ScheduledEventType {
  MorningDigest = "morning_digest",
  EveningCheckin = "evening_checkin",
  ReminderTimer = "reminder_timer",
  FollowUpWindow = "follow_up_window",
  EscalationDeadline = "escalation_deadline",
  BillDueDateAlert = "bill_due_date_alert",
  RelationshipNudgeCooldown = "relationship_nudge_cooldown",
}

export interface DigestWindowDefinition {
  key: ScheduledEventType.MorningDigest | ScheduledEventType.EveningCheckin;
  at: string;
  timezone: string;
}

export interface ScheduledEvent {
  id: string;
  type: ScheduledEventType;
  due_at: Date;
  payload: Record<string, unknown>;
}

export interface SchedulerStartupRecoveryResult {
  produced: PendingQueueItem[];
  skipped_stale: number;
}
