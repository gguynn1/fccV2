import { describe, expect, it } from "vitest";

import { installTestSystemConfig } from "../../02-supporting-services/test-fixtures.js";
import { ClassifierIntent, TopicKey } from "../../types.js";
import { createRoutingService } from "./index.js";

describe("RoutingService decision table", () => {
  installTestSystemConfig();
  const service = createRoutingService();

  it("routes responses to the origin thread", async () => {
    const target = await service.resolveTargetThread({
      topic: TopicKey.Chores,
      intent: ClassifierIntent.Response,
      concerning: ["participant_3"],
      origin_thread: "family",
      is_response: true,
    });

    expect(target).toBe("family");
  });

  it("routes single-entity proactive items to private thread", async () => {
    const target = await service.resolveTargetThread({
      topic: TopicKey.Health,
      intent: ClassifierIntent.Update,
      concerning: ["participant_2"],
      origin_thread: "family",
      is_response: false,
    });

    expect(target).toBe("participant_2_private");
  });

  it("routes multi-entity proactive items to narrowest shared thread", async () => {
    const target = await service.resolveTargetThread({
      topic: TopicKey.Finances,
      intent: ClassifierIntent.Query,
      concerning: ["participant_1", "participant_2"],
      origin_thread: "family",
      is_response: false,
    });

    expect(target).toBe("couple");
  });

  it("respects topic never-thread constraints for proactive routing", async () => {
    const target = await service.resolveTargetThread({
      topic: TopicKey.Relationship,
      intent: ClassifierIntent.Request,
      concerning: ["participant_1", "participant_2"],
      origin_thread: "family",
      is_response: false,
    });

    expect(target).toBe("couple");
  });

  it("routes pet proactive messages to responsible adult private thread", async () => {
    const target = await service.resolveTargetThread({
      topic: TopicKey.Pets,
      intent: ClassifierIntent.Request,
      concerning: ["pet_1"],
      origin_thread: "family",
      is_response: false,
    });

    expect(target).toBe("participant_1_private");
  });

  it("keeps finance proactive routing in the couple thread even for one adult", async () => {
    const target = await service.resolveTargetThread({
      topic: TopicKey.Finances,
      intent: ClassifierIntent.Update,
      concerning: ["participant_1"],
      origin_thread: "participant_1_private",
      is_response: false,
    });

    expect(target).toBe("couple");
  });

  it("reroutes health responses away from shared threads into a safe private thread", async () => {
    const target = await service.resolveTargetThread({
      topic: TopicKey.Health,
      intent: ClassifierIntent.Response,
      concerning: ["participant_1"],
      origin_thread: "family",
      is_response: true,
    });

    expect(target).toBe("participant_1_private");
  });
});
