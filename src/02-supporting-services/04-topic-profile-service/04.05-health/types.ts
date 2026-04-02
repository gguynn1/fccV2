export enum HealthProviderType {
  Dentist = "dentist",
  Primary = "primary",
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  reminder: boolean;
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
  upcoming_appointments: string[];
  notes: string[];
}

export interface HealthState {
  profiles: HealthProfile[];
}
