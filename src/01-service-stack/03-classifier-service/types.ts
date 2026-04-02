import type { EscalationLevel, GrocerySection, TopicKey } from "../../types.js";

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
  follow_up_quiet_period?: string;
  on_ignored?: string;
  minimum_gap_between_nudges?: string;
  status_expiry?: string;
  grocery_linking?: boolean;
}
