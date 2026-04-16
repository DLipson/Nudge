// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { canNudge, sendNudge, resetNotificationState } from "./notifications";
import { DEFAULT_SETTINGS } from "../types";
import type { Project, Task } from "../types";

const project: Project = {
  id: "p1",
  name: "Test Project",
  color: "#c8f04a",
  nudgeMinutes: 25,
  active: true,
  tasks: [],
  sourceId: "local-storage",
};

const task: Task = {
  id: "t1",
  name: "Do the thing",
  description: "",
  done: false,
  completedAt: null,
  snoozedUntil: null,
  sourceId: "local-storage",
};

const settings = {
  ...DEFAULT_SETTINGS,
  maxNotificationFrequency: 10, // minutes
  projectCooldown: 30,          // minutes
};

beforeEach(() => {
  resetNotificationState();
  Object.defineProperty(window, "electronAPI", {
    value: {
      isElectron: true as const,
      showNotification: vi.fn(),
      workflowyFetch: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
});

describe("canNudge", () => {
  it("allows nudge when no notifications have been sent", () => {
    expect(canNudge("p1", settings).canNudge).toBe(true);
  });

  it("blocks nudge immediately after one is sent", () => {
    sendNudge(project, task, settings);
    expect(canNudge("p1", settings).canNudge).toBe(false);
  });

  it("blocks nudge for a different project within the global frequency window", () => {
    sendNudge(project, task, settings);
    expect(canNudge("p2", settings).canNudge).toBe(false);
  });

  it("allows nudge after both frequency and cooldown windows have passed", () => {
    vi.useFakeTimers();
    sendNudge(project, task, settings);

    // Advance past projectCooldown (30 min) which is the longer limit
    vi.advanceTimersByTime(31 * 60_000);

    expect(canNudge("p1", settings).canNudge).toBe(true);
    vi.useRealTimers();
  });

  it("still blocks within the cooldown window even after global frequency passes", () => {
    vi.useFakeTimers();
    sendNudge(project, task, settings);

    // Past global frequency (10 min) but not past project cooldown (30 min)
    vi.advanceTimersByTime(15 * 60_000);

    expect(canNudge("p1", settings).canNudge).toBe(false);
    vi.useRealTimers();
  });

  it("includes a human-readable reason when blocked", () => {
    sendNudge(project, task, settings);
    const result = canNudge("p1", settings);
    expect(result.canNudge).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

describe("sendNudge", () => {
  it("sends a notification and returns true", () => {
    const sent = sendNudge(project, task, settings);
    expect(sent).toBe(true);
    expect(window.electronAPI!.showNotification).toHaveBeenCalledOnce();
  });

  it("passes project and task names to the notification", () => {
    sendNudge(project, task, settings);
    const [title, body] = (window.electronAPI!.showNotification as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(title).toContain(project.name);
    expect(body).toContain(task.name);
  });

  it("returns false and does not send when blocked by cooldown", () => {
    sendNudge(project, task, settings);
    const sent = sendNudge(project, task, settings);
    expect(sent).toBe(false);
    expect(window.electronAPI!.showNotification).toHaveBeenCalledOnce();
  });
});
