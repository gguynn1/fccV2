import { describe, expect, it, vi } from "vitest";

import { type SystemState } from "../../02-supporting-services/03-state-service/types.js";
import { createTopicProfileService } from "../../02-supporting-services/04-topic-profile-service/index.js";
import { createRoutingService } from "../../02-supporting-services/05-routing-service/index.js";
import { type ThreadHistory } from "../../02-supporting-services/05-routing-service/types.js";
import {
  ConfirmationActionType,
  ConfirmationReplyDecision,
  ConfirmationResult,
  ConfirmationStatus,
  type ResolvedConfirmation,
} from "../../02-supporting-services/08-confirmation-service/types.js";
import {
  createTestSystemState,
  installTestSystemConfig,
} from "../../02-supporting-services/test-fixtures.js";
import {
  ClassifierIntent,
  DispatchPriority,
  QueueItemSource,
  TopicKey,
  type ClarificationReason,
} from "../../types.js";
import type {
  IdentityResolutionResult,
  StackClassificationResult,
  StackQueueItem,
  TransportOutboundEnvelope,
} from "../types.js";
import { createWorker } from "./index.js";

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

function createStateServiceStub(threadHistory?: ThreadHistory | null) {
  const config = installTestSystemConfig();
  const state: SystemState = createTestSystemState();
  if (threadHistory) {
    state.threads.family = threadHistory;
  }

  return {
    getSystemConfig: vi.fn(() => resolved(config)),
    saveSystemConfig: vi.fn(() => resolved(undefined)),
    getSystemState: vi.fn(() => resolved(state)),
    saveSystemState: vi.fn((nextState: SystemState) => {
      Object.assign(state, nextState);
      return resolved(undefined);
    }),
    getThreadHistory: vi.fn(
      (threadId: string): Promise<ThreadHistory | null> =>
        resolved(state.threads[threadId] ?? null),
    ),
    saveThreadHistory: vi.fn((threadId: string, history: ThreadHistory) => {
      state.threads[threadId] = history;
      return resolved(undefined);
    }),
    appendDispatchResult: vi.fn(() => resolved(undefined)),
  };
}

function createIdentityStub() {
  return {
    resolve: vi.fn((item: StackQueueItem) =>
      resolved<IdentityResolutionResult>({
        source_entity_id: item.concerning[0] ?? "participant_1",
        source_entity_type: "adult",
        thread_id: item.target_thread,
        concerning: item.concerning,
      }),
    ),
  };
}

function createRuntimeStubs(
  overrides: {
    classify?: (
      item: StackQueueItem,
      threadHistory?: ThreadHistory | null,
    ) => Promise<StackClassificationResult>;
    interpretAction?: () => Promise<
      | {
          kind: "resolved";
          topic: TopicKey;
          intent: ClassifierIntent;
          action: Record<string, unknown> & { type: string };
        }
      | {
          kind: "clarification_required";
          clarification: {
            reason: ClarificationReason;
            message_to_participant: string;
            options?: string[];
            original_queue_item_id: string;
            context: Record<string, unknown>;
          };
        }
      | null
    >;
    now?: () => Date;
    budgetPriority?: DispatchPriority;
    escalationDecision?: { should_escalate: boolean; next_target_thread?: string };
    confirmationResolution?: ConfirmationResult | ResolvedConfirmation | null;
  } = {},
) {
  installTestSystemConfig();
  const transportCalls: TransportOutboundEnvelope[] = [];
  const queuedItems: StackQueueItem[] = [];
  const stateService = createStateServiceStub();
  const state = createTestSystemState();
  const classifier = {
    classify:
      overrides.classify ??
      ((item: StackQueueItem) =>
        resolved<StackClassificationResult>({
          topic: item.topic ?? TopicKey.FamilyStatus,
          intent: item.intent ?? ClassifierIntent.Request,
          concerning: item.concerning,
        })),
    interpretAction: overrides.interpretAction,
  };
  const classifierMock = vi.fn(classifier.classify);

  return {
    transportCalls,
    queuedItems,
    stateService,
    classifier: classifierMock,
    worker: createWorker({
      classifier_service: {
        classify: classifierMock,
        interpretAction: classifier.interpretAction,
      },
      identity_service: createIdentityStub(),
      topic_profile_service: createTopicProfileService(),
      routing_service: createRoutingService(),
      budget_service: {
        getBudgetTracker: vi.fn(() => resolved(state.outbound_budget_tracker)),
        evaluateOutbound: vi.fn(() =>
          resolved({
            priority: overrides.budgetPriority ?? DispatchPriority.Immediate,
            reason: "send now",
          }),
        ),
        recordDispatch: vi.fn(() => resolved(undefined)),
      },
      escalation_service: {
        getStatus: vi.fn(() => resolved(state.escalation_status)),
        evaluate: vi.fn(() =>
          resolved(
            overrides.escalationDecision ?? {
              should_escalate: false,
            },
          ),
        ),
        reconcileOnStartup: vi.fn(() => resolved([])),
      },
      confirmation_service: {
        getState: vi.fn(() => resolved(state.confirmations)),
        requiresConfirmation: vi.fn(() => false),
        openConfirmation: vi.fn(),
        resolveFromQueueItem: vi.fn(() => {
          const resolution = overrides.confirmationResolution ?? null;
          if (resolution === null) {
            return resolved(null);
          }
          if (typeof resolution === "object") {
            return resolved(resolution);
          }
          if (
            resolution !== ConfirmationResult.Approved &&
            resolution !== ConfirmationResult.Rejected
          ) {
            return resolved(null);
          }
          return resolved<ResolvedConfirmation>({
            id: "confirm_test",
            type: ConfirmationActionType.FinancialAction,
            action: "log_expense",
            requested_by: "participant_1",
            requested_in_thread: "couple",
            requested_at: new Date("2026-04-03T19:00:00.000Z"),
            expires_at: new Date("2026-04-03T19:10:00.000Z"),
            status: ConfirmationStatus.Resolved,
            result: resolution,
            resolved_at: new Date("2026-04-03T19:01:00.000Z"),
            resolved_in_thread: "couple",
            reply_options: [
              {
                key: "yes",
                label: "Yes",
                aliases: ["yes"],
                decision: ConfirmationReplyDecision.Approve,
              },
            ],
          });
        }),
        expirePending: vi.fn(() => resolved([])),
        reconcileOnStartup: vi.fn(() => resolved({ expired: [], notifications: [] })),
        close: vi.fn(() => resolved(undefined)),
      },
      state_service: stateService,
      queue_service: {
        enqueue: vi.fn((item: StackQueueItem) => {
          queuedItems.push(item);
          return resolved(undefined);
        }),
      },
      transport_service: {
        normalizeInbound: vi.fn(() => {
          throw new Error("normalizeInbound is unused in worker tests");
        }),
        sendOutbound: vi.fn((output: TransportOutboundEnvelope) => {
          transportCalls.push(output);
          return resolved(undefined);
        }),
      },
      now: overrides.now ?? (() => new Date("2026-04-03T19:00:00.000Z")),
    }),
  };
}

describe("Worker", () => {
  it("trusts preclassified ingest items and emits cross-topic events", async () => {
    const runtime = createRuntimeStubs({
      classify: () =>
        Promise.reject(new Error("classifier should not run for preclassified ingest")),
    });

    const trace = await runtime.worker.process({
      id: "email_1",
      source: QueueItemSource.EmailMonitor,
      topic: TopicKey.Meals,
      intent: ClassifierIntent.Request,
      concerning: ["participant_1", "participant_2"],
      target_thread: "family",
      created_at: new Date("2026-04-03T18:00:00.000Z"),
      content: "Plan tacos tomorrow",
    });

    expect(trace.classification_source).toBe("preclassified_email");
    expect(runtime.classifier).not.toHaveBeenCalled();
    expect(runtime.queuedItems).toHaveLength(1);
    expect(runtime.queuedItems[0]?.source).toBe(QueueItemSource.CrossTopic);
    expect(runtime.queuedItems[0]?.idempotency_key).toContain("grocery");
    expect(runtime.transportCalls[0]?.target_thread).toBe("couple");
    expect(runtime.transportCalls[0]?.content).toBeTruthy();
  });

  it("caps thread history before classification and keeps responses in-place", async () => {
    const history: ThreadHistory = {
      active_topic_context: TopicKey.FamilyStatus,
      last_activity: new Date("2026-04-03T17:00:00.000Z"),
      recent_messages: Array.from({ length: 20 }, (_, index) => ({
        id: `m_${index}`,
        from: "participant_1",
        content: `message ${index}`,
        at: new Date(`2026-04-03T16:${String(index).padStart(2, "0")}:00.000Z`),
        topic_context: TopicKey.FamilyStatus,
      })),
    };
    let capturedHistoryCount = 0;
    const runtime = createRuntimeStubs({
      classify: (_item: StackQueueItem, threadHistory?: ThreadHistory | null) => {
        capturedHistoryCount = threadHistory?.recent_messages.length ?? 0;
        return resolved({
          topic: TopicKey.Meals,
          intent: ClassifierIntent.Query,
          concerning: ["participant_1", "participant_2"],
        });
      },
    });
    runtime.stateService.getThreadHistory.mockImplementation((threadId: string) =>
      resolved(threadId === "family" ? history : null),
    );

    await runtime.worker.process({
      id: "human_1",
      source: QueueItemSource.HumanMessage,
      concerning: ["participant_1", "participant_2"],
      target_thread: "family",
      created_at: new Date("2026-04-03T18:05:00.000Z"),
      content: "What should we have for dinner?",
    });

    expect(capturedHistoryCount).toBe(15);
    expect(runtime.transportCalls[0]?.target_thread).toBe("family");
  });

  it("sends a clarification when required fields are missing", async () => {
    const runtime = createRuntimeStubs({
      classify: () =>
        resolved({
          topic: TopicKey.Calendar,
          intent: ClassifierIntent.Request,
          concerning: ["participant_1"],
        }),
    });

    const trace = await runtime.worker.process({
      id: "human_2",
      source: QueueItemSource.HumanMessage,
      concerning: ["participant_1"],
      target_thread: "family",
      created_at: new Date("2026-04-03T18:10:00.000Z"),
      content: "schedule dentist",
    });

    expect(trace.outcome).toBe("clarification_requested");
    expect(runtime.transportCalls[0]?.content).toContain("date and time");
    expect(runtime.transportCalls[0]?.target_thread).toBe("family");
  });

  it("uses interpreter action before deterministic fallback", async () => {
    const runtime = createRuntimeStubs({
      classify: () =>
        resolved({
          topic: TopicKey.Grocery,
          intent: ClassifierIntent.Request,
          concerning: ["participant_1"],
        }),
      interpretAction: () =>
        resolved({
          kind: "resolved",
          topic: TopicKey.Grocery,
          intent: ClassifierIntent.Request,
          action: {
            type: "add_items",
            items: [{ item: "apples" }, { item: "eggs" }],
          },
        }),
    });

    await runtime.worker.process({
      id: "interp_1",
      source: QueueItemSource.HumanMessage,
      concerning: ["participant_1"],
      target_thread: "family",
      created_at: new Date("2026-04-03T18:10:00.000Z"),
      content: "please handle groceries",
    });

    expect(runtime.transportCalls[0]?.content.toLowerCase()).toContain("apples");
  });

  it("falls back when interpreter returns unsupported action type", async () => {
    const runtime = createRuntimeStubs({
      classify: () =>
        resolved({
          topic: TopicKey.Grocery,
          intent: ClassifierIntent.Request,
          concerning: ["participant_1"],
        }),
      interpretAction: () =>
        resolved({
          kind: "resolved",
          topic: TopicKey.Grocery,
          intent: ClassifierIntent.Request,
          action: { type: "not_supported" },
        }),
    });

    await runtime.worker.process({
      id: "interp_2",
      source: QueueItemSource.HumanMessage,
      concerning: ["participant_1"],
      target_thread: "family",
      created_at: new Date("2026-04-03T18:10:00.000Z"),
      content: "add milk and bread",
    });

    expect(runtime.transportCalls[0]?.content.toLowerCase()).toContain("milk");
  });

  it("uses interpreter topic and intent context for downstream routing", async () => {
    const runtime = createRuntimeStubs({
      classify: () =>
        resolved({
          topic: TopicKey.Grocery,
          intent: ClassifierIntent.Request,
          concerning: ["participant_1"],
        }),
      interpretAction: () =>
        resolved({
          kind: "resolved",
          topic: TopicKey.Relationship,
          intent: ClassifierIntent.Request,
          action: {
            type: "respond_to_nudge",
            acknowledged: true,
          },
        }),
    });

    await runtime.worker.process({
      id: "interp_3",
      source: QueueItemSource.HumanMessage,
      concerning: ["participant_1"],
      target_thread: "family",
      created_at: new Date("2026-04-03T18:12:00.000Z"),
      content: "new client inquiry came in",
    });

    const dispatchCalls = runtime.stateService.appendDispatchResult.mock.calls as unknown as Array<
      [StackQueueItem, unknown]
    >;
    expect(dispatchCalls.some((call) => call[0].topic === TopicKey.Relationship)).toBe(true);
  });

  it("falls back when interpreter returns malformed allowlisted payload", async () => {
    const runtime = createRuntimeStubs({
      classify: () =>
        resolved({
          topic: TopicKey.Grocery,
          intent: ClassifierIntent.Request,
          concerning: ["participant_1"],
        }),
      interpretAction: () =>
        resolved({
          kind: "resolved",
          topic: TopicKey.Grocery,
          intent: ClassifierIntent.Request,
          action: { type: "add_items" },
        }),
    });

    await runtime.worker.process({
      id: "interp_4",
      source: QueueItemSource.HumanMessage,
      concerning: ["participant_1"],
      target_thread: "family",
      created_at: new Date("2026-04-03T18:13:00.000Z"),
      content: "add yogurt",
    });

    expect(runtime.transportCalls[0]?.content.toLowerCase()).toContain("yogurt");
  });

  it("stores stale urgent backlog instead of dispatching late", async () => {
    const runtime = createRuntimeStubs({
      classify: () =>
        resolved({
          topic: TopicKey.FamilyStatus,
          intent: ClassifierIntent.Request,
          concerning: ["participant_1"],
        }),
      now: () => new Date("2026-04-04T20:00:00.000Z"),
    });

    const trace = await runtime.worker.process({
      id: "late_1",
      source: QueueItemSource.ScheduledTrigger,
      topic: TopicKey.FamilyStatus,
      intent: ClassifierIntent.Request,
      concerning: ["participant_1"],
      target_thread: "family",
      created_at: new Date("2026-04-03T10:00:00.000Z"),
      content: "pickup in 30 minutes",
    });

    expect(trace.outcome).toBe("dropped_stale");
    expect(runtime.transportCalls).toHaveLength(0);
  });

  it("halts execution when a confirmation reply rejects", async () => {
    const runtime = createRuntimeStubs({
      classify: () =>
        resolved({
          topic: TopicKey.Finances,
          intent: ClassifierIntent.Request,
          concerning: ["participant_1"],
        }),
      confirmationResolution: ConfirmationResult.Rejected,
    });

    const trace = await runtime.worker.process({
      id: "confirm_reject_1",
      source: QueueItemSource.HumanMessage,
      concerning: ["participant_1"],
      target_thread: "couple",
      created_at: new Date("2026-04-03T19:00:00.000Z"),
      content: "log $45 for groceries",
    });

    expect(trace.outcome).toBe("stored");
    expect(runtime.transportCalls).toHaveLength(0);
  });

  it("uses escalation target thread when escalation requests broader visibility", async () => {
    const runtime = createRuntimeStubs({
      classify: () =>
        resolved({
          topic: TopicKey.Chores,
          intent: ClassifierIntent.Request,
          concerning: ["participant_1"],
        }),
      escalationDecision: {
        should_escalate: true,
        next_target_thread: "family",
      },
    });

    await runtime.worker.process({
      id: "escalate_1",
      source: QueueItemSource.HumanMessage,
      concerning: ["participant_1"],
      target_thread: "participant_1_private",
      created_at: new Date("2026-04-03T19:05:00.000Z"),
      content: "Please remind me to take out trash tomorrow",
    });

    expect(runtime.transportCalls[0]?.target_thread).toBe("family");
  });

  it("does not emit shared awareness notices for private health updates", async () => {
    const runtime = createRuntimeStubs({
      classify: () =>
        resolved({
          topic: TopicKey.Health,
          intent: ClassifierIntent.Request,
          concerning: ["participant_1"],
        }),
    });

    await runtime.worker.process({
      id: "health_private_1",
      source: QueueItemSource.HumanMessage,
      concerning: ["participant_1"],
      target_thread: "participant_1_private",
      created_at: new Date("2026-04-03T19:10:00.000Z"),
      content: "Schedule the dentist for next Tuesday",
    });

    expect(runtime.transportCalls[0]?.target_thread).toBe("participant_1_private");
    expect(
      runtime.transportCalls.some(
        (call) => call.target_thread === "family" || call.target_thread === "couple",
      ),
    ).toBe(false);
  });

  it("produces distinct profile-shaped outputs across topics", async () => {
    const service = createTopicProfileService();
    const outputs = await Promise.all(
      Object.values(TopicKey).map((topic) =>
        service.composeMessage({
          queue_item: {
            source: QueueItemSource.HumanMessage,
            content: `sample ${topic}`,
            concerning: ["participant_1"],
            target_thread: "participant_1_private",
            created_at: new Date("2026-04-03T18:30:00.000Z"),
            topic,
            intent: ClassifierIntent.Query,
          },
          classification: {
            topic,
            intent: ClassifierIntent.Query,
            concerning: ["participant_1"],
          },
          identity: {
            source_entity_id: "participant_1",
            source_entity_type: "adult",
            thread_id: "participant_1_private",
            concerning: ["participant_1"],
          },
          action: {
            decision: "store",
            queue_item: {
              source: QueueItemSource.HumanMessage,
              content: "sample",
              concerning: ["participant_1"],
              target_thread: "participant_1_private",
              created_at: new Date("2026-04-03T18:30:00.000Z"),
              topic,
              intent: ClassifierIntent.Query,
            },
            reason: "test",
          },
        }),
      ),
    );

    expect(new Set(outputs).size).toBeGreaterThanOrEqual(3);
    expect(outputs.every((output) => typeof output === "string" && output.length > 0)).toBe(true);
  });
});
