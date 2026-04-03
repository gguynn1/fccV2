import type { StackQueueItem } from "../01-service-stack/types.js";
import { ClassifierIntent, DispatchPriority, QueueItemSource, TopicKey } from "../types.js";

export function fixtureNow(): Date {
  return new Date("2026-04-03T12:00:00.000Z");
}

export function fixtureQueueItem(overrides: Partial<StackQueueItem> = {}): StackQueueItem {
  return {
    id: "fixture_q_1",
    source: QueueItemSource.HumanMessage,
    content: "fixture content",
    concerning: ["participant_1"],
    target_thread: "participant_1_private",
    created_at: fixtureNow(),
    topic: TopicKey.FamilyStatus,
    intent: ClassifierIntent.Request,
    priority: DispatchPriority.Batched,
    ...overrides,
  };
}

export function fixtureThreadHistory() {
  return {
    active_topic_context: TopicKey.FamilyStatus,
    last_activity: fixtureNow(),
    recent_messages: [
      {
        id: "m_1",
        from: "participant_1",
        content: "fixture message",
        at: fixtureNow(),
        topic_context: TopicKey.FamilyStatus,
      },
    ],
  };
}
