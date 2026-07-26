// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TaskList } from "./TaskList";
import type { Project, Task } from "../types";

afterEach(cleanup);

function task(id: string, done = false): Task {
  return {
    id,
    name: id,
    description: "",
    done,
    completedAt: done ? 1 : null,
    snoozedUntil: null,
    sourceId: "local-storage",
  };
}

function project(tasks: Task[]): Project {
  return {
    id: "p1",
    name: "P",
    color: "#aaa",
    nudgeMinutes: 25,
    active: true,
    tasks,
    sourceId: "local-storage",
  };
}

function noop() {}

it("reorders using the index in the full task array, not the filtered view", () => {
  // Full order: [A, done0, B]. With completed hidden, the visible list is [A, B].
  const tasks = [task("A"), task("done0", true), task("B")];
  const onReorder = vi.fn();

  render(
    <TaskList
      project={project(tasks)}
      showCompleted={false}
      onComplete={noop}
      onUncomplete={noop}
      onUnsnooze={noop}
      onEdit={noop}
      onDelete={noop}
      onReorder={onReorder}
      onAddTask={noop}
    />
  );

  // Drag A onto B. B is at index 2 in the full array (index 1 in the filtered view).
  const rowB = screen.getByText("B").closest("li")!;
  fireEvent.drop(rowB, {
    dataTransfer: { getData: () => "A" },
  });

  expect(onReorder).toHaveBeenCalledWith("A", 2);
});
