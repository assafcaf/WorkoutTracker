# 0014. A Set says more through optional fields, and only warm-ups leave the stats

Date: 2026-10-01 · Status: accepted · Tracker: E14

## Context
Every Set counted alike, so warm-ups inflated volume and records and used up the Plan's Sets.
The trainee couldn't record how hard a Set was, or an added weight or assistance on a
Bodyweight Exercise, and relearned setup cues every Session. Roadmap R3; spec
`2026-09-30-say-more-about-a-set` (not committed).

## Decision
- **Fields, all optional, no `schemaVersion` bump.** `SetEntry` gains `kind?`
  (`'warmup' | 'drop' | 'failure' | 'amrap'`; Working is the absence of `kind`), `rir?`
  (`0–3`, 3 meaning 3+) and `loadKg?` (Bodyweight Sets only, signed, never 0). `Session` gains
  `note?`; `ExercisePlan` gains `amrapLast?`. Old records need no migration.
- **One rule for stats:** `countsTowardStats` / `workingSets` (`src/domain/setKind.ts`). Only
  `warmup` is excluded; `drop`, `failure` and `amrap` count. Records, e1RM series,
  progression, volume, baselines and muscle maps all filter through it.
- **Warm-ups don't use up the Plan.** The counter, list row, done state and
  `nextExerciseAfter` count working Sets; `setIndex` still numbers every Set. Presets match the
  Nth working Set of last time.
- **Kind** is picked on a segmented row under the Dials that resets to Working after each log.
  **Effort** chips show only after a log, behind a synced **Track effort** setting.
- **Load** is a Load Dial (−60 to +100) on Bodyweight Exercises only; Assisted pull-ups keeps
  its inverted `weightKg`. Load records (`heaviest-load`, `most-reps-at-load`) and `add-load`
  progression sit beside the Bodyweight rep record.
- **Notes:** an Exercise note is one synced setting, `exerciseNotes`, keyed by the id actually
  done; a Session note is a field on the Session. Both cap at 500 characters.
- **Set text** comes from one formatter, `formatSet` / `formatSetCompact` (`src/domain/setText.ts`).

## Alternatives rejected
- A kind chip that opens a menu: two taps. A sticky warm-up: a missed reset mislabels a
  working Set. Marking after the log: the kind drives the counter and AMRAP target first.
- Migrating Assisted pull-ups to a signed load: a field changes meaning, which needs a
  `schemaVersion` bump and a migration of local, synced and backed-up data.
- Storing Working as a value: every existing Set would need rewriting.

## Consequences
- Any new stat must filter through `workingSets`, or warm-ups leak back in.
- Anything comparing logged Sets to `plan.sets` must count working Sets, not `setIndex`.
- A backup from before R3 imports unchanged; a new one round-trips every field and both keys.

## Outcome
Built in E14 (run `E14`, 15 tasks, all done), stacked on E13's branch because E14 edits R2's
`nextExerciseAfter` and Next-set line. Departures from the spec:
- `formatSet` formats only the weight or load and the reps. The kind marker and `· RIR n`
  are their own spans on the set screen, not `formatSet` options (plan decision, to drop two
  task edges).
- E12's edit mode also edits `loadKg` on a logged Bodyweight Set (`updateSet` values), which
  no ticket owned; the orchestrator gave it to E14-T14.
- Warm-ups not firing E13's PR toast has no test of its own. It holds because `recordsSetBy`
  calls `recordsFor`, which filters warm-ups.
- "Undo swap" and the exercise list's next-Set opening still follow all Sets, warm-ups
  included (untested with warm-ups).
