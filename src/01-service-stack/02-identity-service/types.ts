export enum EntityType {
  Adult = "adult",
  Child = "child",
  Pet = "pet",
}

export enum Permission {
  ApproveFinancial = "approve_financial",
  ApproveSends = "approve_sends",
  ModifySystem = "modify_system",
  AssignTasks = "assign_tasks",
  ViewAllTopics = "view_all_topics",
  CompleteTasks = "complete_tasks",
  AddItems = "add_items",
  AskQuestions = "ask_questions",
}

export interface PetProfile {
  species: string;
  breed: string | null;
  vet: string | null;
  medications: string[];
  care_schedule: string[];
}

export interface DigestSchedule {
  morning: string;
  evening: string | null;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  messaging_identity: string | null;
  permissions: Permission[];
  digest?: DigestSchedule;
  profile?: PetProfile;
  routes_to?: string[];
}
