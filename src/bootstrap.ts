import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import BetterSqlite3 from "better-sqlite3";

import { createStateService } from "./02-supporting-services/03-state-service/index.js";
import { StateSnapshotMode } from "./02-supporting-services/03-state-service/types.js";
import { loadEnv } from "./env.js";

function ensureDatabaseDirectory(databasePath: string): void {
  mkdirSync(dirname(databasePath), { recursive: true });
}

export function initializeDatabase(databasePath: string): BetterSqlite3.Database {
  ensureDatabaseDirectory(databasePath);
  const db = new BetterSqlite3(databasePath);
  // WAL is required for crash resilience and concurrent read behavior.
  db.pragma("journal_mode = WAL");
  return db;
}

export async function seedDatabase(databasePathForLog: string): Promise<void> {
  const stateService = createStateService(databasePathForLog);
  try {
    await stateService.loadSnapshot(StateSnapshotMode.Seed);
    console.log(`Seed complete: ${databasePathForLog}`);
  } finally {
    stateService.close();
  }
}

async function bootstrapDatabase(seedMode: boolean): Promise<void> {
  const env = loadEnv(process.env as Record<string, string | undefined>);
  const databasePath = resolve(process.cwd(), env.DATABASE_PATH);

  if (seedMode) {
    await seedDatabase(databasePath);
    return;
  }

  const db = initializeDatabase(databasePath);
  db.close();
}

async function main(): Promise<void> {
  const seedMode = process.argv.includes("--seed");
  await bootstrapDatabase(seedMode);
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
