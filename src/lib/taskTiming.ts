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
    const activeTask = project.active
      ? project.tasks.find((task) => !task.done) ?? null
      : null;

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

  return { changed, taskStartTimes: nextStartTimes };
}
