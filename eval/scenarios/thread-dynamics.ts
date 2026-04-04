import { ClassifierIntent, DispatchPriority, TopicKey } from "../../src/index.js";
import type { EvalScenarioDefinition } from "../types.js";

export const threadDynamicsName = "thread-dynamics";

export const threadDynamicsScenarios: EvalScenarioDefinition[] = [
  // --- Pronoun carry-forward ---
  {
    id: "td-pronoun-calendar-reschedule",
    title: "Calendar reschedule via deictic reference carries topic forward",
    category: "pipeline",
    prompt_input: {
      message: "Add dentist appointment Friday",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.Health,
      intent: ClassifierIntent.Request,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Add dentist appointment Friday",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Health,
          intent: ClassifierIntent.Request,
        },
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message: "Health record update: the dentist appointment on Friday is logged.",
      },
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Actually make it Saturday",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Health,
          intent: ClassifierIntent.Update,
          target_thread: "participant_1_private",
        },
      },
    ],
  },

  {
    id: "td-pronoun-grocery-addition",
    title: "Follow-up addition sticks to grocery topic",
    category: "pipeline",
    prompt_input: {
      message: "Add milk and eggs to the list",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Grocery,
      intent: ClassifierIntent.Request,
      target_thread: "family",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "family",
        message: "Add milk and eggs to the list",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Grocery,
          intent: ClassifierIntent.Request,
        },
      },
      {
        role: "assistant",
        thread_id: "family",
        message: "Grocery list update: added milk, eggs.",
      },
      {
        role: "participant",
        thread_id: "family",
        message: "Oh and bread too",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Grocery,
          target_thread: "family",
        },
      },
    ],
  },

  // --- Correction / negation ---
  {
    id: "td-correction-chore-switch",
    title: "Correction switches referent within same topic",
    category: "pipeline",
    prompt_input: {
      message: "Mark the chore as done",
      concerning: ["participant_3"],
      origin_thread: "participant_3_private",
    },
    expected: {
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      target_thread: "participant_3_private",
      priority: DispatchPriority.Batched,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "participant_3_private",
        message: "Mark the chore as done",
        entity_id: "participant_3",
        expected: {
          topic: TopicKey.Chores,
        },
      },
      {
        role: "assistant",
        thread_id: "participant_3_private",
        message: "Which chore should I mark as done?",
      },
      {
        role: "participant",
        thread_id: "participant_3_private",
        message: "The laundry one",
        entity_id: "participant_3",
        expected: {
          topic: TopicKey.Chores,
          intent: ClassifierIntent.Response,
        },
      },
    ],
  },

  {
    id: "td-negation-cancel-redirect",
    title: "Negation followed by correction maintains topic",
    category: "pipeline",
    prompt_input: {
      message: "Cancel the dentist",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.Health,
      intent: ClassifierIntent.Cancellation,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Cancel the dentist",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Health,
          intent: ClassifierIntent.Cancellation,
        },
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message: "Which dentist appointment should I cancel?",
      },
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "No wait, not that. Cancel the checkup instead",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Health,
          intent: ClassifierIntent.Cancellation,
        },
      },
    ],
  },

  // --- Clarification round-trip ---
  {
    id: "td-clarification-calendar-cancel",
    title: "Clarification response resolves ambiguous calendar cancel",
    category: "pipeline",
    prompt_input: {
      message: "Cancel it",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.Calendar,
      intent: ClassifierIntent.Cancellation,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Schedule a checkup for Monday",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Health,
          intent: ClassifierIntent.Request,
        },
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message: "Health record update: checkup scheduled for Monday.",
      },
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Cancel it",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Health,
          intent: ClassifierIntent.Cancellation,
        },
      },
    ],
  },

  {
    id: "td-clarification-finance-confirm",
    title: "Confirmation response after financial action request",
    category: "confirmation",
    prompt_input: {
      message: "Log $45 for the electric bill",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "couple",
    },
    expected: {
      topic: TopicKey.Finances,
      intent: ClassifierIntent.Request,
      target_thread: "couple",
      priority: DispatchPriority.Immediate,
      confirmation_required: true,
    },
    turns: [
      {
        role: "participant",
        thread_id: "couple",
        message: "Log $45 for the electric bill",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Finances,
          intent: ClassifierIntent.Request,
          confirmation_required: true,
        },
      },
      {
        role: "assistant",
        thread_id: "couple",
        message: "Please confirm: log expense. Reply yes or no.",
      },
      {
        role: "participant",
        thread_id: "couple",
        message: "Yes",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Finances,
          intent: ClassifierIntent.Confirmation,
        },
      },
    ],
  },

  // --- Topic pivot ---
  {
    id: "td-topic-pivot-grocery-to-finance",
    title: "Clean topic switch from grocery to finance query",
    category: "classification",
    prompt_input: {
      message: "Add milk to the grocery list",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Grocery,
      intent: ClassifierIntent.Request,
      target_thread: "family",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "family",
        message: "Add milk to the grocery list",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Grocery,
        },
      },
      {
        role: "assistant",
        thread_id: "family",
        message: "Grocery list update: added milk.",
      },
      {
        role: "participant",
        thread_id: "couple",
        message: "What's our budget looking like this month?",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Finances,
          intent: ClassifierIntent.Query,
          target_thread: "couple",
        },
      },
    ],
  },

  {
    id: "td-topic-pivot-health-to-school",
    title: "Topic switches cleanly from health to school",
    category: "classification",
    prompt_input: {
      message: "Schedule the physical for next week",
      concerning: ["participant_3"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Health,
      intent: ClassifierIntent.Request,
      target_thread: "participant_3_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "family",
        message: "Schedule the physical for next week",
        entity_id: "participant_3",
        expected: {
          topic: TopicKey.Health,
        },
      },
      {
        role: "assistant",
        thread_id: "participant_3_private",
        message: "Health record update: physical scheduled for next week.",
      },
      {
        role: "participant",
        thread_id: "family",
        message: "Any homework due tomorrow?",
        entity_id: "participant_3",
        expected: {
          topic: TopicKey.School,
          intent: ClassifierIntent.Query,
        },
      },
    ],
  },

  // --- Digest follow-up ---
  {
    id: "td-digest-then-action",
    title: "Digest query followed by action on mentioned content",
    category: "pipeline",
    prompt_input: {
      message: "What's on the schedule today?",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.Calendar,
      intent: ClassifierIntent.Query,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "What's on the schedule today?",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Calendar,
          intent: ClassifierIntent.Query,
        },
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message: "Schedule summary: 3pm meeting, 5pm dentist appointment.",
      },
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Move the dentist to 4pm",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Health,
          intent: ClassifierIntent.Update,
        },
      },
    ],
  },

  // --- Mixed-intent ---
  {
    id: "td-mixed-grocery-and-chore",
    title: "Mixed-intent shared-thread request currently resolves chores-first",
    category: "pipeline",
    prompt_input: {
      message: "Pick up groceries and clean the kitchen",
      concerning: ["participant_1", "participant_2", "participant_3"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      target_thread: "family",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "family",
        message: "Pick up groceries and clean the kitchen",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Chores,
        },
      },
    ],
    simulation: { parity_assertion: { against_simulator: false } },
  },

  // --- Emotional / conversational ---
  {
    id: "td-emotional-then-practical",
    title: "Emotional message followed by practical follow-up in same topic",
    category: "composition",
    prompt_input: {
      message: "Ugh I totally forgot about the school field trip",
      concerning: ["participant_1", "participant_3"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.School,
      intent: ClassifierIntent.Request,
      target_thread: "participant_3_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "family",
        message: "Ugh I totally forgot about the school field trip",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.School,
        },
      },
      {
        role: "assistant",
        thread_id: "participant_3_private",
        message: "School summary: the field trip has been noted.",
      },
      {
        role: "participant",
        thread_id: "family",
        message: "When is it exactly?",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.School,
          intent: ClassifierIntent.Query,
        },
      },
    ],
  },

  // --- Shared-thread dynamics ---
  {
    id: "td-shared-thread-meal-planning",
    title: "Two participants collaborate on meal planning in shared thread",
    category: "routing",
    prompt_input: {
      message: "What should we have for dinner tonight?",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "couple",
    },
    expected: {
      topic: TopicKey.Meals,
      intent: ClassifierIntent.Query,
      target_thread: "couple",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "couple",
        message: "What should we have for dinner tonight?",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Meals,
          intent: ClassifierIntent.Query,
          target_thread: "couple",
        },
      },
      {
        role: "assistant",
        thread_id: "couple",
        message: "No meals planned for tonight yet. Any ideas?",
      },
      {
        role: "participant",
        thread_id: "couple",
        message: "How about tacos?",
        entity_id: "participant_2",
        expected: {
          topic: TopicKey.Meals,
          target_thread: "couple",
        },
      },
    ],
  },

  // --- Relationship topic in couple thread ---
  {
    id: "td-relationship-date-planning",
    title: "Date night planning with follow-up detail in couple thread",
    category: "routing",
    prompt_input: {
      message: "Let's plan a date night this weekend",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "couple",
    },
    expected: {
      topic: TopicKey.Relationship,
      intent: ClassifierIntent.Request,
      target_thread: "couple",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "couple",
        message: "Let's plan a date night this weekend",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Relationship,
          target_thread: "couple",
        },
      },
      {
        role: "assistant",
        thread_id: "couple",
        message: "Couple reminder: date night this weekend is on the calendar.",
      },
      {
        role: "participant",
        thread_id: "couple",
        message: "Actually make it Friday evening",
        entity_id: "participant_2",
        expected: {
          topic: TopicKey.Relationship,
          intent: ClassifierIntent.Update,
          target_thread: "couple",
        },
      },
    ],
  },

  // --- Travel planning with correction ---
  {
    id: "td-travel-hotel-correction",
    title: "Travel hotel booking with correction on date",
    category: "pipeline",
    prompt_input: {
      message: "Book a hotel for the trip next Thursday",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "couple",
    },
    expected: {
      topic: TopicKey.Travel,
      intent: ClassifierIntent.Request,
      target_thread: "couple",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "couple",
        message: "Book a hotel for the trip next Thursday",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Travel,
          intent: ClassifierIntent.Request,
          target_thread: "couple",
        },
      },
      {
        role: "assistant",
        thread_id: "couple",
        message: "Travel note: hotel for next Thursday is noted.",
      },
      {
        role: "participant",
        thread_id: "couple",
        message: "Actually it should be Friday, not Thursday",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Travel,
          intent: ClassifierIntent.Update,
          target_thread: "couple",
        },
      },
    ],
  },

  // --- Private thread chore escalation simulation ---
  {
    id: "td-chore-assign-then-query",
    title: "Chore assignment followed by status query in same thread",
    category: "pipeline",
    prompt_input: {
      message: "Take out the trash before dinner",
      concerning: ["participant_3"],
      origin_thread: "participant_3_private",
    },
    expected: {
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      target_thread: "participant_3_private",
      priority: DispatchPriority.Batched,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "participant_3_private",
        message: "Take out the trash before dinner",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Chores,
          intent: ClassifierIntent.Request,
          target_thread: "participant_3_private",
        },
      },
      {
        role: "assistant",
        thread_id: "participant_3_private",
        message: "Chore assigned: take out the trash before dinner.",
      },
      {
        role: "participant",
        thread_id: "participant_3_private",
        message: "What chores are still active?",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Chores,
          intent: ClassifierIntent.Query,
        },
      },
    ],
  },

  // --- Maintenance with vendor handoff ---
  {
    id: "td-maintenance-vendor-context",
    title: "Maintenance issue escalates to vendor scheduling",
    category: "pipeline",
    prompt_input: {
      message: "The furnace is making a weird noise",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.Maintenance,
      intent: ClassifierIntent.Request,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Batched,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "The furnace is making a weird noise",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Maintenance,
          intent: ClassifierIntent.Request,
        },
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message: "Maintenance record: furnace noise issue logged.",
      },
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Can the plumber come look at it Tuesday?",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Vendors,
          intent: ClassifierIntent.Request,
        },
      },
    ],
  },
];
