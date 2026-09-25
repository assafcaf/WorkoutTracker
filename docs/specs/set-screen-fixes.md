# Set screen fixes from the first real workouts
Status: approved   ·   Tracker: E8

Order: after E7 (operator, 2026-09-25). Its development record is
`docs/decisions/0008-forgotten-sessions-finish-themselves-and-set-screen-settings.md`; it and this
spec's promoted copy `docs/specs/set-screen-fixes.md` are written but uncommitted, and are
committed on E8's epic branch. (E7's own record, numbered 0006 on its branch, becomes 0007.)

## Problem
The trainee used the deployed app in the gym. On the set screen, `Log set` needs a scroll, the
Dials have no titles, typing an exact weight is hidden, the step size is fixed, rest ends
silently, and a fully logged exercise has no way out. The exercise list's bar reads as a sets
counter but is an unlabelled progression measure. "Presets don't come from last workout" was a
Session never finished, which never became history and was silently resumed.

## Outcomes

### The Action bar is in reach
- [O1] Given `src/styles/base.css`, when the CSS audit reads the rules for `html` and `body`,
  then neither declares `overflow`, `overflow-x` or `overflow-y` as `hidden`, `auto` or
  `scroll` (the horizontal guard is `overflow-x: clip`), so neither becomes a scroll container
  that `.action-bar`'s `position: sticky` would stick to instead of the viewport. (level: unit)
- [O2] Given the merged epic installed on the trainee's iPhone, when Back squat's set screen is
  opened, then `Log set` is visible at the bottom of the screen without scrolling, and stays
  there while the Dials are scrolled past. (level: iphone)

### The Dials say what they are
- [O3] Given a loaded Exercise's set screen, when it renders, then the weight Dial is a group
  named "Weight (kg)" with that text visible above it, and the reps Dial a group named "Reps"
  with that text visible; for a Bodyweight Exercise the weight group is named "Weight".
  (level: integration)
- [O4] Given a loaded Exercise's set screen at 60 kg with a 2.5 kg step, when `Type weight` is
  pressed, 6, 3, OK are typed, and then `Log set` is pressed, then the stored Set's `weightKg`
  is 63 (a weight off the Ladder); and `Type reps` opens the reps keypad the same way. For a
  Bodyweight Exercise there is no `Type weight`. (level: integration)

### The step size is the trainee's
- [O5] Given `back-squat` (catalog `weightStep` 2.5) at 60 kg, when the set screen renders,
  then a `Step 2.5 kg` control is shown; when 5 is chosen from its options
  `0.5, 1, 1.25, 2.5, 5, 10`, then the control reads `Step 5 kg`, `Increase weight` goes from
  60 to 65, and the Ladder's Rungs are 5, 10, 15, …. A Bodyweight Exercise shows no step
  control. (level: integration)
- [O6] Given `setWeightStep('back-squat', 5)`, when `getWeightStep('back-squat')` and
  `getWeightStep('db-bench-press')` are read, then they are `5` and `null`; and when Back
  squat's set screen is next opened, it opens with `Step 5 kg`. (level: unit for the store,
  integration for the reopen)
- [O7] Given a stored step of 5 for `back-squat`, when a backup is exported, then its
  `settings.weightSteps` is `{"back-squat": 5}`; when a backup with that field is imported, the
  step is restored; and when a backup without the field (every file written before this epic)
  is imported, it imports as before and every Exercise uses its catalog step. (level: unit)

### A fully logged exercise has a way out
- [O8] Given a 3-set Plan with Sets 1–3 logged (E6's done state), when the set screen shows it,
  then the Action bar holds `Finish exercise` and `Add set`; when `Finish exercise` is pressed,
  then the Workout's exercise list is showing (header = the Workout's name). After an extra Set
  is added and logged, the done state again offers `Finish exercise`. (level: integration)

### Rest ends with a sound
- [O9] Given a Set just logged on a Plan with `restSeconds: 90`, when the clock passes 90 s
  with the set screen showing, then `playRestOver` is called exactly once — not before 90 s,
  and not again on later ticks. When a set screen opens with this Session's rest already over,
  it is not called at all. (level: integration)
- [O10] Given `src/ui/restSound.ts`, when `unlockRestSound()` runs (on every `Log set` press),
  then its `AudioContext` is created or resumed; when `playRestOver()` runs, three short tones
  are scheduled on it; and where `AudioContext` does not exist, both are silent no-ops that
  throw nothing. (level: unit)
- [O11] Given the installed app on the trainee's iPhone with the ring switch on ring, when a Set
  is logged and the app stays on screen until rest reaches 0:00, then three beeps sound; with
  the switch on silent, none do. (level: iphone)

### A forgotten Session finishes itself
- [O12] Given a Session in progress whose latest Set was logged at `t`, when
  `startOrResumeSession(programId, workoutId, now)` runs with `now >= t + 4 h`, then that
  Session is stored finished with `finishedAt = t`, and a new Session for the requested Workout
  is returned; with `now = t + 4 h − 1 ms` the old Session is resumed unchanged. (level: unit)
- [O13] Given a Session in progress with no Sets, started at `s`, when
  `startOrResumeSession` runs at `now >= s + 4 h`, then that Session is deleted rather than
  finished (history gains no empty Session), and a new one is returned. (level: unit)
- [O14] Given a stale Session (O12) holding Back squat 40×10, 50×10, 60×8, 60×8, when the app
  launches, then no resume card is shown; and when the Workout is started and Back squat's
  Set 2 is opened, it opens preset at 50 kg × 10. (level: integration)

### The row bar compares volume with a chosen baseline
- [O15] Given `exerciseVolume(exercise, entries)`, when it is computed for a loaded Exercise,
  then it is `{ amount: Σ reps × weightKg, unit: 'kg' }`; for a Bodyweight or `invertProgress`
  Exercise it is `{ amount: Σ reps, unit: 'reps' }`, the same split as `volumeSeries`.
  `volumePercent(today, baseline)` is `round(100 × today / baseline)`, and `null` when
  `baseline` is `null` or 0. (level: unit)
- [O16] Given Back squat last finished at 40×10, 50×10, 60×8, 60×8 (1,860 kg), and today 40×10
  and 50×10 logged (900 kg), when the Workout's exercise list renders, then Back squat's row
  shows the visible label `Volume vs last workout: 48%` and a `progressbar` with
  `aria-valuenow` 48. After today reaches 2,046 kg the label reads `110%` and the bar is full.
  (level: integration)
- [O17] Given an Exercise with no finished Session holding it inside the chosen period, when
  its row renders, then it shows `No previous workout` (with the default baseline) or
  `No workout in this period` (any other), and no `progressbar`; and no row shows E4's
  `Next: … kg` suggestion any more (Stats still does). (level: integration)
- [O18] Given finished Sessions holding Back squat at volumes 1,000 kg (100 days ago), 1,800 kg
  (20 days ago) and 1,500 kg (3 days ago), when `baselineVolume(exercise, sessions, baseline,
  now)` is computed, then `{ period: 'last' }` gives 1,500; `{ period: '1w', aggregate: 'avg' }`
  gives 1,500; `{ period: '1m', aggregate: 'avg' }` 1,650; `{ period: '1m', aggregate: 'max' }`
  1,800; `{ period: '6m', aggregate: 'avg' }` 1,433⅓; and `{ period: 'since', since: <date 50
  days ago>, aggregate: 'max' }` 1,800. Periods are 7, 30, 91 and 182 days back from `now`,
  inclusive. A Session in progress never counts, and no Session in the period gives `null`.
  (level: unit)
- [O19] Given no stored choice, when `getVolumeBaseline()` is read, then it is
  `{ period: 'last' }`; after `setVolumeBaseline({ period: '3m', aggregate: 'max' })` it reads
  that back. A backup's `settings.volumeBaseline` carries it, and a backup without the field
  imports with the default. (level: unit)
- [O20] Given the Settings tab, when "Compare volume with" is set to `Past 3 months` and "Using"
  to `Average`, then Back squat's row label reads `Volume vs 3-month average: <n>%`. The labels
  for the other choices are `vs last workout`, `vs week average` / `vs best this week`,
  `vs month average` / `vs best this month`, `vs 3-month average` / `vs 3-month best`,
  `vs 6-month average` / `vs 6-month best`, and `vs average since 1 Mar` /
  `vs best since 1 Mar`. With `Last workout` chosen, "Using" is not shown; choosing
  `Since a date` shows a date input. (level: integration)

## Non-goals
- Anything on the lock screen, or while the app is in the background: timing, sound, logging,
  notifications. iOS gives a home-screen web app no background execution or lock-screen
  controls. The screen wake lock (E1) is the mitigation.
- Vibration. iOS Safari has no `navigator.vibrate`.
- Playing through the silent switch (the trainee chose to respect it), and a sound on/off
  setting.
- A rest timer between exercises, or on the exercise list. Rest lives on the set screen.
- Jumping to the next exercise from `Finish exercise` (the trainee chose the list).
- Creating programs. That is E9, specced separately.
- Changing E4's progression rule or the Stats screen. The progression bar moves off the row
  and stays in Stats.

## Design

**Layout (O1, O2).** `src/styles/base.css`: `html` and `body` change `overflow-x: hidden` to
`overflow-x: clip`. The audit lives beside `src/styles/cssAudit.test.ts` and reads the rules
the way the existing audits do.

**Dials (O3–O5).** `WeightDial` and `RepsDial` each render a `role="group"` wrapper whose
visible heading names it (`Weight (kg)` / `Weight` / `Reps`), and a `Type weight` /
`Type reps` button that opens the existing `Keypad` (the readout still opens it too).
`WeightDial` gains `onStepChange?(step: number)`. When it is given and the Exercise is loaded,
it renders the `Step <n> kg` control, a native `<select>` over `WEIGHT_STEPS`. The Ladder and
`stepWeight` stay as they are. The caller passes `{ ...exercise, weightStep: effectiveStep }`,
so step, Ladder and Rungs all follow the chosen step with no change to `src/domain/dial.ts`
beyond `export const WEIGHT_STEPS = [0.5, 1, 1.25, 2.5, 5, 10]`.

**Step storage (O6, O7).** `src/storage/settingsStore.ts` adds `getWeightStep(exerciseId):
Promise<number | null>`, `setWeightStep(exerciseId, step): Promise<void>` and
`getWeightSteps(): Promise<Record<string, number>>`, stored as one `settings` row under
`WEIGHT_STEPS_KEY = 'weightSteps'`. `src/storage/backup.ts` adds an optional
`settings.weightSteps`. An absent field imports as `{}`, so older backups still import.
`App.handleOpenSet` reads `getWeightStep` alongside `getLastEntriesFor` and passes
`weightStep` and `onWeightStepChange` to `SetScreen`. `SetScreen` builds the effective
Exercise from them.

**Finish exercise (O8).** `SetScreen` gains `onFinishExercise?()`. In the done state the
Action bar holds `Finish exercise` (first, the primary) and `Add set`. `App` passes
`() => setView('list')`.

**Rest sound (O9–O11).** New `src/ui/restSound.ts` exports `unlockRestSound()` and
`playRestOver()`. It holds one lazily made `AudioContext`, and `playRestOver` schedules three
short oscillator tones. `SetScreen` calls `unlockRestSound()` in `log()` before anything else,
because the tap is the user gesture iOS requires. It fires `playRestOver()` once per rest
period: on the tick where `rest.isOver` turns true for a `lastLoggedAt` that was seen running
on this mount. Tests mock the module.

**Stale Session (O12–O14).** `src/storage/sessionStore.ts` adds
`STALE_SESSION_MS = 4 * 60 * 60 * 1000` and `finishStaleSession(now): Promise<void>`. It
takes the Session in progress, if any, and computes its last activity: the latest `loggedAt`,
or `startedAt` with no Sets. If `now − lastActivity >= STALE_SESSION_MS`, it finishes the
Session at that time, or deletes it when it has no Sets. `startOrResumeSession` calls it first,
inside its transaction. `App` calls it before its launch read of the Session in progress, so a
stale Session is never offered for resuming. Presets need no change: a finished Session is
exactly what `getLastEntriesFor` already reads.

**Row volume (O15–O20).** New `src/domain/exerciseVolume.ts` exports `exerciseVolume`,
`volumePercent`, `baselineVolume` and the type
`VolumeBaseline = { period: 'last' } | { period: '1w' | '1m' | '3m' | '6m'; aggregate: 'avg' | 'max' } | { period: 'since'; since: number; aggregate: 'avg' | 'max' }`.
It uses the loaded/other split `volumeSeries` uses. `baselineVolume` takes each finished
Session's volume for the Exercise, keeps those inside the period, and averages them or takes
the max. `settingsStore` adds `getVolumeBaseline` / `setVolumeBaseline` under
`VOLUME_BASELINE_KEY = 'volumeBaseline'`, and `backup.ts` gains an optional
`settings.volumeBaseline`. `App` already loads the finished Sessions (`listSessions`) for the
Program tab; it loads them and the baseline when the exercise list opens and passes both to
`ExerciseList`. That replaces the row's `<ProgressionBar>` with a new `<VolumeVsBaseline>`: a
visible label plus a `role="progressbar"` capped at full width, whose `aria-valuenow` holds the
uncapped percentage. `ProgressionBar` stays in use by Stats. `Settings` gains a "Compare volume
with" `<select>` (Last workout, Past week, Past month, Past 3 months, Past 6 months, Since a
date), a "Using" `<select>` (Average, Best) hidden for Last workout, and a date input for Since
a date.

**Errors.** A failed `setWeightStep` leaves the step as chosen for this screen and shows nothing
(the next open uses the stored one). `finishStaleSession` failing at launch falls through to the
existing "storage unavailable" handling.

## Decisions
- Auto-finish a Session after 4 h with no logged Set, backdated to its last Set — because the
  trainee forgets `Finish workout`, and an unfinished Session both hides its Sets from Presets
  and gets resumed as today's. Rejected: asking on the next start (a screen every time),
  finishing at midnight (breaks a late workout).
- An empty stale Session is deleted, not finished — because a finished empty Session would
  appear in History as a workout that never happened.
- The step is a per-Exercise setting over the catalog's `weightStep`, not an edit to the
  catalog — because the catalog is bundled data shared by every program, and the gym's plates
  are the trainee's fact.
- `overflow-x: clip` instead of `hidden` on `html`/`body` — because `hidden` makes `body` a
  scroll container that never scrolls, which is what pins the sticky Action bar to the end of
  the content. Rejected: `position: fixed` on the bar (needs a spacer the shell would have to
  keep in step with the bar's height).
- The row bar is today's volume as a percentage of a baseline the trainee picks in Settings (last
  workout by default, or the average or best over a period) — the trainee's choice, because the
  unlabelled progression bar read as a sets counter and meant nothing without history.
  Rejected: labelling the progression bar, a sets bar.
- One baseline setting for every Exercise, not per Exercise, and periods are fixed day counts
  (7/30/91/182), not calendar months — because the setting is a way of reading progress, not a
  fact about a lift, and fixed day counts make the boundary testable.
- Beep only while the app is on screen, respecting the silent switch — the trainee's choice.
- `Finish exercise` returns to the list — the trainee's choice. Rejected: open the next
  unfinished exercise.

## Risks and unknowns
- iOS suspends an `AudioContext` after backgrounding, so the first beep after a lock/unlock may
  be dropped. Mitigation: `unlockRestSound()` resumes it on every `Log set` tap. O11 on the
  phone is where this is found out.
- Whether iOS mutes Web Audio on the silent switch by default depends on the iOS version. O11
  checks both switch positions on the real phone. If it plays through silent, set
  `navigator.audioSession.type = 'ambient'` where it exists.
- `overflow-x: clip` needs Safari 16+. The trainee's phone runs the app installed today on a
  current iOS; O2 confirms it.
- E8 is built after E7 (operator, 2026-09-25). E7 syncs `activeProgramId` and `gymEquipment`
  only, so E8's tickets must add `weightSteps` and `volumeBaseline` to E7's `SyncedSettingKey`
  and sync payload, or those choices will not follow the trainee to a second device. `/tickets`
  reads E7's merged code for the exact names.
