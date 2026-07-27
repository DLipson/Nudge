import type { Project, Task, Settings } from "../types";
import { taskAge } from "./time";

const PERSIST_KEY = "nudge-notification-state";

interface NotificationState {
  lastNotificationTime: number;
  projectLastNotified: Record<string, number>;
}

function loadNotificationState(): NotificationState {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          lastNotificationTime: parsed.lastNotificationTime ?? 0,
          projectLastNotified: parsed.projectLastNotified ?? {},
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { lastNotificationTime: 0, projectLastNotified: {} };
}

function persistNotificationState(): void {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(notificationState));
    notifyNotificationStateChanged();
  } catch {
    /* ignore */
  }
}

let notificationState: NotificationState = loadNotificationState();
const notificationStateListeners = new Set<() => void>();

function notifyNotificationStateChanged(): void {
  for (const listener of notificationStateListeners) {
    listener();
  }
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

export function subscribeNotificationState(listener: () => void): () => void {
  notificationStateListeners.add(listener);
  return () => notificationStateListeners.delete(listener);
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
  notifyNotificationStateChanged();
}

export function sendNudge(
  project: Project,
  task: Task,
  settings: Settings,
  force = false
): boolean {
  if (!force) {
    const { canNudge: canSend } = canNudge(project.id, settings);
    if (!canSend) {
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

export function sendBatchNudge(
  items: Array<{ project: Project; task: Task }>,
  settings: Settings
): boolean {
  if (items.length === 0) return false;

  const now = Date.now();
  notificationState.lastNotificationTime = now;
  for (const { project } of items) {
    notificationState.projectLastNotified[project.id] = now;
  }
  persistNotificationState();

  let title: string;
  let body: string;

  if (items.length === 1) {
    const content = getNotificationContent(items[0].project, items[0].task, settings.nudgeTone);
    title = content.title;
    body = content.body;
  } else {
    title = `Nudge: ${items.length} projects need attention`;
    body = items.map(({ project, task }) => `\u2022 ${project.name}: ${task.name}`).join("\n");
  }

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

export function triggerNextNudge(
  projects: Project[],
  settings: Settings,
  taskStartTimes: Record<string, number>,
  getNextTask: (project: Project) => Task | null,
  isSnoozed: (task: Task) => boolean,
): boolean {
  const activeProjects = projects.filter((p) => p.active);
  const batchSize = settings.nudgeBatchSize;

  const batch: Array<{ project: Project; task: Task }> = [];
  for (const project of activeProjects) {
    if (batch.length >= batchSize) break;

    const task = getNextTask(project);
    if (!task || isSnoozed(task)) continue;
    if (taskAge(task, taskStartTimes) < project.nudgeMinutes * 60_000) continue;

    batch.push({ project, task });
  }

  if (batch.length === 0) return false;
  return sendBatchNudge(batch, settings);
}
