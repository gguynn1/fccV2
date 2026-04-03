export interface DigestScheduleBlock {
  description: string;
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
