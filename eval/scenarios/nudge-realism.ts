import { ClassifierIntent, DispatchPriority, TopicKey } from "../../src/index.js";
import type { EvalScenarioDefinition } from "../types.js";

export const nudgeRealismName = "nudge-realism";

export const nudgeRealismScenarios: EvalScenarioDefinition[] = [
  // Worker-safe routing and confirmation shapes only; reminder timing lives elsewhere.
  {
    id: "nr-chore-assignment-routes-private",
    title: "Chore assignment routes to the assignee private thread",
    category: "routing",
    prompt_input: {
      message: "Take out the trash",
      concerning: ["participant_3"],
      origin_thread: "participant_3_private",
    },
    expected: {
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      target_thread: "participant_3_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["active chores"],
      format_markers: ["1."],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },

  {
    id: "nr-reminder-source-stays-honest",
    title: "Shared-thread chore request stays visible in the shared reply thread",
    category: "routing",
    prompt_input: {
      message: "Vacuum the upstairs",
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
      format_markers: ["1."],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },

  {
    id: "nr-finance-confirmation-opens-in-couple",
    title: "Finance confirmation opens in the couple thread",
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
      tone_markers: ["confirm", "expense"],
      format_markers: ["yes", "no"],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },

  {
    id: "nr-health-private-followup-shape",
    title: "Health scheduling stays private and attentive",
    category: "routing",
    prompt_input: {
      message: "Schedule dentist for next Monday at 10am",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.Health,
      intent: ClassifierIntent.Request,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["appointment"],
      format_markers: ["upcoming"],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },
];
