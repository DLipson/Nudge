import { describe, expect, it } from "vitest";
import type { Project, Task } from "../types";
import { syncActiveTaskStartTimes, taskTimingKey } from "./taskTiming";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    name: "Task",
    description: "",
    done: false,
    completedAt: null,
    snoozedUntil: null,
    sourceId: "workflowy",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: "project-1",
    name: "Project",
    color: "#aaa",
    nudgeMinutes: 25,
    active: true,
    tasks: [],
    sourceId: "workflowy",
    ...overrides,
  };
}

describe("taskTimingKey", () => {
  it("prefixes task ids by source", () => {
    expect(taskTimingKey(makeTask({ id: "abc", sourceId: "workflowy" }))).toBe(
      "workflowy:abc"
    );
  });
});

describe("syncActiveTaskStartTimes", () => {
  it("starts timing the first incomplete active task using a source-prefixed key", () => {
    const task = makeTask({ id: "task-1", sourceId: "workflowy" });
    const project = makeProject({ tasks: [task] });

    const result = syncActiveTaskStartTimes([project], {}, 1000);

    expect(result.changed).toBe(true);
    expect(result.taskStartTimes).toEqual({ "workflowy:task-1": 1000 });
  });

  it("preserves timing when a Workflowy task name changes but the node id stays the same", () => {
    const existing = { "workflowy:task-1": 1000 };
    const renamedTask = makeTask({
      id: "task-1",
      name: "Renamed task",
      sourceId: "workflowy",
    });

    const result = syncActiveTaskStartTimes(
      [makeProject({ tasks: [renamedTask] })],
      existing,
      2000
    );

    expect(result.changed).toBe(false);
    expect(result.taskStartTimes).toEqual(existing);
  });

  it("migrates legacy raw task ids to source-prefixed keys", () => {
    const task = makeTask({ id: "task-1", sourceId: "local-storage" });

    const result = syncActiveTaskStartTimes(
      [makeProject({ sourceId: "local-storage", tasks: [task] })],
      { "task-1": 1000 },
      2000
    );

    expect(result.changed).toBe(true);
    expect(result.taskStartTimes).toEqual({ "local-storage:task-1": 1000 });
  });

  it("tracks same task ids from different sources independently", () => {
    const localTask = makeTask({ id: "shared-id", sourceId: "local-storage" });
    const workflowyTask = makeTask({ id: "shared-id", sourceId: "workflowy" });

    const result = syncActiveTaskStartTimes(
      [
        makeProject({
          id: "local-project",
          sourceId: "local-storage",
          tasks: [localTask],
        }),
        makeProject({
          id: "workflowy-project",
          sourceId: "workflowy",
          tasks: [workflowyTask],
        }),
      ],
      {},
      1000
    );

    expect(result.taskStartTimes).toEqual({
      "local-storage:shared-id": 1000,
      "workflowy:shared-id": 1000,
    });
  });

  it("preserves an active task's start time when its project is paused", () => {
    const task = makeTask({ id: "t1", sourceId: "local-storage" });
    const active = makeProject({
      id: "p1",
      sourceId: "local-storage",
      active: true,
      tasks: [task],
    });

    const first = syncActiveTaskStartTimes([active], {}, 1000);
    expect(first.taskStartTimes).toEqual({ "local-storage:t1": 1000 });

    // Pause the project — the accumulated age must not be discarded.
    const paused = { ...active, active: false };
    const second = syncActiveTaskStartTimes(
      [paused],
      first.taskStartTimes,
      5000
    );

    expect(second.changed).toBe(false);
    expect(second.taskStartTimes).toEqual({ "local-storage:t1": 1000 });
  });

  it("prunes start times for tasks that no longer exist in any project", () => {
    const task = makeTask({ id: "t1", sourceId: "workflowy" });
    const project = makeProject({
      id: "p1",
      sourceId: "workflowy",
      tasks: [task],
    });

    const result = syncActiveTaskStartTimes(
      [project],
      {
        "workflowy:t1": 1000, // still exists — keep
        "workflowy:gone": 500, // removed remotely — should be pruned
      },
      2000
    );

    expect(result.changed).toBe(true);
    expect(result.taskStartTimes).toEqual({ "workflowy:t1": 1000 });
  });

  it("does not reset the clock to now when a paused project is resumed", () => {
    const task = makeTask({ id: "t1", sourceId: "local-storage" });
    const project = makeProject({
      id: "p1",
      sourceId: "local-storage",
      tasks: [task],
    });

    const started = syncActiveTaskStartTimes([project], {}, 1000);
    const paused = syncActiveTaskStartTimes(
      [{ ...project, active: false }],
      started.taskStartTimes,
      5000
    );
    const resumed = syncActiveTaskStartTimes(
      [{ ...project, active: true }],
      paused.taskStartTimes,
      9000
    );

    // Original start time survives the pause/resume round-trip.
    expect(resumed.taskStartTimes).toEqual({ "local-storage:t1": 1000 });
  });
});
