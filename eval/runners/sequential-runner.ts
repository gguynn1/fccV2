import { writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { createWorker } from "../../src/01-service-stack/05-worker/index.js";
import type {
  ActionRouterResult,
  StackClassificationResult,
  StackQueueItem,
  TransportOutboundEnvelope,
} from "../../src/01-service-stack/types.js";
import { createStateService } from "../../src/02-supporting-services/03-state-service/index.js";
import { createTopicProfileService } from "../../src/02-supporting-services/04-topic-profile-service/index.js";
import { createRoutingService } from "../../src/02-supporting-services/05-routing-service/index.js";
import { createMinimalSystemState } from "../../src/config/minimal-system-config.js";
import { loadEnv } from "../../src/env.js";
import {
  ClassifierIntent,
  DispatchPriority,
  QueueItemSource,
  TopicKey,
  type SystemConfig,
  type SystemState,
} from "../../src/index.js";
import { ensureEvalWorkspace } from "../lib/paths.js";
import { writeRunArtifacts } from "../reporting/write-run-artifacts.js";
import { getScenarioSet } from "../scenarios/index.js";
import { generateCandidatePrompt } from "../tuner/correct.js";
import { diagnoseScenarioFailures, toDeferredTunerOutcome } from "../tuner/diagnose.js";
import type {
  EvalRunState,
  EvalRunSummary,
  EvalScenarioActual,
  EvalScenarioDefinition,
  EvalScenarioExpectation,
  EvalScenarioFailure,
  EvalScenarioLogEvent,
  EvalScenarioResult,
  EvalScenarioSimulation,
  EvalTurn,
  EvalTurnResult,
} from "../types.js";

export interface RunSequentialEvalOptions {
  repo_root: string;
  run_id: string;
  scenario_set: string;
  step_delay_ms?: number;
  mode?: "simulator" | "worker" | "fixture-interpreter";
}

function pause(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function loadEvalSystemConfig(repoRoot: string): Promise<SystemConfig> {
  const env = loadEnv(process.env as Record<string, string | undefined>);
  const stateService = createStateService(resolve(repoRoot, env.DATABASE_PATH));
  try {
    return await stateService.getSystemConfig();
  } finally {
    stateService.close();
  }
}

function buildSummary(scenarios: EvalScenarioResult[]): EvalRunSummary {
  return {
    total: scenarios.length,
    queued: scenarios.filter((scenario) => scenario.status === "queued").length,
    running: scenarios.filter((scenario) => scenario.status === "running").length,
    passed: scenarios.filter((scenario) => scenario.status === "passed").length,
    prompt_fix_suggested: scenarios.filter((scenario) => scenario.status === "prompt_fix_suggested")
      .length,
    investigation_needed: scenarios.filter((scenario) => scenario.status === "investigation_needed")
      .length,
    failed: scenarios.filter((scenario) => scenario.status === "failed").length,
    regressed: scenarios.filter((scenario) => scenario.status === "regressed").length,
  };
}

interface SimulatedThreadContext {
  recent_messages: Array<{
    role: "participant" | "assistant";
    message: string;
    topic: TopicKey | null;
  }>;
  active_topic_context: TopicKey | null;
  pending_clarification: boolean;
}

const DEICTIC_PATTERNS =
  /^(that|it|this|those|these|the one|cancel that|move that|change that|actually|no|yes|yeah|yep|nah|nope|ok|okay|sure|right|correct|the \w+)\b/i;
const SHORT_MESSAGE_WORD_LIMIT = 12;

function isDeicticOrShort(message: string): boolean {
  const trimmed = message.trim();
  if (DEICTIC_PATTERNS.test(trimmed)) {
    return true;
  }
  return trimmed.split(/\s+/).length <= SHORT_MESSAGE_WORD_LIMIT;
}

function isSimulatedDigestRequest(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    /\b(digest|summary|recap|highlights|overview|snapshot)\b/u.test(normalized) &&
    /\b(today|tonight|this\s+day|this\s+week|right\s+now|now)\b/u.test(normalized)
  );
}

function inferTopicByKeywords(message: string): TopicKey | null {
  const normalized = message.toLowerCase();

  if (isSimulatedDigestRequest(message)) {
    return TopicKey.FamilyStatus;
  }
  if (
    normalized.includes("running late") ||
    normalized.includes("on my way") ||
    normalized.includes("eta")
  ) {
    return TopicKey.FamilyStatus;
  }
  if (
    normalized.includes("bill") ||
    normalized.includes("expense") ||
    normalized.includes("budget")
  ) {
    return TopicKey.Finances;
  }
  if (
    normalized.includes("portrait inquiry") ||
    normalized.includes("wedding inquiry") ||
    normalized.includes("client") ||
    normalized.includes("draft a reply") ||
    (normalized.includes("draft") && normalized.includes("inquiry"))
  ) {
    return TopicKey.Business;
  }
  if (normalized.includes("plumber") || normalized.includes("electrician")) {
    return TopicKey.Vendors;
  }
  if (
    normalized.includes("homework") ||
    normalized.includes("school") ||
    normalized.includes("field trip") ||
    normalized.includes("report card") ||
    normalized.includes("pickup from school")
  ) {
    return TopicKey.School;
  }
  if (
    normalized.includes("doctor") ||
    normalized.includes("dentist") ||
    normalized.includes("prescription") ||
    normalized.includes("checkup") ||
    normalized.includes("physical")
  ) {
    return TopicKey.Health;
  }
  if (
    normalized.includes("vet") ||
    normalized.includes("pet") ||
    normalized.includes("walk the dog") ||
    normalized.includes("kibble") ||
    normalized.includes("pet food")
  ) {
    return TopicKey.Pets;
  }
  if (
    normalized.includes("flight") ||
    normalized.includes("hotel") ||
    normalized.includes("luggage") ||
    normalized.includes("trip") ||
    normalized.includes("pack for the trip") ||
    normalized.includes("travel")
  ) {
    return TopicKey.Travel;
  }
  if (
    normalized.includes("date night") ||
    normalized.includes("anniversary") ||
    normalized.includes("couple reminder") ||
    normalized.includes("couple reminders") ||
    normalized.includes("couples")
  ) {
    return TopicKey.Relationship;
  }
  if (
    normalized.includes("oil change") ||
    normalized.includes("air filter") ||
    normalized.includes("furnace") ||
    normalized.includes("gutter") ||
    normalized.includes("roof repair")
  ) {
    return TopicKey.Maintenance;
  }
  if (
    normalized.includes("chore") ||
    normalized.includes("clean") ||
    normalized.includes("take out the trash") ||
    normalized.includes("tidy") ||
    normalized.includes("vacuum")
  ) {
    return TopicKey.Chores;
  }
  if (
    normalized.includes("dinner") ||
    normalized.includes("recipe") ||
    normalized.includes("meal") ||
    normalized.includes("what should we eat")
  ) {
    return TopicKey.Meals;
  }
  if (
    normalized.includes("ground beef") ||
    normalized.includes("milk") ||
    normalized.includes("grocery") ||
    normalized.startsWith("we need") ||
    (normalized.startsWith("add ") && normalized.includes("to the list"))
  ) {
    return TopicKey.Grocery;
  }
  if (
    normalized.includes("calendar") ||
    normalized.includes("schedule") ||
    normalized.startsWith("do we have anything")
  ) {
    return TopicKey.Calendar;
  }

  return null;
}

function inferTopic(message: string, context?: SimulatedThreadContext): TopicKey {
  const keywordMatch = inferTopicByKeywords(message);
  if (keywordMatch !== null) {
    return keywordMatch;
  }

  if (context?.active_topic_context && isDeicticOrShort(message)) {
    return context.active_topic_context;
  }

  return TopicKey.FamilyStatus;
}

function inferIntent(message: string, context?: SimulatedThreadContext): ClassifierIntent {
  const normalized = message.toLowerCase().trim();

  if (context?.pending_clarification) {
    const affirmatives = /^(yes|yeah|yep|sure|ok|okay|correct|right|do it|go ahead|confirmed?)\b/i;
    if (affirmatives.test(normalized)) {
      return ClassifierIntent.Confirmation;
    }
    if (normalized.includes("cancel")) {
      return ClassifierIntent.Cancellation;
    }
    return ClassifierIntent.Response;
  }

  if (
    normalized.startsWith("what") ||
    normalized.startsWith("when") ||
    normalized.startsWith("how") ||
    normalized.startsWith("any") ||
    normalized.startsWith("do we")
  ) {
    return ClassifierIntent.Query;
  }
  if (normalized.includes("cancel") || normalized.startsWith("never mind")) {
    return ClassifierIntent.Cancellation;
  }
  if (
    normalized.includes("can come") ||
    normalized.includes("moved to") ||
    normalized.includes("reschedule") ||
    normalized.includes(" is due ") ||
    normalized.includes(" is confirmed ") ||
    normalized.includes(" is ready ") ||
    normalized.startsWith("replace ") ||
    normalized.startsWith("actually") ||
    normalized.startsWith("change ") ||
    normalized.startsWith("move ")
  ) {
    return ClassifierIntent.Update;
  }

  return ClassifierIntent.Request;
}

function parseDefaultThreadHint(
  defaultHint: unknown,
  concerning: string[],
  originThread: string,
): string | null {
  if (typeof defaultHint !== "string") {
    return null;
  }
  const normalized = defaultHint.toLowerCase();
  if (normalized.includes("private thread") && concerning.length > 0) {
    return `${concerning[0]}_private`;
  }
  if (defaultHint === "family" || defaultHint === "couple") {
    return defaultHint;
  }
  if (defaultHint.endsWith("_private")) {
    return defaultHint;
  }
  if (defaultHint === "same thread as request") {
    return originThread;
  }
  return null;
}

function inferTargetThread(
  topic: TopicKey,
  input: EvalScenarioDefinition["prompt_input"],
  config: SystemConfig,
  intent: ClassifierIntent,
): string {
  if (intent === ClassifierIntent.Query || intent === ClassifierIntent.Response) {
    return input.origin_thread;
  }
  if (input.origin_thread.endsWith("_private")) {
    return input.origin_thread;
  }

  const topicConfig = config.topics[topic];
  const defaultHint = parseDefaultThreadHint(
    topicConfig?.routing?.default,
    input.concerning,
    input.origin_thread,
  );
  const neverThreads = Array.isArray(topicConfig?.routing?.never) ? topicConfig.routing.never : [];
  if (defaultHint && !neverThreads.includes(defaultHint)) {
    return defaultHint;
  }

  switch (topic) {
    case TopicKey.Finances:
    case TopicKey.Relationship:
    case TopicKey.Travel:
      return "couple";
    case TopicKey.Business:
      return "participant_2_private";
    case TopicKey.Health:
    case TopicKey.Maintenance:
    case TopicKey.Vendors:
      return `${input.concerning[0] ?? "participant_1"}_private`;
    case TopicKey.Pets:
      return input.origin_thread === "family"
        ? "family"
        : `${input.concerning[0] ?? "participant_1"}_private`;
    case TopicKey.School:
    case TopicKey.Chores:
      return `${input.concerning[0] ?? "participant_3"}_private`;
    default:
      return input.origin_thread;
  }
}

function inferPriority(
  topic: TopicKey,
  intent: ClassifierIntent,
  config: SystemConfig,
): DispatchPriority {
  if (intent === ClassifierIntent.Query) {
    return DispatchPriority.Immediate;
  }
  if (intent === ClassifierIntent.Response || intent === ClassifierIntent.Confirmation) {
    return DispatchPriority.Immediate;
  }

  const escalation = config.topics[topic]?.escalation;
  if (escalation === "none") {
    return DispatchPriority.Batched;
  }

  switch (topic) {
    case TopicKey.Finances:
    case TopicKey.Calendar:
    case TopicKey.Business:
    case TopicKey.Health:
    case TopicKey.School:
    case TopicKey.Meals:
    case TopicKey.Grocery:
    case TopicKey.Relationship:
    case TopicKey.Pets:
    case TopicKey.Travel:
    case TopicKey.FamilyStatus:
      return DispatchPriority.Immediate;
    case TopicKey.Vendors:
    case TopicKey.Maintenance:
    case TopicKey.Chores:
      return DispatchPriority.Batched;
    default:
      return DispatchPriority.Immediate;
  }
}

function inferConfirmation(config: SystemConfig, topic: TopicKey): boolean {
  const confirmationTopics = new Set<TopicKey>([TopicKey.Finances]);
  const alwaysRequireApproval = config.confirmation_gates.always_require_approval.length > 0;
  const topicConfig = config.topics[topic];

  if (
    topicConfig &&
    ("confirmation_required" in topicConfig || "confirmation_required_for_sends" in topicConfig)
  ) {
    return (
      ("confirmation_required" in topicConfig && topicConfig.confirmation_required === true) ||
      ("confirmation_required_for_sends" in topicConfig &&
        topicConfig.confirmation_required_for_sends === true)
    );
  }

  return alwaysRequireApproval && confirmationTopics.has(topic);
}

function extractTimingPhrase(message: string): string {
  const normalized = message.toLowerCase();
  const weekday = normalized.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  )?.[1];
  const dayPart = normalized.match(/\b(morning|afternoon|evening|tonight)\b/)?.[1];

  if (weekday && dayPart) {
    return `${weekday} ${dayPart}`;
  }
  if (weekday) {
    return weekday;
  }

  return "the requested time";
}

function composeMessage(topic: TopicKey, input: EvalScenarioDefinition["prompt_input"]): string {
  const timing = extractTimingPhrase(input.message);

  if (topic === TopicKey.FamilyStatus && isSimulatedDigestRequest(input.message)) {
    return [
      "Today",
      "- Morning meeting at 9am",
      "- Chore: take out the trash",
      "",
      "Pending",
      "- 3 grocery item(s) on the list",
    ].join("\n");
  }

  switch (topic) {
    case TopicKey.Calendar:
      return `Schedule summary: ${timing} activity from "${input.message}" is ready to review.`;
    case TopicKey.Grocery:
      return `Grocery list update: added items from "${input.message}" as a shared list.`;
    case TopicKey.Finances:
      return `Approval needed: confirm the bill action before anything is sent.`;
    case TopicKey.Business:
      return `Warm client draft reply prepared for the latest inquiry.`;
    case TopicKey.Vendors:
      return `Vendor record update: the service visit is noted for ${timing}.`;
    case TopicKey.School:
      return `School summary: "${input.message}" has been noted for ${timing}.`;
    case TopicKey.Health:
      return `Health record update: the appointment from "${input.message}" is logged.`;
    case TopicKey.Meals:
      return `Meal plan: dinner idea from "${input.message}" added to the meal list.`;
    case TopicKey.Chores:
      return `Chore assigned: "${input.message}" added to the task list.`;
    case TopicKey.Maintenance:
      return `Maintenance record: "${input.message}" logged for ${timing}.`;
    case TopicKey.Pets:
      return `Pet care update: "${input.message}" has been recorded.`;
    case TopicKey.Travel:
      return `Travel note: "${input.message}" added to the trip plan.`;
    case TopicKey.Relationship:
      return `Couple reminder: "${input.message}" is on the calendar.`;
    default:
      return `Status update recorded for "${input.message}".`;
  }
}

function composeMessageWithTopicConfig(
  topic: TopicKey,
  input: EvalScenarioDefinition["prompt_input"],
  config: SystemConfig,
): string {
  const base = composeMessage(topic, input);
  const behavior = config.topics[topic]?.behavior ?? {};
  const tone =
    (behavior.tone as string | undefined) ??
    (behavior.tone_internal as string | undefined) ??
    "direct";
  const format = (behavior.format as string | undefined) ?? "brief";
  return `${base}\nTone: ${tone}\nFormat: ${format}`;
}

function evaluateScenario(
  scenario: EvalScenarioDefinition,
  config: SystemConfig,
): EvalScenarioActual {
  const inferredTopic = inferTopic(scenario.prompt_input.message);
  const inferredIntent = inferIntent(scenario.prompt_input.message);

  const baseActual: EvalScenarioActual = {
    topic: inferredTopic,
    intent: inferredIntent,
    target_thread: inferTargetThread(inferredTopic, scenario.prompt_input, config, inferredIntent),
    priority: inferPriority(inferredTopic, inferredIntent, config),
    confirmation_required: inferConfirmation(config, inferredTopic),
    composed_message: composeMessageWithTopicConfig(inferredTopic, scenario.prompt_input, config),
  };

  return {
    ...baseActual,
    ...scenario.simulation?.actual_overrides,
  };
}

function createWorkerReplayHarness(config: SystemConfig): {
  evaluate: (
    scenario: EvalScenarioDefinition,
    options?: { interpreter_fixture?: EvalScenarioSimulation["interpreter_fixture"] },
  ) => Promise<EvalScenarioActual>;
} {
  const state: SystemState = createMinimalSystemState(new Date());
  const transportCalls: TransportOutboundEnvelope[] = [];
  const threadHistory = new Map<string, Awaited<SystemState["threads"][string]>>();
  const stateService = {
    getSystemConfig: async () => config,
    saveSystemConfig: async () => undefined,
    getSystemState: async () => state,
    saveSystemState: async (nextState: SystemState) => {
      Object.assign(state, nextState);
    },
    getThreadHistory: async (threadId: string) => threadHistory.get(threadId) ?? null,
    saveThreadHistory: async (
      threadId: string,
      history: NonNullable<Awaited<SystemState["threads"][string]>>,
    ) => {
      threadHistory.set(threadId, history);
    },
    appendDispatchResult: async (_queueItem: StackQueueItem, _action: ActionRouterResult) =>
      undefined,
  };

  let activeInterpreterFixture: EvalScenarioSimulation["interpreter_fixture"] | null = null;

  function defaultActionTypeForTopic(topic: TopicKey): string {
    switch (topic) {
      case TopicKey.Calendar:
        return "query_events";
      case TopicKey.Chores:
        return "query_chores";
      case TopicKey.Finances:
        return "query_finances";
      case TopicKey.Grocery:
        return "query_list";
      case TopicKey.Health:
        return "query_health";
      case TopicKey.Pets:
        return "query_pets";
      case TopicKey.School:
        return "query_school";
      case TopicKey.Travel:
        return "query_trips";
      case TopicKey.Vendors:
        return "query_vendors";
      case TopicKey.Business:
        return "query_leads";
      case TopicKey.Relationship:
        return "query_nudge_history";
      case TopicKey.FamilyStatus:
        return "query_status";
      case TopicKey.Meals:
        return "query_plans";
      case TopicKey.Maintenance:
        return "query_maintenance";
      default:
        return "query_status";
    }
  }

  function buildFixtureActionPayload(
    actionType: string,
    topic: TopicKey,
    queueItem: StackQueueItem,
  ): Record<string, unknown> {
    const actor = queueItem.concerning[0] ?? "participant_1";
    switch (actionType) {
      case "add_items":
        return { type: actionType, items: [{ item: "fixture_item" }] };
      case "remove_items":
        return { type: actionType, item_ids: ["fixture_item"] };
      case "create_event":
        return {
          type: actionType,
          title: "Fixture event",
          date_start: queueItem.created_at.toISOString(),
          concerning: queueItem.concerning.length > 0 ? queueItem.concerning : [actor],
        };
      case "reschedule_event":
        return {
          type: actionType,
          event_id: queueItem.id ?? "fixture_event",
          new_start: queueItem.created_at.toISOString(),
        };
      case "cancel_event":
        return { type: actionType, event_id: queueItem.id ?? "fixture_event" };
      case "assign_chore":
        return {
          type: actionType,
          task: "Fixture chore",
          assigned_to: actor,
          due: queueItem.created_at.toISOString(),
        };
      case "complete_chore":
      case "cancel_chore":
        return { type: actionType, chore_id: queueItem.id ?? "fixture_chore" };
      case "log_expense":
        return {
          type: actionType,
          description: "Fixture expense",
          amount: 1,
          logged_by: actor,
          requires_confirmation: true,
        };
      case "add_appointment":
        return {
          type: actionType,
          entity: actor,
          provider_type: "primary",
          date: queueItem.created_at.toISOString(),
        };
      case "log_visit":
        return {
          type: actionType,
          entity: actor,
          provider_type: "primary",
          notes: "Fixture visit",
        };
      case "log_care":
        return {
          type: actionType,
          entity: actor,
          activity: "Fixture care",
          by: actor,
          category: "general_care",
        };
      case "add_assignment":
        return {
          type: actionType,
          entity: actor,
          parent_entity: actor,
          title: "Fixture assignment",
          due_date: queueItem.created_at.toISOString(),
          source: "conversation",
        };
      case "create_trip":
        return {
          type: actionType,
          name: "Fixture trip",
          dates: {
            start: queueItem.created_at.toISOString(),
            end: new Date(queueItem.created_at.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          },
          travelers: queueItem.concerning.length > 0 ? queueItem.concerning : [actor],
          source: "conversation",
        };
      case "add_vendor":
        return {
          type: actionType,
          name: "Fixture vendor",
          vendor_type: "general_service",
          contact: "unknown",
          managed_by: actor,
        };
      case "add_lead":
        return { type: actionType, owner: actor, client_name: "Fixture lead" };
      case "respond_to_nudge":
        return { type: actionType, acknowledged: true };
      case "update_status":
        return {
          type: actionType,
          entity: actor,
          status: "Fixture status",
          expires_at: new Date(queueItem.created_at.getTime() + 60 * 60 * 1000).toISOString(),
        };
      case "plan_meal":
        return {
          type: actionType,
          date: queueItem.created_at.toISOString(),
          meal_type: "dinner",
          description: "Fixture meal",
          planned_by: actor,
        };
      case "add_asset":
        return { type: actionType, asset_type: "home", name: "Fixture asset", details: {} };
      default:
        return {
          type: actionType || defaultActionTypeForTopic(topic),
          entity: actor,
        };
    }
  }

  const worker = createWorker({
    classifier_service: {
      classify: async (item: StackQueueItem) =>
        ({
          topic: item.topic ?? TopicKey.FamilyStatus,
          intent: item.intent ?? ClassifierIntent.Request,
          concerning: item.concerning,
          confidence: 0.99,
        }) satisfies StackClassificationResult,
      interpretAction: async (input) => {
        if (!activeInterpreterFixture) {
          return null;
        }
        const topic = activeInterpreterFixture.topic ?? input.classification.topic;
        const intent = activeInterpreterFixture.intent ?? input.classification.intent;
        const actionType = activeInterpreterFixture.action_type ?? defaultActionTypeForTopic(topic);
        return {
          kind: "resolved",
          topic,
          intent,
          action: buildFixtureActionPayload(actionType, topic, input.queue_item) as Record<
            string,
            unknown
          > & { type: string },
        };
      },
    },
    identity_service: {
      resolve: async (item: StackQueueItem) => ({
        source_entity_id: item.concerning[0] ?? "participant_1",
        source_entity_type: "adult",
        thread_id: item.target_thread,
        concerning: item.concerning,
      }),
    },
    topic_profile_service: createTopicProfileService(),
    routing_service: createRoutingService(),
    budget_service: {
      getBudgetTracker: async () => state.outbound_budget_tracker,
      evaluateOutbound: async () => ({
        priority: DispatchPriority.Immediate,
        reason: "runtime replay",
      }),
      recordDispatch: async () => undefined,
    },
    escalation_service: {
      getStatus: async () => state.escalation_status,
      evaluate: async () => ({ should_escalate: false }),
      reconcileOnStartup: async () => [],
    },
    confirmation_service: {
      getState: async () => state.confirmations,
      requiresConfirmation: () => false,
      openConfirmation: async () => {
        throw new Error("runtime replay confirmation open is not supported");
      },
      resolveFromQueueItem: async () => null,
      expirePending: async () => [],
      reconcileOnStartup: async () => ({ expired: [], notifications: [] }),
      close: async () => undefined,
    },
    state_service: stateService,
    queue_service: {
      enqueue: async () => undefined,
    },
    transport_service: {
      normalizeInbound: (input) => input,
      sendOutbound: async (outbound: TransportOutboundEnvelope) => {
        transportCalls.push(outbound);
      },
    },
    now: () => new Date("2026-04-04T09:00:00.000Z"),
  });

  return {
    evaluate: async (
      scenario: EvalScenarioDefinition,
      options?: { interpreter_fixture?: EvalScenarioSimulation["interpreter_fixture"] },
    ): Promise<EvalScenarioActual> => {
      transportCalls.length = 0;
      activeInterpreterFixture = options?.interpreter_fixture ?? null;
      const inferredTopic = inferTopic(scenario.prompt_input.message);
      const inferredIntent = inferIntent(scenario.prompt_input.message);
      const queueItem: StackQueueItem = {
        id: `eval_worker_${scenario.id}`,
        source: QueueItemSource.ScheduledTrigger,
        content: scenario.prompt_input.message,
        concerning: scenario.prompt_input.concerning,
        target_thread: scenario.prompt_input.origin_thread,
        created_at: new Date("2026-04-04T09:00:00.000Z"),
        topic: inferredTopic,
        intent: inferredIntent,
      };
      const trace = await worker.process(queueItem);
      const outbound = transportCalls.at(-1);
      const actual: EvalScenarioActual = {
        topic: inferredTopic,
        intent: inferredIntent,
        target_thread: outbound?.target_thread ?? scenario.prompt_input.origin_thread,
        priority: outbound?.priority ?? DispatchPriority.Silent,
        confirmation_required:
          trace.outcome === "held" ||
          (typeof outbound?.content === "string" &&
            outbound.content.toLowerCase().includes("please confirm")),
        composed_message: outbound?.content ?? "No outbound generated.",
      };
      activeInterpreterFixture = null;
      return actual;
    },
  };
}

function collectTurnFailures(
  expected: Partial<EvalScenarioExpectation>,
  actual: EvalScenarioActual,
  turnIndex: number,
): EvalScenarioFailure[] {
  const failures: EvalScenarioFailure[] = [];

  if (expected.topic !== undefined && actual.topic !== expected.topic) {
    failures.push({
      field: "topic",
      expected: expected.topic,
      actual: actual.topic,
      prompt_fixable: false,
      message: `Turn ${turnIndex}: classified into a different topic.`,
      turn_index: turnIndex,
    });
  }
  if (expected.intent !== undefined && actual.intent !== expected.intent) {
    failures.push({
      field: "intent",
      expected: expected.intent,
      actual: actual.intent,
      prompt_fixable: false,
      message: `Turn ${turnIndex}: action intent did not match.`,
      turn_index: turnIndex,
    });
  }
  if (expected.target_thread !== undefined && actual.target_thread !== expected.target_thread) {
    failures.push({
      field: "target_thread",
      expected: expected.target_thread,
      actual: actual.target_thread,
      prompt_fixable: false,
      message: `Turn ${turnIndex}: response targeted a different thread.`,
      turn_index: turnIndex,
    });
  }
  if (expected.priority !== undefined && actual.priority !== expected.priority) {
    failures.push({
      field: "priority",
      expected: expected.priority,
      actual: actual.priority,
      prompt_fixable: false,
      message: `Turn ${turnIndex}: outbound priority did not match.`,
      turn_index: turnIndex,
    });
  }
  if (
    expected.confirmation_required !== undefined &&
    actual.confirmation_required !== expected.confirmation_required
  ) {
    failures.push({
      field: "confirmation_required",
      expected: expected.confirmation_required,
      actual: actual.confirmation_required,
      prompt_fixable: false,
      message: `Turn ${turnIndex}: confirmation gate expectation was not met.`,
      turn_index: turnIndex,
    });
  }
  if (!matchesAllMarkers(actual.composed_message, expected.tone_markers)) {
    failures.push({
      field: "tone_markers",
      expected: expected.tone_markers ?? [],
      actual: actual.composed_message,
      prompt_fixable: true,
      message: `Turn ${turnIndex}: composed output missed tone markers.`,
      turn_index: turnIndex,
    });
  }
  if (!matchesAllMarkers(actual.composed_message, expected.format_markers)) {
    failures.push({
      field: "format_markers",
      expected: expected.format_markers ?? [],
      actual: actual.composed_message,
      prompt_fixable: true,
      message: `Turn ${turnIndex}: composed output missed format markers.`,
      turn_index: turnIndex,
    });
  }
  if (includesForbiddenMarker(actual.composed_message, expected.must_not)) {
    failures.push({
      field: "must_not",
      expected: expected.must_not ?? [],
      actual: actual.composed_message,
      prompt_fixable: true,
      message: `Turn ${turnIndex}: composed output included forbidden content.`,
      turn_index: turnIndex,
    });
  }

  return failures;
}

function collectParityFailures(input: {
  scenario: EvalScenarioDefinition;
  runtime_actual: EvalScenarioActual;
  simulator_actual: EvalScenarioActual;
}): EvalScenarioFailure[] {
  const shouldAssert = input.scenario.simulation?.parity_assertion?.against_simulator ?? true;
  if (!shouldAssert) {
    return [];
  }
  const fields = input.scenario.simulation?.parity_assertion?.match_fields ?? [
    "topic",
    "intent",
    "target_thread",
    "priority",
  ];
  const failures: EvalScenarioFailure[] = [];
  for (const field of fields) {
    if (input.runtime_actual[field] === input.simulator_actual[field]) {
      continue;
    }
    failures.push({
      field,
      expected: input.simulator_actual[field],
      actual: input.runtime_actual[field],
      prompt_fixable: false,
      message: `Runtime replay diverged from simulator on ${field}.`,
    });
  }
  return failures;
}

function evaluateMultiTurnScenario(
  scenario: EvalScenarioDefinition,
  turns: EvalTurn[],
  config: SystemConfig,
): {
  allFailures: EvalScenarioFailure[];
  turnResults: EvalTurnResult[];
  lastActual: EvalScenarioActual | null;
} {
  const context: SimulatedThreadContext = {
    recent_messages: [],
    active_topic_context: null,
    pending_clarification: false,
  };

  const allFailures: EvalScenarioFailure[] = [];
  const turnResults: EvalTurnResult[] = [];
  let lastActual: EvalScenarioActual | null = null;

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];

    if (turn.role === "assistant") {
      const isQuestion = turn.message.trim().endsWith("?");
      context.pending_clarification = isQuestion;
      context.recent_messages.push({
        role: "assistant",
        message: turn.message,
        topic: context.active_topic_context,
      });
      turnResults.push({
        turn_index: i,
        role: "assistant",
        message: turn.message,
        actual: null,
        failures: [],
      });
      continue;
    }

    const inferredTopic = inferTopic(turn.message, context);
    const inferredIntent = inferIntent(turn.message, context);
    const syntheticInput: EvalScenarioDefinition["prompt_input"] = {
      message: turn.message,
      concerning: turn.entity_id ? [turn.entity_id] : scenario.prompt_input.concerning,
      origin_thread: turn.thread_id,
    };

    const actual: EvalScenarioActual = {
      topic: inferredTopic,
      intent: inferredIntent,
      target_thread: inferTargetThread(inferredTopic, syntheticInput, config, inferredIntent),
      priority: inferPriority(inferredTopic, inferredIntent, config),
      confirmation_required: inferConfirmation(config, inferredTopic),
      composed_message: composeMessageWithTopicConfig(inferredTopic, syntheticInput, config),
    };

    lastActual = actual;
    context.active_topic_context = inferredTopic;
    context.pending_clarification = false;
    context.recent_messages.push({
      role: "participant",
      message: turn.message,
      topic: inferredTopic,
    });

    let turnFailures: EvalScenarioFailure[] = [];
    if (turn.expected) {
      turnFailures = collectTurnFailures(turn.expected, actual, i);
      allFailures.push(...turnFailures);
    }

    turnResults.push({
      turn_index: i,
      role: "participant",
      message: turn.message,
      actual,
      failures: turnFailures,
    });
  }

  return { allFailures, turnResults, lastActual };
}

function matchesAllMarkers(message: string, markers: string[] | undefined): boolean {
  if (!markers || markers.length === 0) {
    return true;
  }

  const normalized = message.toLowerCase();
  return markers.every((marker) => normalized.includes(marker.toLowerCase()));
}

function includesForbiddenMarker(message: string, markers: string[] | undefined): boolean {
  if (!markers || markers.length === 0) {
    return false;
  }

  const normalized = message.toLowerCase();
  return markers.some((marker) => normalized.includes(marker.toLowerCase()));
}

function collectFailures(
  scenario: EvalScenarioDefinition,
  actual: EvalScenarioActual,
): EvalScenarioFailure[] {
  const failures: EvalScenarioFailure[] = [];

  if (actual.topic !== scenario.expected.topic) {
    failures.push({
      field: "topic",
      expected: scenario.expected.topic,
      actual: actual.topic,
      prompt_fixable: false,
      message: "The scenario classified into a different topic.",
    });
  }
  if (actual.intent !== scenario.expected.intent) {
    failures.push({
      field: "intent",
      expected: scenario.expected.intent,
      actual: actual.intent,
      prompt_fixable: false,
      message: "The action intent did not match the scenario expectation.",
    });
  }
  if (actual.target_thread !== scenario.expected.target_thread) {
    failures.push({
      field: "target_thread",
      expected: scenario.expected.target_thread,
      actual: actual.target_thread,
      prompt_fixable: false,
      message: "The response targeted a different thread.",
    });
  }
  if (actual.priority !== scenario.expected.priority) {
    failures.push({
      field: "priority",
      expected: scenario.expected.priority,
      actual: actual.priority,
      prompt_fixable: false,
      message: "The outbound priority did not align with the expected dispatch timing.",
    });
  }
  if (actual.confirmation_required !== scenario.expected.confirmation_required) {
    failures.push({
      field: "confirmation_required",
      expected: scenario.expected.confirmation_required,
      actual: actual.confirmation_required,
      prompt_fixable: false,
      message: "The confirmation gate expectation was not met.",
    });
  }
  if (!matchesAllMarkers(actual.composed_message, scenario.expected.tone_markers)) {
    failures.push({
      field: "tone_markers",
      expected: scenario.expected.tone_markers ?? [],
      actual: actual.composed_message,
      prompt_fixable: true,
      message: "The composed output missed one or more expected tone markers.",
    });
  }
  if (!matchesAllMarkers(actual.composed_message, scenario.expected.format_markers)) {
    failures.push({
      field: "format_markers",
      expected: scenario.expected.format_markers ?? [],
      actual: actual.composed_message,
      prompt_fixable: true,
      message: "The composed output missed one or more expected format markers.",
    });
  }
  if (includesForbiddenMarker(actual.composed_message, scenario.expected.must_not)) {
    failures.push({
      field: "must_not",
      expected: scenario.expected.must_not ?? [],
      actual: actual.composed_message,
      prompt_fixable: true,
      message: "The composed output included content the scenario marked as forbidden.",
    });
  }

  return failures;
}

function createScenarioResults(scenarios: EvalScenarioDefinition[]): EvalScenarioResult[] {
  return scenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    category: scenario.category,
    status: "queued",
    raw_outcome: "pass",
    started_at: null,
    completed_at: null,
    expected: scenario.expected,
    actual: null,
    failures: [],
    tuner: null,
  }));
}

function createRunState(
  options: RunSequentialEvalOptions,
  scenarios: EvalScenarioDefinition[],
): EvalRunState {
  const startedAt = new Date().toISOString();

  return {
    id: options.run_id,
    scenario_set: options.scenario_set,
    status: "queued",
    started_at: startedAt,
    completed_at: null,
    summary: buildSummary(createScenarioResults(scenarios)),
    scenarios: createScenarioResults(scenarios),
    logs: [],
    artifacts: {
      json_path: `eval/results/${options.run_id}.json`,
      markdown_path: null,
    },
  };
}

export async function runSequentialEval(options: RunSequentialEvalOptions): Promise<EvalRunState> {
  const systemConfig = await loadEvalSystemConfig(options.repo_root);
  const mode = options.mode ?? "simulator";
  const stepDelayMs = options.step_delay_ms ?? 200;
  const workspace = await ensureEvalWorkspace(options.repo_root);
  const jsonPath = join(workspace.results_dir, `${options.run_id}.json`);
  const scenarioSet = getScenarioSet(options.scenario_set);
  const state = createRunState(options, scenarioSet.scenarios);
  const workerReplay =
    mode === "worker" || mode === "fixture-interpreter"
      ? createWorkerReplayHarness(systemConfig)
      : null;
  const fixtureInterpreterMode = mode === "fixture-interpreter";
  let logSequence = 0;

  async function persistState(): Promise<void> {
    state.summary = buildSummary(state.scenarios);
    await writeFile(jsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async function pushLog(
    phase: string,
    message: string,
    scenarioId?: string,
    data?: Record<string, unknown>,
    level: EvalScenarioLogEvent["level"] = "info",
  ): Promise<void> {
    state.logs.push({
      seq: ++logSequence,
      timestamp: new Date().toISOString(),
      level,
      phase,
      scenario_id: scenarioId,
      message,
      data,
    });
    await persistState();
  }

  try {
    state.status = "running";
    await persistState();
    await pushLog("run", `Starting sequential eval run for scenario set "${scenarioSet.label}".`);

    for (const scenario of scenarioSet.scenarios) {
      const scenarioResult = state.scenarios.find((entry) => entry.id === scenario.id);

      if (!scenarioResult) {
        continue;
      }

      scenarioResult.status = "running";
      scenarioResult.started_at = new Date().toISOString();
      await persistState();

      const isMultiTurn = scenario.turns && scenario.turns.length >= 2;
      await pushLog(
        "scenario",
        `Starting ${isMultiTurn ? "multi-turn" : "single-turn"} scenario "${scenario.title}".`,
        scenario.id,
      );
      await pause(stepDelayMs);

      let actual: EvalScenarioActual;
      let failures: EvalScenarioFailure[];

      if (isMultiTurn && scenario.turns) {
        const turns = scenario.turns;
        const result = evaluateMultiTurnScenario(scenario, turns, systemConfig);
        actual = result.lastActual ?? evaluateScenario(scenario, systemConfig);
        failures = result.allFailures;
        scenarioResult.turn_results = result.turnResults;
        scenarioResult.actual = actual;
        await pushLog(
          "evaluate",
          `Multi-turn scenario evaluated across ${turns.length} turns; ${result.turnResults.filter((tr) => tr.role === "participant").length} participant turns checked.`,
          scenario.id,
          {
            turns: turns.length,
            participant_turns: result.turnResults.filter((tr) => tr.role === "participant").length,
            failures: failures.length,
          },
        );
      } else {
        actual =
          workerReplay !== null
            ? await workerReplay.evaluate(scenario, {
                interpreter_fixture: fixtureInterpreterMode
                  ? scenario.simulation?.interpreter_fixture
                  : undefined,
              })
            : evaluateScenario(scenario, systemConfig);
        scenarioResult.actual = actual;
        failures = collectFailures(scenario, actual);
        if (workerReplay !== null) {
          const simulatorActual = evaluateScenario(scenario, systemConfig);
          failures = failures.concat(
            collectParityFailures({
              scenario,
              runtime_actual: actual,
              simulator_actual: simulatorActual,
            }),
          );
        }
        await pushLog(
          "evaluate",
          workerReplay !== null
            ? "Scenario input evaluated using worker replay mode."
            : fixtureInterpreterMode
              ? "Scenario input evaluated using fixture-interpreter mode."
              : "Scenario input evaluated against the current prompt/runtime simulator.",
          scenario.id,
          {
            mode,
            topic: actual.topic,
            intent: actual.intent,
            target_thread: actual.target_thread,
            priority: actual.priority,
          },
        );
      }
      await pause(stepDelayMs);

      scenarioResult.failures = failures;
      scenarioResult.raw_outcome = failures.length === 0 ? "pass" : "fail";

      if (failures.length === 0) {
        scenarioResult.status = "passed";
        scenarioResult.completed_at = new Date().toISOString();
        await pushLog("result", "Scenario passed without tuner intervention.", scenario.id);
        await persistState();
        continue;
      }

      await pushLog(
        "diagnose",
        `Scenario produced ${failures.length} failing dimension(s); sending to tuner.`,
        scenario.id,
        { failures: failures.map((failure) => failure.field) },
        "warn",
      );
      await pause(stepDelayMs);

      const diagnosis = diagnoseScenarioFailures(scenario, failures);

      if (diagnosis.can_fix_with_prompt) {
        const tunerOutcome = generateCandidatePrompt({
          scenario,
          actual,
          failures,
        });
        scenarioResult.status = tunerOutcome.status;
        scenarioResult.tuner = tunerOutcome;
        await pushLog(
          "tuner",
          "Prompt candidate created and scenario marked prompt_fix_suggested.",
          scenario.id,
          {
            candidate_title: tunerOutcome.candidate?.title,
          },
        );
      } else {
        const tunerOutcome = toDeferredTunerOutcome(diagnosis);
        scenarioResult.status = tunerOutcome.status;
        scenarioResult.tuner = tunerOutcome;
        await pushLog(
          "tuner",
          "Scenario marked investigation_needed because the failure is outside prompt-only tuning scope.",
          scenario.id,
          { failing_dimensions: diagnosis.failing_dimensions },
          "warn",
        );
      }

      scenarioResult.completed_at = new Date().toISOString();
      await persistState();
      await pause(stepDelayMs);
    }

    state.status = "completed";
    state.completed_at = new Date().toISOString();
    const finalizedState = await writeRunArtifacts({
      repo_root: options.repo_root,
      results_dir: workspace.results_dir,
      state,
    });
    state.artifacts = finalizedState.artifacts;
    state.summary = finalizedState.summary;
    await pushLog(
      "run",
      `Eval run completed. Markdown artifact written to ${relative(options.repo_root, join(workspace.results_dir, `${options.run_id}.prompt.md`))}.`,
    );
    await persistState();
    return state;
  } catch (error: unknown) {
    state.status = "failed";
    state.completed_at = new Date().toISOString();
    await pushLog(
      "run",
      error instanceof Error ? error.message : String(error),
      undefined,
      undefined,
      "error",
    );
    await persistState();
    throw error;
  }
}
