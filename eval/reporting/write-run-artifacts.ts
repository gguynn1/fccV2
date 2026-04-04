import { writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";

import type { EvalRunState } from "../types.js";

export interface WriteRunArtifactsOptions {
  repo_root: string;
  results_dir: string;
  state: EvalRunState;
}

function formatLogLines(state: EvalRunState, scenarioId: string): string {
  const lines = state.logs
    .filter((log) => log.scenario_id === scenarioId)
    .slice(-8)
    .map((log) => `- ${log.timestamp} [${log.level}] ${log.phase}: ${log.message}`);

  return lines.length > 0 ? lines.join("\n") : "- No logs captured.";
}

function quoteForPrompt(value: string): string {
  return value.replaceAll('"""', '\\"\\"\\"');
}

function scenarioSourceFile(scenarioSet: string): string {
  if (scenarioSet.startsWith("generated-")) {
    return `eval/scenarios/generated/${scenarioSet}.ts`;
  }
  return "eval/scenarios/default.ts";
}

function toLikelyFiles(scenario: EvalRunState["scenarios"][number], scenarioSet: string): string[] {
  const files = new Set<string>();

  files.add(scenarioSourceFile(scenarioSet));

  for (const failure of scenario.failures) {
    switch (failure.field) {
      case "tone_markers":
      case "format_markers":
      case "must_not":
        files.add("eval/runners/sequential-runner.ts");
        files.add("eval/tuner/correct.ts");
        files.add("src/config/default-system-config.ts");
        files.add("src/config/minimal-system-config.ts");
        break;
      case "topic":
      case "intent":
      case "target_thread":
      case "priority":
      case "confirmation_required":
        files.add("eval/runners/sequential-runner.ts");
        files.add("src/config/default-system-config.ts");
        files.add("src/config/minimal-system-config.ts");
        files.add("src/config/runtime-system-config.ts");
        files.add("src/02-supporting-services/03-state-service/index.ts");
        break;
      default:
        break;
    }
  }

  return [...files];
}

function buildAgentPrompt(state: EvalRunState): string {
  const failingScenarios = state.scenarios.filter((scenario) => scenario.raw_outcome === "fail");
  const allPassed = failingScenarios.length === 0;
  const sourceFile = scenarioSourceFile(state.scenario_set);

  const scenarioInstructions = failingScenarios
    .map((scenario) => {
      const failureLines = scenario.failures
        .map(
          (failure) =>
            `- ${failure.field}: expected ${JSON.stringify(failure.expected)}, actual ${JSON.stringify(failure.actual)}`,
        )
        .join("\n");
      const likelyFiles = toLikelyFiles(scenario, state.scenario_set)
        .map((file) => `- \`${file}\``)
        .join("\n");
      const suggestionLine = scenario.tuner?.candidate
        ? `- Prompt suggestion is embedded in this run artifact under the detailed results section.`
        : "- No embedded prompt suggestion was generated.";
      return `### ${scenario.title}

- Scenario ID: \`${scenario.id}\`
- Final status: \`${scenario.status}\`
- Category: \`${scenario.category}\`
${suggestionLine}

Failures:
${failureLines}

Likely files to inspect:
${likelyFiles}

Latest logs:
${formatLogLines(state, scenario.id)}
`;
    })
    .join("\n");

  const artifactBlock = `Artifact files (read these first):
- JSON: \`${state.artifacts.json_path}\`
- Markdown: \`${state.artifacts.markdown_path ?? `eval/results/${state.id}.prompt.md`}\`
- Scenario source: \`${sourceFile}\``;

  const rerunCommand = `npm run eval:run -- --scenario-set ${state.scenario_set} --run-id ${state.id}`;

  if (allPassed) {
    return `# Prompt For Cursor Or Claude Code

Copy everything in the block below into your coding agent:

\`\`\`text
Eval run \`${state.id}\` completed with all ${state.summary.total} scenarios passing.

${artifactBlock}

Run summary:
- total: ${state.summary.total}
- passed: ${state.summary.passed}

All scenarios passed. Review the scenario source file (\`${sourceFile}\`) for:
- edge cases that could be added
- messages that could be more realistic or varied
- topics not yet covered by this set

If you add or modify scenarios, re-run with:
${rerunCommand}

The JSON and markdown artifacts in \`eval/results/\` will be overwritten with the new results.
The admin UI polls these files — refresh the Eval page to see the updated status.
\`\`\`
`;
  }

  return `# Prompt For Cursor Or Claude Code

Copy everything in the block below into your coding agent:

\`\`\`text
You are fixing failures from eval run \`${state.id}\` in the repository currently open on disk.

${artifactBlock}

Goal:
- read the artifact files listed above before making changes
- decide what is actually wrong
- identify the smallest correct change
- make the fix in the right file(s)
- do not blindly trust scenario expectations if the scenario itself appears wrong

Important context:
- this eval implementation is the current local sequential runner under \`eval/\`, not a full real-pipeline eval system
- \`prompt_fix_suggested\` means the eval tuner considered the failure prompt-fixable and embedded a prompt suggestion in the run artifact
- \`investigation_needed\` means the failure likely needs code-level investigation rather than a prompt-only change
- bootstrap/default config now lives under \`src/config/\`; inspect \`src/config/default-system-config.ts\` and \`src/config/minimal-system-config.ts\` before assuming scenario expectations are wrong
- runtime behavior ultimately comes from persisted config loaded through \`src/02-supporting-services/03-state-service/index.ts\` into \`src/config/runtime-system-config.ts\`

Run summary:
- total: ${state.summary.total}
- passed: ${state.summary.passed}
- prompt_fix_suggested: ${state.summary.prompt_fix_suggested}
- investigation_needed: ${state.summary.investigation_needed}
- failed: ${state.summary.failed}
- regressed: ${state.summary.regressed}

Your task:
1. Read the artifact files listed above.
2. Read the failing scenarios listed below.
3. Inspect the suggested files first.
4. Decide whether each failure should be fixed in scenario expectations, runner logic, tuner output, or another nearby file.
5. Implement the fixes.
6. Re-run to verify: ${rerunCommand}
7. Confirm the result improves without breaking other scenarios.

After fixing:
- The JSON and markdown artifacts in \`eval/results/\` will be overwritten with the new results.
- The admin UI polls these files — refresh the Eval page to see the updated status.

Failing scenarios:
${quoteForPrompt(scenarioInstructions)}
\`\`\`
`;
}

function buildMarkdown(state: EvalRunState): string {
  const scenarioSections = state.scenarios
    .map((scenario) => {
      const suggestionLine = scenario.tuner?.candidate
        ? "- Prompt suggestion: embedded below"
        : "- Prompt suggestion: none";
      const failureLines =
        scenario.failures.length > 0
          ? scenario.failures
              .map(
                (failure) =>
                  `- ${failure.field}: expected ${JSON.stringify(failure.expected)}, actual ${JSON.stringify(failure.actual)}`,
              )
              .join("\n")
          : "- None";

      return `## ${scenario.title}

- Scenario ID: \`${scenario.id}\`
- Category: \`${scenario.category}\`
- Final status: \`${scenario.status}\`
- Raw outcome: \`${scenario.raw_outcome}\`
- Started: ${scenario.started_at ?? "n/a"}
- Completed: ${scenario.completed_at ?? "n/a"}
${suggestionLine}

### Tuner Summary
${scenario.tuner?.summary ?? "No tuner action required."}

${
  scenario.tuner?.candidate
    ? `### Embedded Prompt Suggestion

\`\`\`md
${scenario.tuner.candidate.body}
\`\`\`
`
    : ""
}

### Failures
${failureLines}

### Logs
${formatLogLines(state, scenario.id)}
`;
    })
    .join("\n");

  return `# Eval Prompt Run

- Run ID: \`${state.id}\`
- Scenario set: \`${state.scenario_set}\`
- Status: \`${state.status}\`
- Started: ${state.started_at}
- Completed: ${state.completed_at ?? "running"}

## Summary

- Total: ${state.summary.total}
- Passed: ${state.summary.passed}
- Prompt Fix Suggested: ${state.summary.prompt_fix_suggested}
- Investigation Needed: ${state.summary.investigation_needed}
- Failed: ${state.summary.failed}
- Regressed: ${state.summary.regressed}

## Pasteable Prompt

${buildAgentPrompt(state)}

## Detailed Results

${scenarioSections}
`;
}

export async function writeRunArtifacts(options: WriteRunArtifactsOptions): Promise<EvalRunState> {
  const jsonPath = join(options.results_dir, `${options.state.id}.json`);
  const markdownPath = join(options.results_dir, `${options.state.id}.prompt.md`);
  const nextState: EvalRunState = {
    ...options.state,
    artifacts: {
      json_path: relative(options.repo_root, jsonPath),
      markdown_path: relative(options.repo_root, markdownPath),
    },
  };
  const markdown = buildMarkdown(nextState);

  await writeFile(jsonPath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdown, "utf8");

  return nextState;
}

export function toRunArtifactFilename(runId: string): string {
  return basename(`${runId}.prompt.md`);
}
