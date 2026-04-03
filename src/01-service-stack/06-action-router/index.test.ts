import { describe, expect, it } from "vitest";

import { ClassifierIntent, QueueItemSource, TopicKey } from "../../types.js";
import type { CollisionPolicy, WorkerDecision } from "../types.js";
import { SamePrecedenceStrategy } from "../types.js";
import { createActionRouter } from "./index.js";
import { CollisionPrecedence, DispatchPriority } from "./types.js";

function createCollisionPolicy(strategy: SamePrecedenceStrategy): CollisionPolicy {
  return {
    precedence_order: [
      CollisionPrecedence.SafetyAndHealth,
      CollisionPrecedence.TimeSensitiveDeadline,
      CollisionPrecedence.ActiveConversation,
      CollisionPrecedence.ScheduledReminder,
      CollisionPrecedence.ProactiveOutbound,
    ],
    same_precedence_strategy: strategy,
  };
}

function createDecision(
  priority: DispatchPriority,
  source: QueueItemSource = QueueItemSource.HumanMessage,
): WorkerDecision {
  return {
    queue_item: {
      id: "q_1",
      source,
      content: "test",
      concerning: ["participant_1"],
      target_thread: "participant_1_private",
      created_at: new Date("2026-04-03T12:00:00.000Z"),
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      priority,
    },
    classification: {
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      concerning: ["participant_1"],
    },
    identity: {
      source_entity_id: "participant_1",
      source_entity_type: "adult",
      thread_id: "participant_1_private",
      concerning: ["participant_1"],
    },
    action:
      priority === DispatchPriority.Silent
        ? {
            decision: "store",
            queue_item: {
              id: "q_1",
              source,
              content: "test",
              concerning: ["participant_1"],
              target_thread: "participant_1_private",
              created_at: new Date("2026-04-03T12:00:00.000Z"),
              topic: TopicKey.Chores,
              intent: ClassifierIntent.Request,
              priority,
            },
            reason: "silent",
          }
        : priority === DispatchPriority.Batched
          ? {
              decision: "hold",
              queue_item: {
                id: "q_1",
                source,
                content: "test",
                concerning: ["participant_1"],
                target_thread: "participant_1_private",
                created_at: new Date("2026-04-03T12:00:00.000Z"),
                topic: TopicKey.Chores,
                intent: ClassifierIntent.Request,
                priority,
              },
              hold_until: new Date("2026-04-03T12:30:00.000Z"),
              reason: "batched",
            }
          : {
              decision: "dispatch",
              outbound: {
                target_thread: "participant_1_private",
                content: "dispatch",
                priority,
                concerning: ["participant_1"],
              },
            },
  };
}

describe("ActionRouter", () => {
  it("routes immediate decisions to dispatch", async () => {
    const router = createActionRouter();
    const result = await router.route(
      createDecision(DispatchPriority.Immediate),
      createCollisionPolicy(SamePrecedenceStrategy.SpaceOut),
    );
    expect(result.decision).toBe("dispatch");
  });

  it("routes batched decisions to hold", async () => {
    const router = createActionRouter();
    const result = await router.route(
      createDecision(DispatchPriority.Batched),
      createCollisionPolicy(SamePrecedenceStrategy.SpaceOut),
    );
    expect(result.decision).toBe("hold");
  });

  it("routes silent decisions to store", async () => {
    const router = createActionRouter();
    const result = await router.route(
      createDecision(DispatchPriority.Silent),
      createCollisionPolicy(SamePrecedenceStrategy.SpaceOut),
    );
    expect(result.decision).toBe("store");
  });

  it("can batch immediate collisions when strategy is batch", async () => {
    const router = createActionRouter();
    const result = await router.route(
      createDecision(DispatchPriority.Immediate, QueueItemSource.ScheduledTrigger),
      createCollisionPolicy(SamePrecedenceStrategy.Batch),
    );
    expect(result.decision).toBe("hold");
  });
});
