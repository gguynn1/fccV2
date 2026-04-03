import { EscalationLevel } from "../../../types.js";
import type { TopicProfile } from "../types.js";
import { NudgeType, type NudgeHistoryEntry, type RelationshipQuietWindowState } from "./types.js";

const RELATIONSHIP_ALLOWED_THREAD = "couple";

export const RELATIONSHIP_TOPIC_PROFILE: TopicProfile = {
  tone: "warm, brief, and never clinical",
  format: "short connection prompts and open-ended reflection starters",
  initiative_style: "soft nudges during quiet windows with no follow-up pressure",
  escalation_level: EscalationLevel.Low,
  framework_grounding:
    "Internal Family Systems Therapy, emotionally focused approaches, and attachment-based practices",
  response_format: "single prompt with light context",
  cross_topic_connections: [],
};

export function isRelationshipThreadAllowed(thread_id: string): boolean {
  return thread_id === RELATIONSHIP_ALLOWED_THREAD;
}

export function isRelationshipQuietWindow(state: RelationshipQuietWindowState): boolean {
  return !state.is_busy_period && !state.is_stressful_period;
}

export function shouldRelationshipNudgeDisappearWhenIgnored(ignored: boolean): boolean {
  return ignored;
}

export function nextRelationshipNudgeEligibleAt(last_nudge_at: Date, cooldown_days: number): Date {
  return new Date(last_nudge_at.getTime() + cooldown_days * 24 * 60 * 60_000);
}

const NUDGE_ROTATION: NudgeType[] = [
  NudgeType.AppreciationPrompt,
  NudgeType.ConversationStarter,
  NudgeType.ConnectionPrompt,
  NudgeType.DateNightSuggestion,
  NudgeType.GratitudeExercise,
];

export function selectNextRelationshipNudgeType(history: NudgeHistoryEntry[]): NudgeType {
  const recentType = history.slice().sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.type;
  if (!recentType) {
    return NUDGE_ROTATION[0];
  }
  const currentIndex = NUDGE_ROTATION.indexOf(recentType);
  return NUDGE_ROTATION[(currentIndex + 1) % NUDGE_ROTATION.length];
}
