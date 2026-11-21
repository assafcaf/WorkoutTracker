# WorkoutTracker

One trainee's set logger, installed to an iPhone home screen and used in a gym with no signal.

Use these words, in the sense the code gives them, in outcomes, test names and tickets; use the
`_Avoid_` words in none of them.

## Language

**Exercise**:
A lift as the catalog defines it — its weight step, start weight, whether it is bodyweight, and
where to see it demonstrated. Independent of any program that prescribes it.
_Avoid_: Movement, lift, activity

**Custom Exercise**:
An Exercise the trainee created (synced `customExercises`, merged into the catalog).

**Plan**:
A program's prescription for one exercise: sets, rep range, rest and order. It points at an
Exercise; it does not contain one.
_Avoid_: ExerciseConfig, prescription, slot

**Program**:
A named set of workouts the trainee follows. One is active at a time.
_Avoid_: Routine, plan (that word is taken), split

**Workout**:
One session's worth of Plans — the A or the B of an A/B program. What you are about to do.
_Avoid_: Day, session (that word is taken), routine

**Session**:
One visit to the gym: a Workout performed, with the sets logged against it. What you did.
_Avoid_: Log, entry, instance

**Session note**:
Free text (up to 500 characters) on a Session (`Session.note`).

**Exercise note**:
Free text (up to 500 characters) on an Exercise, shown above the Dials.

**Set**:
One performed set — a weight and a rep count, recorded against a Session and referencing the
catalog Exercise, not the Plan.
See `docs/decisions/0002-pwa-local-first-workout-tracker.md`.
_Avoid_: Entry, rep log, record

**Set kind**:
How a Set was performed, stored as the Set's optional `kind`: `warmup`, `drop`, `failure` or
`amrap`. A normal (working) Set has no `kind`.

**AMRAP**:
A Set of kind `amrap`: the Plan's bottom rep count is a floor ("8+ reps").

**Warm-up**:
A Set of kind `warmup`: logged, ignored by records and progression (`countsTowardStats`).

**Rest**:
The time after a Set, from its `loggedAt` and `restSeconds` (else the Plan's); the **rest timer** shows it.

**Record**:
A **PR**: a new heaviest weight (less assistance, a first added load) or best estimated 1RM
against every earlier Session (`isRealRecord`, `src/domain/stats/records.ts`, decision 0024).
More reps at a known weight is a **rep best**, never a PR. Only a PR wears the gold `PrTag`.
The estimated 1RM is shown as "Est. strength".
_Avoid_: Best, high score

**Lift status**:
A lift's one verdict (`liftStatus`, `src/domain/stats/status.ts`), the same word on every screen:
**Moving** (going up), **Ready** (time to add load), **Flat** (no new best in 4 Sessions; written
"Flat since 7 Aug") and **Lowered** (lighter on purpose). Rarer: Too new, Break, Hold, Slipping.
Flat and Ready **need a decision**: Progress lists them first. The code kind for Flat is `stalled`.
_Avoid_: Stalled, stuck, plateau

**Ladder**:
The ordered weights an Exercise can take, built from its start weight by its step.
_Avoid_: Scale, range, increments

**Rung**:
One selectable position on a Ladder, and the unit a Dial snaps to.
_Avoid_: Stop, notch, tick, step

**Dial**:
The control that sets reps or weight; a keypad covers values off the Rungs.
_Avoid_: Picker, spinner, wheel, slider

**Preset**:
What a Set opens with: last time's Set at this position, shifted by today's change (a step up,
a deload, a Break's easing; `liftPlan`, decision 0025); else the Exercise's defaults (a Swap's:
the planned Exercise's).
_Avoid_: Default, prefill, seed, suggestion

**Swap**:
An Alternative standing in for a planned Exercise for one Session.

**Bodyweight**:
An Exercise logged with no weight (absent, not `0`), only an optional Load.

**Load**:
The signed weight on a Bodyweight Set, in kg: positive when added, negative when assisted.
Never `0`; absent on a plain Bodyweight Set and on loaded Sets.

**Region**:
A zone of the body map, shaded by how many sets reached it.

**Muscle family**:
Push, pull, legs or core: the group every muscle and Region belongs to, and its chip's tint.

**Weekly set range**:
The 10-20 Sets a week a muscle is planned to get; below it is `below`, above it `above`, both ends `within`. Set in `src/domain/setRange.ts`.
One verdict per muscle on every screen ("Calves · 8 sets/week · below 10–20"): a Program that plans
a low count does not make it "as planned".

**Shell**:
The frame around the screen showing: header, tab bar and Action bar. Not the **precache**.
_Avoid_: Chrome, frame, layout, app shell

**Action bar**:
The Shell's sticky bottom slot.
_Avoid_: Footer, toolbar, CTA bar, bottom bar

**Token**:
One of the 62 custom properties (a closed set, `src/styles/tokens.css`) that alone define a colour,
space, radius or type size.

**Palette**:
The colour Tokens by role, light only (Ledger & Instrument, `docs/design/competitors-2026-11/study.md`
§3): ink is text and action; colour only means something: `--color-live`, `--color-up`,
`--color-down`, `--color-pr` (records only), `--workout-a`/`-b` (calendar only).
_Avoid_: accent, Court

**Service**:
The only way the UI reads or writes the trainee's data or reaches sync. Each announces its writes on a
Change topic.
_Avoid_: Store, manager, controller

**Repository**:
A storage module: the only code that touches the device database.

**Screen group (feature)**:
One tab's container, reading and writing only through Services; in code, a `*Feature`.

**Change topic**:
Sessions, programs or preferences: what a write announces, so only the screens reading it
re-read.

**Effort**:
Reps left (RIR, 0 to 3+) on a logged Set, from chips when **Track effort** is on. Optional.

**Plate inventory**:
The bar weight and pairs of plates the trainee has; one synced setting.

**Plate line**:
The plates for one side of the bar, for the weight on the Dial.

**Warm-up ramp**:
The Warm-up Sets proposed before the first working Set of a barbell Exercise.

**Week start**:
The trainee's first weekday (`Date.getDay()` numbering, Monday when unset); every week goes
through `weekStart(ms, weekStartsOn)`.

**Contract version**:
`CONTRACT_VERSION` (`src/contract`), sent as `X-Contract-Version`; no header means 1.

**Deload**:
A lighter week: its loaded Sets open 10 % under last time (`deloadWeight`, in whole weight
steps); Bodyweight Exercises and start weights are left alone.

**Deload week**:
The stored week the trainee chose to deload; `isDeloadWeek` places it through `weekStart`.

**Rest push**:
The "Rest over" push sent at a rest's end.

**Reminder**:
A weekday-and-time push to train (synced `workoutReminders`).
