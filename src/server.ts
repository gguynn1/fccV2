import Fastify, { type FastifyInstance } from "fastify";
import { parse as parseQueryString } from "node:querystring";
import { Queue, type Worker } from "bullmq";
import { ImapFlow } from "imapflow";
import { pino } from "pino";
import type BetterSqlite3 from "better-sqlite3";

import { createCalDavService } from "./01-service-stack/01-transport-layer/01.1-caldav/index.js";
import { createTwilioTransportLayer } from "./01-service-stack/01-transport-layer/index.js";
import { BullQueueService } from "./01-service-stack/04-queue/index.js";
import {
  createStateService,
  type SqliteStateService,
} from "./02-supporting-services/03-state-service/index.js";
import { loadEnv } from "./env.js";
import { initializeDatabase } from "./bootstrap.js";
import { toRedisConnection } from "./lib/redis.js";

const logger = pino({ name: "fcc-server" });

interface SchedulerHandle {
  stop: () => void;
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

async function runStaleCatchUp(queue: Queue): Promise<void> {
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
  logger.info("Startup catch-up: escalation reconciliation placeholder completed.");
  logger.info("Startup catch-up: confirmation expiry reconciliation placeholder completed.");
  logger.info("Startup catch-up: budget counter reconstruction check placeholder completed.");
  logger.info("Startup catch-up: scheduler relevance check placeholder completed.");
}

function startScheduler(): SchedulerHandle {
  const timer = setInterval(() => {
    logger.debug("Scheduler heartbeat.");
  }, 60_000);

  timer.unref();
  logger.info("Scheduler service initialized.");

  return {
    stop: () => {
      clearInterval(timer);
      logger.info("Scheduler service stopped.");
    },
  };
}

function shouldStartImap(env: Record<string, string | undefined>): boolean {
  const host = env.IMAP_HOST;
  const user = env.IMAP_USER;
  const password = env.IMAP_PASSWORD;

  if (!host || !user || !password) {
    return false;
  }

  // Placeholder values are treated as "not configured" to avoid noisy connection failures.
  return host !== "imap.example.com" && user !== "your_email@example.com";
}

async function startImapListener(
  env: Record<string, string | undefined>,
): Promise<ImapFlow | null> {
  if (!shouldStartImap(env)) {
    logger.warn("IMAP listener skipped (credentials not configured yet).");
    return null;
  }

  const client = new ImapFlow({
    host: env.IMAP_HOST!,
    port: Number(env.IMAP_PORT || "993"),
    secure: true,
    auth: {
      user: env.IMAP_USER!,
      pass: env.IMAP_PASSWORD!,
    },
  });

  await client.connect();
  logger.info("IMAP listener connected.");
  return client;
}

async function createRuntime(): Promise<RuntimeHandles> {
  const env = loadEnv(process.env as Record<string, string | undefined>);
  const db = initializeDatabase(env.DATABASE_PATH);
  const stateService = createStateService(env.DATABASE_PATH, logger);
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

  const fastify = Fastify({ logger });
  fastify.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      const payload = typeof body === "string" ? body : body.toString("utf8");
      done(null, parseQueryString(payload));
    },
  );

  fastify.get("/health", () => ({ ok: true }));
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
  const caldavPort = Number(env.CALDAV_PORT || "3001");
  const caldavServer = Fastify({ logger });
  const calDavService = createCalDavService({ state_service: stateService });
  calDavService.registerRoutes(caldavServer);
  await caldavServer.listen({ port: caldavPort, host: "0.0.0.0" });
  logger.info({ port: caldavPort }, "CalDAV server started (local network only, no ngrok).");

  // Reconcile stale queue/scheduler state before any new work is pulled.
  await runStaleCatchUp(queue);

  const worker = queueService.registerWorker(
    {
      concurrency: 1,
      retry: { attempts: 5, backoff_ms: 1_000 },
    },
    () => {
      logger.info("Worker processed placeholder job.");
      return Promise.resolve();
    },
  );
  await worker.pause(true);

  const scheduler = startScheduler();
  const imapClient = await startImapListener(process.env as Record<string, string | undefined>);

  return {
    fastify,
    caldavServer,
    queue,
    queueService,
    worker,
    scheduler,
    imapClient,
    stateService,
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

      runtime.scheduler.stop();
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
  // Start job processing only after shutdown hooks are registered.
  void runtime.worker.run();
  logger.info("BullMQ worker started.");
  logger.info("All runtime services initialized.");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ err: message }, "Server startup failed.");
  process.exitCode = 1;
});
