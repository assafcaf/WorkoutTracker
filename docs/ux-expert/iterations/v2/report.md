# UX review: iteration 2 (2026-11-15, commit 7e59131)

Reviewer: Dana Reyes (`docs/ux-expert/persona.md`). Driven with `scripts/ux-review/shoot.mjs` (headless Edge, touch on) against the Vite dev server at 390 × 844 DPR 1, plus 320 × 568, 195 × 422 (200 % zoom of 390) and root font 200 %. Data: `scripts/render-states/stats-45.json` (clock pinned to Thu 15 Oct 2026) and a clean profile for first run. Measurements are CSS px, read from the DOM with `eval:`. Shots are in `shots/`.

## Summary
Iteration 1 made the set itself sound: the live Session opens on Now, Log set stays reachable during Rest, cells show their own Presets, the Dials say their values and Finish asks before it throws away 20 Sets. The set loop *inside one Exercise* is now a 1-tap loop I would ship.

The biggest design problem is everything around that loop. **Moving between Exercises is broken** (V2-01): after the last Set the Action bar loses its primary action, and "Finish exercise" drops the trainee on the All list, where the running Rest and the Dials vanish. That happens six times every Workout. Next, **Rest wastes its best moment** (V2-02): about 180 px of empty screen sits between a folded "Next" accordion and the timer, while the trainee is standing at the bar wondering what to load. Outside the Workout, the app has **one feature in five places** (muscle sets: Progress, Sessions, Program twice, the summary twice; V2-06) and **two screens whose first content is not their job**: Train opens on a progression chart instead of today's lifts (V2-05), and Sessions puts the Session list 1,300 px down (V2-07). The biggest execution risk is 200 % text: tokens scale now, but 66 fixed `px` line-heights make lines overprint on Train and the live header (V2-12).

**Keep:** the 1-tap Log set bar with its value in the label, Rest that stays in the Action bar, the Finish-workout Sheet ("20 sets not logged"), the carried-Preset line ("+12.5 kg: carried from set 1 (last 70)"), the PR toast with its sparkline, the Session detail's "Lift by lift" list (`shots/21-session-editor.png`), the LiveStrip ("Workout B · 00:04 · Rest 2:58 · Return") and the Progress verdict vocabulary (moving / stalled / slipping / ready).

## Design critique

### Whole app

**Navigation model.** Four tabs (Train · Progress · Sessions · Program) plus a gear on Train. The tabs are the right objects and the right number, and I would not re-cut them. What is wrong is what sits *inside* them: each tab carries a slice of the other tabs' jobs.

| Content | Where it lives today | Where it belongs |
|---|---|---|
| Muscle sets per week | Progress › Muscles; Sessions › "Muscle sets by week"; Program › "Muscles, planned per week"; Program › "This week" (planned vs done bodies); Summary › "Worked today" (two grids) | Progress › Muscles (done, with week ranges); Program keeps only "planned per week" (the impact of the Plan); Summary keeps one grid |
| Volume per Session charts | Sessions | Cut (each Session row already states its volume) |
| Progression readiness ("14 of 20 at 70 kg") | Train (7 bars) and Progress › Lift ("Next: 15 of 20 reps") | Progress › Lift; Train keeps one line per row |
| Week strip "2 of 3 this week" | Progress | Train (it is a reason to train today) |
| Active program | Settings and Program › Programs | Program › Programs only |
| Equipment (11 switches) | Settings, and Program › Exercises "My gym only" | Program › Exercises |
| Compare volume with | Settings (drives unlabelled bars on Now) | Cut |

The tab bar I'd ship is the same four tabs, with each tab holding one job:

```
[ Train ]        [ Progress ]           [ Sessions ]       [ Program ]
 today + Start    lifts, muscles, body   what I did, edit   the plan, exercises
```

The live Session is reachable in 1 tap from every tab through the LiveStrip (`shots/57-minimised-train.png`). Good. Settings behind the Train gear is acceptable for an iOS app with no profile, once Settings is cut to what is actually a setting (V2-09).

**First run and home.** First run is good: one card, two Programs, one primary ("Use A/B Split"), 3 taps to the first logged Set (Use → Start → Log set). Its footnote promises that "Sessions, lifts and muscle balance fill this page", which Train never does (V2-15). Every later launch opens on Train, where the Start button is visible (y 734) but the screen's body answers "how close am I to stepping up?" rather than "what do I lift today?" (V2-05).

**Visual hierarchy and density.** Two densities fight. The set loop is calm and big; the review screens are dense and repeat themselves. Progress cards say the same fact three times (name, sentence, number). Sessions stacks four data blocks before the list. Program stacks three muscle views under the plan. Settings is 12 sections, 46 controls, 2,530 px tall. The in-workout screens are over their element budget too: Now has 12 tap targets besides the Dials (budget 4), and Rest has 15.

**Pattern consistency.**
- **Muscle names:** two vocabularies. Program and the first summary grid say "Middle back / Quadriceps / Abdominals"; Progress, the second summary grid and the body map say "Mid back / Quads / Abs" (V2-13).
- **Muscle views:** five renderings of one number (bar list, heat matrix, body map, chip grid, planned/done body pair).
- **"Next" for a lift:** Train says "14 of 20 at 70 kg", Lift page says "Next: 15 of 20 reps at 62.5 kg", Summary says "Deadlift · 14 of 20 reps at 70 kg". It is the same idea in three phrasings.
- **Primary action:** the set loop has a 64 px accent bar everywhere *except* the Exercise transition, where it becomes two white 44 px buttons (V2-01).
- **Session read vs edit:** tapping a Session opens a good read view (the summary). Its pencil opens an editor scrolled 1,409 px down (V1-24).

**Core loop and motivation.** Plan → train → see progress → come back. *Plan* is solid (Program editor with impact). *Train* has a strong single-set loop, but it goes flat at three moments: between Sets (an empty Rest screen), between Exercises (no next step), and at the end (a summary with three equal buttons and a "down 77 %" line on a partial Session). *See progress* is honest but wordy. *Come back:* nothing on Train says "2 of 3 this week", which is the most honest reason to open the app on a training day. Fun comes from the moments where the app does the arithmetic for the trainee: what to load next, what would beat last time, what this Exercise added up to. Today the app has that data (Presets, Records, Plate line, the Lift-by-lift verdicts) but shows it either as arithmetic for the trainee to do ("e1RM 80.0 · record 90.0 · no PR at this load") or only after the Workout.

**Real-time, in-workout proposals.** Each one says what appears, when, where, and what it replaces. Each is a verdict below.

| # | What appears | When | Where on screen | Replaces | Verdict |
|---|---|---|---|---|---|
| R1 | **Get ready card:** `Set 2 · 70 kg × 7` (40 px), `Add 2.5 + … per side → 25` (plate *change* from the bar now loaded), `Last time 70 × 7` | Every Rest | The empty middle of the Rest screen, y≈330–560 | The folded "Next" accordion, the "Set 1 logged · …" line, the dead space | V2-02 |
| R2 | **PR target line:** `PR at 11 reps` / `PR at 62.5 kg × 10`, which turns into the existing `PR if logged` tag when the Dials reach it | Every Set, before logging | Under the reps Dial | "e1RM 80.0 · record 90.0 · no PR at this load" | V2-04 |
| R3 | **Exercise verdict:** `Deadlift done · stepped up to 70 kg · 1 PR` (same words as the summary's Lift by lift) | When the last Set of an Exercise is logged | The Get ready card's slot during that Rest | "All 3 sets logged" and the "Up next: …" line | V2-11 |
| R4 | **Next Exercise as the primary:** `Next: Assisted pull-ups` (64 px accent bar) | After the last Set of an Exercise | Action bar | "Finish exercise" + "Add set" (two 44 px white buttons) | V2-01 |
| R5 | **Live PR count:** `3/23 sets · 1 PR` | After a PR | Live header sub-line | Nothing (it appends to an existing line) | V2-11 |

I rejected three ideas: a streak (it brings loss aversion), a Rest "pep" message (decoration), and a session-pace ETA (it adds a number but removes no work).

### Per screen

#### First run (clean profile) · `shots/02-first-run.png`
- **One job:** pick a Program. It does exactly that.
- **In the moment:** a new trainee wants to see what the plans are and to get started.
- **Element count:** 1st screenful: 9 tap targets (sync, gear, 2 Program cards, Use, 4 tabs); 4 blocks (header, picker card, footnote, Action bar). Earns its place: all except the footnote (*cut*: it promises content Train never shows) and the gear's backup dot on an empty install (*cut*, V1-30).
- **How I'd design it:** as is, minus the footnote. Strong's empty home is worse.
- **Would I ship it?** Yes.

#### Train · `shots/01-train-seeded.png`
- **One job:** start today's Workout. Today it is "start today's Workout *and* review your progression toward the next weight step". Start must win.
- **In the moment:** 17:58, bag on the shoulder. The trainee wants to know which Workout, what's in it, at what weight, and then Start.
- **Element count (1st screenful):** 20 distinct elements, 8 tap targets, 3 blocks.
- Title + status line + sync + gear: *earns its place*.
- "Workout B next" heading: *merge* (Workout B is named three times: heading, dock line and Start).
- "~66 min · from your logged workouts": *merge* (the dock repeats "~66 min").
- "↑ 1 lift ready to step up…": *earns its place* (the one honest win to chase).
- Legend "Reps at the current weight against the next step │ = next step": *cut*.
- 7 readiness bars "14 of 20 at 70 kg": *move* to the Lift pages (they already say "Next: 15 of 20 reps"). Replace each with today's Preset.
- Dock (due line, Change, meta, Start): *earns its place*.
- **Cut / merge / move:** cut the legend and the bars. Merge the heading and the estimate into the dock. Move the week strip "2 of 3 this week" here from Progress.
- **How I'd design it:** Fitbod's "today" screen without the generator. The card is today's Workout as the trainee will lift it, with progression shown as one honest phrase per row, not a chart.
```
Train                               ☁  ⚙
Thu 15 Oct · saved on this phone
This week  M B · T · W A · [T] · F · S · S    2 of 3
─────────────────────────────────────────
Deadlift               3 × 70 kg · 8–10
Assisted pull-ups      4 × BW−19 · 5–8
Narrow-grip pull-down  3 × 46.25 kg
Machine row            4 × 75 kg
Face pull              3 × 25 kg
Hyper-extension        3 × BW+5
Seated biceps curls    3 × 15 kg   ↑ step up
─────────────────────────────────────────
Workout B · last Mon 12 Oct · ~66 min   Change
[        Start Workout B        ]   ← primary
```
- **Would I ship it?** No. The bars are clever but answer a review question on the start screen (V2-05).

#### Live Session, Now · `shots/50-now-deadlift.png`
- **One job:** log this Set.
- **In the moment:** at the bar, chalk on the hands. The trainee needs the weight, the reps and the button.
- **Element count (1st screenful):** 13 pieces of information (budget 6) and 12 tap targets besides the Dials and steppers (budget 4): Minimise, Finish, Now, All, ⋯, 6 up-next rows, Log set.
- Header and Now/All: *earns its place* (101 px).
- Exercise, set line, cells, Last time, Dials, Per side: *earns its place*.
- "e1RM 80.0 · record 90.0 · no PR at this load": *replace* with the PR target (V2-04).
- Up-next rows (6 × 56 px, each with an unlabelled volume bar): *cut* from Now. They duplicate All, and they push the Dials up out of the thumb zone (the weight Dial centre is at y 309).
- **Cut / merge / move:** cut UpNextRows from Now. Cut the volume bars (and the Compare volume setting that drives them).
- **How I'd design it:** Concept 2's single-set focus, with Concept 4's cells kept. Strong shows the whole table; Now should beat it by showing only this Set.
```
⌄ Workout B · 00:04 · 1/23 sets        Finish
[ Now | All ]
Deadlift · Set 2 of 3 · 8–10              ⋯
[1 ✓60×10] [2 70×7] [3 70×7]
Last time 70 × 7 · Mon 12 Oct
              (flexible space)
−      70 kg      +
Per side: 25
−       7 reps    +
PR at 9 reps
[      Log set 2 · 70 × 7      ]   ← primary
```
- **Would I ship it?** Almost. Cut the rows (V2-03).

#### Live Session, All · `shots/52-all-view.png`
- **One job:** see the whole Workout and log out of order.
- **In the moment:** supersets, or a missed Set.
- **Element count:** 6 Exercise blocks, 20+ cells, Log set. *Earns its place* as the overview. The upcoming cells' 1.63:1 dashed border is still there (V1-19).
- **Cut / merge / move:** nothing to cut. All must never be where the app *sends* the trainee automatically (V2-01).
- **Would I ship it?** Yes, as the second view.

#### Rest · `shots/51-rest.png`, `shots/70-320-rest.png`
- **One job:** recover and get the bar ready for the next Set.
- **In the moment:** breathing hard, loading plates, glancing at the phone from 1 m away.
- **Element count:** 15 tap targets (Minimise, Finish, Now, All, ⋯, 4 Effort chips, the Next accordion, the "Use 3:50" offer, −15 s, +15 s, Skip, Log set). The information shown: countdown, "of 3:00", "Use 3:50", the Next line and the cells. About 180 px of the screen (y≈390–570) is empty.
- Countdown and ±/Skip: *earns its place*.
- The Next accordion (one 14 px line with a chevron that unfolds the Dials): *replace* with the Get ready card.
- "Use 3:50 for Deadlift" as its own 56 px row: *merge* into the panel's "of 3:00" line.
- "Set 1 logged · 60 kg × 10": hidden visually, so *cut* it (the cell's check already says it).
- Effort chips: *earns its place*, but "RIR 0" (V1-14). At 320 × 568 the chips are clipped under the panel (V1-10).
- **How I'd design it:** the Rest timer as a standard sheet (principles §4.3) with the next Set as the hero above it. Rest-timer pattern articles and Hevy show the next Set during Rest; none of them shows the plate *change*, and that is how we beat them.
```
⌄ Workout B · 00:03 · 1/23 sets        Finish
Deadlift · Set 2 of 3                     ⋯
[1 ✓60×10] [2 70×7] [3 70×7]
Set 1 effort  [0] [1] [2] [3+]  reps left
┌ Get ready ─────────────────────────────┐
│ Set 2 · 70 kg × 7                 40px │
│ Add 5 per side → 25 per side           │
│ Last time 70 × 7 · PR at 8 reps        │
└──────────────────────── Change › ──────┘
2:59  of 3:00 · Use 3:50
[ −15 s ] [ +15 s ] [ Skip rest ]
[      Log set 2 · 70 × 7      ]   ← primary
```
- **Would I ship it?** No. The most useful 40 seconds of a Set are spent on a blank screen (V2-02).

#### Exercise transition (after the last Set) · `shots/56-next-exercise.png`, `shots/61-after-finish-exercise.png`
- **One job:** move on to the next Exercise.
- **In the moment:** done with the heavy lift, wanting the next one ready.
- **Element count:** the Action bar holds two white 173 × 44 buttons, "Finish exercise" and "Add set", with no primary. "Up next: Assisted pull-ups" is 12 px text above them. The Dials are still live on a finished Exercise. "Finish exercise" switches to **All**: the Rest countdown (2:59) disappears, and the Dials go with it.
- **How I'd design it:** Strong and Hevy simply scroll to the next Exercise. Here the Action bar's primary becomes `Next: Assisted pull-ups` and lands on Now for that Exercise, with the Rest still running. "Add set" becomes a quiet text button.
- **Would I ship it?** No (V2-01).

#### Session summary · `shots/60b-summary-full.png`, `shots/21-session-editor.png`
- **One job:** show what I achieved today.
- **In the moment:** sweaty, on the bench, 5 seconds of attention.
- **Element count:** 9 blocks: header, Lift by lift, Records, Next time, Worked today (two grids), a Deload session switch, an Apple Health setup block, "1,580 kg · down 77 % on Mon 12 Oct", and an Action bar with three equal buttons (Share, Send to Apple Health, Done).
- Lift by lift, Records, Next time: *earns its place*. This is the best writing in the app.
- Second muscle grid: *cut* (V1-25).
- Deload session switch: *move* to the Session editor.
- Apple Health setup block: *move* to Settings › Data.
- "down 77 %": *cut* on a partial Session. It compares 3 Sets with 23.
- Three equal buttons: *merge* into a Done primary plus one secondary "Share…" that also holds Apple Health.
- **How I'd design it:** Apple Fitness's summary: one hero win at the top ("Deadlift · heaviest set 72.5 × 10 · +2.5 kg"), then the lists.
```
Workout B · Thu 15 Oct · 66 min · 23 sets
Best today: Deadlift 72.5 × 10 · +2.5 kg  PR
LIFT BY LIFT …
RECORDS …
NEXT TIME …
Worked today (one grid)
[ Share… ]  [        Done        ]
```
- **Would I ship it?** With a full Session, nearly. The structure is right and the tail is clutter (V2-10).

#### Sessions (list) · `shots/20-sessions.png`, `shots/20b-sessions-full.png`
- **One job:** find a past Session and open it.
- **In the moment:** on the sofa, "what did I do on Monday?".
- **Element count (full scroll before the first row):** a 6 × 7 calendar of 32 px cells, a legend (3 items), "15 sessions", a 12 × 4 heat matrix with its legend, and 2 volume charts. The first Session row is at y≈1,300, below 1.5 screens.
- Calendar: *shrink*. A 6-week strip of week totals answers "am I consistent?" in one row.
- Matrix: *move* to Progress › Muscles.
- Volume charts: *cut*.
- List: *earns its place*. It is the job.
- **How I'd design it:** Hevy's history feed: the list first, grouped by week, with one consistency row at the top.
```
Sessions
6 weeks  3 · 3 · 3 · 1 · 3 · 2        15 sessions
THIS WEEK
Wed 14 Oct  Workout A   71 min · 24 sets · 4 PRs  ›
Mon 12 Oct  Workout B   66 min · 23 sets · 5 PRs  ›
LAST WEEK …
```
- **Would I ship it?** No (V2-07, which supersedes V1-23).

#### Session detail and editor · `shots/21-session-editor.png`, `shots/22-session-editor-open.png`
- **One job:** read a past Session; fix a wrong Set.
- **In the moment:** correcting a typo. The read view is good. The editor opens with its title 1,359 px above the viewport (V1-24).
- **Would I ship it?** The read view, yes. The editor, not until it opens at the top.

#### Progress (home) · `shots/10b-progress-full.png`, `shots/12-progress-moving.png`
- **One job:** answer "am I getting stronger?".
- **In the moment:** curious, unhurried.
- **Element count (1st screenful, review budget 7 blocks):** headline, 4 counters, a "stepped up" line, and 2½ verdict cards: 7 blocks. Across the full scroll: 4 verdict cards, Last week, the week strip, and rows for Muscles, "11 lifts moving", "All 14 lifts" and Body.
- Verdict cards: *earns its place*, but each says its fact three times. "Narrow-grip pull-down / ▼ Slipping", then the sentence "Narrow-grip pull-down: slipping, 46.25 kg × 9 on Mon 12 Oct, below 47.5 kg × 10 on Mon 28 Sep…", then "46.25 kg × 9 / Mon 12 Oct" again. That is about 240 px per card.
- "11 lifts moving" (it expands inline) and "All 14 lifts": *merge*.
- Week strip: *move* to Train.
- Last week: *earns its place*.
- **How I'd design it:** the Verdict Feed stays (it is the strongest idea in the app). Each card becomes 3 lines:
```
Narrow-grip pull-down            ▼ Slipping
46.25 × 9 · was 47.5 × 10 on 28 Sep   ⌇⌇⌇
Consider a lighter week           Why?
```
- **Would I ship it?** Yes, after the trim (V2-08).

#### Progress › Muscles · `shots/11-progress-muscles.png`
- **One job:** show whether each muscle got enough Sets.
- **Element count:** headline with body map, legend, a 2 weeks | This week segment, a caption, 12 bar rows and a footnote. *Earns its place.* This is the one muscle page the app should have. It absorbs Sessions' 4-week matrix as a third segment (V2-06).
- **Would I ship it?** Yes.

#### Progress › All lifts and Lift · `shots/13-progress-all-lifts.png`, `shots/15-lift-back-squat.png`
- **One job:** one lift's history. The 4-line hero ("62.5 kg × 8 / Latest top set / Warm-ups … not counted / Stepped up …") is good. The chart labels still collide: "No A session" sits over "Deload", and the caption sits over the 50 kg label (V1-31). The "4 weeks ago" button next to the range segment is unexplained.
- **Would I ship it?** Yes, after V1-31.

#### Progress › Body
Reached (`shots/14-progress-body.png`). It is a single "Log your bodyweight" task, which is fine as a sub-page.

#### Program · `shots/30-program-full.png`
- **One job:** see and change the plan.
- **In the moment:** planning on the sofa.
- **Element count (full scroll):** the Program | Exercises segment, Edit, Programs, name, the Deload week switch, Weekly sets planned, Workout A table, Workout B table, "Muscles, planned per week" (two bodies, a legend and a 12-row list), and "This week" (four bodies with a legend).
- Plan tables and the Deload switch: *earns its place*.
- "Muscles, planned per week": keep the list, *cut* the body pair (the list carries the words, and the Progress › Muscles page has the map).
- "This week" planned vs done: *move* to Progress › Muscles (it is "done", not "plan").
- **How I'd design it:** Strong's template view: the plan tables first, the planned muscle list last, and no "done" data.
- **Would I ship it?** Yes, minus the "This week" card (V2-06).

#### Program editor · `shots/31-program-edit.png`
- **One job:** change the plan safely. Cancel now confirms (V1-09). The grid is still 5 inputs per row at 22–48 px wide (V1-28). Rest and kg belong in the row's ⋯.
- **Would I ship it?** Not until the targets are fixed.

#### Program › Exercises · `shots/32-program-exercises.png`
- **One job:** browse and create Exercises. It already has a "My gym only" filter, which is why the 11 equipment switches belong here and not in Settings (V2-09).

#### Settings · `shots/40-settings-full.png`
- **One job:** change how the app behaves.
- **Element count:** 12 sections, 46 controls, 2,530 px.
- Active program: *cut* (it duplicates Program › Programs, `shots/33-program-programs.png`).
- Equipment: *move* to Exercises.
- Bar and plates: *earns its place*.
- Compare volume: *cut*.
- Effort, Week, Rest: *merge* into one "Workout" section.
- Notifications and Reminders: *merge*.
- Backup, Account and Your data: *merge* into "Data & sync", with a "Last backup" line.
- **How I'd design it:** iOS Settings grouping, with 4 sections.
```
WORKOUT        Track effort · Keep screen on · Week starts on · Bar and plates ›
REMINDERS      Notifications · days · time
DATA & SYNC    Not signed in · Sync now · Last backup: never · Export · Import ·
               Export sets (CSV) · Import from Strong or Hevy
```
- **Would I ship it?** No (V2-09).

## Top 5
| # | ID | Type | Sev | Value/effort | One-line issue |
|---|---|---|---|---|---|
| 1 | V2-01 | Design | 3 | High / S | After an Exercise's last Set there is no primary action, and "Finish exercise" drops to All, which hides the Rest and the Dials. |
| 2 | V2-03 | Design | 3 | High / S | Now carries 6 up-next rows (12 tap targets, budget 4) that duplicate All and push the Dials out of the thumb zone. |
| 3 | V2-12 | Execution | 3 | High / S | At 200 % text, 66 fixed `px` line-heights make lines overprint on Train, the live header and Now. |
| 4 | V2-02 | Design | 3 | High / M | Rest leaves about 180 px blank while the next Set and its plates hide in a folded accordion. |
| 5 | V2-05 | Design | 3 | High / M | Train's body is a progression chart; the trainee can't see today's weights before Start. |

## Re-check of prior verdicts
| ID | Type | Was | Now | Status | Evidence |
|---|---|---|---|---|---|
| V1-01 | Execution | 3 | 0 | fixed | `shots/50-now-deadlift.png`: Start opens Now with the weight Dial at y 277. *But* see V2-01: "Finish exercise" still switches to All. |
| V1-02 | Execution | 3 | 0 | fixed | `shots/50`: cells read 60×10, 70×7, 70×7. |
| V1-03 | Execution | 3 | 0 | fixed | `shots/51-rest.png`: "Log set 2 · 70 × 7" is in the Action bar during Rest. |
| V1-04 | Execution | 3 | 0 | fixed | DOM names: "Weight, 60 kg", "Reps, 10", "Log set 1 · 60 × 10". |
| V1-05 | Execution | 3 | 0 | fixed | `shots/55-pr-moment.png`: "+12.5 kg: carried from set 1 (last 70)". |
| V1-06 | Execution | 3 | 0 | fixed | `shots/59-finish-sheet.png`: "Finish workout? 20 sets not logged". |
| V1-07 | Execution | 3 | 0 | fixed | `shots/50`: "Per side: 20". Rest Next ends "Per side: 25". |
| V1-08 | Execution | 3 | 0 | fixed (its check) | Tokens are rem. Lines now overprint at 200 %: new V2-12 (`shots/72`, `73`). |
| V1-09 | Execution | 3 | 0 | fixed | Not re-shot. iteration 1 `after/32-program-edit.png` stands. |
| V1-10 | Execution | 2 | 2 | partly (carried) | `shots/70-320-rest.png`: at 320 × 568, Next (y 329–392) is under `.rest-clock`, and the Effort chips are clipped. V2-02 removes the cause. |
| V1-11 | Execution | 2 | 0 | fixed | `shots/51`: 2 time values plus the offer. |
| V1-12 | Execution | 2 | 2 | not fixed | `shots/73-warmup.png`: the bar says "Log set 1 · 30 × 5" for a Warm-up; after it, "Next: set 1 · 40 × 3 · last 60 × 10", a "1" cell for warm-up 2, and "Set 1 effort" chips. |
| V1-13 | Execution | 2 | 2 | not fixed | After Set type › AMRAP, the bar still reads "Log set 1 · 60 × 10". |
| V1-14 | Execution | 2 | 2 | not fixed | `shots/51`: the chip reads "RIR 0". Set kinds have no description (`shots/74-set-type.png`). |
| V1-15 | Execution | 2 | 2 | not fixed | Workout A › Back squat: "Belt from set 3" appears only in ⋯ › Notes; it is not on Now. |
| V1-16 | Design (moves a feature) | 2 | 2 | not fixed | `shots/53-tools-sheet.png`: Step and Bodyweight exercise are still in the sheet. |
| V1-17 | Execution | 2 | 2 | not fixed | `shots/76-after-swap.png`: "Deadlift with Bands", no snackbar, no Undo. |
| V1-18 | Execution | 2 | 0 | fixed | iteration 1 `after/13-keypad.png`. |
| V1-19 | Execution | 2 | 2 | partly (carried) | The All view's `.all-cell--future` border is rgb(202,202,211) dashed, 1.63:1. |
| V1-20 | Execution | 2 | 2 | not fixed | `shots/71-zoom200-set.png` (195 × 422): cell 3 is clipped, the title is cut to "Worko…", and the Dials sit under the Log set bar. |
| V1-21 | Execution | 2 | 0 | fixed | iteration 1 `after/52`. |
| V1-22 | Design (moves a feature) | 2 | 0 | fixed | `shots/01` has no Deload control; `shots/30` has the switch. |
| V1-23 | Design (moves a feature) | 2 | 2 | not fixed → superseded by V2-07 | `shots/20b`: the first row is at y≈1,300. |
| V1-24 | Execution | 2 | 2 | not fixed | `shots/22-session-editor-open.png`: scrollY 1,409, and the "Workout B" heading is at −1,359. |
| V1-25 | Execution | 2 | 2 | not fixed → folded into V2-06/V2-10 | `shots/60b`: two grids, two vocabularies. |
| V1-26 | Execution | 2 | 0 | fixed | `shots/11`: "3 · below 10", "21 · above 20". |
| V1-27 | Design (removes a column) | 2 | 0 | fixed | `shots/30`: Exercise, Sets × reps, Rest. |
| V1-28 | Design (moves fields) | 2 | 2 | not fixed | `shots/31`: the reps inputs are 22 × 40, Sets 36 × 40, the handle 16 × 44 and ⋯ 24 × 44. |
| V1-29 | Execution | 2 | 0 | fixed | `shots/20`: 32 px cells with A/B. |
| V1-30 | Execution | 2 | 2 | not fixed | `shots/02-first-run.png`: the gear dot shows on an empty install, and Settings has no "Last backup" line. |
| V1-31 | Execution | 1 | 1 | not fixed | `shots/15-lift-back-squat.png`: "No A session" overprints "Deload". |
| V1-32 | Execution | 1 | 1 | not fixed | `src/ui/SetScreen.css` `.rest-over[data-over='true'] { color: var(--color-danger) }`. |
| V1-33 | Execution | 1 | 0 | fixed | `shots/01`: the h1 is "Train". |

## What improved since last iteration
- The live Session opens on Now, with Dials, Plate line and last time (V1-01, `shots/50`).
- Logging during Rest takes 1 tap, and the Rest panel is down to two time values (V1-03, V1-11, `shots/51`).
- Upcoming cells show their own Presets, and the carried change explains itself (V1-02, V1-05).
- Finishing early is safe (V1-06, `shots/59`). Program Cancel confirms (V1-09).
- Muscles words: "below 10" and "above 20" (V1-26). The Sessions calendar carries letters (V1-29).
- The Deload switch lives in Program (V1-22).

## Verdicts

### Design verdicts

#### Live Session

### V2-01 · Sev 3 · Design · Live Session › the Exercise transition has no primary and lands on All
- **Type:** Design (S)
- **Location:** `src/ui/SetScreen.tsx` (done state, ~l.1130–1150, `onFinishExercise`, `upNext`); `src/features/workout/WorkoutFeature.tsx` l.1004 (`onFinishExercise={() => setView('list')}`)
- **Evidence:** `shots/56-next-exercise.png`, `shots/61-after-finish-exercise.png`. Start Workout B and log 3 Sets. The Action bar now holds "Finish exercise" and "Add set", both white (bg #FFF, ink text) at 173 × 44, with "Up next: Assisted pull-ups" in small text. Tapping Finish exercise switches to **All**. The 2:59 Rest countdown and the Dials disappear. To log the next Set takes Finish exercise → Now (or a cell): 2 taps, 6 times a Workout, and the trainee loses sight of the Rest.
- **Issue:** The one moment the trainee needs a clear next step, the screen offers two equal grey choices below the 56 px floor. The one it recommends hides the Rest. It also keeps live Dials on a finished Exercise. Strong and Hevy simply move to the next Exercise.
- **Recommendation (target design):**
    Deadlift · All 3 sets logged
    [1 ✓] [2 ✓] [3 ✓]
    (Rest panel as usual)
                              + Add set   (quiet text button)
    [      Next: Assisted pull-ups      ]  (primary, 64 px)
Removed: "Finish exercise", the separate "Up next:" line (merged into the primary's label) and the live Dials in the done state (the cells show what was logged). The primary opens **Now** on the next unfinished Exercise, keeps the Rest running, and shows that Exercise's Set 1 Preset.
- **Steps:** 1) Relabel the done-state primary "Next: <upNext>", style it as the Log set bar, and route `onFinishExercise` to Now on the next Exercise instead of `setView('list')` (S). 2) Make "Add set" a quiet text button and hide the Dials in the done state (S).
- **Acceptance check:** After Deadlift Set 3, the Action bar shows one accent button "Next: Assisted pull-ups", ≥ 56 px tall and full width. One tap shows "Assisted pull-ups · Set 1 of 4" on **Now** with the Rest countdown still visible. No button reads "Finish exercise".
- **Value/effort:** High / S · **Refs:** rubric 3.0 (primary-action clarity), 3.3; principles §2.3, §4.6; Strong/Hevy auto-advance

### V2-02 · Sev 3 · Design · Rest › a blank screen where the next Set should be
- **Type:** Design (M)
- **Location:** `src/ui/SetScreen.tsx` (rest state; the Next accordion), `src/ui/live/RestPanel.tsx`, `src/domain/plates.ts`
- **Evidence:** `shots/51-rest.png`. y≈390–570 is empty. The next Set is a single 14 px line with a chevron ("Next: set 2 · 70 × 7 · last 70 × 7 · Per side: 25"), and the "Use 3:50 for Deadlift" offer takes its own 56 px row. At 320 × 568 that line is hidden under the panel (`shots/70-320-rest.png`, V1-10). 15 tap targets.
- **Issue:** Rest is when the trainee loads the bar. They have to read a small line from 1 m and do the plate arithmetic themselves ("Per side: 25", while the bar holds 20 per side). Principles §2.5 asks that "what to lift next" read from a bench.
- **Recommendation (target design):**
    Deadlift · Set 2 of 3                      ⋯
    [1 ✓60×10] [2 70×7] [3 70×7]
    Set 1 effort  [0] [1] [2] [3+]
    ┌ Get ready ──────────────────────────────┐
    │ Set 2 · 70 kg × 7                 40 px │
    │ Add 5 per side → 25 per side            │
    │ Last time 70 × 7 · PR at 8 reps         │
    └──────────────────────────── Change › ───┘
    2:59  of 3:00 · Use 3:50
    [ −15 s ] [ +15 s ] [ Skip rest ]
    [       Log set 2 · 70 × 7       ]  (primary)
Removed: the accordion and its chevron ("Change ›" opens the Dials in place), the "Set 1 logged · …" line, and the separate "Use 3:50" row (it joins the "of 3:00" line). The plate *change* comes from the Plate line of the weight just logged against the next Preset. Data and rules are unchanged.
- **Steps:** 1) Replace the Next accordion with a static Get ready card: the weight × reps at `--text-xl` or larger, last time, and "Change ›" to unfold the Dials (M). 2) Add the plate-change line from `plates.ts` (S). 3) Move "Use 3:50" into the panel's "of 3:00" line (S).
- **Acceptance check:** During Rest at 390 × 844 and at 320 × 568, "70 kg × 7" is visible at ≥ 28 px with no tap, a line starting "Add" or "Remove" names the per-side plate change, `elementFromPoint` on that card hits the card (not `.rest-clock`), and no gap taller than 48 px sits between the cells and the countdown.
- **Value/effort:** High / M · **Refs:** rubric 3.6 (next-set guidance, cognitive load); principles §2.5, §4.3; Hevy rest view

### V2-03 · Sev 3 · Design · Now › the up-next list duplicates All and pushes the Dials up
- **Type:** Design (S)
- **Location:** `src/ui/live/UpNextRows.tsx`, `src/ui/live/Bullet.tsx`, `src/ui/SetScreen.tsx`
- **Evidence:** `shots/50-now-deadlift.png`. Tap targets besides the Dials: Minimise, Finish, Now, All, ⋯, 6 Exercise rows (358 × 56 at y 489–825) and Log set, 12 against a budget of 4. The weight Dial's centre is at y 309, in the top 40 % of the screen. The rows' volume bars carry no visible label.
- **Issue:** The rows answer "what's left?", which All already answers one tap away. They cost the Set screen its thumb-zone Dials, and they add six tappable targets next to Log set.
- **Recommendation (target design):** see the Now wireframe in the critique. The Dials sit in the lower half, just above the Action bar, with the PR target line (V2-04) under them.
Removed: UpNextRows and their bullet bars on Now (All keeps its list), and the "Compare volume with" setting that only drives those bars (V2-09).
- **Steps:** 1) Stop rendering UpNextRows on Now (S). 2) Push the Exercise header and cells to the top and the Dials to the bottom with a flexible spacer, so the reps Dial's bottom sits ≤ 24 px above the Action bar (S).
- **Acceptance check:** At 390 × 844 on Now, no Exercise row other than the current one is in the DOM. There are ≤ 6 tap targets besides the Dials and steppers. The weight Dial's centre is at y ≥ 420.
- **Value/effort:** High / S · **Refs:** rubric 3.0 (element budget), 3.3; principles §2.3, §2.5

### V2-04 · Sev 2 · Design · Now › the projection line asks for arithmetic; show the PR target instead
- **Type:** Design (S)
- **Location:** `src/ui/SetScreen.tsx` (`.set-projection`), `src/domain/prMoment.ts` / records
- **Evidence:** `shots/50-now-deadlift.png`: "e1RM 80.0 · record 90.0 · no PR at this load". `shots/54-pr-projection.png`: after +12.5 kg, "e1RM 96.7 · record 90.0 → PR if logged". At 200 % the line wraps into 3 lines (`shots/72-200pct-set.png`).
- **Issue:** Two estimates and a negative ("no PR at this load") on every Set. The trainee has to work out what *would* be a PR. This is the most motivating number in the app, and today it is shown as a calculation.
- **Recommendation (target design):** one line under the reps Dial. It reads `PR at 11 reps`, the smallest rep count at the Dial's weight that sets any Record (`recordsFor` decides, and the rules are unchanged). When the Dials already reach it, it shows the existing accent tag `PR if logged`. With no reachable Record within the Plan's rep range, it shows nothing. Removed: the e1RM figure, "record 90.0" and "no PR at this load" (the e1RM stays on the Lift page).
- **Steps:** 1) Compute the smallest PR-making reps at the current weight from the existing Record kinds (S). 2) Replace the line's text, keeping the tag (S).
- **Acceptance check:** On Deadlift Set 1 at 60 kg, the line under the Dials matches `^PR at \d+ reps$` or is absent. No text on Now contains "e1RM" or "no PR". After + on reps up to that number, the line reads "PR if logged".
- **Value/effort:** High / S · **Refs:** rubric 3.6 (cognitive load), 3.7 (competence feedback); Strong's PR moment

### V2-11 · Sev 2 · Design · Live Session › the Exercise ends with no verdict, and PRs aren't counted live
- **Type:** Design (S)
- **Location:** `src/ui/SetScreen.tsx` (done state), `src/ui/LiveHeader.tsx`; wording from `src/ui/SessionSummary.tsx` Lift by lift
- **Evidence:** `shots/56-next-exercise.png`: after Deadlift's last Set the screen says "All 3 sets logged" and nothing about how it went. `shots/55-pr-moment.png`: the header reads "1/23 sets" after a PR. The PR exists only in a 3 s toast and a cell tag.
- **Issue:** The app writes good verdicts ("Stepped up to 70 kg · +2.5 kg · record", `shots/21`) but only after the Workout. The moment of finishing a lift is the natural, honest reward, and it passes in silence.
- **Recommendation (target design):** during the Rest that follows an Exercise's last Set, the Get ready card (V2-02) shows the Exercise verdict first: `Deadlift done · stepped up to 70 kg · 1 PR`, then the next Exercise's Set 1. The header sub-line becomes `00:22 · 3/23 sets · 1 PR` once a PR exists. Removed: the "All 3 sets logged" subtitle (the verdict replaces it). It adds no motion and no badge.
- **Steps:** 1) Reuse the summary's per-Exercise verdict text in the done state (S). 2) Append "· n PR" to the header sub-line when n ≥ 1 (S).
- **Acceptance check:** After logging Deadlift's last Set, a line starting "Deadlift done ·" is visible with no tap, using the same verdict words the summary shows for Deadlift. After one PR, the header text contains "1 PR".
- **Value/effort:** Med / S · **Refs:** rubric 3.7 (summary names one true win, competence first); Apple Fitness workout summary

#### Train

### V2-05 · Sev 3 · Design · Train › the start screen shows progression bars, not today's Workout
- **Type:** Design (M)
- **Location:** `src/features/dashboard/DashboardView.tsx`, `src/features/dashboard/trainCard.ts`, `src/features/dashboard/DashboardScreen.css`; the week strip from `src/features/progress/Home.tsx`
- **Evidence:** `shots/01-train-seeded.png`. 20 elements on the first screenful. "Workout B" is named 3 times and "~66 min" twice. A legend explains 7 bars ("14 of 20 at 70 kg") whose meaning needs the legend. The weight shown is the *current step*, not what Set 1 will open at. No row says sets × reps.
- **Issue:** On every launch the trainee wants "what am I lifting today?". The screen answers "how many reps until each step-up", which the Lift page already answers ("Next: 15 of 20 reps at 62.5 kg", `shots/15`). Fitbod and Hevy open on today's Workout as it will be performed.
- **Recommendation (target design):** see the Train wireframe in the critique: the week strip "This week … 2 of 3" at the top, then one row per Plan reading `3 × 70 kg · 8–10` (the Set 1 Preset), with `↑ step up` on rows that are ready. The dock stays.
Removed: the legend, the 7 bars, the "Workout B next" heading and the "~66 min · from your logged workouts" line (both merged into the dock). Moved here: the week strip from Progress. The "1 lift ready to step up" line becomes the per-row marker.
- **Steps:** 1) Remove the card heading, the estimate line and the legend (S). 2) Replace each bar row with "sets × Preset weight · rep range" and the ready marker (M). 3) Move the week strip from Progress Home to the top of Train (S).
- **Acceptance check:** At 390 × 844 with seeded data, Train shows no legend and no progress bars. The Deadlift row reads "3 × 70 kg". "Workout B" appears at most twice (dock + Start). "2 of 3" is visible above the fold, and Start is fully visible with no scroll.
- **Value/effort:** High / M · **Refs:** rubric 3.0 (purpose, content priority); Fitbod today screen; Hevy routine start

#### Whole app / review screens

### V2-06 · Sev 2 · Design · IA › muscle sets live in five places with two vocabularies
- **Type:** Design (M)
- **Location:** `src/features/progress/MusclesPage.tsx`; `src/features/sessions/SessionsScreen.tsx` (MuscleWeeks); `src/ui/ProgramPage.tsx` ("Muscles, planned per week", "This week"); `src/ui/SessionSummary.tsx` ("Worked today")
- **Evidence:** `shots/11-progress-muscles.png`, `shots/20-sessions.png`, `shots/30-program-full.png`, `shots/60b-summary-full.png`. That is 7 renderings across 4 screens: bar list, 12 × 4 matrix, planned body pair with list, planned/done body quartet, two chip grids. Program says "Middle back / Quadriceps / Abdominals"; Progress says "Mid back / Quads / Abs".
- **Issue:** "Did my back get enough this week?" has five answers in four styles, and the trainee can't tell which one is canonical. Each copy costs a screen its focus.
- **Recommendation (target design):** one home, Progress › Muscles, with segments `This week | 2 weeks | 4 weeks` (the last absorbs the Sessions matrix as columns). Program keeps only the planned list (the Plan's impact, and the editor's "Impact on weekly volume"). The summary keeps one grid.
Removed: Sessions' "Muscle sets by week" card, Program's "This week" card and its planned body pair, and the summary's second grid (V1-25).
- **Steps:** 1) Remove the summary's second grid and use the CONTEXT names (S). 2) Remove Program's "This week" card (S). 3) Add a "4 weeks" segment to Progress › Muscles and remove the Sessions matrix (M).
- **Acceptance check:** A per-muscle set count appears on Progress › Muscles, on Program (planned) and on the summary (one grid) only. A text search for "Middle back", "Quadriceps" or "Abdominals" in rendered UI returns nothing.
- **Value/effort:** Med / M · **Refs:** rubric 3.0 (purpose per screen, visual consistency), 3.4 (duplicate features)

### V2-07 · Sev 2 · Design · Sessions › the list is the job and it starts 1,300 px down
- **Type:** Design (M), supersedes V1-23
- **Location:** `src/features/sessions/SessionsScreen.tsx`, `SessionsScreen.css`
- **Evidence:** `shots/20-sessions.png`, `shots/20b-sessions-full.png`. Above the first row: a 6 × 7 calendar, a legend, "15 sessions", a 12 × 4 matrix with its legend, and two volume charts. The first row ("Wed 14 Oct") is at y≈1,300.
- **Issue:** Opening last Monday's Session takes 2 scrolls before the first tap. Three of the four blocks above the list are progress analysis, which belongs to Progress.
- **Recommendation (target design):** see the Sessions wireframe in the critique: one consistency row (6 week totals and "15 sessions"), then the week-grouped list. Rows add "· n PRs" in place of "n records".
Removed: the volume charts (cut), the matrix (to Progress, V2-06), the legend and the 32 px calendar grid (the week totals replace it; the A/B letters are already on each row).
- **Steps:** 1) Move the list to the top under a one-row week strip (S). 2) Cut the volume charts (S). 3) Remove the matrix once V2-06 step 3 ships (S).
- **Acceptance check:** At 390 × 844, the first Session row is fully visible with no scroll, and at least 4 rows are on the first screenful.
- **Value/effort:** Med / M · **Refs:** rubric 3.0 (content priority); Hevy history feed

### V2-08 · Sev 2 · Design · Progress › each verdict card states its fact three times
- **Type:** Design (S)
- **Location:** `src/features/progress/Home.tsx`, `Home.css`
- **Evidence:** `shots/10b-progress-full.png`. The Narrow-grip pull-down card shows the name and status, then a sentence repeating name, status, value and date, then "46.25 kg × 9 / Mon 12 Oct" again: about 240 px per card. 4 cards fill 2.5 screens. "11 lifts moving" and "All 14 lifts" are two rows that both list lifts (`shots/12`).
- **Issue:** The verdict is fast to grasp, then slow to read. The reader of "am I getting stronger?" scrolls past repeats.
- **Recommendation (target design):** see the 3-line card in the critique (name and status; value against its comparison with the sparkline; action and Why?). The full sentence stays as the card's accessible description.
Removed: the visible sentence, the duplicated value and date block, and the "11 lifts moving" row (All lifts gets a status filter instead). The week strip moves to Train (V2-05).
- **Steps:** 1) Collapse each card to 3 lines (S). 2) Merge the two lift rows into "All 14 lifts" with a moving / stalled / slipping / ready filter (S).
- **Acceptance check:** At 390 × 844, each verdict card is ≤ 120 px tall and the lift name appears once per card. The first screenful shows ≥ 3 full cards, and Progress Home has exactly one row that opens a list of lifts.
- **Value/effort:** Med / S · **Refs:** rubric 3.3 (duplicated information)

### V2-09 · Sev 2 · Design · Settings › 12 sections, half of them belong elsewhere or nowhere
- **Type:** Design (M)
- **Location:** `src/ui/Settings.tsx`, `src/features/settings/SettingsFeature.tsx`, `src/features/settings/DataTransfer.tsx`; `src/ui/LibraryList.tsx` (Exercises)
- **Evidence:** `shots/40-settings-full.png`: 12 sections, 46 controls, 2,530 px. Active program duplicates Program › Programs (`shots/33-program-programs.png`). The 11 equipment switches duplicate the Exercises "My gym only" filter (`shots/32`). "Compare volume with" (7 options) only drives the unlabelled bars on Now (V2-03). Backup, Account and Your data are three sections for one job.
- **Issue:** The trainee looking for "backup" or "plates" has to scan 2.5 screens. Program-level choices live in two places, and the second place can drift.
- **Recommendation (target design):** see the Settings wireframe in the critique (Workout · Reminders · Data & sync).
Removed: Active program (Program › Programs owns it) and Compare volume (with V2-03). Moved: equipment to Program › Exercises, behind the "My gym only" chip as an "Edit my gym" Sheet. Merged: Effort, Week and Rest into "Workout"; Notifications and Reminders together; Backup, Account and Your data into "Data & sync", with "Last backup: <date> / Never" (V1-30).
- **Steps:** 1) Remove Active program from Settings (S). 2) Merge the sections into the 3 groups (S). 3) Move equipment to the Exercises segment (M). 4) Remove Compare volume after V2-03 (S).
- **Acceptance check:** Settings has ≤ 4 section headings and ≤ 26 controls, and contains no "Active program", "Compare volume" or equipment switch. Program › Exercises offers the equipment choice in ≤ 2 taps.
- **Value/effort:** Low / M · **Refs:** rubric 3.4 (duplicates, settings that should be defaults); Apple Settings grouping

### V2-10 · Sev 2 · Design · Session summary › three equal buttons and a tail of misplaced blocks
- **Type:** Design (S)
- **Location:** `src/ui/SessionSummary.tsx`, `SessionSummary.css`
- **Evidence:** `shots/60b-summary-full.png`, `shots/21-session-editor.png`. The Action bar has Share, Send to Apple Health and Done at equal weight. Below "Worked today" come a "Deload session" switch, a "Set up Apple Health" block and "1,580 kg · down 77 % on Mon 12 Oct" (a 3-Set Session against a full one).
- **Issue:** The summary's job is the achievement. Its end mixes a setting, a setup guide and a negative comparison, and the "done" moment has three choices. Apple Fitness ends on one Done.
- **Recommendation (target design):** see the summary wireframe in the critique: a hero line "Best today: <top Record or biggest step>" under the header, then Lift by lift, Records, Next time and one grid. Action bar: `Done` primary and `Share…` secondary (Apple Health inside it).
Removed: the Deload session switch (moves to the Session editor), the Apple Health setup block (moves to Settings › Data & sync), and the volume-vs-last line when fewer than all planned Sets were logged.
- **Steps:** 1) Fold Send to Apple Health into a Share… Sheet and make Done the only accent button (S). 2) Move the Deload switch and the Health setup block out (S). 3) Add the "Best today" line from the existing Records list (S).
- **Acceptance check:** The summary's Action bar has 2 buttons, one of them accent ("Done"). The summary contains no switch and no "Set up Apple Health". With 3 of 23 Sets logged, no "down … %" text shows.
- **Value/effort:** Med / S · **Refs:** rubric 3.7 (summary names one true win; no guilt); Apple Fitness summary

### Execution verdicts

#### 3.2 Accessibility

### V2-12 · Sev 3 · Execution · A11y › fixed px line-heights overprint at 200 % text
- **Location:** 66 `line-height: <n>px` rules across 16 stylesheets, including `src/features/dashboard/DashboardScreen.css`, `src/ui/LiveHeader.css`, `src/ui/SetScreen.css`, `src/ui/live/live.css`, `src/features/progress/Home.css`, `src/ui/PageHeader.css`
- **Evidence:** `shots/73-200pct-train.png` (root 200 %): the date line overprints the title, "~66 min…" overprints "Workout B next", and the legend lines overprint each other. `shots/72-200pct-set.png`: the live header's title overprints the timer line, and the first list row's name overprints its plan line.
- **Issue:** V1-08 made the text grow, but the line boxes didn't grow with it, so large-text users get overlapping, unreadable lines on the two screens they use most.
- **Recommendation:** Replace px line-heights with unitless values (1.2 for headings, 1.4 for body) or rem.
- **Acceptance check:** At root 200 % at 390 × 844, on Train and Now, no two text elements' bounding boxes intersect (DOM check), and `grep -r "line-height: *[0-9]*px" src` returns 0 matches outside the hero and display numerals.
- **Value/effort:** High / S · **Refs:** WCAG 1.4.4, 1.4.12

### V2-13 · Sev 2 · Execution · H4 › muscle names in two vocabularies
- **Location:** `src/ui/ProgramPage.tsx` (planned list), `src/ui/SessionSummary.tsx` (first grid), the label source for those lists
- **Evidence:** `shots/30-program-full.png` ("Middle back", "Quadriceps", "Abdominals") vs `shots/11-progress-muscles.png` ("Mid back", "Quads", "Abs").
- **Recommendation:** Use one label set everywhere (the Progress one, which fits the rows).
- **Acceptance check:** Rendered text on Program, Progress › Muscles and the summary contains no "Middle back", "Quadriceps" or "Abdominals".
- **Value/effort:** Low / S · **Refs:** H4

### V2-14 · Sev 2 · Execution · A11y › Swap list buttons all named "Do this instead"
- **Location:** `src/ui/AlternativesList.tsx`
- **Evidence:** `shots/75-swap-list.png`. The DOM has ≥ 3 buttons whose name is exactly "Do this instead".
- **Recommendation:** Name each one "Do <Alternative> instead" (visible text can stay short; use `aria-label`).
- **Acceptance check:** No two buttons in the Swap list share an accessible name, and each name contains its Exercise's name.
- **Value/effort:** Low / S · **Refs:** WCAG 2.4.6, 4.1.2

#### 3.5 Intuitiveness

### V2-15 · Sev 1 · Execution · Learnability › the first-run footnote promises content Train never shows
- **Location:** `src/ui/NoProgram.tsx` (or `src/features/dashboard/DashboardView.tsx`)
- **Evidence:** `shots/02-first-run.png`: "Sessions, lifts and muscle balance fill this page after your first workout." Train shows none of these (they are on Sessions and Progress).
- **Recommendation:** Cut the line. Use A/B Split is the only next step.
- **Acceptance check:** A fresh install's Train contains no text "fill this page".
- **Value/effort:** Low / S

15 verdicts, 11 Design (73 %), 4 Execution.

## Not checked
- DPR 3. Shots are DPR 1, and measurements are in CSS px.
- Backgrounding, landscape, Rest push, the Rest sound (`playRestOver` exists) and Reminders: not possible headless.
- Offline reload: dev mode has no service worker.
- Progress › Body was only opened, not exercised. Custom Exercise creation was not run.
- V1-09 and V1-18 were not re-shot; iteration 1's after-shots stand.
- **For the operator (domain rule, carried):** the Preset for later Sets still carries Set 1's change within a Session ("+12.5 kg: carried from set 1 (last 70)" opened Set 2 at 82.5 kg after one hard Set at 72.5). The line now explains it, but a one-off heavy single still raises every later Set. Worth a look at decision 0020.