import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { pino, type Logger } from "pino";

import { systemState as seedSystemState } from "../../_seed/system-state.js";
import type { ActionRouterResult, StackQueueItem } from "../../01-service-stack/types.js";
import type { SystemConfig } from "../../index.js";
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

function createMinimalSystemConfig(): SystemConfig {
  return {
    metadata: {
      snapshot_time: new Date(),
      description: "Minimal default configuration",
    },
    system: {
      timezone: "America/Chicago",
      locale: "en-US",
      version: "1.0.0",
    },
    assistant: {
      messaging_identity: "",
      name: null,
      description: "Family Command Center assistant",
    },
    entities: [],
    threads: [],
    topics: {} as SystemConfig["topics"],
    escalation_profiles: {} as SystemConfig["escalation_profiles"],
    confirmation_gates: {
      always_require_approval: [],
      expiry_minutes: 30,
      on_expiry: "notify_and_offer_reissue",
    },
    dispatch: {
      priority_levels: {} as SystemConfig["dispatch"]["priority_levels"],
      outbound_budget: {} as SystemConfig["dispatch"]["outbound_budget"],
      routing_rules: {},
      collision_avoidance: {
        description: "Default collision policy",
        precedence_order: [],
        same_precedence_strategy: "batch",
      },
    },
    input_recognition: {
      text: { description: "Plain text messages" },
      structured_choice: { description: "Structured choices", formats: [] },
      reaction: { positive: "positive", negative: "negative" },
      image: { description: "Image attachments", examples: {} },
      forwarded_content: { description: "Forwarded messages" },
      silence: {
        high_accountability: "escalate",
        low_accountability: "disappear",
        never: "never_escalate",
      },
      topic_disambiguation: { description: "Topic disambiguation rules", rules: [] },
      intent_disambiguation: { description: "Intent disambiguation rules", rules: [] },
    },
    daily_rhythm: {} as SystemConfig["daily_rhythm"],
    worker: {
      processing_sequence: [],
      max_thread_history_messages: 15,
      stale_after_hours: 24,
    },
    data_ingest: {
      sources: [],
      future: [],
    },
    scenario_testing: {
      description: "Default scenario testing configuration",
      parts: [],
    },
  };
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

function createDefaultStateSnapshot(now: Date): SystemState {
  const cloned = structuredClone(seedSystemState);

  // Keep type-safe topic defaults while zeroing operational queues/history for empty bootstrap.
  cloned.metadata.snapshot_time = now;
  cloned.metadata.description = "Default empty state snapshot initialized by State Service.";
  cloned.queue.pending = [];
  cloned.queue.recently_dispatched = [];
  cloned.confirmations.pending = [];
  cloned.confirmations.recent = [];
  cloned.escalation_status.active = [];
  cloned.threads = {};
  cloned.digests.history = [];

  return cloned;
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

  public getSystemConfig(): Promise<SystemConfig> {
    const snapshot = this.db.prepare("SELECT payload FROM system_configs WHERE id = 1").get() as
      | { payload: string }
      | undefined;
    if (!snapshot) {
      return Promise.resolve(createMinimalSystemConfig());
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

  public getSystemState(): Promise<SystemState> {
    const snapshot = this.db.prepare("SELECT payload FROM state_snapshots WHERE id = 1").get() as
      | { payload: string }
      | undefined;
    if (!snapshot) {
      return Promise.resolve(createDefaultStateSnapshot(new Date()));
    }

    const state = reviveDatesFromJson<SystemState>(snapshot.payload);
    validateStateSlices(state);
    return Promise.resolve(state);
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
            payload: serializeForStorage(action),
            dispatched_at: actionRecordedAt,
          });
      }

      if (action.decision === "dispatch") {
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
            payload: serializeForStorage(action),
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
    if (mode === StateSnapshotMode.Seed) {
      const { systemConfig: seedConfig } = await import("../../_seed/system-config.js");
      await this.saveSystemConfig(seedConfig);
      await this.saveSystemState(seedSystemState);
      return {
        mode,
        loaded_at: new Date(),
        state: seedSystemState,
      };
    }

    if (mode === StateSnapshotMode.Scenario) {
      if (!scenarioState) {
        throw new Error("Scenario snapshot mode requires a provided state.");
      }
      const { systemConfig: seedConfig } = await import("../../_seed/system-config.js");
      await this.saveSystemConfig(seedConfig);
      await this.saveSystemState(scenarioState);
      return {
        mode,
        loaded_at: new Date(),
        state: scenarioState,
      };
    }

    const emptyState = createDefaultStateSnapshot(new Date());
    const { systemConfig: seedConfig } = await import("../../_seed/system-config.js");
    await this.saveSystemConfig(seedConfig);
    await this.saveSystemState(emptyState);
    return {
      mode: StateSnapshotMode.Empty,
      loaded_at: new Date(),
      state: emptyState,
    };
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
