# 0006. Measure progress per exercise kind, against the heaviest weight of the last session, and only ever suggest

Date: 2026-09-24 · Status: accepted · Tracker: E4

## Context
The app logged every set but said nothing about whether a lift was moving. Two facts about the
trainee's data shape any answer: the sets ramp within a session (50/60/65/65), so there is no
single textbook working weight; and 4 of 14 exercises carry no meaningful load (bodyweight, or
assisted where less weight is progress).

## Decision
- **Working-weight rule.** Progression counts only the sets at the heaviest weight of the last
  session (the lowest, for an assisted lift). The target is those sets × the top of the rep
  range; a full bar suggests one `weightStep` more (or less assistance). Bodyweight lifts measure
  all reps against `sets × top of range` and suggest adding a set.
- **Three kinds, one place.** `bodyweight` and `invertProgress` on the catalog entry decide the
  shape of every answer in `src/domain/` (`progression`, `series`, `records`, `volume`), never at
  a call site. Assisted lifts chart their assistance on a reversed axis; nothing is negated.
- **Epley, fixed**: `weight × (1 + reps/30)`, unrounded.
- **Hand-drawn SVG** (`src/ui/charts/LineChart`, `BarChart`), no charting library.
- **Stats lives inside the History tab** behind a History | Stats switch; the tab bar is unchanged.
- **The app suggests and never edits.** No suggestion changes a stored value or a program file.

## Alternatives rejected
- Textbook double progression: never fires on ramped sessions.
- Top set only: one hard set would advance the weight after a collapsed session.
- Excluding bodyweight/assisted lifts from stats, or treating assistance as negative weight:
  the first hides push-ups, the second charts −27 kg.
- A charting library: bundle weight in an offline-first app, and jsdom-unfriendly internals.
- A fifth Stats tab: the operator ruled it belongs in History.

## Consequences
- One heavy top set makes itself the working weight and fills the bar fast. Known; the fix is
  requiring two sets at that weight, a one-line change in `workingWeight`.
- A deload or a cut-short session reads as no progress; nothing distinguishes it.
- `hyper-extension` has sat at 15/15/15, so it suggests an extra set from day one — by design.
- Charts say little until about a month of history exists; the empty Stats screen says so.

## Outcome
Built in E4 (PR: see the E4 draft PR against `main`), nine tasks: the progression, series,
volume and records modules; the History | Stats switch and empty state; the progression bar on
the in-session exercise list; the exercise view (picker, bar, line chart, records) and the volume
bar chart; and a device check on the iPhone, which the operator passed at `909c05c`.

Departures from the spec:
- The spec's single `src/domain/progress.ts` became four modules (`progression.ts`, `series.ts`,
  `records.ts`, `volume.ts`) so each could be built and tested as its own task.
- `recordsFor` takes the `ExercisePlan` too: "lowest assistance at target reps" needs the rep
  range. `volumeSeries` takes a `Resolve` and the programs, to follow mid-session swaps and name
  the workout.
- Volume counts assisted sets as reps, not kg, like bodyweight sets. History's own
  `totalVolumeKg` still counts assisted kg; aligning it was left for a separate ticket.
- No pointer tooltips on the charts: the tickets ruled them out, so the records list is the
  table view.
- `src/pwa/offline.test.ts`'s cached-launch tests got a 60s limit. Their 10s launch ran under
  vitest's 5s default and timed out whenever agents ran in parallel.
