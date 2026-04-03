import { EscalationLevel, TopicKey } from "../../../types.js";
import type { TopicProfile } from "../types.js";
import type { GroceryDuplicateCandidate, GroceryItem } from "./types.js";

export const GROCERY_TOPIC_PROFILE: TopicProfile = {
  tone: "utilitarian and brief",
  format: "organized list by section",
  initiative_style: "low initiative unless asked",
  escalation_level: EscalationLevel.None,
  framework_grounding: null,
  response_format: "list output with short acknowledgments",
  cross_topic_connections: [TopicKey.Meals],
};

export function normalizeGroceryItemName(item: string): string {
  return item.trim().toLowerCase();
}

export function detectGroceryDuplicates(
  existing_items: GroceryItem[],
  candidate_items: string[],
): GroceryDuplicateCandidate[] {
  const normalized = new Map<string, string>();
  for (const existing of existing_items) {
    normalized.set(normalizeGroceryItemName(existing.item), existing.id);
  }

  return candidate_items
    .map((item) => normalizeGroceryItemName(item))
    .filter((item) => normalized.has(item))
    .map((item) => ({
      normalized_item: item,
      existing_item_id: normalized.get(item) ?? "",
    }))
    .filter((candidate) => candidate.existing_item_id.length > 0);
}
