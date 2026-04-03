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

function buildMarkdown(state: EvalRunState): string {
  const scenarioSections = state.scenarios
    .map((scenario) => {
      const candidateLine = scenario.tuner?.candidate
        ? `- Candidate: \`${scenario.tuner.candidate.path}\``
        : "- Candidate: none";
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
${candidateLine}

### Tuner Summary
${scenario.tuner?.summary ?? "No tuner action required."}

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
- Fixed: ${state.summary.fixed}
- Deferred: ${state.summary.deferred}
- Failed: ${state.summary.failed}
- Regressed: ${state.summary.regressed}

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
