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

## 2026-06-01 - Login startup launched Electron without the app

**Bug** - When Nudge started on login from the development checkout, Electron opened its default "path-to-app" help screen instead of launching Nudge hidden in the tray.

**Root Cause** - The Windows login item registered `electron.exe` with only `--hidden`. For an unpackaged Electron app, the executable also needs the app path as the first argument.

**Fix** - Added shared startup launch option helpers and used them for both reading and writing the login item. Unpackaged launches now register `electron.exe` with the app path and `--hidden`; packaged launches keep using the packaged executable with `--hidden`. Existing enabled startup registrations are rewritten when the app opens.

**Verification** - Added regression coverage in `electron/startup.test.ts`. Confirmed with `npm test -- --run electron/startup.test.ts`, `npm test -- --run`, and `npm run build`.

## 2026-06-08 - Login startup split app paths with spaces

**Bug** - When Nudge started on login, Electron showed "Unable to find Electron app at C:\Users\Dovid" because the app path was split at the space in `Dovid L`.

**Root Cause** - The startup registration passed the unpackaged app path as a raw argument. Windows login startup did not preserve that path as one argument when it contained spaces.

**Fix** - Quoted unpackaged app path arguments before registering the Electron login item.

**Verification** - Added regression coverage in `electron/startup.test.ts` for app paths containing spaces. Confirmed with `npm test -- --run electron/startup.test.ts`, `npm test -- --run`, and `npm run build`.
