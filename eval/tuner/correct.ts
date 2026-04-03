import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import type {
  EvalCandidateSummary,
  EvalScenarioActual,
  EvalScenarioDefinition,
  EvalScenarioFailure,
  EvalTunerOutcome,
} from "../types.js";
import { diagnoseScenarioFailures, type EvalDiagnosis } from "./diagnose.js";

export interface GenerateCandidatePromptOptions {
  repo_root: string;
  candidate_dir: string;
  run_id: string;
  scenario: EvalScenarioDefinition;
  actual: EvalScenarioActual;
  failures: EvalScenarioFailure[];
}

function buildCandidateBody(
  scenario: EvalScenarioDefinition,
  actual: EvalScenarioActual,
  failures: EvalScenarioFailure[],
): string {
  const bulletList = failures.map((failure) => `- ${failure.field}: ${failure.message}`).join("\n");

  return `# Candidate Prompt Update\n\n## Scenario\n- ID: \`${scenario.id}\`\n- Title: ${scenario.title}\n- Category: \`${scenario.category}\`\n\n## Input\n> ${scenario.prompt_input.message}\n\n## Actual Output Snapshot\n> ${actual.composed_message}\n\n## Expected Behavior\n- Topic: \`${scenario.expected.topic}\`\n- Intent: \`${scenario.expected.intent}\`\n- Target thread: \`${scenario.expected.target_thread}\`\n- Priority: \`${scenario.expected.priority}\`\n\n## Why This Candidate Exists\n${bulletList}\n\n## Proposed Prompt Adjustment\nTighten the composition prompt so the response explicitly matches the topic profile's tone and format markers for this scenario. Prefer direct user-facing draft language over internal pipeline narration, and preserve the existing routing, classification, and confirmation behavior.\n`;
}

function buildCandidateSummary(relativePath: string, diagnosis: EvalDiagnosis): string {
  return `Prompt candidate created at \`${relativePath}\`. ${diagnosis.summary}`;
}

export async function generateCandidatePrompt(
  options: GenerateCandidatePromptOptions,
): Promise<EvalTunerOutcome> {
  const diagnosis = diagnoseScenarioFailures(options.scenario, options.failures);
  const filename = `${options.run_id}__${options.scenario.id}.md`;
  const absolutePath = join(options.candidate_dir, filename);
  const relativePath = relative(options.repo_root, absolutePath);
  const body = buildCandidateBody(options.scenario, options.actual, options.failures);

  await writeFile(absolutePath, body, "utf8");

  const candidate: EvalCandidateSummary = {
    path: relativePath,
    title: `${options.scenario.title} candidate`,
    summary: "Suggested prompt refinement for the failing composition dimensions.",
  };

  return {
    status: diagnosis.can_fix_with_prompt ? "fixed" : "deferred",
    summary: buildCandidateSummary(relativePath, diagnosis),
    failing_dimensions: diagnosis.failing_dimensions,
    candidate: diagnosis.can_fix_with_prompt ? candidate : undefined,
  };
}
