import type { InputRecognition } from "./01-service-stack/01-transport-layer/types.js";
import type { Entity } from "./01-service-stack/02-identity-service/types.js";
import type { TopicConfig } from "./01-service-stack/03-classifier-service/types.js";
import type { WorkerConfig } from "./01-service-stack/05-worker/types.js";
import type { DispatchConfig } from "./01-service-stack/06-action-router/types.js";
import type { DailyRhythm } from "./02-supporting-services/01-scheduler-service/types.js";
import type { DataIngestConfig } from "./02-supporting-services/02-data-ingest-service/types.js";
import type { SystemState as StateSnapshot } from "./02-supporting-services/03-state-service/types.js";
import type { Thread } from "./02-supporting-services/05-routing-service/types.js";
import type { EscalationProfile } from "./02-supporting-services/07-escalation-service/types.js";
import type { ConfirmationGates } from "./02-supporting-services/08-confirmation-service/types.js";
import type { EscalationLevel, TopicKey } from "./types.js";

export {
  ClarificationReason,
  ClassifierIntent,
  EscalationLevel,
  GrocerySection,
  InputMethod,
  TopicKey,
} from "./types.js";
export * from "./01-service-stack/types.js";
export * from "./02-supporting-services/types.js";

export interface ScenarioTesting {
  description: string;
  parts: string[];
}

export interface SystemConfig {
  metadata: {
    snapshot_time: Date;
    description: string;
  };
  system: {
    timezone: string;
    locale: string;
    version: string;
  };
  assistant: {
    messaging_identity: string;
    name: string | null;
    description: string;
  };
  entities: Entity[];
  threads: Thread[];
  topics: Record<TopicKey, TopicConfig>;
  dispatch: DispatchConfig;
  confirmation_gates: ConfirmationGates;
  input_recognition: InputRecognition;
  data_ingest: DataIngestConfig;
  daily_rhythm: DailyRhythm;
  worker: WorkerConfig;
  escalation_profiles: Record<EscalationLevel, EscalationProfile>;
  scenario_testing: ScenarioTesting;
}

export type SystemState = StateSnapshot;
