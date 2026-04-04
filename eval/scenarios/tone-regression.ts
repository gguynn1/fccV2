import { ClassifierIntent, DispatchPriority, TopicKey } from "../../src/index.js";
import type { EvalScenarioDefinition } from "../types.js";

export const toneRegressionName = "tone-regression";

export const toneRegressionScenarios: EvalScenarioDefinition[] = [
  // Focus on stable worker-safe composition signals rather than routing disputes.
  // --- Calendar: precise and logistical ---
  {
    id: "tr-calendar-messy-input",
    title: "Calendar topic produces logistical output despite messy input",
    category: "composition",
    prompt_input: {
      message: "Ughhh we have a thing on the calendar Thursday I think maybe afternoon?",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.Calendar,
      intent: ClassifierIntent.Request,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["what date and time"],
      must_not: ["ugh"],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },

  // --- Chores: direct and operational ---
  {
    id: "tr-chores-emotional-input",
    title: "Chores topic stays operational when the request sounds frustrated",
    category: "composition",
    prompt_input: {
      message: "Please take out the trash today, this chore is overdue.",
      concerning: ["participant_3"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      target_thread: "family",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["active chores"],
      must_not: ["couple", "date night"],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },

  // --- Finances: calm and factual ---
  {
    id: "tr-finances-urgent-input",
    title: "Finances topic stays calm despite urgent tone in input",
    category: "composition",
    prompt_input: {
      message: "URGENT we need to pay the bill RIGHT NOW before it's overdue!!!",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "couple",
    },
    expected: {
      topic: TopicKey.Finances,
      intent: ClassifierIntent.Request,
      target_thread: "couple",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["amount"],
      must_not: ["urgent", "!!!"],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },

  // --- Health: attentive and specific ---
  {
    id: "tr-health-worried-input",
    title: "Health topic is attentive without echoing worry",
    category: "composition",
    prompt_input: {
      message: "I'm worried about the doctor appointment, should I cancel the checkup?",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.Health,
      intent: ClassifierIntent.Cancellation,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["appointment"],
      must_not: ["worried"],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },

  // --- Relationship: warm, never clinical ---
  {
    id: "tr-relationship-terse-input",
    title: "Relationship topic warms up even with terse input",
    category: "composition",
    prompt_input: {
      message: "Date night. This weekend. Plan something.",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "couple",
    },
    expected: {
      topic: TopicKey.Relationship,
      intent: ClassifierIntent.Request,
      target_thread: "couple",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["take care"],
      must_not: ["assigned", "logged", "record"],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },

  // --- Grocery: utilitarian ---
  {
    id: "tr-grocery-chatty-input",
    title: "Grocery topic keeps a clean list-shaped response",
    category: "composition",
    prompt_input: {
      message: "Could you add milk and bread to the grocery list?",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Grocery,
      intent: ClassifierIntent.Request,
      target_thread: "family",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["grocery", "list"],
      must_not: ["take care", "appointment"],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },

  // --- Cross-tone: emotional chore input should NOT get relationship warmth ---
  {
    id: "tr-chore-not-relationship-tone",
    title: "Chores output stays operational and not relationship-coded",
    category: "composition",
    prompt_input: {
      message: "Please clean the bathroom today.",
      concerning: ["participant_3"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      target_thread: "family",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["active chores"],
      must_not: ["take care", "date night", "couple reminder"],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },

  // --- Business: professional ---
  {
    id: "tr-business-casual-input",
    title: "Business topic stays structured for lead intake",
    category: "composition",
    prompt_input: {
      message: "New portrait inquiry from a couple, draft a reply.",
      concerning: ["participant_2"],
      origin_thread: "participant_2_private",
    },
    expected: {
      topic: TopicKey.Business,
      intent: ClassifierIntent.Request,
      target_thread: "participant_2_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["leads"],
      must_not: ["yo", "real quick"],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },
];
