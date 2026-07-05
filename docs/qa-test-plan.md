# Nudge QA Test Plan

Last updated: 2026-06-23

This plan enumerates manual and automated tests a QA engineer should run to confirm a rebuilt Nudge app preserves the expected UI, UX, and functionality.

## 1. Setup And Smoke Tests

1. Install dependencies with `npm install`.
2. Run the unit suite with `npm run test:run`; expect all tests to pass.
3. Build the app with `npm run build`; expect no TypeScript or bundling errors.
4. Launch the app in development mode with `npm run dev`; expect the Electron window to open at approximately 1200 by 800.
5. Resize the app to 800 by 600; expect no overlapping text or unusable controls.
6. Close the window; expect the app to remain running in the tray.
7. Use the tray `Show Nudge` action; expect the app window to reappear and focus.
8. Use the tray `Quit` action; expect the app process to exit.

## 2. First Launch And Persistence

1. Clear localStorage key `nudge_v4` and launch the app; expect an empty Focus view with `No active projects`.
2. Open Settings -> Storage Diagnostics; expect state source `empty`, storage key `nudge_v4`, and zero projects loaded.
3. Create a project and task, restart the app, and confirm both persist.
4. Corrupt the localStorage payload for `nudge_v4`, relaunch, and confirm the app starts empty with invalid diagnostics instead of crashing.
5. Confirm no demo data is seeded after empty or invalid storage.

## 3. Sidebar

1. With no projects, confirm the sidebar shows `Nudge`, `0/0 tasks done`, `Focus`, `+ New project`, and `Settings`.
2. Create local projects with incomplete tasks; confirm they appear under `Projects`.
3. Complete all tasks in a project; confirm that project is removed from the sidebar project list.
4. Create a long project name; confirm it truncates with ellipsis and does not overlap the sidebar.
5. Hover a project item with an unfinished task; confirm the browser title text shows `Next: {taskName}`.
6. Confirm local projects appear before Workflowy projects when both are present.
7. Enable Workflowy sync and verify sidebar states for syncing, synced, error, retry, and no-projects-found.

## 4. Project Creation And Editing

1. Click `+ New project`; expect a `New project` modal.
2. Try to save with an empty name; expect `Please enter a project name.` and no project creation.
3. Save a project with leading and trailing spaces; expect the persisted name to be trimmed.
4. Select each available color swatch; expect the selected style to update and the project dot to use that color.
5. Enter a nudge interval below the displayed minimum; verify current coercion behavior and document whether product wants strict min 5 or current min 1.
6. Save a valid project; expect navigation to `/project/{id}`.
7. Edit the project name, color, and nudge interval; expect updates in the topbar, sidebar, metadata, and Focus.
8. Delete a project and cancel the confirmation; expect no change.
9. Delete a project and confirm; expect the project and task timing entries to be removed and route to return to Focus.

## 5. Task Creation And Editing

1. Open a new project; expect `No tasks yet - add one below.`
2. Click `+ Add task`; expect an `Add task` modal.
3. Save with an empty task name; expect `Please enter a task name.`
4. Save a task with name and details; expect it to appear as current focus with details visible.
5. Add multiple tasks; expect each to append in order.
6. Edit a task name and details; expect trimmed values to persist.
7. Delete a task; expect it to disappear without a confirmation dialog.
8. Restart the app; expect task order, names, descriptions, done states, snooze state, and completed timestamps to persist.

## 6. Task Completion And Auto-Advance

1. Create a project with three tasks; expect the first unfinished task to show `Current focus`.
2. Complete the current task from project detail; expect it to show a check mark, strikethrough text, and a `Done {date}` timestamp.
3. Confirm the second task becomes `Current focus`.
4. Click `Undo` on the completed task; expect it to become unfinished and eligible for current focus based on order.
5. Set Settings -> Show completed tasks off; expect completed tasks to hide in project detail.
6. Set Show completed tasks on; expect completed tasks to reappear.
7. Complete all tasks; expect the project to disappear from Focus.

## 7. Reordering And Skipping

1. Drag the first task onto the third task; expect the order to update and persist.
2. Drag a task onto itself; expect no order change.
3. Confirm drag state opacity and drag-over highlight appear.
4. From Focus, click `Skip` on the current task; expect that task to move to the end of the project queue.
5. After skip, confirm the new first unfinished task becomes current focus and timing starts over.
6. Restart the app; confirm the skipped/reordered task order persists.

## 8. Snooze And Wake

1. From Focus, click `+15m`; expect a toast `Snoozed 15 min`.
2. Confirm the Focus row task text is dimmed and includes `(snoozed)`.
3. Open project detail; expect the task tag to show `Snoozed - {duration} left`.
4. Confirm a snoozed task is not eligible for notification.
5. Click `Wake`; expect `snoozedUntil` to clear and the task to become active again.
6. Let a snooze expire or fake the clock past `snoozedUntil`; expect notification eligibility to resume according to normal rules.

## 9. Focus View

1. Create active projects with unfinished tasks; expect Focus to show one row per project.
2. Pause one project; expect it to disappear from Focus.
3. Resume the project; expect it to return to Focus.
4. Click a Focus row outside its actions; expect navigation to project detail.
5. Hover a Focus row; expect `Done`, `+15m`, and `Skip` actions to appear.
6. Click `Done` in Focus when another task remains; expect toast `Done! Next: {nextTaskName}`.
7. Click `Done` in Focus on the final task; expect toast `All tasks complete!`.
8. Confirm Focus metadata shows active count, need-attention count, and soonest nudge countdown.
9. Create projects with different nudge readiness; expect Focus rows sorted by soonest nudge.
10. Verify countdown formatting for seconds, minutes, hours, and ready state.
11. Verify the visible `trigger` control either works as documented or is hidden/removed by an explicit product decision.

## 10. Notification Permission Banner

1. In an environment where notification permission is `default`, launch with notifications enabled; expect the permission banner.
2. Click `No thanks`; expect notifications to be disabled and the banner to disappear.
3. Click `Enable notifications`; expect the permission request flow to run and the banner to disappear once permission is granted.
4. In Electron, confirm the app treats notifications as granted and does not show a false permission blocker.

## 11. Notification Scheduling

1. Configure one active project with a task older than its nudge interval; expect one desktop notification after the timer check.
2. Confirm the notification title/body match gentle tone: `Nudge: {projectName}` and `Still waiting: {taskName}`.
3. Switch to firm tone; expect `Action needed: {projectName}` and `Task waiting: {taskName}`.
4. Set max notification frequency to 10 minutes; after one notification, confirm another project cannot notify until the global window elapses.
5. Set project cooldown to 180 minutes; confirm the same project cannot notify again before cooldown expires.
6. Set batch size to 1; confirm only one eligible project appears per notification.
7. Set batch size above 1 with multiple eligible projects; expect a single batch notification listing multiple project/task pairs.
8. Set quiet hours to include the current hour; confirm no background notification appears.
9. Set quiet hours to an overnight range such as 22 to 8; verify behavior before, during, and at the end boundary.
10. Turn off notifications in Settings; confirm no background nudges are sent.
11. Turn off auto-dismiss; confirm notification duration input is disabled and native notification timeout is persistent where supported.
12. Turn on auto-dismiss and set duration to 1, 8, and 300 seconds; confirm duration is passed and clamped correctly.
13. Click a native notification; expect the app window to show and focus.
14. Restart after a notification; confirm cooldown state persists from `nudge-notification-state`.
15. Use the Focus `trigger` control when no projects are eligible; expect toast `No nudgeable projects`.
16. Use the Focus `trigger` control when projects are eligible; expect toast `Nudge triggered`.

## 12. Settings

1. Open Settings; verify every default value matches the rebuild spec.
2. Change each setting, save, reopen Settings, and confirm persistence.
3. Click Cancel after changing settings; expect no changes to persist.
4. Toggle startup on; verify OS login item registration is enabled and configured to launch hidden.
5. Toggle startup off; verify OS login item registration is removed.
6. Verify numeric fields handle invalid, blank, below-minimum, and above-maximum input according to current behavior.
7. Confirm Settings save shows `Settings saved` for approximately 2400 ms.

## 13. Workflowy Sync

1. Enable Workflowy with an empty API key and click Test; expect `Please enter an API key`.
2. Test an invalid API key; expect `Invalid API key`.
3. Test an API key that returns 403; expect `Access forbidden - check your API key permissions`.
4. Test a network failure; expect a connection failed message.
5. With a valid key and default tag `#nudge`, confirm tagged root bullets import as projects.
6. Confirm tagged bullets one level under untagged root bullets import when search paths are empty.
7. Configure search paths; confirm only matching destination folders are scanned.
8. Configure duplicate search paths; confirm projects are not duplicated.
9. Confirm path segments match case-insensitively by substring.
10. Confirm a tagged bullet with children becomes a project and children become tasks.
11. Confirm a tagged bullet without children becomes a single-task project.
12. Confirm Workflowy HTML markup is stripped and common entities are decoded.
13. Confirm project tag text is removed from displayed project and task names.
14. Confirm empty stripped project names display `Untitled Project`.
15. Confirm empty stripped task names display `(unnamed)`.
16. Confirm Workflowy task order follows priority ascending and preserves fetched order for ties.
17. Complete a Workflowy task in Nudge; expect Workflowy complete endpoint to be called and project list refreshed.
18. Undo a Workflowy task in Nudge; expect Workflowy uncomplete endpoint to be called and project list refreshed.
19. Force a completion sync error; expect sidebar error `Failed to sync completion to Workflowy`.
20. Disable Workflowy sync; expect runtime Workflowy projects to disappear while local projects remain.
21. Wait 60 seconds with Workflowy enabled; expect automatic sync to run.

## 14. Visual Regression Checklist

1. Confirm the app uses a dark utility layout, not a landing page.
2. Confirm sidebar width is 230 px and remains fixed while the main pane flexes.
3. Confirm topbar height, content padding, modal sizing, and button styling match the spec.
4. Confirm project color dots use the selected palette colors.
5. Confirm active sidebar item uses green-tinted background and green text.
6. Confirm hover states appear for sidebar items, Focus rows, buttons, and task rows.
7. Confirm action buttons in Focus rows are hidden until hover.
8. Confirm completed, pending, active, and snoozed task states are visually distinct.
9. Confirm danger actions use red styling.
10. Confirm text truncates instead of overlapping at narrow widths.
11. Confirm modals fit within 88 viewport height and scroll internally when content is tall.
12. Confirm toast appears bottom center and does not block interactions.

## 15. Automated Regression Candidates

1. Unit test local storage empty startup, invalid storage, persistence, and diagnostics.
2. Unit test project CRUD and task CRUD.
3. Unit test completion auto-advance and task timing start/removal.
4. Unit test source-prefixed task timing keys and legacy timing migration.
5. Unit test skip and reorder behavior.
6. Unit test snooze and wake state.
7. Unit test notification eligibility: global cooldown, project cooldown, quiet hours, snooze, inactive projects, and disabled notifications.
8. Unit test batch notification title/body for one and multiple items.
9. Unit test notification state persistence and reset.
10. Unit test countdown formatting.
11. Unit test quiet-hour boundary behavior for same-day and overnight ranges.
12. Unit test Workflowy HTML stripping and entity decoding.
13. Unit test Workflowy tag removal, search path parsing, duplicate path dedupe, and priority ordering.
14. Unit test Workflowy complete/uncomplete success and failure paths.
15. Unit test launch-on-startup options for packaged and development app paths with spaces.
16. Component test Focus row actions stop navigation.
17. Component test settings save/cancel behavior.
18. Component test project and task modal validation.
19. End-to-end test project creation -> task creation -> Focus action -> persistence after restart.
20. End-to-end visual snapshot tests for Focus, project detail, settings, empty state, and modal states at 1200 by 800 and 800 by 600.

## 16. Current Risk Areas

1. Quiet hours must be verified against real background notifications, not only countdown display.
2. The project modal copy for `needs attention` appears inconsistent with Focus logic.
3. Numeric inputs display min/max values but some handlers currently clamp to values outside the displayed minimum.
4. The Focus `trigger` control appears to be a test affordance and should be product-decided before release.
5. Task deletion has no confirmation; verify whether this is intentional before rebuilding.
