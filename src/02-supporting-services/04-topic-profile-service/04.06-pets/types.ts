export enum PetCareCategory {
  VetVisit = "vet_visit",
  Medication = "medication",
  Grooming = "grooming",
  Boarding = "boarding",
  GeneralCare = "general_care",
}

export interface CareLogEntry {
  category?: PetCareCategory;
  activity: string;
  by: string;
  at: Date;
  notes?: string;
}

export interface VetVisitRecord {
  date: Date;
  clinic_name: string | null;
  reason: string;
  follow_up_due: Date | null;
}

export interface PetMedicationPlan {
  medication: string;
  dosage: string;
  schedule: string;
  active: boolean;
  started_at: Date;
  ends_at: Date | null;
}

export interface GroomingRecord {
  date: Date;
  service: string;
  provider: string | null;
}

export interface BoardingPlan {
  start_date: Date;
  end_date: Date;
  provider: string;
  confirmed: boolean;
}

export interface PetStateProfile {
  entity: string;
  species: string;
  responsible_adult?: string;
  vet: string | null;
  last_vet_visit: Date;
  medications: PetMedicationPlan[];
  care_log_recent: CareLogEntry[];
  grooming_history?: GroomingRecord[];
  boarding_history?: BoardingPlan[];
  vet_history?: VetVisitRecord[];
  upcoming: string[];
  notes: string[];
}

export interface PetsState {
  profiles: PetStateProfile[];
}

export type PetAction =
  | {
      type: "log_care";
      entity: string;
      activity: string;
      by: string;
      category?: PetCareCategory;
      notes?: string;
    }
  | { type: "schedule_appointment"; entity: string; appointment_type: string; date: Date }
  | { type: "record_vet_visit"; entity: string; visit: VetVisitRecord }
  | { type: "set_medication"; entity: string; medications: PetMedicationPlan[] }
  | { type: "schedule_boarding"; entity: string; plan: BoardingPlan }
  | { type: "record_grooming"; entity: string; grooming: GroomingRecord }
  | {
      type: "update_profile";
      entity: string;
      changes: Partial<Pick<PetStateProfile, "responsible_adult" | "vet" | "notes">>;
    }
  | { type: "query_pets"; entity?: string };
