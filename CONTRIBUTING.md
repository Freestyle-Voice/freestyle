# Contributing to Freestyle

Thanks for your interest in contributing.

## Prerequisites

- **Node.js 22+**
- **pnpm 10+**

## Setup

1. Fork and clone the repo

   ```bash
   git clone https://github.com/freestyle-voice/freestyle.git
   cd freestyle
   ```

2. Install dependencies

   ```bash
   pnpm install
   ```

3. Start development

   ```bash
   pnpm dev
   ```

   This starts the Electron app with hot-reloading via `electron-vite`. The embedded Hono server starts automatically on a local port.

   On first launch, macOS will prompt for:
   1. **Microphone** access
   2. **Accessibility** access (required for paste simulation and global key listener)

## Build

```bash
# macOS
pnpm --filter @freestyle/electron build:mac

# Windows
pnpm --filter @freestyle/electron build:win

# Linux
pnpm --filter @freestyle/electron build:linux
```

## Project structure

- `apps/electron` — Electron desktop app (main process + React renderer)
- `apps/server` — Hono API server (embedded in the Electron app)

The server is a workspace dependency of the Electron app. Turborepo ensures it's built first.

- **Electron main process** — system tray, global hotkey (`node-global-key-listener`), non-focusable pill window, IPC bridge
- **Renderer** — React 19 + react-router, shadcn/ui components, Tailwind CSS v4, Three.js orb visualization
- **Server** — Hono HTTP + WebSocket, AI SDK for transcription, SQLite for settings/history/API keys

## Development workflow

1. Create a branch from `main`
2. Make your changes
3. Run `pnpm biome check .` to verify lint and formatting
4. Run `pnpm --filter @freestyle/electron typecheck:web` to verify types
5. Commit — husky runs biome on staged files automatically
6. Open a PR against `main`

## Code style

- **Biome** for linting and formatting (not ESLint/Prettier)
- 2-space indentation, 80-char line width
- Imports are auto-sorted by Biome

## Commit messages

Follow conventional commits:

```
feat: add new feature
fix: resolve a bug
chore: maintenance task
```

## Architecture notes

- The pill window uses `focusable: false` and `showInactive()` to avoid stealing focus
- Global hotkey uses `node-global-key-listener` for key-up detection (hold-to-record)
- The server runs on a dynamic local port, exposed to the renderer via IPC
- API keys are stored in SQLite in the user data directory
