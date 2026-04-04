import type { SystemConfig } from "../index.js";
import { seedDailyRhythm, seedThreads } from "./__SRC/derivable-from-entities.js";
import { seedEntities, seedSystem } from "./__SRC/must-collect.js";
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
  system: seedSystem,
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
