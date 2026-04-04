import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { SystemConfig, SystemState } from "../index.js";

interface SeedConfigModule {
  systemConfig: SystemConfig;
}

interface SeedStateModule {
  systemState: SystemState;
}

function seedOverrideExtensionsForRuntime(): string[] {
  const main = process.argv[1] ?? "";
  const underTsxOrTsNode =
    main.endsWith(".ts") ||
    process.execArgv.some((arg) => arg.includes("tsx") || arg.includes("ts-node"));
  return underTsxOrTsNode ? [".js", ".ts"] : [".js"];
}

function findOverridePath(baseName: string): string | null {
  const root = process.cwd();
  for (const ext of seedOverrideExtensionsForRuntime()) {
    const candidate = resolve(root, "_seed", `${baseName}${ext}`);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function loadSeedConfig(): Promise<SystemConfig> {
  const override = findOverridePath("system-config");
  if (override) {
    const mod = (await import(pathToFileURL(override).href)) as SeedConfigModule;
    return mod.systemConfig;
  }

  const mod = await import("./system-config.js");
  return mod.systemConfig;
}

export async function loadSeedState(): Promise<SystemState> {
  const override = findOverridePath("system-state");
  if (override) {
    const mod = (await import(pathToFileURL(override).href)) as SeedStateModule;
    return mod.systemState;
  }

  const mod = await import("./system-state.js");
  return mod.systemState;
}
