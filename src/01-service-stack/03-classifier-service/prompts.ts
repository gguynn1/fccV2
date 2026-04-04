import { ClassifierIntent, TopicKey } from "../../types.js";
import type { ClassifierInput } from "./types.js";

const TOPIC_VALUES = Object.values(TopicKey);
const INTENT_VALUES = Object.values(ClassifierIntent);

export function classifierSystemPrompt(): string {
  return [
    "You are the classifier for Family Command Center.",
    "Return only strict JSON with keys: topic, intent, entities, confidence.",
    `topic must be one of: ${TOPIC_VALUES.join(", ")}.`,
    `intent must be one of: ${INTENT_VALUES.join(", ")}.`,
    "entities must be system ids such as participant_1, participant_2, participant_3, pet_1.",
    "Use context (recent_messages) to disambiguate topic and intent.",
    "",
    "Reference resolution rules:",
    '- When the message uses pronouns or deictic references ("that", "it", "this", "the one", "them"), resolve the referent from recent_messages.',
    '- "cancel that", "move it", "change it" after a topic-specific message => same topic as the referenced message, with the appropriate intent.',
    '- "actually" or "no, not that" followed by a correction => same topic as prior turn, intent=update or the corrected intent.',
    '- Short affirmatives ("yes", "yeah", "sure", "ok") after an assistant question => intent=confirmation or response, same topic as the question context.',
    '- Short answers ("the dentist", "Tuesday", "the laundry") after an assistant question => intent=response, same topic as the question context.',
    "- When no topic keywords are present but recent_messages show an active topic, carry forward that topic if the message is clearly a continuation.",
    "- When the message explicitly introduces new topic keywords, switch to the new topic regardless of history.",
    "",
    "Disambiguation rules:",
    "- meals vs grocery: meal planning/recipes/dinner decisions => meals; item list/shopping => grocery.",
    "- maintenance vs vendors: recurring upkeep/interval tracking => maintenance; hiring/scheduling provider => vendors.",
    "- maintenance vs chores: recurring upkeep => maintenance; one-off household duty => chores.",
    "- business vs vendors: own client/leads pipeline => business; hiring a provider => vendors.",
    "- cancellation vs completion: future item => cancellation; already happened => completion.",
    "- request vs update: new item => request; change existing item => update.",
    "- cancellation vs update: remove entirely => cancellation; keep but modify => update.",
    "- query vs request: ask about existing state => query; ask to create/do => request.",
  ].join("\n");
}

export function classifierUserPrompt(input: ClassifierInput): string {
  const recent = input.recent_messages.map((message) => ({
    from: message.from,
    content: message.content,
    at: message.at.toISOString(),
    topic_context: message.topic_context ?? null,
  }));

  return JSON.stringify(
    {
      thread_id: input.thread_id,
      concerning: input.concerning,
      message: input.content,
      recent_messages: recent,
    },
    null,
    2,
  );
}

export function topicScopedContentSystemPrompt(): string {
  return [
    "You extract only the clause relevant to one already-selected topic and intent.",
    "Return strict JSON only with keys: scoped_content, mixed_intent.",
    "scoped_content must keep original wording relevant to the selected topic/intent.",
    "Remove unrelated clauses from other domains (e.g., grocery vs finances).",
    "If message is not mixed-intent, return the original message as scoped_content and mixed_intent=false.",
  ].join("\n");
}

export function topicMessageComposerSystemPrompt(): string {
  return [
    "You compose concise phone-native assistant replies for a family operations assistant.",
    "Keep one coherent assistant identity with no persona name.",
    "Follow the topic behavior profile closely (tone, format, initiative style, framework grounding).",
    "Respect thread context and avoid over-alerting language.",
    "Do not invent facts. Preserve concrete details from the source message.",
    "When conversation_plan is provided, prioritize unresolved_references and commitments_to_track.",
    "Apply reply_strategy and style_notes to shape phrasing while staying concise.",
    "Return strict JSON with one key: composed_message.",
    "composed_message must be a plain string, 1-4 short lines, no markdown.",
  ].join("\n");
}

export function topicConversationPlannerSystemPrompt(): string {
  return [
    "You are a conversational planner for a phone-native family assistant.",
    "Plan the next assistant reply using thread continuity and unresolved references.",
    "Return strict JSON only with keys:",
    "carryover_context, unresolved_references, commitments_to_track, reply_strategy, style_notes.",
    "Keep each array concise and machine-usable.",
    "Do not invent facts beyond provided context.",
  ].join("\n");
}

export function actionInterpreterSystemPrompt(): string {
  return [
    "You are the action interpreter for Family Command Center.",
    "Convert one participant message into one structured action payload.",
    "Return strict JSON only.",
    "Use exactly one of these envelopes:",
    '- Resolved: {"kind":"resolved","topic":"...","intent":"...","action":{"type":"...", ...}}',
    '- Clarification: {"kind":"clarification_required","clarification":{...}}',
    "If required action fields are missing, return clarification_required with a direct question.",
    "Never invent ids that were not provided in context.",
    "Keep action fields concise and machine-parseable.",
  ].join("\n");
}
