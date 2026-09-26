# WorkoutTracker: working notes

Mode: on   ·   Last scanned: 2026-09-23

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
| `src/data/programs` | Prescriptions referencing catalog ids — sets, rep ranges, order, rest |
| `src/storage/db.ts` | The Dexie database, its `sessions` and `settings` tables, and `isStorageAvailable()` |
| `src/storage/sessionStore.ts` | Start/resume, log a set, finish, active session, history (capped at 200 sessions) |
| `src/storage/settingsStore.ts` | Typed get/set over the `settings` table: `activeProgramId`, `lastExportedAt` |
| `src/storage/backup.ts` | Whole-database export/import as one versioned JSON file |
| `src/ui/AppShell.tsx` | Header, tab bar, and the sticky action-bar slot screens portal into |
| `src/ui/actionBarSlot.ts` | That portal, so a screen owns its own state-gated control |
| `src/pwa/registerSW.ts` | Service-worker registration and the update handle the app drives |
| `src/styles/tokens.css` | The one definition site: exactly 49 custom properties, light-only |
| `src/test/setup.ts` | Vitest global setup — see Commands |
| `src/types.ts` | `Exercise`, `ExercisePlan`, `Workout`, `Program`, `SetEntry`, `Session` |

## Commands

The gates live in `config.md`'s Commands table. Only what that table cannot say is here.

- `src/test/setup.ts` loads **fake-indexeddb/auto** before Dexie evaluates. It is wired in
  through `vite.config.ts`'s `setupFiles`, not by any import you can see from a test.
- `node scripts/generate-icons.mjs` regenerates the three PWA icons. It is not a
  `package.json` script.
- Deployment is `.github/workflows/deploy.yml` on push to `main`: `npm ci`, `npm run build`,
  publish `dist` to GitHub Pages.

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

None yet. Across the whole history no file is touched by more than 2 commits, so nothing here
forces two tasks into different waves. Re-check once more history accrues — the
`batch-implement` knowledge-gaps report is the loop that fills this in.

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

Found by the 2026-09-23 scan, not yet ruled on. Each is a fact with a path, not a
recommendation.

- **`invertProgress` has no consumer.** Declared in `src/types.ts`, seeded `true` for
  assisted-pull-ups in `src/data/exercises.json`, tested in `src/data/catalog.test.ts` — and
  read by nothing in `src/domain` or `src/ui`.
- **Settings are reached two ways.** `src/storage/backup.ts` reads the active-program key
  straight off the table at line 45 rather than through `src/storage/settingsStore.ts`.
