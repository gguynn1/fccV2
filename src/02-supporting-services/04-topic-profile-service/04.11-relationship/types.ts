export enum NudgeType {
  AppreciationPrompt = "appreciation_prompt",
  DateNightSuggestion = "date_night_suggestion",
  ConversationStarter = "conversation_starter",
  ConnectionPrompt = "connection_prompt",
  GratitudeExercise = "gratitude_exercise",
}

export interface RelationshipFrameworkGrounding {
  ifs: boolean;
  emotionally_focused: boolean;
  attachment_based: boolean;
}

export interface NudgeHistoryEntry {
  date: Date;
  type: NudgeType;
  responded: boolean;
  ignored?: boolean;
  content?: string;
}

export interface RelationshipQuietWindowState {
  is_busy_period: boolean;
  is_stressful_period: boolean;
}

export interface RelationshipState {
  last_nudge: {
    date: Date;
    thread: string;
    content: string;
    response_received: boolean;
    quiet_window_valid?: boolean;
  };
  next_nudge_eligible: Date;
  cooldown_days?: number;
  quiet_window?: RelationshipQuietWindowState;
  framework_grounding?: RelationshipFrameworkGrounding;
  nudge_history: NudgeHistoryEntry[];
}

export type RelationshipAction =
  | { type: "respond_to_nudge"; acknowledged: boolean }
  | { type: "dispatch_nudge"; nudge_type: NudgeType }
  | { type: "record_nudge_ignored"; ignored_at: Date }
  | { type: "set_quiet_window"; quiet_window: RelationshipQuietWindowState }
  | { type: "query_nudge_history"; nudge_type?: NudgeType };
