import { ClassifierIntent, DispatchPriority, TopicKey } from "../../src/index.js";
import type { EvalScenarioDefinition } from "../types.js";

export const toneRegressionName = "tone-regression";

export const toneRegressionScenarios: EvalScenarioDefinition[] = [
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
      intent: ClassifierIntent.Query,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["schedule", "thursday"],
      must_not: ["ugh"],
    },
  },

  // --- Chores: direct and operational ---
  {
    id: "tr-chores-emotional-input",
    title: "Chores topic stays direct even with emotional input",
    category: "composition",
    prompt_input: {
      message: "Omg nobody ever takes out the trash this is so frustrating",
      concerning: ["participant_3"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      target_thread: "participant_3_private",
      priority: DispatchPriority.Batched,
      confirmation_required: false,
      tone_markers: ["chore", "task"],
      must_not: ["frustrating", "omg"],
    },
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
      confirmation_required: true,
      tone_markers: ["confirm", "bill"],
      must_not: ["urgent", "!!!"],
    },
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
      intent: ClassifierIntent.Query,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["health", "appointment"],
      must_not: ["worried"],
    },
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
      tone_markers: ["couple", "calendar"],
      must_not: ["assigned", "logged", "record"],
    },
  },

  // --- Grocery: utilitarian ---
  {
    id: "tr-grocery-chatty-input",
    title: "Grocery topic stays utilitarian despite chatty input",
    category: "composition",
    prompt_input: {
      message: "Hey so we definitely need to get some more milk and also maybe some bread?",
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
      must_not: ["hey", "definitely"],
    },
  },

  // --- Cross-tone: emotional chore input should NOT get relationship warmth ---
  {
    id: "tr-chore-not-relationship-tone",
    title: "Emotional chore input does not produce relationship-style warmth",
    category: "composition",
    prompt_input: {
      message: "Can someone please just clean the bathroom already, I'm so tired of this",
      concerning: ["participant_3"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      target_thread: "participant_3_private",
      priority: DispatchPriority.Batched,
      confirmation_required: false,
      tone_markers: ["chore", "task"],
      must_not: ["tired", "couple", "reminder"],
    },
  },

  // --- Business: professional ---
  {
    id: "tr-business-casual-input",
    title: "Business topic stays professional despite casual input",
    category: "composition",
    prompt_input: {
      message: "Yo got a new portrait inquiry, let's draft a reply real quick",
      concerning: ["participant_2"],
      origin_thread: "participant_2_private",
    },
    expected: {
      topic: TopicKey.Business,
      intent: ClassifierIntent.Request,
      target_thread: "participant_2_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["client", "draft"],
      must_not: ["yo", "real quick"],
    },
  },
];
