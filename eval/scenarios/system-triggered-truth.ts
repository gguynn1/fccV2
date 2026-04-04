import { ClassifierIntent, DispatchPriority, TopicKey } from "../../src/index.js";
import type { EvalScenarioDefinition } from "../types.js";

export const systemTriggeredTruthName = "system-triggered-truth";

export const systemTriggeredTruthScenarios: EvalScenarioDefinition[] = [
  {
    id: "stt-private-health-never-shared",
    title: "Private health scheduling never spills into a shared thread",
    category: "routing",
    prompt_input: {
      message: "Schedule the dentist appointment on 5/12 at 10am",
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
  {
    id: "stt-family-status-explanation-query",
    title: "Explanation query stays in the originating private thread",
    category: "classification",
    prompt_input: {
      message: "What did you see today?",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.FamilyStatus,
      intent: ClassifierIntent.Query,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },
  {
    id: "stt-family-status-held-query",
    title: "Held-for-later explanation query stays in the originating private thread",
    category: "classification",
    prompt_input: {
      message: "What are you holding for later?",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.FamilyStatus,
      intent: ClassifierIntent.Query,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },
  {
    id: "stt-relationship-query-stays-couple",
    title: "Relationship query remains in the couple thread",
    category: "routing",
    prompt_input: {
      message: "What relationship nudges are pending?",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "couple",
    },
    expected: {
      topic: TopicKey.Relationship,
      intent: ClassifierIntent.Query,
      target_thread: "couple",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["relationship"],
      format_markers: ["history"],
    },
    simulation: { parity_assertion: { against_simulator: false } },
  },
];
