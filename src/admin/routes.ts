import { createRequire } from "node:module";

import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { entitySchema, Permission } from "../01-service-stack/02-identity-service/types.js";
import { type BullQueueService } from "../01-service-stack/04-queue/index.js";
import type { PendingQueueItem } from "../01-service-stack/04-queue/types.js";
import { CollisionPrecedence } from "../01-service-stack/06-action-router/types.js";
import { type SqliteStateService } from "../02-supporting-services/03-state-service/index.js";
import { ThreadType } from "../02-supporting-services/05-routing-service/types.js";
import { EscalationReassignmentPolicy } from "../02-supporting-services/07-escalation-service/types.js";
import { ConfirmationActionType } from "../02-supporting-services/08-confirmation-service/types.js";
import { applyRuntimeSystemConfig } from "../config/runtime-system-config.js";
import {
  EntityType,
  EscalationLevel,
  GrocerySection,
  QueueItemSource,
  TopicKey,
} from "../types.js";
import type { EmulationStore } from "./emulation-store.js";
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
});

const topicConfigSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  routing: z.record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string())])),
  behavior: z.record(z.string(), z.string()),
  escalation: z.nativeEnum(EscalationLevel),
  proactive: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  escalation_ladder: z.record(z.string(), z.union([z.string(), z.boolean(), z.null()])).optional(),
  confirmation_required: z.boolean().optional(),
  sections: z.array(z.nativeEnum(GrocerySection)).optional(),
  cross_topic_connections: z.array(z.nativeEnum(TopicKey)).optional(),
  confirmation_required_for_sends: z.boolean().optional(),
  follow_up_quiet_period_days: z.number().optional(),
  on_ignored: z.string().optional(),
  minimum_gap_between_nudges: z.string().optional(),
  status_expiry: z.string().optional(),
  grocery_linking: z.boolean().optional(),
});

const escalationProfileSchema = z.object({
  label: z.string().min(1),
  applies_to: z.array(z.nativeEnum(TopicKey)),
  steps: z.array(z.string()),
  on_reassignment: z.nativeEnum(EscalationReassignmentPolicy),
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
  daily_rhythm: dailyRhythmSchema,
});

const topicsPayloadSchema = z.object({
  topics: z.record(z.string(), topicConfigSchema),
  escalation_profiles: z.record(z.string(), escalationProfileSchema),
  confirmation_gates: z.object({
    always_require_approval: z.array(z.nativeEnum(ConfirmationActionType)),
    expiry_minutes: z.number().int().positive(),
    on_expiry: z.string().min(1),
  }),
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
  return {
    id: item.id,
    topic: item.topic,
    target_thread: item.target_thread,
    dispatched_at: item.dispatched_at,
    priority: item.priority,
    included_in: item.included_in ?? null,
    response_received: item.response_received ?? null,
    escalation_step: item.escalation_step ?? null,
  };
}

async function saveConfig(
  stateService: SqliteStateService,
  nextConfig: Awaited<ReturnType<SqliteStateService["getSystemConfig"]>>,
): Promise<void> {
  applyRuntimeSystemConfig(nextConfig);
  await stateService.saveSystemConfig(nextConfig);
}

export const adminRoutes: FastifyPluginCallback<AdminRoutesOptions> = (fastify, options, done) => {
  fastify.addHook("onRequest", rejectTunnelAccess);

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
      daily_rhythm: config.daily_rhythm,
    };
  });

  fastify.put("/config", async (request) => {
    const payload = configPayloadSchema.parse(request.body);
    const nextConfig = structuredClone(await options.state_service.getSystemConfig());
    nextConfig.system = payload.system;
    nextConfig.threads = payload.threads;
    nextConfig.daily_rhythm = payload.daily_rhythm;
    await saveConfig(options.state_service, nextConfig);
    return {
      ok: true,
      config: {
        system: nextConfig.system,
        threads: nextConfig.threads,
        daily_rhythm: nextConfig.daily_rhythm,
      },
    };
  });

  fastify.get("/entities", async () => {
    const config = await options.state_service.getSystemConfig();
    return {
      entities: config.entities,
      threads: config.threads,
    };
  });

  fastify.put("/entities", async (request) => {
    const payload = entitiesPayloadSchema.parse(request.body);
    const nextConfig = structuredClone(await options.state_service.getSystemConfig());
    nextConfig.entities = payload.entities;
    await saveConfig(options.state_service, nextConfig);
    return {
      ok: true,
      entities: nextConfig.entities,
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
    const nextConfig = structuredClone(await options.state_service.getSystemConfig());
    nextConfig.topics = payload.topics as unknown as typeof nextConfig.topics;
    nextConfig.escalation_profiles =
      payload.escalation_profiles as typeof nextConfig.escalation_profiles;
    nextConfig.confirmation_gates = payload.confirmation_gates;
    await saveConfig(options.state_service, nextConfig);
    return {
      ok: true,
      topics: nextConfig.topics,
      escalation_profiles: nextConfig.escalation_profiles,
      confirmation_gates: nextConfig.confirmation_gates,
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
    const nextConfig = structuredClone(await options.state_service.getSystemConfig());
    nextConfig.dispatch.outbound_budget = payload.dispatch.outbound_budget;
    nextConfig.dispatch.collision_avoidance = payload.dispatch.collision_avoidance;
    await saveConfig(options.state_service, nextConfig);
    return {
      ok: true,
      dispatch: {
        outbound_budget: nextConfig.dispatch.outbound_budget,
        collision_avoidance: nextConfig.dispatch.collision_avoidance,
      },
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
    const nextConfig = structuredClone(await options.state_service.getSystemConfig());
    nextConfig.daily_rhythm = payload.daily_rhythm;
    await saveConfig(options.state_service, nextConfig);
    return {
      ok: true,
      daily_rhythm: nextConfig.daily_rhythm,
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
      return {
        messages: options.emulation_store.getMessages(query.thread_id, query.since),
      };
    }

    return {
      messages: options.emulation_store.getAllMessages(),
    };
  });

  fastify.delete("/emulation/messages", () => {
    options.emulation_store.clearAll();
    return { ok: true };
  });

  done();
};
