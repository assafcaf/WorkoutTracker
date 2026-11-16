# 0025. A Ready step up is the Preset, not an offer

Date: 2026-11-16 · Status: accepted · Tracker: UX iteration 7 (V7R-01)

## Context
Iteration 6 put the status advice ("Ready for 15 kg") on Train, Program and the Set screen, with a
"Use 15 kg" control. Iteration 7's Home and workout page then said "Curls up to 15 kg" and
"3×15 kg", while Start still opened curls at last time's 14 kg. One screen promised a load the
next screen did not give (V7R-01). The design study (`docs/design/competitors-2026-11/study.md`
§1.3) says that if the weight changes today, the Preset already holds it.

## Decision
- When a lift's status is **Ready**, today's Preset is the step up: last time's Sets raised by the
  step, reps reset to the bottom of the rep range. Home, the workout page, Program, the Set
  screen, All and the quick log read the same `liftPlan()` / `appliedStep` value.
- The Set screen says "Up from 14 kg" and offers "Back to 14 kg" for that Session.
- A lighter suggestion (Stalled's deload, Lowered, Break easing) is applied the same way only
  where it already was (Break, deload weeks); a plain "Deload once" stays an offer.
- No stored data changes: a Preset is computed, not stored (consistent with 0006 and 0020). The
  heavy-first-set carry forward (0020) still applies after the first logged Set.

## Consequences
- Every surface states the load Start will actually open with.
- A lifter who does not want the step taps "Back to 14 kg" once per Session.
