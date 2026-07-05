# Nudge Product Rebuild Specification

Last updated: 2026-06-23

This document defines the product behavior, data contract, user flows, and visual design needed to recreate Nudge from scratch while preserving the current app experience. It reflects the current working tree, including uncommitted notification scheduling changes present on 2026-06-23.

## 1. Overview

Nudge is a desktop productivity app that keeps active projects visible and reminds the user about the next unfinished task in each project. The app is designed for users who already have project lists but need a lightweight layer that keeps the next action in front of them without repeatedly creating manual reminders.

The primary user value is automatic task progression:

- Each project has an ordered task queue.
- The next unfinished task is the current focus for that project.
- Completing, skipping, snoozing, or reordering tasks changes what the app considers the next action.
- Desktop notifications remind the user when a task has waited longer than its project-specific nudge interval.

The product should feel quiet, dense, and work-focused. It is not a planning suite, calendar, kanban board, or reminder marketplace.

## 2. Goals

- Let a user create local projects and ordered task lists.
- Show all active projects and their next unfinished task in one Focus view.
- Automatically advance a project to the next unfinished task when the current task is completed.
- Send desktop notifications only when tasks need attention and notification constraints allow it.
- Let users snooze, skip, complete, undo, edit, delete, and reorder tasks.
- Let users pause and resume projects.
- Persist local state across app restarts.
- Sync projects and tasks from Workflowy using a configured tag.
- Support launch-on-startup and tray behavior as a desktop app.
- Preserve the current dark, restrained UI language and compact layout.

## 3. Non-Goals

- No multi-user accounts, cloud-hosted Nudge backend, or collaboration.
- No calendar integration.
- No recurring task engine.
- No mobile-specific experience.
- No project hierarchy inside Nudge beyond project -> tasks.
- No editing Workflowy project names, task names, task notes, order, or project structure from Nudge.
- No data export/import feature beyond current local persistence and Workflowy sync.

## 4. Personas

### Primary Persona: Individual Project Owner

The primary user manages several personal or work projects and wants a simple way to know what needs attention next. They value low friction, calm reminders, and minimal setup.

### Secondary Persona: Workflowy User

The secondary user already tracks projects in Workflowy and wants Nudge to surface tagged projects without moving their source of truth.

## 5. App Shell And Navigation

### Desktop Shell

- The app runs as an Electron desktop app.
- Default window size is 1200 by 800.
- Minimum window size is 800 by 600.
- Closing the window hides it to the system tray instead of quitting.
- The tray menu contains:
  - `Show Nudge`, which shows and focuses the window.
  - `Quit`, which exits the app.
- Double-clicking the tray icon shows and focuses the window.
- When launched with `--hidden`, the app starts hidden.
- In development mode, the app opens developer tools in a detached window.

### Routes

- `/` displays the Focus view.
- `/projects` redirects to `/`.
- `/project/:id` displays the project detail view for the matching project.
- If a project route references a missing project, show a "Project not found" error view with a primary `Back to Focus` button.

## 6. Core Concepts

### Project

A project is an ordered task container with:

- `id`: stable unique identifier.
- `name`: required display name.
- `color`: one of the available project colors or a restored persisted color.
- `nudgeMinutes`: project-specific reminder interval in minutes.
- `active`: whether the project participates in Focus and notifications.
- `tasks`: ordered list of tasks.
- `sourceId`: owning source, either `local-storage` or `workflowy`.

### Task

A task is an ordered project item with:

- `id`: stable unique identifier.
- `name`: required display name.
- `description`: optional supporting text.
- `done`: completion status.
- `completedAt`: timestamp in milliseconds, or null.
- `snoozedUntil`: timestamp in milliseconds, or null.
- `sourceId`: owning source, either `local-storage` or `workflowy`.

### Current Focus Task

- For each active project, the current focus task is the first task in project order where `done` is false.
- Completed tasks never become the current focus task.
- A project with no unfinished tasks is omitted from the Focus project list and sidebar project list.
- A paused project is omitted from the Focus view but may still be shown in the sidebar if it has incomplete tasks.

### Task Timing

- The app tracks when a task became the current focus task.
- Timing keys must include the source prefix: `{sourceId}:{taskId}`.
- When a task becomes current focus and has no start time, the app records the current timestamp.
- When a task stops being current focus, its start time is removed.
- Legacy timing entries keyed only by task id are migrated to source-prefixed keys.
- Tasks from different sources with the same raw id must be tracked independently.

## 7. Data And Persistence

### Local Storage

- Persist app state in browser localStorage.
- The configured storage key is `nudge_v4`.
- On first launch with no persisted state, start empty. Do not seed demo projects.
- On invalid persisted state, start empty and expose diagnostics showing the state source as invalid.
- Persisted state shape:

```json
{
  "projects": [],
  "settings": {},
  "taskStartTimes": {}
}
```

### Default Settings

```json
{
  "nudgeMinutes": 180,
  "showCompleted": true,
  "notificationsEnabled": true,
  "maxNotificationFrequency": 10,
  "notificationDurationSeconds": 8,
  "notificationAutoDismiss": true,
  "projectCooldown": 180,
  "nudgeBatchSize": 1,
  "quietHoursStart": 22,
  "quietHoursEnd": 8,
  "nudgeTone": "gentle",
  "launchOnStartup": false,
  "workflowy": {
    "apiKey": "",
    "projectTag": "#nudge",
    "enabled": false,
    "lastSync": null,
    "searchPaths": ""
  }
}
```

### Storage Diagnostics

Settings must show:

- State source: `persisted`, `empty`, or `invalid`.
- Storage key.
- User data path when running inside Electron, otherwise `browser localStorage`.
- Number of locally persisted projects loaded.
- Whether Workflowy sync is enabled.
- If state is empty, show a warning that no persisted state was found and the app started empty.
- If state is invalid, show a warning that persisted state exists but could not be parsed.

## 8. Functional Requirements

### Loading

- While state initializes, show a full-window loading screen with the text `Loading...`.
- After local state is loaded, render the normal app shell.
- If Workflowy is enabled and has an API key, start an initial Workflowy sync after local state initialization.

### Sidebar

- The sidebar is always visible at desktop sizes.
- The top logo area shows:
  - App name: `Nudge`.
  - Total completed tasks and total tasks across active projects as `{done}/{total} tasks done`.
- The `Views` section contains one route: `Focus`.
- The `Projects` section lists projects with incomplete tasks:
  - Local projects first.
  - Workflowy projects second.
  - Each item shows a color dot and project name.
  - Project names truncate with ellipsis when too long.
  - Hovering a project item shows the next task in the title attribute as `Next: {taskName}`.
- When Workflowy sync is enabled, show sync status below the project list:
  - `syncing...` while syncing.
  - Error text in red when sync fails, truncated after 48 characters with a retry button.
  - `synced just now`, `synced 1m ago`, or `synced {n}m ago` after a successful sync, with a manual sync button.
  - `No projects found. Tag bullets with your project tag.` when enabled but no sync result exists.
- The sidebar includes a `+ New project` trigger.
- The footer includes a `Settings` trigger.

### Focus View

- The Focus topbar title is `Focus`.
- The metadata line shows:
  - `{n} active`.
  - `all on track` when no project is close to its nudge threshold.
  - `{n} need attention` when one or more active projects are at or past 70 percent of their nudge interval and not snoozed.
  - The soonest nudge countdown when any active project has a calculable nudge time.
- The current working tree includes a small `trigger` control in the Focus metadata line for manually triggering the next nudge batch during testing. A deterministic rebuild must either preserve this control or explicitly remove it as a product decision.
- If there are no active projects with unfinished tasks, show:
  - Heading: `No active projects`.
  - Body: `Create a project to get started.`
- Otherwise, show one row per active project with an unfinished task.
- Rows are sorted by soonest calculated nudge time, earliest first.
- Each row shows:
  - Project color dot.
  - Uppercase project name in project color.
  - Separator `:`.
  - Current focus task name.
  - If snoozed, append `(snoozed)` and dim the task text.
  - Nudge countdown text when available.
- Clicking a row navigates to that project detail view.
- Hovering an unsnoozed row reveals inline actions:
  - `Done`
  - `+15m`
  - `Skip`
- Clicking inline actions must not navigate to the project detail view.
- `Done` marks the current focus task complete and shows:
  - `Done! Next: {nextTaskName}` if another unfinished task remains.
  - `All tasks complete!` if no unfinished task remains.
- `+15m` snoozes the current focus task for 15 minutes and shows `Snoozed 15 min`.
- `Skip` moves the current focus task to the end of its project task queue and shows `Task moved to end of queue`.

### Project Creation And Editing

- `+ New project` opens a modal titled `New project`.
- Editing a project opens a modal titled `Edit project`.
- Required fields:
  - Name.
  - Color.
  - Nudge interval in minutes.
- Name defaults to empty for new projects.
- Color defaults to the first palette color for new projects.
- Nudge interval defaults to the global default setting for new projects.
- Available colors:
  - `#c8f04a`
  - `#40bfff`
  - `#f05050`
  - `#f0a030`
  - `#b06aff`
  - `#40c080`
  - `#ff6090`
  - `#60d0c0`
  - `#aaa`
- The name field must trim whitespace on save.
- Empty project names are rejected with `Please enter a project name.`
- The project nudge interval input presents min `5` and max `480`.
- Current behavior coerces invalid interval input to `180` and clamps entered values to at least `1`.
- On successful creation, save the project as active with no tasks and navigate to its detail route.
- On successful edit, update the existing project and close the modal.

### Project Detail View

- The topbar shows:
  - Project color dot.
  - Project name.
  - `Pause` or `Resume`, depending on active state.
  - `Edit`.
  - `Delete`.
- `Pause` sets `active` to false.
- `Resume` sets `active` to true.
- `Edit` opens the project modal.
- `Delete` shows a browser confirmation: `Delete "{projectName}"?`
- Confirming deletion deletes the project, removes its task timing entries, and navigates to `/`.
- Canceling deletion leaves the project unchanged.
- Project metadata shows:
  - `{done}/{total} tasks done`.
  - `Nudge every {nudgeMinutes}m`.
  - `Paused` in amber when inactive.

### Task List

- Project detail shows a task list below project metadata.
- If there are no visible tasks, show `No tasks yet - add one below.`
- Visibility:
  - If `showCompleted` is true, show all tasks.
  - If `showCompleted` is false, hide completed tasks.
- Each visible task row shows:
  - Drag handle.
  - Circular step indicator.
  - Task name.
  - Optional task description.
  - Completion timestamp for completed tasks.
  - Active or snoozed tag when applicable.
  - Row actions.
- Step indicator:
  - Completed tasks show a check mark.
  - Current focus task shows an active filled indicator.
  - Other unfinished tasks show their visible list index plus one.
- Completed task names are dimmed and struck through.
- Pending non-active task names are dimmed.
- Current focus unsnoozed tasks show tag `Current focus`.
- Snoozed tasks show `Snoozed - {duration} left`.
- Completed tasks show a `Done {date}` timestamp in short English locale format.
- Task rows are draggable.
- Dropping a dragged task onto another visible task moves it to the target visible index.
- Dragging shows reduced opacity.
- Drag-over state shows a subtle green highlighted insertion style.
- `+ Add task` opens the task modal.

### Task Creation And Editing

- Adding a task opens a modal titled `Add task`.
- Editing a task opens a modal titled `Edit task`.
- Required fields:
  - Task name.
- Optional fields:
  - Details.
- Task name trims whitespace on save.
- Task description trims whitespace on save.
- Empty names are rejected with `Please enter a task name.`
- New tasks append to the end of the selected project.
- Editing updates the existing task name and description.

### Task Actions

- Current focus task action `Done` marks the task complete and records `completedAt`.
- Completed task action `Undo` marks the task unfinished and clears `completedAt`.
- Snoozed task action `Wake` clears `snoozedUntil`.
- Edit action opens the task modal.
- Delete action removes the task and its task timing entry. Current behavior does not show a confirmation for task deletion.
- Completing a task removes its timing entry and starts timing the next unfinished task, if any.
- Undoing a task makes it eligible to become current focus according to task order.
- Skipping a task moves it to the end of the queue and starts timing the new current focus task.

### Settings

Settings open in a modal titled `Settings`.

General settings:

- Default nudge interval:
  - Label: `Default nudge interval`.
  - Helper: `Minutes before a task needs attention`.
  - Numeric input min `5`, max `480`.
  - Current behavior clamps entered values to at least `1` and coerces invalid values to `180`.
- Show completed tasks:
  - Toggle.
  - Controls completed task visibility in project detail.
- Start automatically on startup:
  - Toggle.
  - Controls OS login item registration.
  - Launches Nudge hidden when enabled.

Notification settings:

- Enable browser notifications:
  - Toggle.
  - Controls whether background nudge timer is active.
- Max notification frequency:
  - Numeric input min `1`, max `60`.
  - Minimum minutes between any notifications.
- Nudge batch size:
  - Numeric input min `1`, max `20`.
  - Number of projects included in one notification.
  - Current behavior clamps entered values to at least `1`.
- Dismiss notifications automatically:
  - Toggle.
  - When off, notifications use a persistent timeout type where supported.
- Notification duration:
  - Numeric input min `1`, max `300`.
  - Disabled and visually dimmed when auto-dismiss is off.
  - Clamped to 1 to 300 seconds.
- Quiet hours:
  - Two numeric hour inputs from `0` to `23`.
  - Start hour is inclusive.
  - End hour is exclusive.
  - Supports overnight windows such as `22` to `8`.
- Nudge tone:
  - Select with `Gentle` and `Firm`.

Workflowy settings:

- Enable Workflowy sync:
  - Toggle.
  - When off, Workflowy projects are removed from the runtime project list.
- API Key:
  - Password input.
  - Includes a link to `https://workflowy.com/api-key`.
  - Includes a `Test` button.
  - Empty key test shows `Please enter an API key`.
  - During test, button says `Testing...`.
  - Successful test shows a checkmark symbol followed by `Connected`.
  - Failed test shows a red error message.
- Project Tag:
  - Text input.
  - Empty value saves as `#nudge`.
- Search paths:
  - Text input.
  - Optional comma-separated paths.
  - Path levels are separated by `>`.
- Informational panel explains:
  - Tag any Workflowy bullet with the configured tag to make it a project.
  - Child bullets become tasks.
  - Completing tasks syncs both ways.

Saving settings:

- Saves all settings.
- Shows toast `Settings saved`.
- Closes the modal.
- If Workflowy settings are enabled with an API key, starts sync.
- If Workflowy is disabled, clears runtime Workflowy projects.
- If launch-on-startup changed, updates OS registration through Electron.

### Notification Permission Banner

- If notification permission is `default` and notifications are enabled, show a banner above the route content.
- Banner text: `Enable browser notifications to get gentle nudges when tasks need attention.`
- Primary action `Enable notifications` requests permission.
- Secondary action `No thanks` disables notifications in settings.
- Current Electron implementation treats permission as granted, so this banner primarily applies to browser-like environments.

### Toasts

- Toast appears centered near the bottom of the viewport.
- Toast text clears automatically after 2400 milliseconds.
- Showing a new toast resets the timer.
- Toasts are passive and do not block interaction.

## 9. Notification Requirements

### Eligibility

A project is eligible for a nudge when:

- Notifications are enabled.
- The project is active.
- The project has a current focus task.
- The current focus task is not snoozed.
- The current focus task age is at least `project.nudgeMinutes`.
- The global notification frequency window has elapsed.
- The project-specific cooldown window has elapsed.
- The current time is not inside quiet hours.

Note: The current working tree calculates quiet-hour-aware countdowns in Focus. QA must verify that actual background notifications also respect quiet hours.

### Scheduling And Display

- Background checks run every 60 seconds.
- A separate app tick runs every 30 seconds to refresh timers and trigger periodic Workflowy sync.
- Batch notifications include up to `nudgeBatchSize` eligible projects.
- With batch size `1`, notifications are one project at a time.
- With multiple eligible projects and batch size greater than `1`, one notification title is `Nudge: {count} projects need attention`.
- Multi-project notification body lists each project and task on separate bullet-like lines: `{projectName}: {taskName}`.
- Single-project gentle notification:
  - Title: `Nudge: {projectName}`
  - Body: `Still waiting: {taskName}`
- Single-project firm notification:
  - Title: `Action needed: {projectName}`
  - Body: `Task waiting: {taskName}`
- When no native Electron notification bridge is available, log the notification content to the console.
- Clicking an OS notification shows and focuses the main app window.
- Notification state persists under localStorage key `nudge-notification-state`.
- Notification state contains:
  - `lastNotificationTime`.
  - `projectLastNotified` by project id.
- Resetting notification state clears this persistence key.

### Focus Countdown Calculation

- Countdown considers task age, project nudge interval, project cooldown, global notification frequency, snooze time, and quiet hours.
- If a task is snoozed, countdown is time until snooze ends.
- If a task is already individually ready, projects are placed in a queue and staggered by `maxNotificationFrequency`.
- Countdown formatting:
  - `nudge ready` for zero milliseconds.
  - `nudge in {h}h {m}m` when hours and minutes are present.
  - `nudge in {h}h` when hours are present and minutes are zero.
  - `nudge in {m}m {s}s` when minutes and seconds are present.
  - `nudge in {m}m` when only minutes are present.
  - `nudge in {s}s` below one minute.

## 10. Workflowy Requirements

### API Access

- Workflowy API requests are made from the Electron main process to avoid browser CORS restrictions.
- Requests use bearer token authorization.
- Invalid API key errors should produce user-facing text: `Invalid Workflowy API key. Check your key at workflowy.com/api-key`.
- General API failures should include status and status text.

### Project Discovery

- Configured project tag matching is case-insensitive.
- Workflowy rich-text HTML must be stripped from names and notes.
- Common entities must be decoded: `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&nbsp;`.
- The tag is removed from displayed project and task names.
- Empty names become `Untitled Project` for projects and `(unnamed)` for tasks.
- If search paths are configured:
  - Split paths by comma.
  - Split each path by `>`.
  - Trim whitespace.
  - Deduplicate identical paths.
  - Navigate each path from Workflowy root.
  - Match each segment case-insensitively by substring.
  - Discover tagged children under the destination node.
- If no search paths are configured:
  - Scan root tagged bullets.
  - Scan one level below untagged root bullets.
- A tagged bullet with child bullets becomes a project and its child bullets become tasks.
- A tagged bullet with no child bullets becomes a single-task project where the bullet is both project and task source.
- Project colors cycle through the configured color palette by discovered project index.
- Workflowy project nudge interval defaults to 180 minutes.
- Workflowy projects are always active in the Nudge runtime view.

### Task Ordering And Completion

- Workflowy child tasks are sorted by Workflowy `priority` ascending before display.
- If priorities tie or are missing, preserve fetched order.
- The current focus task is the first unfinished task after sorting.
- Completing a Workflowy task calls `/nodes/{taskId}/complete`.
- Undoing a Workflowy task calls `/nodes/{taskId}/uncomplete`.
- After completing or undoing a Workflowy task, refresh Workflowy projects.
- If completion sync fails, show workflowy error `Failed to sync completion to Workflowy`.
- If undo sync fails, show workflowy error `Failed to sync to Workflowy`.
- Workflowy projects are merged with local projects at runtime.
- If a local project and Workflowy project have the same id, keep the local project and do not duplicate it.
- Workflowy sync runs automatically every 60 seconds when enabled with an API key.

## 11. Visual Design Requirements

### Overall Look

- Dark, quiet, utility-focused desktop interface.
- Avoid decorative imagery, marketing layout, oversized hero text, or card-heavy visual treatment.
- Layout is a two-column app shell:
  - Fixed left sidebar.
  - Flexible main pane.
- Dominant colors:
  - App background: `#0f0f0f`.
  - Sidebar and modal background: `#181818`.
  - Hover surface: `#222`.
  - Primary accent: `#c8f04a`.
  - Main text: `#f0f0f0`.
  - Secondary text: `#888`.
  - Muted text: `#555`.
  - Danger: `#f05050`.
  - Success: `#40c080`.
  - Amber paused state: `#f0a030`.
- Font family is `DM Sans`, falling back to sans-serif. Monospace is used for counters, metadata, timings, and diagnostics.
- Body text is compact, generally 11 to 14 px.

### Layout Dimensions

- Sidebar width: 230 px.
- Main content fills remaining width.
- App height: full viewport.
- Main content scrolls vertically.
- Topbar minimum height: 56 px.
- Main content padding: 24 px.
- Modal max width: 420 px.
- Modal max height: 88 viewport height.

### Component Styling

- Buttons:
  - 6 px vertical and 14 px horizontal padding.
  - 12 px font.
  - 10 px border radius.
  - Transparent by default with subtle border.
  - Primary buttons use `#c8f04a` background and black text.
  - Danger buttons use red text and red-tinted border.
- Sidebar items:
  - 7 px vertical and 10 px horizontal padding.
  - 10 px border radius.
  - Active Focus item uses green-tinted background and green text.
- Focus rows:
  - 10 px vertical and 14 px horizontal padding.
  - 8 px border radius.
  - Actions are hidden until row hover.
- Task rows:
  - 12 px vertical and 8 px horizontal padding.
  - 8 px border radius.
  - Bottom border between rows.
  - Cursor indicates drag.
- Modals:
  - Backdrop uses black at 75 percent opacity.
  - Modal border uses subtle white alpha.
  - Header and footer have subtle separators.
- Form inputs:
  - Dark background.
  - 10 px border radius for modal form fields.
  - Green focus border.
  - Red error border.
- Toggles:
  - 34 by 20 px pill.
  - On state uses green background and black knob.
  - Off state uses dark background and muted knob.
- Toast:
  - Fixed bottom center.
  - Dark background.
  - 10 px border radius.

### Responsive Expectations

- The current product target is desktop Electron.
- Minimum supported window size is 800 by 600.
- At minimum width, text should truncate rather than overlap.
- The topbar may wrap action buttons.
- The app must not introduce a separate mobile navigation pattern unless product scope changes.

## 12. User Stories And Acceptance Criteria

### Story 1: Create A Local Project

As a user, I want to create a project so I can track a set of next actions.

Acceptance criteria:

- Opening `+ New project` shows the new project modal.
- Saving with an empty name shows the project name error and does not create a project.
- Saving a valid name, color, and interval creates an active local project.
- The new project is persisted.
- The app navigates to the new project detail view.

### Story 2: Add And Complete Tasks

As a user, I want to add tasks and mark them done so the project automatically advances.

Acceptance criteria:

- `+ Add task` opens the add task modal.
- Empty task name is rejected.
- Valid task saves to the end of the project list.
- The first unfinished task is labeled `Current focus`.
- Completing the current task marks it done, records a completed timestamp, and makes the next unfinished task current.
- If all tasks are complete, the project disappears from Focus.

### Story 3: Keep Work Moving From Focus

As a user, I want to act on tasks directly from Focus so I do not need to open each project.

Acceptance criteria:

- Focus shows every active project with an unfinished task.
- Each row shows the project and current task.
- Row actions appear on hover.
- Done, snooze, and skip work without navigating.
- Clicking elsewhere on the row opens the project detail.

### Story 4: Pause A Project

As a user, I want to pause a project so it does not appear in Focus or notify me.

Acceptance criteria:

- Clicking `Pause` sets the project inactive.
- The project detail metadata shows `Paused`.
- The project no longer appears in Focus.
- The project does not generate notifications.
- Clicking `Resume` restores the project to Focus if it has unfinished tasks.

### Story 5: Reorder Tasks

As a user, I want to reorder tasks so the right next action is surfaced.

Acceptance criteria:

- Dragging a task row shows a drag state.
- Dropping onto another visible row moves the dragged task to that row index.
- The first unfinished task after reordering becomes the current focus task.
- Reordering persists across restart.

### Story 6: Receive Nudges

As a user, I want desktop notifications when a task waits too long so projects do not go stale.

Acceptance criteria:

- An eligible task produces a native desktop notification after its nudge interval.
- Notifications respect global frequency, project cooldown, snooze, pause, and quiet hours.
- Notification title and body match the selected tone.
- Clicking the notification opens and focuses the app.
- Notification timing state persists across restart.

### Story 7: Configure Notification Behavior

As a user, I want to control notification timing and tone so nudges fit my work style.

Acceptance criteria:

- Settings allow changing frequency, project cooldown, batch size, auto-dismiss, duration, quiet hours, tone, and notification enablement.
- Saving settings persists values and closes the modal.
- Disabling notifications prevents new background nudges.
- Auto-dismiss off disables the duration input and keeps notifications visible where the OS supports it.

### Story 8: Sync Workflowy Projects

As a Workflowy user, I want tagged bullets to appear as Nudge projects so I can keep Workflowy as my source of truth.

Acceptance criteria:

- Enabling Workflowy with a valid API key and tag imports matching projects.
- Tagged bullets with children become projects whose children are tasks.
- Tagged bullets without children become single-task projects.
- Workflowy HTML formatting is stripped from displayed text.
- Task ordering follows Workflowy priority.
- Completing and undoing Workflowy tasks in Nudge updates Workflowy.
- Sync errors are visible in the sidebar.

### Story 9: Start On Sign-In

As a user, I want Nudge to launch automatically so reminders work without manual startup.

Acceptance criteria:

- The startup toggle reads the OS registration state on app launch.
- Enabling startup registers Nudge to open at login hidden.
- Disabling startup removes the login registration.
- The setting remains accurate after restart.

## 13. Edge Cases

- Empty local storage starts with no projects.
- Invalid persisted JSON starts empty and shows invalid diagnostics.
- A project with no tasks shows the project detail empty task state.
- A project with all tasks complete is omitted from Focus and sidebar project list.
- A paused project with incomplete tasks remains accessible in sidebar but not Focus.
- A task with no recorded start time has near-zero age.
- Snoozed tasks show remaining time and are not eligible for notifications.
- Snooze expiration makes the task eligible again according to timing rules.
- Long project and task names truncate where needed and must not overlap actions.
- Workflowy duplicate search paths do not duplicate fetches or projects.
- Workflowy sync failure resets any in-flight guard so future sync can retry.
- Multiple sync calls must not duplicate projects.
- A missing project route shows the not-found view instead of crashing.
- Launch-on-startup paths containing spaces must be quoted correctly in development.

## 14. Known Ambiguities To Resolve

- The Focus view counts `needs attention` when a task reaches 70 percent of its nudge interval, but the project modal hint says `needs attention at ~{nudgeMinutes * 1.4}m`. A deterministic rebuild should either preserve both as current behavior or update the copy and tests to match the intended rule.
- The current working tree includes a visible `trigger` control for testing notifications. Decide whether this remains a supported product control, becomes development-only, or is removed.
- Quiet hours are represented in settings and Focus countdowns. QA should verify that actual background notifications are blocked during quiet hours before treating the implementation as complete.
