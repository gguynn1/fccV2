import { randomUUID } from "node:crypto";

import { runSequentialEval } from "./runners/sequential-runner.js";
import { generateScenarioSetScaffold } from "./scenarios/generate-set.js";
import { listScenarioSets } from "./scenarios/index.js";

interface ParsedArgs {
  command: string;
  run_id: string;
  scenario_set: string;
  mode: "simulator" | "worker" | "fixture-interpreter";
  set_name?: string;
  step_delay_ms?: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "run", ...rest] = argv;
  const parsed: ParsedArgs = {
    command,
    run_id: `eval-run-${randomUUID()}`,
    scenario_set: "default",
    mode: "worker",
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    const next = rest[index + 1];

    if (token === "--run-id" && next) {
      parsed.run_id = next;
      index += 1;
      continue;
    }
    if (token === "--scenario-set" && next) {
      parsed.scenario_set = next;
      index += 1;
      continue;
    }
    if (token === "--set-name" && next) {
      parsed.set_name = next;
      index += 1;
      continue;
    }
    if (token === "--step-delay-ms" && next) {
      parsed.step_delay_ms = Number(next);
      index += 1;
      continue;
    }
    if (
      token === "--mode" &&
      next &&
      (next === "simulator" || next === "worker" || next === "fixture-interpreter")
    ) {
      parsed.mode = next;
      index += 1;
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "list") {
    process.stdout.write(`${JSON.stringify({ scenario_sets: listScenarioSets() }, null, 2)}\n`);
    return;
  }

  if (args.command === "generate-set") {
    const result = await generateScenarioSetScaffold({
      repo_root: process.cwd(),
      requested_name: args.set_name,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (!["run", "watch", "coverage"].includes(args.command)) {
    throw new Error(`Unsupported eval command "${args.command}".`);
  }

  const result = await runSequentialEval({
    repo_root: process.cwd(),
    run_id: args.run_id,
    scenario_set: args.scenario_set,
    step_delay_ms: args.step_delay_ms,
    mode: args.mode,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        run_id: result.id,
        status: result.status,
        summary: result.summary,
        artifacts: result.artifacts,
      },
      null,
      2,
    )}\n`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
