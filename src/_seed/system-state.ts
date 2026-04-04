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
