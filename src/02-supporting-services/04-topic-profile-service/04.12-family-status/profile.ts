import { EscalationLevel } from "../../../types.js";
import type { TopicProfile } from "../types.js";
import type { FamilyStatusEntry } from "./types.js";

export interface StatusThreadCandidate {
  id: string;
  participants: string[];
}

export const FAMILY_STATUS_TOPIC_PROFILE: TopicProfile = {
  tone: "brief and functional",
  format: "current-status snapshots with concise updates",
  initiative_style: "minimal, mostly on-request with occasional transit checks",
  escalation_level: EscalationLevel.Low,
  framework_grounding: null,
  response_format: "quick readbacks by entity",
  cross_topic_connections: [],
};

export function isFamilyStatusEntryActive(
  entry: FamilyStatusEntry,
  now: Date = new Date(),
): boolean {
  return entry.expires_at > now;
}

export function expireFamilyStatusEntries(
  entries: FamilyStatusEntry[],
  now: Date = new Date(),
): FamilyStatusEntry[] {
  return entries.filter((entry) => isFamilyStatusEntryActive(entry, now));
}

export function shouldRequestTransitEta(is_calendar_transit_window: boolean): boolean {
  return is_calendar_transit_window;
}

export function routeFamilyStatusToNarrowestThread(
  concerning_entities: string[],
  thread_candidates: StatusThreadCandidate[],
): string | null {
  const matching = thread_candidates
    .filter((thread) => concerning_entities.every((entity) => thread.participants.includes(entity)))
    .sort((a, b) => a.participants.length - b.participants.length);

  return matching[0]?.id ?? null;
}
