import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClassifierIntent, QueueItemSource, TopicKey } from "../../types.js";
import type { StackQueueItem } from "../types.js";
import { createClassifierService } from "./index.js";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    public messages = {
      create: createMock,
    };
  }
  return { default: MockAnthropic };
});

describe("ClaudeClassifierService interpretAction", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("parses resolved interpreter payload", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            kind: "resolved",
            topic: TopicKey.Grocery,
            intent: ClassifierIntent.Request,
            action: { type: "add_items", items: [{ item: "milk" }] },
          }),
        },
      ],
    });
    const classifier = createClassifierService({
      anthropic_api_key: "test",
      state_service: {
        getThreadHistory: () => Promise.resolve(null),
      } as never,
    });
    const queueItem: StackQueueItem = {
      id: "q1",
      source: QueueItemSource.HumanMessage,
      content: "add milk",
      concerning: ["participant_1"],
      target_thread: "family",
      created_at: new Date("2026-04-04T12:00:00.000Z"),
    };

    const result = await classifier.interpretAction({
      queue_item: queueItem,
      classification: {
        topic: TopicKey.Grocery,
        intent: ClassifierIntent.Request,
        concerning: queueItem.concerning,
      },
      thread_history: null,
      scoped_content: "add milk",
    });

    expect(result?.kind).toBe("resolved");
    expect(result && "action" in result ? result.action.type : null).toBe("add_items");
  });
});
