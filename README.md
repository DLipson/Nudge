# Nudge

Nudge keeps your active projects at the forefront of your mind so you don't have to keep setting reminders. It tracks the next unfinished task in each project, **automatically advances to the next task when you complete one**, and sends quiet desktop nudges when a task has been sitting too long. The result: a project stays moving because you always know what's next, without having to revisit a to-do list to figure it out.

Nudge integrates with tools you already use — Workflowy today, with more sources planned — so your projects live where they already live and Nudge just handles the "keep this on my mind" layer.

## Features

- **Auto-advance.** Complete a task and the next one takes its place immediately — no manual re-reminding.
- **Focus view.** See every active project's next task in one place, sorted by urgency.
- **Nudge notifications.** Get quiet desktop nudges when a task has been neglected past your threshold.
- Per-project nudge intervals, snooze, skip, edit, delete, and reorder.
- Desktop notifications with quiet hours and frequency limits.
- Sync projects and tasks from Workflowy by tag.
- Launch automatically on sign-in.

## Tech Stack

- Electron
- React
- TypeScript
- Vite
- Vitest

## Requirements

- Node.js 20 or newer
- npm

## Getting Started

Install dependencies:

```bash
npm install
```

Start the app in development mode:

```bash
npm run dev
```

This starts Vite, compiles the Electron main process in watch mode, and opens the Electron app when both are ready.

## Scripts

```bash
npm run dev
```

Runs the app locally for development.

```bash
npm run build
```

Builds the React app and Electron main process.

```bash
npm run dist
```

Builds distributable desktop installers with electron-builder.

```bash
npm run test:run
```

Runs the test suite once.

```bash
npm test
```

Runs Vitest in watch mode.

## Workflowy Sync

Nudge can import projects from Workflowy:

1. Get an API key from `https://workflowy.com/api-key`.
2. Open Nudge settings.
3. Enable Workflowy sync.
4. Enter the API key.
5. Choose the project tag, such as `#nudge`.
6. Optionally limit sync to comma-separated search paths, such as `Life > Work, Life > Personal`.

Any Workflowy bullet containing the configured tag becomes a project. Its child bullets become tasks. If a tagged bullet has no children, the tagged bullet becomes a single-task project.

## Local Data

Nudge stores app state locally under the configured storage key:

```json
{
  "storage": {
    "localStorageKey": "nudge_v4"
  }
}
```

When running inside Electron, the app also reports its user data path in Settings under Storage Diagnostics.

## Development Notes

- Keep behavior covered by focused Vitest tests.
- Add bug investigations and fixes to `logs.md`.
- Keep changes small and tied to one logical task.
