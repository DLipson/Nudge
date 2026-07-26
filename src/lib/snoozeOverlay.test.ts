// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  applySnoozeOverlay,
  loadSnoozeOverlay,
  saveSnoozeOverlay,
} from "./snoozeOverlay";
import type { Project, Task } from "../types";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    name: "Task",
    description: "",
    done: false,
    completedAt: null,
    snoozedUntil: null,
    sourceId: "workflowy",
    ...overrides,
  };
}

function makeProject(tasks: Task[]): Project {
  return {
    id: "p1",
    name: "Project",
    color: "#aaa",
    nudgeMinutes: 25,
    active: true,
    tasks,
    sourceId: "workflowy",
  };
}

describe("applySnoozeOverlay", () => {
  it("sets snoozedUntil on a task whose key is snoozed in the future", () => {
    const task = makeTask({ id: "abc", sourceId: "workflowy" });
    const [project] = applySnoozeOverlay(
      [makeProject([task])],
      { "workflowy:abc": 5000 },
      1000
    );
    expect(project.tasks[0].snoozedUntil).toBe(5000);
  });

  it("ignores expired overlay entries", () => {
    const task = makeTask({ id: "abc", sourceId: "workflowy" });
    const [project] = applySnoozeOverlay(
      [makeProject([task])],
      { "workflowy:abc": 500 },
      1000
    );
    expect(project.tasks[0].snoozedUntil).toBeNull();
  });

  it("does not mutate the input projects or tasks", () => {
    const task = makeTask({ id: "abc", sourceId: "workflowy" });
    const input = makeProject([task]);
    applySnoozeOverlay([input], { "workflowy:abc": 5000 }, 1000);
    expect(input.tasks[0].snoozedUntil).toBeNull();
  });

  it("leaves tasks without an overlay entry untouched", () => {
    const task = makeTask({ id: "abc", snoozedUntil: 9999 });
    const [project] = applySnoozeOverlay([makeProject([task])], {}, 1000);
    expect(project.tasks[0].snoozedUntil).toBe(9999);
  });
});

describe("loadSnoozeOverlay / saveSnoozeOverlay", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips an overlay through localStorage", () => {
    saveSnoozeOverlay({ "workflowy:abc": 5000 });
    expect(loadSnoozeOverlay()).toEqual({ "workflowy:abc": 5000 });
  });

  it("returns an empty overlay when nothing is stored", () => {
    expect(loadSnoozeOverlay()).toEqual({});
  });

  it("returns an empty overlay when stored data is corrupt", () => {
    localStorage.setItem("nudge-snooze-overlay", "not json");
    expect(loadSnoozeOverlay()).toEqual({});
  });
});
