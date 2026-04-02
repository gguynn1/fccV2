export interface FamilyStatusEntry {
  entity: string;
  status: string;
  updated_at: Date;
  expires_at: Date;
}

export interface FamilyStatusState {
  current: FamilyStatusEntry[];
}
