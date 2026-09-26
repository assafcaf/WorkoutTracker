# WorkoutTracker

One trainee's set logger for a fixed A/B program, installed to an iPhone home screen and used
in a gym with no signal. Local-first: no accounts, no server, no sync.

Every term below was found in the code by a scan, with the sense it already carries there. Use
these words in outcomes, test names and tickets; use the `_Avoid_` words in none of them.

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
A named set of workouts the trainee follows. One is active at a time, and that choice is user
state rather than something the repo decides.
_Avoid_: Routine, plan (that word is taken), split

**Workout**:
One session's worth of Plans — the A or the B of an A/B program. What you are about to do.
_Avoid_: Day, session (that word is taken), routine

**Session**:
One actual visit to the gym: a Workout being or having been performed, with the sets logged
against it. What you did.
_Avoid_: Log, entry, instance

**Set**:
One performed set — a weight and a rep count, recorded against a Session and referencing the
catalog Exercise rather than the Program's Plan.
See `docs/decisions/0002-pwa-local-first-workout-tracker.md`.
_Avoid_: Entry, rep log, record

**Ladder**:
The ordered list of weights an exercise can legally take, built from its start weight by its
own step size.
_Avoid_: Scale, range, increments

**Rung**:
One selectable position on a Ladder, and the unit a Dial snaps to.
_Avoid_: Stop, notch, tick, step

**Dial**:
The scroll-snap column the trainee sets a value with — one for reps, one for weight — with a
keypad fallback for a value that sits off the Rungs.
_Avoid_: Picker, spinner, wheel, slider

**Preset**:
The weight and reps a Set opens with, carried forward from the last finished Session or, when
there is none, from the Exercise's own defaults.
_Avoid_: Default, prefill, seed, suggestion

**Bodyweight**:
An Exercise carrying no weight at all, as opposed to one loaded with zero. Its weight is absent
rather than `0`.
_Avoid_: Unweighted, freeweight, no-load

**Shell**:
The frame around whatever screen is showing: the header, the tab bar, and the sticky action bar
a screen puts its own control into. Not the precached bundle — call that the **precache**.
See `docs/decisions/0004-one-palette-one-shell-audited-as-data.md`.
_Avoid_: Chrome, frame, layout, app shell

**Action bar**:
The Shell's sticky bottom slot. The Shell owns the space; the screen showing inside it owns
what goes there and when it is enabled.
_Avoid_: Footer, toolbar, CTA bar, bottom bar

**Token**:
One of the 49 custom properties that are the only place a colour, space, radius or type size is
defined. A closed set — adding a fiftieth is a decision, not a detail.
See `docs/decisions/0009-court-a-light-mellow-sport-design-language.md`.
_Avoid_: Variable, custom property, theme value

**Palette**:
The colour Tokens specifically. There is one, the light "Court" palette — ivory, court green,
clay and four muscle-family tints — and no dark mode to keep in step.
_Avoid_: Theme, colour scheme, skin
