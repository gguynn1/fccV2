import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { pino, type Logger } from "pino";

import type { ActionRouterResult, StackQueueItem } from "../../01-service-stack/types.js";
import {
  createMinimalSystemConfig,
  createMinimalSystemState,
} from "../../config/minimal-system-config.js";
import type { SystemConfig } from "../../index.js";
import { DispatchPriority, TopicKey } from "../../types.js";
import type { ThreadHistory } from "../05-routing-service/types.js";
import type { StateService } from "../types.js";
import {
  businessStateSchema,
  calendarStateSchema,
  choresStateSchema,
  confirmationsStateRecordSchema,
  dataIngestStateRecordSchema,
  digestsStateRecordSchema,
  escalationStatusRecordSchema,
  familyStatusStateSchema,
  financesStateSchema,
  groceryStateSchema,
  healthStateSchema,
  maintenanceStateSchema,
  mealsStateSchema,
  outboundBudgetTrackerRecordSchema,
  petsStateSchema,
  queueStateRecordSchema,
  relationshipStateSchema,
  schoolStateSchema,
  StateSnapshotMode,
  threadHistoryRecordSchema,
  travelStateSchema,
  vendorsStateSchema,
  type StateSnapshotEnvelope,
  type SystemState,
} from "./types.js";

const DEFAULT_LOGGER = pino({ name: "state-service" });

interface MigrationFile {
  version: number;
  file_name: string;
  sql: string;
}

interface StoredDispatchRecord {
  id: string;
  topic: SystemState["queue"]["recently_dispatched"][number]["topic"];
  target_thread: string;
  content: string;
  dispatched_at: Date;
  priority: SystemState["queue"]["recently_dispatched"][number]["priority"];
  included_in?: string;
  response_received?: boolean;
  escalation_step?: number;
}

function ensureDatabaseDirectory(databasePath: string): void {
  mkdirSync(dirname(databasePath), { recursive: true });
}

function migrationVersionFromName(fileName: string): number | null {
  const match = /^(\d+)-.+\.sql$/u.exec(fileName);
  return match ? Number(match[1]) : null;
}

function readMigrationFiles(): MigrationFile[] {
  const candidates = [
    resolve(process.cwd(), "src/02-supporting-services/03-state-service/migrations"),
    resolve(process.cwd(), "dist/02-supporting-services/03-state-service/migrations"),
  ];
  const migrationDirectory = candidates.find((candidatePath) => existsSync(candidatePath));
  if (!migrationDirectory) {
    return [];
  }

  return readdirSync(migrationDirectory)
    .map((fileName) => {
      const version = migrationVersionFromName(fileName);
      if (version === null) {
        return null;
      }

      return {
        version,
        file_name: fileName,
        sql: readFileSync(resolve(migrationDirectory, fileName), "utf8"),
      } satisfies MigrationFile;
    })
    .filter((entry): entry is MigrationFile => entry !== null)
    .sort((left, right) => left.version - right.version);
}

function createSchemaVersionTable(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function reviveDatesFromJson<T>(payload: string): T {
  return JSON.parse(payload, (_key: string, value: unknown) => {
    if (typeof value !== "string") {
      return value;
    }
    const isIsoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/u.test(value);
    if (!isIsoDate) {
      return value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }) as T;
}

function serializeForStorage(value: unknown): string {
  return JSON.stringify(value);
}

function validateStateSlices(state: SystemState): void {
  queueStateRecordSchema.parse(state.queue);
  confirmationsStateRecordSchema.parse(state.confirmations);
  digestsStateRecordSchema.parse(state.digests);
  escalationStatusRecordSchema.parse(state.escalation_status);
  outboundBudgetTrackerRecordSchema.parse(state.outbound_budget_tracker);
  dataIngestStateRecordSchema.parse(state.data_ingest_state);
  calendarStateSchema.parse(state.calendar);
  choresStateSchema.parse(state.chores);
  financesStateSchema.parse(state.finances);
  groceryStateSchema.parse(state.grocery);
  healthStateSchema.parse(state.health);
  petsStateSchema.parse(state.pets);
  schoolStateSchema.parse(state.school);
  travelStateSchema.parse(state.travel);
  vendorsStateSchema.parse(state.vendors);
  businessStateSchema.parse(state.business);
  relationshipStateSchema.parse(state.relationship);
  familyStatusStateSchema.parse(state.family_status);
  mealsStateSchema.parse(state.meals);
  maintenanceStateSchema.parse(state.maintenance);
  Object.values(state.threads).forEach((thread) => {
    threadHistoryRecordSchema.parse(thread);
  });
}

function extractQueueItemId(queueItem: StackQueueItem): string {
  if (queueItem.id) {
    return queueItem.id;
  }
  return `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toStoredDispatchRecord(
  queueItemId: string,
  queueItem: StackQueueItem,
  action: ActionRouterResult,
  dispatchedAt: Date,
): StoredDispatchRecord | null {
  if (action.decision === "dispatch") {
    return {
      id: queueItemId,
      topic: queueItem.topic ?? TopicKey.FamilyStatus,
      target_thread: action.outbound.target_thread,
      content: action.outbound.content,
      dispatched_at: dispatchedAt,
      priority: action.outbound.priority,
    };
  }

  if (action.decision === "store") {
    return {
      id: queueItemId,
      topic: queueItem.topic ?? TopicKey.FamilyStatus,
      target_thread: action.queue_item.target_thread,
      content:
        typeof queueItem.content === "string"
          ? queueItem.content
          : JSON.stringify(queueItem.content),
      dispatched_at: dispatchedAt,
      priority: queueItem.priority ?? DispatchPriority.Silent,
    };
  }

  return null;
}

function createDefaultStateSnapshot(now: Date): SystemState {
  return createMinimalSystemState(now);
}

export class SqliteStateService implements StateService {
  private readonly db: BetterSqlite3.Database;

  private readonly logger: Logger;

  public constructor(databasePath: string, logger: Logger = DEFAULT_LOGGER) {
    ensureDatabaseDirectory(databasePath);
    this.db = new BetterSqlite3(databasePath);
    this.logger = logger;
    this.db.pragma("journal_mode = WAL");
    this.applyPendingMigrations();
  }

  public close(): void {
    this.db.close();
  }

  public async getSystemConfig(): Promise<SystemConfig> {
    const snapshot = this.db.prepare("SELECT payload FROM system_configs WHERE id = 1").get() as
      | { payload: string }
      | undefined;
    if (!snapshot) {
      const config = createMinimalSystemConfig();
      await this.saveSystemConfig(config);
      return config;
    }

    return Promise.resolve(reviveDatesFromJson<SystemConfig>(snapshot.payload));
  }

  public saveSystemConfig(config: SystemConfig): Promise<void> {
    const nowIso = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT INTO system_configs (id, payload, updated_at)
        VALUES (1, @payload, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at
        `,
      )
      .run({
        payload: serializeForStorage(config),
        updated_at: nowIso,
      });

    this.logger.info({ at: nowIso }, "System config snapshot persisted.");
    return Promise.resolve();
  }

  public async getSystemState(): Promise<SystemState> {
    const snapshot = this.db.prepare("SELECT payload FROM state_snapshots WHERE id = 1").get() as
      | { payload: string }
      | undefined;
    if (!snapshot) {
      const state = createDefaultStateSnapshot(new Date());
      await this.saveSystemState(state);
      return state;
    }

    const state = reviveDatesFromJson<SystemState>(snapshot.payload);
    validateStateSlices(state);

    // The worker's appendDispatchResult writes to queue_pending/queue_recently_dispatched
    // SQL tables but does not update the snapshot blob. Read from the SQL tables so the
    // scheduler and other consumers always see the current pending set.
    state.queue.pending = this.readQueuePendingFromTable();
    state.queue.recently_dispatched = this.readQueueRecentlyDispatchedFromTable();

    return state;
  }

  public saveSystemState(state: SystemState): Promise<void> {
    validateStateSlices(state);
    const nowIso = new Date().toISOString();
    const saveSnapshot = this.db.transaction((nextState: SystemState) => {
      this.db
        .prepare(
          `
          INSERT INTO state_snapshots (id, payload, updated_at)
          VALUES (1, @payload, @updated_at)
          ON CONFLICT(id) DO UPDATE SET
            payload = excluded.payload,
            updated_at = excluded.updated_at
          `,
        )
        .run({
          payload: serializeForStorage(nextState),
          updated_at: nowIso,
        });
      this.syncQueuePendingToTable(nextState.queue.pending);
      this.syncQueueRecentlyDispatchedToTable(nextState.queue.recently_dispatched);
    });

    saveSnapshot(state);
    this.logger.info({ at: nowIso }, "System state snapshot persisted.");
    return Promise.resolve();
  }

  public getThreadHistory(thread_id: string): Promise<ThreadHistory | null> {
    const row = this.db
      .prepare("SELECT payload FROM thread_histories WHERE thread_id = ?")
      .get(thread_id) as { payload: string } | undefined;
    if (!row) {
      return Promise.resolve(null);
    }

    const parsed = reviveDatesFromJson<ThreadHistory>(row.payload);
    threadHistoryRecordSchema.parse(parsed);
    return Promise.resolve(parsed);
  }

  public saveThreadHistory(thread_id: string, history: ThreadHistory): Promise<void> {
    threadHistoryRecordSchema.parse(history);
    this.db
      .prepare(
        `
        INSERT INTO thread_histories (thread_id, payload, updated_at)
        VALUES (@thread_id, @payload, @updated_at)
        ON CONFLICT(thread_id) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at
        `,
      )
      .run({
        thread_id,
        payload: serializeForStorage(history),
        updated_at: new Date().toISOString(),
      });

    return Promise.resolve();
  }

  public pruneThreadHistories(validThreadIds: string[]): number {
    const placeholders = validThreadIds.map(() => "?").join(", ");
    const statement =
      validThreadIds.length === 0
        ? "DELETE FROM thread_histories"
        : `DELETE FROM thread_histories WHERE thread_id NOT IN (${placeholders})`;
    const result = this.db.prepare(statement).run(...validThreadIds);
    return result.changes;
  }

  /**
   * Atomically persists state, prunes stale thread histories, and persists
   * config within a single SQLite transaction. Prevents crash-consistency
   * gaps where state is saved but config is not (or vice versa).
   */
  public applyAdminConfigAtomically(
    nextState: SystemState,
    nextConfig: SystemConfig,
    validThreadIds: string[],
  ): void {
    validateStateSlices(nextState);
    const nowIso = new Date().toISOString();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO state_snapshots (id, payload, updated_at)
           VALUES (1, @payload, @updated_at)
           ON CONFLICT(id) DO UPDATE SET
             payload = excluded.payload,
             updated_at = excluded.updated_at`,
        )
        .run({ payload: serializeForStorage(nextState), updated_at: nowIso });
      this.syncQueuePendingToTable(nextState.queue.pending);
      this.syncQueueRecentlyDispatchedToTable(nextState.queue.recently_dispatched);

      const placeholders = validThreadIds.map(() => "?").join(", ");
      const pruneStatement =
        validThreadIds.length === 0
          ? "DELETE FROM thread_histories"
          : `DELETE FROM thread_histories WHERE thread_id NOT IN (${placeholders})`;
      this.db.prepare(pruneStatement).run(...validThreadIds);

      this.db
        .prepare(
          `INSERT INTO system_configs (id, payload, updated_at)
           VALUES (1, @payload, @updated_at)
           ON CONFLICT(id) DO UPDATE SET
             payload = excluded.payload,
             updated_at = excluded.updated_at`,
        )
        .run({ payload: serializeForStorage(nextConfig), updated_at: nowIso });
    });

    tx();
    this.logger.info({ at: nowIso }, "Admin config change persisted atomically.");
  }

  public appendDispatchResult(
    queue_item: StackQueueItem,
    action: ActionRouterResult,
  ): Promise<void> {
    const queueItemId = extractQueueItemId(queue_item);
    const actionRecordedAt = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM queue_pending WHERE id = ?").run(queueItemId);

      if (action.decision === "hold") {
        this.db
          .prepare(
            `
            INSERT INTO queue_pending (id, payload, created_at)
            VALUES (@id, @payload, @created_at)
            ON CONFLICT(id) DO UPDATE SET
              payload = excluded.payload,
              created_at = excluded.created_at
            `,
          )
          .run({
            id: queueItemId,
            payload: serializeForStorage({
              ...action.queue_item,
              hold_until: action.hold_until,
              priority: queue_item.priority,
              topic: queue_item.topic,
              intent: queue_item.intent,
              source: queue_item.source,
              content: queue_item.content,
              clarification_of: queue_item.clarification_of,
              idempotency_key: queue_item.idempotency_key,
            }),
            created_at: actionRecordedAt,
          });
      }

      if (action.decision === "store") {
        const record = toStoredDispatchRecord(
          queueItemId,
          queue_item,
          action,
          new Date(actionRecordedAt),
        );
        this.db
          .prepare(
            `
            INSERT INTO queue_recently_dispatched (id, payload, dispatched_at)
            VALUES (@id, @payload, @dispatched_at)
            ON CONFLICT(id) DO UPDATE SET
              payload = excluded.payload,
              dispatched_at = excluded.dispatched_at
            `,
          )
          .run({
            id: queueItemId,
            payload: serializeForStorage(record),
            dispatched_at: actionRecordedAt,
          });
      }

      if (action.decision === "dispatch") {
        const record = toStoredDispatchRecord(
          queueItemId,
          queue_item,
          action,
          new Date(actionRecordedAt),
        );
        this.db
          .prepare(
            `
            INSERT INTO queue_recently_dispatched (id, payload, dispatched_at)
            VALUES (@id, @payload, @dispatched_at)
            ON CONFLICT(id) DO UPDATE SET
              payload = excluded.payload,
              dispatched_at = excluded.dispatched_at
            `,
          )
          .run({
            id: queueItemId,
            payload: serializeForStorage(record),
            dispatched_at: actionRecordedAt,
          });
      }
    });

    tx();
    this.logger.info({ queueItemId, decision: action.decision }, "Dispatch result appended.");
    return Promise.resolve();
  }

  public async loadSnapshot(
    mode: StateSnapshotMode,
    scenarioState?: SystemState,
  ): Promise<StateSnapshotEnvelope> {
    if (mode === StateSnapshotMode.Scenario) {
      if (!scenarioState) {
        throw new Error("Scenario snapshot mode requires a provided state.");
      }
      await this.getSystemConfig();
      await this.saveSystemState(scenarioState);
      return {
        mode,
        loaded_at: new Date(),
        state: scenarioState,
      };
    }

    const emptyState = createDefaultStateSnapshot(new Date());
    await this.getSystemConfig();
    await this.saveSystemState(emptyState);
    return {
      mode: StateSnapshotMode.Empty,
      loaded_at: new Date(),
      state: emptyState,
    };
  }

  private readQueuePendingFromTable(): SystemState["queue"]["pending"] {
    const rows = this.db
      .prepare("SELECT payload FROM queue_pending ORDER BY created_at ASC")
      .all() as { payload: string }[];
    return rows.map((row) => reviveDatesFromJson(row.payload));
  }

  private readQueueRecentlyDispatchedFromTable(): SystemState["queue"]["recently_dispatched"] {
    const rows = this.db
      .prepare(
        "SELECT id, payload, dispatched_at FROM queue_recently_dispatched ORDER BY dispatched_at DESC",
      )
      .all() as { id: string; payload: string; dispatched_at: string }[];
    return rows.flatMap((row) => {
      const parsed = reviveDatesFromJson<StoredDispatchRecord | ActionRouterResult>(row.payload);
      if ("decision" in parsed) {
        if (parsed.decision === "dispatch") {
          return [
            {
              id: row.id,
              topic: TopicKey.FamilyStatus,
              target_thread: parsed.outbound.target_thread,
              content: parsed.outbound.content,
              dispatched_at: new Date(row.dispatched_at),
              priority: parsed.outbound.priority,
            },
          ];
        }
        if (parsed.decision === "store") {
          return [
            {
              id: row.id,
              topic: TopicKey.FamilyStatus,
              target_thread: parsed.queue_item.target_thread,
              content: "",
              dispatched_at: new Date(row.dispatched_at),
              priority: DispatchPriority.Silent,
            },
          ];
        }
        return [];
      }
      return [{ ...parsed, id: row.id, dispatched_at: new Date(row.dispatched_at) }];
    });
  }

  private syncQueueRecentlyDispatchedToTable(
    recentlyDispatched: SystemState["queue"]["recently_dispatched"],
  ): void {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM queue_recently_dispatched").run();
      const insert = this.db.prepare(
        "INSERT INTO queue_recently_dispatched (id, payload, dispatched_at) VALUES (?, ?, ?)",
      );
      for (const item of recentlyDispatched) {
        insert.run(
          item.id,
          serializeForStorage(item),
          item.dispatched_at instanceof Date
            ? item.dispatched_at.toISOString()
            : String(item.dispatched_at),
        );
      }
    });
    tx();
  }

  private syncQueuePendingToTable(pending: SystemState["queue"]["pending"]): void {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM queue_pending").run();
      const insert = this.db.prepare(
        "INSERT INTO queue_pending (id, payload, created_at) VALUES (?, ?, ?)",
      );
      for (const item of pending) {
        insert.run(
          item.id,
          serializeForStorage(item),
          item.created_at instanceof Date ? item.created_at.toISOString() : String(item.created_at),
        );
      }
    });
    tx();
  }

  private applyPendingMigrations(): void {
    createSchemaVersionTable(this.db);

    const applied = this.db
      .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_version")
      .get() as { version: number };
    const migrationFiles = readMigrationFiles();

    // Migrations are append-only; each version is applied exactly once in order.
    for (const migration of migrationFiles) {
      if (migration.version <= applied.version) {
        continue;
      }

      const tx = this.db.transaction(() => {
        this.db.exec(migration.sql);
        this.db
          .prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)")
          .run(migration.version, new Date().toISOString());
      });
      tx();

      this.logger.info(
        { version: migration.version, file: migration.file_name },
        "Applied state database migration.",
      );
    }
  }
}

export function createStateService(databasePath: string, logger?: Logger): SqliteStateService {
  return new SqliteStateService(databasePath, logger);
}
