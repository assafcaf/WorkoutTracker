# 0020. The next step reads Effort, "last time" skips deloads, and a deload is planned a week at a time

Date: 2026-10-18 · Status: accepted · Tracker: E21 · Extends: 0006 (0006 stays accepted)

## Context
Roadmap R6 (`docs/roadmap/roadmap.md`) found the next-weight suggestion blind to effort, a deload
read as "no progress", and no planned deload or planned-Sets range. E18 (decision 0017) had
already shipped the deload mark, the stall rule and the Muscles page. The operator waived
`/spec` and `/tickets` and delegated every decision; the scope was
`.work/specs/2026-10-18-smarter-progression.md`.

## Decision
- **Effort reading.** One rule, `effortSteps(sets)` in `src/domain/effortStep.ts`, applied to the
  Sets 0006 and R-N already count for a full bar: 2 steps when every Set has RIR >= 2, 0 (hold)
  when every Set has RIR 0, else 1. A mix, or any Set without `rir`, is today's one step; a
  single RIR 0 last Set does not hold the weight. A plain Bodyweight lift adds one set, never two,
  or holds.
- **Deload week.** A planned deload is a synced setting holding the start of a week; a Session
  started in that week is a deload. The summary's switch still marks or unmarks any single Session.
- **A deload is -10 % rounded by steps.** The deload weight is the weight minus the whole number
  of the Exercise's weight steps nearest 10 % of it (a tie takes the lighter), at least one step,
  so it stays on the Exercise's Ladder. Loaded Exercises only; Bodyweight keeps its Load.
- **"Last time" skips deloads** for Presets, the next step and the Program tab's kg column
  (unless only deloads hold the Exercise), so a deload never sets a suggestion back.
- **Planned range 10-20.** One default weekly Set range for every muscle, shown on the Program
  tab's planned Sets; per-muscle ranges wait until the default proves wrong.
- **E18's stall rule stands.** `Stalled` stays "no record in the last 4 non-deload Sessions"
  (R-V); this epic only adds a deload weight to its suggestion.
- **The Muscles page stands.** Calendar weeks and the 10-20 band as muted context, never
  pass/fail; labels go only on the Program tab's planned Sets.
- Suggestions never change stored data (0006); a Deload week changes only what the Dials open on.

## Consequences
- `progression` gains the suggestion kind `hold`, and `nextStep` gains `steps` and `hold`.
- The Set screen's **Last time** line names the last non-deload Session after a deload week.

## Outcome
Left for the end of the epic.
