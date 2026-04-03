import { z } from "zod";

import type { EscalationLevel, GrocerySection, TopicKey, ClassifierIntent } from "../../types.js";

export interface ClassificationResult {
  topic: TopicKey;
  intent: ClassifierIntent;
  entities: string[];
  confidence?: number;
}

export interface ClassifierContextMessage {
  from: string;
  content: string;
  at: Date;
  topic_context?: string;
}

export interface ClassifierInput {
  content: string;
  thread_id: string;
  concerning: string[];
  recent_messages: ClassifierContextMessage[];
}

export interface TopicRouting {
  [key: string]: string | boolean | string[];
}

export interface TopicBehavior {
  [key: string]: string;
}

export interface TopicConfig {
  label: string;
  description: string;
  routing: TopicRouting;
  behavior: TopicBehavior;
  escalation: EscalationLevel;
  proactive?: Record<string, string | boolean>;
  escalation_ladder?: Record<string, string | boolean | null>;
  confirmation_required?: boolean;
  sections?: GrocerySection[];
  cross_topic_connections?: TopicKey[];
  confirmation_required_for_sends?: boolean;
  follow_up_quiet_period_days?: number;
  on_ignored?: string;
  minimum_gap_between_nudges?: string;
  status_expiry?: string;
  grocery_linking?: boolean;
}

export const classificationResultSchema = z.object({
  topic: z.string().min(1),
  intent: z.string().min(1),
  entities: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export interface ClassifierServiceOptions {
  anthropic_api_key: string;
  model?: string;
  context_window_limit?: number;
}
