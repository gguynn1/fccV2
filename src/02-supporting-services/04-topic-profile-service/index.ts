import { pino, type Logger } from "pino";
import { z } from "zod";

import { ClassifierIntent, EscalationLevel, TopicKey } from "../../types.js";
import type { TopicProfileConfig, TopicProfile } from "./types.js";
import type {
  StackClassificationResult,
  StackQueueItem,
  WorkerDecision,
} from "../../01-service-stack/types.js";
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
  [TopicKey.Maintenance]: {
    tone: "practical and reminder-driven",
    format: "service schedules and history logs",
    initiative_style: "cycle-based reminders for due items",
    escalation_level: EscalationLevel.Low,
    framework_grounding: null,
    response_format: "maintenance schedule snapshots",
    cross_topic_connections: [TopicKey.Vendors, TopicKey.Finances, TopicKey.Calendar],
  },
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
    const profile = this.getProfile(decision.classification.topic);
    const content =
      typeof decision.queue_item.content === "string"
        ? decision.queue_item.content
        : JSON.stringify(decision.queue_item.content);
    return Promise.resolve(`[${profile.tone}] ${content}`);
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
