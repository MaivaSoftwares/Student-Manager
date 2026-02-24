StudyDash (UESTC)
===================

A student dashboard and timetable app built with Next.js (App Router), Tailwind, Radix UI and bundled as a desktop app with Electron. It is an offline-first app using Dexie/IndexedDB for local storage and supports optional cloud sync to MongoDB Atlas (via the Electron main process). The project includes features for timetables, tasks, exams, exports (JSON/CSV/XLSX), and basic desktop packaging.

Key files & folders
- `app/` — Next.js app (App Router). Pages include `timetable`, `tasks`, `settings`, and the new `exams` page.
- `components/` — UI components and layout parts (sidebar, mobile navigation, dashboard widgets).
- `lib/` — app libraries: `database.ts` (Dexie DB), `stores/app-store.ts` (Zustand store), `mongo.ts` (server-side helpers), `electron-*` helpers.
- `electron/` — Electron scaffold (main, preload) and IPC bridge for sync + secure credential storage.

Overview of main features
- Timetable
  - Add/edit courses with single or multiple sessions (series support).
  - Validation for times / weeks and overlap warnings.
  - Week navigation on Dashboard timeline (Prev/Next/Today) and per-day schedule.
- Exams
  - Add exams from a course or custom title, with date/time and optional seat number.
  - Filter by month and weekday in the Exams view.
- Tasks
  - Standard task list with priorities and due dates.
- Exports
  - Export app data as JSON, CSV or XLSX from Settings.
- Cloud Sync
  - Optional: sync to MongoDB Atlas using Electron main process helpers. Credentials are stored in OS secure storage (via `keytar`) and not exposed to the renderer.
- Desktop
  - Electron wrapper that starts an internal Next server in production. Dev mode uses the Next dev server.

Local database (Dexie)
- Local DB is implemented in `lib/database.ts` using Dexie.
- Schema versions:
  - v1 — initial
  - v2 — added `semesterId` and `major` indexes
  - v3 — added `seriesId` index (used to group multi-session courses)
  - v4 — added `exams` store
- On upgrade, Dexie auto-migrates indexes. If migration issues occur you can clear the local DB from the Settings page (or via DevTools -> Application -> IndexedDB).

Development
1. Install dependencies

```powershell
npm install
```

2. Run Next.js dev server

```powershell
npm run dev
```

3. Run Electron in dev (starts Next dev then Electron)

```powershell
npm run electron:dev
```

Building the renderer & Electron app
- Build only the Next renderer (used in CI or for packaging):

```powershell
npm run electron:build-renderer
```

- Build/package Electron (production):

```powershell
npm run electron:build
# or to just create a portable package
npm run electron:pack
```

Notes: Packaging on Windows may require elevated privileges or Developer Mode due to symlink extraction steps. If you see 7-Zip symlink errors during packaging, run the build in an elevated PowerShell or enable Developer Mode.

Electron and secure credentials
- Credentials (e.g., `MONGODB_URI`) are stored using `keytar` in the main process.
- The renderer uses the preload bridge (`electron/preload.js`) to request save/check/delete operations.
- IPC channels used by the renderer (examples): `sync:push`, credential operations like `credential:set`, `credential:get`, `credential:delete`, `credential:has`.

Cloud sync
- The app ships a `lib/mongo.ts` helper for connecting/upserting courses and tasks.
- In desktop mode the main process can call these helpers directly to push local data up to MongoDB Atlas.
- The Settings page contains a "Sync to Cloud" action that either calls the internal API (web) or uses the Electron bridge (desktop).

Timetable behavior notes
- Editing a course:
  - Editing respects `seriesId` (grouped sessions). If you edit a single-row course and convert it into multiple sessions, a new `seriesId` is created and the original row is replaced.
  - Overlap warnings are informational only — they do not block saving.
- The Dashboard timeline merges courses and exams for the selected day and week, and always sorts by time (HH:MM) for a consistent schedule view.

Exams
- Schema: `exams` store in Dexie with fields: `id`, `title`, `courseId?`, `seatNumber?`, `date` (YYYY-MM-DD), `time` (HH:MM), `semesterId?`, `major?`.
- Exams page (add/edit) supports creating from a course or custom title, optional seat number, and date/time. Filtering by month and weekday is available. Sorting by time is used in the combined Dashboard schedule.

Troubleshooting
- "KeyPath seriesId on object store courses is not indexed": resolved by adding `seriesId` index in `lib/database.ts` (v3). If you still see this, reload the app and let Dexie upgrade the DB, or clear `IndexedDB`.
- Packaging fails with symlink extraction errors on Windows: run the packaging command in an elevated PowerShell or enable Developer Mode.
- If the renderer can’t reach the internal Next server in production electron, ensure `next start` was spawned by the main process and check the server logs in the Electron developer console.

Testing & QA
- Manual checks: add/edit multi-session courses, convert single -> series, add exams and verify they show on Dashboard for the selected week and day.
- Run Next build and check for TypeScript/hydration errors before packaging:

```powershell
npm run build
```

Contributing
- Fork the repo, create a feature branch, and open a PR. Keep changes focused and respect existing code style (TypeScript + React + Tailwind).

License
- No license file is included by default. Add a license file if you plan to publish this project.

Contact
- If you want me to expand the README (add diagrams, developer flow, or CI instructions), say which sections you want more detail on and I’ll add them.
