import { describe, expect, it, vi } from "vitest";

import type { StackQueueItem } from "../../01-service-stack/types.js";
import {
  createTestSystemState,
  installTestSystemConfig,
} from "../../02-supporting-services/test-fixtures.js";
import { QueueItemSource, TopicKey } from "../../types.js";
import type { SystemState } from "../03-state-service/types.js";
import { createDataIngestService } from "./index.js";

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

function createStateServiceStub() {
  const config = installTestSystemConfig();
  const state: SystemState = createTestSystemState();
  return {
    getSystemConfig: vi.fn(() => resolved(config)),
    saveSystemConfig: vi.fn(() => resolved(undefined)),
    getSystemState: vi.fn(() => resolved(state)),
    saveSystemState: vi.fn((nextState: SystemState) => {
      Object.assign(state, nextState);
      return resolved(undefined);
    }),
    getThreadHistory: vi.fn(() => resolved(null)),
    saveThreadHistory: vi.fn(() => resolved(undefined)),
    appendDispatchResult: vi.fn(() => resolved(undefined)),
  };
}

describe("DataIngestService", () => {
  it("normalizes forwarded content into a queue item", async () => {
    const service = createDataIngestService({
      state_service: createStateServiceStub(),
    });

    const item = await service.processForwardedContent(
      "School update: science project due tomorrow",
      "family",
      new Date("2026-04-03T19:00:00.000Z"),
    );

    expect(item.source).toBe(QueueItemSource.DataIngest);
    expect(item.topic).toBe(TopicKey.School);
    expect(item.target_thread).toBe("family");
  });

  it("parses calendar attachments into calendar queue items", async () => {
    const queued: Array<{ id?: string; topic?: TopicKey }> = [];
    const service = createDataIngestService({
      state_service: createStateServiceStub(),
      queue_service: {
        enqueue: vi.fn((item: StackQueueItem) => {
          queued.push({ id: item.id, topic: item.topic });
          return resolved(undefined);
        }),
      },
    });

    const items = await service.processInboxMessage({
      message_id: "msg-1",
      inbox_address: "shared@example.com",
      received_at: new Date("2026-04-03T19:10:00.000Z"),
      from: "office@example.com",
      subject: "Appointment confirmation",
      text: "Attached is your appointment file.",
      attachments: [
        {
          filename: "invite.ics",
          content_type: "text/calendar",
          content: `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:test-uid
SUMMARY:Dentist Appointment
DTSTART:20260405T160000Z
DTEND:20260405T170000Z
LOCATION:Smile Dental
END:VEVENT
END:VCALENDAR`,
        },
      ],
    });

    expect(items.some((item) => item.topic === TopicKey.Calendar)).toBe(true);
    expect(queued.some((item) => item.topic === TopicKey.Calendar)).toBe(true);
  });

  it("quarantines ambiguous inbox attribution into the operator private thread", async () => {
    const service = createDataIngestService({
      state_service: createStateServiceStub(),
    });

    const items = await service.processInboxMessage({
      message_id: "msg-2",
      inbox_address: "unknown@example.com",
      received_at: new Date("2026-04-03T19:20:00.000Z"),
      from: "updates@example.com",
      subject: "General reminder",
      text: "Reminder: something changed.",
      attachments: [],
    });

    expect(items[0]?.target_thread).toBe("participant_1_private");
    expect(items[0]?.priority).toBe("silent");
  });
});
