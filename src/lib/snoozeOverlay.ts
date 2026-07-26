import type { Project } from "../types";
import { taskTimingKey } from "./taskTiming";

// Snooze is a local-only concept, but Workflowy tasks are rebuilt from scratch
// on every sync (snoozedUntil reset to null). This overlay persists per-task
// snooze times keyed by `${sourceId}:${id}` so they survive the sync rebuild.

const KEY = "nudge-snooze-overlay";

export function loadSnoozeOverlay(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSnoozeOverlay(overlay: Record<string, number>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(overlay));
  } catch {
    /* ignore */
  }
}

// Return a new projects array with snoozedUntil filled in from the overlay for
// any task whose snooze is still in the future. Input is never mutated.
export function applySnoozeOverlay(
  projects: Project[],
  overlay: Record<string, number>,
  now: number = Date.now()
): Project[] {
  return projects.map((project) => ({
    ...project,
    tasks: project.tasks.map((task) => {
      const until = overlay[taskTimingKey(task)];
      if (until !== undefined && until > now) {
        return { ...task, snoozedUntil: until };
      }
      return task;
    }),
  }));
}
