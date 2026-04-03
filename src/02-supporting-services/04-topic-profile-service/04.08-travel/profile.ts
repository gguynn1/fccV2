import { EscalationLevel, TopicKey } from "../../../types.js";
import type { TopicProfile } from "../types.js";

export interface ThreadCandidate {
  id: string;
  participants: string[];
  is_shared: boolean;
}

export const TRAVEL_TOPIC_PROFILE: TopicProfile = {
  tone: "organized and anticipatory",
  format: "itinerary snapshots, checklists, and countdown plans",
  initiative_style: "countdown-driven reminders with pre and post trip support",
  escalation_level: EscalationLevel.Medium,
  framework_grounding: null,
  response_format: "trip briefs and progress checkpoints",
  cross_topic_connections: [TopicKey.Calendar, TopicKey.Pets, TopicKey.Finances, TopicKey.Grocery],
};

export function routeTravelThread(
  travelers: string[],
  threads: ThreadCandidate[],
  default_entity_for_private_thread: string,
): string {
  const sharedCandidates = threads
    .filter((thread) => thread.is_shared)
    .filter((thread) => travelers.every((traveler) => thread.participants.includes(traveler)))
    .sort((a, b) => b.participants.length - a.participants.length);

  if (sharedCandidates.length > 0) {
    return sharedCandidates[0].id;
  }

  return `${default_entity_for_private_thread}_private`;
}

export function buildTravelCountdownReminders(departure_at: Date, now: Date = new Date()): Date[] {
  const reminderOffsetsDays = [14, 7, 3, 1];
  return reminderOffsetsDays
    .map((offsetDays) => new Date(departure_at.getTime() - offsetDays * 24 * 60 * 60_000))
    .filter((reminderAt) => reminderAt > now);
}

export function buildPostTripFollowUpDate(return_at: Date): Date {
  return new Date(return_at.getTime() + 24 * 60 * 60_000);
}
