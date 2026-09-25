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
Built across E8-T1..T11 on `epic/E8-set-screen-fixes`, plus one fix found on the deployed head.
At the epic head, 70 test files and 1,038 tests pass (924 at the base), `tsc` is clean and
`eslint` reports no errors. `finishStaleSession` finishes or deletes a forgotten Session at
launch and on start. `weightSteps` and `volumeBaseline` are settings: backed up, synced as
E7 keys, and chosen on the set screen and in Settings. `src/domain/exerciseVolume.ts` computes
volume and the baseline, and `VolumeVsBaseline` replaces the row's progression bar. The set
screen also names its Dials and offers `Type weight` / `Type reps` (T2), offers
`Finish exercise` once every planned Set is logged (T4), and beeps three times when rest runs
out (T5, `src/ui/restSound.ts`). The app lands on the Workout tab when reopened outside a
workout (T7). `html` and `body` are no longer scroll containers (T1).

Where it departed from the decision above, and why:

- **The row follows sync, and returning to the app syncs.** On the deployed head a pulled
  workout showed in History while its row read `No previous workout`. The post-sync reload
  refreshed History only, and `useSync` never ran when the installed app came back from the
  background, which is a `visibilitychange`, not a mount. Now the reload also refreshes the
  rows' Sessions and `volumeBaseline`, and `useSync` syncs whenever the page becomes visible
  (`E8-sync-refresh`).
- **T6 moved existing fixtures' timestamps.** Tests that resumed a Session stamped at a fixed
  2023 time would now find it stale, so the red commit moved those stamps inside the 4 h
  window. No assertion changed.
- **Two stylesheet rules outside the ticket lists** (`.finish-exercise`, the Dial's step
  control). The control audit requires a rule for every control class.
- **The orchestrator merged T5, T8, T11 and the fix itself.** The epic merger lost git in the
  epic worktree twice, each time after a ticket owner's message resumed it inside that owner's
  isolated worktree. That's a harness defect, fixed upstream in PAD by relaying `READY`
  through the orchestrator.

Not verified here: the three iPhone outcomes, `Log set` in view without scrolling (T1 O2), the
beeps and the silent switch (T5 O11), and landing on Workout after switching apps (T7 O21).
In Chrome, in a 390×844 frame, `Log set` sat at the bottom (786–832 of 844) before and after
the page and both Dials were scrolled. That is the design: the page scrolls, and `clip`
instead of `hidden` lets the sticky action bar stick to the viewport rather than to `html`.
Chrome also counted three tones scheduled at 0:00. Neither is an iOS Safari result.
