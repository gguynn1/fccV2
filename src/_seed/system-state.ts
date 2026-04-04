import type { SystemState } from "../index.js";
import {
  seedDigests,
  seedEscalationStatus,
  seedOutboundBudgetTracker,
  seedThreadHistories,
} from "./__SRC/derivable-from-entities.js";
import {
  seedBusiness,
  seedCalendar,
  seedChores,
  seedConfirmations,
  seedDataIngestState,
  seedFamilyStatus,
  seedFinances,
  seedGrocery,
  seedHealth,
  seedMaintenance,
  seedMeals,
  seedPets,
  seedQueue,
  seedRelationship,
  seedSchool,
  seedTravel,
  seedVendors,
} from "./__SRC/universal-defaults.js";

export const systemState: SystemState = {
  metadata: {
    snapshot_time: new Date("2026-04-02T17:05:00-07:00"),
    description:
      "Seed state — the complete initial runtime snapshot used to populate the database on first boot. Contains representative sample data across all 14 topics: pending and recently dispatched queue items, outbound budget tracker, escalation status, per-topic records (calendar events, chores, bills, grocery list, health profiles, pet care, school assignments, travel plans, vendor records, business leads and profiles, relationship nudge history, family status, meal plans, maintenance assets and schedules), confirmations, thread histories, data ingest state, and digests. This file is never modified at runtime. Schema changes must be reflected here to keep the seed valid and complete.",
  },

  queue: seedQueue,
  outbound_budget_tracker: seedOutboundBudgetTracker,
  escalation_status: seedEscalationStatus,

  calendar: seedCalendar,
  chores: seedChores,
  finances: seedFinances,
  grocery: seedGrocery,
  health: seedHealth,
  pets: seedPets,
  school: seedSchool,
  travel: seedTravel,
  vendors: seedVendors,
  business: seedBusiness,
  relationship: seedRelationship,
  family_status: seedFamilyStatus,
  meals: seedMeals,
  maintenance: seedMaintenance,

  confirmations: seedConfirmations,
  threads: seedThreadHistories,
  data_ingest_state: seedDataIngestState,
  digests: seedDigests,
};
