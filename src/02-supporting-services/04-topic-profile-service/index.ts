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
  [TopicKey.Calendar]: {
    tone: "precise and logistical",
    format: "structured confirmation with date, time, location, and participants",
    initiative_style: "event-driven reminders before events and follow-ups after",
    escalation_level: EscalationLevel.Medium,
    framework_grounding: null,
    response_format: "confirmation blocks and concise updates",
    cross_topic_connections: [TopicKey.Health, TopicKey.School, TopicKey.Travel, TopicKey.Business],
  },
  [TopicKey.Chores]: {
    tone: "direct and operational",
    format: "clear task ownership and deadline",
    initiative_style: "structured reminders with follow-up and escalation",
    escalation_level: EscalationLevel.High,
    framework_grounding: null,
    response_format: "assignment confirmations and completion checks",
    cross_topic_connections: [],
  },
  [TopicKey.Finances]: {
    tone: "calm and factual",
    format: "numbered snapshots with due dates",
    initiative_style: "deadline-driven alerts and milestone updates",
    escalation_level: EscalationLevel.High,
    framework_grounding: null,
    response_format: "concise financial snapshots",
    cross_topic_connections: [],
  },
  [TopicKey.Grocery]: {
    tone: "utilitarian and brief",
    format: "organized list by section",
    initiative_style: "low initiative unless asked",
    escalation_level: EscalationLevel.None,
    framework_grounding: null,
    response_format: "list output with short acknowledgments",
    cross_topic_connections: [TopicKey.Meals],
  },
  [TopicKey.Health]: {
    tone: "attentive and specific",
    format: "structured notes for visits, medication, and follow-up",
    initiative_style: "care-driven reminders and follow-up",
    escalation_level: EscalationLevel.Medium,
    framework_grounding: null,
    response_format: "appointment-focused summaries",
    cross_topic_connections: [TopicKey.Calendar],
  },
  [TopicKey.Pets]: {
    tone: "warm and practical",
    format: "care summaries and checklists",
    initiative_style: "gentle periodic reminders",
    escalation_level: EscalationLevel.Low,
    framework_grounding: null,
    response_format: "caretaker-style summaries",
    cross_topic_connections: [TopicKey.Calendar, TopicKey.Vendors],
  },
  [TopicKey.School]: {
    tone: "organized and encouraging",
    format: "deadline lists and concise status updates",
    initiative_style: "deadline-driven reminders with parent awareness",
    escalation_level: EscalationLevel.Medium,
    framework_grounding: null,
    response_format: "student and parent specific summaries",
    cross_topic_connections: [TopicKey.Calendar],
  },
  [TopicKey.Travel]: {
    tone: "organized and anticipatory",
    format: "checklists and timeline snapshots",
    initiative_style: "countdown-based trip preparation",
    escalation_level: EscalationLevel.Medium,
    framework_grounding: null,
    response_format: "trip briefs and prep checkpoints",
    cross_topic_connections: [
      TopicKey.Calendar,
      TopicKey.Pets,
      TopicKey.Finances,
      TopicKey.Grocery,
    ],
  },
  [TopicKey.Vendors]: {
    tone: "businesslike",
    format: "records with status and follow-up",
    initiative_style: "follow-up driven when no response",
    escalation_level: EscalationLevel.None,
    framework_grounding: null,
    response_format: "service-provider records",
    cross_topic_connections: [TopicKey.Finances, TopicKey.Maintenance],
  },
  [TopicKey.Business]: {
    tone: "professional and organized",
    format: "pipeline snapshots and draft-ready replies",
    initiative_style: "pipeline reminders and booking follow-up",
    escalation_level: EscalationLevel.None,
    framework_grounding: null,
    response_format: "lead pipeline summaries",
    cross_topic_connections: [TopicKey.Finances, TopicKey.Calendar],
  },
  [TopicKey.Relationship]: {
    tone: "warm and non-clinical",
    format: "open-ended prompts and gentle suggestions",
    initiative_style: "soft nudges that are easy to ignore",
    escalation_level: EscalationLevel.Low,
    framework_grounding:
      "Internal Family Systems Therapy, emotionally focused approaches, and attachment-based practices",
    response_format: "short prompts and reflection starters",
    cross_topic_connections: [],
  },
  [TopicKey.FamilyStatus]: {
    tone: "brief and functional",
    format: "current-state snapshots",
    initiative_style: "minimal and timing-aware",
    escalation_level: EscalationLevel.Low,
    framework_grounding: null,
    response_format: "quick status readbacks",
    cross_topic_connections: [],
  },
  [TopicKey.Meals]: {
    tone: "collaborative and practical",
    format: "meal plan options and linked grocery impact",
    initiative_style: "moderate suggestions around planning windows",
    escalation_level: EscalationLevel.None,
    framework_grounding: null,
    response_format: "options and simple plans",
    cross_topic_connections: [TopicKey.Grocery, TopicKey.Health],
  },
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
