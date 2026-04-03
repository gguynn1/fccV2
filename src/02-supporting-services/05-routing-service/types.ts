export enum ThreadType {
  Private = "private",
  Shared = "shared",
}

export interface Thread {
  id: string;
  type: ThreadType;
  participants: string[];
  description: string;
}

export interface ThreadMessage {
  id: string;
  from: string;
  content: string;
  at: Date;
  topic_context: string;
  dispatch_ref?: string;
  state_ref?: string;
  confirmation_ref?: string;
  escalation_ref?: string;
}

export interface ContextTransitionPolicy {
  switch_on_new_topic: boolean;
  idle_reset_minutes: number;
  explicit_switch_signals: string[];
}

export interface ThreadHistory {
  active_topic_context: string;
  last_activity: Date;
  recent_messages: ThreadMessage[];
}
