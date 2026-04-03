import type {
  EvalCandidateSummary,
  EvalScenarioActual,
  EvalScenarioDefinition,
  EvalScenarioFailure,
  EvalTunerOutcome,
} from "../types.js";
import { diagnoseScenarioFailures } from "./diagnose.js";

export interface GenerateCandidatePromptOptions {
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

export function generateCandidatePrompt(options: GenerateCandidatePromptOptions): EvalTunerOutcome {
  const diagnosis = diagnoseScenarioFailures(options.scenario, options.failures);
  const body = buildCandidateBody(options.scenario, options.actual, options.failures);

  const candidate: EvalCandidateSummary = {
    title: `${options.scenario.title} prompt suggestion`,
    summary: "Suggested prompt refinement for the failing composition dimensions.",
    body,
  };

  return {
    status: diagnosis.can_fix_with_prompt ? "prompt_fix_suggested" : "investigation_needed",
    summary: `${candidate.title} is embedded in the run artifact. ${diagnosis.summary}`,
    failing_dimensions: diagnosis.failing_dimensions,
    candidate: diagnosis.can_fix_with_prompt ? candidate : undefined,
  };
}
