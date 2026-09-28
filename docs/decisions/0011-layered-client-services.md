# 0011. The client is layered: domain, storage, services, screen groups, and the lint enforces it

Date: 2026-09-27 · Status: accepted · Tracker: E11

## Context
`App.tsx` had grown past 1800 lines: every screen's state, every Dexie read, backup import/export
and sync all lived in one component. Nothing stopped a screen from reaching into `src/storage`
directly, or a service from importing a component. The trainee asked for changes (Programs as
data, cloud sync) that kept landing as edits to the same file because there was no boundary to
put them behind.

## Decision
- **Layers, each pointing only downward:** `src/domain` (pure types and rules) →
  `src/storage` (Dexie, the only place that touches `dexie` or reads/writes `db.sessions` etc.)
  → `src/services` and `src/sync` (one `Service` per concern, composed in `src/services/index.ts`
  as `createServices()`) → `src/features` (one **screen group** per tab or overlay, e.g.
  `ExercisesFeature`, `WorkoutFeature`, `ProgramFeature`, `SettingsFeature`, `HistoryFeature`,
  `AlternativesOverlay`, `DetailOverlay`) → `src/ui` and `src/App.tsx` (the shell: which tab and
  route are showing, nothing else). `src/worker` (the Cloudflare Worker) is reached only from
  `src/sync`.
- **Service**: an object built by `createXService(deps)` in `src/services/*.ts`, the only thing
  outside `src/storage` allowed to read or write state, returned from `createServices()` and
  handed down through `ServicesProvider` (`src/features/ServicesProvider.tsx`).
- **Repository**: a module in `src/storage/*.ts` reading and writing one Dexie table (or a
  settings key) and nothing else — "every reader of `db.sessions` lives in `src/storage`".
- **Screen group (feature)**: one directory under `src/features/*` holding one tab's or
  overlay's component plus the hook that reads its slice of the services (`useServiceData`
  pattern). It renders inside `src/App.tsx`'s shell and never imports storage or sync directly.
- **Change topic**: one of `ChangeTopic` (`'sessions' | 'programs' | 'preferences'`,
  `src/services/changes.ts`), the unit a `ChangeBus` subscribes to and emits so a screen group
  re-reads only the service data a mutation actually touched.
- **The rule, enforced by `eslint.config.js`'s `[layers]` blocks and read back by
  `src/architecture.test.ts` (O1–O4):**
  - `src/domain` imports nothing outside itself (`[layers] domain is pure`).
  - `src/storage` imports nothing from services, sync, ui or features, and not `react`
    (`[layers] storage points down`).
  - `src/services` and `src/sync` import nothing from ui or features
    (`[layers] services and sync point down`).
  - `src/ui`, `src/features` and `src/App.tsx` import nothing from `src/storage`, `src/sync`
    (a type-only import is fine — the account view's `SyncView` type is shared this way), `dexie`
    or `src/worker` (`[layers] ui reaches services only`).
  - Outside `src/storage`, only a type-only import of `src/storage/db` is allowed, and `dexie`
    itself is reachable from nowhere but `src/storage` (`[layers] only storage touches Dexie`).
  `@typescript-eslint/no-restricted-imports` (not the base rule) carries `allowTypeImports` so a
  type-only re-export doesn't trip a runtime-reach rule.

## Alternatives rejected
- dependency-cruiser: another tool and config format for what ESLint's own restricted-imports
  rule already expresses; out of scope per the ticket.
- One flat "no cross-layer imports" rule: the layers point down at different depths (services
  reach storage; ui does not), so one rule can't carry every message.

## Consequences
A screen group can only reach state through a Service, so state either has one Service-shaped
entry point or the lint fails at review time, not at code-review-by-eye time. Adding a Service
means updating `createServices()` and its type once. The `import type` exemptions mean the type
system's own layering (types flow freely) doesn't fight the runtime layering (calls only go
down) — a file may `import type` a sibling layer's shape without owning a runtime dependency on
it.

## Outcome
Built across E11 (T1 productionFiles/importsOf/lintFixture and O2's domain/storage/services
rules, T2–T14 the services, screen groups and ServicesProvider, T15 App.tsx cut down to a thin
shell, T16 this record and O1/O3's rules). PR: see the E11 pull request.

Departures from the ticket/spec's literal wording, found while building the layers:
- `SyncView` moved to `src/services/syncView.ts` rather than staying inline in a component.
- `createSyncClient` is built per instance, and calls `onPulled(topics)` rather than a single
  callback with no argument.
- `setLastExportedAt(at, now?)` has no default for `now`; every caller passes it explicitly.
- Backups count only finished Sessions (`listSessions`'s definition), not in-progress ones.
- `DetailOverlay`/`AlternativesOverlay` take `catalog`, `gymEquipment` and `onOpenDetail` as
  props rather than reading a service directly, since an overlay is opened from more than one
  screen group.
- The Exercises tab's search text and filters are held as `App.tsx` UI state and passed into
  `ExercisesFeature`, so they survive leaving the tab and coming back, as they did when
  `App.tsx` held `librarySearch`. Each screen group otherwise remounts on every tab visit.
- `WorkoutFeature` takes an optional `landInSession` prop rather than resolving it itself.
- The Shell component lives at `ShellChrome` in `src/ui/AppShell.tsx`.
- O4's lint-message tests check with `message.includes(...)` rather than an exact match, since
  ESLint's own rule prefixes the configured message.
- O3's one sanctioned exception is `src/services/backup.ts`'s `import type { SettingRow } from
  '../storage/db'` — a type-only reuse of storage's row shape, no runtime Dexie reach.

Also from the run (2026-09-27, `/batch-implement E11`):
- `App.tsx` went from 1452 lines to 131; the suite from 1299 tests to 1590, with every title
  that existed at the epic base still present and passing (`weakened-tests.sh` clean from
  `5c92f18`).
- History and Exercises now refresh after local writes as well as after a pull (O12, intended).
- Session-service failures other than `not-found` carry new message text; the UI showed
  nothing for them before and still doesn't.
- `ProgramFeature` wires Delete and Reset exactly as `App.tsx` did (stored user Programs vs.
  bundled ids). A first cut widened them to untouched bundled Programs to satisfy a test; the
  test was reseeded instead. Its tests seed `activeProgramId`, since a new user has no default
  Program (the `App.newUser` baseline).
- `SetScreen.onLog` is required; `src/ui/useWakeLock.test.ts`'s helper passes it, with its
  titles and assertions unchanged.
