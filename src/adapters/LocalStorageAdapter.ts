import type { TaskSourceAdapter } from "./types";
import type { Project, Task, Settings, AppState } from "../types";
import { DEFAULT_SETTINGS, COLORS } from "../types";
import { uid } from "../lib/uid";

const STORAGE_KEY = "nudge_v4";

/**
 * LocalStorageAdapter
 *
 * The default adapter that stores everything in browser localStorage.
 * This is the fallback when no external sources are configured.
 * Provides full read/write functionality.
 */
export class LocalStorageAdapter implements TaskSourceAdapter {
  readonly id = "local-storage";
  readonly name = "Local Storage";

  private connected = false;
  private lastSync: number | null = null;
  private state: AppState | null = null;

  // ── Connection ────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.state = this.loadFromStorage();
    this.connected = true;
    this.lastSync = Date.now();
  }

  async disconnect(): Promise<void> {
    this.persist();
    this.connected = false;
    this.state = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── Read Operations ───────────────────────────────────────────────────────

  async fetchProjects(): Promise<Project[]> {
    if (!this.state) throw new Error("Adapter not connected");
    return this.state.projects;
  }

  async fetchTasks(projectId: string): Promise<Task[]> {
    if (!this.state) throw new Error("Adapter not connected");
    const project = this.state.projects.find((p) => p.id === projectId);
    return project?.tasks ?? [];
  }

  // ── Write Operations ──────────────────────────────────────────────────────

  async completeTask(taskId: string): Promise<void> {
    if (!this.state) throw new Error("Adapter not connected");

    for (const project of this.state.projects) {
      const task = project.tasks.find((t) => t.id === taskId);
      if (task) {
        task.done = true;
        task.completedAt = Date.now();
        delete this.state.taskStartTimes[taskId];
        this.persist();
        return;
      }
    }
  }

  async uncompleteTask(taskId: string): Promise<void> {
    if (!this.state) throw new Error("Adapter not connected");

    for (const project of this.state.projects) {
      const task = project.tasks.find((t) => t.id === taskId);
      if (task) {
        task.done = false;
        task.completedAt = null;
        this.persist();
        return;
      }
    }
  }

  async addTask(
    projectId: string,
    name: string,
    description: string
  ): Promise<Task> {
    if (!this.state) throw new Error("Adapter not connected");

    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Project not found");

    const task: Task = {
      id: uid(),
      name,
      description,
      done: false,
      completedAt: null,
      snoozedUntil: null,
      sourceId: this.id,
    };

    project.tasks.push(task);
    this.persist();
    return task;
  }

  async updateTask(
    taskId: string,
    name: string,
    description: string
  ): Promise<void> {
    if (!this.state) throw new Error("Adapter not connected");

    for (const project of this.state.projects) {
      const task = project.tasks.find((t) => t.id === taskId);
      if (task) {
        task.name = name;
        task.description = description;
        this.persist();
        return;
      }
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!this.state) throw new Error("Adapter not connected");

    for (const project of this.state.projects) {
      const idx = project.tasks.findIndex((t) => t.id === taskId);
      if (idx >= 0) {
        project.tasks.splice(idx, 1);
        delete this.state.taskStartTimes[taskId];
        this.persist();
        return;
      }
    }
  }

  async addProject(
    name: string,
    color: string,
    nudgeMinutes: number
  ): Promise<Project> {
    if (!this.state) throw new Error("Adapter not connected");

    const project: Project = {
      id: uid(),
      name,
      color,
      nudgeMinutes,
      active: true,
      tasks: [],
      sourceId: this.id,
    };

    this.state.projects.push(project);
    this.persist();
    return project;
  }

  async updateProject(
    projectId: string,
    name: string,
    color: string,
    nudgeMinutes: number
  ): Promise<void> {
    if (!this.state) throw new Error("Adapter not connected");

    const project = this.state.projects.find((p) => p.id === projectId);
    if (project) {
      project.name = name;
      project.color = color;
      project.nudgeMinutes = nudgeMinutes;
      this.persist();
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    if (!this.state) throw new Error("Adapter not connected");

    const project = this.state.projects.find((p) => p.id === projectId);
    if (project) {
      // Clean up task start times
      project.tasks.forEach((t) => delete this.state!.taskStartTimes[t.id]);
      this.state.projects = this.state.projects.filter(
        (p) => p.id !== projectId
      );
      this.persist();
    }
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  getLastSyncTime(): number | null {
    return this.lastSync;
  }

  async sync(): Promise<void> {
    // LocalStorage is always in sync, just update timestamp
    this.lastSync = Date.now();
  }

  // ── Additional methods for local state management ─────────────────────────

  getSettings(): Settings {
    if (!this.state) throw new Error("Adapter not connected");
    return this.state.settings;
  }

  updateSettings(settings: Partial<Settings>): void {
    if (!this.state) throw new Error("Adapter not connected");
    Object.assign(this.state.settings, settings);
    this.persist();
  }

  getTaskStartTimes(): Record<string, number> {
    if (!this.state) throw new Error("Adapter not connected");
    return this.state.taskStartTimes;
  }

  setTaskStartTime(taskId: string, time: number): void {
    if (!this.state) throw new Error("Adapter not connected");
    this.state.taskStartTimes[taskId] = time;
    this.persist();
  }

  toggleProjectActive(projectId: string): void {
    if (!this.state) throw new Error("Adapter not connected");
    const project = this.state.projects.find((p) => p.id === projectId);
    if (project) {
      project.active = !project.active;
      this.persist();
    }
  }

  snoozeTask(taskId: string, minutes: number): void {
    if (!this.state) throw new Error("Adapter not connected");
    for (const project of this.state.projects) {
      const task = project.tasks.find((t) => t.id === taskId);
      if (task) {
        task.snoozedUntil = Date.now() + minutes * 60_000;
        this.persist();
        return;
      }
    }
  }

  unsnoozeTask(taskId: string): void {
    if (!this.state) throw new Error("Adapter not connected");
    for (const project of this.state.projects) {
      const task = project.tasks.find((t) => t.id === taskId);
      if (task) {
        task.snoozedUntil = null;
        this.persist();
        return;
      }
    }
  }

  moveTaskToEnd(projectId: string, taskId: string): void {
    if (!this.state) throw new Error("Adapter not connected");
    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) return;

    const idx = project.tasks.findIndex((t) => t.id === taskId);
    if (idx >= 0) {
      const [task] = project.tasks.splice(idx, 1);
      project.tasks.push(task);
      this.persist();
    }
  }

  reorderTask(projectId: string, taskId: string, newIndex: number): void {
    if (!this.state) throw new Error("Adapter not connected");
    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) return;

    const currentIdx = project.tasks.findIndex((t) => t.id === taskId);
    if (currentIdx < 0 || currentIdx === newIndex) return;

    // Remove task from current position
    const [task] = project.tasks.splice(currentIdx, 1);
    // Insert at new position
    project.tasks.splice(newIndex, 0, task);
    this.persist();
  }

  // Get full state (for useAppState hook)
  getFullState(): AppState {
    if (!this.state) throw new Error("Adapter not connected");
    return this.state;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private loadFromStorage(): AppState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.projects)) {
          return {
            projects: parsed.projects.map(this.normalizeProject).filter(Boolean),
            settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
            taskStartTimes: parsed.taskStartTimes || {},
          };
        }
      }
    } catch {
      // Ignore parse errors
    }
    return this.buildSampleData();
  }

  private persist(): void {
    if (!this.state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage errors
    }
  }

  private normalizeTask = (t: unknown): Task | null => {
    if (!t || typeof t !== "object") return null;
    const task = t as Record<string, unknown>;
    if (!task.id) return null;

    return {
      id: String(task.id),
      name: String(task.name || "(unnamed)"),
      description: String(task.desc || task.description || ""),
      done: Boolean(task.done),
      snoozedUntil: (task.snoozedUntil as number) || null,
      completedAt: (task.completedAt as number) || null,
      sourceId: this.id,
    };
  };

  private normalizeProject = (p: unknown): Project | null => {
    if (!p || typeof p !== "object") return null;
    const proj = p as Record<string, unknown>;
    if (!proj.id || !proj.name) return null;

    const tasks = Array.isArray(proj.tasks)
      ? proj.tasks.map(this.normalizeTask).filter(Boolean) as Task[]
      : [];

    return {
      id: String(proj.id),
      name: String(proj.name),
      color: String(proj.color || COLORS[0]),
      nudgeMinutes: Number(proj.nudgeMinutes) || 25,
      active: proj.active !== false,
      tasks,
      sourceId: this.id,
    };
  };

  private buildSampleData(): AppState {
    const now = Date.now();
    const p1id = uid();
    const p2id = uid();

    const t1: Task = {
      id: uid(),
      name: "Write landing page copy",
      description: "Draft headline, subheadline, and 3 benefit bullets",
      done: false,
      completedAt: null,
      snoozedUntil: null,
      sourceId: this.id,
    };
    const t2: Task = {
      id: uid(),
      name: "Set up analytics",
      description: "Install tracking on key conversion events",
      done: false,
      completedAt: null,
      snoozedUntil: null,
      sourceId: this.id,
    };
    const t3: Task = {
      id: uid(),
      name: "Prepare launch email",
      description: "Draft announcement for existing users",
      done: false,
      completedAt: null,
      snoozedUntil: null,
      sourceId: this.id,
    };
    const t4: Task = {
      id: uid(),
      name: "Schedule social posts",
      description: "Queue 5 posts across channels",
      done: false,
      completedAt: null,
      snoozedUntil: null,
      sourceId: this.id,
    };
    const t5: Task = {
      id: uid(),
      name: "Audit existing components",
      description: "List all UI elements currently in use",
      done: true,
      completedAt: now - 3_600_000,
      snoozedUntil: null,
      sourceId: this.id,
    };
    const t6: Task = {
      id: uid(),
      name: "Define color tokens",
      description: "Set up light/dark mode color variables",
      done: false,
      completedAt: null,
      snoozedUntil: null,
      sourceId: this.id,
    };
    const t7: Task = {
      id: uid(),
      name: "Build button variants",
      description: "Primary, secondary, danger states",
      done: false,
      completedAt: null,
      snoozedUntil: null,
      sourceId: this.id,
    };

    return {
      projects: [
        {
          id: p1id,
          name: "Product Launch",
          color: COLORS[0],
          nudgeMinutes: 25,
          active: true,
          tasks: [t1, t2, t3, t4],
          sourceId: this.id,
        },
        {
          id: p2id,
          name: "Design System",
          color: COLORS[1],
          nudgeMinutes: 30,
          active: true,
          tasks: [t5, t6, t7],
          sourceId: this.id,
        },
      ],
      settings: { ...DEFAULT_SETTINGS },
      taskStartTimes: {
        [t1.id]: now - 5 * 60_000,
        [t6.id]: now - 2 * 60_000,
      },
    };
  }
}
