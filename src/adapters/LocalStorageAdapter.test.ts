// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageAdapter } from "./LocalStorageAdapter";

async function makeAdapter(): Promise<LocalStorageAdapter> {
  localStorage.clear();
  const adapter = new LocalStorageAdapter();
  await adapter.connect();
  return adapter;
}

describe("LocalStorageAdapter", () => {
  beforeEach(() => localStorage.clear());

  describe("projects", () => {
    it("starts with sample data when storage is empty", async () => {
      const adapter = await makeAdapter();
      const projects = await adapter.fetchProjects();
      expect(projects.length).toBeGreaterThan(0);
    });

    it("addProject creates a project that can be fetched", async () => {
      const adapter = await makeAdapter();
      const project = await adapter.addProject!("My Project", "#ff0000", 30);
      expect(project.name).toBe("My Project");
      expect(project.color).toBe("#ff0000");
      expect(project.nudgeMinutes).toBe(30);
      expect(project.tasks).toHaveLength(0);
    });

    it("updateProject changes name, color, and nudgeMinutes", async () => {
      const adapter = await makeAdapter();
      const project = await adapter.addProject!("Old Name", "#aaa", 25);
      await adapter.updateProject!(project.id, "New Name", "#bbb", 15);
      const projects = await adapter.fetchProjects();
      const updated = projects.find((p) => p.id === project.id)!;
      expect(updated.name).toBe("New Name");
      expect(updated.color).toBe("#bbb");
      expect(updated.nudgeMinutes).toBe(15);
    });

    it("deleteProject removes it from the list", async () => {
      const adapter = await makeAdapter();
      const project = await adapter.addProject!("To Delete", "#aaa", 25);
      await adapter.deleteProject!(project.id);
      const projects = await adapter.fetchProjects();
      expect(projects.find((p) => p.id === project.id)).toBeUndefined();
    });

    it("toggleProjectActive flips the active flag", async () => {
      const adapter = await makeAdapter();
      const project = await adapter.addProject!("Toggle Me", "#aaa", 25);
      expect(project.active).toBe(true);

      adapter.toggleProjectActive(project.id);
      const projects = await adapter.fetchProjects();
      expect(projects.find((p) => p.id === project.id)!.active).toBe(false);

      adapter.toggleProjectActive(project.id);
      const projects2 = await adapter.fetchProjects();
      expect(projects2.find((p) => p.id === project.id)!.active).toBe(true);
    });
  });

  describe("tasks", () => {
    it("addTask appends a task to the project", async () => {
      const adapter = await makeAdapter();
      const project = await adapter.addProject!("P", "#aaa", 25);
      const task = await adapter.addTask!(project.id, "My Task", "desc");
      expect(task.name).toBe("My Task");
      expect(task.description).toBe("desc");
      expect(task.done).toBe(false);

      const tasks = await adapter.fetchTasks(project.id);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(task.id);
    });

    it("completeTask marks a task done", async () => {
      const adapter = await makeAdapter();
      const project = await adapter.addProject!("P", "#aaa", 25);
      const task = await adapter.addTask!(project.id, "Task", "");
      await adapter.completeTask!(task.id);

      const tasks = await adapter.fetchTasks(project.id);
      const completed = tasks.find((t) => t.id === task.id)!;
      expect(completed.done).toBe(true);
      expect(completed.completedAt).not.toBeNull();
    });

    it("uncompleteTask marks a task undone", async () => {
      const adapter = await makeAdapter();
      const project = await adapter.addProject!("P", "#aaa", 25);
      const task = await adapter.addTask!(project.id, "Task", "");
      await adapter.completeTask!(task.id);
      await adapter.uncompleteTask!(task.id);

      const tasks = await adapter.fetchTasks(project.id);
      const t = tasks.find((t) => t.id === task.id)!;
      expect(t.done).toBe(false);
      expect(t.completedAt).toBeNull();
    });

    it("snoozeTask sets snoozedUntil in the future", async () => {
      const adapter = await makeAdapter();
      const project = await adapter.addProject!("P", "#aaa", 25);
      const task = await adapter.addTask!(project.id, "Task", "");
      const before = Date.now();
      adapter.snoozeTask(task.id, 15);

      const tasks = await adapter.fetchTasks(project.id);
      const snoozed = tasks.find((t) => t.id === task.id)!;
      expect(snoozed.snoozedUntil).not.toBeNull();
      expect(snoozed.snoozedUntil!).toBeGreaterThan(before + 14 * 60_000);
    });

    it("unsnoozeTask clears snoozedUntil", async () => {
      const adapter = await makeAdapter();
      const project = await adapter.addProject!("P", "#aaa", 25);
      const task = await adapter.addTask!(project.id, "Task", "");
      adapter.snoozeTask(task.id, 15);
      adapter.unsnoozeTask(task.id);

      const tasks = await adapter.fetchTasks(project.id);
      expect(tasks.find((t) => t.id === task.id)!.snoozedUntil).toBeNull();
    });
  });

  describe("task ordering", () => {
    async function makeProjectWithTasks(adapter: LocalStorageAdapter) {
      const project = await adapter.addProject!("P", "#aaa", 25);
      const a = await adapter.addTask!(project.id, "A", "");
      const b = await adapter.addTask!(project.id, "B", "");
      const c = await adapter.addTask!(project.id, "C", "");
      return { project, a, b, c };
    }

    it("moveTaskToEnd moves the first task to the end", async () => {
      const adapter = await makeAdapter();
      const { project, a } = await makeProjectWithTasks(adapter);
      adapter.moveTaskToEnd(project.id, a.id);
      const tasks = await adapter.fetchTasks(project.id);
      expect(tasks.map((t) => t.name)).toEqual(["B", "C", "A"]);
    });

    it("reorderTask moves a task to a specific index", async () => {
      const adapter = await makeAdapter();
      const { project, a } = await makeProjectWithTasks(adapter);
      // Move A (index 0) to index 2
      adapter.reorderTask(project.id, a.id, 2);
      const tasks = await adapter.fetchTasks(project.id);
      expect(tasks.map((t) => t.name)).toEqual(["B", "C", "A"]);
    });

    it("reorderTask moving to same index is a no-op", async () => {
      const adapter = await makeAdapter();
      const { project, a } = await makeProjectWithTasks(adapter);
      adapter.reorderTask(project.id, a.id, 0);
      const tasks = await adapter.fetchTasks(project.id);
      expect(tasks.map((t) => t.name)).toEqual(["A", "B", "C"]);
    });
  });

  describe("persistence", () => {
    it("persists state across adapter instances", async () => {
      localStorage.clear();
      const adapter1 = new LocalStorageAdapter();
      await adapter1.connect();
      await adapter1.addProject!("Persisted", "#aaa", 25);

      const adapter2 = new LocalStorageAdapter();
      await adapter2.connect();
      const projects = await adapter2.fetchProjects();
      expect(projects.some((p) => p.name === "Persisted")).toBe(true);
    });
  });
});
