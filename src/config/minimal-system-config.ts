import type { SystemConfig } from "../index.js";
import {
  defaultConfirmationGates,
  defaultDataIngest,
  defaultDispatch,
  defaultEscalationProfiles,
  defaultInputRecognition,
  defaultTopics,
  defaultWorker,
} from "./default-system-config.js";

export function createMinimalSystemConfig(): SystemConfig {
  return {
    system: {
      timezone: "America/Chicago",
      locale: "en-US",
      is_onboarded: false,
    },
    entities: [],
    threads: [],
    topics: structuredClone(defaultTopics),
    escalation_profiles: structuredClone(defaultEscalationProfiles),
    confirmation_gates: structuredClone(defaultConfirmationGates),
    dispatch: structuredClone(defaultDispatch),
    input_recognition: structuredClone(defaultInputRecognition),
    daily_rhythm: {
      morning_digest: { times: {} },
      evening_checkin: { times: {} },
      default_state: "quiet",
      digest_eligibility: {
        exclude_already_dispatched: true,
        exclude_stale: true,
        staleness_threshold_hours: 24,
        suppress_repeats_from_previous_digest: true,
        include_unresolved_from_yesterday: true,
      },
    },
    worker: structuredClone(defaultWorker),
    data_ingest: structuredClone(defaultDataIngest),
    scenario_testing: {
      parts: [],
    },
  };
}
