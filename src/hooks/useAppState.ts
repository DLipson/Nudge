import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type {
  Project,
  Task,
  Settings,
  AppState,
  WorkflowyConfig,
  StorageDiagnostics,
} from "../types";
import { LocalStorageAdapter } from "../adapters/LocalStorageAdapter";
import { WorkflowyAdapter } from "../adapters/WorkflowyAdapter";
import {
  applySnoozeOverlay,
  loadSnoozeOverlay,
  saveSnoozeOverlay,
} from "../lib/snoozeOverlay";
import { nextIncompleteTask, isSnoozed as taskIsSnoozed } from "../lib/nudge";

/**
 * Main application state hook
 *
 * Manages all app state through the LocalStorageAdapter.
 * Optionally syncs with Workflowy when configured.
 */

// Singleton adapter instances
let localAdapter: LocalStorageAdapter | null = null;
let workflowyAdapter: WorkflowyAdapter | null = null;

function getLocalAdapter(): LocalStorageAdapter {
  if (!localAdapter) {
    localAdapter = new LocalStorageAdapter();
  }
  return localAdapter;
}

export interface UseAppStateReturn {
  // State
  projects: Project[];
  settings: Settings;
  taskStartTimes: Record<string, number>;
  isLoading: boolean;
  workflowySyncing: boolean;
  workflowyError: string | null;
  workflowyLastSync: number | null;
  storageDiagnostics: StorageDiagnostics | null;

  // Project operations
  addProject: (name: string, color: string, nudgeMinutes: number) => Promise<Project>;
  updateProject: (
    projectId: string,
    name: string,
    color: string,
    nudgeMinutes: number
  ) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  toggleProjectActive: (projectId: string) => void;
  getProject: (projectId: string) => Project | undefined;

  // Task operations
  addTask: (
    projectId: string,
    name: string,
    description: string
  ) => Promise<Task>;
  updateTask: (
    taskId: string,
    name: string,
    description: string
  ) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  uncompleteTask: (taskId: string) => Promise<void>;
  snoozeTask: (taskId: string, minutes: number) => void;
  unsnoozeTask: (taskId: string) => void;
  skipTask: (projectId: string, taskId: string) => void;
  reorderTask: (projectId: string, taskId: string, newIndex: number) => void;

  // Settings
  updateSettings: (settings: Partial<Settings>) => void;

  // Workflowy
  syncWorkflowy: () => Promise<void>;

  // Computed helpers
  getNextTask: (project: Project) => Task | null;
  isSnoozed: (task: Task) => boolean;
  activeProjects: Project[];
}

export function useAppState(): UseAppStateReturn {
  const [localState, setLocalState] = useState<AppState | null>(null);
  const [workflowyProjects, setWorkflowyProjects] = useState<Project[]>([]);
  // Per-task snooze times for Workflowy tasks (local-only; survives WF resync).
  const [wfSnoozes, setWfSnoozes] = useState<Record<string, number>>(() =>
    loadSnoozeOverlay()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [workflowySyncing, setWorkflowySyncing] = useState(false);
  const [workflowyError, setWorkflowyError] = useState<string | null>(null);
  const [workflowyLastSync, setWorkflowyLastSync] = useState<number | null>(null);
  const [storageDiagnostics, setStorageDiagnostics] = useState<StorageDiagnostics | null>(null);
  const [tick, setTick] = useState(0);
  const lastWorkflowySyncRef = useRef<number>(0);

  // Initialize adapter and load state
  useEffect(() => {
    const init = async () => {
      const adp = getLocalAdapter();
      if (!adp.isConnected()) {
        await adp.connect();
      }
      const state = adp.getFullState();
      if (window.electronAPI?.getLaunchOnStartup) {
        const launchOnStartup = await window.electronAPI.getLaunchOnStartup();
        if (state.settings.launchOnStartup !== launchOnStartup) {
          adp.updateSettings({ launchOnStartup });
        }
      }

      setLocalState(adp.getFullState());
      setStorageDiagnostics(adp.getDiagnostics());
      setIsLoading(false);

      // If Workflowy is enabled, start initial sync
      if (state.settings.workflowy?.enabled && state.settings.workflowy?.apiKey) {
        syncWorkflowyInternal(state.settings.workflowy);
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick every 30s to update timers and check for Workflowy sync
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Re-read state from adapter when tick changes
  useEffect(() => {
    if (tick > 0 && localAdapter?.isConnected()) {
      const state = localAdapter.getFullState();
      setLocalState(state);
      setStorageDiagnostics(localAdapter.getDiagnostics());

      // Auto-sync Workflowy every 60 seconds if enabled
      const wfConfig = state.settings.workflowy;
      if (wfConfig?.enabled && wfConfig?.apiKey) {
        const now = Date.now();
        if (now - lastWorkflowySyncRef.current > 60_000) {
          syncWorkflowyInternal(wfConfig);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Internal Workflowy sync function
  const syncWorkflowyInternal = async (config: WorkflowyConfig) => {
    if (!config.enabled || !config.apiKey) return;

    setWorkflowySyncing(true);
    setWorkflowyError(null);

    try {
      // Recreate adapter if key or tag changed
      const prev = (workflowyAdapter as unknown as { config: WorkflowyConfig } | null)?.config;
      const adapterStale =
        !workflowyAdapter ||
        prev?.apiKey !== config.apiKey ||
        prev?.projectTag !== config.projectTag ||
        prev?.searchPaths !== config.searchPaths;

      if (adapterStale) {
        workflowyAdapter = new WorkflowyAdapter({
          apiKey: config.apiKey,
          projectTag: config.projectTag || "#nudge",
          enabled: true,
          lastSync: null,
          searchPaths: config.searchPaths || "",
        });
      }

      // Use a local ref so TypeScript knows it's non-null for the rest of this block
      const adapter = workflowyAdapter!;

      // Always do a real re-fetch — sync() calls fetchAllNodes() to get fresh data
      if (adapter.isConnected()) {
        await adapter.sync();
      } else {
        await adapter.connect(); // also calls fetchAllNodes internally
      }

      const projects = await adapter.fetchProjects();
      setWorkflowyProjects(projects);
      const now = Date.now();
      lastWorkflowySyncRef.current = now;
      setWorkflowyLastSync(now);
    } catch (error) {
      console.error("[Workflowy] Sync failed:", error);
      setWorkflowyError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setWorkflowySyncing(false);
    }
  };

  // Refresh state from adapter
  const refresh = useCallback(() => {
    if (localAdapter?.isConnected()) {
      setLocalState(localAdapter.getFullState());
      setStorageDiagnostics(localAdapter.getDiagnostics());
    }
  }, []);

  // ── Project operations ────────────────────────────────────────────────────

  const addProject = useCallback(
    async (name: string, color: string, nudgeMinutes: number) => {
      const adp = getLocalAdapter();
      const project = await adp.addProject(name, color, nudgeMinutes);
      refresh();
      return project;
    },
    [refresh]
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      name: string,
      color: string,
      nudgeMinutes: number
    ) => {
      const adp = getLocalAdapter();
      await adp.updateProject(projectId, name, color, nudgeMinutes);
      refresh();
    },
    [refresh]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      const adp = getLocalAdapter();
      await adp.deleteProject(projectId);
      refresh();
    },
    [refresh]
  );

  const toggleProjectActive = useCallback(
    (projectId: string) => {
      const adp = getLocalAdapter();
      adp.toggleProjectActive(projectId);
      refresh();
    },
    [refresh]
  );

  const getProject = useCallback(
    (projectId: string) => {
      // Check local projects first
      const local = localState?.projects.find((p) => p.id === projectId);
      if (local) return local;
      // Then check Workflowy projects (with snooze overlay applied)
      const wf = workflowyProjects.find((p) => p.id === projectId);
      return wf ? applySnoozeOverlay([wf], wfSnoozes)[0] : undefined;
    },
    [localState?.projects, workflowyProjects, wfSnoozes]
  );

  // ── Task operations ───────────────────────────────────────────────────────

  const addTask = useCallback(
    async (projectId: string, name: string, description: string) => {
      const adp = getLocalAdapter();
      const task = await adp.addTask(projectId, name, description);
      refresh();
      return task;
    },
    [refresh]
  );

  const updateTask = useCallback(
    async (taskId: string, name: string, description: string) => {
      const adp = getLocalAdapter();
      await adp.updateTask(taskId, name, description);
      refresh();
    },
    [refresh]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const adp = getLocalAdapter();
      await adp.deleteTask(taskId);
      refresh();
    },
    [refresh]
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      // Check if this is a Workflowy task
      const isWorkflowyTask = workflowyProjects.some((p) =>
        p.tasks.some((t) => t.id === taskId)
      );

      if (isWorkflowyTask && workflowyAdapter?.isConnected()) {
        try {
          await workflowyAdapter.completeTask(taskId);
          // Refresh Workflowy projects
          const projects = await workflowyAdapter.fetchProjects();
          setWorkflowyProjects(projects);
        } catch (error) {
          console.error("Failed to complete Workflowy task:", error);
          setWorkflowyError("Failed to sync completion to Workflowy");
        }
      } else {
        const adp = getLocalAdapter();
        await adp.completeTask(taskId);
        refresh();
      }
    },
    [refresh, workflowyProjects]
  );

  const uncompleteTask = useCallback(
    async (taskId: string) => {
      // Check if this is a Workflowy task
      const isWorkflowyTask = workflowyProjects.some((p) =>
        p.tasks.some((t) => t.id === taskId)
      );

      if (isWorkflowyTask && workflowyAdapter?.isConnected()) {
        try {
          await workflowyAdapter.uncompleteTask(taskId);
          // Refresh Workflowy projects
          const projects = await workflowyAdapter.fetchProjects();
          setWorkflowyProjects(projects);
        } catch (error) {
          console.error("Failed to uncomplete Workflowy task:", error);
          setWorkflowyError("Failed to sync to Workflowy");
        }
      } else {
        const adp = getLocalAdapter();
        await adp.uncompleteTask(taskId);
        refresh();
      }
    },
    [refresh, workflowyProjects]
  );

  const snoozeTask = useCallback(
    (taskId: string, minutes: number) => {
      const isWorkflowyTask = workflowyProjects.some((p) =>
        p.tasks.some((t) => t.id === taskId)
      );
      if (isWorkflowyTask) {
        setWfSnoozes((prev) => {
          const next = { ...prev, [`workflowy:${taskId}`]: Date.now() + minutes * 60_000 };
          saveSnoozeOverlay(next);
          return next;
        });
        return;
      }
      const adp = getLocalAdapter();
      adp.snoozeTask(taskId, minutes);
      refresh();
    },
    [refresh, workflowyProjects]
  );

  const unsnoozeTask = useCallback(
    (taskId: string) => {
      const isWorkflowyTask = workflowyProjects.some((p) =>
        p.tasks.some((t) => t.id === taskId)
      );
      if (isWorkflowyTask) {
        setWfSnoozes((prev) => {
          const next = { ...prev };
          delete next[`workflowy:${taskId}`];
          saveSnoozeOverlay(next);
          return next;
        });
        return;
      }
      const adp = getLocalAdapter();
      adp.unsnoozeTask(taskId);
      refresh();
    },
    [refresh, workflowyProjects]
  );

  const skipTask = useCallback(
    (projectId: string, taskId: string) => {
      const adp = getLocalAdapter();
      adp.moveTaskToEnd(projectId, taskId);
      refresh();
    },
    [refresh]
  );

  const reorderTask = useCallback(
    (projectId: string, taskId: string, newIndex: number) => {
      const adp = getLocalAdapter();
      adp.reorderTask(projectId, taskId, newIndex);
      refresh();
    },
    [refresh]
  );

  // ── Settings ──────────────────────────────────────────────────────────────

  const updateSettings = useCallback(
    (settings: Partial<Settings>) => {
      const adp = getLocalAdapter();
      adp.updateSettings(settings);
      refresh();

      // If Workflowy settings changed, trigger sync
      if (settings.workflowy) {
        if (settings.workflowy.enabled && settings.workflowy.apiKey) {
          syncWorkflowyInternal(settings.workflowy);
        } else {
          // Workflowy disabled, clear projects
          setWorkflowyProjects([]);
          workflowyAdapter = null;
        }
      }

      if (typeof settings.launchOnStartup === "boolean") {
        window.electronAPI?.setLaunchOnStartup?.(settings.launchOnStartup).catch(
          (error) => {
            console.error("Failed to update startup setting:", error);
          }
        );
      }
    },
    [refresh]
  );

  // ── Workflowy sync ────────────────────────────────────────────────────────

  const syncWorkflowy = useCallback(async () => {
    const config = localState?.settings.workflowy;
    if (config?.enabled && config?.apiKey) {
      await syncWorkflowyInternal(config);
    }
  }, [localState?.settings.workflowy]);

  // ── Computed helpers ──────────────────────────────────────────────────────

  const getNextTask = useCallback(
    (project: Project): Task | null => nextIncompleteTask(project),
    []
  );

  const isSnoozed = useCallback(
    (task: Task): boolean => taskIsSnoozed(task),
    []
  );

  // Combine local and Workflowy projects
  const allProjects = useMemo(() => {
    const local = localState?.projects ?? [];
    // Add Workflowy projects, but don't duplicate if same ID exists
    const localIds = new Set(local.map((p) => p.id));
    const wfOnly = applySnoozeOverlay(
      workflowyProjects.filter((p) => !localIds.has(p.id)),
      wfSnoozes
    );
    return [...local, ...wfOnly];
  }, [localState?.projects, workflowyProjects, wfSnoozes]);

  useEffect(() => {
    if (isLoading || !localAdapter?.isConnected()) {
      return;
    }

    const changed = localAdapter.syncTaskStartTimes(allProjects);
    if (!changed) {
      return;
    }

    const state = localAdapter.getFullState();
    setLocalState({
      ...state,
      taskStartTimes: { ...state.taskStartTimes },
    });
    setStorageDiagnostics(localAdapter.getDiagnostics());
  }, [allProjects, isLoading]);

  const activeProjects = useMemo(
    () => allProjects.filter((p) => p.active),
    [allProjects]
  );

  return {
    // State
    projects: allProjects,
    settings: localState?.settings ?? ({} as Settings),
    taskStartTimes: localState?.taskStartTimes ?? {},
    isLoading,
    workflowySyncing,
    workflowyError,
    workflowyLastSync,
    storageDiagnostics,

    // Project operations
    addProject,
    updateProject,
    deleteProject,
    toggleProjectActive,
    getProject,

    // Task operations
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    snoozeTask,
    unsnoozeTask,
    skipTask,
    reorderTask,

    // Settings
    updateSettings,

    // Workflowy
    syncWorkflowy,

    // Computed helpers
    getNextTask,
    isSnoozed,
    activeProjects,
  };
}
