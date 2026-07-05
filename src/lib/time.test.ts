import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateNudgeSchedule,
  formatDuration,
  isQuietHours,
  isQuietHoursAt,
  quietHoursEndMs,
  taskAge,
} from "./time";
import { DEFAULT_SETTINGS } from "../types";
import type { Project, Task } from "../types";

function makeTask(id: string, snoozedUntil: number | null = null): Task {
  return {
    id,
    name: `Task ${id}`,
    description: "",
    done: false,
    completedAt: null,
    snoozedUntil,
    sourceId: "local-storage",
  };
}

function makeProject(id: string, task: Task, nudgeMinutes = 30): Project {
  return {
    id,
    name: `Project ${id}`,
    color: "#c8f04a",
    nudgeMinutes,
    active: true,
    tasks: [task],
    sourceId: "local-storage",
  };
}

function firstOpenTask(project: Project): Task | null {
  return project.tasks.find((task) => !task.done) ?? null;
}

describe("formatDuration", () => {
  it("formats sub-minute durations as seconds", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(59_999)).toBe("59s");
  });

  it("formats minute-range durations", () => {
    expect(formatDuration(60_000)).toBe("1m");
    expect(formatDuration(90_000)).toBe("1m");
    expect(formatDuration(2 * 60_000)).toBe("2m");
    expect(formatDuration(25 * 60_000)).toBe("25m");
  });

  it("formats hour-range durations", () => {
    expect(formatDuration(60 * 60_000)).toBe("1h 0m");
    expect(formatDuration(61 * 60_000)).toBe("1h 1m");
    expect(formatDuration(90 * 60_000)).toBe("1h 30m");
  });

  it("handles negative values using absolute value", () => {
    expect(formatDuration(-2 * 60_000)).toBe("2m");
  });
});

describe("taskAge", () => {
  const task = { id: "t1", sourceId: "local-storage" };

  it("returns near-zero when task has no recorded start time", () => {
    const age = taskAge({ id: "unknown-id", sourceId: "local-storage" }, {});
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(50);
  });

  it("returns elapsed milliseconds for a tracked task", () => {
    const start = Date.now() - 5_000;
    const age = taskAge(task, { "local-storage:t1": start });
    expect(age).toBeGreaterThanOrEqual(5_000);
    expect(age).toBeLessThan(5_300);
  });

  it("returns 0 for a task started right now", () => {
    const start = Date.now();
    const age = taskAge(task, { "local-storage:t1": start });
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(50);
  });
});

describe("isQuietHours", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe("overnight quiet hours (22-8)", () => {
    it("is quiet at 23:00", () => {
      vi.setSystemTime(new Date("2024-01-01T23:00:00"));
      expect(isQuietHours(22, 8)).toBe(true);
    });

    it("is quiet at 03:00", () => {
      vi.setSystemTime(new Date("2024-01-01T03:00:00"));
      expect(isQuietHours(22, 8)).toBe(true);
    });

    it("is quiet at exactly 22:00", () => {
      vi.setSystemTime(new Date("2024-01-01T22:00:00"));
      expect(isQuietHours(22, 8)).toBe(true);
    });

    it("is not quiet at 12:00", () => {
      vi.setSystemTime(new Date("2024-01-01T12:00:00"));
      expect(isQuietHours(22, 8)).toBe(false);
    });

    it("is not quiet at exactly 08:00 (end boundary is exclusive)", () => {
      vi.setSystemTime(new Date("2024-01-01T08:00:00"));
      expect(isQuietHours(22, 8)).toBe(false);
    });
  });

  describe("same-day quiet hours (13-16)", () => {
    it("is quiet at 14:00", () => {
      vi.setSystemTime(new Date("2024-01-01T14:00:00"));
      expect(isQuietHours(13, 16)).toBe(true);
    });

    it("is not quiet at 12:00", () => {
      vi.setSystemTime(new Date("2024-01-01T12:00:00"));
      expect(isQuietHours(13, 16)).toBe(false);
    });

    it("is not quiet at 17:00", () => {
      vi.setSystemTime(new Date("2024-01-01T17:00:00"));
      expect(isQuietHours(13, 16)).toBe(false);
    });
  });
});

describe("quiet-hour scheduling helpers", () => {
  it("checks quiet hours at an explicit time", () => {
    expect(isQuietHoursAt(22, 8, new Date("2024-01-01T23:00:00").getTime())).toBe(true);
    expect(isQuietHoursAt(22, 8, new Date("2024-01-02T08:00:00").getTime())).toBe(false);
  });

  it("returns the next quiet-hours end for an overnight window", () => {
    const end = new Date(quietHoursEndMs(22, 8, new Date("2024-01-01T23:00:00").getTime()));
    expect(end.getDate()).toBe(2);
    expect(end.getHours()).toBe(8);
    expect(end.getMinutes()).toBe(0);
  });
});

describe("calculateNudgeSchedule", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("groups ready projects by nudge batch size", () => {
    const now = new Date("2024-01-01T12:00:00").getTime();
    vi.setSystemTime(now);

    const tasks = [makeTask("t1"), makeTask("t2"), makeTask("t3")];
    const projects = tasks.map((task, index) => makeProject(`p${index + 1}`, task, 30));
    const schedule = calculateNudgeSchedule({
      projects,
      taskStartTimes: {
        "local-storage:t1": now - 31 * 60_000,
        "local-storage:t2": now - 31 * 60_000,
        "local-storage:t3": now - 31 * 60_000,
      },
      settings: { ...DEFAULT_SETTINGS, maxNotificationFrequency: 10, nudgeBatchSize: 2 },
      isSnoozed: (task) => task.snoozedUntil !== null && task.snoozedUntil > now,
      getNextTask: firstOpenTask,
      lastNotificationTime: 0,
      projectLastNotified: {},
      now,
    });

    expect(schedule.result.get("p1")).toBe(0);
    expect(schedule.result.get("p2")).toBe(0);
    expect(schedule.result.get("p3")).toBe(10 * 60_000);
  });

  it("accounts for global and project cooldowns", () => {
    const now = new Date("2024-01-01T12:00:00").getTime();
    vi.setSystemTime(now);

    const task = makeTask("t1");
    const project = makeProject("p1", task, 30);
    const schedule = calculateNudgeSchedule({
      projects: [project],
      taskStartTimes: { "local-storage:t1": now - 31 * 60_000 },
      settings: { ...DEFAULT_SETTINGS, maxNotificationFrequency: 10, projectCooldown: 30 },
      isSnoozed: (candidate) => candidate.snoozedUntil !== null && candidate.snoozedUntil > now,
      getNextTask: firstOpenTask,
      lastNotificationTime: now - 8 * 60_000,
      projectLastNotified: { p1: now - 25 * 60_000 },
      now,
    });

    expect(schedule.result.get("p1")).toBe(5 * 60_000);
  });

  it("uses snooze expiry as the next nudge time", () => {
    const now = new Date("2024-01-01T12:00:00").getTime();
    vi.setSystemTime(now);

    const task = makeTask("t1", now + 15 * 60_000);
    const project = makeProject("p1", task, 30);
    const schedule = calculateNudgeSchedule({
      projects: [project],
      taskStartTimes: { "local-storage:t1": now - 60 * 60_000 },
      settings: DEFAULT_SETTINGS,
      isSnoozed: (candidate) => candidate.snoozedUntil !== null && candidate.snoozedUntil > now,
      getNextTask: firstOpenTask,
      lastNotificationTime: 0,
      projectLastNotified: {},
      now,
    });

    expect(schedule.result.get("p1")).toBe(15 * 60_000);
  });
});
