import { EscalationLevel, TopicKey } from "../../../types.js";
import type { TopicProfile } from "../types.js";
import type { VendorRecord } from "./types.js";

export const VENDORS_TOPIC_PROFILE: TopicProfile = {
  tone: "businesslike",
  format: "vendor records with stage, cost, and follow-up status",
  initiative_style: "follow-up nudges only when a pending response is flagged",
  escalation_level: EscalationLevel.None,
  framework_grounding: null,
  response_format: "concise vendor history and next step notes",
  cross_topic_connections: [TopicKey.Finances, TopicKey.Maintenance],
};

export function routeVendorToManagingAdultThread(managing_adult_entity_id: string): string {
  return `${managing_adult_entity_id}_private`;
}

export function shouldSendVendorFollowUpReminder(
  vendor: VendorRecord,
  now: Date = new Date(),
): boolean {
  if (!vendor.follow_up_pending || !vendor.follow_up_due) {
    return false;
  }
  return vendor.follow_up_due <= now;
}

export function renderVendorHistoryAnswer(vendor: VendorRecord): string {
  const lastJob = vendor.jobs.slice().sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  if (!lastJob) {
    return `${vendor.name} has no recorded service history yet.`;
  }

  const cost = lastJob.cost === null ? "no logged cost" : `$${lastJob.cost.toFixed(2)}`;
  return `${vendor.name} last handled "${lastJob.description}" on ${lastJob.date.toISOString()} with ${cost}.`;
}
