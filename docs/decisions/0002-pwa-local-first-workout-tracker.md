# 0002. The workout tracker is a local-first installable PWA, built with React, TypeScript and Vitest

Date: 2026-09-22 · Status: accepted · Tracker: E1 — Log a workout (ticket not yet created)

## Context
The trainee follows a fixed A/B program and logs every set in an Excel sheet, in cells like
`10|50,10|60,10|60`. He wants to log sets on an iPhone during a session and see progress later.
Two facts constrain the answer before any preference does: the only development machine is
Windows 10, and there is no Apple Developer account. Xcode does not run on Windows, so a native
build is not reachable from this repo at all. The repo was empty, and the workflow gates in
`.claude/workflow/config.md` still held the installer's Python defaults, none of which ran here.

## Decision
- Ship an installable PWA: React 18 + TypeScript + Vite 5, added to the iPhone home screen.
  Vite 5 and Vitest 2 rather than the current majors, because the host runs Node 18.20.7.
- Data is local-first: a single Dexie/IndexedDB `sessions` store on the phone, with each logged
  set written as a whole-document `put` so a session is never half written. No backend, no
  accounts, no sync. Durability comes from a manual JSON export, not from a server.
- Training data is split in two, both versioned in this repo and neither editable from the
  phone: `src/data/exercises.json` is a catalog of what each lift is (weight step, start weight,
  bodyweight, info link), and `src/data/programs/*.json` are prescriptions referencing catalog
  ids with their own sets, rep ranges, order and rest. Logged sets reference the catalog id, so
  an exercise's history is continuous across every program that prescribes it. One program is
  active at a time, held in local storage rather than in the repo, because it is user state.
- Test gates run through `.claude/workflow/bin/vitest-gate.sh`, which maps vitest's results onto
  pytest's exit codes (0 passed, 1 a real failure, 2 nothing ran).

## Alternatives rejected
- **Native Swift/SwiftUI**: needs macOS and Xcode. Not buildable on the only machine available.
- **Expo / React Native**: a standalone installable build needs an Apple Developer account at
  $99/yr and EAS cloud builds, and the free TestFlight path expires every 90 days — heavy
  machinery for a single-user app that a web app serves fully.
- **Cloud sync (Supabase or similar)**: would survive a lost phone, but adds auth, network
  failure paths and offline conflict resolution — the largest source of bugs in an app that is
  otherwise entirely offline. Export/import covers the actual risk.
- **An in-app program editor**: the program did not change once between January and March. A
  full CRUD surface with migration of logged sessions roughly doubles the first release to serve
  an edit made a few times a year.
- **Self-contained program files** (each program defining its own exercises): simpler to author
  and impossible to leave a dangling reference in, but every new program would restart that
  exercise's history and the dials would lose their preset on the first day of each block —
  defeating the reason the app exists.
- **Importing the Excel history**: a tolerant parser for a hand-written format with about six
  malformed cells, run exactly once, then dead code. The app starts empty instead.
- **Calling `npx vitest run` directly in the gates**: vitest exits 1 both when a test fails and
  when a test file fails to import, so a red commit could be certified without any assertion
  running.

## Consequences
- Deployment is a static build; a change reaches the phone in seconds with no review queue and
  no cost.
- No HealthKit, no reliable background notifications. The rest timer is therefore derived from
  the logged-set timestamp and alerts only in the foreground; it is always correct when looked
  at, but it cannot beep through a locked screen.
- iOS can evict IndexedDB for a web app. Until the export/import work lands (E2), a cleared
  Safari data store or a device restore loses the log with no recovery. This ordering is
  deliberate: E2 precedes the statistics work.
- Adding or swapping a program is a new JSON file plus a deploy, not a migration — but it does
  require someone with the repo, not just the phone.
- The split introduces a failure a single file could not have: a program referencing an exercise
  id nobody defined. Both files are validated at startup and a dangling id is a hard error
  naming the program and the id, not a blank row discovered mid-session.
- A shared id can lie — `machine-row` at another gym is a different machine, and no code can
  detect that. The remedy is a new catalog id when the lift genuinely differs; it is a
  judgement call, not something the schema enforces.
- Node 18 pins the toolchain. If Vite 5 / Vitest 2 prove awkward, the fix is upgrading Node to
  20, not changing the stack.

## Outcome

E1 "Log a workout" landed on `epic/E1-log-a-workout` across nine tasks in five waves, ending
at `7cf025b` with 150 tests passing, `tsc --noEmit` clean and `eslint` reporting one warning
and no errors. All 20 spec outcomes are covered, each by at least one test written before the
code that satisfies it. The branch is not pushed and no PR exists: this repo has no `origin`,
and `.claude/workflow/config.md` skips both.

What was built, as decided above: the React 18 + TypeScript + Vite 5 + Vitest 2 project;
`src/data/exercises.json` as the 14-exercise catalog and two programs under
`src/data/programs/` referencing it by id; a Dexie `sessions` store whose writes are
whole-document puts; pure domain modules for the weight ladder, entry validation, rest and set
prefill; and a UI of program picker, exercise list, set screen, settings and history list.

Where it departed from the decision above, and why:

- **The gate was broken before the first task could pass it.** `vitest-gate.sh` matched its
  patterns against vitest's raw output, but vitest colours its summary on Windows regardless of
  whether the output is a TTY, so the anchored `^[[:space:]]*Tests[[:space:]]+.*failed` pattern
  never matched. Every genuine red would have been reported as exit 2, "nothing ran" — the one
  result the red gate treats as a failure. The gate now matches on an escape-stripped copy and
  still prints the original. The claim in `config.md` that it had been "verified against all
  four cases" was made through a stubbed runner, which emits no colour; it has now been
  re-verified against a real vitest 2.1.2 for all four (no files matched → 2, import failure →
  2, genuine failure → 1, passing → 0).
- **The whole epic's dependencies were installed by the scaffolding task**, including `dexie`
  and `fake-indexeddb`, which it does not itself use. `verify-red.sh` runs `npm ci` in a
  throwaway worktree at each task's red commit, and no later ticket owned `package.json`, so a
  task that first needed a dependency could never have proven red.
- **`getLastEntriesFor` scans at most 200 finished sessions**, newest-first, and stops at the
  first containing the exercise. The decision above says history follows the exercise across
  programs but sets no bound; this one keeps a cold start from walking an unbounded log.
- **`startOrResumeSession` returns the in-progress session even when a different program or
  workout is asked for.** The "at most one unfinished session" invariant is what lets four
  later tasks share the store without coordinating; the app routes an active session straight
  to its exercise list, so the conflicting choice is close to unreachable.
- **`logSet` and `finishSession` reject on an unknown session id** rather than no-op'ing. A set
  that vanishes without a trace is the failure this app can least afford, and the
  storage-unavailable banner already establishes that the app says when it cannot save.
- **The active program defaults to the first program** when nothing is stored, which is
  `assaf-ab-2026`; a stored id naming a program that no longer exists falls back to the first
  and says so on screen.
- **The dials' scroll-snap behaviour is not covered by the suite.** jsdom has no layout,
  scrolling or snap physics, so the column is asserted as markup and the values are driven
  through the minus/plus buttons and the keypad. Snapping, momentum and scroll-changes-value
  remain unverified until someone logs a session on the phone — which is what the spec's
  acceptance step was already for.
- **The catalog's `infoUrl`s were authored as literals and are never fetched**, by the app or
  the tests. Four of them are the site's search URL where no specific page could be confirmed.
  A gate that depended on the network would fail for reasons that have nothing to do with the
  code.

Consequences worth carrying into E2: iOS can still evict IndexedDB and there is no export yet,
so a cleared Safari store loses the log. `src/ui/HistoryList.tsx` exports both `summarise` and
`HistoryList`, which trips `react-refresh/only-export-components` as a warning; splitting the
pure function out would silence it.
