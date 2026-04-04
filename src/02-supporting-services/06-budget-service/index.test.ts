import { describe, expect, it } from "vitest";

import { matchesBudgetPauseSignal, quietHoursRemainingMs } from "./index.js";

describe("budget-service helpers", () => {
  it("detects real quiet signals without matching ordinary phrasing", () => {
    expect(matchesBudgetPauseSignal("not now")).toBe(true);
    expect(matchesBudgetPauseSignal("please stop")).toBe(true);
    expect(matchesBudgetPauseSignal("stop by the store later")).toBe(false);
  });

  it("calculates overnight quiet hours correctly", () => {
    const now = new Date(2026, 3, 3, 22, 30, 0, 0);
    const remaining = quietHoursRemainingMs(now, { start: "21:00", end: "07:00" });
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBe(8.5 * 60 * 60 * 1000);
  });

  it("returns zero when outside quiet hours", () => {
    const now = new Date(2026, 3, 3, 12, 0, 0, 0);
    expect(quietHoursRemainingMs(now, { start: "21:00", end: "07:00" })).toBe(0);
  });
});
