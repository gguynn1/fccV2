import { EscalationLevel, TopicKey } from "../../../types.js";
import type { TopicProfile } from "../types.js";
import type { BusinessAction, BusinessLead, BusinessProfile } from "./types.js";

export const BUSINESS_TOPIC_PROFILE: TopicProfile = {
  tone: "professional and organized",
  format: "pipeline snapshots, draft review notes, and booking updates",
  initiative_style: "pipeline-driven alerts and quiet-period follow-up reminders",
  escalation_level: EscalationLevel.None,
  framework_grounding: null,
  response_format: "owner-ready lead summaries and staged draft responses",
  cross_topic_connections: [TopicKey.Finances, TopicKey.Calendar],
};

export function routeBusinessOwnerThread(owner_entity_id: string): string {
  return `${owner_entity_id}_private`;
}

export function canEntityAccessLead(
  requesting_entity_id: string,
  lead_owner_entity_id: string,
): boolean {
  return requesting_entity_id === lead_owner_entity_id;
}

export function requiresBusinessDraftConfirmation(action: BusinessAction): boolean {
  return action.type === "stage_client_draft";
}

export function isBusinessLeadQuiet(
  lead: BusinessLead,
  profile: BusinessProfile,
  now: Date = new Date(),
): boolean {
  if (profile.follow_up_quiet_period_days <= 0) {
    return false;
  }
  const quietUntil = new Date(
    lead.last_contact.getTime() + profile.follow_up_quiet_period_days * 24 * 60 * 60_000,
  );
  return quietUntil <= now;
}

export function businessClientDraftToneHint(profile: BusinessProfile): string {
  const normalized = profile.business_type.trim().toLowerCase();
  if (normalized.includes("photo") || normalized.includes("portrait")) {
    return "Professional, warm, and relationship-focused for client-facing service work.";
  }
  return "Professional, organized, and specific with clear scope and next steps.";
}
