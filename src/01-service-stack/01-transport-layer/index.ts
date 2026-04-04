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
  conversations_enabled?: boolean;
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

  private readonly conversationSidByThread: Map<string, string>;

  private readonly threadByConversationSid: Map<string, string>;

  private readonly conversationsEnabled: boolean;

  private conversationsInitialized: boolean;

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
    this.conversationsEnabled = options.conversations_enabled === true;
    this.conversationsInitialized = false;
    this.mediaDirectory = resolve(
      process.cwd(),
      options.media_directory ?? DEFAULT_MEDIA_DIRECTORY,
    );
    this.entityIdByIdentity = new Map();
    this.participantIdentityById = new Map();
    this.privateThreadByParticipantId = new Map();
    this.conversationSidByThread = new Map();
    this.threadByConversationSid = new Map();
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

    if (this.conversationsEnabled) {
      fastify.post("/webhook/twilio/conversations", async (request, reply) => {
        const payload = this.toFormPayload(request.body);
        if (!this.validateSignature(request, payload)) {
          reply.code(403);
          return { error: "Invalid signature" };
        }

        const eventType = payload.EventType;
        if (eventType !== "onMessageAdded") {
          reply.code(200);
          return { ok: true };
        }

        const conversationSid = payload.ConversationSid;
        const author = payload.Author;
        const body = (payload.Body ?? "").trim();
        const messageSid = payload.MessageSid ?? `conv_${Date.now()}`;

        if (!conversationSid || !author) {
          reply.code(400);
          return { error: "Missing ConversationSid or Author" };
        }

        if (author === this.messagingIdentity) {
          reply.code(200);
          return { ok: true };
        }

        if (!this.isKnownParticipant(author)) {
          this.logger.warn(
            { from: author, conversation_sid: conversationSid },
            "Conversations message from non-participant silently dropped.",
          );
          reply.code(200);
          return { ok: true };
        }

        const threadId = this.threadByConversationSid.get(conversationSid);
        if (!threadId) {
          this.logger.warn(
            { conversation_sid: conversationSid },
            "No thread mapping for conversation. Falling back to private thread.",
          );
          const normalized = await this.normalizeInboundPayload({
            ...payload,
            MessageSid: messageSid,
            From: author,
            To: this.messagingIdentity,
            Body: body,
            NumMedia: payload.NumMedia ?? "0",
          });
          await queue.enqueue(this.toQueueItem(normalized), {
            attempts: DEFAULT_RETRY.attempts,
            backoff: { type: "exponential", delay: DEFAULT_RETRY.backoff_ms },
          });
          reply.code(200);
          return { ok: true };
        }

        const participantId = this.entityIdByIdentity.get(author);
        if (!participantId) {
          reply.code(200);
          return { ok: true };
        }

        const queueItem: StackQueueItem = {
          source: QueueItemSource.HumanMessage,
          content: body,
          concerning: [participantId],
          target_thread: threadId,
          created_at: new Date(),
          idempotency_key: `twilio_conv:${messageSid}`,
        };

        await queue.enqueue(queueItem, {
          attempts: DEFAULT_RETRY.attempts,
          backoff: { type: "exponential", delay: DEFAULT_RETRY.backoff_ms },
        });

        reply.code(200);
        return { ok: true };
      });
    }
  }

  public async initializeConversations(): Promise<void> {
    if (!this.conversationsEnabled) {
      return;
    }

    this.refreshMapsIfStale();
    const sharedThreads = runtimeSystemConfig.threads.filter(
      (thread) => thread.type === ThreadType.Shared,
    );

    for (const thread of sharedThreads) {
      try {
        if (thread.conversation_sid) {
          this.conversationSidByThread.set(thread.id, thread.conversation_sid);
          this.threadByConversationSid.set(thread.conversation_sid, thread.id);
          this.logger.info(
            { thread_id: thread.id, conversation_sid: thread.conversation_sid },
            "Mapped existing conversation SID from config.",
          );
          continue;
        }

        const conversation = await this.twilioClient.conversations.v1.conversations.create({
          friendlyName: `fcc-${thread.id}`,
          uniqueName: `fcc-thread-${thread.id}`,
        });

        this.conversationSidByThread.set(thread.id, conversation.sid);
        this.threadByConversationSid.set(conversation.sid, thread.id);

        await this.twilioClient.conversations.v1
          .conversations(conversation.sid)
          .participants.create({
            identity: "fcc-assistant",
            "messagingBinding.projectedAddress": this.messagingIdentity,
          });

        for (const participantId of thread.participants) {
          const identity = this.participantIdentityById.get(participantId);
          if (!identity) {
            continue;
          }
          await this.twilioClient.conversations.v1
            .conversations(conversation.sid)
            .participants.create({
              "messagingBinding.address": identity,
            });
        }

        this.logger.info(
          { thread_id: thread.id, conversation_sid: conversation.sid },
          "Created Twilio Conversation for shared thread.",
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("uniqueName") || message.includes("already exists") || message.includes("50433")) {
          try {
            const existing = await this.twilioClient.conversations.v1.conversations
              .list({ limit: 100 });
            const match = existing.find((c) => c.uniqueName === `fcc-thread-${thread.id}`);
            if (match) {
              this.conversationSidByThread.set(thread.id, match.sid);
              this.threadByConversationSid.set(match.sid, thread.id);
              this.logger.info(
                { thread_id: thread.id, conversation_sid: match.sid },
                "Found existing Twilio Conversation for shared thread.",
              );
              continue;
            }
          } catch {
            // Fall through to warning
          }
        }
        this.logger.warn(
          { thread_id: thread.id, err: message },
          "Failed to initialize Conversations for shared thread. Falling back to fan-out.",
        );
      }
    }

    this.conversationsInitialized = this.conversationSidByThread.size > 0;
    this.logger.info(
      { conversations_count: this.conversationSidByThread.size, enabled: this.conversationsInitialized },
      "Conversations initialization complete.",
    );
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

    const conversationSid = this.conversationSidByThread.get(message.target_thread);
    if (this.conversationsEnabled && this.conversationsInitialized && conversationSid) {
      await this.twilioClient.conversations.v1
        .conversations(conversationSid)
        .messages.create({
          author: this.messagingIdentity,
          body: message.content,
        });
      return;
    }

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
