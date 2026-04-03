export interface FamilyStatusEntry {
  entity: string;
  status: string;
  updated_at: Date;
  expires_at: Date;
}

export interface FamilyStatusState {
  current: FamilyStatusEntry[];
}

export type FamilyStatusAction =
  | { type: "update_status"; entity: string; status: string; expires_at: Date }
  | { type: "clear_status"; entity: string }
  | { type: "query_status"; entity?: string };
