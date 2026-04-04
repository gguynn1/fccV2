import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseQueryString } from "node:querystring";

import fastifyStaticPlugin from "@fastify/static";
import type BetterSqlite3 from "better-sqlite3";
import { Queue, type Worker } from "bullmq";
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import type { ImapFlow } from "imapflow";
import { pino } from "pino";

import { createCalDavService } from "./01-service-stack/01-transport-layer/01.1-caldav/index.js";
import { createTwilioTransportLayer } from "./01-service-stack/01-transport-layer/index.js";
import { createClassifierService } from "./01-service-stack/03-classifier-service/index.js";
import { BullQueueService } from "./01-service-stack/04-queue/index.js";
import { createWorker, createWorkerIdentityService } from "./01-service-stack/05-worker/index.js";
import type {
  TransportOutboundEnvelope,
  TransportServiceContract,
} from "./01-service-stack/types.js";
import { createDataIngestService } from "./02-supporting-services/02-data-ingest-service/index.js";
import {
  createStateService,
  type SqliteStateService,
} from "./02-supporting-services/03-state-service/index.js";
import { createTopicProfileService } from "./02-supporting-services/04-topic-profile-service/index.js";
import { createRoutingService } from "./02-supporting-services/05-routing-service/index.js";
import {
  createBudgetService,
  type RedisBudgetService,
} from "./02-supporting-services/06-budget-service/index.js";
import {
  createEscalationService,
  type XStateEscalationService,
} from "./02-supporting-services/07-escalation-service/index.js";
import {
  createConfirmationService,
  type BullConfirmationService,
} from "./02-supporting-services/08-confirmation-service/index.js";
import { createSchedulerService } from "./02-supporting-services/index.js";
import { EmulationStore } from "./admin/emulation-store.js";
import { adminRoutes } from "./admin/routes.js";
import { initializeDatabase } from "./bootstrap.js";
import { applyRuntimeSystemConfig, runtimeSystemConfig } from "./config/runtime-system-config.js";
import { loadEnv } from "./env.js";
import { toRedisConnection } from "./lib/redis.js";

const logger = pino({ name: "fcc-server" });

interface SchedulerHandle {
  stop: () => Promise<void>;
}

interface RuntimeHandles {
  fastify: FastifyInstance;
  caldavServer: FastifyInstance;
  queue: Queue;
  queueService: BullQueueService;
  worker: Worker;
  scheduler: SchedulerHandle;
  imapClient: ImapFlow | null;
  stateService: SqliteStateService;
  budgetService: RedisBudgetService;
  escalationService: XStateEscalationService;
  confirmationService: BullConfirmationService;
  transportLayer: ReturnType<typeof createTwilioTransportLayer>;
  db: BetterSqlite3.Database;
}

async function verifyRedisAof(queue: Queue): Promise<void> {
  const client = await queue.client;
  const appendOnlyConfig = (await client.config("GET", "appendonly")) as string[];
  const appendOnlyValue = appendOnlyConfig[1]?.toLowerCase();

  // Queue durability depends on Redis AOF; fail fast if persistence is disabled.
  if (appendOnlyValue !== "yes") {
    throw new Error("Redis AOF is disabled. Set appendonly=yes before starting the app.");
  }
}

function createTransportContract(
  transportLayer: ReturnType<typeof createTwilioTransportLayer>,
  emulationStore: EmulationStore,
): TransportServiceContract {
  return {
    normalizeInbound(input) {
      return input;
    },
    async sendOutbound(output: TransportOutboundEnvelope): Promise<void> {
      if (emulationStore.active) {
        emulationStore.recordOutbound(output.target_thread, output.content, output.concerning);
        return;
      }

      await transportLayer.queueOutbound({
        id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        target_thread: output.target_thread,
        content: output.content,
        concerning: output.concerning,
        created_at: new Date(),
      });
    },
  };
}

async function runStaleCatchUp(
  queue: Queue,
  queueService: BullQueueService,
  stateService: SqliteStateService,
  escalationService: XStateEscalationService,
  confirmationService: BullConfirmationService,
  budgetService: RedisBudgetService,
  schedulerService: ReturnType<typeof createSchedulerService>,
): Promise<void> {
  // This runs before worker startup so old backlog state can be reconciled safely.
  logger.info("Startup catch-up: begin stale queue reconciliation.");
  const [waitingCount, delayedCount, activeCount] = await Promise.all([
    queue.getWaitingCount(),
    queue.getDelayedCount(),
    queue.getActiveCount(),
  ]);

  logger.info(
    { waitingCount, delayedCount, activeCount },
    "Startup catch-up: queue snapshot collected before worker start.",
  );
  const now = new Date();
  const [queueReconciliation, escalationRecovery, confirmationRecovery, schedulerRecovery] =
    await Promise.all([
      queueService.reconcileStartup(stateService),
      escalationService.reconcileOnStartup(now),
      confirmationService.reconcileOnStartup(now),
      schedulerService.recoverMissedWindowsDetailed(now),
    ]);
  await Promise.all([
    ...escalationRecovery.map((item) => queueService.enqueue(item)),
    ...confirmationRecovery.notifications.map((notification) =>
      queueService.enqueue(notification.queue_item),
    ),
    ...schedulerRecovery.produced.map((item) => queueService.enqueue(item)),
    budgetService.getBudgetTracker(),
  ]);
  logger.info(queueReconciliation, "Startup catch-up: queue reconciliation completed.");
  logger.info(
    { recovered_items: escalationRecovery.length },
    "Startup catch-up: escalation reconciliation completed.",
  );
  logger.info(
    { expired_confirmations: confirmationRecovery.expired.length },
    "Startup catch-up: confirmation expiry reconciliation completed.",
  );
  logger.info("Startup catch-up: budget counter reconstruction check completed.");
  logger.info(
    {
      recovered_items: schedulerRecovery.produced.length,
      skipped_stale_windows: schedulerRecovery.skipped_stale,
    },
    "Startup catch-up: scheduler reconciliation completed.",
  );
}

function requestArrivedViaTunnel(request: FastifyRequest): boolean {
  return (
    request.headers["x-forwarded-for"] !== undefined ||
    request.headers["x-forwarded-host"] !== undefined
  );
}

async function rejectTunnelAdminAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!requestArrivedViaTunnel(request)) {
    return;
  }

  await reply.code(403).send({
    error: "forbidden",
    message: "Admin UI is available on the local network only.",
  });
}

async function createRuntime(): Promise<RuntimeHandles> {
  const env = loadEnv(process.env as Record<string, string | undefined>);
  const db = initializeDatabase(env.DATABASE_PATH);
  const stateService = createStateService(env.DATABASE_PATH, logger);
  const persistedConfig = await stateService.getSystemConfig();
  applyRuntimeSystemConfig(persistedConfig);
  logger.info("SQLite initialized with WAL mode.");

  const redisConnection = toRedisConnection(env.REDIS_URL);
  const queue = new Queue("fcc-main", { connection: redisConnection });
  await verifyRedisAof(queue);
  const queueService = new BullQueueService({
    redis_url: env.REDIS_URL,
    logger,
  });
  await queueService.verifyConnection();
  logger.info("Redis connected and AOF verified.");

  const fastify = Fastify({ loggerInstance: logger as FastifyBaseLogger });
  fastify.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      const payload = typeof body === "string" ? body : body.toString("utf8");
      done(null, parseQueryString(payload));
    },
  );

  fastify.addHook("onRequest", async (request, reply) => {
    if (request.url === "/admin" || request.url.startsWith("/admin/")) {
      await rejectTunnelAdminAccess(request, reply);
    }
  });

  fastify.get("/health", () => ({ ok: true }));
  const caldavPort = Number(env.CALDAV_PORT || "3001");

  const emulationStore = new EmulationStore(db);

  await fastify.register(adminRoutes, {
    prefix: "/api/admin",
    queue_service: queueService,
    state_service: stateService,
    caldav_port: caldavPort,
    emulation_store: emulationStore,
  });

  const adminDistPath = resolve(process.cwd(), "ui/dist");
  if (existsSync(adminDistPath)) {
    await fastify.register(fastifyStaticPlugin, {
      root: adminDistPath,
      prefix: "/admin/",
    });
  }

  fastify.get("/admin", { preHandler: rejectTunnelAdminAccess }, async (_request, reply) => {
    if (!existsSync(adminDistPath)) {
      return reply.code(503).send({
        error: "admin_ui_unavailable",
        message: "Build the admin UI with `npm run ui:build` before serving /admin.",
      });
    }

    return reply.sendFile("index.html");
  });

  const transportLayer = createTwilioTransportLayer({
    account_sid: env.TWILIO_ACCOUNT_SID,
    auth_token: env.TWILIO_AUTH_TOKEN,
    messaging_identity: env.TWILIO_MESSAGING_IDENTITY,
    redis_url: env.REDIS_URL,
    public_base_url: env.PUBLIC_BASE_URL,
    logger,
  });
  transportLayer.registerRoutes(fastify, queueService);

  await fastify.listen({ port: Number(env.PORT || "3000"), host: "0.0.0.0" });
  logger.info({ port: env.PORT || "3000" }, "Fastify server started (Twilio webhooks via ngrok).");

  // CalDAV runs on a separate port, accessible only on the local network.
  // No ngrok tunnel — unauthenticated calendar data stays off the public internet.
  const caldavServer = Fastify({ loggerInstance: logger as FastifyBaseLogger });
  caldavServer.addHttpMethod("PROPFIND", { hasBody: true });
  caldavServer.addHttpMethod("REPORT", { hasBody: true });
  const calDavService = createCalDavService({ state_service: stateService });
  calDavService.registerRoutes(caldavServer);
  await caldavServer.listen({ port: caldavPort, host: "0.0.0.0" });
  logger.info({ port: caldavPort }, "CalDAV server started (local network only, no ngrok).");

  const classifierService = createClassifierService({
    anthropic_api_key: env.ANTHROPIC_API_KEY,
    state_service: stateService,
    context_window_limit: runtimeSystemConfig.worker.max_thread_history_messages ?? 15,
    logger,
  });
  const topicProfileService = createTopicProfileService({ logger });
  const routingService = createRoutingService({ logger });
  const budgetService = createBudgetService({
    redis_url: env.REDIS_URL,
    state_service: stateService,
    database_path: env.DATABASE_PATH,
    logger,
  });
  const escalationService = createEscalationService({
    redis_url: env.REDIS_URL,
    state_service: stateService,
    logger,
  });
  const confirmationService = createConfirmationService({
    redis_url: env.REDIS_URL,
    state_service: stateService,
    gates: runtimeSystemConfig.confirmation_gates,
    logger,
  });
  const dataIngestService = createDataIngestService({
    state_service: stateService,
    classifier: classifierService,
    queue_service: queueService,
    anthropic_api_key: env.ANTHROPIC_API_KEY,
    logger,
    imap: {
      host: env.IMAP_HOST,
      port: Number(env.IMAP_PORT ?? "993"),
      user: env.IMAP_USER,
      password: env.IMAP_PASSWORD,
      mailbox: env.IMAP_MAILBOX,
    },
  });
  const schedulerService = createSchedulerService({
    redis_url: env.REDIS_URL,
    timezone: runtimeSystemConfig.system.timezone,
    daily_rhythm: runtimeSystemConfig.daily_rhythm,
    state_service: stateService,
    logger,
  });
  await schedulerService.start();
  const schedulerWorker = schedulerService.registerWorker(async (_event, items) => {
    if (items.length === 0) {
      return;
    }
    await Promise.all(items.map((item) => queueService.enqueue(item)));
  });

  // Reconcile stale queue/scheduler state before any new work is pulled.
  await runStaleCatchUp(
    queue,
    queueService,
    stateService,
    escalationService,
    confirmationService,
    budgetService,
    schedulerService,
  );

  const workerService = createWorker({
    classifier_service: classifierService,
    identity_service: createWorkerIdentityService(),
    topic_profile_service: topicProfileService,
    routing_service: routingService,
    budget_service: budgetService,
    escalation_service: escalationService,
    confirmation_service: confirmationService,
    state_service: stateService,
    queue_service: queueService,
    transport_service: createTransportContract(transportLayer, emulationStore),
    logger,
    config: runtimeSystemConfig.worker,
  });

  const worker = queueService.registerWorker(
    {
      concurrency: 1,
      retry: { attempts: 5, backoff_ms: 1_000 },
    },
    async (item) => {
      await workerService.process(item);
    },
  );
  await worker.pause(true);

  const imapClient = await dataIngestService.startMonitoring();

  return {
    fastify,
    caldavServer,
    queue,
    queueService,
    worker,
    scheduler: {
      stop: async () => {
        await schedulerWorker.close();
        await schedulerService.stop();
        logger.info("Scheduler service stopped.");
      },
    },
    imapClient,
    stateService,
    budgetService,
    escalationService,
    confirmationService,
    transportLayer,
    db,
  };
}

function registerShutdown(runtime: RuntimeHandles): void {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Shutdown started.");

    try {
      // Stop inbound traffic first, then drain worker and close dependencies in order.
      await runtime.caldavServer.close();
      logger.info("CalDAV server closed.");
      await runtime.fastify.close();
      logger.info("Fastify closed.");

      await runtime.worker.pause(true);
      await runtime.worker.close();
      logger.info("BullMQ worker paused and closed.");

      if (runtime.imapClient) {
        await runtime.imapClient.logout();
        logger.info("IMAP connection closed.");
      }

      await runtime.scheduler.stop();
      await runtime.confirmationService.close();
      await runtime.budgetService.close();
      await runtime.transportLayer.close();
      runtime.stateService.close();
      runtime.db.close();
      logger.info("SQLite connection closed.");

      await runtime.queueService.close();
      await runtime.queue.close();
      logger.info("Redis/BullMQ connections closed.");

      process.exitCode = 0;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ err: message }, "Shutdown failed.");
      process.exitCode = 1;
    }
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

async function main(): Promise<void> {
  const runtime = await createRuntime();
  registerShutdown(runtime);
  // Worker registration starts the run loop, so boot only needs to lift the startup pause.
  runtime.worker.resume();
  logger.info("BullMQ worker started.");
  logger.info("All runtime services initialized.");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ err: message }, "Server startup failed.");
  process.exitCode = 1;
});
