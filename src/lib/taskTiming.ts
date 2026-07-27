import type { Project, Task } from "../types";

export function taskTimingKey(task: Pick<Task, "id" | "sourceId">): string {
  return `${task.sourceId}:${task.id}`;
}

export function syncActiveTaskStartTimes(
  projects: Project[],
  currentStartTimes: Record<string, number>,
  now = Date.now()
): { changed: boolean; taskStartTimes: Record<string, number> } {
  const nextStartTimes = { ...currentStartTimes };
  let changed = false;

  for (const project of projects) {
    // Skip paused projects entirely: leave their start times frozen so the
    // active task's accumulated age survives a pause/resume round-trip.
    if (!project.active) continue;

    const activeTask = project.tasks.find((task) => !task.done) ?? null;

    for (const task of project.tasks) {
      const key = taskTimingKey(task);
      const legacyKey = task.id;
      const shouldTrack = activeTask?.id === task.id;
      const legacyStartTime = nextStartTimes[legacyKey];

      if (shouldTrack && nextStartTimes[key] === undefined) {
        nextStartTimes[key] = legacyStartTime ?? now;
        changed = true;
      }

      if (!shouldTrack && nextStartTimes[key] !== undefined) {
        delete nextStartTimes[key];
        changed = true;
      }

      if (legacyKey !== key && legacyStartTime !== undefined) {
        delete nextStartTimes[legacyKey];
        changed = true;
      }
    }
  }

  // Prune entries whose task no longer exists in ANY project (including tasks
  // removed by an external source like Workflowy). Paused-project tasks are
  // still present in the task set, so their frozen entries are preserved.
  const validKeys = new Set<string>();
  for (const project of projects) {
    for (const task of project.tasks) validKeys.add(taskTimingKey(task));
  }
  for (const key of Object.keys(nextStartTimes)) {
    if (!validKeys.has(key)) {
      delete nextStartTimes[key];
      changed = true;
    }
  }

  return { changed, taskStartTimes: nextStartTimes };
}
