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
