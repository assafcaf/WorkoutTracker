# WorkoutTracker: working notes

Mode: on   ·   Last scanned: 2026-09-28

Every line below is transcribed from a committed decision record or carries a path a scanner
checked. Nothing here is a model's opinion about how the project should work. Where a line
came from a decision, the record is cited — read that, not this, for the reasoning.

## What this repo is

One trainee's set logger for a fixed A/B program, installed to an iPhone home screen and used
in a gym with no signal. It replaces an Excel sheet of cells like `10|50,10|60,10|60`.

It is deliberately **not**: multi-user, backed by a server, synced, or editable from the phone.
No accounts and no network calls — durability is a manual JSON export, not a backend. Programs
and the exercise catalog are versioned in this repo and change by commit, not in the app. See
`docs/decisions/0002-pwa-local-first-workout-tracker.md`, whose rejected alternatives are the
non-goals in full.

## Module map

| Path | Owns |
|---|---|
| `src/domain/dial.ts` | The weight ladder (start weight stepping by `weightStep` to 500kg) and set-entry validation |
| `src/domain/rest.ts` | Rest-timer state, derived purely from timestamps |
| `src/domain/prefill.ts` | The values a set opens with, from the last finished session |
| `src/data/catalog.ts` | Loads the bundled catalog and validates programs' `exerciseId`s against it |
| `src/data/exercises.json` | The catalog: what each lift is (weight step, start weight, bodyweight, info link) |
| `src/data/programs` | Bundled Programs referencing catalog ids — sets, rep ranges, order, rest |
| `src/data/library.ts`, `src/data/library/` | The bundled free-exercise-db library (pinned commit, the 17 `MUSCLES`) and its video links |
| `src/data/resolve.ts` | `resolveExercise`: a catalog id as-is, else an Exercise built from the library entry |
| `src/domain/muscles.ts` | `Muscle` → `Region`, `MuscleFamily` and `familyOf`, and the `Resolve` type |
| `src/domain/programs.ts` | `mergePrograms` (bundled plus the user's own) and `ProgramFault` validation |
| `src/storage/db.ts` | The Dexie database, its `sessions` and `settings` tables (v2 adds `updatedAt` for sync), and `isStorageAvailable()` |
| `src/storage/sessionStore.ts` | Session writes and history (capped at 200), plus whole-table reads and writes for sync and backup |
| `src/storage/settingsStore.ts` | Typed get/set per setting key, plus whole-row reads and writes for sync and backup |
| `src/storage/settingKeys.ts` | Every setting key, once: whether it syncs, and its change topic |
| `src/storage/backup.ts` | The backup file format only; the export/import flow is `src/services/backup.ts` |
| `src/sync/` | `syncClient.ts` (push/pull by cursor, through storage) and `protocol.ts`, the wire types the Worker shares |
| `src/services/` | The six services, built once by `createServices` on one change bus. The UI's only way to storage and sync |
| `src/features/` | The five tab screen groups, `ServicesProvider` (runs sync once), `useServiceData`, shared overlays, `AppRoute` |
| `src/App.tsx` | The shell only: tabs, cross-tab navigation, update pill, Exercises filters kept across tabs |
| `src/architecture.test.ts` | The layer rules, as source scans and as lint fixtures for `eslint.config.js` |
| `src/worker/` | The Cloudflare Worker: `/api/*` routes, Access JWT check (`auth.ts`), D1 sync and replace (`sync.ts`) |
| `migrations/` | The D1 schema: `sessions`, `settings`, `counters` |
| `src/ui/AppShell.tsx` | Header, tab bar, the action-bar slot, and the context screen groups read chrome props from |
| `src/ui/actionBarSlot.ts` | That portal, so a screen owns its own state-gated control |
| `src/ui/body/` | `BodyMap` (Regions shaded by band) and its legend and polygon data |
| `src/ui/MuscleChip.tsx` | A muscle name tinted by its family (`data-family`) |
| `src/pwa/registerSW.ts` | Service-worker registration and the update handle the app drives |
| `src/styles/tokens.css` | The one definition site: exactly 49 custom properties, light-only |
| `src/styles/fonts.css`, `src/assets/fonts/` | The vendored Barlow Semi-Condensed 600 display face (OFL) |
| `src/test/setup.ts` | Vitest global setup — see Commands |
| `src/types.ts` | `Exercise`, `LibraryExercise`, `Muscle`, `ExercisePlan`, `Workout`, `Program`, `UserProgram`, `SetEntry`, `Session`, `VolumeBaseline` |

## Commands

The gates live in `config.md`'s Commands table. Only what that table cannot say is here.

- `src/test/setup.ts` loads **fake-indexeddb/auto** before Dexie evaluates. It is wired in
  through `vite.config.ts`'s `setupFiles`, not by any import you can see from a test.
- `node scripts/generate-icons.mjs` regenerates the three PWA icons. It is not a
  `package.json` script.
- Deployment is `.github/workflows/deploy.yml` on push to `main`: `npm ci`, `npm run build`,
  `wrangler d1 migrations apply`, `wrangler deploy`. By hand: `CLAUDE.md`, "Deploying".
- `npx tsx scripts/build-videos.ts` rebuilds `src/data/library/videos.json`. Not a script.

## Invariants

- **A logged set is written as a whole-document `put`**, so a session is never half written.
  `docs/decisions/0002-pwa-local-first-workout-tracker.md`
- **Logged sets reference the catalog id**, never a program's copy of an exercise. That is what
  keeps a lift's history continuous across every program that prescribes it.
  `docs/decisions/0002-pwa-local-first-workout-tracker.md`
- **The active program is user state**, held in storage rather than in the repo.
  `docs/decisions/0002-pwa-local-first-workout-tracker.md`
- **The app is served from the project base path /WorkoutTracker/, not a domain root.** `base`
  is set once in `vite.config.ts`, and every asset reference, the manifest's `start_url` and
  the worker's scope carry it. `docs/decisions/0003-installable-offline-and-backups.md`
- **A new version never takes over mid-session.** The app owns registration
  (`injectRegister: null`, `registerType: 'prompt'`) and `skipWaiting` runs only when the user
  accepts. `docs/decisions/0003-installable-offline-and-backups.md`
- **Everything is precached; there is no runtime caching**, because there are no network calls
  to cache. `docs/decisions/0003-installable-offline-and-backups.md`

## Standing overlaps

Of the last 40 non-merge commits on `main` touching `src/`, counted before E11 lands. After it,
`App.tsx` is a thin shell and the screen groups in `src/features/` take its place.

- `src/App.tsx` 10, `src/App.test.tsx` 10
- `src/ui/Settings.tsx` 8, `src/ui/SetScreen.tsx` 6, `src/ui/ExerciseList.tsx` 6
- `src/storage/settingsStore.ts` 6, `src/types.ts` 5

## Pitfalls

- **The `src/pwa/` and `src/styles/` tests run a real `vite build`** through
  `src/test/buildFixture.ts`, and `src/pwa/offline.test.ts` additionally does a throwaway
  `iife` build and boots the app in jsdom via `src/test/swHarness.ts`. They are slow, and a
  build failure surfaces as a test failure that reads like a product bug.
- **Most of what "looks right" means cannot be checked on this host.** Safe-area insets resolve
  to `0px` in jsdom and desktop Chrome, and scroll-snap physics has no headless equivalent — so
  `src/test/cssAudit.ts` audits stylesheets as data instead. A green suite is not a rendered
  screen. `docs/decisions/0004-one-palette-one-shell-audited-as-data.md`
- **No literal colour may appear outside `src/styles/tokens.css`** — no hex, `rgb(`, `hsl(` or
  named colour. Enforced by test, so this fails loudly rather than quietly.
  `docs/decisions/0004-one-palette-one-shell-audited-as-data.md`

## Unsettled

Found by the scans of 2026-09-23 to 2026-09-28, not yet ruled on: facts with paths, not advice.

- **"Replace" names three writes.** `src/sync/syncClient.ts` `replaceRemote` overwrites the
  server; `src/storage/sessionStore.ts` `replaceAllSessions` overwrites the device;
  `src/worker/sync.ts` `replaceAll` overwrites D1.
- **Change topics are declared three times:** `src/services/changes.ts` `ChangeTopic`,
  `src/storage/settingKeys.ts` `SettingKeyInfo.topic`, `src/sync/syncClient.ts` `PulledTopic`.
- **Two resolvers.** The `Resolve` type in `src/domain/muscles.ts` and `resolveExercise` in
  `src/data/resolve.ts` both look an id up as an Exercise.
- **`npm run deploy` skips the D1 migrations** that `.github/workflows/deploy.yml` applies.
