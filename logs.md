# Logs

## 2026-05-18 - Active task timers were not initialized

**Bug** - Nudges could not become due for newly active tasks because active task start times were never recorded.

**Root Cause** - `taskStartTimes` existed in app state and the nudge timer read from it, but the local storage adapter did not set a timestamp when a task became the first incomplete task in an active project.

**Fix** - The local storage adapter now synchronizes task start times after project/task mutations, tracking only the first incomplete task for each active project and clearing stale entries.

**Verification** - Added regression coverage in `LocalStorageAdapter.test.ts` for first task creation, completing the current task, and skipping the current task. Confirmed with `npm test -- --run` and `npm run build`.

## 2026-05-18 - Workflowy task timing needed stable references

**Bug** - Workflowy nudges could lose or confuse task timing if task references were stored as display text or as unscoped raw task IDs.

**Root Cause** - Workflowy task names are editable user-facing content, and raw IDs do not explicitly identify which adapter/source owns the task.

**Fix** - Added source-prefixed timing keys in the form `<sourceId>:<taskId>` and synchronized active task timing against the combined local and Workflowy project list.

**Verification** - Added regression coverage in `taskTiming.test.ts` for source-prefixed keys, Workflowy renames with stable node IDs, legacy raw ID migration, and identical IDs from different sources.
