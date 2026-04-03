import { Queue, type Job, type JobsOptions, Worker } from "bullmq";
import { pino, type Logger } from "pino";

import type { StateService } from "../../02-supporting-services/types.js";
import { toRedisConnection } from "../../lib/redis.js";
import type { StackQueueItem } from "../types.js";
import {
  type PendingQueueItem,
  pendingQueueItemSchema,
  type QueueConsumerOptions,
  QueueItemSource,
  QueueItemType,
} from "./types.js";

const DEFAULT_LOGGER = pino({ name: "queue-service" });
const DEFAULT_QUEUE_NAME = "fcc-main";
const DEFAULT_DEAD_LETTER_QUEUE_NAME = "fcc-main-dead-letter";
const DEFAULT_STALE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface QueueServiceOptions {
  redis_url: string;
  queue_name?: string;
  dead_letter_queue_name?: string;
  stale_window_ms?: number;
  retry_attempts?: number;
  retry_backoff_ms?: number;
  logger?: Logger;
}

export interface QueueStartupReconciliation {
  removed_duplicates: number;
  removed_stale: number;
}

export class BullQueueService {
  private readonly queue: Queue<PendingQueueItem>;

  private readonly deadLetterQueue: Queue<PendingQueueItem>;

  private readonly logger: Logger;

  private readonly staleWindowMs: number;

  private readonly queueName: string;

  private readonly retryAttempts: number;

  private readonly retryBackoffMs: number;

  public constructor(options: QueueServiceOptions) {
    const connection = toRedisConnection(options.redis_url);
    const queueName = options.queue_name ?? DEFAULT_QUEUE_NAME;
    const deadLetterQueueName = options.dead_letter_queue_name ?? DEFAULT_DEAD_LETTER_QUEUE_NAME;

    this.queue = new Queue<PendingQueueItem>(queueName, { connection });
    this.deadLetterQueue = new Queue<PendingQueueItem>(deadLetterQueueName, { connection });
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.staleWindowMs = options.stale_window_ms ?? DEFAULT_STALE_WINDOW_MS;
    this.queueName = queueName;
    this.retryAttempts = options.retry_attempts ?? 5;
    this.retryBackoffMs = options.retry_backoff_ms ?? 1_000;
  }

  public async verifyConnection(): Promise<void> {
    await this.queue.waitUntilReady();
    this.logger.info({ queue: this.queueName }, "Queue connected to Redis.");
  }

  public async enqueue(item: StackQueueItem, opts?: JobsOptions): Promise<void> {
    const normalized = pendingQueueItemSchema.parse({
      ...item,
      id: this.extractQueueItemId(item),
      type:
        item.source === QueueItemSource.ScheduledTrigger
          ? QueueItemType.Outbound
          : QueueItemType.Inbound,
      target_thread: item.target_thread,
    });

    if (normalized.idempotency_key) {
      const duplicate = await this.findPendingByIdempotencyKey(normalized.idempotency_key);
      if (duplicate) {
        this.logger.info(
          { idempotency_key: normalized.idempotency_key, existing_job_id: duplicate.id },
          "Duplicate queue item skipped by idempotency key.",
        );
        return;
      }
    }

    await this.queue.add("pending", normalized, {
      attempts: opts?.attempts ?? this.retryAttempts,
      backoff: opts?.backoff ?? {
        type: "exponential",
        delay: this.retryBackoffMs,
      },
      ...opts,
    });
    this.logger.info(
      { queue_item_id: normalized.id, source: normalized.source },
      "Queue item enqueued.",
    );
  }

  public async dequeue(): Promise<PendingQueueItem | null> {
    const jobs = await this.queue.getJobs(["waiting", "delayed"], 0, 0, true);
    if (jobs.length === 0) {
      return null;
    }

    const job = jobs[0];
    if (!job) {
      return null;
    }
    const parsed = pendingQueueItemSchema.parse(job.data);
    this.logger.info({ queue_item_id: parsed.id }, "Queue item read for consumption.");
    return parsed;
  }

  public registerWorker(
    options: QueueConsumerOptions,
    processor: (item: PendingQueueItem) => Promise<void>,
  ): Worker<PendingQueueItem> {
    const worker = new Worker<PendingQueueItem>(
      this.queueName,
      async (job: Job<PendingQueueItem>) => {
        const queueItem = pendingQueueItemSchema.parse(job.data);
        this.logger.info(
          { queue_item_id: queueItem.id, attempt: job.attemptsMade + 1 },
          "Queue item dequeued for worker.",
        );

        await processor(queueItem);
      },
      {
        connection: this.queue.opts.connection,
        concurrency: options.concurrency,
      },
    );

    worker.on("failed", (job, error) => {
      if (!job) {
        return;
      }

      void (async () => {
        const maxAttempts = options.retry.attempts;
        const exhausted = job.attemptsMade >= maxAttempts;
        this.logger.warn(
          { queue_item_id: job.id, attempts_made: job.attemptsMade, error: error.message },
          "Queue job failed.",
        );

        if (exhausted) {
          await this.deadLetterQueue.add("dead_letter", job.data);
          await job.remove();
          this.logger.error({ queue_item_id: job.id }, "Queue job moved to dead-letter queue.");
        }
      })();
    });

    worker.on("completed", (job) => {
      this.logger.info({ queue_item_id: job.id }, "Queue job completed.");
    });

    return worker;
  }

  public async reconcileStartup(stateService: StateService): Promise<QueueStartupReconciliation> {
    const pendingJobs = await this.queue.getJobs(["waiting", "delayed"], 0, -1, true);
    const now = Date.now();

    const byIdempotency = new Map<string, Job<PendingQueueItem>[]>();
    let removedStale = 0;

    for (const job of pendingJobs) {
      const parsed = pendingQueueItemSchema.safeParse(job.data);
      if (!parsed.success) {
        await this.deadLetterQueue.add("invalid_pending_item", job.data);
        await job.remove();
        continue;
      }

      const createdAt = parsed.data.created_at.getTime();
      if (now - createdAt > this.staleWindowMs) {
        await job.remove();
        removedStale += 1;
        this.logger.info({ queue_item_id: parsed.data.id }, "Stale queue item removed on startup.");
        continue;
      }

      if (parsed.data.idempotency_key) {
        const list = byIdempotency.get(parsed.data.idempotency_key) ?? [];
        list.push(job);
        byIdempotency.set(parsed.data.idempotency_key, list);
      }
    }

    let removedDuplicates = 0;
    for (const [, jobs] of byIdempotency) {
      if (jobs.length < 2) {
        continue;
      }

      jobs.sort((left, right) => right.timestamp - left.timestamp);
      for (const duplicate of jobs.slice(1)) {
        await duplicate.remove();
        removedDuplicates += 1;
      }
    }

    if (removedStale > 0 || removedDuplicates > 0) {
      this.logger.info(
        { removed_stale: removedStale, removed_duplicates: removedDuplicates },
        "Startup queue reconciliation complete.",
      );
    }

    // Keep queue state store in sync after startup reconciliation.
    const systemState = await stateService.getSystemState();
    const jobsAfterReconcile = await this.queue.getJobs(["waiting", "delayed"], 0, -1, true);
    systemState.queue.pending = jobsAfterReconcile.map((job) =>
      pendingQueueItemSchema.parse(job.data),
    );
    await stateService.saveSystemState(systemState);

    return {
      removed_duplicates: removedDuplicates,
      removed_stale: removedStale,
    };
  }

  public async close(): Promise<void> {
    await Promise.all([this.queue.close(), this.deadLetterQueue.close()]);
  }

  private extractQueueItemId(item: StackQueueItem): string {
    const maybeId = (item as Record<string, unknown>).id;
    if (typeof maybeId === "string" && maybeId.length > 0) {
      return maybeId;
    }

    return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private async findPendingByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<Job<PendingQueueItem> | null> {
    const pending = await this.queue.getJobs(["waiting", "delayed", "active"], 0, -1, true);
    const duplicate = pending.find((job) => job.data.idempotency_key === idempotencyKey);
    return duplicate ?? null;
  }
}
