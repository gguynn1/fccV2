import { describe, expect, it } from "vitest";

import {
  createTestSystemState,
  installTestSystemConfig,
} from "../../02-supporting-services/test-fixtures.js";
import {
  ClassifierIntent,
  DispatchPriority,
  QueueItemSource,
  QueueItemType,
  TopicKey,
} from "../../types.js";
import { createSchedulerService } from "./index.js";
import { ScheduledEventType } from "./types.js";

function localDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function createStateService() {
  const state = createTestSystemState();
  state.queue.pending = [
    {
      id: "held_due",
      source: QueueItemSource.HumanMessage,
      type: QueueItemType.Inbound,
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      concerning: ["participant_1"],
      content: "Take out trash",
      priority: DispatchPriority.Batched,
      target_thread: "participant_1_private",
      created_at: localDate(2026, 4, 2, 18, 0),
      hold_until: localDate(2026, 4, 3, 6, 45),
    },
    {
      id: "held_future",
      source: QueueItemSource.HumanMessage,
      type: QueueItemType.Inbound,
      topic: TopicKey.School,
      intent: ClassifierIntent.Request,
      concerning: ["participant_1"],
      content: "Finish reading log",
      priority: DispatchPriority.Batched,
      target_thread: "participant_1_private",
      created_at: localDate(2026, 4, 3, 6, 50),
      hold_until: localDate(2026, 4, 3, 8, 15),
    },
    {
      id: "held_other_person",
      source: QueueItemSource.HumanMessage,
      type: QueueItemType.Inbound,
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Request,
      concerning: ["participant_3"],
      content: "Feed the pet",
      priority: DispatchPriority.Batched,
      target_thread: "participant_3_private",
      created_at: localDate(2026, 4, 3, 7, 0),
      hold_until: localDate(2026, 4, 3, 7, 5),
    },
  ];
  state.queue.recently_dispatched = [
    {
      id: "yesterday_unresolved",
      topic: TopicKey.Calendar,
      target_thread: "participant_1_private",
      content: "Dentist tomorrow at 9",
      dispatched_at: localDate(2026, 4, 2, 18, 30),
      priority: DispatchPriority.Batched,
      response_received: false,
      included_in: "morning_digest",
    },
    {
      id: "today_unresolved",
      topic: TopicKey.Calendar,
      target_thread: "participant_1_private",
      content: "Same-day reminder",
      dispatched_at: localDate(2026, 4, 3, 6, 30),
      priority: DispatchPriority.Batched,
      response_received: false,
      included_in: "morning_digest",
    },
  ];

  return {
    getSystemState: () => Promise.resolve(state),
    saveSystemState: () => Promise.resolve(),
  };
}

function createService() {
  const config = installTestSystemConfig();
  return createSchedulerService({
    redis_url: "redis://127.0.0.1:6379",
    timezone: config.system.timezone,
    daily_rhythm: config.daily_rhythm,
    state_service: createStateService() as never,
  });
}

describe("BullSchedulerService", () => {
  it("releases due held items without leaving stale ids behind", async () => {
    const scheduler = createService();
    const dueAt = localDate(2026, 4, 3, 7, 0);

    const items = await scheduler.produceScheduledItemsForEvent({
      id: "morning_digest_tick",
      type: ScheduledEventType.MorningDigest,
      due_at: dueAt,
      payload: {},
    });

    expect(items.map((item) => item.id)).toContain("held_due");
    expect(items.map((item) => item.id)).not.toContain("held_future");
    expect(items.map((item) => item.id)).not.toContain("held_other_person");

    const released = items.find((item) => item.id === "held_due");
    expect(released).toMatchObject({
      id: "held_due",
      source: "scheduled_trigger",
      hold_until: undefined,
      target_thread: "participant_1_private",
    });
    expect(released?.created_at).toEqual(dueAt);
  });

  it("only carries unresolved prior-day items into the morning digest", async () => {
    const scheduler = createService();
    const dueAt = localDate(2026, 4, 3, 7, 0);

    const morningItems = await scheduler.produceScheduledItemsForEvent({
      id: "morning_digest_tick",
      type: ScheduledEventType.MorningDigest,
      due_at: dueAt,
      payload: {},
    });
    const eveningItems = await scheduler.produceScheduledItemsForEvent({
      id: "evening_checkin_tick",
      type: ScheduledEventType.EveningCheckin,
      due_at: localDate(2026, 4, 3, 20, 0),
      payload: {},
    });

    expect(morningItems.map((item) => item.id)).toContain(
      `sched_unresolved_yesterday_unresolved_${dueAt.getTime()}`,
    );
    expect(morningItems.map((item) => item.id)).not.toContain(
      `sched_unresolved_today_unresolved_${dueAt.getTime()}`,
    );
    expect(eveningItems.some((item) => item.id.startsWith("sched_unresolved_"))).toBe(false);
  });

  it("reports stale skipped windows during startup recovery", async () => {
    const scheduler = createService();

    const result = await scheduler.recoverMissedWindowsDetailed(localDate(2026, 4, 3, 12, 30));

    expect(result.produced).toEqual([]);
    expect(result.skipped_stale).toBe(2);
  });
});
