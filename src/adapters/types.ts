import type { Project, Task } from "../types";

/**
 * TaskSourceAdapter interface
 *
 * Adapters connect Nudge to external task sources (Workflowy, Todoist, etc.)
 * or local storage. Each adapter manages its own projects and tasks.
 *
 * Design principles:
 * - Adapters are responsible for syncing state with their source
 * - External sources are the source of truth (if conflict, external wins)
 * - Write operations are optional (some sources may be read-only)
 */
export interface TaskSourceAdapter {
  /** Unique identifier for this adapter instance */
  readonly id: string;

  /** Human-readable name (e.g., "Workflowy", "Local Storage") */
  readonly name: string;

  // ── Connection ────────────────────────────────────────────────────────────

  /** Initialize the adapter and establish connection to the source */
  connect(): Promise<void>;

  /** Clean up and disconnect from the source */
  disconnect(): Promise<void>;

  /** Check if the adapter is currently connected */
  isConnected(): boolean;

  // ── Read Operations ───────────────────────────────────────────────────────

  /** Fetch all projects from this source */
  fetchProjects(): Promise<Project[]>;

  /** Fetch tasks for a specific project */
  fetchTasks(projectId: string): Promise<Task[]>;

  // ── Write Operations (optional) ───────────────────────────────────────────

  /** Mark a task as completed. Optional - some sources may be read-only. */
  completeTask?(taskId: string): Promise<void>;

  /** Undo task completion. Optional - some sources may be read-only. */
  uncompleteTask?(taskId: string): Promise<void>;

  /** Add a new task to a project. Optional. */
  addTask?(projectId: string, name: string, description: string): Promise<Task>;

  /** Update an existing task. Optional. */
  updateTask?(
    taskId: string,
    name: string,
    description: string
  ): Promise<void>;

  /** Delete a task. Optional. */
  deleteTask?(taskId: string): Promise<void>;

  /** Add a new project. Optional. */
  addProject?(
    name: string,
    color: string,
    nudgeMinutes: number
  ): Promise<Project>;

  /** Update a project's settings. Optional. */
  updateProject?(
    projectId: string,
    name: string,
    color: string,
    nudgeMinutes: number
  ): Promise<void>;

  /** Delete a project. Optional. */
  deleteProject?(projectId: string): Promise<void>;

  // ── Sync ──────────────────────────────────────────────────────────────────

  /** Get the timestamp of the last successful sync */
  getLastSyncTime(): number | null;

  /** Perform a full sync with the external source */
  sync(): Promise<void>;
}

/**
 * Adapter configuration type
 * Each adapter may require different configuration options
 */
export interface AdapterConfig {
  [key: string]: unknown;
}

/**
 * Adapter registry entry
 */
export interface AdapterRegistryEntry {
  id: string;
  name: string;
  description: string;
  createAdapter: (config?: AdapterConfig) => TaskSourceAdapter;
}
