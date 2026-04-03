export interface FamilyStatusEntry {
  entity: string;
  status: string;
  eta?: string | null;
  location_snapshot?: string | null;
  updated_at: Date;
  expires_at: Date;
}

export interface FamilyStatusFreshnessWindow {
  expires_after_minutes: number;
}

export interface FamilyStatusState {
  current: FamilyStatusEntry[];
  freshness_window?: FamilyStatusFreshnessWindow;
}

export type FamilyStatusAction =
  | {
      type: "update_status";
      entity: string;
      status: string;
      eta?: string;
      location_snapshot?: string;
      expires_at: Date;
    }
  | { type: "clear_status"; entity: string }
  | { type: "expire_stale_status"; now: Date }
  | { type: "query_status"; entity?: string };
