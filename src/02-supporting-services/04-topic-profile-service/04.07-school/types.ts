import type { InputMethod } from "../../../types.js";

export enum AssignmentStatus {
  NotStarted = "not_started",
  InProgress = "in_progress",
  Completed = "completed",
  Late = "late",
}

export enum SchoolInputSource {
  Conversation = "conversation",
  EmailParsing = "email_parsing",
}

export enum SchoolEscalationStage {
  Reminder = "reminder",
  FollowUp = "follow_up",
  ParentEscalation = "parent_escalation",
}

export interface Assignment {
  id: string;
  title: string;
  student_entity?: string;
  parent_entity?: string;
  due_date: Date;
  status: AssignmentStatus;
  source: SchoolInputSource;
  parent_notified: boolean;
  escalation_stage?: SchoolEscalationStage | null;
}

export interface CompletedAssignment {
  title: string;
  completed_at: Date;
  completed_via: InputMethod;
}

export interface StudentRecord {
  entity: string;
  parent_entity?: string;
  assignments: Assignment[];
  completed_recent: CompletedAssignment[];
}

export interface SchoolCommunication {
  id: string;
  student_entity: string;
  from: string;
  received_at: Date;
  summary: string;
  action_needed: boolean;
  source: SchoolInputSource;
}

export interface SchoolState {
  students: StudentRecord[];
  communications?: SchoolCommunication[];
}

export type SchoolAction =
  | {
      type: "add_assignment";
      entity: string;
      parent_entity: string;
      title: string;
      due_date: Date;
      source: SchoolInputSource;
    }
  | { type: "complete_assignment"; assignment_id: string }
  | { type: "record_school_communication"; communication: SchoolCommunication }
  | { type: "escalate_assignment_to_parent"; assignment_id: string; parent_entity: string }
  | { type: "query_school"; entity?: string; status?: AssignmentStatus };
