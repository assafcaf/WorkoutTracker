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
- The training program is a versioned `src/data/program.json` in this repo, not editable from
  the phone. Logged sets reference stable exercise ids, so changing the program never
  invalidates recorded history.
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
- Swapping in a different program later is a JSON edit plus a deploy, not a migration — but it
  does require someone with the repo, not just the phone.
- Node 18 pins the toolchain. If Vite 5 / Vitest 2 prove awkward, the fix is upgrading Node to
  20, not changing the stack.

## Outcome
Added when the work lands.
