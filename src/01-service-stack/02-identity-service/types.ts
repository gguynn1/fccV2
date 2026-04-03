import { z } from "zod";

import { EntityType } from "../../types.js";

export { EntityType };

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

export interface IdentityResolutionResult {
  entity_id: string;
  entity_type: EntityType;
  permissions: Permission[];
  thread_id: string;
  thread_memberships: string[];
}

export const petProfileSchema = z.object({
  species: z.string().min(1),
  breed: z.string().nullable(),
  vet: z.string().nullable(),
  medications: z.array(z.string()),
  care_schedule: z.array(z.string()),
});

export const digestScheduleSchema = z.object({
  morning: z.string().min(1),
  evening: z.string().nullable(),
});

export const entitySchema = z
  .object({
    id: z.string().min(1),
    type: z.nativeEnum(EntityType),
    name: z.string().min(1),
    messaging_identity: z.string().nullable(),
    permissions: z.array(z.nativeEnum(Permission)),
    digest: digestScheduleSchema.optional(),
    profile: petProfileSchema.optional(),
    routes_to: z.array(z.string()).optional(),
  })
  .superRefine((entity, context) => {
    if (entity.type === EntityType.Pet && entity.messaging_identity !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pet entities must not have a messaging identity.",
        path: ["messaging_identity"],
      });
    }

    if (entity.type !== EntityType.Pet && entity.messaging_identity === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Adult and child entities must have a messaging identity.",
        path: ["messaging_identity"],
      });
    }
  });

export const entitiesSchema = z.array(entitySchema);
