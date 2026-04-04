import { pino, type Logger } from "pino";
import { z } from "zod";

import type {
  StackClassificationResult,
  StackQueueItem,
  WorkerDecision,
} from "../../01-service-stack/types.js";
import { ClassifierIntent, EscalationLevel, TopicKey } from "../../types.js";
import type { ThreadHistory } from "../05-routing-service/types.js";
import { CALENDAR_TOPIC_PROFILE } from "./04.01-calendar/profile.js";
import { CHORES_TOPIC_PROFILE } from "./04.02-chores/profile.js";
import { FINANCES_TOPIC_PROFILE } from "./04.03-finances/profile.js";
import { GROCERY_TOPIC_PROFILE } from "./04.04-grocery/profile.js";
import { HEALTH_TOPIC_PROFILE } from "./04.05-health/profile.js";
import { PETS_TOPIC_PROFILE } from "./04.06-pets/profile.js";
import { SCHOOL_TOPIC_PROFILE } from "./04.07-school/profile.js";
import { TRAVEL_TOPIC_PROFILE } from "./04.08-travel/profile.js";
import { VENDORS_TOPIC_PROFILE } from "./04.09-vendors/profile.js";
import { BUSINESS_TOPIC_PROFILE } from "./04.10-business/profile.js";
import { RELATIONSHIP_TOPIC_PROFILE } from "./04.11-relationship/profile.js";
import { FAMILY_STATUS_TOPIC_PROFILE } from "./04.12-family-status/profile.js";
import { MEALS_TOPIC_PROFILE } from "./04.13-meals/profile.js";
import { MAINTENANCE_TOPIC_PROFILE } from "./04.14-maintenance/profile.js";
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

const TOPIC_PROFILES: TopicProfileConfig = {
  [TopicKey.Calendar]: CALENDAR_TOPIC_PROFILE,
  [TopicKey.Chores]: CHORES_TOPIC_PROFILE,
  [TopicKey.Finances]: FINANCES_TOPIC_PROFILE,
  [TopicKey.Grocery]: GROCERY_TOPIC_PROFILE,
  [TopicKey.Health]: HEALTH_TOPIC_PROFILE,
  [TopicKey.Pets]: PETS_TOPIC_PROFILE,
  [TopicKey.School]: SCHOOL_TOPIC_PROFILE,
  [TopicKey.Travel]: TRAVEL_TOPIC_PROFILE,
  [TopicKey.Vendors]: VENDORS_TOPIC_PROFILE,
  [TopicKey.Business]: BUSINESS_TOPIC_PROFILE,
  [TopicKey.Relationship]: RELATIONSHIP_TOPIC_PROFILE,
  [TopicKey.FamilyStatus]: FAMILY_STATUS_TOPIC_PROFILE,
  [TopicKey.Meals]: MEALS_TOPIC_PROFILE,
  [TopicKey.Maintenance]: MAINTENANCE_TOPIC_PROFILE,
};

export interface TopicProfileServiceOptions {
  config?: TopicProfileConfig;
  logger?: Logger;
}

export class StaticTopicProfileService {
  private readonly logger: Logger;

  private readonly config: TopicProfileConfig;

  public constructor(options?: TopicProfileServiceOptions) {
    this.logger = options?.logger ?? DEFAULT_LOGGER;
    this.config = topicConfigSchema.parse(options?.config ?? TOPIC_PROFILES);
    this.logger.info({ topics: Object.keys(this.config).length }, "Topic profiles loaded.");
  }

  public getProfile(topic: TopicKey): TopicProfile {
    const profile = this.config[topic];
    if (!profile) {
      throw new Error(`No topic profile configured for ${topic}`);
    }
    return profile;
  }

  public getAllProfiles(): TopicProfileConfig {
    return this.config;
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
    const profile = this.config[topic];
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
