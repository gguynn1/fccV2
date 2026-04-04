import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import BetterSqlite3 from "better-sqlite3";

import { createStateService } from "./02-supporting-services/03-state-service/index.js";
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

export async function bootstrapDatabase(databasePathForLog: string): Promise<void> {
  const db = initializeDatabase(databasePathForLog);
  db.close();

  const stateService = createStateService(databasePathForLog);
  try {
    await stateService.getSystemConfig();
    await stateService.getSystemState();
    console.log(`Bootstrap complete: ${databasePathForLog}`);
  } finally {
    stateService.close();
  }
}

async function main(): Promise<void> {
  const env = loadEnv(process.env as Record<string, string | undefined>);
  const databasePath = resolve(process.cwd(), env.DATABASE_PATH);
  await bootstrapDatabase(databasePath);
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
