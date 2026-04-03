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

function buildScenarioSetFile(slug: string): string {
  const exportBase = toCamelCase(slug);

  return `import { ClassifierIntent, DispatchPriority, TopicKey } from "../../../src/index.js";
import type { EvalScenarioDefinition } from "../../types.js";

// Generated from the Eval page. Edit this file, then register it in eval/scenarios/index.ts.
export const ${exportBase}Name = "${slug}";

export const ${exportBase}Scenarios: EvalScenarioDefinition[] = [
  {
    id: "${slug}-calendar-query",
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
    notes: "Generated scaffold. Verify that the message and markers still match the intended behavior.",
  },
  {
    id: "${slug}-grocery-add",
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
    id: "${slug}-finance-confirmation",
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
    id: "${slug}-business-draft",
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
    id: "${slug}-vendor-update",
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
