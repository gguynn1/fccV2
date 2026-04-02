export interface DigestScheduleBlock {
  description: string;
  times: Record<string, string | null>;
}

export interface DailyRhythm {
  morning_digest: DigestScheduleBlock;
  evening_checkin: DigestScheduleBlock;
  default_state: string;
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
