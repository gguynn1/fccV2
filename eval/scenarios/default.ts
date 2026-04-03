import { ClassifierIntent, DispatchPriority, TopicKey } from "../../src/index.js";
import type { EvalScenarioDefinition } from "../types.js";

export const defaultScenarioSetName = "default";

export const defaultScenarios: EvalScenarioDefinition[] = [
  {
    id: "calendar-query-family",
    title: "Calendar query stays in the requesting thread",
    category: "classification",
    prompt_input: {
      message: "What's on the calendar Thursday?",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Calendar,
      intent: ClassifierIntent.Query,
      target_thread: "family",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["schedule", "Thursday"],
      format_markers: ["summary"],
    },
  },
  {
    id: "grocery-addition-family",
    title: "Grocery additions stay utilitarian in the family thread",
    category: "routing",
    prompt_input: {
      message: "We need ground beef and milk",
      concerning: ["participant_1", "participant_2", "participant_3"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Grocery,
      intent: ClassifierIntent.Request,
      target_thread: "family",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["added", "grocery"],
      format_markers: ["list"],
    },
  },
  {
    id: "finance-confirmation-couple",
    title: "Financial actions require confirmation in the couple thread",
    category: "confirmation",
    prompt_input: {
      message: "Pay the electric bill tomorrow morning",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "couple",
    },
    expected: {
      topic: TopicKey.Finances,
      intent: ClassifierIntent.Request,
      target_thread: "couple",
      priority: DispatchPriority.Immediate,
      confirmation_required: true,
      tone_markers: ["approval", "bill"],
      format_markers: ["confirm"],
    },
  },
  {
    id: "business-draft-tone",
    title: "Business replies should produce a polished client-facing draft",
    category: "composition",
    prompt_input: {
      message: "Draft a reply to the new portrait inquiry and keep it warm",
      concerning: ["participant_2"],
      origin_thread: "participant_2_private",
    },
    expected: {
      topic: TopicKey.Business,
      intent: ClassifierIntent.Request,
      target_thread: "participant_2_private",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["warm", "draft", "client"],
      format_markers: ["reply"],
    },
  },
  {
    id: "vendors-vs-maintenance-handoff",
    title: "Vendor scheduling should not collapse into maintenance tracking",
    category: "pipeline",
    prompt_input: {
      message: "The plumber can come Tuesday morning",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.Vendors,
      intent: ClassifierIntent.Update,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Batched,
      confirmation_required: false,
      tone_markers: ["vendor", "Tuesday"],
      format_markers: ["record"],
    },
  },
];
