export enum NudgeType {
  AppreciationPrompt = "appreciation_prompt",
  DateNightSuggestion = "date_night_suggestion",
  ConversationStarter = "conversation_starter",
  ConnectionPrompt = "connection_prompt",
  GratitudeExercise = "gratitude_exercise",
}

export interface NudgeHistoryEntry {
  date: Date;
  type: NudgeType;
  responded: boolean;
}

export interface RelationshipState {
  last_nudge: {
    date: Date;
    thread: string;
    content: string;
    response_received: boolean;
  };
  next_nudge_eligible: Date;
  nudge_history: NudgeHistoryEntry[];
}

export type RelationshipAction =
  | { type: "respond_to_nudge"; acknowledged: boolean }
  | { type: "query_nudge_history"; nudge_type?: NudgeType };
