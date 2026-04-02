import type { EscalationLevel } from "../../02-supporting-services/07-escalation-service/types.js";
import type { GrocerySection } from "../../02-supporting-services/04-topic-profile-service/04.04-grocery/types.js";

export enum TopicKey {
  Calendar = "calendar",
  Chores = "chores",
  Finances = "finances",
  Grocery = "grocery",
  Health = "health",
  Pets = "pets",
  School = "school",
  Travel = "travel",
  Vendors = "vendors",
  Photography = "photography",
  Relationship = "relationship",
  FamilyStatus = "family_status",
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
  follow_up_quiet_period?: string;
  on_ignored?: string;
  minimum_gap_between_nudges?: string;
  status_expiry?: string;
}
