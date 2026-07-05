import { describe, it, expect, beforeEach, vi } from "vitest";
import { canNudge, sendNudge, resetNotificationState, subscribeNotificationState } from "./notifications";
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
  maxNotificationFrequency: 10,
  projectCooldown: 30,
};

function installBrowserStubs() {
  const storage = new Map<string, string>();

  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
    },
    configurable: true,
  });

  Object.defineProperty(globalThis, "window", {
    value: {
      electronAPI: {
        isElectron: true as const,
        showNotification: vi.fn(),
        workflowyFetch: vi.fn(),
      },
    },
    configurable: true,
  });
}

beforeEach(() => {
  installBrowserStubs();
  resetNotificationState();
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

    vi.advanceTimersByTime(31 * 60_000);

    expect(canNudge("p1", settings).canNudge).toBe(true);
    vi.useRealTimers();
  });

  it("still blocks within the cooldown window even after global frequency passes", () => {
    vi.useFakeTimers();
    sendNudge(project, task, settings);

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

  it("passes dismissal settings to the notification", () => {
    sendNudge(project, task, {
      ...settings,
      notificationAutoDismiss: false,
      notificationDurationSeconds: 45,
    });

    const [, , options] = (
      window.electronAPI!.showNotification as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(options).toEqual({
      autoDismiss: false,
      durationMs: 45_000,
    });
  });

  it("returns false and does not send when blocked by cooldown", () => {
    sendNudge(project, task, settings);
    const sent = sendNudge(project, task, settings);
    expect(sent).toBe(false);
    expect(window.electronAPI!.showNotification).toHaveBeenCalledOnce();
  });
});

describe("subscribeNotificationState", () => {
  it("notifies listeners when notification state changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNotificationState(listener);

    sendNudge(project, task, settings);
    resetNotificationState();
    unsubscribe();
    sendNudge(project, task, settings);

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
