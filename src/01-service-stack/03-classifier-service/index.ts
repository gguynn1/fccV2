import { readFile } from "node:fs/promises";

import Anthropic from "@anthropic-ai/sdk";
import { pino, type Logger } from "pino";

import type { ThreadHistory } from "../../02-supporting-services/05-routing-service/types.js";
import type { StateService } from "../../02-supporting-services/types.js";
import { ClassifierIntent, QueueItemSource, TopicKey } from "../../types.js";
import type { StackClassificationResult, StackQueueItem } from "../types.js";
import {
  classifierSystemPrompt,
  classifierUserPrompt,
  topicScopedContentSystemPrompt,
} from "./prompts.js";
import {
  classificationResultSchema,
  type ClassifierContextMessage,
  type ClassifierInput,
  type ClassifierServiceOptions,
  topicScopedContentSchema,
} from "./types.js";

const DEFAULT_LOGGER = pino({ name: "classifier-service" });
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_CONTEXT_WINDOW_LIMIT = 12;
const SUPPORTED_IMAGE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const);

type SupportedImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export interface ClaudeClassifierOptions extends ClassifierServiceOptions {
  state_service: StateService;
  logger?: Logger;
}

export class ClaudeClassifierService {
  private readonly anthropic: Anthropic;

  private readonly logger: Logger;

  private readonly model: string;

  private readonly contextWindowLimit: number;

  private readonly stateService: StateService;

  public constructor(options: ClaudeClassifierOptions) {
    this.anthropic = new Anthropic({ apiKey: options.anthropic_api_key });
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.model = options.model ?? DEFAULT_MODEL;
    this.contextWindowLimit = options.context_window_limit ?? DEFAULT_CONTEXT_WINDOW_LIMIT;
    this.stateService = options.state_service;
  }

  public async classify(
    item: StackQueueItem,
    providedThreadHistory?: ThreadHistory | null,
  ): Promise<StackClassificationResult> {
    const content = typeof item.content === "string" ? item.content : JSON.stringify(item.content);
    const threadHistory =
      providedThreadHistory ?? (await this.stateService.getThreadHistory(item.target_thread));
    const recentMessages = (threadHistory?.recent_messages ?? [])
      .slice(-this.contextWindowLimit)
      .map<ClassifierContextMessage>((message) => ({
        from: message.from,
        content: message.content,
        at: message.at,
        topic_context: message.topic_context,
      }));

    const input: ClassifierInput = {
      content,
      thread_id: item.target_thread,
      concerning: item.concerning,
      recent_messages: recentMessages,
    };

    try {
      const userContent = await this.buildUserMessageContent(item, input);
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 350,
        temperature: 0,
        system: classifierSystemPrompt(),
        messages: [{ role: "user", content: userContent }],
      });
      const firstBlock = response.content.find((block) => block.type === "text");
      if (!firstBlock || firstBlock.type !== "text") {
        throw new Error("Classifier response did not include text content.");
      }

      const raw = this.extractJson(firstBlock.text);
      const parsed = classificationResultSchema.parse(JSON.parse(raw));
      const topic = this.toTopicKey(parsed.topic);
      const intent = this.toClassifierIntent(parsed.intent);
      return {
        topic,
        intent,
        concerning: this.deduplicateEntities(parsed.entities, item.concerning),
        confidence: parsed.confidence,
      };
    } catch (error: unknown) {
      const fallback = this.classifyFallback(input);
      this.logger.warn(
        {
          err: error instanceof Error ? error.message : String(error),
          fallback_topic: fallback.topic,
          fallback_intent: fallback.intent,
        },
        "Classifier API failed; fallback classification used.",
      );
      return fallback;
    }
  }

  public async extractTopicScopedContent(
    item: StackQueueItem,
    classification: StackClassificationResult,
    providedThreadHistory?: ThreadHistory | null,
  ): Promise<string | null> {
    const content = typeof item.content === "string" ? item.content : JSON.stringify(item.content);
    const threadHistory =
      providedThreadHistory ?? (await this.stateService.getThreadHistory(item.target_thread));
    const recentMessages = (threadHistory?.recent_messages ?? [])
      .slice(-this.contextWindowLimit)
      .map((message) => ({
        from: message.from,
        content: message.content,
        at: message.at.toISOString(),
        topic_context: message.topic_context ?? null,
      }));

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 220,
        temperature: 0,
        system: topicScopedContentSystemPrompt(),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                selected_topic: classification.topic,
                selected_intent: classification.intent,
                message: content,
                recent_messages: recentMessages,
              },
              null,
              2,
            ),
          },
        ],
      });
      const firstBlock = response.content.find((block) => block.type === "text");
      if (!firstBlock || firstBlock.type !== "text") {
        return null;
      }
      const raw = this.extractJson(firstBlock.text);
      const parsed = topicScopedContentSchema.parse(JSON.parse(raw));
      const scoped = parsed.scoped_content.trim();
      if (scoped.length === 0) {
        return null;
      }
      return scoped;
    } catch (error: unknown) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : String(error) },
        "Topic-scoped content extraction failed; continuing with original message.",
      );
      return null;
    }
  }

  private classifyFallback(input: ClassifierInput): StackClassificationResult {
    const text = input.content.toLowerCase();

    // Topic disambiguation is done before broad keyword matching to keep edge cases stable.
    if (this.matchesAny(text, ["dinner", "meal", "recipe", "cook"])) {
      return this.withIntent(TopicKey.Meals, text, input.concerning);
    }
    if (this.matchesAny(text, ["grocery", "shopping", "buy", "list"])) {
      return this.withIntent(TopicKey.Grocery, text, input.concerning);
    }
    if (this.matchesAny(text, ["plumber", "electrician", "vendor", "contractor"])) {
      return this.withIntent(TopicKey.Vendors, text, input.concerning);
    }
    if (this.matchesAny(text, ["maintenance", "oil change", "filter", "due"])) {
      return this.withIntent(TopicKey.Maintenance, text, input.concerning);
    }
    if (this.matchesAny(text, ["client", "lead", "booking", "inquiry"])) {
      return this.withIntent(TopicKey.Business, text, input.concerning);
    }
    if (this.matchesAny(text, ["appointment", "schedule", "calendar", "reschedule"])) {
      return this.withIntent(TopicKey.Calendar, text, input.concerning);
    }

    const activeTopic = input.recent_messages.at(-1)?.topic_context;
    const topic = this.toTopicKey(activeTopic ?? TopicKey.FamilyStatus);
    return this.withIntent(topic, text, input.concerning);
  }

  private withIntent(
    topic: TopicKey,
    text: string,
    concerning: string[],
    confidence = 0.35,
  ): StackClassificationResult {
    const intent = this.resolveIntent(text);
    return { topic, intent, concerning, confidence };
  }

  private resolveIntent(text: string): ClassifierIntent {
    if (this.matchesAny(text, ["cancel", "remove", "never mind"])) {
      return ClassifierIntent.Cancellation;
    }
    if (this.matchesAny(text, ["done", "completed", "finished"])) {
      return ClassifierIntent.Completion;
    }
    if (this.matchesAny(text, ["what", "when", "which", "status", "?"])) {
      return ClassifierIntent.Query;
    }
    if (this.matchesAny(text, ["move", "change", "update", "reschedule"])) {
      return ClassifierIntent.Update;
    }
    if (this.matchesAny(text, ["yes", "no", "approve", "decline"])) {
      return ClassifierIntent.Confirmation;
    }
    if (this.matchesAny(text, ["forwarded", "fwd:"])) {
      return ClassifierIntent.ForwardedData;
    }
    return ClassifierIntent.Request;
  }

  private matchesAny(content: string, keywords: string[]): boolean {
    return keywords.some((keyword) => content.includes(keyword));
  }

  private deduplicateEntities(entities: string[], fallback: string[]): string[] {
    const combined = entities.length > 0 ? entities : fallback;
    return [...new Set(combined)];
  }

  private toTopicKey(value: string): TopicKey {
    const candidates = Object.values(TopicKey) as string[];
    return candidates.includes(value) ? (value as TopicKey) : TopicKey.FamilyStatus;
  }

  private toClassifierIntent(value: string): ClassifierIntent {
    const candidates = Object.values(ClassifierIntent) as string[];
    return candidates.includes(value) ? (value as ClassifierIntent) : ClassifierIntent.Request;
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
    throw new Error("Classifier response did not contain JSON.");
  }

  private async buildUserMessageContent(
    item: StackQueueItem,
    input: ClassifierInput,
  ): Promise<
    | string
    | Array<
        | { type: "text"; text: string }
        | {
            type: "image";
            source: {
              type: "base64";
              media_type: SupportedImageMediaType;
              data: string;
            };
          }
      >
  > {
    const prompt = classifierUserPrompt(input);
    if (item.source !== QueueItemSource.ImageAttachment || typeof item.content === "string") {
      return prompt;
    }

    const attachments = this.extractAttachmentCandidates(item.content);
    if (attachments.length === 0) {
      return prompt;
    }

    const contentBlocks: Array<
      | { type: "text"; text: string }
      | {
          type: "image";
          source: {
            type: "base64";
            media_type: SupportedImageMediaType;
            data: string;
          };
        }
    > = [{ type: "text", text: prompt }];

    for (const attachment of attachments) {
      if (!SUPPORTED_IMAGE_MEDIA_TYPES.has(attachment.mime_type)) {
        continue;
      }
      try {
        const bytes = await readFile(attachment.local_path);
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: attachment.mime_type,
            data: bytes.toString("base64"),
          },
        });
      } catch (error: unknown) {
        this.logger.warn(
          {
            path: attachment.local_path,
            mime_type: attachment.mime_type,
            err: error instanceof Error ? error.message : String(error),
          },
          "Classifier could not read image attachment; continuing with text-only context.",
        );
      }
    }

    return contentBlocks.length > 1 ? contentBlocks : prompt;
  }

  private extractAttachmentCandidates(
    content: StackQueueItem["content"],
  ): Array<{ mime_type: SupportedImageMediaType; local_path: string }> {
    if (!content || typeof content !== "object" || Array.isArray(content)) {
      return [];
    }
    const candidate = content as { attachments?: unknown };
    if (!Array.isArray(candidate.attachments)) {
      return [];
    }
    return candidate.attachments.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return [];
      }
      const value = entry as { mime_type?: unknown; local_path?: unknown };
      if (typeof value.mime_type !== "string" || typeof value.local_path !== "string") {
        return [];
      }
      if (!SUPPORTED_IMAGE_MEDIA_TYPES.has(value.mime_type as SupportedImageMediaType)) {
        return [];
      }
      return [
        {
          mime_type: value.mime_type as SupportedImageMediaType,
          local_path: value.local_path,
        },
      ];
    });
  }
}

export function createClassifierService(options: ClaudeClassifierOptions): ClaudeClassifierService {
  return new ClaudeClassifierService(options);
}
