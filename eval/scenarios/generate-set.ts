import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { format, resolveConfig } from "prettier";

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function toCamelCase(input: string): string {
  return input
    .split("-")
    .filter(Boolean)
    .map((segment, index) =>
      index === 0 ? segment : `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`,
    )
    .join("");
}

function toTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "z");
}

interface MessageVariant {
  message: string;
  tone_markers: string[];
}

interface ScenarioTemplate {
  suffix: string;
  title: string;
  category: string;
  topic: string;
  intent: string;
  origin_thread: string;
  target_thread: string;
  concerning: string[];
  priority: string;
  confirmation_required: boolean;
  format_markers: string[];
  must_not?: string[];
  variants: MessageVariant[];
}

const scenarioTemplates: ScenarioTemplate[] = [
  {
    suffix: "calendar-query",
    title: "Calendar query stays in the family thread",
    category: "classification",
    topic: "TopicKey.Calendar",
    intent: "ClassifierIntent.Query",
    origin_thread: "family",
    target_thread: "family",
    concerning: ["participant_1", "participant_2"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["summary"],
    variants: [
      { message: "Do we have anything Friday morning?", tone_markers: ["schedule", "friday"] },
      { message: "What's on the calendar Saturday?", tone_markers: ["schedule", "saturday"] },
      {
        message: "Do we have anything scheduled Sunday afternoon?",
        tone_markers: ["schedule", "sunday"],
      },
    ],
  },
  {
    suffix: "grocery-add",
    title: "Grocery additions remain list-focused in the family thread",
    category: "routing",
    topic: "TopicKey.Grocery",
    intent: "ClassifierIntent.Request",
    origin_thread: "family",
    target_thread: "family",
    concerning: ["participant_1", "participant_2", "participant_3"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["list"],
    must_not: ["actually", "bill due", "note $"],
    variants: [
      { message: "Add eggs and yogurt to the list", tone_markers: ["added", "grocery"] },
      { message: "We need ground beef and bread", tone_markers: ["added", "grocery"] },
      {
        message: "Add cereal and bananas to the grocery list on 6/3",
        tone_markers: ["added", "grocery"],
      },
    ],
  },
  {
    suffix: "finance-confirmation",
    title: "Financial actions ask for confirmation in the couple thread",
    category: "confirmation",
    topic: "TopicKey.Finances",
    intent: "ClassifierIntent.Request",
    origin_thread: "couple",
    target_thread: "couple",
    concerning: ["participant_1", "participant_2"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: true,
    format_markers: ["confirm"],
    variants: [
      { message: "Pay the $50 water bill on Monday morning", tone_markers: ["approval", "bill"] },
      { message: "Pay the $75 electric bill tomorrow", tone_markers: ["approval", "bill"] },
      { message: "Pay the $60 internet bill this Friday", tone_markers: ["approval", "bill"] },
    ],
  },
  {
    suffix: "business-draft",
    title: "Business drafts stay in the owner's private thread",
    category: "composition",
    topic: "TopicKey.Business",
    intent: "ClassifierIntent.Request",
    origin_thread: "participant_2_private",
    target_thread: "participant_2_private",
    concerning: ["participant_2"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["reply"],
    variants: [
      {
        message: "Draft a warm reply to the new wedding inquiry",
        tone_markers: ["warm", "draft", "client"],
      },
      {
        message: "Draft a reply to the new portrait inquiry and keep it warm",
        tone_markers: ["warm", "draft", "client"],
      },
      {
        message: "Draft a warm reply to the client about pricing",
        tone_markers: ["warm", "draft", "client"],
      },
    ],
  },
  {
    suffix: "vendor-update",
    title: "Vendor scheduling remains a vendor update",
    category: "pipeline",
    topic: "TopicKey.Vendors",
    intent: "ClassifierIntent.Update",
    origin_thread: "participant_1_private",
    target_thread: "participant_1_private",
    concerning: ["participant_1"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["record"],
    variants: [
      {
        message: "The electrician can come Thursday afternoon",
        tone_markers: ["vendor", "thursday"],
      },
      { message: "The plumber can come Tuesday morning", tone_markers: ["vendor", "tuesday"] },
      {
        message: "The electrician can come Wednesday afternoon",
        tone_markers: ["vendor", "wednesday"],
      },
    ],
  },
  {
    suffix: "school-query",
    title: "School queries stay in the requesting family thread",
    category: "classification",
    topic: "TopicKey.School",
    intent: "ClassifierIntent.Query",
    origin_thread: "family",
    target_thread: "family",
    concerning: ["participant_3"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["summary"],
    variants: [
      { message: "When is the next school field trip?", tone_markers: ["school", "field trip"] },
      {
        message: "What homework is due this week from school?",
        tone_markers: ["school", "homework"],
      },
      { message: "When is the school pickup on Friday?", tone_markers: ["school", "pickup"] },
    ],
  },
  {
    suffix: "health-update",
    title: "Health updates stay in the participant's private thread",
    category: "routing",
    topic: "TopicKey.Health",
    intent: "ClassifierIntent.Update",
    origin_thread: "participant_1_private",
    target_thread: "participant_1_private",
    concerning: ["participant_1"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["record"],
    variants: [
      {
        message: "The dentist appointment moved to Thursday afternoon",
        tone_markers: ["appointment", "dentist"],
      },
      {
        message: "The doctor checkup is confirmed for Monday morning",
        tone_markers: ["appointment", "checkup"],
      },
      {
        message: "Prescription refill is ready at the doctor",
        tone_markers: ["prescription", "doctor"],
      },
    ],
  },
  {
    suffix: "meals-request",
    title: "Meal planning stays in the family thread",
    category: "composition",
    topic: "TopicKey.Meals",
    intent: "ClassifierIntent.Request",
    origin_thread: "family",
    target_thread: "family",
    concerning: ["participant_1", "participant_2"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["list"],
    variants: [
      { message: "Plan dinner for tonight", tone_markers: ["dinner", "meal"] },
      { message: "Find a dinner recipe for tomorrow", tone_markers: ["recipe", "dinner"] },
      { message: "Create a meal plan for Saturday dinner", tone_markers: ["meal", "dinner"] },
    ],
  },
  {
    suffix: "chores-request",
    title: "Chore assignments keep the immediate reply visible in the family thread",
    category: "pipeline",
    topic: "TopicKey.Chores",
    intent: "ClassifierIntent.Request",
    origin_thread: "family",
    target_thread: "family",
    concerning: ["participant_3"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["task"],
    variants: [
      { message: "Take out the trash before Thursday morning", tone_markers: ["chore", "trash"] },
      { message: "Clean your room and tidy up before Friday", tone_markers: ["chore", "clean"] },
      { message: "Vacuum the living room this weekend", tone_markers: ["chore", "vacuum"] },
    ],
  },
  {
    suffix: "travel-query",
    title: "Travel queries stay in the conversation thread",
    category: "classification",
    topic: "TopicKey.Travel",
    intent: "ClassifierIntent.Query",
    origin_thread: "couple",
    target_thread: "couple",
    concerning: ["participant_1", "participant_2"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["travel"],
    variants: [
      { message: "What travel plans do we have this month?", tone_markers: ["travel", "trip"] },
      { message: "Do we have any trips coming up?", tone_markers: ["travel", "trip"] },
      { message: "What is the next trip on the calendar?", tone_markers: ["travel", "trip"] },
    ],
  },
  {
    suffix: "pets-query",
    title: "Pet queries include the referenced pet context",
    category: "composition",
    topic: "TopicKey.Pets",
    intent: "ClassifierIntent.Query",
    origin_thread: "family",
    target_thread: "family",
    concerning: ["pet"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["pet"],
    variants: [
      { message: "What is up with the pet?", tone_markers: ["pet", "update"] },
      { message: "Any updates on the pet?", tone_markers: ["pet", "update"] },
      { message: "How is the pet doing today?", tone_markers: ["pet", "update"] },
    ],
  },
  {
    suffix: "relationship-query",
    title: "Relationship check-ins remain in the couple thread",
    category: "routing",
    topic: "TopicKey.Relationship",
    intent: "ClassifierIntent.Query",
    origin_thread: "couple",
    target_thread: "couple",
    concerning: ["participant_1", "participant_2"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["couple"],
    variants: [
      { message: "Any couple reminders this week?", tone_markers: ["couple", "reminder"] },
      { message: "Do we have a date night reminder?", tone_markers: ["couple", "calendar"] },
      { message: "What relationship nudges are pending?", tone_markers: ["couple", "reminder"] },
    ],
  },
  {
    suffix: "family-status-update",
    title: "Family status updates stay concise and stateful",
    category: "pipeline",
    topic: "TopicKey.FamilyStatus",
    intent: "ClassifierIntent.Request",
    origin_thread: "family",
    target_thread: "family",
    concerning: ["participant_1"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["status"],
    variants: [
      { message: "I am at practice and will be home at 6", tone_markers: ["status", "recorded"] },
      { message: "Running late from school pickup", tone_markers: ["status", "recorded"] },
      { message: "At the store, home in 20 minutes", tone_markers: ["status", "recorded"] },
    ],
  },
  {
    suffix: "maintenance-update",
    title: "Maintenance requests stay in the owner's private thread",
    category: "routing",
    topic: "TopicKey.Maintenance",
    intent: "ClassifierIntent.Request",
    origin_thread: "participant_1_private",
    target_thread: "participant_1_private",
    concerning: ["participant_1"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["record"],
    variants: [
      {
        message: "Schedule the oil change for next Tuesday",
        tone_markers: ["maintenance", "oil change"],
      },
      {
        message: "Schedule the furnace air filter replacement this weekend",
        tone_markers: ["maintenance", "air filter"],
      },
      {
        message: "Schedule the gutter cleaning for Saturday",
        tone_markers: ["maintenance", "gutter"],
      },
    ],
  },
  {
    suffix: "mixed-intent-finance-over-grocery",
    title: "Mixed grocery and bill note stays finance-first with confirmation",
    category: "pipeline",
    topic: "TopicKey.Finances",
    intent: "ClassifierIntent.Request",
    origin_thread: "couple",
    target_thread: "couple",
    concerning: ["participant_1", "participant_2"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: true,
    format_markers: ["confirm"],
    must_not: ["grocery list update", "added items"],
    variants: [
      {
        message: "Get bananas at the store, note $100 bill due next week",
        tone_markers: ["approval", "bill"],
      },
      {
        message: "Add milk to the grocery list and pay the $80 electric bill Friday",
        tone_markers: ["approval", "bill"],
      },
      {
        message: "Grab oranges and log a $75 internet bill due tomorrow",
        tone_markers: ["approval", "bill"],
      },
    ],
  },
  {
    suffix: "calendar-conversational-time",
    title: "Conversational calendar scheduling keeps date-and-time intent",
    category: "pipeline",
    topic: "TopicKey.Calendar",
    intent: "ClassifierIntent.Request",
    origin_thread: "family",
    target_thread: "family",
    concerning: ["participant_1", "participant_2"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["summary"],
    variants: [
      {
        message: "Add a recital to my calendar on 6/3 at 6pm",
        tone_markers: ["schedule", "6/3"],
      },
      {
        message: "Please put parent meeting on the calendar June 3 at 6pm",
        tone_markers: ["schedule", "june"],
      },
      {
        message: "Schedule conference on the calendar for 6/3 at 18:00",
        tone_markers: ["schedule", "6/3"],
      },
    ],
  },
  {
    suffix: "health-date-followup-style",
    title: "Health updates retain appointment timing details",
    category: "pipeline",
    topic: "TopicKey.Health",
    intent: "ClassifierIntent.Update",
    origin_thread: "participant_1_private",
    target_thread: "participant_1_private",
    concerning: ["participant_1"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["record"],
    variants: [
      {
        message: "Actually, the doctor checkup moved to 6/3 at 6pm",
        tone_markers: ["appointment", "checkup"],
      },
      {
        message: "Please update the dentist appointment to June 3 at 6pm",
        tone_markers: ["appointment", "dentist"],
      },
      {
        message: "The prescription follow-up is confirmed for 6/3 at 6pm",
        tone_markers: ["appointment", "prescription"],
      },
    ],
  },
  {
    suffix: "family-status-conversational",
    title: "Family status handles conversational lead-ins cleanly",
    category: "composition",
    topic: "TopicKey.FamilyStatus",
    intent: "ClassifierIntent.Request",
    origin_thread: "family",
    target_thread: "family",
    concerning: ["participant_2"],
    priority: "DispatchPriority.Immediate",
    confirmation_required: false,
    format_markers: ["status"],
    variants: [
      {
        message: "Just a heads up, running late from school pickup and home around 6",
        tone_markers: ["status", "recorded"],
      },
      {
        message: "Ok, at the store and back in 20 minutes",
        tone_markers: ["status", "recorded"],
      },
      {
        message: "Just a heads up, on my way and ETA 15 minutes",
        tone_markers: ["status", "recorded"],
      },
    ],
  },
];

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildScenarioSetFile(slug: string): string {
  const exportBase = toCamelCase(slug);
  const variantIndex = hashSlug(slug);

  const scenarios = scenarioTemplates.map((template, templateIndex) => {
    const variant = template.variants[(variantIndex + templateIndex) % template.variants.length];
    const concerningLiteral = template.concerning.map((c) => `"${c}"`).join(", ");
    const toneMarkersLiteral = variant.tone_markers.map((m) => `"${m}"`).join(", ");
    const formatMarkersLiteral = template.format_markers.map((m) => `"${m}"`).join(", ");
    const mustNotLiteral = (template.must_not ?? []).map((marker) => `"${marker}"`).join(", ");
    const mustNotLine =
      template.must_not && template.must_not.length > 0
        ? `      must_not: [${mustNotLiteral}],\n`
        : "";
    const notesLine =
      templateIndex === 0
        ? `\n    notes: "Generated scaffold. Verify that the message and markers still match the intended behavior.",`
        : "";

    return `  {
    id: "${slug}-${template.suffix}",
    title: "${template.title}",
    category: "${template.category}",
    prompt_input: {
      message: "${variant.message}",
      concerning: [${concerningLiteral}],
      origin_thread: "${template.origin_thread}",
    },
    expected: {
      topic: ${template.topic},
      intent: ${template.intent},
      target_thread: "${template.target_thread}",
      priority: ${template.priority},
      confirmation_required: ${String(template.confirmation_required)},
      tone_markers: [${toneMarkersLiteral}],
      format_markers: [${formatMarkersLiteral}],
${mustNotLine}    },
    simulation: {
      parity_assertion: {
        against_simulator: false,
      },
    },${notesLine}
  }`;
  });

  return `import { ClassifierIntent, DispatchPriority, TopicKey } from "../../../src/index.js";
import type { EvalScenarioDefinition } from "../../types.js";

// Generated from the Eval page. Edit this file; it is loaded automatically from eval/scenarios/generated/.
export const ${exportBase}Name = "${slug}";

export const ${exportBase}Scenarios: EvalScenarioDefinition[] = [
${scenarios.join(",\n")},
];
`;
}

export interface GenerateScenarioSetScaffoldOptions {
  repo_root: string;
  requested_name?: string;
}

export interface GenerateScenarioSetScaffoldResult {
  scenario_set_name: string;
  file_path: string;
  guide_path: string;
}

export async function generateScenarioSetScaffold(
  options: GenerateScenarioSetScaffoldOptions,
): Promise<GenerateScenarioSetScaffoldResult> {
  const baseName = options.requested_name?.trim() || `generated-scenario-set-${toTimestamp()}`;
  const scenarioSetName = toSlug(baseName) || `generated-scenario-set-${toTimestamp()}`;
  const generatedDirectory = join(options.repo_root, "eval/scenarios/generated");
  const absolutePath = join(generatedDirectory, `${scenarioSetName}.ts`);
  const prettierConfig = (await resolveConfig(absolutePath)) ?? {};
  const formattedContents = await format(buildScenarioSetFile(scenarioSetName), {
    ...prettierConfig,
    filepath: absolutePath,
  });

  await mkdir(generatedDirectory, { recursive: true });
  await writeFile(absolutePath, formattedContents, "utf8");

  return {
    scenario_set_name: scenarioSetName,
    file_path: relative(options.repo_root, absolutePath),
    guide_path: "eval/scenarios/SCENARIO_SETS.md",
  };
}
