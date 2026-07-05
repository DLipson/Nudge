import type { Project, Task, Settings } from "../types";

const PERSIST_KEY = "nudge-notification-state";

interface NotificationState {
  lastNotificationTime: number;
  projectLastNotified: Record<string, number>;
}

function loadNotificationState(): NotificationState {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { lastNotificationTime: 0, projectLastNotified: {} };
}

function persistNotificationState(): void {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(notificationState));
  } catch {
    /* ignore */
  }
}

let notificationState: NotificationState = loadNotificationState();

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  return "granted";
}

export function canSendNotifications(): boolean {
  return true;
}

export function getNotificationPermission(): NotificationPermission {
  return "granted";
}

export function canNudgeGlobal(settings: Settings): boolean {
  return (
    Date.now() - notificationState.lastNotificationTime >=
    settings.maxNotificationFrequency * 60_000
  );
}

export function canNudgeProject(projectId: string, settings: Settings): boolean {
  const lastProjectNotification = notificationState.projectLastNotified[projectId] || 0;
  return Date.now() - lastProjectNotification >= settings.projectCooldown * 60_000;
}

export function canNudge(
  projectId: string,
  settings: Settings
): { canNudge: boolean; reason?: string } {
  if (!canNudgeGlobal(settings)) {
    const remaining = Math.ceil(
      (notificationState.lastNotificationTime +
        settings.maxNotificationFrequency * 60_000 -
        Date.now()) /
        60_000
    );
    return {
      canNudge: false,
      reason: `Too soon since last notification (${remaining}m cooldown)`,
    };
  }

  if (!canNudgeProject(projectId, settings)) {
    const lastProjectNotification = notificationState.projectLastNotified[projectId] || 0;
    const remaining = Math.ceil(
      (lastProjectNotification +
        settings.projectCooldown * 60_000 -
        Date.now()) /
        60_000
    );
    return {
      canNudge: false,
      reason: `Project recently notified (${remaining}m cooldown)`,
    };
  }

  return { canNudge: true };
}

function getNotificationContent(
  project: Project,
  task: Task,
  tone: "gentle" | "firm"
): { title: string; body: string } {
  if (tone === "gentle") {
    return { title: `Nudge: ${project.name}`, body: `Time to check in on: ${task.name}` };
  }
  return { title: `Action needed: ${project.name}`, body: `Task waiting: ${task.name}` };
}

export function getNotificationState(): {
  lastNotificationTime: number;
  projectLastNotified: Record<string, number>;
} {
  return {
    lastNotificationTime: notificationState.lastNotificationTime,
    projectLastNotified: { ...notificationState.projectLastNotified },
  };
}

export function resetNotificationState(): void {
  notificationState = { lastNotificationTime: 0, projectLastNotified: {} };
  localStorage.removeItem(PERSIST_KEY);
}

export function sendNudge(
  project: Project,
  task: Task,
  settings: Settings,
  force = false
): boolean {
  if (!force) {
    const { canNudge: canSend, reason } = canNudge(project.id, settings);
    if (!canSend) {
      console.log(`Skipping notification: ${reason}`);
      return false;
    }
  }

  const { title, body } = getNotificationContent(project, task, settings.nudgeTone);

  const now = Date.now();
  notificationState.lastNotificationTime = now;
  notificationState.projectLastNotified[project.id] = now;
  persistNotificationState();

  try {
    if (window.electronAPI?.showNotification) {
      window.electronAPI.showNotification(title, body, {
        autoDismiss: settings.notificationAutoDismiss,
        durationMs: settings.notificationDurationSeconds * 1_000,
      });
    } else {
      console.log(`[Nudge] ${title}: ${body}`);
    }
  } catch (err) {
    console.warn("Failed to send notification:", err);
  }

  return true;
}
