import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export interface EvalWorkspacePaths {
  results_dir: string;
}

export function getEvalWorkspacePaths(repoRoot: string): EvalWorkspacePaths {
  return {
    results_dir: resolve(repoRoot, "eval/results"),
  };
}

export async function ensureEvalWorkspace(repoRoot: string): Promise<EvalWorkspacePaths> {
  const paths = getEvalWorkspacePaths(repoRoot);
  await mkdir(paths.results_dir, { recursive: true });
  return paths;
}
