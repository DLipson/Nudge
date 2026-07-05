import type { Task, Project, Settings } from "../types";
import { taskTimingKey } from "./taskTiming";

/**
 * Format a duration in milliseconds to a human-readable string
 * e.g., 125000 -> "2m", 3700000 -> "1h 1m"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${totalSeconds}s`;
}

/**
 * Format a timestamp to a short date string
 * e.g., "Apr 15, 2:30 PM"
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Check if a timestamp is within quiet hours
 */
export function isQuietHours(
  quietHoursStart: number,
  quietHoursEnd: number
): boolean {
  return isQuietHoursAt(quietHoursStart, quietHoursEnd, Date.now());
}

/**
 * Get the age of a task in milliseconds
 */
export function taskAge(
  task: Pick<Task, "id" | "sourceId">,
  taskStartTimes: Record<string, number>
): number {
  return Date.now() - (taskStartTimes[taskTimingKey(task)] ?? Date.now());
}

export function isQuietHoursAt(
  quietHoursStart: number,
  quietHoursEnd: number,
  time: number
): boolean {
  const hour = new Date(time).getHours();

  if (quietHoursStart > quietHoursEnd) {
    return hour >= quietHoursStart || hour < quietHoursEnd;
  }
  return hour >= quietHoursStart && hour < quietHoursEnd;
}

export function quietHoursEndMs(
  quietHoursStart: number,
  quietHoursEnd: number,
  now: number = Date.now()
): number {
  const hour = new Date(now).getHours();
  const end = new Date(now);
  end.setHours(quietHoursEnd, 0, 0, 0);

  if (quietHoursStart > quietHoursEnd) {
    if (hour >= quietHoursStart) {
      end.setDate(end.getDate() + 1);
    }
  } else if (hour >= quietHoursEnd) {
    end.setDate(end.getDate() + 1);
  }

  return end.getTime();
}

export interface NudgeSchedule {
  result: Map<string, number | null>;
  queuePos: Map<string, number>;
}

export interface NudgeScheduleOptions {
  projects: Project[];
  taskStartTimes: Record<string, number>;
  settings: Settings;
  isSnoozed: (task: Task) => boolean;
  getNextTask: (project: Project) => Task | null;
  lastNotificationTime: number;
  projectLastNotified: Record<string, number>;
  now?: number;
}

function moveOutOfQuietHours(settings: Settings, time: number): number {
  if (isQuietHoursAt(settings.quietHoursStart, settings.quietHoursEnd, time)) {
    return quietHoursEndMs(settings.quietHoursStart, settings.quietHoursEnd, time);
  }
  return time;
}

export function calculateNudgeSchedule({
  projects,
  taskStartTimes,
  settings,
  isSnoozed,
  getNextTask,
  lastNotificationTime,
  projectLastNotified,
  now = Date.now(),
}: NudgeScheduleOptions): NudgeSchedule {
  const result = new Map<string, number | null>();
  const queue: string[] = [];
  const queuePos = new Map<string, number>();
  const batchSize = Math.max(1, settings.nudgeBatchSize);
  const globalFrequencyMs = settings.maxNotificationFrequency * 60_000;
  const globalExpiry = lastNotificationTime + globalFrequencyMs;

  for (const project of projects) {
    const task = getNextTask(project);
    if (!task) {
      result.set(project.id, null);
      continue;
    }

    if (isSnoozed(task)) {
      result.set(project.id, Math.max(0, task.snoozedUntil! - now));
      continue;
    }

    const age = taskAge(task, taskStartTimes);
    const taskReadyAt = now + Math.max(0, project.nudgeMinutes * 60_000 - age);
    const projectReadyAt = (projectLastNotified[project.id] || 0) + settings.projectCooldown * 60_000;
    const individualReadyAt = Math.max(taskReadyAt, projectReadyAt);

    if (individualReadyAt <= now) {
      queue.push(project.id);
      continue;
    }

    const nextReadyAt = moveOutOfQuietHours(settings, individualReadyAt);
    result.set(project.id, Math.max(0, Math.max(nextReadyAt, globalExpiry) - now));
  }

  let lastBatchAt: number | null = null;
  for (let pos = 0; pos < queue.length; pos++) {
    const id = queue[pos];
    queuePos.set(id, pos);

    if (pos % batchSize === 0) {
      const earliestBatchAt = lastBatchAt === null ? Math.max(globalExpiry, now) : lastBatchAt + globalFrequencyMs;
      lastBatchAt = moveOutOfQuietHours(settings, earliestBatchAt);
    }

    result.set(id, Math.max(0, lastBatchAt! - now));
  }

  return { result, queuePos };
}
