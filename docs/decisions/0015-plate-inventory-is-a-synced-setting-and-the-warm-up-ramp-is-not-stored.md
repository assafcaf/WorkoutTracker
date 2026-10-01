# 0015. The Plate inventory is one synced setting, and the Warm-up ramp and Warm-up rest are derived, not stored

Date: 2026-10-01 · Status: accepted · Tracker: E15

## Context
Roadmap R4, "Help at the rack". Loading a bar and working out warm-ups is arithmetic the
trainee does between Sets. The app already knows the weight on the Dial and which Exercises
use a barbell, and 0014 gave it a Warm-up Set kind. A Warm-up also rested as long as a working
Set.

## Decision
- **The weight on the Dial is the whole bar**, plates and bar together, as barbell Exercises
  are already logged. The Plate line subtracts the bar.
- **`platesFor` searches, it is not greedy** (`src/domain/plates.ts`). It works in whole grams,
  respects pair counts, and among equal sums prefers heavier plates. A weight the plates can't
  make shows the nearest lower weight; under the bar it answers `null`.
- **The Plate inventory is one synced setting**, `plateInventory`: a bar weight and pairs per
  plate. The default (20 kg bar, 25 to 1.25 kg, 10 pairs each) is never stored, so a later
  change to it reaches everyone who never edited theirs. A backup carries the key only when
  the row exists; `schemaVersion` stays 1.
- **One Plate line follows the weight Dial**, on Exercises whose library `equipment` is
  `barbell` only. It is not repeated in the `Next:` line.
- **The Warm-up ramp is not stored.** `warmupRamp` (`src/domain/warmup.ts`) proposes 50%, 70%
  and 85% for 5, 3 and 2 reps, rounded down to what the plates make, from 40 kg up. Its
  Warm-ups are ordinary `warmup` Sets logged one tap each; where a ramp stands is the count of
  Warm-ups already logged for the Exercise in the Session.
- **The Warm-up rest is derived.** `restLengthOf` (`src/domain/rest.ts`) answers the Set's own
  `restSeconds`, else `min(60, Plan rest)` for a Warm-up, else the Plan's rest. Only an
  adjusted rest is stored, as 0013 says.

## Alternatives rejected
- Greedy plate choice: with limited pairs it misses a weight the plates can make.
- Logging the whole ramp in one tap: the Sets would share one `loggedAt` and have no rest.
- A `ramp` field on the Session: a new field to sync, for something the logged Warm-ups say.
- Settings for the percentages, the reps, the 40 kg threshold or the 60 s: fixed in code.

## Consequences
- Every read of a Set's rest length must go through `restLengthOf`, or a Warm-up rests the
  Plan's full length again.
- A new synced setting needs its key in `src/sync/protocol.ts` and in the pinned operation list
  in `src/services/index.test.ts`, as well as `SETTING_KEYS`.
- Other bars (EZ, trap, Smith) are covered only by changing the bar weight.

## Outcome
Built in E15 (run `E15`, 7 tasks, all done). Departures from the spec:
- A Warm-up whose rest the trainee adjusted keeps that stored rest after its kind is changed to
  Working; only a Warm-up with no stored rest moves to the Plan's length (orchestrator ruling,
  from 0013).
- **Add plate** adds the new plate with 1 pair; the spec did not say.
- The ramp goes beyond the ticket in four places: opening a logged Set for edit ends a running
  ramp, the `Next:` line is hidden during a ramp, a step that would fall under the bar uses the
  bar alone, and a step at or above the working weight is dropped.
- `src/sync/protocol.ts` and `src/services/index.test.ts` changed though no ticket listed them:
  the synced key list and the pinned service operation list.
- `CONTEXT.md` was trimmed (wording only) at the start of the run, because it was over its
  1500-token ceiling on `main`.
