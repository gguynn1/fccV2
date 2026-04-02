import type { InputMethod } from "../../../types.js";

export enum AssignmentStatus {
  NotStarted = "not_started",
  InProgress = "in_progress",
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
