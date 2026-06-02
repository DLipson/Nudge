# Nudge

Nudge is a small Electron task app for keeping active projects moving. It tracks the next unfinished task in each active project, highlights work that has gone stale, and can send quiet desktop nudges when a task needs attention.

## Features

- Create local projects with ordered tasks.
- Focus on the next unfinished task for each active project.
- Complete, snooze, skip, edit, delete, and reorder tasks.
- Configure per-project nudge intervals.
- Enable desktop notifications with quiet hours and notification frequency limits.
- Launch automatically on sign-in from the app settings.
- Sync projects and tasks from Workflowy by tag.
- View storage diagnostics from the settings modal.

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
