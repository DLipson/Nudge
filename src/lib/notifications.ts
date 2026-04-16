import type { Project, Task, Settings } from "../types";

interface NotificationState {
  lastNotificationTime: number;
  projectLastNotified: Record<string, number>;
}

let notificationState: NotificationState = {
  lastNotificationTime: 0,
  projectLastNotified: {},
};

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  return "granted";
}

export function canSendNotifications(): boolean {
  return true;
}

export function getNotificationPermission(): NotificationPermission {
  return "granted";
}

export function canNudge(
  projectId: string,
  settings: Settings
): { canNudge: boolean; reason?: string } {
  const now = Date.now();

  const timeSinceLastNotification = now - notificationState.lastNotificationTime;
  const minInterval = settings.maxNotificationFrequency * 60_000;
  if (timeSinceLastNotification < minInterval) {
    return {
      canNudge: false,
      reason: `Too soon since last notification (${Math.ceil(
        (minInterval - timeSinceLastNotification) / 60_000
      )}m cooldown)`,
    };
  }

  const lastProjectNotification = notificationState.projectLastNotified[projectId] || 0;
  const timeSinceProjectNotification = now - lastProjectNotification;
  const projectCooldown = settings.projectCooldown * 60_000;
  if (timeSinceProjectNotification < projectCooldown) {
    return {
      canNudge: false,
      reason: `Project recently notified (${Math.ceil(
        (projectCooldown - timeSinceProjectNotification) / 60_000
      )}m cooldown)`,
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

export function resetNotificationState(): void {
  notificationState = { lastNotificationTime: 0, projectLastNotified: {} };
}

export function sendNudge(project: Project, task: Task, settings: Settings): boolean {
  const { canNudge: canSend, reason } = canNudge(project.id, settings);
  if (!canSend) {
    console.log(`Skipping notification: ${reason}`);
    return false;
  }

  const { title, body } = getNotificationContent(project, task, settings.nudgeTone);

  const now = Date.now();
  notificationState.lastNotificationTime = now;
  notificationState.projectLastNotified[project.id] = now;

  window.electronAPI!.showNotification(title, body);
  return true;
}
