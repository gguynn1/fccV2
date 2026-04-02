import type { InputMethod } from "../../../types.js";

export enum ChoreStatus {
  Pending = "pending",
  Overdue = "overdue",
  Completed = "completed",
  Cancelled = "cancelled",
}

export enum ChoreEventType {
  Assigned = "assigned",
  ReminderSent = "reminder_sent",
  DeadlinePassed = "deadline_passed",
  FollowUpSent = "follow_up_sent",
  Completed = "completed",
  EscalatedToBroaderThread = "escalated_to_broader_thread",
  Cancelled = "cancelled",
}

export interface ChoreHistoryEntry {
  event: ChoreEventType;
  at: Date;
  thread?: string;
}

export interface ActiveChore {
  id: string;
  task: string;
  assigned_to: string;
  assigned_by: string;
  assigned_in_thread: string;
  due: Date;
  status: ChoreStatus;
  escalation_step: number;
  history?: ChoreHistoryEntry[];
}

export interface CompletedChore {
  id: string;
  task: string;
  assigned_to: string;
  completed_at: Date;
  completed_via: InputMethod;
  response: string;
}

export interface ChoresState {
  active: ActiveChore[];
  completed_recent: CompletedChore[];
}
