import { EscalationLevel, TopicKey } from "../../../types.js";
import type { TopicProfile } from "../types.js";

export interface PetTravelChecklistItem {
  item: string;
  due_at: Date;
}

export const PETS_TOPIC_PROFILE: TopicProfile = {
  tone: "warm and practical caretaker",
  format: "care history snapshots and travel-prep checklists",
  initiative_style: "gentle overdue-care reminders with no follow-up pressure",
  escalation_level: EscalationLevel.Low,
  framework_grounding: null,
  response_format: "caretaker summaries and simple next steps",
  cross_topic_connections: [TopicKey.Calendar, TopicKey.Vendors],
};

export function routePetToResponsibleAdultThread(responsible_adult_entity_id: string): string {
  return `${responsible_adult_entity_id}_private`;
}

export function isPetMessageTargetAllowed(entity_id: string): boolean {
  return !entity_id.startsWith("pet_");
}

export function isPetCareOverdue(
  last_completed_at: Date,
  interval_days: number,
  now: Date = new Date(),
): boolean {
  const nextDueAt = new Date(last_completed_at.getTime() + interval_days * 24 * 60 * 60_000);
  return nextDueAt <= now;
}

export function buildPetTravelPrepChecklist(departure_at: Date): PetTravelChecklistItem[] {
  return [
    {
      item: "Confirm boarding or pet-sitter plan",
      due_at: new Date(departure_at.getTime() - 7 * 24 * 60 * 60_000),
    },
    {
      item: "Refill food and medication",
      due_at: new Date(departure_at.getTime() - 3 * 24 * 60 * 60_000),
    },
    {
      item: "Share care notes and emergency contacts",
      due_at: new Date(departure_at.getTime() - 24 * 60 * 60_000),
    },
  ];
}
