// Electron API — exposed via preload.ts contextBridge when running in Electron
declare global {
  interface Window {
    electronAPI?: {
      isElectron: true;
      workflowyFetch: (
        url: string,
        options?: {
          method?: string;
          headers?: Record<string, string>;
          body?: string;
        }
      ) => Promise<{ ok: boolean; status: number; statusText: string; text: string }>;
      getAppInfo: () => Promise<{
        appName: string;
        userDataPath: string;
        localStorageKey: string;
      }>;
      getLaunchOnStartup: () => Promise<boolean>;
      setLaunchOnStartup: (enabled: boolean) => Promise<boolean>;
      showNotification: (
        title: string,
        body: string,
        options?: NotificationOptions
      ) => void;
    };
  }
}

// Core domain types

export interface Task {
  id: string;
  name: string;
  description: string;
  done: boolean;
  completedAt: number | null;
  snoozedUntil: number | null;
  sourceId: string; // Which adapter owns this task
}

export interface Project {
  id: string;
  name: string;
  color: string;
  nudgeMinutes: number;
  active: boolean;
  tasks: Task[];
  sourceId: string; // Which adapter owns this project
}

export interface WorkflowyConfig {
  apiKey: string;
  projectTag: string; // e.g., "#nudge" - bullets with this tag become projects
  enabled: boolean;
  lastSync: number | null;
  searchPaths: string; // Comma-separated paths to search, e.g. "Life > Work, Life > Personal"
}

export interface NotificationOptions {
  autoDismiss: boolean;
  durationMs: number;
}

export interface Settings {
  nudgeMinutes: number; // Default nudge interval for new projects
  autoAdvance: boolean; // Show toast with next task on completion
  showCompleted: boolean; // Display done tasks in project view

  // Notification settings
  notificationsEnabled: boolean;
  maxNotificationFrequency: number; // Minutes between any notifications
  notificationDurationSeconds: number;
  notificationAutoDismiss: boolean;
  projectCooldown: number; // Minutes before re-nudging same project
  quietHoursStart: number; // Hour (0-23) when quiet hours begin
  quietHoursEnd: number; // Hour (0-23) when quiet hours end
  nudgeTone: "gentle" | "firm"; // Affects notification language
  launchOnStartup: boolean;

  // Workflowy integration
  workflowy: WorkflowyConfig;
}

export interface AppState {
  projects: Project[];
  settings: Settings;
  taskStartTimes: Record<string, number>; // taskId -> timestamp when task became active
}

export interface StorageDiagnostics {
  storageKey: string;
  appName: string | null;
  appStoragePath: string | null;
  stateSource: "persisted" | "empty" | "invalid";
  hasPersistedState: boolean;
  projectCount: number;
  workflowyEnabled: boolean;
}

// Nudge level for visual indicators
export type NudgeLevel = "ok" | "warn" | "attention";

// Project health status
export type ProjectHealth = "active" | "needs-attention" | "neglected";

// Default Workflowy config
export const DEFAULT_WORKFLOWY_CONFIG: WorkflowyConfig = {
  apiKey: "",
  projectTag: "#nudge",
  enabled: false,
  lastSync: null,
  searchPaths: "",
};

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  nudgeMinutes: 25,
  autoAdvance: true,
  showCompleted: true,
  notificationsEnabled: true,
  maxNotificationFrequency: 10, // 10 minutes between any notifications
  notificationDurationSeconds: 8,
  notificationAutoDismiss: true,
  projectCooldown: 30, // 30 minutes before re-nudging same project
  quietHoursStart: 22, // 10 PM
  quietHoursEnd: 8, // 8 AM
  nudgeTone: "gentle",
  launchOnStartup: false,
  workflowy: DEFAULT_WORKFLOWY_CONFIG,
};

// Available project colors
export const COLORS = [
  "#c8f04a",
  "#40bfff",
  "#f05050",
  "#f0a030",
  "#b06aff",
  "#40c080",
  "#ff6090",
  "#60d0c0",
  "#aaa",
];
