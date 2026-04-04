import { ClassifierIntent, DispatchPriority, TopicKey } from "../../src/index.js";
import type { EvalScenarioDefinition } from "../types.js";

export const continuityRegressionName = "continuity-regression";

export const continuityRegressionScenarios: EvalScenarioDefinition[] = [
  // Focused regression pack for worker/simulator continuity drift.
  {
    id: "cr-pronoun-cancel-that-calendar",
    title: '"Cancel that" after calendar create sticks to calendar topic',
    category: "pipeline",
    prompt_input: {
      message: "Add soccer practice to the calendar for Saturday",
      concerning: ["participant_3"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Calendar,
      intent: ClassifierIntent.Request,
      target_thread: "family",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "family",
        message: "Add soccer practice to the calendar for Saturday",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Calendar, intent: ClassifierIntent.Request },
      },
      {
        role: "assistant",
        thread_id: "family",
        message: "Schedule summary: soccer practice on Saturday is ready to review.",
      },
      {
        role: "participant",
        thread_id: "family",
        message: "Cancel that",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Calendar, intent: ClassifierIntent.Cancellation },
      },
    ],
  },

  {
    id: "cr-pronoun-move-it-health",
    title: '"Move it" after health appointment carries health topic',
    category: "pipeline",
    prompt_input: {
      message: "Schedule a dentist appointment for Monday",
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
        message: "Schedule a dentist appointment for Monday",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Health, intent: ClassifierIntent.Request },
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message: "Health record update: dentist appointment for Monday is logged.",
      },
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Move it to Wednesday instead",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Health, intent: ClassifierIntent.Update },
      },
    ],
  },

  {
    id: "cr-pronoun-the-one-we-discussed",
    title: '"The one we discussed" references prior meal topic',
    category: "pipeline",
    prompt_input: {
      message: "Let's do tacos for dinner tomorrow",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "couple",
    },
    expected: {
      topic: TopicKey.Meals,
      intent: ClassifierIntent.Request,
      target_thread: "couple",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    turns: [
      {
        role: "participant",
        thread_id: "couple",
        message: "Let's do tacos for dinner tomorrow",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Meals },
      },
      {
        role: "assistant",
        thread_id: "couple",
        message: "Meal plan: tacos for dinner tomorrow added to the meal list.",
      },
      {
        role: "participant",
        thread_id: "couple",
        message: "Actually change it to pasta",
        entity_id: "participant_2",
        expected: { topic: TopicKey.Meals, intent: ClassifierIntent.Update },
      },
    ],
  },

  {
    id: "cr-pronoun-add-that-grocery",
    title: '"Add that too" after grocery conversation carries topic',
    category: "pipeline",
    prompt_input: {
      message: "We need cereal",
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
        message: "We need cereal",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Grocery },
      },
      {
        role: "assistant",
        thread_id: "family",
        message: "Grocery list update: added cereal.",
      },
      {
        role: "participant",
        thread_id: "family",
        message: "And orange juice",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Grocery },
      },
    ],
  },

  // --- Corrections / negations ---
  {
    id: "cr-negation-no-not-that-calendar",
    title: '"No not that" resolves into the specific health appointment context',
    category: "pipeline",
    prompt_input: {
      message: "Cancel the calendar event",
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
        message: "Cancel the calendar event",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Calendar, intent: ClassifierIntent.Cancellation },
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message: "Which event should I cancel?",
      },
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "No not the meeting, the dentist one",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Health, intent: ClassifierIntent.Response },
      },
    ],
  },

  {
    id: "cr-correction-actually-finance",
    title: '"Actually" correction stays inside the finance confirmation flow',
    category: "pipeline",
    prompt_input: {
      message: "Log an expense of $50 for groceries",
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
        message: "Log an expense of $50 for groceries",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Finances },
      },
      {
        role: "assistant",
        thread_id: "couple",
        message: "Please confirm: log expense. Reply yes or no.",
      },
      {
        role: "participant",
        thread_id: "couple",
        message: "Actually make it $75",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Finances, intent: ClassifierIntent.Response },
      },
    ],
  },
  // --- Topic pivots ---
  {
    id: "cr-pivot-chores-to-meals",
    title: "Clean pivot from chores to meals",
    category: "classification",
    prompt_input: {
      message: "Clean the kitchen",
      concerning: ["participant_3"],
      origin_thread: "family",
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
        thread_id: "family",
        message: "Clean the kitchen",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Chores },
      },
      {
        role: "assistant",
        thread_id: "participant_3_private",
        message: "Chore assigned: clean the kitchen.",
      },
      {
        role: "participant",
        thread_id: "family",
        message: "What should we eat for dinner tonight?",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Meals, intent: ClassifierIntent.Query },
      },
    ],
  },

  {
    id: "cr-pivot-calendar-to-travel",
    title: "Clean pivot from calendar to travel",
    category: "classification",
    prompt_input: {
      message: "What's on the calendar this week?",
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
        message: "What's on the calendar this week?",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Calendar, intent: ClassifierIntent.Query },
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message: "Schedule summary: nothing on the calendar this week.",
      },
      {
        role: "participant",
        thread_id: "couple",
        message: "Let's book a hotel for the trip next month",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Travel, intent: ClassifierIntent.Request },
      },
    ],
  },

  {
    id: "cr-pivot-maintenance-to-vendor",
    title: "Maintenance topic pivots to vendor scheduling",
    category: "classification",
    prompt_input: {
      message: "The air filter needs replacing",
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
        message: "The air filter needs replacing",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Maintenance },
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message: "Maintenance record: air filter replacement logged.",
      },
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Can the electrician come look at that?",
        entity_id: "participant_1",
        expected: { topic: TopicKey.Vendors },
      },
    ],
  },
];
