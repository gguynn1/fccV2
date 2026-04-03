import { ClassifierIntent, DispatchPriority, TopicKey } from "../../../src/index.js";
import type { EvalScenarioDefinition } from "../../types.js";

// Generated from the Eval page. Edit this file; it is loaded automatically from eval/scenarios/generated/.
export const generatedScenarioSet20260403t212619zName = "generated-scenario-set-20260403t212619z";

export const generatedScenarioSet20260403t212619zScenarios: EvalScenarioDefinition[] = [
  {
    id: "generated-scenario-set-20260403t212619z-calendar-query",
    title: "Calendar query stays in the family thread",
    category: "classification",
    prompt_input: {
      message: "Do we have anything Friday morning?",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Calendar,
      intent: ClassifierIntent.Query,
      target_thread: "family",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["schedule", "Friday"],
      format_markers: ["summary"],
    },
    notes:
      "Generated scaffold. Verify that the message and markers still match the intended behavior.",
  },
  {
    id: "generated-scenario-set-20260403t212619z-grocery-add",
    title: "Grocery additions remain list-focused in the family thread",
    category: "routing",
    prompt_input: {
      message: "Add eggs and yogurt to the list",
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
    id: "generated-scenario-set-20260403t212619z-finance-confirmation",
    title: "Financial actions ask for confirmation in the couple thread",
    category: "confirmation",
    prompt_input: {
      message: "Pay the water bill on Monday morning",
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
    id: "generated-scenario-set-20260403t212619z-business-draft",
    title: "Business drafts stay in the owner's private thread",
    category: "composition",
    prompt_input: {
      message: "Draft a warm reply to the new wedding inquiry",
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
    id: "generated-scenario-set-20260403t212619z-vendor-update",
    title: "Vendor scheduling remains a vendor update",
    category: "pipeline",
    prompt_input: {
      message: "The electrician can come Thursday afternoon",
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
    },
    expected: {
      topic: TopicKey.Vendors,
      intent: ClassifierIntent.Update,
      target_thread: "participant_1_private",
      priority: DispatchPriority.Batched,
      confirmation_required: false,
      tone_markers: ["vendor", "Thursday"],
      format_markers: ["record"],
    },
  },
];
