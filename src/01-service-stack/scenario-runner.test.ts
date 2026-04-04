import { describe, expect, it } from "vitest";

import { RoutingRule } from "../02-supporting-services/05-routing-service/types.js";
import { createTestSystemConfig } from "../02-supporting-services/test-fixtures.js";
import {
  ClassifierIntent,
  DispatchPriority,
  EscalationLevel,
  QueueItemSource,
  TopicKey,
} from "../types.js";
import { createWorker, type WorkerOptions } from "./05-worker/index.js";
import type {
  ActionRouterContract,
  ActionRouterResult,
  ClassifierServiceContract,
  CollisionPolicy,
  IdentityServiceContract,
  StackClassificationResult,
  StackQueueItem,
  TransportInboundEnvelope,
  TransportServiceContract,
  WorkerDecision,
} from "./types.js";

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

function createWorkerOptions(hooks: {
  order: string[];
  actionRouterResult: ActionRouterResult;
  priority?: DispatchPriority;
}): WorkerOptions {
  const config = createTestSystemConfig();
  const actionRouter: ActionRouterContract = {
    route: (decision: WorkerDecision, _policy: CollisionPolicy) => {
      hooks.order.push("action-router");
      return Promise.resolve(
        hooks.actionRouterResult.decision === "dispatch"
          ? hooks.actionRouterResult
          : {
              ...hooks.actionRouterResult,
              queue_item: {
                ...hooks.actionRouterResult.queue_item,
                id: decision.queue_item.id,
              },
            },
      );
    },
  };
  const classifierService: ClassifierServiceContract = {
    classify: (item: StackQueueItem): Promise<StackClassificationResult> => {
      hooks.order.push("worker.classifier");
      return resolved({
        topic: item.topic ?? TopicKey.FamilyStatus,
        intent: item.intent ?? ClassifierIntent.Request,
        concerning: item.concerning,
      });
    },
  };
  const identityService: IdentityServiceContract = {
    resolve: (item: StackQueueItem) => {
      hooks.order.push("worker.identity");
      return resolved({
        source_entity_id: item.concerning[0] ?? "participant_1",
        source_entity_type: "adult",
        thread_id: item.target_thread,
        concerning: item.concerning,
      });
    },
  };
  const transportService: TransportServiceContract = {
    normalizeInbound: (input: TransportInboundEnvelope) => ({
      ...input,
      topic: TopicKey.FamilyStatus,
      intent: ClassifierIntent.Request,
    }),
    sendOutbound: () => {
      hooks.order.push("transport.send");
      return Promise.resolve();
    },
  };

  return {
    classifier_service: classifierService,
    identity_service: identityService,
    topic_profile_service: {
      getTopicConfig: () =>
        resolved({
          tone: "direct",
          format: "list",
          initiative_style: "factual alert",
          escalation_level: EscalationLevel.Medium,
          framework_grounding: null,
          response_format: "direct answer",
          cross_topic_connections: [],
        }),
      classifyFallback: () => resolved({} as never),
      composeMessage: () => resolved("pipeline output"),
    },
    routing_service: {
      getThreadDefinitions: () => resolved([]),
      resolveTargetThread: (request) => resolved(request.origin_thread),
      resolveRoutingDecision: (request) => ({
        target: {
          thread_id: request.origin_thread,
          rule_applied: request.is_response
            ? RoutingRule.ResponseInPlace
            : RoutingRule.ProactiveNarrowest,
          reason: "scenario",
        },
      }),
    },
    budget_service: {
      getBudgetTracker: () =>
        resolved({
          date: new Date("2026-04-03T00:00:00.000Z"),
          by_person: {},
          by_thread: {},
        }),
      evaluateOutbound: () =>
        resolved({
          priority: hooks.priority ?? DispatchPriority.Immediate,
          reason: "scenario budget",
        }),
      recordDispatch: () => {
        hooks.order.push("worker.record-dispatch");
        return Promise.resolve();
      },
    },
    escalation_service: {
      getStatus: () => resolved({ active: [] }),
      evaluate: () => resolved({ should_escalate: false }),
      reconcileOnStartup: () => resolved([]),
    },
    confirmation_service: {
      getState: () => resolved({ pending: [], recent: [] }),
      requiresConfirmation: () => false,
      openConfirmation: () => resolved({} as never),
      resolveFromQueueItem: () => resolved(null),
      expirePending: () => resolved([]),
      reconcileOnStartup: () => resolved({ expired: [], notifications: [] }),
      close: () => Promise.resolve(),
    },
    state_service: {
      getSystemConfig: () => resolved(config),
      saveSystemConfig: () => Promise.resolve(),
      getSystemState: () => resolved({} as never),
      saveSystemState: () => Promise.resolve(),
      getThreadHistory: () => resolved(null),
      saveThreadHistory: () => Promise.resolve(),
      appendDispatchResult: () => Promise.resolve(),
    },
    queue_service: {
      enqueue: () => Promise.resolve(),
    },
    transport_service: transportService,
    action_router: actionRouter,
    now: () => new Date("2026-04-03T12:00:00.000Z"),
  };
}

describe("Service Stack scenario runner", () => {
  it("runs transport -> identity -> queue -> worker -> action router pipeline", async () => {
    const order: string[] = [];
    const queue: StackQueueItem[] = [];
    const inbound: TransportInboundEnvelope = {
      source: QueueItemSource.HumanMessage,
      content: "What is on today?",
      concerning: ["participant_1", "participant_2"],
      target_thread: "family",
      created_at: new Date("2026-04-03T12:00:00.000Z"),
    };

    const transport = {
      normalizeInbound: (input: TransportInboundEnvelope): StackQueueItem => {
        order.push("transport.normalize");
        return {
          ...input,
          topic: TopicKey.Calendar,
          intent: ClassifierIntent.Query,
        };
      },
    };
    const identity = {
      resolve: (item: StackQueueItem) => {
        order.push("identity.resolve");
        return resolved({
          source_entity_id: item.concerning[0] ?? "participant_1",
          source_entity_type: "adult",
          thread_id: item.target_thread,
          concerning: item.concerning,
        });
      },
    };
    const queueMock = {
      enqueue: (item: StackQueueItem): Promise<void> => {
        order.push("queue.enqueue");
        queue.push(item);
        return Promise.resolve();
      },
      dequeue: (): Promise<StackQueueItem | null> => {
        order.push("queue.dequeue");
        return resolved(queue.shift() ?? null);
      },
    };

    const worker = createWorker(
      createWorkerOptions({
        order,
        actionRouterResult: {
          decision: "dispatch",
          outbound: {
            target_thread: "family",
            content: "pipeline output",
            priority: DispatchPriority.Immediate,
            concerning: ["participant_1", "participant_2"],
          },
        },
      }),
    );

    const normalized = transport.normalizeInbound(inbound);
    await identity.resolve(normalized);
    await queueMock.enqueue(normalized);
    const queued = await queueMock.dequeue();
    expect(queued).not.toBeNull();
    await worker.process(queued as StackQueueItem);

    expect(order).toContain("action-router");
    expect(order.indexOf("worker.classifier")).toBeGreaterThan(order.indexOf("queue.dequeue"));
    expect(order.filter((step) => step === "worker.classifier")).toHaveLength(1);
  });

  it("supports silent-priority scenarios without outbound dispatch", async () => {
    const order: string[] = [];
    const worker = createWorker(
      createWorkerOptions({
        order,
        priority: DispatchPriority.Silent,
        actionRouterResult: {
          decision: "store",
          queue_item: {
            source: QueueItemSource.HumanMessage,
            content: "log this",
            concerning: ["participant_1"],
            target_thread: "participant_1_private",
            created_at: new Date("2026-04-03T12:00:00.000Z"),
            topic: TopicKey.Vendors,
            intent: ClassifierIntent.Request,
            priority: DispatchPriority.Silent,
          },
          reason: "silent scenario",
        },
      }),
    );

    const trace = await worker.process({
      source: QueueItemSource.HumanMessage,
      content: "log this",
      concerning: ["participant_1"],
      target_thread: "participant_1_private",
      created_at: new Date("2026-04-03T12:00:00.000Z"),
      topic: TopicKey.Vendors,
      intent: ClassifierIntent.Request,
      priority: DispatchPriority.Silent,
    });

    expect(trace.outcome).toBe("stored");
    expect(order).not.toContain("transport.send");
  });
});
