# 0018. Custom Exercises and Session additions are synced data; the week starts on the trainee's day; the screen stays awake during rest

Date: 2026-10-18 · Status: accepted · Tracker: E19 · Extends: 0010, 0013

## Context
Roadmap R5 (`docs/roadmap/roadmap.md`) left three gaps from E9: an Exercise missing from the
library can't be created, a Session can't take an extra Exercise, and a mid-Session change has
to be re-entered in the Program editor. Search failed on typos and shorthand
(`.work/specs/2026-09-26-forgiving-search.md`). The operator added three issues on 2026-10-18:
the week should start on a chosen day (Saturday in Israel), **Finish exercise** should return to
the Session's exercise list, and the rest time should be visible without unlocking the phone.
The operator waived `/spec` and `/tickets` and delegated every decision; the scope was
`.work/specs/2026-10-18-own-exercises-and-flow.md`.

## Decision
- Custom Exercises are one synced setting, `customExercises`, merged with the bundled catalog
  the way `mergePrograms` merges Programs. A custom id can't take a bundled id; writes go through
  `CatalogService`, the only layer that can check that.
- Exercises added to a Session in progress are stored on the Session (`Session.added`), so a
  Session stays self-describing. At finish, the summary diffs the Session against its Workout
  (swaps, additions, extra Sets) and offers **Save changes to program**; changes only add or
  widen, never remove, and a bundled Program is saved as a user copy (0010).
- Search is one forgiving matcher, `matchesQuery` (`src/domain/search.ts`): typos by word length,
  any word order, prefixes, hyphen and plural folding, gym shorthand. The Exercises tab,
  Alternatives, the Program editor's picker and the Add-exercise picker all use it.
- The week starts on a synced weekday, `weekStart` (0–6, `Date.getDay()` numbering), default
  Monday, so nothing changes until the trainee picks a day. Every week boundary goes through one
  helper, `weekStart(ms, weekStartsOn)` in `src/domain/stats/weeks.ts`.
- **Finish exercise** returns to the Session's exercise list (reversing E13-T12; E8-T4 had it
  this way). **Up next** stays, naming the Exercise the list will mark current.
- A lock-screen widget or Live Activity is impossible for a PWA, and an alert on a locked phone
  needs Worker-scheduled push (R9). Instead the screen stays awake for the whole rest, Session-wide,
  through the Screen Wake Lock API (re-requested on `visibilitychange`), behind a synced
  **Keep screen on during rest** setting, default on. E1's Set-screen lock is unchanged.
- A second preset Program, Upper/Lower 4× a week, built from catalog Exercises (the catalog
  gained the lower-body lifts it needed, since bundled Programs may only use catalog ids).
- New setting keys are in backup export and import; the new fields are optional, so
  `schemaVersion` stays 1.

## Consequences
- The rest-over alert on a locked phone is still missing until R9; iOS honours Screen Wake Lock
  in an installed PWA only from 18.4.
- Week arithmetic has one entry point; a new weekly stat must take `weekStartsOn`.

## Outcome
Built as E19 (19 tickets, 18 merged on `epic/E19-own-exercises-and-flow`; tickets and evidence in
`.work/runs/E19/`). Departures from the scope:
- Two tickets were added for suite flakes that load exposed during the run (E19-T18 rest-readout
  tick, offline registration wait, waits after navigation; E19-T19 the whole-tree ESLint test's
  15 s timeout). They change test bodies only, titles kept.
- Ownership was widened by ruling where a ticket had to change existing lines in a shared file
  (catalog and program tests for the third bundled Program, the search consumers, the summary's
  week line); each is in the run brief's Rulings.
- E19-T17, the iPhone check that the screen stays awake during rest, waits for the operator on
  the deployed app after merge.
