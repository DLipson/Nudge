import type { Project, Task, NudgeLevel } from "../types";

// Fraction of a project's nudge interval at which the current task is flagged
// as slowing down ("warn") and at which it is considered overdue
// ("attention"). The nudge notification itself fires at the attention ratio.
export const NUDGE_WARN_RATIO = 0.7;
export const NUDGE_ATTENTION_RATIO = 1.0;

/** The first unfinished task in a project, or null if all are done. */
export function nextIncompleteTask(project: Project): Task | null {
  return project.tasks.find((t) => !t.done) ?? null;
}

/** Whether a task is currently snoozed (snooze time set and still in the future). */
export function isSnoozed(
  task: Pick<Task, "snoozedUntil">,
  now = Date.now()
): boolean {
  return task.snoozedUntil !== null && task.snoozedUntil > now;
}

/** Nudge level for the current task given its age and the project's interval. */
export function getNudgeLevel(ageMs: number, nudgeMinutes: number): NudgeLevel {
  const ratio = ageMs / (nudgeMinutes * 60_000);
  if (ratio < NUDGE_WARN_RATIO) return "ok";
  if (ratio < NUDGE_ATTENTION_RATIO) return "warn";
  return "attention";
}
