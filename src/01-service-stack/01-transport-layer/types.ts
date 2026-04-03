import { z } from "zod";

import type { QueueItemSource } from "../04-queue/types.js";

export enum TransportInputKind {
  Text = "text",
  StructuredChoice = "structured_choice",
  Reaction = "reaction",
  Image = "image",
  ForwardedContent = "forwarded_content",
  Silence = "silence",
}

export enum ReactionSentiment {
  Positive = "positive",
  Negative = "negative",
}

export interface TransportAttachment {
  id: string;
  mime_type: string;
  local_path: string;
  remote_url: string;
}

interface BaseTransportInboundInput {
  kind: TransportInputKind;
  provider_message_id: string;
  source_identity: string;
  thread_id: string;
  concerning: string[];
  received_at: Date;
  source: QueueItemSource;
}

export interface TextTransportInboundInput extends BaseTransportInboundInput {
  kind: TransportInputKind.Text;
  content: string;
}

export interface StructuredChoiceTransportInboundInput extends BaseTransportInboundInput {
  kind: TransportInputKind.StructuredChoice;
  content: string;
}

export interface ReactionTransportInboundInput extends BaseTransportInboundInput {
  kind: TransportInputKind.Reaction;
  content: string;
  reaction: ReactionSentiment;
}

export interface ImageTransportInboundInput extends BaseTransportInboundInput {
  kind: TransportInputKind.Image;
  content: string;
  attachments: TransportAttachment[];
}

export interface ForwardedTransportInboundInput extends BaseTransportInboundInput {
  kind: TransportInputKind.ForwardedContent;
  content: string;
}

export interface SilenceTransportInboundInput extends BaseTransportInboundInput {
  kind: TransportInputKind.Silence;
  content: "";
}

export type TransportInboundInput =
  | TextTransportInboundInput
  | StructuredChoiceTransportInboundInput
  | ReactionTransportInboundInput
  | ImageTransportInboundInput
  | ForwardedTransportInboundInput
  | SilenceTransportInboundInput;

export interface TransportOutboundMessage {
  id: string;
  target_thread: string;
  content: string;
  concerning: string[];
  created_at: Date;
}

export enum DeliveryStatusType {
  Queued = "queued",
  Sent = "sent",
  Delivered = "delivered",
  Failed = "failed",
  Undelivered = "undelivered",
}

export interface DeliveryStatusUpdate {
  provider_message_id: string;
  status: DeliveryStatusType;
  thread_id: string;
  participant_id: string;
  at: Date;
  error_code?: string;
  error_message?: string;
}

export const twilioInboundPayloadSchema = z.object({
  MessageSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  Body: z.string().optional().default(""),
  NumMedia: z
    .string()
    .optional()
    .default("0")
    .transform((value) => Number.parseInt(value, 10))
    .pipe(z.number().int().nonnegative()),
});

export const twilioStatusPayloadSchema = z.object({
  MessageSid: z.string().min(1),
  MessageStatus: z.string().min(1),
  To: z.string().min(1),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
});

export interface ThreadParticipantMap {
  thread_id: string;
  participants: string[];
}

export interface TopicDisambiguationRule {
  close_topics: string[];
  guidance: string;
}

export interface IntentDisambiguationRule {
  close_intents: string[];
  guidance: string;
}

export interface InputRecognition {
  text: { description: string };
  structured_choice: { description: string; formats: string[] };
  reaction: { positive: string; negative: string };
  image: { description: string; examples: Record<string, string> };
  forwarded_content: { description: string };
  silence: {
    high_accountability: string;
    low_accountability: string;
    never: string;
  };
  topic_disambiguation: {
    description: string;
    rules: TopicDisambiguationRule[];
  };
  intent_disambiguation: {
    description: string;
    rules: IntentDisambiguationRule[];
  };
}
