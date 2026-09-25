# 0008. A forgotten Session finishes itself, and the set screen's step and volume baseline are the trainee's settings

Date: 2026-09-25 · Status: accepted · Tracker: E8

## Context
The first real workouts on the deployed app (E1–E6) showed three things. Presets looked broken,
because the trainee never pressed `Finish workout`: an unfinished Session never becomes
history, and the next visit silently resumed it. The catalog's fixed `weightStep` did not match
the gym's plates. And the bar on each exercise row (E4's progression bar, unlabelled) read as a
sets counter.

## Decision
- **Stale Session.** A Session in progress whose last activity (its latest `loggedAt`, or
  `startedAt` with no Sets) is at least `STALE_SESSION_MS` = 4 h old is finished at that last
  activity by `finishStaleSession(now)` in `src/storage/sessionStore.ts`, or deleted if it holds
  no Sets. It runs inside `startOrResumeSession` and at app launch, before the resume card is
  decided.
- **Step size.** A per-Exercise setting over the catalog's `weightStep`, stored as one
  `settings` row `weightSteps: Record<exerciseId, number>` with choices
  `WEIGHT_STEPS = [0.5, 1, 1.25, 2.5, 5, 10]`. The catalog is not edited. The set screen passes
  `{ ...exercise, weightStep }` to the Dial, so `buildLadder` and `stepWeight` are unchanged.
- **Row bar.** Each exercise row shows today's volume for the Exercise as a percentage of a
  baseline: `Volume vs <baseline>: n%`. Volume is Σ reps × kg for loaded lifts and Σ reps for
  Bodyweight and assisted ones, the same split as `volumeSeries`. The baseline is one setting,
  `volumeBaseline`: the last workout (the default), or the average or max of per-Session volume
  over the past 7, 30, 91 or 182 days, or since a chosen date. E4's progression bar leaves the
  row and stays in Stats.
- **Backups** carry both new settings as optional fields. A file without them imports with the
  defaults.

## Alternatives rejected
- Asking on the next start whether to finish a forgotten Session: a screen every time.
- Finishing at midnight: breaks a workout that crosses it.
- Editing the catalog's `weightStep`: the catalog is bundled and shared, and the plates are the
  gym's fact.
- Labelling the progression bar, or a sets bar: the trainee wanted volume against a chosen
  baseline.
- Calendar months for the periods: fixed day counts keep the boundary testable.

## Consequences
- Presets now work for a trainee who never presses `Finish workout`, at the cost of a Session
  resumed after more than 4 h idle becoming a new one.
- `weightSteps` and `volumeBaseline` are settings that E7's sync must carry. E8 lands after
  E7, so E8 adds them to E7's synced keys.
- The rest beep plays only with the app on screen and respects the silent switch. There is no
  background or lock-screen alert in this stack.

## Outcome
