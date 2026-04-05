import type { EvalScenarioDefinition, EvalScenarioFailure, EvalTunerOutcome } from "../types.js";

export interface EvalDiagnosis {
  can_fix_with_prompt: boolean;
  failing_dimensions: string[];
  summary: string;
}

export function diagnoseScenarioFailures(
  scenario: EvalScenarioDefinition,
  failures: EvalScenarioFailure[],
): EvalDiagnosis {
  const failingDimensions = failures.map((failure) => failure.field);
  const promptFixable = failures.every((failure) => failure.prompt_fixable);
  const forcedScope = scenario.simulation?.tuning_scope;

  const canFixWithPrompt =
    forcedScope === "prompt" ? true : forcedScope === "structural" ? false : promptFixable;

  return {
    can_fix_with_prompt: canFixWithPrompt,
    failing_dimensions: [...new Set(failingDimensions)],
    summary: canFixWithPrompt
      ? "The failing dimensions are limited to message composition, so a prompt candidate can be proposed."
      : forcedScope === "structural"
        ? "The scenario is structurally scoped, so any remaining failure should be investigated in runner, runtime, or scaffold assumptions before proposing prompt-only changes."
        : "The failure touches classification, routing, priority, or confirmation behavior and needs code-level investigation.",
  };
}

export function toDeferredTunerOutcome(diagnosis: EvalDiagnosis): EvalTunerOutcome {
  return {
    status: "investigation_needed",
    summary: diagnosis.summary,
    failing_dimensions: diagnosis.failing_dimensions,
  };
}
