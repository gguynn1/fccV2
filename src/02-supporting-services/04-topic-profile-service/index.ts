import { pino, type Logger } from "pino";
import { z } from "zod";

import type {
  StackClassificationResult,
  StackQueueItem,
  WorkerDecision,
} from "../../01-service-stack/types.js";
import { runtimeSystemConfig } from "../../config/runtime-system-config.js";
import type { TopicConfigMap } from "../../index.js";
import { ClassifierIntent, EscalationLevel, TopicKey } from "../../types.js";
import type { ThreadHistory } from "../05-routing-service/types.js";
import type { TopicProfile, TopicProfileConfig } from "./types.js";

const DEFAULT_LOGGER = pino({ name: "topic-profile-service" });

const topicProfileSchema = z.object({
  tone: z.string().min(1),
  format: z.string().min(1),
  initiative_style: z.string().min(1),
  escalation_level: z.nativeEnum(EscalationLevel),
  framework_grounding: z.string().nullable(),
  response_format: z.string().min(1),
  cross_topic_connections: z.array(z.nativeEnum(TopicKey)),
});

const topicConfigSchema = z.record(z.nativeEnum(TopicKey), topicProfileSchema);

type ToneBucket = "warm" | "direct" | "factual";

function classifyToneBucket(tone: string): ToneBucket {
  const normalized = tone.toLowerCase();
  if (
    normalized.includes("warm") ||
    normalized.includes("gentle") ||
    normalized.includes("supportive")
  ) {
    return "warm";
  }
  if (
    normalized.includes("factual") ||
    normalized.includes("calm") ||
    normalized.includes("precise") ||
    normalized.includes("attentive")
  ) {
    return "factual";
  }
  return "direct";
}

const TONE_TEMPLATES: Record<string, Record<ToneBucket, string>> = {
  query: {
    warm: "Let me look into that for you.",
    direct: "Checking now.",
    factual: "Got it. I will check and share an update.",
  },
  cancellation: {
    warm: "No problem, I have canceled that for you.",
    direct: "Canceled.",
    factual: "Okay, that has been canceled.",
  },
  completion: {
    warm: "Nice work, marked that as done!",
    direct: "Done.",
    factual: "Great, marked complete.",
  },
  confirmation: {
    warm: "Thanks for confirming.",
    direct: "Confirmed.",
    factual: "Understood, confirmed.",
  },
  request: {
    warm: "On it! I will take care of that.",
    direct: "Got it.",
    factual: "Got it. I will take care of that.",
  },
};

function firstBehaviorValue(
  behavior: Record<string, string>,
  candidates: string[],
  fallback: string,
): string {
  for (const key of candidates) {
    const value = behavior[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return fallback;
}

function toTopicProfileConfig(topics: TopicConfigMap): TopicProfileConfig {
  const profileEntries = Object.values(TopicKey).map((topic) => {
    const config = topics[topic];
    const behavior = config?.behavior ?? {};
    const crossTopicConnections =
      "cross_topic_connections" in config && Array.isArray(config.cross_topic_connections)
        ? config.cross_topic_connections
        : [];
    const profile: TopicProfile = {
      tone: firstBehaviorValue(
        behavior,
        ["tone", "tone_internal", "tone_to_student", "tone_to_parent"],
        "direct",
      ),
      format: firstBehaviorValue(behavior, ["format"], "brief"),
      initiative_style: firstBehaviorValue(behavior, ["initiative"], "minimal"),
      escalation_level: config?.escalation ?? EscalationLevel.None,
      framework_grounding:
        "framework" in behavior && typeof behavior.framework === "string"
          ? behavior.framework
          : null,
      response_format: firstBehaviorValue(behavior, ["format"], "plain"),
      cross_topic_connections: crossTopicConnections,
    };
    return [topic, profile] as const;
  });
  return topicConfigSchema.parse(Object.fromEntries(profileEntries));
}

export interface TopicProfileServiceOptions {
  config?: TopicProfileConfig;
  logger?: Logger;
}

export class StaticTopicProfileService {
  private readonly logger: Logger;

  private readonly staticConfig?: TopicProfileConfig;

  public constructor(options?: TopicProfileServiceOptions) {
    this.logger = options?.logger ?? DEFAULT_LOGGER;
    this.staticConfig = options?.config ? topicConfigSchema.parse(options.config) : undefined;
    const activeConfig = this.getAllProfiles();
    this.logger.info({ topics: Object.keys(activeConfig).length }, "Topic profiles loaded.");
  }

  public getProfile(topic: TopicKey): TopicProfile {
    const profile = this.getAllProfiles()[topic];
    if (!profile) {
      throw new Error(`No topic profile configured for ${topic}`);
    }
    return profile;
  }

  public getAllProfiles(): TopicProfileConfig {
    if (this.staticConfig) {
      return this.staticConfig;
    }
    return toTopicProfileConfig(runtimeSystemConfig.topics);
  }

  public getTopicConfig(topic: TopicKey): Promise<TopicProfile> {
    return Promise.resolve(this.getProfile(topic));
  }

  public classifyFallback(
    queue_item: StackQueueItem,
    thread_history: ThreadHistory | null,
  ): Promise<StackClassificationResult> {
    const topic = this.toTopicFromThread(thread_history);
    return Promise.resolve({
      topic,
      intent: queue_item.intent ?? ClassifierIntent.Request,
      concerning: queue_item.concerning,
      confidence: 0.2,
    });
  }

  public composeMessage(decision: WorkerDecision): Promise<string> {
    const topic = decision.classification.topic;
    const intent = decision.classification.intent;
    const content = this.readContentText(decision.queue_item.content);
    const profile = this.getAllProfiles()[topic];
    const toneBucket = profile ? classifyToneBucket(profile.tone) : "direct";

    if (topic === TopicKey.Grocery) {
      if (intent === ClassifierIntent.Query) {
        return Promise.resolve("Here is your grocery list right now.");
      }
      if (intent === ClassifierIntent.Cancellation) {
        return Promise.resolve("Removed from the grocery list.");
      }
      return Promise.resolve(`Added to the grocery list: ${content}`);
    }

    if (intent === ClassifierIntent.Query) {
      return Promise.resolve(TONE_TEMPLATES.query[toneBucket]);
    }
    if (intent === ClassifierIntent.Cancellation) {
      return Promise.resolve(TONE_TEMPLATES.cancellation[toneBucket]);
    }
    if (intent === ClassifierIntent.Completion) {
      return Promise.resolve(TONE_TEMPLATES.completion[toneBucket]);
    }
    if (intent === ClassifierIntent.Confirmation) {
      return Promise.resolve(TONE_TEMPLATES.confirmation[toneBucket]);
    }
    return Promise.resolve(TONE_TEMPLATES.request[toneBucket]);
  }

  private readContentText(content: StackQueueItem["content"]): string {
    if (typeof content === "string") {
      return content.trim();
    }
    if (typeof content === "object" && content !== null) {
      if ("summary" in content && typeof content.summary === "string") {
        return content.summary.trim();
      }
    }
    return "your request";
  }

  private toTopicFromThread(threadHistory: ThreadHistory | null): TopicKey {
    const topicFromHistory = threadHistory?.active_topic_context;
    const found = Object.values(TopicKey).find((topic) => topic === topicFromHistory);
    return found ?? TopicKey.FamilyStatus;
  }
}

export function createTopicProfileService(
  options?: TopicProfileServiceOptions,
): StaticTopicProfileService {
  return new StaticTopicProfileService(options);
}
