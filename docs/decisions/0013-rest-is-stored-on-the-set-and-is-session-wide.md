# 0013. Rest is stored on the Set that starts it, and follows the Session's latest Set

Date: 2026-10-01 · Status: accepted · Tracker: E13

## Context
Between Sets the trainee couldn't skip, shorten, lengthen or set the rest. Rest was derived only
from the last Set's `loggedAt` and the Plan's `restSeconds`, so nothing could change it and
survive a reload. Finish exercise dropped back to the list. A new record showed only in Stats,
and the summary had no duration, volume or records.

## Decision
- **A changed rest is stored on the Set that starts it:** `SetEntry.restSeconds?: number`, written
  by `SessionService.setRest` in one write. `restAfter` / `adjustRest` in `src/domain/rest.ts`
  derive remaining and over time from timestamps. When a Set has no `restSeconds`, the Plan's
  rest applies. The field is optional, and `schemaVersion` is not bumped.
- **Rest is Session-wide.** It follows the Session's latest Set (`latestSet`, resolved through
  `plannedExerciseIdFor` for swaps), so opening or leading on to another Exercise keeps the clock.
- **Skip and ±15 s are one-off.** Only a length set directly on the rest Dial (15 s Rungs,
  0:15–10:00) offers "Use for <Exercise>", which writes the Plan through `programs.save`. Skip
  is silent, and the beep is for a rest that runs out.
- **A PR is what `recordsFor` changes** (`recordsSetBy` in `src/domain/records.ts`), and only
  when an earlier finished Session holds the Exercise. The badge and Stats therefore cannot
  disagree.
- **"Next unfinished Exercise" follows Plan order and wraps** (`nextExerciseAfter` in
  `src/domain/flow.ts`). A swap counts under its Plan.
- **Volume has one rule** (`sessionVolume` in `src/domain/volume.ts`), shared by the summary
  and Stats.

## Alternatives rejected
- A `rest` field on the Session: it keeps only the latest rest.
- Rest in screen state: it is lost on reload.
- Per-Exercise rest with a lead-on special case: opening an Exercise from the list is the same
  situation as leading on to it.
- Remembering every rest change silently: a one-off long rest would become the Plan.
- Badging the first Session of an Exercise: its first Set would be every record at once.

## Consequences
- Any new reader of rest goes through `restAfter` with the latest Set. Deleting the latest Set
  moves the rest to the new latest Set.
- The set screen shows two timers (Workout time and Rest remaining), so tests find a timer by
  its accessible name, never by bare `role="timer"`.

## Outcome
Built in E13, 12 tasks plus one review fix, on `epic/E13-rest-flow-and-finish`.

- **Rest:** rest math (T1), `setRest` (T5), and ±15 s / Skip with the beep at the adjusted zero
  (T8). The rest Dial and "Use for <Exercise>" (T9). The Log set button reads `Rest 1:24` /
  `Rest +0:42`, then `Logged ✓` for 1.5 s (T10). A `Next: set 3 · 80 kg × 8–10` line during
  rest (T11).
- **Flow:** "Up next" and Finish exercise lead on to the next unfinished Exercise (T12).
  Elapsed Workout time shows on the list and the set screen (T2).
- **Finish:** PR toast and badge (T3, T6). The summary shows duration, volume and PRs (T4, T7).
- **Departures from the spec:**
  - **Rest panel position.** From operator review, the rest panel (label, readout, ±15 s, Skip)
    was moved to the set screen's top-right corner (`fix-rest-corner`). The spec left it below
    the logged Sets.
  - **`programName` prop.** `SetScreen` gained a `programName` prop so "Saved to <Program>" can
    name the Program. The ticket gave no way to learn it.
- **Not verified on the host:**
  - **iPhone probe O17.** It covers the beep after ±15 s and not after Skip, readability at
    arm's length, and lead-on keeping the rest. The operator deferred it until the merge to
    `main`.
  - **PR wiring.** No test covers passing earlier Sessions from `WorkoutFeature` into the set
    screen for the PR badge, or the "Stats shows the same record" clause.
