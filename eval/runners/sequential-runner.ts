import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { systemConfig } from "../../src/_seed/system-config.js";
import {
  ClassifierIntent,
  DispatchPriority,
  TopicKey,
  type SystemConfig,
} from "../../src/index.js";
import { ensureEvalWorkspace } from "../lib/paths.js";
import { writeRunArtifacts } from "../reporting/write-run-artifacts.js";
import { getScenarioSet } from "../scenarios/index.js";
import { generateCandidatePrompt } from "../tuner/correct.js";
import { diagnoseScenarioFailures, toDeferredTunerOutcome } from "../tuner/diagnose.js";
import type {
  EvalRunState,
  EvalRunSummary,
  EvalScenarioActual,
  EvalScenarioDefinition,
  EvalScenarioFailure,
  EvalScenarioLogEvent,
  EvalScenarioResult,
} from "../types.js";

export interface RunSequentialEvalOptions {
  repo_root: string;
  run_id: string;
  scenario_set: string;
  step_delay_ms?: number;
}

function pause(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function buildSummary(scenarios: EvalScenarioResult[]): EvalRunSummary {
  return {
    total: scenarios.length,
    queued: scenarios.filter((scenario) => scenario.status === "queued").length,
    running: scenarios.filter((scenario) => scenario.status === "running").length,
    passed: scenarios.filter((scenario) => scenario.status === "passed").length,
    fixed: scenarios.filter((scenario) => scenario.status === "fixed").length,
    deferred: scenarios.filter((scenario) => scenario.status === "deferred").length,
    failed: scenarios.filter((scenario) => scenario.status === "failed").length,
    regressed: scenarios.filter((scenario) => scenario.status === "regressed").length,
  };
}

function inferTopic(message: string): TopicKey {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("bill") ||
    normalized.includes("expense") ||
    normalized.includes("budget")
  ) {
    return TopicKey.Finances;
  }
  if (
    normalized.includes("portrait inquiry") ||
    normalized.includes("client") ||
    normalized.includes("draft a reply")
  ) {
    return TopicKey.Business;
  }
  if (normalized.includes("plumber") || normalized.includes("electrician")) {
    return TopicKey.Vendors;
  }
  if (
    normalized.includes("dinner") ||
    normalized.includes("recipe") ||
    normalized.includes("meal")
  ) {
    return TopicKey.Meals;
  }
  if (
    normalized.includes("ground beef") ||
    normalized.includes("milk") ||
    normalized.includes("grocery") ||
    normalized.startsWith("we need")
  ) {
    return TopicKey.Grocery;
  }
  if (
    normalized.includes("calendar") ||
    normalized.includes("appointment") ||
    normalized.includes("schedule")
  ) {
    return TopicKey.Calendar;
  }

  return TopicKey.FamilyStatus;
}

function inferIntent(message: string): ClassifierIntent {
  const normalized = message.toLowerCase();

  if (
    normalized.startsWith("what") ||
    normalized.startsWith("when") ||
    normalized.startsWith("do we")
  ) {
    return ClassifierIntent.Query;
  }
  if (
    normalized.includes("can come") ||
    normalized.includes("moved to") ||
    normalized.includes("reschedule")
  ) {
    return ClassifierIntent.Update;
  }

  return ClassifierIntent.Request;
}

function inferTargetThread(topic: TopicKey, input: EvalScenarioDefinition["prompt_input"]): string {
  if (input.origin_thread.endsWith("_private")) {
    return input.origin_thread;
  }

  switch (topic) {
    case TopicKey.Finances:
    case TopicKey.Relationship:
      return "couple";
    case TopicKey.Business:
      return "participant_2_private";
    case TopicKey.Health:
    case TopicKey.Pets:
    case TopicKey.Maintenance:
    case TopicKey.Vendors:
      return `${input.concerning[0] ?? "participant_1"}_private`;
    default:
      return input.origin_thread;
  }
}

function inferPriority(topic: TopicKey, intent: ClassifierIntent): DispatchPriority {
  if (intent === ClassifierIntent.Query) {
    return DispatchPriority.Immediate;
  }

  switch (topic) {
    case TopicKey.Finances:
    case TopicKey.Calendar:
    case TopicKey.Business:
      return DispatchPriority.Immediate;
    case TopicKey.Vendors:
    case TopicKey.Maintenance:
      return DispatchPriority.Batched;
    default:
      return DispatchPriority.Immediate;
  }
}

function inferConfirmation(config: SystemConfig, topic: TopicKey): boolean {
  const confirmationTopics = new Set<TopicKey>([TopicKey.Finances]);
  const alwaysRequireApproval = config.confirmation_gates.always_require_approval.length > 0;

  return alwaysRequireApproval && confirmationTopics.has(topic);
}

function composeMessage(topic: TopicKey, input: EvalScenarioDefinition["prompt_input"]): string {
  switch (topic) {
    case TopicKey.Calendar:
      return `Schedule summary: Thursday activity from "${input.message}" is ready to review.`;
    case TopicKey.Grocery:
      return `Grocery list update: added items from "${input.message}" as a shared list.`;
    case TopicKey.Finances:
      return `Approval needed: confirm the bill action before anything is sent.`;
    case TopicKey.Business:
      return `Warm client draft reply prepared for the latest inquiry.`;
    case TopicKey.Vendors:
      return `Vendor record update: the service visit is noted for Tuesday morning.`;
    default:
      return `Status update recorded for "${input.message}".`;
  }
}

function evaluateScenario(
  scenario: EvalScenarioDefinition,
  config: SystemConfig,
): EvalScenarioActual {
  const inferredTopic = inferTopic(scenario.prompt_input.message);
  const inferredIntent = inferIntent(scenario.prompt_input.message);

  const baseActual: EvalScenarioActual = {
    topic: inferredTopic,
    intent: inferredIntent,
    target_thread: inferTargetThread(inferredTopic, scenario.prompt_input),
    priority: inferPriority(inferredTopic, inferredIntent),
    confirmation_required: inferConfirmation(config, inferredTopic),
    composed_message: composeMessage(inferredTopic, scenario.prompt_input),
  };

  return {
    ...baseActual,
    ...scenario.simulation?.actual_overrides,
  };
}

function matchesAllMarkers(message: string, markers: string[] | undefined): boolean {
  if (!markers || markers.length === 0) {
    return true;
  }

  const normalized = message.toLowerCase();
  return markers.every((marker) => normalized.includes(marker.toLowerCase()));
}

function includesForbiddenMarker(message: string, markers: string[] | undefined): boolean {
  if (!markers || markers.length === 0) {
    return false;
  }

  const normalized = message.toLowerCase();
  return markers.some((marker) => normalized.includes(marker.toLowerCase()));
}

function collectFailures(
  scenario: EvalScenarioDefinition,
  actual: EvalScenarioActual,
): EvalScenarioFailure[] {
  const failures: EvalScenarioFailure[] = [];

  if (actual.topic !== scenario.expected.topic) {
    failures.push({
      field: "topic",
      expected: scenario.expected.topic,
      actual: actual.topic,
      prompt_fixable: false,
      message: "The scenario classified into a different topic.",
    });
  }
  if (actual.intent !== scenario.expected.intent) {
    failures.push({
      field: "intent",
      expected: scenario.expected.intent,
      actual: actual.intent,
      prompt_fixable: false,
      message: "The action intent did not match the scenario expectation.",
    });
  }
  if (actual.target_thread !== scenario.expected.target_thread) {
    failures.push({
      field: "target_thread",
      expected: scenario.expected.target_thread,
      actual: actual.target_thread,
      prompt_fixable: false,
      message: "The response targeted a different thread.",
    });
  }
  if (actual.priority !== scenario.expected.priority) {
    failures.push({
      field: "priority",
      expected: scenario.expected.priority,
      actual: actual.priority,
      prompt_fixable: false,
      message: "The outbound priority did not align with the expected dispatch timing.",
    });
  }
  if (actual.confirmation_required !== scenario.expected.confirmation_required) {
    failures.push({
      field: "confirmation_required",
      expected: scenario.expected.confirmation_required,
      actual: actual.confirmation_required,
      prompt_fixable: false,
      message: "The confirmation gate expectation was not met.",
    });
  }
  if (!matchesAllMarkers(actual.composed_message, scenario.expected.tone_markers)) {
    failures.push({
      field: "tone_markers",
      expected: scenario.expected.tone_markers ?? [],
      actual: actual.composed_message,
      prompt_fixable: true,
      message: "The composed output missed one or more expected tone markers.",
    });
  }
  if (!matchesAllMarkers(actual.composed_message, scenario.expected.format_markers)) {
    failures.push({
      field: "format_markers",
      expected: scenario.expected.format_markers ?? [],
      actual: actual.composed_message,
      prompt_fixable: true,
      message: "The composed output missed one or more expected format markers.",
    });
  }
  if (includesForbiddenMarker(actual.composed_message, scenario.expected.must_not)) {
    failures.push({
      field: "must_not",
      expected: scenario.expected.must_not ?? [],
      actual: actual.composed_message,
      prompt_fixable: true,
      message: "The composed output included content the scenario marked as forbidden.",
    });
  }

  return failures;
}

function createScenarioResults(scenarios: EvalScenarioDefinition[]): EvalScenarioResult[] {
  return scenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    category: scenario.category,
    status: "queued",
    raw_outcome: "pass",
    started_at: null,
    completed_at: null,
    expected: scenario.expected,
    actual: null,
    failures: [],
    tuner: null,
  }));
}

function createRunState(
  options: RunSequentialEvalOptions,
  scenarios: EvalScenarioDefinition[],
): EvalRunState {
  const startedAt = new Date().toISOString();

  return {
    id: options.run_id,
    scenario_set: options.scenario_set,
    status: "queued",
    started_at: startedAt,
    completed_at: null,
    summary: buildSummary(createScenarioResults(scenarios)),
    scenarios: createScenarioResults(scenarios),
    logs: [],
    artifacts: {
      json_path: `eval/results/${options.run_id}.json`,
      markdown_path: null,
    },
  };
}

export async function runSequentialEval(options: RunSequentialEvalOptions): Promise<EvalRunState> {
  const stepDelayMs = options.step_delay_ms ?? 200;
  const workspace = await ensureEvalWorkspace(options.repo_root);
  const jsonPath = join(workspace.results_dir, `${options.run_id}.json`);
  const scenarioSet = getScenarioSet(options.scenario_set);
  const state = createRunState(options, scenarioSet.scenarios);
  let logSequence = 0;

  async function persistState(): Promise<void> {
    state.summary = buildSummary(state.scenarios);
    await writeFile(jsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async function pushLog(
    phase: string,
    message: string,
    scenarioId?: string,
    data?: Record<string, unknown>,
    level: EvalScenarioLogEvent["level"] = "info",
  ): Promise<void> {
    state.logs.push({
      seq: ++logSequence,
      timestamp: new Date().toISOString(),
      level,
      phase,
      scenario_id: scenarioId,
      message,
      data,
    });
    await persistState();
  }

  try {
    state.status = "running";
    await persistState();
    await pushLog("run", `Starting sequential eval run for scenario set "${scenarioSet.label}".`);

    for (const scenario of scenarioSet.scenarios) {
      const scenarioResult = state.scenarios.find((entry) => entry.id === scenario.id);

      if (!scenarioResult) {
        continue;
      }

      scenarioResult.status = "running";
      scenarioResult.started_at = new Date().toISOString();
      await persistState();
      await pushLog("scenario", `Starting scenario "${scenario.title}".`, scenario.id);
      await pause(stepDelayMs);

      const actual = evaluateScenario(scenario, systemConfig);
      scenarioResult.actual = actual;
      await pushLog(
        "evaluate",
        "Scenario input evaluated against the current prompt/runtime simulator.",
        scenario.id,
        {
          topic: actual.topic,
          intent: actual.intent,
          target_thread: actual.target_thread,
          priority: actual.priority,
        },
      );
      await pause(stepDelayMs);

      const failures = collectFailures(scenario, actual);
      scenarioResult.failures = failures;
      scenarioResult.raw_outcome = failures.length === 0 ? "pass" : "fail";

      if (failures.length === 0) {
        scenarioResult.status = "passed";
        scenarioResult.completed_at = new Date().toISOString();
        await pushLog("result", "Scenario passed without tuner intervention.", scenario.id);
        await persistState();
        continue;
      }

      await pushLog(
        "diagnose",
        `Scenario produced ${failures.length} failing dimension(s); sending to tuner.`,
        scenario.id,
        { failures: failures.map((failure) => failure.field) },
        "warn",
      );
      await pause(stepDelayMs);

      const diagnosis = diagnoseScenarioFailures(scenario, failures);

      if (diagnosis.can_fix_with_prompt) {
        const tunerOutcome = await generateCandidatePrompt({
          repo_root: options.repo_root,
          candidate_dir: workspace.candidate_dir,
          run_id: options.run_id,
          scenario,
          actual,
          failures,
        });
        scenarioResult.status = tunerOutcome.status;
        scenarioResult.tuner = tunerOutcome;
        await pushLog("tuner", "Prompt candidate created and scenario marked fixed.", scenario.id, {
          candidate_path: tunerOutcome.candidate?.path,
        });
      } else {
        const tunerOutcome = toDeferredTunerOutcome(diagnosis);
        scenarioResult.status = tunerOutcome.status;
        scenarioResult.tuner = tunerOutcome;
        await pushLog(
          "tuner",
          "Scenario deferred because the failure is outside prompt-only tuning scope.",
          scenario.id,
          { failing_dimensions: diagnosis.failing_dimensions },
          "warn",
        );
      }

      scenarioResult.completed_at = new Date().toISOString();
      await persistState();
      await pause(stepDelayMs);
    }

    state.status = "completed";
    state.completed_at = new Date().toISOString();
    const finalizedState = await writeRunArtifacts({
      repo_root: options.repo_root,
      results_dir: workspace.results_dir,
      state,
    });
    state.artifacts = finalizedState.artifacts;
    state.summary = finalizedState.summary;
    await pushLog(
      "run",
      `Eval run completed. Markdown artifact written to ${relative(options.repo_root, join(workspace.results_dir, `${options.run_id}.prompt.md`))}.`,
    );
    await persistState();
    return state;
  } catch (error: unknown) {
    state.status = "failed";
    state.completed_at = new Date().toISOString();
    await pushLog(
      "run",
      error instanceof Error ? error.message : String(error),
      undefined,
      undefined,
      "error",
    );
    await persistState();
    throw error;
  }
}
