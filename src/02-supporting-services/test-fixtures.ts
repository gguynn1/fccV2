import { Permission, type Entity } from "../01-service-stack/02-identity-service/types.js";
import type { StackQueueItem } from "../01-service-stack/types.js";
import { createMinimalSystemConfig } from "../config/minimal-system-config.js";
import { applyRuntimeSystemConfig } from "../config/runtime-system-config.js";
import type { SystemConfig } from "../index.js";
import {
  ClassifierIntent,
  DispatchPriority,
  EntityType,
  QueueItemSource,
  TopicKey,
} from "../types.js";
import type { SystemState } from "./03-state-service/types.js";
import { ThreadType, type Thread, type ThreadHistory } from "./05-routing-service/types.js";
import { ConfirmationActionType } from "./08-confirmation-service/types.js";

export function fixtureNow(): Date {
  return new Date("2026-04-03T12:00:00.000Z");
}

export function fixtureQueueItem(overrides: Partial<StackQueueItem> = {}): StackQueueItem {
  return {
    id: "fixture_q_1",
    source: QueueItemSource.HumanMessage,
    content: "fixture content",
    concerning: ["participant_1"],
    target_thread: "participant_1_private",
    created_at: fixtureNow(),
    topic: TopicKey.FamilyStatus,
    intent: ClassifierIntent.Request,
    priority: DispatchPriority.Batched,
    ...overrides,
  };
}

export function fixtureThreadHistory(): ThreadHistory {
  return {
    active_topic_context: TopicKey.FamilyStatus,
    last_activity: fixtureNow(),
    recent_messages: [
      {
        id: "m_1",
        from: "participant_1",
        content: "fixture message",
        at: fixtureNow(),
        topic_context: TopicKey.FamilyStatus,
      },
    ],
  };
}

function adultPermissions(): Permission[] {
  return [
    Permission.ApproveFinancial,
    Permission.ApproveSends,
    Permission.ModifySystem,
    Permission.AssignTasks,
    Permission.ViewAllTopics,
    Permission.AddItems,
    Permission.AskQuestions,
  ];
}

function childPermissions(): Permission[] {
  return [Permission.CompleteTasks, Permission.AddItems, Permission.AskQuestions];
}

function createTestEntities(): Entity[] {
  return [
    {
      id: "participant_1",
      type: EntityType.Adult,
      name: "PARTICIPANT 1",
      messaging_identity: "+15550000001",
      permissions: adultPermissions(),
      digest: { morning: "07:00", evening: "20:00" },
    },
    {
      id: "participant_2",
      type: EntityType.Adult,
      name: "PARTICIPANT 2",
      messaging_identity: "+15550000002",
      permissions: adultPermissions(),
      digest: { morning: "07:00", evening: "20:00" },
    },
    {
      id: "participant_3",
      type: EntityType.Child,
      name: "PARTICIPANT 3",
      messaging_identity: "+15550000003",
      permissions: childPermissions(),
      digest: { morning: "07:00", evening: null },
    },
    {
      id: "pet_1",
      type: EntityType.Pet,
      name: "PET",
      messaging_identity: null,
      permissions: [],
      routes_to: ["participant_1"],
      profile: {
        species: "dog",
        breed: null,
        vet: null,
        medications: [],
        care_schedule: [],
      },
    },
  ];
}

function createTestThreads(): Thread[] {
  return [
    {
      id: "participant_1_private",
      type: ThreadType.Private,
      participants: ["participant_1"],
      description: "PARTICIPANT 1 private thread",
    },
    {
      id: "participant_2_private",
      type: ThreadType.Private,
      participants: ["participant_2"],
      description: "PARTICIPANT 2 private thread",
    },
    {
      id: "participant_3_private",
      type: ThreadType.Private,
      participants: ["participant_3"],
      description: "PARTICIPANT 3 private thread",
    },
    {
      id: "couple",
      type: ThreadType.Shared,
      participants: ["participant_1", "participant_2"],
      description: "Adults shared thread",
    },
    {
      id: "family",
      type: ThreadType.Shared,
      participants: ["participant_1", "participant_2", "participant_3"],
      description: "Family shared thread",
    },
  ];
}

export function createTestSystemConfig(): SystemConfig {
  const config = createMinimalSystemConfig();
  config.entities = createTestEntities();
  config.threads = createTestThreads();
  config.daily_rhythm.morning_digest.times = {
    participant_1: "07:00",
    participant_2: "08:15",
    participant_3: null,
  };
  config.daily_rhythm.evening_checkin.times = {
    participant_1: "20:00",
    participant_2: "20:00",
    participant_3: null,
  };
  config.confirmation_gates.always_require_approval = [
    ConfirmationActionType.FinancialAction,
    ConfirmationActionType.SendingOnBehalf,
    ConfirmationActionType.SystemChange,
  ];
  config.dispatch.priority_levels = {
    [DispatchPriority.Immediate]: {
      description: "Time-sensitive outbound.",
      examples: ["pickup soon"],
    },
    [DispatchPriority.Batched]: {
      description: "Can wait for digest windows.",
      examples: ["evening reminder"],
    },
    [DispatchPriority.Silent]: {
      description: "Store without outbound.",
      examples: ["internal log"],
    },
  };
  config.dispatch.outbound_budget = {
    max_unprompted_per_person_per_day: 3,
    max_messages_per_thread_per_hour: 2,
    batch_window_minutes: 30,
    description: "Test outbound budget",
  };
  return config;
}

export function installTestSystemConfig(): SystemConfig {
  const config = createTestSystemConfig();
  applyRuntimeSystemConfig(config);
  return config;
}

export function createTestSystemState(now: Date = fixtureNow()): SystemState {
  return {
    queue: {
      pending: [],
      recently_dispatched: [],
    },
    outbound_budget_tracker: {
      date: now,
      by_person: {},
      by_thread: {},
    },
    escalation_status: {
      active: [],
    },
    calendar: {
      events: [],
    },
    chores: {
      active: [],
      completed_recent: [],
    },
    finances: {
      bills: [],
      expenses_recent: [],
      savings_goals: [],
    },
    grocery: {
      list: [],
      recently_purchased: [],
    },
    health: {
      profiles: [],
    },
    pets: {
      profiles: [],
    },
    school: {
      students: [],
      communications: [],
    },
    travel: {
      trips: [],
    },
    vendors: {
      records: [],
    },
    business: {
      profiles: [],
      leads: [],
    },
    relationship: {
      last_nudge: {
        date: now,
        thread: "",
        content: "",
        response_received: false,
      },
      next_nudge_eligible: now,
      nudge_history: [],
    },
    family_status: {
      current: [],
    },
    meals: {
      planned: [],
      dietary_notes: [],
    },
    maintenance: {
      assets: [],
      items: [],
    },
    confirmations: {
      pending: [],
      recent: [],
    },
    threads: {},
    data_ingest_state: {
      email_monitor: {
        active: false,
        last_poll: null,
        last_sync: null,
        watermark: null,
        processed: [],
        total_processed: 0,
      },
      calendar_sync: {
        active: false,
        last_poll: null,
        last_sync: null,
        watermark: null,
        processed: [],
        total_processed: 0,
      },
      forwarded_messages: {
        active: false,
        last_poll: null,
        last_sync: null,
        watermark: null,
        processed: [],
        total_processed: 0,
      },
    },
    digests: {
      history: [],
    },
  };
}
