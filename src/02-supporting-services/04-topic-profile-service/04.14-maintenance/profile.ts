import { EscalationLevel, TopicKey } from "../../../types.js";
import type { TopicProfile } from "../types.js";
import {
  type MaintenanceHistoryEntry,
  type MaintenanceItem,
  MaintenanceInterval,
  MaintenanceStatus,
} from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_WINDOW_DAYS = 7;

export interface MaintenanceThreadCandidate {
  id: string;
  participants: string[];
  is_shared: boolean;
}

export interface MaintenanceCrossTopicReference {
  topic: TopicKey;
  reason: string;
}

export const MAINTENANCE_TOPIC_PROFILE: TopicProfile = {
  tone: "practical and reminder-driven",
  format: "service schedules and history logs",
  initiative_style: "cycle-driven reminders based on last-performed dates and intervals",
  escalation_level: EscalationLevel.Low,
  framework_grounding: null,
  response_format: "maintenance schedule snapshots with due status and cost history",
  cross_topic_connections: [TopicKey.Vendors, TopicKey.Finances, TopicKey.Calendar],
};

export function calculateNextDueDate(
  last_performed: Date | null,
  interval: MaintenanceInterval,
  now: Date = new Date(),
): Date | null {
  if (interval === MaintenanceInterval.AsNeeded || interval === MaintenanceInterval.MileageBased) {
    return null;
  }

  const baseline = last_performed ?? now;
  const nextDue = new Date(baseline);
  if (interval === MaintenanceInterval.Monthly) {
    nextDue.setDate(nextDue.getDate() + 30);
  } else if (interval === MaintenanceInterval.Quarterly) {
    nextDue.setDate(nextDue.getDate() + 90);
  } else if (interval === MaintenanceInterval.Biannual) {
    nextDue.setDate(nextDue.getDate() + 182);
  } else if (interval === MaintenanceInterval.Annual) {
    nextDue.setDate(nextDue.getDate() + 365);
  }

  return nextDue;
}

export function getMaintenanceStatus(
  item: Pick<MaintenanceItem, "next_due">,
  now: Date = new Date(),
): MaintenanceStatus {
  if (!item.next_due) {
    return MaintenanceStatus.Current;
  }

  if (item.next_due.getTime() < now.getTime()) {
    return MaintenanceStatus.Overdue;
  }

  const dueSoonBoundary = now.getTime() + DUE_SOON_WINDOW_DAYS * DAY_MS;
  return item.next_due.getTime() <= dueSoonBoundary
    ? MaintenanceStatus.DueSoon
    : MaintenanceStatus.Current;
}

export function routeMaintenanceThread(
  item: Pick<MaintenanceItem, "responsible" | "household_wide">,
  threads: MaintenanceThreadCandidate[],
): string | null {
  if (!item.household_wide) {
    return `${item.responsible}_private`;
  }

  const shared = threads
    .filter((thread) => thread.is_shared && thread.participants.includes(item.responsible))
    .sort((a, b) => a.participants.length - b.participants.length);
  return shared[0]?.id ?? null;
}

export function getMaintenanceCrossTopicReferences(
  item: Pick<MaintenanceItem, "next_due" | "history">,
  now: Date = new Date(),
): MaintenanceCrossTopicReference[] {
  const references: MaintenanceCrossTopicReference[] = [];
  const status = getMaintenanceStatus(item, now);

  if (status !== MaintenanceStatus.Current) {
    references.push({
      topic: TopicKey.Calendar,
      reason: "Due or overdue maintenance can be scheduled as a calendar event.",
    });
  }

  const latestCost = [...item.history]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .find((entry) => typeof entry.cost === "number" && entry.cost > 0);
  if (latestCost) {
    references.push({
      topic: TopicKey.Finances,
      reason: "Maintenance cost should be tracked in finances.",
    });
  }

  references.push({
    topic: TopicKey.Vendors,
    reason: "Professional service can be tracked in vendor records when needed.",
  });
  return references;
}

export function appendMaintenanceHistory(
  item: MaintenanceItem,
  entry: Omit<MaintenanceHistoryEntry, "id">,
): MaintenanceItem {
  const nextHistoryEntry: MaintenanceHistoryEntry = {
    ...entry,
    id: `maint_hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  const nextDue = calculateNextDueDate(entry.date, item.interval, entry.date);
  const nextItem: MaintenanceItem = {
    ...item,
    last_performed: entry.date,
    next_due: nextDue,
    status: getMaintenanceStatus({ next_due: nextDue }, entry.date),
    history: [...item.history, nextHistoryEntry].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    ),
  };
  return nextItem;
}

export function classifyMaintenanceIntent(content: string, context_topic?: TopicKey): TopicKey {
  const normalized = content.toLowerCase();

  if (normalized.includes("plumber") || normalized.includes("electrician")) {
    return TopicKey.Vendors;
  }
  if (normalized.includes("change the furnace filter") && context_topic !== TopicKey.Maintenance) {
    return TopicKey.Chores;
  }
  if (
    normalized.includes("when was") ||
    normalized.includes("last changed") ||
    normalized.includes("maintenance")
  ) {
    return TopicKey.Maintenance;
  }

  return context_topic ?? TopicKey.Maintenance;
}
