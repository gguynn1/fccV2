import { z } from "zod";

import type { QueueState } from "../../01-service-stack/04-queue/types.js";
import type { DigestsState } from "../01-scheduler-service/types.js";
import type { DataIngestState } from "../02-data-ingest-service/types.js";
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

const zodDateField = z.union([z.date(), z.string()]);
const zodNullableDate = z.union([z.date(), z.string(), z.null()]);
const zodNullableString = z.union([z.string(), z.null()]);

export const calendarStateSchema = z.object({
  events: z.array(
    z
      .object({
        id: z.string(),
        title: z.string(),
        concerning: z.array(z.string()),
        topic: z.string(),
        status: z.string(),
        created_by: z.string(),
        created_at: zodDateField,
      })
      .passthrough(),
  ),
});

export const choresStateSchema = z.object({
  active: z.array(
    z
      .object({
        id: z.string(),
        task: z.string(),
        assigned_to: z.string(),
        assigned_by: z.string(),
        assigned_in_thread: z.string(),
        due: zodDateField,
        status: z.string(),
        escalation_step: z.number(),
      })
      .passthrough(),
  ),
  completed_recent: z.array(
    z
      .object({
        id: z.string(),
        task: z.string(),
        assigned_to: z.string(),
        completed_at: zodDateField,
        completed_via: z.string(),
        response: z.string(),
      })
      .passthrough(),
  ),
});

export const financesStateSchema = z.object({
  bills: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        amount: z.number(),
        due_date: zodDateField,
        status: z.string(),
        reminder_sent: z.boolean(),
        recurring: z.string(),
      })
      .passthrough(),
  ),
  expenses_recent: z.array(
    z
      .object({
        id: z.string(),
        description: z.string(),
        amount: z.number(),
        date: zodDateField,
        logged_by: z.string(),
        logged_via: z.string(),
        confirmed: z.boolean(),
      })
      .passthrough(),
  ),
  savings_goals: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        target: z.number(),
        current: z.number(),
        percent: z.number(),
        deadline: zodNullableDate,
        pace_status: z.string(),
      })
      .passthrough(),
  ),
});

export const groceryStateSchema = z.object({
  list: z.array(
    z
      .object({
        id: z.string(),
        item: z.string(),
        section: z.string(),
        added_by: z.string(),
        added_at: zodDateField,
      })
      .passthrough(),
  ),
  recently_purchased: z.array(
    z
      .object({
        item: z.string(),
        purchased_by: z.string(),
        purchased_at: zodDateField,
      })
      .passthrough(),
  ),
});

export const healthStateSchema = z.object({
  profiles: z.array(
    z
      .object({
        entity: z.string(),
        medications: z.array(z.unknown()),
        allergies: z.array(z.string()),
        providers: z.array(z.unknown()),
        upcoming_appointments: z.array(z.unknown()),
        notes: z.array(z.string()),
      })
      .passthrough(),
  ),
});

export const petsStateSchema = z.object({
  profiles: z.array(
    z
      .object({
        entity: z.string(),
        species: z.string(),
        vet: zodNullableString,
        last_vet_visit: zodDateField,
        medications: z.array(z.unknown()),
        care_log_recent: z.array(z.unknown()),
        upcoming: z.array(z.string()),
        notes: z.array(z.string()),
      })
      .passthrough(),
  ),
});

export const schoolStateSchema = z.object({
  students: z.array(
    z
      .object({
        entity: z.string(),
        assignments: z.array(z.unknown()),
        completed_recent: z.array(z.unknown()),
      })
      .passthrough(),
  ),
  communications: z.array(z.unknown()).optional(),
});

export const travelStateSchema = z.object({
  trips: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        dates: z.object({ start: zodDateField, end: zodDateField }),
        travelers: z.array(z.string()),
        status: z.string(),
        checklist: z.array(z.unknown()),
        budget_link: zodNullableString,
        notes: z.array(z.string()),
      })
      .passthrough(),
  ),
});

export const vendorsStateSchema = z.object({
  records: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        jobs: z.array(z.unknown()),
        contact: z.string(),
        managed_by: z.string(),
        follow_up_pending: z.boolean(),
      })
      .passthrough(),
  ),
});

export const businessStateSchema = z.object({
  profiles: z.array(
    z
      .object({
        entity: z.string(),
        business_type: z.string(),
        business_name: z.string(),
        follow_up_quiet_period_days: z.number(),
      })
      .passthrough(),
  ),
  leads: z.array(
    z
      .object({
        id: z.string(),
        owner: z.string(),
        inquiry_date: zodDateField,
        last_contact: zodDateField,
        draft_reply: zodNullableString,
        notes: z.union([z.string(), z.array(z.string())]),
      })
      .passthrough(),
  ),
});

export const relationshipStateSchema = z.object({
  last_nudge: z
    .object({
      date: zodDateField,
      thread: z.string(),
      content: z.string(),
      response_received: z.boolean(),
    })
    .passthrough(),
  next_nudge_eligible: zodDateField,
  nudge_history: z.array(z.unknown()),
  cooldown_days: z.number().optional(),
  quiet_window: z
    .object({
      is_busy_period: z.boolean(),
      is_stressful_period: z.boolean(),
    })
    .optional(),
  framework_grounding: z
    .object({
      ifs: z.boolean(),
      emotionally_focused: z.boolean(),
      attachment_based: z.boolean(),
    })
    .optional(),
});

export const familyStatusStateSchema = z.object({
  current: z.array(
    z
      .object({
        entity: z.string(),
        status: z.string(),
        updated_at: zodDateField,
        expires_at: zodDateField,
      })
      .passthrough(),
  ),
  freshness_window: z
    .object({
      expires_after_minutes: z.number(),
    })
    .optional(),
});

export const mealsStateSchema = z.object({
  planned: z.array(
    z
      .object({
        id: z.string(),
        date: zodDateField,
        meal_type: z.string(),
        description: z.string(),
        planned_by: z.string(),
        status: z.string(),
      })
      .passthrough(),
  ),
  dietary_notes: z.array(
    z
      .object({
        entity: z.string(),
        note: z.string(),
        added_at: zodDateField,
      })
      .passthrough(),
  ),
});

export const maintenanceStateSchema = z.object({
  assets: z.array(
    z
      .object({
        id: z.string(),
        type: z.string(),
        name: z.string(),
        details: z.record(z.string(), z.string()),
      })
      .passthrough(),
  ),
  items: z.array(
    z
      .object({
        id: z.string(),
        asset_id: z.string(),
        task: z.string(),
        interval: z.string(),
        last_performed: zodNullableDate,
        next_due: zodNullableDate,
        responsible: z.string(),
        status: z.string(),
        history: z.array(z.unknown()),
      })
      .passthrough(),
  ),
});

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
  Scenario = "scenario",
}

export interface SystemState {
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
