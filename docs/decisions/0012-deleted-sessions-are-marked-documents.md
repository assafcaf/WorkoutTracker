# 0012. A deleted Session is a marked document, and every Session reader skips it

Date: 2026-09-30 · Status: accepted · Tracker: E12

## Context
A Set logged with the wrong values was permanent, a Session started by mistake couldn't be thrown
away, and a finished Session couldn't be corrected. Sync can only add or update documents
(`src/sync/protocol.ts`, `src/worker/sync.ts`), so a row removed on one device comes back from the
server. `finishStaleSession` already had that bug: it removed a stale empty Session locally.

## Decision
- **A deleted Session keeps its row with `deletedAt` set** (`Session.deletedAt?: number`,
  `discardSession(id, now)` in `src/storage/sessionStore.ts`, `SessionService.discard`). It syncs
  like any update, with no protocol or D1 change. A stale empty Session is marked the same way.
- **Every reader of Sessions filters through `isLive(session)`** (`src/storage/sessionStore.ts`):
  the active Session, History, Stats, records, Presets, last swap, the latest-Session lookup in
  `src/services/programs.ts`, and backup export. `sessionsChangedSince` and `allSessions` stay
  unfiltered so sync pushes deletions. Any new reader must filter too.
- **Deleting a Set renumbers that Exercise's later Sets** (`removeSet` / `insertSet` in
  `src/domain/setEdits.ts`), because `logSet` replaces by `(exerciseId, setIndex)`.
- **The History editor edits a draft and saves it in one write** (`saveSession`), with Save and
  Cancel, as the Program editor does. An added Set takes `loggedAt = finishedAt`.
- **"Last time" and the Preset read the same list** (`getLastEntriesFor`).

## Alternatives rejected
- A delete endpoint and a `deleted` table: a D1 migration and a protocol change for one flag.
- A local-only delete: the Session comes back from the server.
- Gaps in `setIndex` after a delete: the next logged Set would collide with or skip an index.
- Saving each History edit as it is made: no Cancel, and validation and sync per keystroke.

## Consequences
- Deleted Sessions stay in IndexedDB and D1 for good. There is no purge or trash.
- Last writer wins: if another device writes to a Session after it was discarded, it comes back.
  Accepted, as decision 0007 accepts it for Sessions.
- A reader that forgets `isLive` shows deleted workouts. The E12-T1 tests cover each reader that
  existed at the time.

## Outcome
Built in E12 (branch `epic/E12-fix-what-you-logged`), nine tasks:
- **T1:** `deletedAt`, `isLive` on every reader, and deletion synced.
- **T2:** the Set edit, delete and restore store and service.
- **T3:** this Session's Sets on the set screen, with edit, delete and a 5 s Undo.
- **T4:** the "Last time" line.
- **T5:** Discard workout on the exercise list.
- **T6:** the History session editor.
- **T7:** Delete workout in the editor.
- **T8:** swapped rows styled like any row, in clay, with an "instead of" line.
- **T9:** History as collapsible cards with Edit per Exercise.

Departures from the spec:
- **`SessionEditor` takes a required `workoutName` prop** that the ticket didn't list. The
  ticket's props gave no way to name the Workout, so `HistoryFeature` resolves it from
  Programs.
- **The O15 messages (`END_BEFORE_START`, `NO_SETS_LEFT`) live in `src/domain/setEdits.ts`**, so
  the store and the editor share them without the UI importing storage.
- **The new `SetScreen` props (`logged`, `onEditSet`, `onDeleteSet`, `onRestoreSet`) are
  optional**, so existing callers still typecheck.
- **Six existing tests were rewritten, titles kept**, on the operator's approval. Two
  exact-operations lists gained `discard`. Four E8-T6 tests now expect a stale empty Session to
  be marked, not removed.
