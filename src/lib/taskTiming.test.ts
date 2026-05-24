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
});
