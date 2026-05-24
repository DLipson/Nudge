import type { TaskSourceAdapter } from "./types";
import type { Project, Task, Settings, AppState, StorageDiagnostics } from "../types";
import { DEFAULT_SETTINGS, COLORS } from "../types";
import { uid } from "../lib/uid";
import { syncActiveTaskStartTimes, taskTimingKey } from "../lib/taskTiming";
import { APP_DISPLAY_NAME, STORAGE_KEY } from "../config/storage";

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
  private diagnostics: StorageDiagnostics = {
    storageKey: STORAGE_KEY,
    appName: null,
    appStoragePath: null,
    stateSource: "empty",
    hasPersistedState: false,
    projectCount: 0,
    workflowyEnabled: false,
  };

  // ── Connection ────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.state = this.loadFromStorage();
    await this.loadRuntimeInfo();
    if (this.syncTaskStartTimes(this.state.projects)) {
      this.persist();
    }
    this.updateDiagnostics();
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
        delete this.state.taskStartTimes[taskTimingKey(task)];
        this.persistState();
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
        this.persistState();
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
    this.persistState();
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
        this.persistState();
        return;
      }
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!this.state) throw new Error("Adapter not connected");

    for (const project of this.state.projects) {
      const idx = project.tasks.findIndex((t) => t.id === taskId);
      if (idx >= 0) {
        const [task] = project.tasks.splice(idx, 1);
        delete this.state.taskStartTimes[taskTimingKey(task)];
        this.persistState();
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
    this.persistState();
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
      this.persistState();
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    if (!this.state) throw new Error("Adapter not connected");

    const project = this.state.projects.find((p) => p.id === projectId);
    if (project) {
      // Clean up task start times
      project.tasks.forEach((task) => {
        delete this.state!.taskStartTimes[taskTimingKey(task)];
      });
      this.state.projects = this.state.projects.filter(
        (p) => p.id !== projectId
      );
      this.persistState();
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

  setTaskStartTime(taskKey: string, time: number): void {
    if (!this.state) throw new Error("Adapter not connected");
    this.state.taskStartTimes[taskKey] = time;
    this.persist();
  }

  syncTaskStartTimes(projects: Project[]): boolean {
    if (!this.state) throw new Error("Adapter not connected");

    const result = syncActiveTaskStartTimes(
      projects,
      this.state.taskStartTimes
    );

    if (!result.changed) {
      return false;
    }

    this.state.taskStartTimes = result.taskStartTimes;
    this.persist();
    return true;
  }

  toggleProjectActive(projectId: string): void {
    if (!this.state) throw new Error("Adapter not connected");
    const project = this.state.projects.find((p) => p.id === projectId);
    if (project) {
      project.active = !project.active;
      this.persistState();
    }
  }

  snoozeTask(taskId: string, minutes: number): void {
    if (!this.state) throw new Error("Adapter not connected");
    for (const project of this.state.projects) {
      const task = project.tasks.find((t) => t.id === taskId);
      if (task) {
        task.snoozedUntil = Date.now() + minutes * 60_000;
        this.persistState();
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
        this.persistState();
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
      this.persistState();
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
    this.persistState();
  }

  // Get full state (for useAppState hook)
  getFullState(): AppState {
    if (!this.state) throw new Error("Adapter not connected");
    return this.state;
  }

  getDiagnostics(): StorageDiagnostics {
    return this.diagnostics;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private loadFromStorage(): AppState {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved === null) {
      this.diagnostics.stateSource = "empty";
      this.diagnostics.hasPersistedState = false;
      return this.buildEmptyState();
    }

    try {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.projects)) {
        this.diagnostics.stateSource = "persisted";
        this.diagnostics.hasPersistedState = true;
        return {
          projects: parsed.projects.map(this.normalizeProject).filter(Boolean),
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          taskStartTimes: parsed.taskStartTimes || {},
        };
      }
    } catch {
      this.diagnostics.stateSource = "invalid";
      this.diagnostics.hasPersistedState = true;
      return this.buildEmptyState();
    }

    this.diagnostics.stateSource = "invalid";
    this.diagnostics.hasPersistedState = true;
    return this.buildEmptyState();
  }

  private persist(): void {
    if (!this.state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.diagnostics.stateSource = "persisted";
      this.diagnostics.hasPersistedState = true;
      this.updateDiagnostics();
    } catch {
      // Ignore storage errors
    }
  }

  private persistState(): void {
    this.syncTaskStartTimes(this.state?.projects ?? []);
    this.persist();
  }

  private async loadRuntimeInfo(): Promise<void> {
    if (!window.electronAPI?.getAppInfo) {
      this.diagnostics.appName = APP_DISPLAY_NAME;
      return;
    }

    try {
      const info = await window.electronAPI.getAppInfo();
      this.diagnostics.appName = info.appName;
      this.diagnostics.appStoragePath = info.userDataPath;
    } catch {
      this.diagnostics.appName = APP_DISPLAY_NAME;
    }
  }

  private updateDiagnostics(): void {
    if (!this.state) {
      return;
    }

    this.diagnostics.projectCount = this.state.projects.length;
    this.diagnostics.workflowyEnabled = this.state.settings.workflowy.enabled;
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

  private buildEmptyState(): AppState {
    return {
      projects: [],
      settings: { ...DEFAULT_SETTINGS },
      taskStartTimes: {},
    };
  }
}
