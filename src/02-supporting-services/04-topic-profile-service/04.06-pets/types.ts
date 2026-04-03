export interface CareLogEntry {
  activity: string;
  by: string;
  at: Date;
}

export interface PetStateProfile {
  entity: string;
  species: string;
  vet: string | null;
  last_vet_visit: Date;
  medications: string[];
  care_log_recent: CareLogEntry[];
  upcoming: string[];
  notes: string[];
}

export interface PetsState {
  profiles: PetStateProfile[];
}

export type PetAction =
  | { type: "log_care"; entity: string; activity: string; by: string }
  | { type: "schedule_appointment"; entity: string; appointment_type: string; date: Date }
  | {
      type: "update_profile";
      entity: string;
      changes: Partial<Pick<PetStateProfile, "vet" | "medications" | "notes">>;
    }
  | { type: "query_pets"; entity?: string };
