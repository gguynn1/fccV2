import BetterSqlite3 from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { loadEnv } from "./env.js";

function ensureDatabaseDirectory(databasePath: string): void {
  mkdirSync(dirname(databasePath), { recursive: true });
}

function createSeedTables(db: BetterSqlite3.Database): void {
  // Keep seed snapshots in dedicated tables so bootstrapping is idempotent.
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_config_seed (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      seeded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_state_seed (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      seeded_at TEXT NOT NULL
    );
  `);
}

export function initializeDatabase(databasePath: string): BetterSqlite3.Database {
  ensureDatabaseDirectory(databasePath);
  const db = new BetterSqlite3(databasePath);
  // WAL is required for crash resilience and concurrent read behavior.
  db.pragma("journal_mode = WAL");
  createSeedTables(db);
  return db;
}

export async function seedDatabase(
  db: BetterSqlite3.Database,
  databasePathForLog: string,
): Promise<void> {
  const [{ systemConfig }, { systemState }] = await Promise.all([
    import("./_seed/system-config.js"),
    import("./_seed/system-state.js"),
  ]);

  const seededAt = new Date().toISOString();
  const upsertConfig = db.prepare(`
    INSERT INTO system_config_seed (id, payload, seeded_at)
    VALUES (1, @payload, @seeded_at)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      seeded_at = excluded.seeded_at
  `);
  const upsertState = db.prepare(`
    INSERT INTO system_state_seed (id, payload, seeded_at)
    VALUES (1, @payload, @seeded_at)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      seeded_at = excluded.seeded_at
  `);

  const tx = db.transaction(() => {
    // Single transaction keeps config/state snapshots in sync on each seed run.
    upsertConfig.run({
      payload: JSON.stringify(systemConfig),
      seeded_at: seededAt,
    });
    upsertState.run({
      payload: JSON.stringify(systemState),
      seeded_at: seededAt,
    });
  });

  tx();
  console.log(`Seed complete: ${databasePathForLog}`);
}

async function bootstrapDatabase(seedMode: boolean): Promise<void> {
  const env = loadEnv(process.env as Record<string, string | undefined>);
  const databasePath = resolve(process.cwd(), env.DATABASE_PATH);
  const db = initializeDatabase(databasePath);

  try {
    if (seedMode) {
      await seedDatabase(db, databasePath);
    }
  } finally {
    db.close();
  }
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
