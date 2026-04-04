import Anthropic from "@anthropic-ai/sdk";
import { ImapFlow } from "imapflow";
import { pino, type Logger } from "pino";

import type {
  ClassifierServiceContract,
  StackClassificationResult,
  StackQueueItem,
} from "../../01-service-stack/types.js";
import { runtimeSystemConfig } from "../../config/runtime-system-config.js";
import {
  ClassifierIntent,
  DispatchPriority,
  EntityType,
  QueueItemSource,
  TopicKey,
} from "../../types.js";
import type { DataIngestService as DataIngestServiceContract, StateService } from "../types.js";
import {
  DataIngestSourceType,
  IngestOrigin,
  type DataIngestConfig,
  type DataIngestState,
  type ExtractedIngestPayload,
  type IngestAttachment,
  type ParsedCalendarAttachment,
  type ProcessedIngestItem,
} from "./types.js";

const DEFAULT_LOGGER = pino({ name: "data-ingest-service" });
const DEFAULT_RELEVANCE_WINDOW_MINUTES = 120;
const DEFAULT_IMAP_RECONNECT_DELAY_MS = 15_000;
const DEFAULT_HISTORY_LIMIT = 50;
const DEFAULT_EXTRACTION_MODEL = "claude-sonnet-4-20250514";

export interface InboxMessage {
  message_id: string;
  inbox_address: string;
  received_at: Date;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: IngestAttachment[];
  parse_confidence?: number;
  parse_warnings?: string[];
}

export interface DataIngestServiceOptions {
  state_service: StateService;
  classifier?: Pick<ClassifierServiceContract, "classify">;
  queue_service?: { enqueue(item: StackQueueItem): Promise<void> };
  anthropic_api_key?: string;
  extraction_model?: string;
  config?: DataIngestConfig;
  logger?: Logger;
  relevance_window_minutes?: number;
  imap?: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    mailbox?: string;
    secure?: boolean;
    reconnect_delay_ms?: number;
  };
}

interface IngestEnvelope {
  origin: IngestOrigin;
  received_at: Date;
  inbox_address?: string;
  from?: string;
  subject?: string;
  content: string;
  attachments: IngestAttachment[];
}

interface AttributedEntity {
  concerning: string[];
  target_thread: string;
}

interface NormalizedImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  mailbox: string;
  secure: boolean;
  reconnect_delay_ms: number;
}

function queueItemId(prefix: string, seed: string): string {
  const compact = seed.replace(/[^a-zA-Z0-9]+/gu, "_").slice(0, 48);
  return `${prefix}_${compact || Date.now().toString(36)}`;
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n").trim();
}

function parseMimeHeaders(rawHeaders: string): Record<string, string> {
  const lines = rawHeaders.split(/\r?\n/gu);
  const merged: string[] = [];
  for (const line of lines) {
    if (/^\s/u.test(line) && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line.trim()}`;
      continue;
    }
    merged.push(line.trim());
  }
  const headers: Record<string, string> = {};
  for (const line of merged) {
    if (!line.includes(":")) {
      continue;
    }
    const [key, ...rest] = line.split(":");
    headers[key.trim().toLowerCase()] = rest.join(":").trim();
  }
  return headers;
}

function decodeQuotedPrintable(value: string): string {
  return value
    .replace(/=\r?\n/gu, "")
    .replace(/=([A-Fa-f0-9]{2})/gu, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

function decodeMimeBody(body: string, encoding?: string): string {
  const normalizedEncoding = encoding?.toLowerCase();
  if (normalizedEncoding === "base64") {
    return Buffer.from(body.replace(/\s+/gu, ""), "base64").toString("utf8");
  }
  if (normalizedEncoding === "quoted-printable") {
    return decodeQuotedPrintable(body);
  }
  return body;
}

function extractBoundary(contentType?: string): string | null {
  if (!contentType) {
    return null;
  }
  const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/iu);
  return boundaryMatch?.[1] ?? null;
}

function parseDispositionFilename(disposition?: string): string | null {
  if (!disposition) {
    return null;
  }
  const match = disposition.match(/filename\*?="?([^";]+)"?/iu);
  return match?.[1] ?? null;
}

function parseMimeMessage(rawMessage: string): {
  text: string | null;
  html: string | null;
  attachments: IngestAttachment[];
  parse_confidence: number;
  parse_warnings: string[];
} {
  const warnings: string[] = [];
  const normalized = rawMessage.replace(/\r\n/gu, "\n");

  const parsePart = (
    partSource: string,
    aggregate: { text: string | null; html: string | null; attachments: IngestAttachment[] },
  ): void => {
    const separatorIndex = partSource.indexOf("\n\n");
    const rawHeaders = separatorIndex >= 0 ? partSource.slice(0, separatorIndex) : "";
    const rawBody = separatorIndex >= 0 ? partSource.slice(separatorIndex + 2) : partSource;
    const headers = parseMimeHeaders(rawHeaders);
    const contentType = headers["content-type"] ?? "text/plain";
    const transferEncoding = headers["content-transfer-encoding"];
    const disposition = headers["content-disposition"];
    const boundary = extractBoundary(contentType);
    const partType = contentType.split(";")[0]?.trim().toLowerCase() ?? "text/plain";

    if (!boundary) {
      let decodedBody = rawBody;
      try {
        decodedBody = decodeMimeBody(rawBody, transferEncoding);
      } catch {
        warnings.push(`decode_failed:${partType}`);
      }
      const filename =
        parseDispositionFilename(disposition) ?? parseDispositionFilename(contentType);
      if (partType === "text/plain" && !filename) {
        aggregate.text = aggregate.text ?? decodedBody;
        return;
      }
      if (partType === "text/html" && !filename) {
        aggregate.html = aggregate.html ?? decodedBody;
        return;
      }
      aggregate.attachments.push({
        filename: filename ?? `attachment_${aggregate.attachments.length + 1}`,
        content_type: partType || "application/octet-stream",
        content:
          transferEncoding?.toLowerCase() === "base64"
            ? rawBody.replace(/\s+/gu, "")
            : Buffer.from(decodedBody, "utf8").toString("base64"),
        content_transfer_encoding: transferEncoding?.toLowerCase() === "base64" ? "base64" : "utf8",
      });
      return;
    }

    const parts = rawBody.split(`--${boundary}`);
    for (const candidate of parts) {
      const trimmed = candidate.trim();
      if (!trimmed || trimmed === "--") {
        continue;
      }
      const nested = trimmed.endsWith("--") ? trimmed.slice(0, -2).trimEnd() : trimmed;
      parsePart(nested, aggregate);
    }
  };

  const aggregate = {
    text: null as string | null,
    html: null as string | null,
    attachments: [] as IngestAttachment[],
  };
  parsePart(normalized, aggregate);
  const parseConfidence = warnings.length === 0 ? 1 : Math.max(0.4, 1 - warnings.length * 0.15);
  return {
    text: aggregate.text,
    html: aggregate.html,
    attachments: aggregate.attachments,
    parse_confidence: parseConfidence,
    parse_warnings: warnings,
  };
}

function summarizeQueueContent(content: StackQueueItem["content"]): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

function safeDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function decodeAttachmentContent(attachment: IngestAttachment): string {
  if (attachment.content_transfer_encoding?.toLowerCase() === "base64") {
    return Buffer.from(attachment.content, "base64").toString("utf8");
  }
  return attachment.content;
}

function parseIcsDate(raw: string | undefined): Date | undefined {
  if (!raw) {
    return undefined;
  }
  const normalized = raw
    .replace(/;VALUE=DATE:/u, ":")
    .split(":")
    .at(-1)
    ?.trim();
  if (!normalized) {
    return undefined;
  }
  if (/^\d{8}$/u.test(normalized)) {
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6)) - 1;
    const day = Number(normalized.slice(6, 8));
    return new Date(Date.UTC(year, month, day));
  }
  if (/^\d{8}T\d{6}Z$/u.test(normalized)) {
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6)) - 1;
    const day = Number(normalized.slice(6, 8));
    const hour = Number(normalized.slice(9, 11));
    const minute = Number(normalized.slice(11, 13));
    const second = Number(normalized.slice(13, 15));
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  return safeDate(normalized) ?? undefined;
}

function compactProcessedHistory(processed: ProcessedIngestItem[]): ProcessedIngestItem[] {
  return processed.slice(-DEFAULT_HISTORY_LIMIT);
}

export class DataIngestService implements DataIngestServiceContract {
  private readonly stateService: StateService;

  private readonly classifier?: Pick<ClassifierServiceContract, "classify">;

  private readonly queueService?: { enqueue(item: StackQueueItem): Promise<void> };

  private readonly anthropic?: Anthropic;

  private readonly extractionModel: string;

  private readonly logger: Logger;

  private readonly config: DataIngestConfig;

  private readonly relevanceWindowMinutes: number;

  private readonly imapConfig: NormalizedImapConfig;

  private reconnectTimer: NodeJS.Timeout | null = null;

  public constructor(options: DataIngestServiceOptions) {
    this.stateService = options.state_service;
    this.classifier = options.classifier;
    this.queueService = options.queue_service;
    this.anthropic = options.anthropic_api_key
      ? new Anthropic({ apiKey: options.anthropic_api_key })
      : undefined;
    this.extractionModel = options.extraction_model ?? DEFAULT_EXTRACTION_MODEL;
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.config = options.config ?? runtimeSystemConfig.data_ingest;
    this.relevanceWindowMinutes =
      options.relevance_window_minutes ?? DEFAULT_RELEVANCE_WINDOW_MINUTES;
    this.imapConfig = {
      host: options.imap?.host ?? "",
      port: options.imap?.port ?? 993,
      user: options.imap?.user ?? "",
      password: options.imap?.password ?? "",
      mailbox: options.imap?.mailbox ?? "INBOX",
      secure: options.imap?.secure ?? true,
      reconnect_delay_ms: options.imap?.reconnect_delay_ms ?? DEFAULT_IMAP_RECONNECT_DELAY_MS,
    };
  }

  public async getIngestState(): Promise<DataIngestState> {
    const state = await this.stateService.getSystemState();
    return state.data_ingest_state;
  }

  public async updateIngestState(nextState: DataIngestState): Promise<void> {
    const state = await this.stateService.getSystemState();
    state.data_ingest_state = nextState;
    await this.stateService.saveSystemState(state);
  }

  public async produceIngestItems(reference_time: Date): Promise<StackQueueItem[]> {
    const ingestState = await this.getIngestState();
    ingestState.email_monitor.last_poll = reference_time;

    if (!this.isImapConfigured()) {
      ingestState.email_monitor.last_poll_result = "deferred_until_imap_credentials_are_configured";
      await this.updateIngestState(ingestState);
      return [];
    }

    const items: StackQueueItem[] = [];
    let client: ImapFlow | null = null;
    try {
      client = new ImapFlow({
        host: this.imapConfig.host,
        port: this.imapConfig.port,
        secure: this.imapConfig.secure,
        auth: { user: this.imapConfig.user, pass: this.imapConfig.password },
      });
      await client.connect();
      await client.mailboxOpen(this.imapConfig.mailbox);

      const lock = await client.getMailboxLock(this.imapConfig.mailbox);
      try {
        const unseenResult = await client.search({ seen: false });
        const unseen = Array.isArray(unseenResult) ? unseenResult : [];
        for await (const message of client.fetch(unseen, {
          uid: true,
          envelope: true,
          source: true,
          internalDate: true,
        })) {
          const envelope = message.envelope;
          const fromAddress = envelope?.from?.[0];
          const sourceText = Buffer.isBuffer(message.source)
            ? message.source.toString("utf8")
            : typeof message.source === "string"
              ? message.source
              : "";
          const parsedMime = parseMimeMessage(sourceText);
          const inboxMessage: InboxMessage = {
            message_id: String(message.uid),
            inbox_address: this.imapConfig.user,
            received_at:
              message.internalDate instanceof Date
                ? message.internalDate
                : new Date(message.internalDate ?? Date.now()),
            from: fromAddress?.address ?? fromAddress?.name ?? "unknown",
            subject: envelope?.subject ?? "Inbox update",
            text: parsedMime.text ?? sourceText.slice(0, 20_000),
            html: parsedMime.html ?? undefined,
            attachments: parsedMime.attachments,
            parse_confidence: parsedMime.parse_confidence,
            parse_warnings: parsedMime.parse_warnings,
          };
          const produced = await this.processInboxMessage(inboxMessage);
          items.push(...produced);
          await client.messageFlagsAdd(message.uid, ["\\Seen"]);
        }
      } finally {
        lock.release();
      }

      ingestState.email_monitor.last_poll_result =
        items.length > 0 ? `ok:${items.length}_items` : "ok:no_new_items";
    } catch (error: unknown) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        "IMAP poll during produceIngestItems failed.",
      );
      ingestState.email_monitor.last_poll_result = "poll_error";
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch {
          /* connection may already be closed */
        }
      }
    }

    await this.updateIngestState(ingestState);
    return items;
  }

  public async processForwardedContent(
    content: string,
    target_thread: string,
    created_at: Date,
  ): Promise<StackQueueItem> {
    const extracted = await this.extractPayload({
      origin: IngestOrigin.ForwardedContent,
      received_at: created_at,
      content,
      attachments: [],
    });
    const classification = await this.classifyEnvelope(
      {
        source: QueueItemSource.DataIngest,
        content,
        concerning: this.resolveThreadParticipants(target_thread),
        target_thread,
        created_at,
      },
      extracted,
    );
    const queueItem: StackQueueItem = {
      id: queueItemId("forwarded", String(created_at.getTime())),
      source: QueueItemSource.DataIngest,
      content,
      concerning: classification.concerning,
      target_thread,
      created_at,
      topic: classification.topic,
      intent: classification.intent,
      idempotency_key: `forwarded:${created_at.toISOString()}:${target_thread}`,
    };

    await this.recordProcessed("forwarded_messages", {
      source_id: "forwarded_messages",
      origin: IngestOrigin.ForwardedContent,
      received_at: created_at,
      processed_at: new Date(),
      queue_item_created: (queueItem as { id?: string }).id,
      topic_classified: classification.topic,
      status: "queued",
    });
    return queueItem;
  }

  public async processInboxMessage(message: InboxMessage): Promise<StackQueueItem[]> {
    const envelope: IngestEnvelope = {
      origin: IngestOrigin.Inbox,
      inbox_address: message.inbox_address,
      received_at: message.received_at,
      from: message.from,
      subject: message.subject,
      content: normalizeText(`${message.subject}\n\n${message.text ?? message.html ?? ""}`),
      attachments: message.attachments ?? [],
    };
    const extracted = await this.extractPayload(envelope);
    extracted.parse_confidence = message.parse_confidence ?? extracted.parse_confidence;
    extracted.parse_warnings = message.parse_warnings ?? extracted.parse_warnings;
    const attribution = this.resolveAttribution(message.inbox_address, extracted);
    const classification = await this.classifyEnvelope(
      {
        source: QueueItemSource.EmailMonitor,
        content: envelope.content,
        concerning: attribution.concerning,
        target_thread: attribution.target_thread,
        created_at: message.received_at,
      },
      extracted,
    );

    const baseEmailItem = this.buildEmailQueueItem(message, attribution, classification, extracted);
    const items: StackQueueItem[] = [baseEmailItem];

    for (const attachment of envelope.attachments) {
      if (!attachment.filename.toLowerCase().endsWith(".ics")) {
        continue;
      }
      const calendar = this.parseCalendarAttachment(attachment);
      if (!calendar) {
        continue;
      }
      items.push(this.buildCalendarQueueItem(calendar, message, attribution));
    }

    for (const item of items) {
      if (this.queueService) {
        await this.queueService.enqueue(item);
      }
    }

    await this.recordProcessed("email_monitor", {
      source_id: "email_monitor",
      origin: IngestOrigin.Inbox,
      from: message.from,
      subject: message.subject,
      content_type: "message/rfc822",
      received_at: message.received_at,
      processed_at: new Date(),
      queue_item_created: (baseEmailItem as { id?: string }).id,
      topic_classified: classification.topic,
      status: this.isStale(extracted, message.received_at, new Date()) ? "stored_silent" : "queued",
    });

    return items;
  }

  public async startMonitoring(): Promise<ImapFlow | null> {
    if (!this.isImapConfigured()) {
      this.logger.warn("IMAP monitoring deferred because credentials are not configured.");
      return null;
    }

    const client = new ImapFlow({
      host: this.imapConfig.host,
      port: this.imapConfig.port,
      secure: this.imapConfig.secure,
      auth: {
        user: this.imapConfig.user,
        pass: this.imapConfig.password,
      },
    });

    client.on("close", () => {
      this.logger.warn("IMAP connection closed; scheduling reconnect.");
      this.scheduleReconnect();
    });
    client.on("error", (error: unknown) => {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        "IMAP monitor error.",
      );
    });

    await client.connect();
    await client.mailboxOpen(this.imapConfig.mailbox);
    await this.pollMailbox(client);
    client.on("exists", () => {
      void this.pollMailbox(client);
    });
    this.logger.info({ mailbox: this.imapConfig.mailbox }, "IMAP monitor connected.");
    return client;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.startMonitoring();
    }, this.imapConfig.reconnect_delay_ms);
    this.reconnectTimer.unref();
  }

  private async pollMailbox(client: ImapFlow): Promise<void> {
    try {
      const lock = await client.getMailboxLock(this.imapConfig.mailbox);
      try {
        const unseenResult = await client.search({ seen: false });
        const unseen = Array.isArray(unseenResult) ? unseenResult : [];
        if (unseen.length === 0) {
          return;
        }
        for await (const message of client.fetch(unseen, {
          uid: true,
          envelope: true,
          source: true,
          internalDate: true,
        })) {
          const envelope = message.envelope;
          const fromAddress = envelope?.from?.[0];
          const sourceText = Buffer.isBuffer(message.source)
            ? message.source.toString("utf8")
            : typeof message.source === "string"
              ? message.source
              : "";
          const parsedMime = parseMimeMessage(sourceText);
          const inboxMessage: InboxMessage = {
            message_id: String(message.uid),
            inbox_address: this.imapConfig.user,
            received_at:
              message.internalDate instanceof Date
                ? message.internalDate
                : new Date(message.internalDate ?? Date.now()),
            from: fromAddress?.address ?? fromAddress?.name ?? "unknown",
            subject: envelope?.subject ?? "Inbox update",
            text: parsedMime.text ?? sourceText.slice(0, 20_000),
            html: parsedMime.html ?? undefined,
            attachments: parsedMime.attachments,
            parse_confidence: parsedMime.parse_confidence,
            parse_warnings: parsedMime.parse_warnings,
          };
          await this.processInboxMessage(inboxMessage);
          await client.messageFlagsAdd(message.uid, ["\\Seen"]);
        }
      } finally {
        lock.release();
      }
    } catch (error: unknown) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        "IMAP polling cycle failed.",
      );
    }
  }

  private isImapConfigured(): boolean {
    return (
      this.imapConfig.host.length > 0 &&
      this.imapConfig.user.length > 0 &&
      this.imapConfig.password.length > 0 &&
      this.imapConfig.host !== "imap.example.com" &&
      this.imapConfig.user !== "your_email@example.com"
    );
  }

  private async extractPayload(envelope: IngestEnvelope): Promise<ExtractedIngestPayload> {
    try {
      if (!this.anthropic) {
        return this.extractFallback(envelope);
      }

      const response = await this.anthropic.messages.create({
        model: this.extractionModel,
        max_tokens: 350,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: `Extract the relevant Family Command Center facts as JSON.\n\n${JSON.stringify(
              {
                origin: envelope.origin,
                from: envelope.from,
                subject: envelope.subject,
                content: envelope.content,
              },
            )}`,
          },
        ],
      });
      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Extraction response was empty.");
      }
      const raw = this.extractJson(textBlock.text);
      const parsed = JSON.parse(raw) as Partial<ExtractedIngestPayload>;
      return {
        summary: parsed.summary ?? envelope.subject ?? envelope.content.slice(0, 120),
        details: parsed.details ?? {},
        suggested_topic: parsed.suggested_topic,
        suggested_intent: parsed.suggested_intent,
        time_sensitive: parsed.time_sensitive ?? false,
        relevant_until: parsed.relevant_until ? new Date(parsed.relevant_until) : null,
        attributed_entity: parsed.attributed_entity ?? null,
        confidence: parsed.confidence,
        parse_confidence:
          typeof parsed.parse_confidence === "number" ? parsed.parse_confidence : undefined,
        parse_warnings: Array.isArray(parsed.parse_warnings)
          ? parsed.parse_warnings.filter(
              (warning): warning is string => typeof warning === "string",
            )
          : undefined,
      };
    } catch (error: unknown) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : String(error) },
        "Data ingest extraction fell back to heuristics.",
      );
      return this.extractFallback(envelope);
    }
  }

  private extractFallback(envelope: IngestEnvelope): ExtractedIngestPayload {
    const text = `${envelope.subject ?? ""}\n${envelope.content}`.toLowerCase();
    const suggested_topic = this.topicFromText(text);
    const relevantUntil = this.relevantUntilFromText(text, envelope.received_at);
    return {
      summary: envelope.subject ?? envelope.content.slice(0, 120),
      details: {
        from: envelope.from ?? "",
      },
      suggested_topic,
      suggested_intent:
        envelope.origin === IngestOrigin.ForwardedContent
          ? ClassifierIntent.ForwardedData
          : ClassifierIntent.Request,
      time_sensitive: relevantUntil !== null,
      relevant_until: relevantUntil,
      attributed_entity: null,
      confidence: 0.25,
      parse_confidence: 0.5,
      parse_warnings: ["fallback_extraction"],
    };
  }

  private async classifyEnvelope(
    baseItem: StackQueueItem,
    extracted: ExtractedIngestPayload,
  ): Promise<StackClassificationResult> {
    const preclassifiedTopic = this.toTopicKey(extracted.suggested_topic);
    const preclassifiedIntent = this.toIntent(extracted.suggested_intent);
    if (preclassifiedTopic) {
      return {
        topic: preclassifiedTopic,
        intent: preclassifiedIntent ?? ClassifierIntent.Request,
        concerning: baseItem.concerning,
        confidence: extracted.confidence ?? 0.3,
      };
    }

    if (this.classifier) {
      return this.classifier.classify(baseItem);
    }

    return {
      topic:
        this.toTopicKey(
          this.topicFromText(summarizeQueueContent(baseItem.content).toLowerCase()),
        ) ?? TopicKey.FamilyStatus,
      intent: preclassifiedIntent ?? ClassifierIntent.Request,
      concerning: baseItem.concerning,
      confidence: 0.2,
    };
  }

  private buildEmailQueueItem(
    message: InboxMessage,
    attribution: AttributedEntity,
    classification: StackClassificationResult,
    extracted: ExtractedIngestPayload,
  ): StackQueueItem {
    const item = {
      id: queueItemId("email", message.message_id),
      source: QueueItemSource.EmailMonitor,
      content: {
        from: message.from,
        subject: message.subject,
        extracted: {
          summary: extracted.summary,
          ...extracted.details,
          parse_confidence: String(extracted.parse_confidence ?? ""),
          parse_warnings: (extracted.parse_warnings ?? []).join(" | "),
        },
      },
      concerning: classification.concerning,
      target_thread: attribution.target_thread,
      created_at: message.received_at,
      topic: classification.topic,
      intent: classification.intent,
      idempotency_key: `email:${message.inbox_address}:${message.message_id}`,
      priority: this.isStale(extracted, message.received_at, new Date())
        ? DispatchPriority.Silent
        : DispatchPriority.Batched,
    } satisfies StackQueueItem & { priority: DispatchPriority };

    return item;
  }

  private buildCalendarQueueItem(
    calendar: ParsedCalendarAttachment,
    message: InboxMessage,
    attribution: AttributedEntity,
  ): StackQueueItem {
    return {
      id: queueItemId("calendar_email", calendar.uid ?? message.message_id),
      source: QueueItemSource.EmailMonitor,
      content: {
        from: message.from,
        subject: message.subject,
        extracted: {
          summary: calendar.summary,
          starts_at: calendar.starts_at?.toISOString() ?? "",
          ends_at: calendar.ends_at?.toISOString() ?? "",
          location: calendar.location ?? "",
        },
      },
      concerning: attribution.concerning,
      target_thread: attribution.target_thread,
      created_at: message.received_at,
      topic: TopicKey.Calendar,
      intent: ClassifierIntent.Request,
      idempotency_key: `ics:${calendar.uid ?? message.message_id}`,
    };
  }

  private parseCalendarAttachment(attachment: IngestAttachment): ParsedCalendarAttachment | null {
    const raw = decodeAttachmentContent(attachment);
    const unfolded = raw.replace(/\r\n[ \t]/gu, "");
    const lines = unfolded.split(/\r?\n/gu);
    const values = new Map<string, string>();
    for (const line of lines) {
      const [key, ...rest] = line.split(":");
      if (!key || rest.length === 0) {
        continue;
      }
      values.set(key, rest.join(":").trim());
    }

    const summary = values.get("SUMMARY");
    if (!summary) {
      return null;
    }

    return {
      uid: values.get("UID"),
      summary,
      starts_at: parseIcsDate(
        [...values.entries()].find(([key]) => key.startsWith("DTSTART"))?.join(":"),
      ),
      ends_at: parseIcsDate(
        [...values.entries()].find(([key]) => key.startsWith("DTEND"))?.join(":"),
      ),
      location: values.get("LOCATION"),
      organizer: values.get("ORGANIZER"),
      description: values.get("DESCRIPTION"),
    };
  }

  private resolveAttribution(
    inboxAddress: string,
    extracted: ExtractedIngestPayload,
  ): AttributedEntity {
    const emailConfig = this.config.sources.find(
      (source) => source.type === DataIngestSourceType.Email,
    );
    const bindings = emailConfig?.config?.monitored_inboxes ?? [];
    const matchedBinding = bindings.find((binding) => binding.address === inboxAddress);
    if (matchedBinding?.entity_id) {
      return {
        concerning: [matchedBinding.entity_id],
        target_thread: matchedBinding.default_thread_id ?? `${matchedBinding.entity_id}_private`,
      };
    }

    if (extracted.attributed_entity) {
      return {
        concerning: [extracted.attributed_entity],
        target_thread: `${extracted.attributed_entity}_private`,
      };
    }

    // Shared inbox fallback keeps the item visible without pretending we know the owner.
    const adults = runtimeSystemConfig.entities
      .filter((entity) => entity.type !== EntityType.Pet && entity.messaging_identity !== null)
      .map((entity) => entity.id);
    return {
      concerning: adults.slice(0, 2),
      target_thread: "family",
    };
  }

  private resolveThreadParticipants(threadId: string): string[] {
    const thread = runtimeSystemConfig.threads.find((candidate) => candidate.id === threadId);
    return thread?.participants ?? ["participant_1"];
  }

  private async recordProcessed(
    sourceKey: keyof DataIngestState,
    processedItem: ProcessedIngestItem,
  ): Promise<void> {
    const ingestState = await this.getIngestState();
    const bucket = ingestState[sourceKey];
    bucket.active = true;
    bucket.last_received = processedItem.received_at;
    bucket.last_poll = processedItem.processed_at;
    bucket.last_poll_result = processedItem.status ?? "processed";
    bucket.total_processed = (bucket.total_processed ?? 0) + 1;
    bucket.watermark = processedItem.received_at;
    bucket.processed = compactProcessedHistory([...bucket.processed, processedItem]);
    ingestState[sourceKey] = bucket;
    await this.updateIngestState(ingestState);
  }

  private isStale(
    extracted: ExtractedIngestPayload,
    receivedAt: Date,
    referenceTime: Date,
  ): boolean {
    if (extracted.relevant_until && extracted.relevant_until < referenceTime) {
      return true;
    }
    if (!extracted.time_sensitive) {
      return false;
    }
    return referenceTime.getTime() - receivedAt.getTime() > this.relevanceWindowMinutes * 60_000;
  }

  private topicFromText(text: string): string {
    if (text.includes("assignment") || text.includes("school") || text.includes("teacher")) {
      return TopicKey.School;
    }
    if (
      text.includes("appointment") ||
      text.includes("ical") ||
      text.includes("calendar") ||
      text.includes("meeting")
    ) {
      return TopicKey.Calendar;
    }
    if (text.includes("bill") || text.includes("payment") || text.includes("invoice")) {
      return TopicKey.Finances;
    }
    if (text.includes("travel") || text.includes("flight") || text.includes("hotel")) {
      return TopicKey.Travel;
    }
    if (text.includes("vet") || text.includes("pet")) {
      return TopicKey.Pets;
    }
    return TopicKey.FamilyStatus;
  }

  private relevantUntilFromText(text: string, receivedAt: Date): Date | null {
    if (text.includes("today") || text.includes("in 30 minutes") || text.includes("starts at")) {
      return new Date(receivedAt.getTime() + this.relevanceWindowMinutes * 60_000);
    }
    return null;
  }

  private toTopicKey(value: string | undefined): TopicKey | null {
    if (!value) {
      return null;
    }
    const matched = (Object.values(TopicKey) as string[]).find((topic) => topic === value);
    return (matched as TopicKey | undefined) ?? null;
  }

  private toIntent(value: string | undefined): ClassifierIntent | null {
    if (!value) {
      return null;
    }
    const matched = (Object.values(ClassifierIntent) as string[]).find(
      (intent) => intent === value,
    );
    return (matched as ClassifierIntent | undefined) ?? null;
  }

  private extractJson(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed;
    }
    const fenced = trimmed.match(/```json\s*([\s\S]*?)```/u);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }
    throw new Error("Claude extraction did not contain JSON.");
  }
}

export function createDataIngestService(options: DataIngestServiceOptions): DataIngestService {
  return new DataIngestService(options);
}
