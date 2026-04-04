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
    "Use context to disambiguate topic and intent.",
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
