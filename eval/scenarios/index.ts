import type { EvalScenarioDefinition } from "../types.js";
import { defaultScenarios, defaultScenarioSetName } from "./default.js";

export interface EvalScenarioSet {
  name: string;
  label: string;
  scenarios: EvalScenarioDefinition[];
}

const scenarioSets: EvalScenarioSet[] = [
  {
    name: defaultScenarioSetName,
    label: "Default",
    scenarios: defaultScenarios,
  },
];

export function listScenarioSets(): Array<Pick<EvalScenarioSet, "name" | "label">> {
  return scenarioSets.map(({ name, label }) => ({ name, label }));
}

export function getScenarioSet(name: string): EvalScenarioSet {
  return scenarioSets.find((scenarioSet) => scenarioSet.name === name) ?? scenarioSets[0];
}
