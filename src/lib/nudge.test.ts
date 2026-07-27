import { describe, it, expect } from "vitest";
import { getNudgeLevel, nextIncompleteTask, isSnoozed } from "./nudge";
import type { Project, Task } from "../types";

function task(overrides: Partial<Task>): Task {
  return {
    id: "t",
    name: "T",
    description: "",
    done: false,
    completedAt: null,
    snoozedUntil: null,
    sourceId: "local-storage",
    ...overrides,
  };
}

describe("getNudgeLevel", () => {
  it("returns ok/warn/attention across the interval", () => {
    const interval = 100; // minutes → 6_000_000 ms
    expect(getNudgeLevel(0, interval)).toBe("ok");
    expect(getNudgeLevel(0.5 * 100 * 60_000, interval)).toBe("ok");
    expect(getNudgeLevel(0.8 * 100 * 60_000, interval)).toBe("warn");
    expect(getNudgeLevel(1.2 * 100 * 60_000, interval)).toBe("attention");
  });

  it("does not divide by zero when nudgeMinutes is 0", () => {
    const level = getNudgeLevel(5000, 0);
    expect(["ok", "warn", "attention"]).toContain(level);
    // Must not surface a NaN-driven result.
    expect(Number.isNaN(level as unknown as number)).toBe(false);
    expect(level).toBe("ok");
  });
});

describe("nextIncompleteTask", () => {
  it("returns the first not-done task, or null", () => {
    const p = { tasks: [task({ id: "a", done: true }), task({ id: "b" })] } as Project;
    expect(nextIncompleteTask(p)?.id).toBe("b");
    expect(nextIncompleteTask({ tasks: [] } as unknown as Project)).toBeNull();
  });
});

describe("isSnoozed", () => {
  it("is true only while the snooze is in the future", () => {
    expect(isSnoozed(task({ snoozedUntil: 2000 }), 1000)).toBe(true);
    expect(isSnoozed(task({ snoozedUntil: 500 }), 1000)).toBe(false);
    expect(isSnoozed(task({ snoozedUntil: null }), 1000)).toBe(false);
  });
});
