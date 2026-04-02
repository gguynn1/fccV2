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
