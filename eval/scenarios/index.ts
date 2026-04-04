import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { EvalScenarioDefinition } from "../types.js";
import {
  continuityRegressionName,
  continuityRegressionScenarios,
} from "./continuity-regression.js";
import { defaultScenarios, defaultScenarioSetName } from "./default.js";
import { digestQualityName, digestQualityScenarios } from "./digest-quality.js";
import { nudgeRealismName, nudgeRealismScenarios } from "./nudge-realism.js";
import {
  systemTriggeredTruthName,
  systemTriggeredTruthScenarios,
} from "./system-triggered-truth.js";
import { threadDynamicsName, threadDynamicsScenarios } from "./thread-dynamics.js";
import { toneRegressionName, toneRegressionScenarios } from "./tone-regression.js";

export interface EvalScenarioSet {
  name: string;
  label: string;
  scenarios: EvalScenarioDefinition[];
}

const generatedDirectory = join(dirname(fileURLToPath(import.meta.url)), "generated");

function toLabel(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

function extractScenarioSets(
  scenarioModule: Record<string, unknown>,
  fileName: string,
): EvalScenarioSet[] {
  const discoveredSets: EvalScenarioSet[] = [];
  const fallbackName = basename(fileName, ".ts");

  for (const [exportName, exportValue] of Object.entries(scenarioModule)) {
    if (!exportName.endsWith("Scenarios") || !Array.isArray(exportValue)) {
      continue;
    }

    const baseName = exportName.slice(0, -"Scenarios".length);
    const setNameExport = scenarioModule[`${baseName}Name`];
    const setName = typeof setNameExport === "string" ? setNameExport : fallbackName;

    discoveredSets.push({
      name: setName,
      label: toLabel(setName),
      scenarios: exportValue as EvalScenarioDefinition[],
    });
  }

  return discoveredSets;
}

async function loadGeneratedScenarioSets(): Promise<EvalScenarioSet[]> {
  if (!existsSync(generatedDirectory)) {
    return [];
  }

  const generatedFiles = readdirSync(generatedDirectory)
    .filter((fileName) => fileName.endsWith(".ts"))
    .sort((a, b) => a.localeCompare(b));

  const generatedScenarioSets: EvalScenarioSet[] = [];

  for (const fileName of generatedFiles) {
    const absolutePath = join(generatedDirectory, fileName);

    try {
      const scenarioModule = (await import(pathToFileURL(absolutePath).href)) as Record<
        string,
        unknown
      >;
      generatedScenarioSets.push(...extractScenarioSets(scenarioModule, fileName));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Skipping generated scenario set "${fileName}": ${message}\n`);
    }
  }

  return generatedScenarioSets;
}

const scenarioSets: EvalScenarioSet[] = [
  {
    name: defaultScenarioSetName,
    label: "Default",
    scenarios: defaultScenarios,
  },
  {
    name: threadDynamicsName,
    label: "Thread Dynamics",
    scenarios: threadDynamicsScenarios,
  },
  {
    name: continuityRegressionName,
    label: "Continuity Regression",
    scenarios: continuityRegressionScenarios,
  },
  {
    name: digestQualityName,
    label: "Digest Quality",
    scenarios: digestQualityScenarios,
  },
  {
    name: toneRegressionName,
    label: "Tone Regression",
    scenarios: toneRegressionScenarios,
  },
  {
    name: nudgeRealismName,
    label: "Nudge Realism",
    scenarios: nudgeRealismScenarios,
  },
  {
    name: systemTriggeredTruthName,
    label: "System Triggered Truth",
    scenarios: systemTriggeredTruthScenarios,
  },
  ...(await loadGeneratedScenarioSets()),
];

export function listScenarioSets(): Array<Pick<EvalScenarioSet, "name" | "label">> {
  return scenarioSets.map(({ name, label }) => ({ name, label }));
}

export function getScenarioSet(name: string): EvalScenarioSet {
  return scenarioSets.find((scenarioSet) => scenarioSet.name === name) ?? scenarioSets[0];
}
