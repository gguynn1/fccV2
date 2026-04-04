import { mkdirSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";

import { Queue, Worker, type JobsOptions } from "bullmq";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { pino, type Logger } from "pino";
import twilio from "twilio";

import { ThreadType } from "../../02-supporting-services/05-routing-service/types.js";
import {
  runtimeSystemConfig,
  runtimeSystemConfigVersion,
} from "../../config/runtime-system-config.js";
import { toRedisConnection } from "../../lib/redis.js";
import { QueueItemSource } from "../../types.js";
import type { QueueConsumerOptions } from "../04-queue/types.js";
import type { StackQueueItem } from "../types.js";
import {
  DeliveryStatusType,
  ReactionSentiment,
  TransportInputKind,
  twilioInboundPayloadSchema,
  twilioStatusPayloadSchema,
  type DeliveryStatusUpdate,
  type TransportAttachment,
  type TransportInboundInput,
  type TransportOutboundMessage,
} from "./types.js";

const DEFAULT_LOGGER = pino({ name: "transport-layer" });
const DEFAULT_MEDIA_DIRECTORY = "data/media";
const DEFAULT_OUTBOUND_QUEUE_NAME = "fcc-transport-outbound";
const DEFAULT_RETRY: QueueConsumerOptions["retry"] = { attempts: 5, backoff_ms: 1_000 };

type FormPayload = Record<string, string>;

export interface TransportLayerQueue {
  enqueue: (item: StackQueueItem, opts?: JobsOptions) => Promise<void>;
}

export interface TwilioTransportLayerOptions {
  account_sid: string;
  auth_token: string;
  messaging_identity: string;
  redis_url: string;
  public_base_url?: string;
  media_directory?: string;
  logger?: Logger;
}

export class TwilioTransportLayer {
  private readonly twilioClient: ReturnType<typeof twilio>;

  private readonly logger: Logger;

  private readonly authToken: string;

  private readonly accountSid: string;

  private readonly messagingIdentity: string;

  private readonly publicBaseUrl?: string;

  private readonly mediaDirectory: string;

  private readonly entityIdByIdentity: Map<string, string>;

  private readonly participantIdentityById: Map<string, string>;

  private readonly privateThreadByParticipantId: Map<string, string>;

  private lastSeenConfigVersion: number;

  private readonly outboundQueue: Queue<TransportOutboundMessage>;

  private readonly outboundWorker: Worker<TransportOutboundMessage>;

  public constructor(options: TwilioTransportLayerOptions) {
    this.twilioClient = twilio(options.account_sid, options.auth_token);
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.authToken = options.auth_token;
    this.accountSid = options.account_sid;
    this.messagingIdentity = options.messaging_identity;
    this.publicBaseUrl = options.public_base_url;
    this.mediaDirectory = resolve(
      process.cwd(),
      options.media_directory ?? DEFAULT_MEDIA_DIRECTORY,
    );
    this.entityIdByIdentity = new Map();
    this.participantIdentityById = new Map();
    this.privateThreadByParticipantId = new Map();
    this.lastSeenConfigVersion = -1;
    this.outboundQueue = new Queue<TransportOutboundMessage>(DEFAULT_OUTBOUND_QUEUE_NAME, {
      connection: toRedisConnection(options.redis_url),
    });
    this.outboundWorker = new Worker<TransportOutboundMessage>(
      DEFAULT_OUTBOUND_QUEUE_NAME,
      async (job) => {
        await this.sendOutboundDirect(job.data);
      },
      {
        connection: toRedisConnection(options.redis_url),
      },
    );
    this.refreshMapsIfStale();
  }

  public registerRoutes(fastify: FastifyInstance, queue: TransportLayerQueue): void {
    fastify.post("/webhook/twilio", async (request, reply) => {
      const payload = this.toFormPayload(request.body);
      if (!this.validateSignature(request, payload)) {
        reply.code(403);
        return { error: "Invalid signature" };
      }

      if (!this.isKnownParticipant(payload.From)) {
        this.logger.warn(
          { from: payload.From },
          "Inbound message from non-participant silently dropped.",
        );
        reply.type("text/xml");
        return "<Response></Response>";
      }

      const normalized = await this.normalizeInboundPayload(payload);
      await queue.enqueue(this.toQueueItem(normalized), {
        attempts: DEFAULT_RETRY.attempts,
        backoff: {
          type: "exponential",
          delay: DEFAULT_RETRY.backoff_ms,
        },
      });
      reply.type("text/xml");
      return "<Response></Response>";
    });

    fastify.post("/webhook/twilio/status", async (request, reply) => {
      const payload = this.toFormPayload(request.body);
      if (!this.validateSignature(request, payload)) {
        reply.code(403);
        return { error: "Invalid signature" };
      }

      const update = this.parseDeliveryStatus(payload, request);
      this.logger.info(
        {
          provider_message_id: update.provider_message_id,
          status: update.status,
          thread_id: update.thread_id,
          participant_id: update.participant_id,
          error_code: update.error_code,
        },
        "Delivery status callback received.",
      );
      reply.code(204);
      return null;
    });
  }

  public async queueOutbound(message: TransportOutboundMessage): Promise<void> {
    await this.outboundQueue.add("outbound", message, {
      attempts: DEFAULT_RETRY.attempts,
      backoff: {
        type: "exponential",
        delay: DEFAULT_RETRY.backoff_ms,
      },
    });
  }

  public async close(): Promise<void> {
    await Promise.all([this.outboundWorker.close(), this.outboundQueue.close()]);
  }

  private toFormPayload(input: unknown): FormPayload {
    if (typeof input !== "object" || input === null) {
      return {};
    }

    return Object.entries(input as Record<string, unknown>).reduce<FormPayload>(
      (acc, [key, value]) => {
        if (typeof value === "string") {
          acc[key] = value;
        } else if (typeof value === "number" || typeof value === "boolean") {
          acc[key] = String(value);
        } else if (value !== undefined && value !== null) {
          acc[key] = JSON.stringify(value);
        }
        return acc;
      },
      {},
    );
  }

  private isKnownParticipant(from: string | undefined): boolean {
    this.refreshMapsIfStale();
    return typeof from === "string" && this.entityIdByIdentity.has(from);
  }

  private validateSignature(request: FastifyRequest, payload: FormPayload): boolean {
    const signature = request.headers["x-twilio-signature"];
    if (typeof signature !== "string" || signature.length === 0) {
      return false;
    }

    const pathWithQuery = request.raw.url ?? request.url;
    const url = this.publicBaseUrl
      ? `${this.publicBaseUrl}${pathWithQuery}`
      : `${this.requestProtocol(request)}://${request.headers.host ?? "localhost"}${pathWithQuery}`;
    return twilio.validateRequest(this.authToken, signature, url, payload);
  }

  private requestProtocol(request: FastifyRequest): string {
    const forwarded = request.headers["x-forwarded-proto"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      return forwarded.split(",")[0]?.trim() ?? "https";
    }
    return request.protocol;
  }

  private async normalizeInboundPayload(payload: FormPayload): Promise<TransportInboundInput> {
    this.refreshMapsIfStale();
    const parsed = twilioInboundPayloadSchema.parse(payload);
    const body = (payload.Body ?? "").trim();
    const participantId = this.entityIdByIdentity.get(parsed.From);
    if (!participantId) {
      throw new Error(`Unknown inbound messaging identity: ${parsed.From}`);
    }

    const threadId = this.privateThreadByParticipantId.get(participantId);
    if (!threadId) {
      throw new Error(`No private thread configured for participant: ${participantId}`);
    }

    const common = {
      provider_message_id: parsed.MessageSid,
      source_identity: parsed.From,
      thread_id: threadId,
      concerning: [participantId],
      received_at: new Date(),
      source: QueueItemSource.HumanMessage,
    };

    if (parsed.NumMedia > 0) {
      const attachments = await this.downloadAttachments(
        parsed.MessageSid,
        parsed.NumMedia,
        payload,
      );
      return {
        ...common,
        kind: TransportInputKind.Image,
        source: QueueItemSource.ImageAttachment,
        content: body,
        attachments,
      };
    }

    if (this.looksLikeForwarded(body)) {
      return {
        ...common,
        kind: TransportInputKind.ForwardedContent,
        source: QueueItemSource.ForwardedMessage,
        content: body,
      };
    }

    const maybeReaction = this.toReaction(body);
    if (maybeReaction !== null) {
      return {
        ...common,
        kind: TransportInputKind.Reaction,
        source: QueueItemSource.Reaction,
        content: body,
        reaction: maybeReaction,
      };
    }

    if (this.looksLikeStructuredChoice(body)) {
      return {
        ...common,
        kind: TransportInputKind.StructuredChoice,
        content: body,
      };
    }

    return {
      ...common,
      kind: TransportInputKind.Text,
      content: body,
    };
  }

  private toQueueItem(input: TransportInboundInput): StackQueueItem {
    const content =
      input.kind === TransportInputKind.Image
        ? {
            text: input.content,
            attachments: input.attachments.map((attachment) => ({
              id: attachment.id,
              mime_type: attachment.mime_type,
              local_path: attachment.local_path,
            })),
          }
        : input.content;

    return {
      source: input.source,
      content,
      concerning: input.concerning,
      target_thread: input.thread_id,
      created_at: input.received_at,
      idempotency_key: `twilio:${input.provider_message_id}`,
    };
  }

  private async downloadAttachments(
    providerMessageId: string,
    numMedia: number,
    payload: FormPayload,
  ): Promise<TransportAttachment[]> {
    mkdirSync(this.mediaDirectory, { recursive: true });
    const attachments: TransportAttachment[] = [];
    const authHeader = `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`;

    for (let index = 0; index < numMedia; index += 1) {
      const url = payload[`MediaUrl${index}`];
      const mimeType = payload[`MediaContentType${index}`] ?? "application/octet-stream";
      if (!url) {
        continue;
      }

      const response = await fetch(url, { headers: { Authorization: authHeader } });
      if (!response.ok) {
        throw new Error(`Failed to download media ${url}: ${response.status}`);
      }

      const extension = this.extensionFromMimeType(mimeType, url);
      const fileName = `${providerMessageId}_${index}${extension}`;
      const localPath = resolve(this.mediaDirectory, fileName);
      writeFileSync(localPath, Buffer.from(await response.arrayBuffer()));
      attachments.push({
        id: `${providerMessageId}_${index}`,
        mime_type: mimeType,
        local_path: localPath,
        remote_url: url,
      });
    }

    return attachments;
  }

  private extensionFromMimeType(mimeType: string, remoteUrl: string): string {
    const fromMime = mimeType.split("/")[1];
    if (fromMime && fromMime.length > 0) {
      return `.${fromMime.replace("+xml", "")}`;
    }
    const fromUrl = extname(remoteUrl);
    return fromUrl.length > 0 ? fromUrl : ".bin";
  }

  private looksLikeForwarded(content: string): boolean {
    const lowered = content.toLowerCase();
    return lowered.startsWith("fwd:") || lowered.includes("forwarded");
  }

  private toReaction(content: string): ReactionSentiment | null {
    const lowered = content.toLowerCase();
    if (["yes", "y", "approved", "approve", "done"].includes(lowered)) {
      return ReactionSentiment.Positive;
    }
    if (["no", "n", "reject", "rejected", "decline", "declined"].includes(lowered)) {
      return ReactionSentiment.Negative;
    }
    return null;
  }

  private looksLikeStructuredChoice(content: string): boolean {
    if (/^\d+$/u.test(content.trim())) {
      return true;
    }
    return /^[a-z]$/iu.test(content.trim());
  }

  private parseDeliveryStatus(payload: FormPayload, request: FastifyRequest): DeliveryStatusUpdate {
    this.refreshMapsIfStale();
    const parsed = twilioStatusPayloadSchema.parse(payload);
    const status = this.toDeliveryStatus(parsed.MessageStatus);
    const threadFromQuery = this.readQueryValue(request, "thread_id");
    const participantFromQuery = this.readQueryValue(request, "participant_id");
    const participantFromIdentity = this.entityIdByIdentity.get(parsed.To);
    return {
      provider_message_id: parsed.MessageSid,
      status,
      thread_id:
        threadFromQuery ??
        this.privateThreadByParticipantId.get(participantFromIdentity ?? "") ??
        "",
      participant_id: participantFromQuery ?? participantFromIdentity ?? "",
      at: new Date(),
      error_code: parsed.ErrorCode,
      error_message: parsed.ErrorMessage,
    };
  }

  private readQueryValue(request: FastifyRequest, key: string): string | undefined {
    const value = (request.query as Record<string, unknown> | undefined)?.[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private toDeliveryStatus(providerStatus: string): DeliveryStatusType {
    switch (providerStatus.toLowerCase()) {
      case "queued":
      case "accepted":
        return DeliveryStatusType.Queued;
      case "sent":
        return DeliveryStatusType.Sent;
      case "delivered":
        return DeliveryStatusType.Delivered;
      case "undelivered":
        return DeliveryStatusType.Undelivered;
      default:
        return DeliveryStatusType.Failed;
    }
  }

  private async sendOutboundDirect(message: TransportOutboundMessage): Promise<void> {
    this.refreshMapsIfStale();
    const participantIds = this.resolveParticipantsForThread(message.target_thread);
    const callbackBase = this.publicBaseUrl ?? `http://localhost:${process.env.PORT ?? "3000"}`;

    for (const participantId of participantIds) {
      const toIdentity = this.participantIdentityById.get(participantId);
      if (!toIdentity) {
        throw new Error(`No messaging identity for participant ${participantId}`);
      }

      await this.twilioClient.messages.create({
        body: message.content,
        from: this.messagingIdentity,
        to: toIdentity,
        statusCallback: `${callbackBase}/webhook/twilio/status?thread_id=${encodeURIComponent(
          message.target_thread,
        )}&participant_id=${encodeURIComponent(participantId)}`,
      });
    }
  }

  private resolveParticipantsForThread(threadId: string): string[] {
    const thread = runtimeSystemConfig.threads.find((candidate) => candidate.id === threadId);
    if (!thread) {
      throw new Error(`Unknown thread id: ${threadId}`);
    }
    return thread.participants;
  }

  private refreshMapsIfStale(): void {
    const configVersion =
      typeof runtimeSystemConfigVersion === "number" ? runtimeSystemConfigVersion : -1;
    if (this.lastSeenConfigVersion === configVersion) {
      return;
    }
    this.lastSeenConfigVersion = configVersion;

    this.entityIdByIdentity.clear();
    this.participantIdentityById.clear();
    this.privateThreadByParticipantId.clear();
    for (const entity of runtimeSystemConfig.entities) {
      if (entity.messaging_identity !== null) {
        this.entityIdByIdentity.set(entity.messaging_identity, entity.id);
        this.participantIdentityById.set(entity.id, entity.messaging_identity);
      }
    }

    for (const thread of runtimeSystemConfig.threads) {
      if (thread.type !== ThreadType.Private) {
        continue;
      }
      const participantId = thread.participants[0];
      if (!participantId) {
        continue;
      }
      this.privateThreadByParticipantId.set(participantId, thread.id);
    }
  }
}

export function createTwilioTransportLayer(
  options: TwilioTransportLayerOptions,
): TwilioTransportLayer {
  return new TwilioTransportLayer(options);
}
