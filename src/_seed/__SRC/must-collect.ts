import { EntityType, Permission, type SystemConfig } from "../../index.js";

export const seedSystem: SystemConfig["system"] = {
  timezone: "America/Denver",
  locale: "en-US",
  version: "0.1.0",
  is_onboarded: true,
};

export const seedAssistant: SystemConfig["assistant"] = {
  messaging_identity: "+15551000000",
  name: null,
  description:
    "Family Command Center assistant. No name. One messaging identity. Identified as a contact in each family member's phone.",
};

export const seedEntities: SystemConfig["entities"] = [
  {
    id: "participant_1",
    type: EntityType.Adult,
    name: "PARTICIPANT 1",
    messaging_identity: "+15551000001",
    permissions: [
      Permission.ApproveFinancial,
      Permission.ApproveSends,
      Permission.ModifySystem,
      Permission.AssignTasks,
      Permission.ViewAllTopics,
    ],
    digest: {
      morning: "07:00",
      evening: "20:00",
    },
  },
  {
    id: "participant_2",
    type: EntityType.Adult,
    name: "PARTICIPANT 2",
    messaging_identity: "+15551000002",
    permissions: [
      Permission.ApproveFinancial,
      Permission.ApproveSends,
      Permission.ModifySystem,
      Permission.AssignTasks,
      Permission.ViewAllTopics,
    ],
    digest: {
      morning: "07:00",
      evening: "20:00",
    },
  },
  {
    id: "participant_3",
    type: EntityType.Child,
    name: "PARTICIPANT 3",
    messaging_identity: "+15551000003",
    permissions: [Permission.CompleteTasks, Permission.AddItems, Permission.AskQuestions],
    digest: {
      morning: "07:30",
      evening: null,
    },
  },
  {
    id: "pet_1",
    type: EntityType.Pet,
    name: "PET",
    messaging_identity: null,
    permissions: [],
    profile: {
      species: "dog",
      breed: null,
      vet: null,
      medications: [],
      care_schedule: [],
    },
    routes_to: ["participant_1", "participant_2"],
  },
];
