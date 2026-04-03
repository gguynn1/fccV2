import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { type BullQueueService } from "../01-service-stack/04-queue/index.js";
import type { PendingQueueItem } from "../01-service-stack/04-queue/types.js";
import { EntityType, Permission } from "../01-service-stack/02-identity-service/types.js";
import { type SqliteStateService } from "../02-supporting-services/03-state-service/index.js";
import { ConfirmationActionType } from "../02-supporting-services/08-confirmation-service/types.js";
import { ThreadType } from "../02-supporting-services/05-routing-service/types.js";
import { applyRuntimeSystemConfig } from "../config/runtime-system-config.js";

const threadSchema = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(ThreadType),
  participants: z.array(z.string().min(1)).min(1),
  description: z.string().min(1),
});

const entitiesPayloadSchema = z.object({
  entities: z.array(
    z
      .object({
        id: z.string().min(1),
        type: z.nativeEnum(EntityType),
        name: z.string().min(1),
        messaging_identity: z.string().nullable(),
        permissions: z.array(z.nativeEnum(Permission)),
      })
      .passthrough(),
  ),
});

const configPayloadSchema = z.object({
  system: z
    .object({
      timezone: z.string().min(1),
      locale: z.string().min(1),
      version: z.string().min(1),
    })
    .passthrough(),
  assistant: z.object({
    messaging_identity: z.string().min(1),
    name: z.string().nullable(),
    description: z.string().min(1),
  }),
  threads: z.array(threadSchema),
  daily_rhythm: z.record(z.string(), z.unknown()),
});

const topicsPayloadSchema = z.object({
  topics: z.record(z.string(), z.unknown()),
  escalation_profiles: z.record(z.string(), z.unknown()),
  confirmation_gates: z.object({
    always_require_approval: z.array(z.nativeEnum(ConfirmationActionType)),
    expiry_minutes: z.number().int().positive(),
    on_expiry: z.string().min(1),
  }),
});

const budgetPayloadSchema = z.object({
  dispatch: z.object({
    outbound_budget: z.record(z.string(), z.unknown()),
    collision_avoidance: z.record(z.string(), z.unknown()),
  }),
});

const schedulerPayloadSchema = z.object({
  daily_rhythm: z.record(z.string(), z.unknown()),
});

export interface AdminRoutesOptions {
  queue_service: BullQueueService;
  state_service: SqliteStateService;
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

  fastify.get("/config", async () => {
    const config = await options.state_service.getSystemConfig();
    return {
      system: config.system,
      assistant: config.assistant,
      threads: config.threads,
      daily_rhythm: config.daily_rhythm,
    };
  });

  fastify.put("/config", async (request) => {
    const payload = configPayloadSchema.parse(request.body);
    const nextConfig = structuredClone(await options.state_service.getSystemConfig());
    nextConfig.system = payload.system;
    nextConfig.assistant = payload.assistant;
    nextConfig.threads = payload.threads as typeof nextConfig.threads;
    nextConfig.daily_rhythm = payload.daily_rhythm as unknown as typeof nextConfig.daily_rhythm;
    await saveConfig(options.state_service, nextConfig);
    return {
      ok: true,
      config: {
        system: nextConfig.system,
        assistant: nextConfig.assistant,
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
    nextConfig.entities = payload.entities as typeof nextConfig.entities;
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
    nextConfig.topics = payload.topics as typeof nextConfig.topics;
    nextConfig.escalation_profiles =
      payload.escalation_profiles as typeof nextConfig.escalation_profiles;
    nextConfig.confirmation_gates =
      payload.confirmation_gates as typeof nextConfig.confirmation_gates;
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
    nextConfig.dispatch.outbound_budget = payload.dispatch
      .outbound_budget as unknown as typeof nextConfig.dispatch.outbound_budget;
    nextConfig.dispatch.collision_avoidance = payload.dispatch
      .collision_avoidance as unknown as typeof nextConfig.dispatch.collision_avoidance;
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
    nextConfig.daily_rhythm = payload.daily_rhythm as unknown as typeof nextConfig.daily_rhythm;
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

  done();
};
