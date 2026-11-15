# UX review: iteration 4 (2026-11-15, commit 4e03b15)

Reviewer: Dana Reyes (`docs/ux-expert/persona.md`). I drove the app with `scripts/ux-review/shoot.mjs` (headless Edge, touch on) against this worktree's Vite dev server at 127.0.0.1:5174: 390 × 844 at DPR 1, plus 320 × 568, 195 × 422 (200 % zoom of 390) and root font 200 %. Data: `scripts/render-states/stats-45.json` (clock pinned to Thu 15 Oct 2026), plus a clean profile for the first run. Measurements are in CSS px, read from the DOM with `eval:`. One timing check sampled the DOM every animation frame. Shots are in `shots/`.

This round's focus is the persona's §3.6 and §3.7: the help and the honest delight the app gives *while* you train.

## Summary
Iteration 3 turned the live Session into a working loop:
- The hand-over to the next Exercise happens by itself (`shots/56`).
- Rest is one dock row (`shots/51`).
- Warm-ups have their own `W n/N` cell (`shots/73`).
- The calendar is back on Sessions (`shots/20`).
- Train opens on "Workout B" (`shots/01`).

The set loop is now fast and calm. It is also **emotionally flat**, and that is the biggest design problem left. The app knows, after every Set, whether you beat last time. It says so in four different places, in four different voices, and mostly not when you're looking:
- a PR is a 3-second toast that covers Minimise and Finish (`shots/54`), then it is gone before you've caught your breath;
- a normal Set gets no comparison at all;
- the hand-over line says "more reps · 15 vs 14", which you have to work out yourself (`shots/56`);
- the summary says the same PR three times, then shows a grid of zeros (`shots/60b`).

The biggest execution risk is the same one as in iteration 3. At 200 % text, Rest hides the plate line behind the dock (`shots/76`).

**Keep:** the 1-tap Log set bar with its value; "Add 5 per side → 20 + 5"; the "PR if logged" tag on Now (`shots/53`); the header's "3/23 sets · 1 PR" running count; the auto hand-over; the Sessions calendar; the rest-end beep and the screen wake lock.

## Design critique

### Per screen: the live Session

#### Now · `shots/50-now-deadlift.png`, `shots/53-pr-target.png`, `shots/53b-now-with-note.png`
- **One job:** log this Set.
- **In the moment:** chalked hands, at the bar. The trainee wants three things: the weight, the reps, and "is this more than last time?".
- **Element count:** 8 pieces of information (header, timer line, Exercise, Set n/N, note, cells, Last time, Dials with Per side, PR tag). Tap targets besides the Dials: Minimise, Finish, Now, All, ⋯ and Log set, so 6 against a budget of 4 (V3-07 is still open).
  - "Last time 60 × 10 · Mon 12 Oct" at y 258: *move*. It sits 320 px above the Dials it is compared with. The trainee reads it, looks down, and compares the two in their head. That is arithmetic between Sets (§3.6).
  - "PR if logged" / "PR at 8 reps" under the reps Dial: *earns its place*. *Merge* "Last time" into it, so that one live line answers "vs last time" as the Dials move (V4-02).
  - Note "✎ Belt from set 3" under the subtitle: *earns its place* (V1-15 fixed).
  - ~300 px blank between the cells and the Dials: I accept it as the price of thumb-zone Dials. It is where an unanswered effort question goes after Rest runs out (V4-06).
- **How I'd design it:**
```
⌄ Workout B · 00:03 · 1/23 sets          [≡ All] [Finish]
Deadlift · Set 2 of 3 · target 8–10                  ⋯
✎ Belt from set 3
[1 ✓60×10] [2 70×8] [3 70×7]
                 (flexible space)
−        70 kg        +
Per side: 25
−         8 reps      +
Last time 70 × 7 · +1 rep · [PR if logged]     ← live, under the Dials
[        Log set 2 · 70 × 8        ]   ← primary
```
- **Would I ship it?** Yes, after V4-02.

#### Rest · `shots/51-rest.png`, `shots/54-pr-moment.png`, `shots/54b-pr-after-toast.png`, `shots/72-320-rest.png`, `shots/76-200pct-rest.png`
- **One job:** recover, and get the bar ready for the next Set.
- **In the moment:** breathing hard, 1 m from the phone, loading plates. The trainee wants to know two things: did that Set count for something, and what goes on the bar now.
- **Element count:** 14 tap targets (budget 4 + Dials; down from 16).
  - Get ready card: *earns its place*.
  - Dock: *earns its place*.
  - The effort row "Reps left on set 1 · 0 1 2 3+" floats alone at y 400. It has no Set value next to it, so "set 1" means nothing at a glance.
  - Above it is ~140 px of blank (y 255–395).
  - The PR toast slides over the header (y 12–100) for 3 s. It covers Minimise, Finish and the segment, and then it is gone. By the time the trainee has racked the bar and turned to the phone, the moment has passed. All that is left is a 16 px `PR` outline on cell 2 (`shots/54b`). Nothing says how a *non-PR* Set compared with last time.
  - *Merge* the effort row, the PR and the hand-over verdict into one "Just done" block above the dock. *Move* the Get ready card up under the cells (V4-01).
- **How I'd design it:** read high, tap low. The Get ready card is read, so it sits high, under the cells. That also keeps the plate line on screen at 200 %. The Just done block is tapped, so it sits on the dock in the thumb zone. The PR lives in that block for the whole Rest (Guided Session's PR banner inside the rest card), with Set Table's tag plus delta.
```
⌄ Workout B · 00:09 · 2/23 sets · 1 PR   [≡ All] [Finish]
Deadlift · Set 3 of 3 · target 8–10                  ⋯
[1 ✓60×10] [2 PR 70×8] [3 70×7]
┌ GET READY · SET 3 ──────────────────────────────┐
│ 70 kg × 7 · same plates: 25                     │
│ Last time 70 × 7 · PR at 9 reps         Change ›│
└─────────────────────────────────────────────────┘
                 (flexible space)
┌ SET 2 · 70 kg × 8 ──────────────────────────────┐
│ [PR] Rep record · +1 rep on Mon 12 Oct          │   ← stays all Rest
│ Reps left?   [0]  [1]  [2]  [3+]                │
└─────────────────────────────────────────────────┘
2:56 of 3:00          [−15 s] [+15 s] [Skip]
[        Log set 3 · 70 × 7        ]   ← primary
```
- **Would I ship it?** Not yet (V4-01).

#### Exercise hand-over · `shots/55-handover-flash.png`, `shots/56-next-exercise.png`
- **One job:** close Deadlift, set up Assisted pull-ups.
- **What works:** the hand-over now happens by itself, with Rest running and "Log set 1 · BW−19 × 6" ready. That is V3-01 done right.
- **What doesn't:**
  - "Reps left on set 3" sits under the *new* Exercise's name and cells, but it asks about Deadlift's last Set.
  - The verdict "Deadlift done · more reps · 15 vs 14 · 1 PR" makes the trainee decode two totals. Those are the reps at 70 kg, which nothing on screen says.
  - For one frame (~18 ms) the old done state paints "Go to Assisted pull-ups" before the hand-over (V4-07).
- **How I'd design it:** the Just done block from V4-01, headed by the Exercise it is about.
```
Assisted pull-ups · Set 1 of 4 · target 5–8          ⋯
[1 BW−19×6] [2 …] [3 …] [4 …]
┌ GET READY · SET 1 ─────── BW−19 × 6 · last time BW−19 × 6 ┐
                 (flexible space)
┌ DEADLIFT DONE · 1 PR ───────────────────────── Add set ┐
│ 60×10 · 70×8 PR · 70×7  ·  1 rep more than Mon 12 Oct  │
│ Set 3 reps left?   [0]  [1]  [2]  [3+]                 │
└────────────────────────────────────────────────────────┘
2:59 of 3:00          [−15 s] [+15 s] [Skip]
[     Log set 1 · BW−19 × 6     ]
```
- **Would I ship it?** Not yet (V4-01).

#### Rest ending · `shots/57-rest-ending.png`, `shots/57b-rest-over.png`
- At 0:00 the screen returns to Now by itself, and the beep fires (`src/ui/restSound.ts`). Good.
- Two things go wrong at that moment:
  - The effort question disappears unanswered. The chips simply vanish.
  - "Over rest · +0:12" shows in danger red (V1-32). Red there is guilt for resting, which §3.7 rules out.
- **How I'd design it:** Single-Set Focus's quiet "Rested 3:00", then "+0:12" in muted text. The unanswered "Reps left on set 1?" chips stay on Now, in the blank band above the Dials, until they are answered or the next Set is logged (V4-06).

#### Warm-ups · `shots/73-warmup.png`, `shots/73b-warmup-rest.png`, `shots/58-tools-sheet.png`
- V3-05 landed: one `W 1/3` cell, and the bar reads "Log warm-up 2 · 40 × 3".
- But "Warm-up 2 of 3" now appears three times: the subtitle, the ramp line "Warm-up 2 of 3 · 40 kg × 3" (which repeats the card) and the card caption.
- The card's "Last time 60 × 10" is the *working* Set's history, which reads as if 40 × 3 had a last time.
- What a trainee wants on a ramp is where it ends: "then 60 × 10" (V4-05).

#### All · `shots/59-all-view.png`, `shots/59b-reopen-finished.png`
- **One job:** see the whole Workout and log out of order. *Earns its place.*
- The upcoming cells' dashed border is still `rgb(202,202,211)` on the page grey, ≈1.5:1 (V1-19).
- A finished Exercise reopened from All shows a full Rest dock with "Go to Assisted pull-ups" and no Set line (V4-07).

#### Finish and summary · `shots/60a-finish-sheet.png`, `shots/60-summary.png`, `shots/60b-summary-full.png`
- **One job:** show what I achieved today, and send me home wanting to come back.
- The Finish sheet ("18 sets not logged · Finish workout · Keep going") is right.
- **Element count on the summary:** header, the stat line, "Best today", Lift by lift, Records, Next time, Worked today (12 cells, 4 of them "0", plus a legend), the volume line, and the dock.
  - **The one PR is said three times:** "Best today Deadlift 70 kg × 8 · +1 reps PR", "More reps · 15 vs 14 · record", and "Records · Rep record · Deadlift · 70 kg × 8 · +1 reps". "+1 reps" is also a grammar slip that the toast gets right ("+1 rep").
  - **Next time:** "Deadlift · 15 of 20 reps at 70 kg" is arithmetic. It reads as a shortfall.
  - **Missing:** how today compares with the last Workout B, and what comes next this week. Those two lines are the "come back" half of the loop (Guided Session's "Volume up 4.6% on last Friday" and "Next: Workout B, Thursday").
- **How I'd design it:** see V4-03.
- **Would I ship it?** Not yet (V4-03).

### Per screen: everything else

- **First run** (`shots/02-first-run.png`):
  - One card, two Programs, and "Use A/B Split". 3 taps to a logged Set.
  - Ship it.
- **Train** (`shots/01-train-seeded.png`):
  - "Workout B / Thu 15 Oct · last done Mon 12 Oct", the A/B week strip, 7 rows with Presets, "↑ step up · try 15 kg", and "~66 min · Change" over Start. 4 blocks and 4 targets.
  - This is the landing view the operator asked for. The rows' step-up hint is the right amount of honest anticipation.
  - Ship it.
- **Sessions** (`shots/20-sessions.png`):
  - The calendar is back, compact (one card, no legend), with 5 rows below it. The operator's ask is met.
  - Every row still carries an accent "n PRs" pill (4–6 per Session). With every row lit, the pill carries no signal. That's minor. I'd make it plain text in the meta line, but it is not a verdict this round.
  - Ship it.
- **Progress** (`shots/10-progress.png`, `shots/15-lift-deadlift.png`):
  - One lead line, 4 verdict cards, Last week, then Muscles. Calm, and it answers "am I getting stronger?" in under 10 s.
  - The lift page's chart still overprints: "57.5 kg" sits on the caption "reps at that weight · tick is the target" (V1-31).
  - Ship the home; fix the chart.
- **Program** (`shots/30-program.png`, `shots/31-program-edit.png`):
  - Program reads well. But "Deload week" is a switch in second place, above the plan, for an action taken every 6–8 weeks. It also sits one stray tap from changing every Preset in the week (V4-08).
  - The editor's fields are unchanged: Sets 36 × 40, reps 22 × 40, handle 16 × 44, ⋯ 24 × 44 (V1-28).
- **Settings** (`shots/40-settings.png`, `shots/41-bar-plates.png`):
  - Three groups and 1,186 px. Good.
  - Bar and plates opens in place as a disclosure (9 rows). For a setting touched once, that is fine. It doesn't need its own page (see the re-check).

### Whole app
- **Navigation:** keep `[Train] [Progress] [Sessions] [Program]`, the gear on Train, and the LiveStrip on every tab. Inside the live Session, the Now | All segment is still a full 56 px band (V3-07). It's the last structural cut left on the live screens.
- **Density:** the live Session follows "one band per question" except on Rest. There, "how did it go" is split three ways: the toast, the floating effort row and the hand-over line. V4-01 gives it one band.
- **Pattern consistency:** the PR is shown in four styles: the toast with a sparkline, the 16 px outline tag on the cell, the "Best today" pill, and the Records row. The "vs last time" comparison is shown in three wordings: "same as last time · 60 × 10, …", "more reps · 15 vs 14", and the summary's "More reps · 15 vs 14 · record". There should be **one comparison sentence** (`src/domain/exerciseVerdict.ts`) used on Now, in Rest, at the hand-over and in the summary, and **one PR treatment**: tag plus delta, plus a description where there is room.
- **Core loop and motivation (the focus of this round):**
  - *Plan* is good (Train).
  - *See progress* is good (Progress, the Sessions calendar).
  - *Train* is efficient but mute. The trainee hears about progress only on a PR, and only for 3 s.
  - *Come back* is missing from the summary.

  Four small features fix this, each tied to one moment:

| Moment | What's missing | Feature (new / fix) | Verdict | Borrowed from |
|---|---|---|---|---|
| Dialling in a Set (Now) | "Am I beating last time?" means comparing a line 320 px away | **Live vs-last-time line** under the Dials (new) | V4-02 | Single-Set Focus "+2.5 kg vs last time"; Progress Dashboard projection line |
| Just after logging (Rest) | No verdict on a normal Set; the PR vanishes in 3 s; the effort row is unlabelled | **Just done block**: the Set, its comparison, the PR for the whole Rest, the effort chips (new + fix) | V4-01 | Guided Session PR banner in the rest card; Set Table tag + delta |
| The PR itself | Silent, and drawn as a toast over the header | **A felt beat**: 1.2 s accent-tint flash on the cell plus a short two-note tone; reduced motion → tag only (new) | V4-04 | Set Table row flash; Strong's PR moment; the existing rest beep |
| Finishing | The PR said 3 times, zeros, arithmetic, no "next" | **Summary payoff**: one win, one comparison with the last same Workout, this week's tally and what's next (fix + small new) | V4-03 | Guided Session summary |

  What I rejected for this round:
  - Haptics: there is no `navigator.vibrate` on iOS.
  - Streaks or badges: §3.7 rules them out.
  - Confetti or animation beyond the 1.2 s tint: the design language rules them out.
  - A "time left in Workout" estimate: it is useful, but it doesn't beat any of the four above for space.

**Concept scorecard (borrowed this round):**

| Concept | Borrowed for | Rejected |
|---|---|---|
| Guided Session | PR banner kept in the rest body for the whole Rest (V4-01); the summary's comparison line and "Next" line (V4-03) | Coach paragraph, rail |
| Single-Set Focus | "+n vs last time" under the numeral (V4-02); "Rested 3:00" at Rest end (V4-06); "then 60 × 10" from Bar & warm-up (V4-05); header list button (V3-07) | 96 px numerals, ring timer |
| Set Table | PR tag + delta and the 1.2 s row flash (V4-01, V4-04) | Table as the Set screen |
| Progress Dashboard | Projection line recomputed on every Dial change (V4-02) | Header volume on Now |

## Top 5
| # | ID | Type | Sev | Value/effort | One-line issue |
|---|---|---|---|---|---|
| 1 | V4-01 | Design | 3 | High / M | Rest has no single "how did that Set go" band. The PR is a 3 s toast over the header, a normal Set gets no comparison, the effort row floats unlabelled (and names the previous Exercise's Set after the hand-over), and at 200 % the plate line is under the dock. |
| 2 | V4-02 | Design | 2 | High / S | On Now, "Last time" sits 320 px above the Dials, and nothing updates as you dial. Add one live "Last time 70 × 7 · +1 rep · PR if logged" line under the Dials. |
| 3 | V4-04 | Design | 2 | Med / S | A PR has no felt beat: it is silent and drawn as a toast that covers Minimise and Finish. Use a 1.2 s cell flash and a short tone, with reduced motion respected. |
| 4 | V3-07 | Design | 2 | Med / S | The Now \| All segment still costs 56 px on every live screen. It's the band 200 % and 195 px need, and at 195 × 422 the Dials are under the bar. |
| 5 | V4-06 | Design | 2 | Med / S | When Rest runs out, the effort question vanishes unanswered and "Over rest" turns danger red. |

**Implement this iteration, in this order:**
1. V4-01, then V4-02. They share the comparison sentence, so build it once in `exerciseVerdict.ts`.
2. V4-04, V3-07, V4-06 (closes V1-32).
3. V4-03 (closes V3-13).
4. V4-05, V4-07, V4-08.
5. V2-14, V1-19, V1-16: each is under an hour.

**Carry to iteration 5:** V1-17 (partly), V1-20 (re-check after V3-07), V1-28, V1-31.

## Re-check of prior verdicts
| ID | Type | Was | Now | Status | Evidence |
|---|---|---|---|---|---|
| V3-07 | Design | 2 | 2 | not fixed (implement now) | `shots/50`: `role=tab` Now/All band at y 55–93; the Exercise name's top is at y 115. |
| V3-13 | Design | 1 | 1 | not fixed → folded into V4-03 | `shots/60b`: 12 cells, 4 of them "0" (Chest, Shoulders, Triceps, Biceps), plus the legend "0 · 1–2 · 3–5 · 6+ · sets / session". |
| V3-04 | Execution | 3 | 2 | partly → closed by V4-01's acceptance | `shots/76` (root 200 %): the card shows only "GET READY · SET 2 / 70 kg × 7". `elementFromPoint` at the plate line hits `.rest-panel-main` and at "Last time" hits `rest-adjust`, both under the dock and reachable only by scrolling. At 320 × 568 the plate line is visible (y 384–407) and "Last time" is not (`shots/72`). |
| V2-14 | Execution | 2 | 2 | not fixed (implement now) | `shots/77`: 11 buttons named exactly "Do this instead" (`src/ui/AlternativesList.tsx:86`). |
| V1-15 | Execution | 2 | 0 | **fixed** | `shots/53b`: "✎ Belt from set 3" under the subtitle with no tap. The weight Dial's centre is at y 607, against the v3 restated check of ≥ 420. |
| V1-16 | Design | 2 | 2 | not fixed (implement now) | `shots/58`, `shots/53a`: "Step 2.5 kg" and "Bodyweight exercise" are still in the sheet. "Use 3:50" is now a separate row under Rest time, which already says "usually 3:50". Fold the Use offer into that row's sheet. |
| V1-17 | Execution | 2 | 2 | partly (carry) | `shots/78`: on Now, "Deadlift with Bands" appears with no snackbar and no Undo. All offers "Undo swap" beside the row, which is one tab and one scroll away. |
| V1-19 | Execution | 2 | 2 | not fixed (implement now) | `.all-cell--future` border: computed `rgb(202,202,211)` dashed on the page grey, ≈1.5:1 (`src/ui/ExerciseList.css:113`, token `--color-control`). |
| V1-20 | Execution | 2 | 2 | partly (carry; re-check after V3-07) | `shots/79` (195 × 422): the cells no longer overflow (scrollWidth 163 = clientWidth 163). But the reps Dial (y 421–485) sits under the Log set bar (y 349–410 … the dock), the weight Dial is off screen, and the title reads "Worko…". |
| V1-28 | Design | 2 | 2 | not fixed (carry) | `shots/31`: Sets 36 × 40, reps 22 × 40, Rest 40 × 40, weight 48 × 40, handle 16 × 44, ⋯ 24 × 44. The number inputs also expose no name beyond "number". |
| V1-31 | Execution | 1 | 1 | not fixed (carry) | `shots/15`: on Deadlift's chart, the "57.5 kg" axis label overprints the caption "reps at that weight · tick is the target". |
| V1-32 | Execution | 1 | 1 | not fixed → folded into V4-06 | `shots/57b`: "Over rest · +0:12" in `--color-danger` (`src/ui/SetScreen.css:474`). |

V3 "observed after fixes", judged:
- **~150 px empty band on Rest:** *not calm.* It reads as a missing card, not breathing room. Folded into V4-01: the Get ready card moves up and the Just done block sits on the dock.
- **200 % Get ready card needs a scroll for the plates:** *still a problem.* Folded into V4-01. Its acceptance asks for the plate line visible with no scroll.
- **"Reps left on set 3" above the next Exercise:** *confirmed* (`shots/56`). Folded into V4-01: the block is headed "Deadlift done".
- **Warm-up ramp line repeats the card; "Last time 60 × 10" on a Warm-up:** *confirmed* (`shots/73b`). This is V4-05.
- **Flash of the old done state:** *confirmed by frame sampling.* Frame 70 ms shows "Deadlift" with "Go to Assisted pull-ups", and frame 88 ms shows the hand-over. It lasts one frame. This is V4-07.
- **Finished Exercise reopened from All shows the done state with "Go to <next>":** *confirmed* (`shots/59b`). This is V4-07.
- **Bar and plates opens in place inside Settings:** *dropped.* An in-place disclosure is the right weight for a setting touched once or twice a year. It holds 9 rows, and a separate page would add a level and a back button for no gain. One nit, to fix when nearby: the count column ("10") has no caption.

## What improved since last iteration
- The hand-over is automatic and lands on "Log set 1 · BW−19 × 6" with Rest running (V3-01, `shots/56`).
- Rest is one dock row with 14 targets, and "Use 3:50" has left Rest (V3-03, `shots/51`).
- Warm-ups no longer take working-Set numbers (V3-05, `shots/73`).
- The Sessions calendar is back and compact, and Train's strip matches it (V3-09, `shots/20`, `shots/01`).
- Train's header is the Workout (V3-08). Progress opens on one lead line (V3-11). Settings is 3 groups (V2-09).
- The Exercise note is visible at the bar (V1-15, `shots/53b`).

## Verdicts

### Design verdicts

#### Live Session

### V4-01 · Sev 3 · Design · Rest › one "Just done" band for the Set you just logged: its comparison, its PR and its effort question
- **Type:** Design (M). New feature (the per-Set comparison) plus fixes (the PR toast, the effort label, the hand-over line, the empty band, 200 %).
- **Location:**
  - `src/ui/SetScreen.tsx` (rest state: effort row, verdict line, Get ready card order), `src/ui/SetScreen.css`;
  - `src/ui/Toast.tsx` and `src/domain/prMoment.ts` (the PR toast);
  - `src/domain/exerciseVerdict.ts` (the comparison sentence).
- **Evidence:**
  - `shots/51`: the effort row is alone at y 400, ~140 px of blank sits above it, and the card is anchored to the dock.
  - `shots/54`: the PR toast covers y 12–100, over Minimise, Finish and Now | All.
  - `shots/54b`: 3 s later, only a 16 px `PR` outline is left.
  - `shots/56`: after the hand-over, "Reps left on set 3" sits under "Assisted pull-ups", and the line reads "Deadlift done · more reps · 15 vs 14 · 1 PR".
  - `shots/76`: at 200 %, the plate line is under the dock.
- **Issue:** Right after a Set is the one moment the trainee looks at the phone for feedback. The app has the answer (it computes PRs and the verdict), but it gives it in three places and three voices:
  - a toast that is gone before they turn round;
  - an unlabelled chip row;
  - a totals comparison they have to decode.

  A Set that merely matches last time gets nothing. That is most Sets, and "same as Monday, held it" is honest reinforcement too. Guided Session keeps the PR inside the rest card for the whole Rest. Set Table writes the tag and the delta next to the Set.
- **Recommendation (target design):** see the Rest and hand-over wireframes in the critique. Top to bottom:
  1. the cells;
  2. the Get ready card (read high);
  3. flexible space;
  4. the **Just done block**;
  5. the dock.

  The Just done block holds:
  - **Heading:** the Set it is about. "SET 2 · 70 kg × 8" during an Exercise, or "DEADLIFT DONE · 1 PR" after its last Set.
  - **One comparison line, from one function:** `[PR] Rep record · +1 rep on Mon 12 Oct`, `Same as Mon 12 Oct`, `+2.5 kg on Mon 12 Oct`, or `1 rep under Mon 12 Oct` (secondary colour, never red). After the last Set: `60×10 · 70×8 PR · 70×7 · 1 rep more than Mon 12 Oct`, with "Add set" at the right. With no history: `First time logged`.
  - **The effort chips:** "Reps left?" `[0] [1] [2] [3+]`. After the hand-over, they are labelled "Set 3 reps left?" under the "Deadlift done" heading.
  - The block stays for the whole Rest.

  Removed:
  - the PR toast during a live Session (the header and its buttons stay uncovered);
  - the free-floating "Reps left on set N" row;
  - the separate "Deadlift done · …" line;
  - the "15 vs 14" totals wording;
  - the blank band (it shrinks to whatever space is left between the card and the block).
- **Steps:**
  1. One comparison sentence per logged Set in `exerciseVerdict.ts`, with unit tests for same / up / down / PR / first time (S).
  2. The Just done block with the heading, the line and the chips. Move the Get ready card under the cells (M).
  3. Suppress the PR toast while the live Session is on screen; the block shows the PR (S).
  4. The hand-over variant: "<Exercise> done" heading, the Set list and "Add set" (S).
- **Acceptance check:**
  - At 390 × 844, log Deadlift Set 1 as given: the block reads "SET 1 · 60 kg × 10" and "Same as Mon 12 Oct".
  - Log Set 2 at 70 × 8:
    - the block reads "PR" and "+1 rep";
    - 2.5 s after the tap, `elementFromPoint` at the Finish button's centre returns Finish;
    - at 1:00 of Rest left, "+1 rep" is still visible.
  - After Deadlift Set 3: the block heading starts "Deadlift done", the chip label contains "Set 3", and no visible text matches `/\d+ vs \d+/`.
  - The Get ready card's top is ≤ 24 px below the cells.
  - At root 200 % at 390 × 844 and at 320 × 568, `elementFromPoint` at the centre of the plate line ("Add … per side") returns the card with **no scroll**.
- **Value/effort:** High / M · **Refs:** rubric 3.6 (next-set guidance, cognitive load), 3.7 (PR moment ≤ 1.2 s, never blocking, competence feedback), 3.3 (duplicated information); Guided Session rest-card PR banner; Set Table tag + delta

### V4-02 · Sev 2 · Design · Now › a live "vs last time" line under the Dials
- **Type:** Design (S). New feature (the line updates live); it also moves "Last time".
- **Location:** `src/ui/SetScreen.tsx` (the "Last time" line and the PR tag under the reps Dial), `src/domain/liveProgress.ts` (PR projection), `src/domain/exerciseVerdict.ts` (the shared sentence from V4-01)
- **Evidence:** `shots/50`, `shots/53`. "Last time 70 × 7 · Mon 12 Oct" is at y 258. The Dials are at y 548–702, and "PR if logged" is at y 725. Dialling reps 7 → 8 changes only the PR tag. Nothing says "+1 rep".
- **Issue:** "Am I beating last time?" is the question every trainee asks at the bar, and the persona's §3.6 names exactly this arithmetic. Today the trainee reads a line high on the screen, looks down at the Dials, and subtracts in their head. Single-Set Focus puts "+2.5 kg vs last time" right under the numeral. Progress Dashboard recomputes its projection line on every change.
- **Recommendation (target design):** one line directly under the reps Dial, rebuilt on every Dial or keypad change:
  - `Last time 70 × 7 · same · PR at 8 reps`
  - `Last time 70 × 7 · +1 rep · [PR if logged]`
  - `Last time 67.5 × 8 · +2.5 kg`
  - `Last time 70 × 7 · 1 rep under` (secondary colour)

  On a Warm-up it reads `Then set 1 · 60 × 10` (see V4-05).

  Removed: the "Last time … · Mon 12 Oct" line under the cells (its date moves to the Just done block), and the standalone PR tag row (it becomes the line's tail).
- **Steps:**
  1. Build the line from the shared comparison sentence and the existing PR projection (S).
  2. Delete the upper "Last time" line (S).
- **Acceptance check:**
  - At 390 × 844 on Deadlift Set 2 (Preset 70 × 7), the line under the reps Dial reads "Last time 70 × 7 · same · PR at 8 reps".
  - One tap on Increase reps changes it to contain "+1 rep" and "PR if logged" within 100 ms.
  - Visible text contains "Last time" exactly once on Now.
  - The line's top is ≤ 40 px below the reps Dial's bottom.
  - It wraps (no clipping) at 320 × 568 and at root 200 %.
- **Value/effort:** High / S · **Refs:** rubric 3.6 (cognitive load, progression cues), H6; Single-Set Focus; Progress Dashboard projection line

### V4-04 · Sev 2 · Design · PR moment › give the PR a felt beat: a 1.2 s cell flash and a short tone
- **Type:** Design (S). New feature.
- **Location:** `src/ui/SetScreen.tsx` (the log handler and the cell with the PR tag), `src/ui/SetScreen.css`, `src/ui/restSound.ts` (the existing lazily unlocked `AudioContext`)
- **Evidence:** `shots/54`, `shots/54b`. The PR shows as a silent toast at the top. On the cell, a 16 px outline tag appears with no change of state you'd notice from 1 m. The rest-end beep proves the app can already make a sound from a Log set tap.
- **Issue:** The persona's §3.7 benchmark is Strong's brief PR moment: the reward is *felt* in the instant, not read later. Here, a trainee who looks up a second late, or who has the phone flat on the bench, gets nothing. Sound and timing are the delight the design language allows (no confetti, no trophies).
- **Recommendation (target design):**
  - On a Log set that makes a Record, the logged cell fills with the accent tint and fades back over 1.2 s (Set Table's row flash). It then keeps the `PR` tag.
  - At the same time, two short rising tones play (about 120 ms each) through `restSound.ts`, under the same conditions as the rest beep.
  - With `prefers-reduced-motion: reduce`: no flash; the tag and the V4-01 block carry it (motion is never the only signal).
  - No sound and no flash for a non-PR Set.

  This adds a tone. It replaces the toast's slide-in (removed by V4-01), so the moment gains timing without gaining an element.
- **Steps:**
  1. A `playPrSound()` beside the rest beep (S).
  2. The flash class on the PR cell for 1.2 s, gated on reduced motion (S).
- **Acceptance check:**
  - Log Deadlift Set 2 at 70 × 8: the cell's computed background is the accent tint at +0.3 s and back to the done fill by +1.5 s, and `playPrSound` is called once (spy).
  - With `--reduced-motion`, the background never changes, and the `PR` tag is present.
  - Logging 60 × 10 (no PR) triggers neither.
- **Value/effort:** Med / S · **Refs:** rubric 3.7 (PR moment, timing and sound), 3.2 (reduced motion), HIG (pair audio with visuals); Set Table PR flash; Strong

### V4-06 · Sev 2 · Design · Rest end › keep the unanswered effort question, and drop the red "Over rest"
- **Type:** Design (S). A fix; closes V1-32.
- **Location:** `src/ui/SetScreen.tsx` (rest-over state, effort row), `src/ui/SetScreen.css:474`
- **Evidence:** `shots/57` (0:01, chips present), `shots/57b` (+0:12: chips gone, set 1 unanswered, "Over rest · +0:12" in `--color-danger`).
- **Issue:** Many trainees answer the effort question late, or not at all, during a short Rest. When the timer ends, the question silently disappears, and the red text scolds them for resting. That is guilt, and the persona's §3.7 rules it out.
- **Recommendation (target design):**
```
Deadlift · Set 2 of 3 · target 8–10                  ⋯
[1 ✓60×10] [2 70×7] [3 70×7]
Set 1 reps left?   [0] [1] [2] [3+]     ← only if unanswered; gone on answer or next log
                 (flexible space)
… Dials …
Rested 3:00 · +0:12                       ← muted
[        Log set 2 · 70 × 7        ]
```
  Removed: the danger colour on over-rest, and the "Over rest" wording ("Rested 3:00", from Single-Set Focus).
- **Steps:**
  1. Keep the effort row on Now until it is answered or the next Set is logged (S).
  2. Change the over-rest copy and colour (S).
- **Acceptance check:** Let a Rest run out without answering. On Now:
  - the four chips with "Set 1" in their label are visible above the weight Dial;
  - tapping "2" hides them, and cell 1 reads "2 left";
  - the over-rest text contains "Rested" and its computed colour is `--color-muted`;
  - no element on Now uses `--color-danger`.
- **Value/effort:** Med / S · **Refs:** rubric 3.6 (Rest), 3.7 (no guilt); Single-Set Focus "Rested 3:00"

### V3-07 · Sev 2 · Design · Live header › Now | All segment → a header button (carried, implement now)
Unchanged from iteration 3 (see `../v3/report.md`). New evidence:
- `shots/76`: at 200 % the segment's band is what pushes the Get ready card under the dock.
- `shots/79`: at 195 × 422 the reps Dial is under the bar.

Do it after V4-01, which changes the same vertical budget.

### V4-05 · Sev 2 · Design · Warm-ups › "Warm-up 2 of 3" three times, and a working Set's "Last time" on the Warm-up card
- **Type:** Design (S). A fix.
- **Location:** `src/ui/SetScreen.tsx` (the Warm-up ramp line, the Get ready card's last line)
- **Evidence:** `shots/73b`. The subtitle reads "Warm-up 2 of 3", the ramp line "Warm-up 2 of 3 · 40 kg × 3" (y 446), and the card "GET READY · WARM-UP 2 OF 3 · 40 kg × 3 · Add 5 per side → 5 + 5 · Last time 60 × 10". `shots/73` repeats the pattern on Now.
- **Issue:** A ramp is light, fast work. The trainee wants this step and where the ramp ends. Today they get the step three times, plus a "Last time" that belongs to a different Set and reads as if 40 × 3 had a history.
- **Recommendation (target design):**
```
Deadlift · Warm-up 2 of 3                            ⋯
[W 1/3] [1 60×10] [2 70×7] [3 70×7]
┌ GET READY · WARM-UP 2 OF 3 ─────────────┐
│ 40 kg × 3                               │
│ Add 5 per side → 5 + 5                  │
│ Then set 1 · 60 × 10                    │
└─────────────────────────────────────────┘
```
  Removed: the ramp line, and "Last time …" on Warm-up cards and on Now during Warm-ups (replaced by "Then set 1 · 60 × 10", Single-Set Focus's Bar & warm-up framing).
- **Steps:**
  1. Delete the ramp line (S).
  2. On a Warm-up, swap the card's and Now's last-time line for "Then set 1 · <first working Preset>" (S).
- **Acceptance check:** With 3 Warm-ups on Deadlift at 390 × 844, during the Rest after Warm-up 1:
  - "Warm-up 2 of 3" appears at most twice in visible text (case-insensitive);
  - the card contains "Then set 1 · 60 × 10";
  - no visible text "Last time" appears on the screen.
- **Value/effort:** Med / S · **Refs:** rubric 3.3 (duplicated information), H2; Single-Set Focus Bar & warm-up

#### Summary

### V4-03 · Sev 2 · Design · Summary › one win, one comparison, and what comes next
- **Type:** Design (M). A fix, plus small new content (the comparison line and the week line). Closes V3-13.
- **Location:** `src/ui/SessionSummary.tsx` (Best today, Lift by lift, Records, Next time, Worked today), `src/domain/prMoment.ts:86` ("+1 reps")
- **Evidence:** `shots/60`, `shots/60b`:
  - the one PR appears three times ("Best today … +1 reps PR", "More reps · 15 vs 14 · record", "Records · Rep record · … +1 reps");
  - "+1 reps" is wrong;
  - "Next time · Deadlift · 15 of 20 reps at 70 kg";
  - Worked today has 4 zero cells and a legend;
  - nothing compares today with the last Workout B, and nothing says what's next.
- **Issue:** The summary is the payoff of the Workout and the hook for the next one. It should take 5 seconds: "what did I win, was today better than last time, and when's next?". Today it spends those seconds on repetition, a shortfall sum and zeros. Guided Session's summary answers all three in its paragraph ("… Volume up 4.6% on last Friday … Next: Workout B, Thursday").
- **Recommendation (target design):**
```
Workout B                                   Thu 15 Oct
[PR] Deadlift 70 kg × 8 · rep record, +1 rep          ← the one win (first PR; "+1 more PR" if several)
52 min · 23 sets · vs Mon 12 Oct: volume +1.2 %       ← partial: "5 of 23 sets", no %
LIFT BY LIFT
Deadlift            60×10 · 70×8 PR · 70×7   1 rep more
Assisted pull-ups   2 of 4 sets
Worked today: Lats 3.5 · Lower back 3 · Mid back 2.5 · Quads 1.5 …
This week 3 of 3 · next up Workout A                  ← weekly, never a streak
[Share…]  [Done]
```
  Removed:
  - "Best today" as a separate line (it becomes the headline);
  - the Records section when there is only one PR (it shows only for 2 or more);
  - "record" in Lift by lift (the PR tag sits on the Set);
  - "Next time · n of m reps" (the lift page already shows it as a bar, `shots/15`);
  - the Worked today grid, its zeros and its legend (V3-13).
- **Steps:**
  1. Headline from the first PR; remove "Best today" and the single-PR Records section (S).
  2. Lift by lift uses V4-01's sentence (S).
  3. Comparison line with the last Session of the same Workout, using V2-10's rule for partial Sessions (S).
  4. Worked today as one sorted line of the non-zero muscles (S).
  5. A "This week n of N · next up <Workout>" line from the Program's frequency and the due Workout that Train already computes (S).
  6. Fix "+1 reps" → "+1 rep" (S).
- **Acceptance check:**
  - After the 5-Set Session above, the summary's visible text contains "70 kg × 8" at most twice;
  - "+1 reps" does not appear;
  - no muscle shows "0", and there is no "sets / session";
  - no text matches `/\d+ of \d+ reps at/`;
  - a line contains "vs Mon 12 Oct" or "of 23 sets";
  - a line starts "This week" and contains "Workout A";
  - Share… and Done are still the only buttons in the dock.
- **Value/effort:** Med / M · **Refs:** rubric 3.7 (one true, specific win; weekly consistency, never a streak), 3.3; Guided Session summary; Apple Fitness summary

#### Program

### V4-08 · Sev 1 · Design · Program › the Deload week switch is the second thing on the page
- **Type:** Design (S)
- **Location:** `src/features/program/` (the Program header and its ⋯ menu)
- **Evidence:** `shots/30`. Under the title, "Deload week" is a 51 px switch row, above "Weekly sets, planned" and both Workouts.
- **Issue:** A Deload is chosen every 6–8 weeks. It changes every Preset in the week, and it sits where a thumb lands on the way to the plan. A switch with that much reach should not be the page's second control.
- **Recommendation (target design):** move it to the header ⋯ as "Start a deload week". While a deload is on, one line under the title reads "Deload week · lighter Presets · End". Removed: the always-visible switch row.
- **Steps:**
  1. Move the switch into ⋯ (S).
  2. Show the "Deload week · End" line only while on (S).
- **Acceptance check:**
  - At 390 × 844, Program shows no switch named "Deload week" when no deload is on.
  - ⋯ contains "Start a deload week". After choosing it, the line "Deload week" with "End" shows under the title, and Train's Presets are the deload ones.
- **Value/effort:** Low / S · **Refs:** rubric 3.0 (content priority), H5

### Execution verdicts

#### 3.8 Perceived speed / state

### V4-07 · Sev 1 · Execution · Done state › one-frame flash before the hand-over, and a dead-end done state reopened from All
- **Location:** `src/ui/SetScreen.tsx` (the done-state branch and its "Go to <next>" Action bar), `src/features/workout/WorkoutFeature.tsx` (the current-Exercise selection after a log)
- **Evidence:**
  - Frame sampling after "Log set 3" on Deadlift: frame 70 ms shows "Deadlift" with "Go to Assisted pull-ups", and frame 88 ms shows "Assisted pull-ups" with "Log set 1 · BW−19 × 6" (`shots/55`).
  - `shots/59b`: Deadlift reopened from All shows no "Set n of N" line, a running Rest dock and "Go to Assisted pull-ups".
- **Recommendation:**
  - Pick the next Exercise in the same state update as the log, so the done branch never paints on a hand-over.
  - When a finished Exercise is opened on purpose, show its cells (tap to edit), V4-01's "Deadlift done" block with "Add set", and a bar reading "Back to Assisted pull-ups · set 3".
- **Acceptance check:**
  - Sampling every animation frame for 800 ms after logging Deadlift Set 3, no frame shows a button whose name starts "Go to".
  - Opening Deadlift from All after it's finished shows "Deadlift done" and a primary starting "Back to".
- **Value/effort:** Low / S · **Refs:** rubric 3.8 (no layout flash), H3

#### Carried execution items to implement now (unchanged recommendations, see earlier reports)
- **V2-14** (Sev 2): swap-list button names "Do <Alternative> instead".
- **V1-19** (Sev 2): upcoming-cell border to `--color-muted`, ≥ 3:1.
- **V1-16** (Sev 2): remove Step and Bodyweight from the in-workout sheet, and fold the separate "Use 3:50" row into the Rest time row.

8 new verdicts: 7 Design (88 %) and 1 Execution. 4 new features are proposed (V4-01's per-Set comparison, V4-02, V4-04, and V4-03's comparison and week lines). The Top 5 holds 5 Design verdicts.

## Not checked
- DPR 3. Shots are DPR 1, and measurements are in CSS px.
- Sound output, backgrounding, the Rest push, landscape and real iOS behaviour (whether Web Audio respects the silent switch decides how much V4-04's tone matters): none of these can be checked headless. The rest beep was confirmed only in code (`src/ui/restSound.ts`).
- Offline reload: dev mode has no service worker.
- Progress › Muscles and Body sub-pages were not re-shot this round. Session detail and editor (V1-24) were not re-opened.
- The Program editor was measured, not exercised (reorder, Custom Exercise).
- The headline "vs Mon 12 Oct: volume +1.2 %" in V4-03's wireframe is illustrative. The seeded run finished a partial Session, so the real line would read "5 of 23 sets".
