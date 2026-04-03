import type { InputMethod } from "../../../types.js";

export enum AssignmentStatus {
  NotStarted = "not_started",
  InProgress = "in_progress",
  Completed = "completed",
  Late = "late",
}

export interface Assignment {
  id: string;
  title: string;
  due_date: Date;
  status: AssignmentStatus;
  source: string;
  parent_notified: boolean;
}

export interface CompletedAssignment {
  title: string;
  completed_at: Date;
  completed_via: InputMethod;
}

export interface StudentRecord {
  entity: string;
  assignments: Assignment[];
  completed_recent: CompletedAssignment[];
}

export interface SchoolState {
  students: StudentRecord[];
}

export type SchoolAction =
  | { type: "add_assignment"; entity: string; title: string; due_date: Date; source: string }
  | { type: "complete_assignment"; assignment_id: string }
  | { type: "query_school"; entity?: string; status?: AssignmentStatus };
