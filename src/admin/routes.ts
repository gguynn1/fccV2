import { createRequire } from "node:module";

import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { entitySchema, Permission } from "../01-service-stack/02-identity-service/types.js";
import {
  type BullQueueService,
  type PendingQueueReconciliationResult,
} from "../01-service-stack/04-queue/index.js";
import type { PendingQueueItem } from "../01-service-stack/04-queue/types.js";
import { CollisionPrecedence } from "../01-service-stack/06-action-router/types.js";
import { type SqliteStateService } from "../02-supporting-services/03-state-service/index.js";
import { ThreadType } from "../02-supporting-services/05-routing-service/types.js";
import { applyRuntimeSystemConfig, runtimeSystemConfig } from "../config/runtime-system-config.js";
import { EntityType, QueueItemSource } from "../types.js";
import {
  AdminConfigInvariantError,
  hardenConfigEdit,
  reconcilePendingQueueItemForConfig,
  type ConfigEditSource,
  type ConfigReconciliationReport,
} from "./config-hardening.js";
import type {
  EmulationStore,
  EmulationMessage as StoredEmulationMessage,
} from "./emulation-store.js";
import {
  generateScenarioSet,
  getActiveEvalRunId,
  getEvalRun,
  getEvalRunMarkdown,
  getEvalScenarioSets,
  listEvalRuns,
  refreshEvalScenarioSets,
  startEvalRun,
} from "./eval-runs.js";

const require = createRequire(import.meta.url);
const { version: APP_VERSION } = require("../../package.json") as { version: string };

const threadSchema = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(ThreadType),
  participants: z.array(z.string().min(1)).min(1),
  description: z.string().min(1),
  conversation_sid: z.string().min(1).optional(),
});

const digestScheduleBlockSchema = z.object({
  times: z.record(z.string(), z.union([z.string(), z.null()])),
});

const digestEligibilitySchema = z.object({
  exclude_already_dispatched: z.boolean(),
  exclude_stale: z.boolean(),
  staleness_threshold_hours: z.number(),
  suppress_repeats_from_previous_digest: z.boolean(),
  include_unresolved_from_yesterday: z.boolean(),
});

const dailyRhythmSchema = z.object({
  morning_digest: digestScheduleBlockSchema,
  evening_checkin: digestScheduleBlockSchema,
  default_state: z.string().min(1),
  digest_eligibility: digestEligibilitySchema,
});

const outboundBudgetSchema = z.object({
  max_unprompted_per_person_per_day: z.number().int().positive(),
  max_messages_per_thread_per_hour: z.number().int().positive(),
  batch_window_minutes: z.number().int().nonnegative(),
  quiet_hours: z
    .object({
      start: z.string().min(1),
      end: z.string().min(1),
    })
    .optional(),
  description: z.string().min(1),
});

const collisionPolicySchema = z.object({
  description: z.string().min(1),
  precedence_order: z.array(z.nativeEnum(CollisionPrecedence)),
  same_precedence_strategy: z.string().min(1),
});

const entitiesPayloadSchema = z.object({
  entities: z.array(entitySchema),
});

const configPayloadSchema = z.object({
  system: z.object({
    timezone: z.string().min(1),
    locale: z.string().min(1),
    is_onboarded: z.boolean(),
  }),
  threads: z.array(threadSchema),
});

const budgetPayloadSchema = z.object({
  dispatch: z.object({
    outbound_budget: outboundBudgetSchema,
    collision_avoidance: collisionPolicySchema,
  }),
});

const schedulerPayloadSchema = z.object({
  daily_rhythm: dailyRhythmSchema,
});

const topicBehaviorSchema = z.record(z.string(), z.string());

const topicConfigSchema = z.object({
  label: z.string().min(1),
  description: z.string(),
  routing: z.record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string())])),
  behavior: topicBehaviorSchema,
  escalation: z.string(),
  proactive: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  escalation_ladder: z.record(z.string(), z.union([z.string(), z.boolean(), z.null()])).optional(),
  confirmation_required: z.boolean().optional(),
  sections: z.array(z.string()).optional(),
  cross_topic_connections: z.array(z.string()).optional(),
  confirmation_required_for_sends: z.boolean().optional(),
  follow_up_quiet_period_days: z.number().optional(),
  on_ignored: z.string().optional(),
  minimum_gap_between_nudges: z.string().optional(),
  status_expiry: z.string().optional(),
  grocery_linking: z.boolean().optional(),
});

const escalationProfileSchema = z.object({
  label: z.string().min(1),
  applies_to: z.array(z.string()),
  steps: z.array(z.string()),
  on_reassignment: z.string(),
});

const confirmationGatesSchema = z.object({
  always_require_approval: z.array(z.string()),
  expiry_minutes: z.number().min(1),
  on_expiry: z.string(),
});

const topicsPayloadSchema = z.object({
  topics: z.record(z.string(), topicConfigSchema),
  escalation_profiles: z.record(z.string(), escalationProfileSchema),
  confirmation_gates: confirmationGatesSchema,
});

const evalStartPayloadSchema = z.object({
  scenario_set: z.string().min(1).optional(),
});

const emulationSendSchema = z.object({
  entity_id: z.string().min(1),
  thread_id: z.string().min(1),
  content: z.string().min(1),
  source_type: z.enum(["text", "reaction", "image"]).optional().default("text"),
});

const emulationMessagesQuerySchema = z.object({
  thread_id: z.string().min(1).optional(),
  since: z.string().optional(),
});

const domainStateMutationSchema = z.object({
  category: z.string().min(1),
  collection: z.string().min(1).optional(),
  row_id: z.string().min(1).optional(),
  row_key: z.string().min(1).optional(),
});

export interface AdminRoutesOptions {
  queue_service: BullQueueService;
  state_service: SqliteStateService;
  caldav_port: number;
  messaging_identity: string;
  emulation_store: EmulationStore;
}

function requestArrivedViaTunnel(request: FastifyRequest): boolean {
  return (
    request.headers["x-forwarded-for"] !== undefined ||
    request.headers["x-forwarded-host"] !== undefined
  );
}

async function rejectTunnelAccess(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!requestArrivedViaTunnel(request)) {
    return;
  }

  await reply.code(403).send({
    error: "forbidden",
    message: "Admin UI is available on the local network only.",
  });
}

function toPendingQueueMetadata(item: PendingQueueItem) {
  return {
    id: item.id,
    source: item.source,
    type: item.type,
    topic: item.topic ?? null,
    intent: item.intent ?? null,
    concerning: item.concerning,
    target_thread: item.target_thread,
    created_at: item.created_at,
    hold_until: item.hold_until ?? null,
    status: item.status ?? null,
    content_kind: typeof item.content === "string" ? "text" : "structured",
  };
}

function toDispatchMetadata(
  item: Awaited<
    ReturnType<SqliteStateService["getSystemState"]>
  >["queue"]["recently_dispatched"][number],
) {
  // Dispatch history stores target thread reliably; derive the visible audience
  // from the current thread map so UI filters can line up with the routing model.
  const concerning =
    runtimeSystemConfig.threads.find((thread) => thread.id === item.target_thread)?.participants ??
    [];
  return {
    id: item.id,
    topic: item.topic,
    target_thread: item.target_thread,
    concerning,
    dispatched_at: item.dispatched_at,
    priority: item.priority,
    included_in: item.included_in ?? null,
    response_received: item.response_received ?? null,
    escalation_step: item.escalation_step ?? null,
  };
}

function toRelationshipStateMetadata(
  relationship: Awaited<ReturnType<SqliteStateService["getSystemState"]>>["relationship"],
) {
  return {
    last_nudge: {
      date: relationship.last_nudge.date,
      thread: relationship.last_nudge.thread,
      content_recorded: Boolean(relationship.last_nudge.content),
      response_received: relationship.last_nudge.response_received,
    },
    next_nudge_eligible: relationship.next_nudge_eligible,
    nudge_history: relationship.nudge_history.map((entry) => {
      const { content, ...rest } = entry;
      return {
        ...rest,
        content_recorded: Boolean(content),
      };
    }),
  };
}

function toThreadStateMetadata(
  threads: Awaited<ReturnType<SqliteStateService["getSystemState"]>>["threads"],
) {
  return Object.fromEntries(
    Object.entries(threads).map(([threadId, history]) => [
      threadId,
      {
        active_topic_context: history.active_topic_context,
        last_activity: history.last_activity,
        recent_messages: history.recent_messages.map((message) => ({
          id: message.id,
          from: message.from,
          at: message.at,
          topic_context: message.topic_context,
        })),
      },
    ]),
  );
}

function toEmulationMessageMetadata(message: StoredEmulationMessage) {
  return {
    id: message.id,
    thread_id: message.thread_id,
    sender: message.sender,
    content: message.content,
    direction: message.direction,
    source_type: message.source_type,
    created_at: message.created_at,
    preview_label:
      message.source_type === "reaction"
        ? "Reaction recorded"
        : message.source_type === "image"
          ? "Image recorded"
          : "Text message recorded",
  };
}

const DOMAIN_CATEGORY_COLLECTIONS: Record<string, string[]> = {
  calendar: ["events"],
  chores: ["active", "completed_recent"],
  finances: ["bills", "expenses_recent", "savings_goals"],
  grocery: ["list", "recently_purchased"],
  health: ["profiles"],
  pets: ["profiles"],
  school: ["students", "communications"],
  travel: ["trips"],
  vendors: ["records"],
  business: ["profiles", "leads"],
  relationship: ["nudge_history"],
  family_status: ["current"],
  meals: ["planned", "dietary_notes"],
  maintenance: ["assets", "items"],
  digests: ["history"],
};

function clearDomainCategoryRecords(
  state: Awaited<ReturnType<SqliteStateService["getSystemState"]>>,
  category: string,
): number {
  if (category === "threads") {
    const count = Object.keys(state.threads).length;
    state.threads = {};
    return count;
  }

  const collections = DOMAIN_CATEGORY_COLLECTIONS[category];
  if (!collections) {
    throw new Error(`Unsupported state category: ${category}`);
  }
  const target = state[category as keyof typeof state] as Record<string, unknown>;
  if (!target || typeof target !== "object") {
    throw new Error(`State category is not mutable: ${category}`);
  }

  let cleared = 0;
  for (const collection of collections) {
    const value = target[collection];
    if (Array.isArray(value)) {
      cleared += value.length;
      target[collection] = [];
    }
  }
  return cleared;
}

function clearDomainCollectionRecords(
  state: Awaited<ReturnType<SqliteStateService["getSystemState"]>>,
  category: string,
  collection: string,
): number {
  if (category === "threads") {
    if (collection !== "entries") {
      throw new Error(`Unsupported threads collection: ${collection}`);
    }
    const count = Object.keys(state.threads).length;
    state.threads = {};
    return count;
  }

  const allowedCollections = DOMAIN_CATEGORY_COLLECTIONS[category];
  if (!allowedCollections || !allowedCollections.includes(collection)) {
    throw new Error(`Unsupported state collection: ${category}.${collection}`);
  }

  const target = state[category as keyof typeof state] as Record<string, unknown>;
  const value = target?.[collection];
  if (!Array.isArray(value)) {
    throw new Error(`State collection is not a list: ${category}.${collection}`);
  }
  const count = value.length;
  target[collection] = [];
  return count;
}

function clearDomainRowRecord(
  state: Awaited<ReturnType<SqliteStateService["getSystemState"]>>,
  category: string,
  collection: string,
  rowId: string,
  rowKey: string,
): number {
  if (category === "threads") {
    if (!(rowId in state.threads)) {
      return 0;
    }
    delete state.threads[rowId];
    return 1;
  }

  const allowedCollections = DOMAIN_CATEGORY_COLLECTIONS[category];
  if (!allowedCollections || !allowedCollections.includes(collection)) {
    throw new Error(`Unsupported state collection: ${category}.${collection}`);
  }
  const target = state[category as keyof typeof state] as Record<string, unknown>;
  const value = target?.[collection];
  if (!Array.isArray(value)) {
    throw new Error(`State collection is not a list: ${category}.${collection}`);
  }
  const before = value.length;
  const toComparableRowValue = (rowValue: unknown): string => {
    if (typeof rowValue === "string") {
      return rowValue;
    }
    if (typeof rowValue === "number" || typeof rowValue === "bigint") {
      return rowValue.toString();
    }
    return "";
  };
  target[collection] = value.filter((entry) => {
    if (!entry || typeof entry !== "object") {
      return true;
    }
    const record = entry as Record<string, unknown>;
    return toComparableRowValue(record[rowKey]) !== rowId;
  });
  const after = Array.isArray(target[collection])
    ? (target[collection] as unknown[]).length
    : before;
  return Math.max(0, before - after);
}

interface AppliedAdminConfigChange {
  config: Awaited<ReturnType<SqliteStateService["getSystemConfig"]>>;
  reconciliation: ConfigReconciliationReport;
  queue_reconciliation: PendingQueueReconciliationResult;
}

function applyAdminStateAtomically(
  stateService: SqliteStateService,
  nextState: Awaited<ReturnType<SqliteStateService["getSystemState"]>>,
  nextConfig: Awaited<ReturnType<SqliteStateService["getSystemConfig"]>>,
  validThreadIds: string[],
): void {
  stateService.applyAdminConfigAtomically(nextState, nextConfig, validThreadIds);
}

async function applyAdminConfigChange(
  queueService: BullQueueService,
  stateService: SqliteStateService,
  source: ConfigEditSource,
  mutate: (nextConfig: Awaited<ReturnType<SqliteStateService["getSystemConfig"]>>) => void,
): Promise<AppliedAdminConfigChange> {
  const currentConfig = await stateService.getSystemConfig();
  const currentState = await stateService.getSystemState();
  const nextConfig = structuredClone(currentConfig);
  mutate(nextConfig);

  const hardened = hardenConfigEdit({
    current_config: currentConfig,
    next_config: nextConfig,
    current_state: currentState,
    source,
  });
  const queueReconciliation = await queueService.reconcilePendingItems((item) =>
    reconcilePendingQueueItemForConfig(item, hardened.config),
  );

  const validThreadIds = hardened.config.threads.map((thread) => thread.id);
  applyAdminStateAtomically(stateService, hardened.state, hardened.config, validThreadIds);
  applyRuntimeSystemConfig(hardened.config);

  return {
    config: hardened.config,
    reconciliation: hardened.report,
    queue_reconciliation: queueReconciliation,
  };
}

export const adminRoutes: FastifyPluginCallback<AdminRoutesOptions> = (fastify, options, done) => {
  fastify.addHook("onRequest", rejectTunnelAccess);
  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof AdminConfigInvariantError) {
      void reply.code(400).send({
        error: "invalid_admin_config",
        message: error.message,
      });
      return;
    }
    if (error instanceof z.ZodError) {
      void reply.code(400).send({
        error: "invalid_payload",
        message: error.issues[0]?.message ?? "Request payload was invalid.",
      });
      return;
    }
    void reply.send(error);
  });

  fastify.get("/system", () => {
    return {
      version: APP_VERSION,
      messaging_identity: options.messaging_identity,
      entity_types: Object.values(EntityType),
      permissions: Object.values(Permission),
      caldav: {
        port: options.caldav_port,
        path: "/caldav",
        local_only: true,
      },
    };
  });

  fastify.get("/config", async () => {
    const config = await options.state_service.getSystemConfig();
    return {
      system: config.system,
      threads: config.threads,
    };
  });

  fastify.put("/config", async (request) => {
    const payload = configPayloadSchema.parse(request.body);
    const result = await applyAdminConfigChange(
      options.queue_service,
      options.state_service,
      "config",
      (nextConfig) => {
        nextConfig.system = payload.system;
        nextConfig.threads = payload.threads;
      },
    );
    return {
      ok: true,
      config: {
        system: result.config.system,
        threads: result.config.threads,
      },
      reconciliation: result.reconciliation,
      queue_reconciliation: result.queue_reconciliation,
    };
  });

  fastify.get("/entities", async () => {
    const config = await options.state_service.getSystemConfig();
    return {
      entities: config.entities,
      threads: config.threads,
      daily_rhythm: config.daily_rhythm,
    };
  });

  fastify.put("/entities", async (request) => {
    const payload = entitiesPayloadSchema.parse(request.body);
    const result = await applyAdminConfigChange(
      options.queue_service,
      options.state_service,
      "entities",
      (nextConfig) => {
        nextConfig.entities = payload.entities;
      },
    );
    return {
      ok: true,
      entities: result.config.entities,
      threads: result.config.threads,
      daily_rhythm: result.config.daily_rhythm,
      reconciliation: result.reconciliation,
      queue_reconciliation: result.queue_reconciliation,
    };
  });

  fastify.get("/topics", async () => {
    const config = await options.state_service.getSystemConfig();
    return {
      topics: config.topics,
      escalation_profiles: config.escalation_profiles,
      confirmation_gates: config.confirmation_gates,
    };
  });

  fastify.put("/topics", async (request) => {
    const payload = topicsPayloadSchema.parse(request.body);
    const result = await applyAdminConfigChange(
      options.queue_service,
      options.state_service,
      "topics",
      (nextConfig) => {
        nextConfig.topics = payload.topics as unknown as typeof nextConfig.topics;
        nextConfig.escalation_profiles =
          payload.escalation_profiles as unknown as typeof nextConfig.escalation_profiles;
        nextConfig.confirmation_gates =
          payload.confirmation_gates as unknown as typeof nextConfig.confirmation_gates;
      },
    );
    return {
      ok: true,
      topics: result.config.topics,
      escalation_profiles: result.config.escalation_profiles,
      confirmation_gates: result.config.confirmation_gates,
      reconciliation: result.reconciliation,
      queue_reconciliation: result.queue_reconciliation,
    };
  });

  fastify.get("/budget", async () => {
    const config = await options.state_service.getSystemConfig();
    return {
      dispatch: {
        outbound_budget: config.dispatch.outbound_budget,
        collision_avoidance: config.dispatch.collision_avoidance,
      },
    };
  });

  fastify.put("/budget", async (request) => {
    const payload = budgetPayloadSchema.parse(request.body);
    const result = await applyAdminConfigChange(
      options.queue_service,
      options.state_service,
      "budget",
      (nextConfig) => {
        nextConfig.dispatch.outbound_budget = payload.dispatch.outbound_budget;
        nextConfig.dispatch.collision_avoidance = payload.dispatch.collision_avoidance;
      },
    );
    return {
      ok: true,
      dispatch: {
        outbound_budget: result.config.dispatch.outbound_budget,
        collision_avoidance: result.config.dispatch.collision_avoidance,
      },
      reconciliation: result.reconciliation,
      queue_reconciliation: result.queue_reconciliation,
    };
  });

  fastify.get("/scheduler", async () => {
    const config = await options.state_service.getSystemConfig();
    return {
      daily_rhythm: config.daily_rhythm,
    };
  });

  fastify.put("/scheduler", async (request) => {
    const payload = schedulerPayloadSchema.parse(request.body);
    const result = await applyAdminConfigChange(
      options.queue_service,
      options.state_service,
      "scheduler",
      (nextConfig) => {
        nextConfig.daily_rhythm = payload.daily_rhythm;
      },
    );
    return {
      ok: true,
      daily_rhythm: result.config.daily_rhythm,
      reconciliation: result.reconciliation,
      queue_reconciliation: result.queue_reconciliation,
    };
  });

  fastify.get("/state/queue", async () => {
    const [queueDepth, pendingItems, deadLetterItems, systemState] = await Promise.all([
      options.queue_service.getQueueDepthSnapshot(),
      options.queue_service.listPendingItems(),
      options.queue_service.listDeadLetterItems(),
      options.state_service.getSystemState(),
    ]);

    return {
      depth: queueDepth,
      pending_items: pendingItems.map(toPendingQueueMetadata),
      dead_letter_items: deadLetterItems.map((entry) => ({
        dead_letter_job_id: entry.dead_letter_job_id,
        failed_at: entry.failed_at,
        item: toPendingQueueMetadata(entry.item),
      })),
      recent_completions: systemState.queue.recently_dispatched.map(toDispatchMetadata),
    };
  });

  fastify.get("/state/escalations", async () => {
    const systemState = await options.state_service.getSystemState();
    return {
      active: systemState.escalation_status.active,
    };
  });

  fastify.get("/state/confirmations", async () => {
    const systemState = await options.state_service.getSystemState();
    return {
      pending: systemState.confirmations.pending,
      recent: systemState.confirmations.recent,
    };
  });

  fastify.get("/state/dispatches", async () => {
    const systemState = await options.state_service.getSystemState();
    return {
      recent: systemState.queue.recently_dispatched.map(toDispatchMetadata),
    };
  });

  fastify.get("/state/budget-usage", async () => {
    const systemState = await options.state_service.getSystemState();
    return {
      outbound_budget_tracker: systemState.outbound_budget_tracker,
    };
  });

  fastify.get("/state/domain", async () => {
    const systemState = await options.state_service.getSystemState();
    const domainState = {
      outbound_budget_tracker: systemState.outbound_budget_tracker,
      calendar: systemState.calendar,
      chores: systemState.chores,
      finances: systemState.finances,
      grocery: systemState.grocery,
      health: systemState.health,
      pets: systemState.pets,
      school: systemState.school,
      travel: systemState.travel,
      vendors: systemState.vendors,
      business: systemState.business,
      relationship: toRelationshipStateMetadata(systemState.relationship),
      family_status: systemState.family_status,
      meals: systemState.meals,
      maintenance: systemState.maintenance,
      data_ingest_state: systemState.data_ingest_state,
      digests: systemState.digests,
      threads: toThreadStateMetadata(systemState.threads),
    };
    return domainState;
  });

  fastify.post("/state/domain/mutate", async (request, reply) => {
    const payload = domainStateMutationSchema.parse(request.body);
    const state = await options.state_service.getSystemState();

    try {
      let cleared = 0;
      if (payload.row_id) {
        if (!payload.collection) {
          return reply.code(400).send({
            error: "invalid_state_mutation",
            message: "collection is required when clearing a single row.",
          });
        }
        cleared = clearDomainRowRecord(
          state,
          payload.category,
          payload.collection,
          payload.row_id,
          payload.row_key ?? "id",
        );
      } else if (payload.collection) {
        cleared = clearDomainCollectionRecords(state, payload.category, payload.collection);
      } else {
        cleared = clearDomainCategoryRecords(state, payload.category);
      }

      await options.state_service.saveSystemState(state);
      return { ok: true, cleared };
    } catch (error: unknown) {
      return reply.code(400).send({
        error: "invalid_state_mutation",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  fastify.post("/state/queue/dlq/:id/retry", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const item = await options.queue_service.retryDeadLetterItem(params.id);
    return {
      ok: true,
      retried: toPendingQueueMetadata(item),
    };
  });

  fastify.post("/state/queue/dlq/:id/discard", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const item = await options.queue_service.discardDeadLetterItem(params.id);
    return {
      ok: true,
      discarded: toPendingQueueMetadata(item),
    };
  });

  fastify.get("/eval", async () => {
    const [runs] = await Promise.all([listEvalRuns(), refreshEvalScenarioSets()]);

    return {
      scenario_sets: getEvalScenarioSets(),
      active_run_id: getActiveEvalRunId(),
      runs,
    };
  });

  fastify.post("/eval/scenario-sets/generate", async (request, reply) => {
    evalStartPayloadSchema.parse(request.body ?? {});

    try {
      const result = await generateScenarioSet();
      return {
        ok: true,
        ...result,
      };
    } catch (error: unknown) {
      return reply.code(500).send({
        error: "eval_scenario_set_generation_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  fastify.post("/eval/runs", async (request, reply) => {
    const payload = evalStartPayloadSchema.parse(request.body ?? {});

    try {
      const result = await startEvalRun(payload.scenario_set ?? "default");
      return {
        ok: true,
        ...result,
      };
    } catch (error: unknown) {
      return reply.code(409).send({
        error: "eval_run_conflict",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  fastify.get("/eval/runs/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const run = await getEvalRun(params.id);

    if (!run) {
      return reply.code(404).send({
        error: "eval_run_not_found",
        message: "Eval run not found.",
      });
    }

    return {
      run,
      active_run_id: getActiveEvalRunId(),
    };
  });

  fastify.get("/eval/runs/:id/markdown", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const artifact = await getEvalRunMarkdown(params.id);

    if (!artifact) {
      return reply.code(404).send({
        error: "eval_markdown_not_found",
        message: "Eval markdown artifact not found.",
      });
    }

    return artifact;
  });

  // ── Emulation ──

  fastify.get("/emulation/session", () => {
    return { active: options.emulation_store.active };
  });

  fastify.post("/emulation/session/start", () => {
    options.emulation_store.active = true;
    return { ok: true };
  });

  fastify.post("/emulation/session/stop", () => {
    options.emulation_store.active = false;
    return { ok: true };
  });

  fastify.post("/emulation/send", async (request) => {
    const payload = emulationSendSchema.parse(request.body);

    const sourceMap: Record<string, QueueItemSource> = {
      text: QueueItemSource.HumanMessage,
      reaction: QueueItemSource.Reaction,
      image: QueueItemSource.ImageAttachment,
    };

    const message = options.emulation_store.recordInbound(
      payload.entity_id,
      payload.thread_id,
      payload.content,
      payload.source_type,
    );

    await options.queue_service.enqueue(
      {
        source: sourceMap[payload.source_type] ?? QueueItemSource.HumanMessage,
        content: payload.content,
        concerning: [payload.entity_id],
        target_thread: payload.thread_id,
        created_at: new Date(),
        idempotency_key: `emulation:${message.id}`,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
      },
    );

    return { ok: true, message_id: message.id };
  });

  fastify.get("/emulation/messages", (request) => {
    const query = emulationMessagesQuerySchema.parse(request.query);

    if (query.thread_id) {
      const messages = options.emulation_store.getMessages(query.thread_id, query.since);
      const sanitizedMessages = messages.map(toEmulationMessageMetadata);
      return {
        messages: sanitizedMessages,
      };
    }

    const messages = options.emulation_store.getAllMessages();
    const sanitizedMessages = messages.map(toEmulationMessageMetadata);
    return {
      messages: sanitizedMessages,
    };
  });

  fastify.delete("/emulation/messages", () => {
    options.emulation_store.clearAll();
    return { ok: true };
  });

  done();
};
