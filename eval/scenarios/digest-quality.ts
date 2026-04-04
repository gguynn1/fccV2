import { ClassifierIntent, DispatchPriority, TopicKey } from "../../src/index.js";
import type { EvalScenarioDefinition } from "../types.js";

export const digestQualityName = "digest-quality";

export const digestQualityScenarios: EvalScenarioDefinition[] = [
  {
    id: "dq-today-snapshot-has-sections",
    title: "Digest response includes section headers (Today, Pending)",
    category: "composition",
    prompt_input: {
      message: "Give me the digest summary for today",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.FamilyStatus,
      intent: ClassifierIntent.Query,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["today", "pending"],
      must_not: ["0 calendar", "0 grocery"],
    },
  },

  {
    id: "dq-digest-no-zero-counts",
    title: "Digest omits zero-count sections rather than showing noise",
    category: "composition",
    prompt_input: {
      message: "Show me the daily recap for today",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "couple",
    },
    expected: {
      topic: TopicKey.FamilyStatus,
      intent: ClassifierIntent.Query,
      target_thread: "couple",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      must_not: ["0 calendar", "0 chore", "0 expense"],
    },
  },

  {
    id: "dq-digest-includes-chore-and-calendar",
    title: "Digest output includes chore and calendar references",
    category: "composition",
    prompt_input: {
      message: "What's the overview for today?",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.FamilyStatus,
      intent: ClassifierIntent.Query,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["today"],
    },
  },

  {
    id: "dq-digest-followup-action",
    title: "Digest followed by action on mentioned content",
    category: "pipeline",
    prompt_input: {
      message: "Give me today's summary now",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.FamilyStatus,
      intent: ClassifierIntent.Query,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["today"],
    },
    turns: [
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Give me today's summary now",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.FamilyStatus,
          intent: ClassifierIntent.Query,
        },
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message:
          "Today\n- Morning meeting at 9am\n- Chore: take out the trash\n\nPending\n- 3 grocery item(s) on the list",
      },
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Cancel the morning meeting",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Calendar,
          intent: ClassifierIntent.Cancellation,
        },
      },
    ],
  },
];
