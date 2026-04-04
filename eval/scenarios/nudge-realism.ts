import { ClassifierIntent, DispatchPriority, TopicKey } from "../../src/index.js";
import type { EvalScenarioDefinition } from "../types.js";

export const nudgeRealismName = "nudge-realism";

export const nudgeRealismScenarios: EvalScenarioDefinition[] = [
  {
    id: "nr-chore-reminder-includes-context",
    title: "Chore reminder after assignment includes chore name and assignee",
    category: "pipeline",
    prompt_input: {
      message: "Take out the trash",
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
        message: "Take out the trash",
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
        role: "assistant",
        thread_id: "participant_3_private",
        message:
          'Reminder: "take out the trash" for participant_3 is still pending (opened 1h ago).',
      },
      {
        role: "participant",
        thread_id: "participant_3_private",
        message: "Done",
        entity_id: "participant_3",
        expected: {
          topic: TopicKey.Chores,
        },
      },
    ],
  },

  {
    id: "nr-reminder-routes-private",
    title: "Reminder routes to the correct private thread",
    category: "routing",
    prompt_input: {
      message: "Vacuum the upstairs",
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
        message: "Vacuum the upstairs",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Chores,
          target_thread: "participant_3_private",
        },
      },
      {
        role: "assistant",
        thread_id: "participant_3_private",
        message: "Chore assigned: vacuum the upstairs.",
      },
      {
        role: "assistant",
        thread_id: "participant_3_private",
        message:
          'Follow-up: "vacuum the upstairs" for participant_3 has not been addressed (opened 2h ago).',
      },
      {
        role: "participant",
        thread_id: "participant_3_private",
        message: "I'll do it after school",
        entity_id: "participant_3",
        expected: {
          topic: TopicKey.Chores,
        },
      },
    ],
  },

  {
    id: "nr-finance-confirmation-reminder",
    title: "Finance confirmation reminder fires in couple thread",
    category: "confirmation",
    prompt_input: {
      message: "Pay the electric bill",
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
        message: "Pay the electric bill",
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
        message: "Approval needed: confirm the bill payment. Reply yes to confirm.",
      },
      {
        role: "assistant",
        thread_id: "couple",
        message: 'Reminder: "Pay the electric bill" is still awaiting approval (opened 1h ago).',
      },
      {
        role: "participant",
        thread_id: "couple",
        message: "Yes, go ahead",
        entity_id: "participant_2",
        expected: {
          topic: TopicKey.Finances,
          intent: ClassifierIntent.Confirmation,
        },
      },
    ],
  },

  {
    id: "nr-health-follow-up-after-appointment",
    title: "Health follow-up after appointment stays attentive",
    category: "pipeline",
    prompt_input: {
      message: "Schedule dentist for next Monday",
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
        message: "Schedule dentist for next Monday",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Health,
          intent: ClassifierIntent.Request,
        },
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message: "Health record update: dentist appointment for next Monday is logged.",
      },
      {
        role: "assistant",
        thread_id: "participant_1_private",
        message: "Reminder: dentist appointment is coming up on Monday. Any notes to add?",
      },
      {
        role: "participant",
        thread_id: "participant_1_private",
        message: "Nope, all good",
        entity_id: "participant_1",
        expected: {
          topic: TopicKey.Health,
        },
      },
    ],
  },
];
