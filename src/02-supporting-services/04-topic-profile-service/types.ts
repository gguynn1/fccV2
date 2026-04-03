import type {
  ClassifierIntent,
  ClarificationReason,
  EscalationLevel,
  TopicKey,
} from "../../types.js";

import type { CalendarAction } from "./04.01-calendar/types.js";
import type { ChoreAction } from "./04.02-chores/types.js";
import type { FinanceAction } from "./04.03-finances/types.js";
import type { GroceryAction } from "./04.04-grocery/types.js";
import type { HealthAction } from "./04.05-health/types.js";
import type { PetAction } from "./04.06-pets/types.js";
import type { SchoolAction } from "./04.07-school/types.js";
import type { TravelAction } from "./04.08-travel/types.js";
import type { VendorAction } from "./04.09-vendors/types.js";
import type { BusinessAction } from "./04.10-business/types.js";
import type { RelationshipAction } from "./04.11-relationship/types.js";
import type { FamilyStatusAction } from "./04.12-family-status/types.js";
import type { MealAction } from "./04.13-meals/types.js";
import type { MaintenanceAction } from "./04.14-maintenance/types.js";

export interface TopicProfile {
  tone: string;
  format: string;
  initiative_style: string;
  escalation_level: EscalationLevel;
  framework_grounding: string | null;
  response_format: string;
  cross_topic_connections: TopicKey[];
}

export type TopicProfileConfig = Record<TopicKey, TopicProfile>;

export type TopicAction =
  | CalendarAction
  | ChoreAction
  | FinanceAction
  | GroceryAction
  | HealthAction
  | PetAction
  | SchoolAction
  | TravelAction
  | VendorAction
  | BusinessAction
  | RelationshipAction
  | FamilyStatusAction
  | MealAction
  | MaintenanceAction;

export interface TopicClarificationRequest {
  reason: ClarificationReason;
  message_to_participant: string;
  options?: string[];
  original_queue_item_id: string;
  context: Record<string, unknown>;
}

export type TypedActionResolution =
  | {
      kind: "resolved";
      topic: TopicKey;
      intent: ClassifierIntent;
      action: TopicAction;
    }
  | {
      kind: "clarification_required";
      clarification: TopicClarificationRequest;
    };

export * from "./04.01-calendar/types.js";
export * from "./04.02-chores/types.js";
export * from "./04.03-finances/types.js";
export * from "./04.04-grocery/types.js";
export * from "./04.05-health/types.js";
export * from "./04.06-pets/types.js";
export * from "./04.07-school/types.js";
export * from "./04.08-travel/types.js";
export * from "./04.09-vendors/types.js";
export * from "./04.10-business/types.js";
export * from "./04.11-relationship/types.js";
export * from "./04.12-family-status/types.js";
export * from "./04.13-meals/types.js";
export * from "./04.14-maintenance/types.js";
