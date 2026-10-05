# WorkoutTracker

One trainee's set logger, installed to an iPhone home screen and used in a gym with no signal.

Use these words, in the sense the code gives them, in outcomes, test names and tickets; use the
`_Avoid_` words in none of them.

## Language

**Exercise**:
A lift as the catalog defines it — its weight step, start weight, whether it is bodyweight, and
where to see it demonstrated. Independent of any program that prescribes it.
_Avoid_: Movement, lift, activity

**Plan**:
A program's prescription for one exercise: how many sets, the rep range, the rest between them,
and its place in the order. A Plan points at an Exercise; it does not contain one.
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
Free text of up to 500 characters the trainee attaches to a Session, in progress or finished (`Session.note`). Empty removes it.
_Avoid_: Comment, memo

**Exercise note**:
Free text of up to 500 characters kept for an Exercise, shown above the Dials. Empty removes it.
_Avoid_: Comment, memo, Session note

**Set**:
One performed set — a weight and a rep count, recorded against a Session and referencing the
catalog Exercise rather than the Program's Plan.
See `docs/decisions/0002-pwa-local-first-workout-tracker.md`.
_Avoid_: Entry, rep log, record

**Set kind**:
How a Set was performed, stored as the Set's optional `kind`: `warmup`, `drop`, `failure` or
`amrap`. A normal (working) Set has no `kind`.

**AMRAP**:
A Set taken to as many reps as possible: its kind is `amrap`, and the Plan's bottom rep count is
a floor, not a target, so the set counter reads "8+ reps". A Plan's `amrapLast` opens its last
planned Set on it.

**Warm-up**:
A Set of kind `warmup`. It is logged and shown, but does not count toward stats: records, the
e1RM series and progression ignore it (`countsTowardStats`).

**Rest**:
The time after a Set before the next, derived from the Set's `loggedAt` and its rest length (its own `restSeconds`, else the Plan's).

**Record**:
The best Set of one kind for an Exercise (heaviest, best estimated 1RM, and so on), as
`recordsFor` names it; shown as "PR" in the UI.
_Avoid_: Best, high score

**Ladder**:
The ordered weights an Exercise can take, built from its start weight by its step.
_Avoid_: Scale, range, increments

**Rung**:
One selectable position on a Ladder, and the unit a Dial snaps to.
_Avoid_: Stop, notch, tick, step

**Dial**:
The scroll-snap column the trainee sets reps or weight with; a keypad covers values off the Rungs.
_Avoid_: Picker, spinner, wheel, slider

**Preset**:
The weight and reps a Set opens with, carried forward from the last finished Session or, when
there is none, from the Exercise's own defaults.
_Avoid_: Default, prefill, seed, suggestion

**Bodyweight**:
An Exercise carrying no weight: its weight is absent, not `0`.
_Avoid_: Unweighted, freeweight, no-load

**Load**:
The signed weight on a Bodyweight Set, in kg: positive when added (a belt), negative when assisted
(a band or machine). Never `0`; absent on a plain Bodyweight Set and on loaded Sets.
_Avoid_: Offset, modifier

**Region**:
A zone of the body map, shaded by how many sets reached it. Each of the 17 muscles maps to at
least one.
_Avoid_: Area, zone, body part

**Muscle family**:
Push, pull, legs or core: the group every muscle and Region belongs to, and its chip's tint.
_Avoid_: Muscle group, category, colour group

**Shell**:
The frame around the screen showing: header, tab bar and Action bar. Not the precached bundle
(the **precache**). See `docs/decisions/0004-one-palette-one-shell-audited-as-data.md`.
_Avoid_: Chrome, frame, layout, app shell

**Action bar**:
The Shell's sticky bottom slot; the screen showing decides what goes in it.
_Avoid_: Footer, toolbar, CTA bar, bottom bar

**Token**:
One of the 49 custom properties that alone define a colour, space, radius or type size. A
closed set. See `docs/decisions/0009-court-a-light-mellow-sport-design-language.md`.
_Avoid_: Variable, custom property, theme value

**Palette**:
The colour Tokens: one light "Court" palette, no dark mode.
_Avoid_: Theme, colour scheme, skin

**Service**:
The only way the UI reads or writes the trainee's data or reaches sync. Each stamps its writes
and announces them on a Change topic. See `docs/decisions/0011-layered-client-services.md`.
_Avoid_: Store, manager, controller

**Repository**:
A storage module: the only code that touches the device database.
_Avoid_: DAO, data access layer, model

**Screen group (feature)**:
One tab's container, reading and writing only through Services; in code, a `*Feature`.
_Avoid_: Page, container, view

**Change topic**:
Sessions, programs or preferences: what a write announces, so only the screens reading it
re-read.
_Avoid_: Event, channel, subscription

**Effort**:
How many reps the trainee had left (RIR, 0 to 3+) on a logged Set, recorded from chips after the
log when **Track effort** is on in Settings. Optional, never blocks the next Set.
_Avoid_: Intensity, RPE

**Plate inventory**:
The bar weight and pairs of plates the trainee has; one synced setting.

**Plate line**:
The plates for one side of the bar, for the weight on the Dial.

**Warm-up ramp**:
The Warm-up Sets proposed before the first working Set of a barbell Exercise.
