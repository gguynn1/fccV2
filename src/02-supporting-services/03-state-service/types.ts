import { z } from "zod";

import type { QueueState } from "../../01-service-stack/04-queue/types.js";
import type { CalendarState } from "../04-topic-profile-service/04.01-calendar/types.js";
import type { ChoresState } from "../04-topic-profile-service/04.02-chores/types.js";
import type { FinancesState } from "../04-topic-profile-service/04.03-finances/types.js";
import type { GroceryState } from "../04-topic-profile-service/04.04-grocery/types.js";
import type { HealthState } from "../04-topic-profile-service/04.05-health/types.js";
import type { PetsState } from "../04-topic-profile-service/04.06-pets/types.js";
import type { SchoolState } from "../04-topic-profile-service/04.07-school/types.js";
import type { TravelState } from "../04-topic-profile-service/04.08-travel/types.js";
import type { VendorsState } from "../04-topic-profile-service/04.09-vendors/types.js";
import type { BusinessState } from "../04-topic-profile-service/04.10-business/types.js";
import type { RelationshipState } from "../04-topic-profile-service/04.11-relationship/types.js";
import type { FamilyStatusState } from "../04-topic-profile-service/04.12-family-status/types.js";
import type { MealsState } from "../04-topic-profile-service/04.13-meals/types.js";
import type { MaintenanceState } from "../04-topic-profile-service/04.14-maintenance/types.js";
import type { ThreadHistory } from "../05-routing-service/types.js";
import type { OutboundBudgetTracker } from "../06-budget-service/types.js";
import type { EscalationStatus } from "../07-escalation-service/types.js";
import type { ConfirmationsState } from "../08-confirmation-service/types.js";
import type { DigestsState } from "../01-scheduler-service/types.js";
import type { DataIngestState } from "../02-data-ingest-service/types.js";

export const queueStateRecordSchema = z.object({
  pending: z.array(z.unknown()),
  recently_dispatched: z.array(z.unknown()),
});

export const confirmationsStateRecordSchema = z.object({
  pending: z.array(z.unknown()),
  recent: z.array(z.unknown()),
});

export const digestsStateRecordSchema = z.object({
  history: z.array(z.unknown()),
});

export const escalationStatusRecordSchema = z.object({
  active: z.array(z.unknown()),
});

export const threadHistoryRecordSchema = z.object({
  active_topic_context: z.string(),
  last_activity: z.union([z.string(), z.date()]),
  recent_messages: z.array(z.unknown()),
});

export const topicRecordSchema = z.record(z.string(), z.unknown());

export const outboundBudgetTrackerRecordSchema = z.object({
  date: z.union([z.string(), z.date()]),
  by_person: z.record(z.string(), z.unknown()),
  by_thread: z.record(z.string(), z.unknown()),
});

export const dataIngestStateRecordSchema = z.object({
  email_monitor: z.record(z.string(), z.unknown()),
  calendar_sync: z.record(z.string(), z.unknown()),
  forwarded_messages: z.record(z.string(), z.unknown()),
});

export enum StateSnapshotMode {
  Empty = "empty",
  Seed = "seed",
  Scenario = "scenario",
}

export interface SystemState {
  metadata: {
    snapshot_time: Date;
    description: string;
  };
  queue: QueueState;
  outbound_budget_tracker: OutboundBudgetTracker;
  escalation_status: EscalationStatus;
  calendar: CalendarState;
  chores: ChoresState;
  finances: FinancesState;
  grocery: GroceryState;
  health: HealthState;
  pets: PetsState;
  school: SchoolState;
  travel: TravelState;
  vendors: VendorsState;
  business: BusinessState;
  relationship: RelationshipState;
  family_status: FamilyStatusState;
  meals: MealsState;
  maintenance: MaintenanceState;
  confirmations: ConfirmationsState;
  threads: Record<string, ThreadHistory>;
  data_ingest_state: DataIngestState;
  digests: DigestsState;
}

export interface StateSnapshotEnvelope {
  mode: StateSnapshotMode;
  loaded_at: Date;
  state: SystemState;
}
