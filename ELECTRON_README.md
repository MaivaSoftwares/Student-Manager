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
This project packages a production-ready Electron app that starts a `next start` server inside the packaged application so server-side routes (like `/api/sync`) continue to work.

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

- The packaged Electron app will spawn an internal `next start` process that serves the built Next app. Ensure the production build artifacts are present (run step 1).
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
