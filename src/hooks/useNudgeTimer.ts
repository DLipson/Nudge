import { useEffect, useRef, useCallback } from "react";
import type { Project, Task, Settings } from "../types";
import { sendBatchNudge, canNudgeGlobal, canNudgeProject } from "../lib/notifications";
import { taskAge, isQuietHours } from "../lib/time";

/**
 * Hook that runs a periodic timer to check if any tasks need nudging
 *
 * Checks every 30 seconds and sends browser notifications for tasks
 * that have exceeded their nudge interval.
 */
export interface UseNudgeTimerProps {
  projects: Project[];
  settings: Settings;
  taskStartTimes: Record<string, number>;
  getNextTask: (project: Project) => Task | null;
  isSnoozed: (task: Task) => boolean;
  enabled?: boolean;
}

export function useNudgeTimer({
  projects,
  settings,
  taskStartTimes,
  getNextTask,
  isSnoozed,
  enabled = true,
}: UseNudgeTimerProps): void {
  const intervalRef = useRef<number | null>(null);

  // Check all projects and send nudges as needed
  const checkForNudges = useCallback(() => {
    if (!enabled || !settings.notificationsEnabled) {
      return;
    }

    // Respect quiet hours
    if (isQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) {
      return;
    }

    // Check active projects
    const activeProjects = projects.filter((p) => p.active);
    const batchSize = Math.max(1, settings.nudgeBatchSize);

    if (!canNudgeGlobal(settings)) {
      return;
    }

    const batch: Array<{ project: Project; task: Task }> = [];
    for (const project of activeProjects) {
      if (batch.length >= batchSize) break;

      const task = getNextTask(project);
      if (!task || isSnoozed(task)) continue;
      if (taskAge(task, taskStartTimes) < project.nudgeMinutes * 60_000) continue;
      if (!canNudgeProject(project.id, settings)) continue;

      batch.push({ project, task });
    }

    if (batch.length > 0) {
      sendBatchNudge(batch, settings);
    }
  }, [
    enabled,
    projects,
    settings,
    taskStartTimes,
    getNextTask,
    isSnoozed,
  ]);

  // Set up the interval
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Check immediately on mount
    checkForNudges();

    // Then check every 30 seconds
    intervalRef.current = window.setInterval(checkForNudges, 30_000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, checkForNudges]);
}
