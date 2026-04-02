export enum WorkerAction {
  ClassifyTopic = "classify_topic",
  IdentifyEntities = "identify_entities",
  DetermineActionType = "determine_action_type",
  CheckOutboundBudget = "check_outbound_budget",
  CheckEscalation = "check_escalation",
  CheckConfirmation = "check_confirmation",
  ApplyBehaviorProfile = "apply_behavior_profile",
  RouteAndDispatch = "route_and_dispatch",
}

export enum WorkerService {
  Classifier = "classifier",
  Identity = "identity",
  Budget = "budget",
  Escalation = "escalation",
  Confirmation = "confirmation",
  TopicProfile = "topic_profile",
  Routing = "routing",
}

export interface WorkerStep {
  step: number;
  action: WorkerAction;
  service?: WorkerService;
  description: string;
}

export interface WorkerConfig {
  processing_sequence: WorkerStep[];
}
