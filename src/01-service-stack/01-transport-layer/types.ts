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
