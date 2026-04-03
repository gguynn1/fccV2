import { EscalationLevel, TopicKey } from "../../../types.js";
import type { TopicProfile } from "../types.js";

export interface MealThreadCandidate {
  id: string;
  participants: string[];
  is_shared: boolean;
}

export const MEALS_TOPIC_PROFILE: TopicProfile = {
  tone: "collaborative and practical",
  format: "meal options with grocery impact",
  initiative_style: "moderate, timing-aware meal planning suggestions",
  escalation_level: EscalationLevel.None,
  framework_grounding: null,
  response_format: "simple plans and linked ingredient suggestions",
  cross_topic_connections: [TopicKey.Grocery, TopicKey.Health],
};

export function routeMealsPlanningThread(threads: MealThreadCandidate[]): string | null {
  const shared = threads
    .filter((thread) => thread.is_shared)
    .sort((a, b) => b.participants.length - a.participants.length);
  return shared[0]?.id ?? null;
}

export function routeDietaryNoteThread(entity_id: string): string {
  return `${entity_id}_private`;
}

export function suggestGroceryItemsFromMealDescription(description: string): string[] {
  const normalized = description.toLowerCase();
  if (normalized.includes("taco")) {
    return ["tortillas", "ground protein", "cheese", "salsa"];
  }
  if (normalized.includes("pasta")) {
    return ["pasta", "sauce", "parmesan"];
  }
  return [];
}
