import type { SystemConfig } from "../index.js";
import { seedDailyRhythm, seedThreads } from "./__SRC/derivable-from-entities.js";
import { seedAssistant, seedEntities, seedSystem } from "./__SRC/must-collect.js";
import {
  seedConfirmationGates,
  seedDataIngest,
  seedDispatch,
  seedEscalationProfiles,
  seedInputRecognition,
  seedScenarioTesting,
  seedTopics,
  seedWorker,
} from "./__SRC/universal-defaults.js";

export const systemConfig: SystemConfig = {
  metadata: {
    snapshot_time: new Date("2026-04-02T17:05:00-07:00"),
    description:
      "Seed configuration — the complete static system definition used to populate the database on first boot. Defines all entities, threads, topic behavior profiles, dispatch rules, confirmation gates, input recognition and disambiguation rules, data ingest sources, daily rhythm, the 8-step worker processing sequence, and escalation profiles. This file is never modified at runtime. Schema changes must be reflected here to keep the seed valid and complete.",
  },

  system: seedSystem,
  assistant: seedAssistant,
  entities: seedEntities,
  threads: seedThreads,
  topics: seedTopics,
  dispatch: seedDispatch,
  confirmation_gates: seedConfirmationGates,
  input_recognition: seedInputRecognition,
  data_ingest: seedDataIngest,
  daily_rhythm: seedDailyRhythm,
  worker: seedWorker,
  escalation_profiles: seedEscalationProfiles,
  scenario_testing: seedScenarioTesting,
};
