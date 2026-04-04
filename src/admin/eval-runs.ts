import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

interface EvalScenarioSetSummary {
  name: string;
  label: string;
}

export interface GeneratedScenarioSetResult {
  scenario_set_name: string;
  file_path: string;
  guide_path: string;
}

export interface EvalRunRecord {
  id: string;
  scenario_set: string;
  status: string;
  fidelity?: string;
  started_at: string;
  completed_at: string | null;
  summary: Record<string, number>;
  scenarios: Array<{
    id: string;
    title: string;
    status: string;
    category: string;
    raw_outcome?: string;
    started_at?: string | null;
    completed_at?: string | null;
    expected?: Record<string, unknown>;
    actual?: Record<string, unknown>;
    failures?: Array<{ field: string; message: string }>;
    tuner?: {
      status: string;
      summary: string;
      candidate?: {
        title: string;
        summary: string;
        body: string;
      };
    } | null;
  }>;
  logs: Array<{
    seq: number;
    timestamp: string;
    level: string;
    phase: string;
    scenario_id?: string;
    message: string;
  }>;
  artifacts: {
    json_path: string;
    markdown_path: string | null;
  };
}

const activeRuns = new Map<string, ChildProcessWithoutNullStreams>();
const defaultScenarioSets: EvalScenarioSetSummary[] = [{ name: "default", label: "Default" }];
let scenarioSets: EvalScenarioSetSummary[] = [...defaultScenarioSets];
let scenarioSetRefreshPromise: Promise<void> | null = null;

function getResultsDirectory(): string {
  return resolve(process.cwd(), "eval/results");
}

function getNpmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function ensureResultsDirectory(): Promise<string> {
  const resultsDirectory = getResultsDirectory();
  await mkdir(resultsDirectory, { recursive: true });
  return resultsDirectory;
}

async function readRunRecord(filePath: string): Promise<EvalRunRecord | null> {
  try {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as EvalRunRecord;
  } catch {
    return null;
  }
}

export async function listEvalRuns(limit = 20): Promise<EvalRunRecord[]> {
  const resultsDirectory = await ensureResultsDirectory();
  const filenames = (await readdir(resultsDirectory)).filter((filename) =>
    filename.endsWith(".json"),
  );
  const entries = await Promise.all(
    filenames.map(async (filename) => {
      const filePath = resolve(resultsDirectory, filename);
      const fileStat = await stat(filePath);
      return { filePath, modifiedAt: fileStat.mtimeMs };
    }),
  );

  entries.sort((left, right) => right.modifiedAt - left.modifiedAt);

  const records = await Promise.all(
    entries.slice(0, limit).map((entry) => readRunRecord(entry.filePath)),
  );

  return records.filter((record): record is EvalRunRecord => record !== null);
}

export async function getEvalRun(runId: string): Promise<EvalRunRecord | null> {
  const resultsDirectory = await ensureResultsDirectory();
  return readRunRecord(resolve(resultsDirectory, `${runId}.json`));
}

export async function getEvalRunMarkdown(
  runId: string,
): Promise<{ path: string; content: string } | null> {
  const resultsDirectory = await ensureResultsDirectory();
  const markdownPath = resolve(resultsDirectory, `${runId}.prompt.md`);

  try {
    const content = await readFile(markdownPath, "utf8");
    return {
      path: `eval/results/${runId}.prompt.md`,
      content,
    };
  } catch {
    return null;
  }
}

export function getEvalScenarioSets(): EvalScenarioSetSummary[] {
  return scenarioSets;
}

function toScenarioSetSummary(value: unknown): EvalScenarioSetSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.name !== "string" || typeof candidate.label !== "string") {
    return null;
  }

  return { name: candidate.name, label: candidate.label };
}

function parseJsonFromCommandOutput(output: string): Record<string, unknown> {
  const trimmed = output.trim();

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("Eval CLI did not return JSON output.");
    }

    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
  }
}

async function runEvalCliJson(args: string[]): Promise<Record<string, unknown>> {
  const child = spawn(getNpmExecutable(), ["--silent", "run", ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutChunks.push(chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(
      Buffer.concat(stderrChunks).toString("utf8").trim() || "Eval CLI command failed.",
    );
  }

  return parseJsonFromCommandOutput(Buffer.concat(stdoutChunks).toString("utf8"));
}

export async function refreshEvalScenarioSets(): Promise<void> {
  if (scenarioSetRefreshPromise) {
    await scenarioSetRefreshPromise;
    return;
  }

  scenarioSetRefreshPromise = (async () => {
    try {
      const result = await runEvalCliJson(["eval:list"]);
      const parsedScenarioSets = Array.isArray(result.scenario_sets)
        ? result.scenario_sets
            .map((entry) => toScenarioSetSummary(entry))
            .filter((entry): entry is EvalScenarioSetSummary => entry !== null)
        : [];

      scenarioSets = parsedScenarioSets.length > 0 ? parsedScenarioSets : [...defaultScenarioSets];
    } catch {
      scenarioSets = [...defaultScenarioSets];
    }
  })();

  try {
    await scenarioSetRefreshPromise;
  } finally {
    scenarioSetRefreshPromise = null;
  }
}

export function getActiveEvalRunId(): string | null {
  for (const [runId, child] of activeRuns.entries()) {
    if (child.exitCode === null && !child.killed) {
      return runId;
    }
  }

  return null;
}

export async function startEvalRun(scenarioSet: string): Promise<{ run_id: string }> {
  if (getActiveEvalRunId()) {
    throw new Error("An eval run is already active.");
  }

  await ensureResultsDirectory();
  const runId = `eval-run-${randomUUID()}`;
  const child = spawn(
    getNpmExecutable(),
    [
      "run",
      "eval:run",
      "--",
      "--run-id",
      runId,
      "--scenario-set",
      scenarioSet,
      "--step-delay-ms",
      "250",
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
    },
  );

  activeRuns.set(runId, child);

  const cleanup = () => {
    activeRuns.delete(runId);
  };

  child.on("exit", cleanup);
  child.on("error", cleanup);

  child.stdout.resume();
  child.stderr.resume();

  return { run_id: runId };
}

export async function generateScenarioSet(): Promise<GeneratedScenarioSetResult> {
  const result = await runEvalCliJson(["eval:generate-set", "--"]);
  await refreshEvalScenarioSets();

  return {
    scenario_set_name: String(result.scenario_set_name),
    file_path: String(result.file_path),
    guide_path: String(result.guide_path),
  };
}
