export enum HealthProviderType {
  Primary = "primary",
  Dentist = "dentist",
  Specialist = "specialist",
  Optometrist = "optometrist",
  Therapist = "therapist",
  Urgent = "urgent",
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  reminder: boolean;
  reminder_time?: string;
}

export interface HealthProvider {
  type: HealthProviderType;
  name: string;
  location: string;
  last_visit: Date;
}

export interface HealthProfile {
  entity: string;
  medications: Medication[];
  allergies: string[];
  providers: HealthProvider[];
  upcoming_appointments: HealthAppointment[];
  notes: string[];
}

export interface HealthState {
  profiles: HealthProfile[];
}

export interface HealthAppointment {
  id: string;
  entity: string;
  provider_type: HealthProviderType;
  date: Date;
  location?: string;
  calendar_event_id?: string;
  follow_up_needed?: boolean;
}

export interface ProviderVisitNote {
  provider_type: HealthProviderType;
  note: string;
  created_at: Date;
}

export type HealthAction =
  | {
      type: "add_appointment";
      entity: string;
      provider_type: HealthProviderType;
      date: Date;
      location?: string;
    }
  | {
      type: "log_visit";
      entity: string;
      provider_type: HealthProviderType;
      notes: string;
      follow_up_needed?: boolean;
    }
  | { type: "update_medication"; entity: string; medication: Medication }
  | { type: "query_health"; entity?: string };
