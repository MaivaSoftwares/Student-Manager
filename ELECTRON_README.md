# Running as a Desktop App (Electron)

This project includes a minimal Electron wrapper to run the Next.js app as a desktop application.

## Requirements
- Node 16+ (matching your local env)
- Dependencies already listed in `package.json` (run `npm install`)

## Development
1. Start the Next.js dev server and Electron together:

```powershell
npm run electron:dev
```

This uses `concurrently` to run `next dev` and Electron. Electron will wait for the renderer at `http://localhost:3000`.

## Packaging (production)
This project packages a production-ready Electron app that serves the static Next.js export (`out/`) via a lightweight local HTTP server inside Electron. This avoids `file://` asset issues and removes the need to run `next start` in production.

Steps to build and package:

1. Build the renderer (production Next build):

```powershell
npm run electron:build-renderer
```

2. Package with `electron-builder` (creates installers in `dist/`):

```powershell
npm run electron:build
```

After packaging, install the generated installer from the `dist/` folder (Windows: `.exe` or `.msi`, macOS: `.dmg` or `.zip`).

Notes:

- The packaged Electron app will serve the `out/` folder on a local `127.0.0.1` port. Ensure the production build artifacts are present (run step 1).
- Local backups are stored on disk under the app's user data directory (see Settings > Local Backup in the desktop app).
- Do not embed secrets in the distributed app. For production consider keeping credentials in OS secure storage or a remote API.

## Triggering Sync from Renderer
A small preload bridge exposes `window.electronAPI.syncPush(payload)` when running inside Electron. Use the helper in `lib/electron-sync.ts` or call `window.electronAPI.syncPush` directly from client code.

Example usage in client code:

```ts
import { pushSync } from '../lib/electron-sync';

await pushSync({ courses: myCoursesArray, tasks: myTasksArray });
```

When invoked, the Electron main process will call the MongoDB helpers in `lib/mongo.ts` to upsert data into your configured `MONGODB_URI`.

Security note: Keep your `MONGODB_URI` and credentials secure. For single-user desktop apps you may store them in a secure store, or prefer a remote API (recommended) for multi-user distribution.
