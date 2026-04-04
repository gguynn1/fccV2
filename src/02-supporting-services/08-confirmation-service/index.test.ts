import { describe, expect, it } from "vitest";

import { installTestSystemConfig } from "../test-fixtures.js";
import { isAllowedConfirmationReplyThread } from "./index.js";

describe("confirmation-service helpers", () => {
  installTestSystemConfig();

  it("only allows requester private replies when policy explicitly permits it", () => {
    expect(
      isAllowedConfirmationReplyThread(
        {
          approval_thread_policy: "requester_private_allowed",
          requested_by: "participant_1",
        },
        "participant_1_private",
      ),
    ).toBe(true);
    expect(
      isAllowedConfirmationReplyThread(
        {
          approval_thread_policy: "requester_private_allowed",
          requested_by: "participant_1",
        },
        "participant_2_private",
      ),
    ).toBe(false);
  });

  it("rejects fallback replies when policy is exact-thread", () => {
    expect(
      isAllowedConfirmationReplyThread(
        {
          approval_thread_policy: "exact_thread",
          requested_by: "participant_1",
        },
        "participant_1_private",
      ),
    ).toBe(false);
  });
});
