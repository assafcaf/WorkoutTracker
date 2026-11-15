# UX review: iteration 3 (2026-11-15, commit 901f931)

Reviewer: Dana Reyes (`docs/ux-expert/persona.md`). I drove the app with `scripts/ux-review/shoot.mjs` (headless Edge, touch on) against the Vite dev server: 390 × 844 at DPR 1, plus 320 × 568, 195 × 422 (200 % zoom of 390) and root font 200 %. Data: `scripts/render-states/stats-45.json` (clock pinned to Thu 15 Oct 2026), plus a clean profile for the first run. Measurements are in CSS px, read from the DOM with `eval:`. Shots are in `shots/`.

## Summary
Iteration 2 fixed the set loop. Now has no up-next rows and its Dials sit in the thumb zone (`shots/50`). Rest shows a Get ready card with the plate change (`shots/51`). The Exercise transition has one primary (`shots/55`). Train opens on today's lifts with real weights (`shots/01`), and Sessions opens on its list (`shots/20`). Train now meets the element budget: 4 blocks and 4 tap targets above the tab bar. The landing view is no longer the mess the operator described.

**The biggest remaining design problem is the moments between Sets.**
- **Rest is the busiest screen in the app:** 16 tap targets against a budget of 4, with a decision ("Use 3:50") the trainee has to make while out of breath.
- **The Exercise transition is a dead stop (V3-01):** a grey card reads "Deadlift done · same", followed by about 200 px of blank screen. The trainee then has to tap "Next" before the app says what to set up next, and that happens six times a Workout.
- **Warm-ups pose as working Sets (V3-05):** the bar reads "Log set 1 · 40 × 3", and the Get ready card says "SET 1".

**The biggest execution risk is large text.** At root 200 %, the Rest panel covers the Get ready card, so the next weight and the plates are unreachable (V3-04, `shots/76`). Train cuts Exercise names to "Assiste…" (V3-10).

**Keep:** the 1-tap Log set bar with its value, the Get ready card with "Add 5 per side → 20 + 5", "PR at 8 reps" / "PR if logged", the 3-line Progress verdict cards, the Share… + Done summary dock, and Train's per-row Presets with "↑ step up · try 15 kg".

## Design critique

The live Session comes first, because it sets the pattern that every other screen should follow.

### Per screen: the live Session

#### Now · `shots/50-now-deadlift.png`, `shots/54-pr-target.png`
- **One job:** log this Set.
- **In the moment:** chalked hands, at the bar. The trainee needs the weight, the reps and the button, and wants to know whether this Set would be a PR.
- **Element count:** 7 pieces of information (title, timer line, Exercise, Set n/N + target, cells, Last time, Per side) plus the Dials. Tap targets besides the Dials: Minimise, Finish, Now, All, ⋯ and Log set, so 6 against a budget of 4.
  - Header (Minimise, title, timer line, Finish): *earns its place*.
  - **Now | All segment** (a 56 px band, y 55–93): *merge* into one list button in the header. Single-Set Focus does this with its list icon. It costs a full band on every live screen, and that band is exactly what is missing at 320 × 568 and at 200 % (V3-07).
  - Cells, Last time, Dials, Per side, PR target, Log set: *earn their place*.
  - The ~300 px gap between "Last time" and the Dials is the cost of thumb-zone Dials, and I accept it. I considered Single-Set Focus's 96 px numerals to fill it. I'm not asking for that this round: it adds size, not clarity.
- **How I'd design it:** as shipped, minus the segment band.
```
⌄ Workout B · 00:01 · 0/23 sets      [≡ All] [Finish]
Deadlift · Set 1 of 3 · target 8–10          ⋯
[1 60×10] [2 70×7] [3 70×7]
Last time 60 × 10 · Mon 12 Oct
                 (flexible space)
−        60 kg        +
Per side: 20
−        10 reps      +
PR at 11 reps
[        Log set 1 · 60 × 10        ]   ← primary
```
- **Would I ship it?** Yes.

#### Rest · `shots/51-rest.png`, `shots/54b-pr-moment.png`, `shots/72-320-rest.png`, `shots/76-200pct-rest.png`
- **One job:** recover, and get the bar ready for the next Set.
- **In the moment:** breathing hard, loading plates, 1 m from the phone. The trainee wants three things: how long is left, what goes on the bar, and how the last Set felt (one tap).
- **Element count:** 16 tap targets: Minimise, Finish, Now, All, ⋯, the logged cell, 4 Effort chips, Change, "Use 3:50", −15 s, +15 s, Skip rest, and Log set. Information: cells, the effort label, the Get ready card (4 lines), the countdown, "REST of 3:00" and "Use 3:50".
  - Get ready card: *earns its place*. It is the best thing on the screen.
  - Countdown, −15 / +15 / Skip: *earn their place*, but they take two bands (the clock row at 83 px, then the buttons at 56 px). *Merge* them into one dock row, as in Set Table's rest dock.
  - "Use 3:50" (a 44 px chip next to the clock): *move* to ⋯ › Rest time. It asks the trainee to decide on a Rest rule in the middle of a Rest, and the app could ask that later.
  - Effort row "Set 1 effort · RIR 0 · 1 · 2 · 3+": *earns its place*, but the label is jargon, and the first chip names a unit the others lack (V1-14).
  - Now | All: *merge* (V3-07).
  - Blank band between the card and the clock (~110 px at 390 × 844): *cut*. Anchor the card to the dock instead.
- **How I'd design it:** Set Table's single-row rest dock under Single-Set Focus's Next card. The card sits low, near the thumb and the bar, and the clock stays big.
```
⌄ Workout B · 00:03 · 1/23 sets      [≡ All] [Finish]
Deadlift · Set 2 of 3 · target 8–10          ⋯
[1 ✓60×10] [2 70×7] [3 70×7]
                 (flexible space)
Reps left on set 1   [0] [1] [2] [3+]
┌ GET READY · SET 2 ───────────────────────┐
│ 70 kg × 7                                │
│ Add 5 per side → 20 + 5                  │
│ Last time 70 × 7 · PR at 8 reps  Change ›│
└──────────────────────────────────────────┘
2:59 of 3:00     [−15 s] [+15 s] [Skip]
[        Log set 2 · 70 × 7        ]   ← primary
```
- **Would I ship it?** Not yet. It needs the dock merge and the 200 % fix (V3-03, V3-04).

#### Exercise transition · `shots/55-exercise-done.png`, `shots/56-next-exercise.png`
- **One job:** close this Exercise and set up the next one.
- **In the moment:** the heavy lift is done, and the trainee walks to the next station. They want to know what it is and what to load. A grade is a bonus.
- **Element count:** a grey card "Deadlift done · same" (one bold line, no numbers), then ~200 px of blank screen, the Rest dock, "+ Add set" and "Next: Assisted pull-ups". The next Exercise's weight is not visible until the trainee taps Next.
  - Verdict card: *merge* into one line above the next Exercise's Get ready card.
  - "Next: …" primary: *cut*. Advance by itself, as Strong, Hevy and the Guided Session stream all do ("Then Lunges"), so the bar can go straight back to "Log set 1 · BW−19 × 6".
  - "+ Add set": *move* into the verdict line as "Add set to Deadlift".
- **How I'd design it:**
```
Assisted pull-ups · Set 1 of 4 · target 5–8   ⋯
[1 BW−19×6] [2 …] [3 …] [4 …]
Reps left on set 3   [0] [1] [2] [3+]
Deadlift done · 3 sets · same as last time   Add set
┌ GET READY · SET 1 ───────────────────────┐
│ BW−19 × 6                                │
│ Last time BW−19 × 6 · PR at 7 reps       │
└──────────────────────────────────────────┘
2:57 of 3:00     [−15 s] [+15 s] [Skip]
[     Log set 1 · BW−19 × 6     ]   ← primary
```
- **Would I ship it?** No. It is a full stop where there should be a hand-off (V3-01, V3-02).

#### All · `shots/52-all-view.png`
- **One job:** see the whole Workout, and log out of order.
- **Element count:** 7 Exercise blocks, 23 cells, Log set. *Earns its place.* The upcoming cells' dashed border measures `rgb(202,202,211)` on `rgb(246,246,248)`, about 1.5:1 (V1-19, carried).
- **Would I ship it?** Yes, as the second view, reached from a header button (V3-07).

#### Warm-ups · `shots/73-warmup.png`, `shots/73b-warmup-rest.png`
- **One job:** run the Warm-up ramp without polluting the working Sets.
- **In the moment:** light weights, fast. The trainee wants the ramp done and out of the way.
- **Element count:** after "Add warm-ups", Warm-up 1 takes cell "1" and the bar says "Log set 1 · 30 × 5". After it, the cells read `W 30×5 · 1 40×3 · 2 70×7 · 3 70×7`, so warm-up 2 is labelled **1**. The Get ready card says "SET 1 · 40 kg × 3". The effort chips ask about "Set 1" after a Warm-up.
- **How I'd design it:** Single-Set Focus's collapsed `W 2/3` cell. Warm-ups share one cell, the working cells keep their numbers 1–3, and the bar says "Log warm-up 2 · 40 × 3" (V3-05).
- **Would I ship it?** No.

#### Session summary · `shots/60-summary.png`, `shots/60b-summary-full.png`
- **One job:** show what I achieved today.
- **Element count:** header, the "Best today" line (only when there is a Record), Lift by lift, Records, Next time, Worked today (a 12-cell grid with a legend), and the dock (Share… + Done). Two buttons. Good.
  - Lift by lift on a partial Session: "Assisted pull-ups · Fewer reps · 6 vs 23", which compares 1 Set with 4. "Deadlift · Same" says nothing (V3-02).
  - Worked today: 12 cells, 5 of them "0", plus a 5-item legend: *cut* the zeros and the legend (V3-13, carried).
  - "Next time · Deadlift · 14 of 20 reps at 70 kg": the arithmetic phrasing V2 flagged. *Carried*. Fold it into the Lift-by-lift wording when V3-02 lands.
- **Would I ship it?** Yes, after V3-02.

### Per screen: everything else

#### First run · `shots/02-first-run.png`
- **One job:** pick a Program. One card, two Programs, one primary ("Use A/B Split"). The footnote is gone (V2-15).
- **Element count:** 4 blocks and 3 tap targets above the tabs. The gear still shows a dot on an empty install (V1-30).
- **Would I ship it?** Yes.

#### Train · `shots/01-train-seeded.png`, `shots/57-minimised-train.png`, `shots/74-200pct-train.png`
- **One job:** start today's Workout.
- **In the moment:** 17:58, bag on the shoulder. The trainee wants to know which Workout, what's in it, and at what weight. Then Start.
- **Element count (1st screenful):** 4 blocks (header, week strip, 7 rows, dock) and 4 tap targets (sync, gear, Change, Start). That is within budget.
  - "Train" h1: *cut*. The tab bar already says Train. The screen's subject is "Workout B".
  - "Thu 15 Oct · Not synced · saved on this phone" (two lines at 390 px): *move* the sync half into the cloud icon (its state and its name) and Settings › Data & sync. On a local-first app, every launch should not open on "Not synced".
  - Week strip "This week M B · T · W A · [T] … 2 of 3": *earns its place*, as the honest reason to train today. It should look like the Sessions calendar's current week and open it on tap (V3-09). Today it is not tappable.
  - Rows `3 × 60 kg · 8–10` with "↑ step up · try 15 kg": *earn their place*.
  - Dock "Workout B due · last Mon 12 Oct" + "7 exercises · 23 sets · ~66 min" + Change + Start: *merge*. The first line moves up to become the title, and "23 sets" goes (the rows say it).
  - ~200 px of empty space under the list: acceptable, since the dock is pinned.
- **How I'd design it:** Guided Session's Today ("Workout A today." as the headline, the plan as rows, `Start` docked). I reject its coach paragraph, because the rows already say what changed.
```
Workout B                                  ☁  ⚙
Thu 15 Oct · last done Mon 12 Oct
[M B][T ·][W A][T ▢][F ·][S ·][S ·]   2 of 3  ›   (= Sessions calendar row)
Deadlift               3 × 60 kg · 8–10
Assisted pull-ups      4 × BW−19 · 5–8
…
Seated biceps curls    3 × 14 kg · 10–12
  ↑ step up · try 15 kg
───────────────────────────────────────────────
~66 min                                  Change
[          Start Workout B          ]   ← primary
```
- **During a live Session** (`shots/57`): the LiveStrip "Workout B · 00:02 · Rest 2:59 · Return" *and* a "Resume Workout B" primary are two returns to the same place. Acceptable, and not a verdict this round.
- **Would I ship it?** Yes, with V3-08's trims. At 200 % it needs V3-10.

#### Sessions · `shots/20-sessions.png`; for the operator, `../v2/shots/20-sessions.png`
- **One job:** find a past Session and open it. A second, quieter job: "have I been consistent?"
- **In the moment:** on the sofa.
- **Element count:** title, the "6 weeks 3 · 1 · 3 · 3 · 3 · 2 · 15 sessions" row, then the list. 7 rows on the first screen. Every row carries an accent "n PRs" pill (4–6 per Session, 15 pills on the page). With every row lit up, the pill carries no signal. That is minor, and I'm recording it rather than making it a verdict.
- **Operator ruling:** the colour-coded 6-week calendar comes back. I agree that it is the better consistency answer. The "3 · 1 · 3 · 3 · 3 · 2" row is a number line the trainee has to decode. The calendar is a picture: A and B alternate, the gaps show, and today is outlined. What made V2's version crowded was not the calendar. It was the legend block, the 48 px "15 sessions" figure, and the muscle matrix and volume charts underneath it. The calendar returns alone, compact, and replaces the number row (V3-09).
- **How I'd design it:** Hevy's history feed with the calendar as its header (Progress Dashboard's Sessions calendar, without its matrix and volume card).
```
Sessions
┌ Last 6 weeks · 15 sessions ─────────────────┐
│        M    T    W    T    F    S    S      │
│ 7 Sep [A]   ·   [B]   ·   [A]   ·    ·      │
│14 Sep [B]   ·    ·    ·    ·    ·    ·      │
│  …                                          │
│12 Oct [B]   ·   [A]  [▢]   ·    ·    ·      │
└─────────────────────────────────────────────┘
THIS WEEK
Wed 14 Oct  Workout A      71 min · 24 sets · 4 PRs  ›
Mon 12 Oct  Workout B      66 min · 23 sets · 5 PRs  ›
LAST WEEK …
```
- **Train's strip vs the calendar:** the 6-week grid must **not** replace Train's strip. The landing view answers "today", and six rows of history would bring back the clutter we just cut. Train keeps one row, drawn as the calendar's current week (same cells, same A/B colours, today outlined), and tapping it opens Sessions. One component, two zoom levels.
- **Would I ship it?** Yes, once the calendar returns in this form.

#### Progress · `shots/10-progress.png`, `shots/10b-progress-full.png`, `shots/15-lift-back-squat.png`
- **One job:** answer "am I getting stronger?".
- **Element count (1st screenful, review budget 7 blocks):** headline "11 of 14 lifts moving.", a 4-counter row, "12 of 14 lifts stepped up since Fri 18 Sep.", 4 verdict cards, and Last week: 8 blocks. "11 moving" is said twice in 60 px. The first card starts at y≈208.
  - Headline: *earns its place*.
  - Counter row: *cut* (All lifts has the status filter).
  - "Stepped up since…" line: *merge* into the headline.
  - Verdict cards: *earn their place* (V2-08 landed well).
  - The Muscles row reads "Traps 2.25 · Abdominals 3": the wrong vocabulary, plus a region the Muscles page doesn't list (V3-12).
- **How I'd design it:** Guided Session's Progress lead sentence (one sentence, then the evidence).
```
Progress                                Thu 15 Oct
11 of 14 lifts moving · 12 stepped up since 18 Sep
[Narrow-grip pull-down  ▼ Slipping …]
[Push-ups               ■ Stalled  …]
…
Last week · Muscles › · All 14 lifts › · Body ›
```
- **Lift page:** "No A session" still overprints "Deload", and the caption sits on the 50 kg label (V1-31, `shots/15`).
- **Would I ship it?** Yes, after V3-11.

#### Program · `shots/30-program.png`, `shots/31-program-edit.png`
- **One job:** see and change the plan. The tables lead, and "This week" is gone (V2-06). The "Deload week" switch is the second element on the page, for an action taken every 6–8 weeks. I'd move it into ⋯, but I'm not making it a verdict this round.
- **Editor:** the reps inputs are still 22 × 40, Sets 36 × 40, the handle 16 × 44 and ⋯ 24 × 44 (V1-28, carried).
- **Would I ship it?** Program, yes. The editor, not until V1-28 is fixed.

#### Settings · `shots/40-settings-full.png`
- **One job:** change how the app behaves.
- **Element count:** 13 sections, 49 controls, 2,710 px. Active program, 11 equipment switches and Compare volume are all still here, and there is no "Last backup" line. V2-09 is unchanged, and I'm keeping its wireframe (Workout · Reminders · Data & sync).
- **Would I ship it?** No (V2-09).

### Whole app

**Navigation model.** Keep the four tabs: `[Train] [Progress] [Sessions] [Program]`, with Settings behind the Train gear and the LiveStrip on every tab. Inside the live Session, I'd swap the Now | All segment for one header button (V3-07). It frees one 56 px band on every live screen, which is the band that 320 px and 200 % keep running out of.

**First run and home.** First run: 3 taps to a logged Set (Use → Start → Log set). Every later launch takes 2 (Start → Log set). Train is now a start screen, not a dashboard. What's left is trimming text: the h1 and the sync sentence (V3-08).

**Visual hierarchy and density.** The review screens are now calm. The live Session has the density problem: Rest (16 targets) and the transition (blank space where the next step should be). The rule I'd hold the live Session to: **one band per question.** Where am I (header and cells), how did it feel (effort), what's next (Get ready), how long (the dock), do it (Log set).

**Pattern consistency.**
- **"Set" numbering:** Warm-ups take working-Set numbers in the cells, the bar and the Get ready card (V3-05).
- **The week picture:** Train has a dot strip, Sessions a number row, and V2 had a coloured grid. One component should serve both screens (V3-09).
- **Verdict words:** live "Deadlift done · same", summary "Same", "Fewer reps · 6 vs 23", Progress "▼ Slipping". The summary and live wording are terse and sometimes compare unequal things (V3-02).
- **Muscle vocabulary:** "Abdominals" and "Traps" are back on Progress home (V3-12).

**Core loop and motivation.** Plan → train → see progress → come back. The loop is now flat in only one place, the end of each Exercise. That is the natural reward moment, and the app answers it with "same". Show the honest verdict in a full phrase, then hand straight over to the next Exercise. At the end of a week, the restored calendar is the "come back" picture: a run of A/B cells is honest, weekly and forgiving. It is not a streak counter, and it must never become one.

**Concept scorecard (what I borrowed this round):**

| Concept | Borrowed for | Rejected |
|---|---|---|
| Single-Set Focus | Collapsed `W` warm-up cell (V3-05); header list button instead of a segment (V3-07) | 96 px numerals, the ring timer (size without clarity) |
| Set Table | Single-row rest dock (V3-03) | The table as the Set screen (All already covers it) |
| Guided Session | Auto-advance to the next Exercise (V3-01); "Workout B" as the Train title (V3-08); a one-sentence Progress lead (V3-11) | The coach paragraph, the no-tab-bar hub |
| Progress Dashboard | Sessions calendar as the list's header (V3-09); the LiveStrip (kept) | Dashboard home, header volume, matrix on Sessions |

## Top 5
| # | ID | Type | Sev | Value/effort | One-line issue |
|---|---|---|---|---|---|
| 1 | V3-04 | Execution | 3 | High / S | At 200 % text, the Rest panel covers the Get ready card, so the next weight and plates can't be seen. |
| 2 | V3-01 | Design | 3 | High / S | After an Exercise's last Set, the screen stops on "Deadlift done · same" and needs a tap before it shows what to set up next. |
| 3 | V3-03 | Design | 3 | High / M | Rest has 16 tap targets in two dock bands, including a mid-Rest rule decision ("Use 3:50"). |
| 4 | V3-05 | Design | 3 | High / M | Warm-ups take working-Set numbers ("Log set 1 · 40 × 3", "GET READY · SET 1") and ask for effort. |
| 5 | V3-09 | Design | 2 | Med / M | Operator: restore the colour-coded 6-week calendar on Sessions, compact, and make Train's strip its current-week row. |

**Implement this iteration, in this order:** V3-04, V3-01, V3-03 (with V1-14), V3-05 (closes V1-12), V3-06, V3-09, V3-08, V3-02, V3-11, V3-12, V3-10, V2-09.
**Carry to iteration 4:** V3-07, V3-13, V2-14, V1-15 (re-shoot), V1-16, V1-17, V1-19, V1-20, V1-28, V1-30, V1-31, V1-32.

## Re-check of prior verdicts
| ID | Type | Was | Now | Status | Evidence |
|---|---|---|---|---|---|
| V2-01 | Design | 3 | 0 | fixed (superseded by V3-01) | `shots/55`: one accent "Next: Assisted pull-ups", 358 × 64. One tap gives Assisted pull-ups Set 1 on Now with 2:57 running (`shots/56`). V3-01 removes the tap. |
| V2-02 | Design | 3 | 0 at 100 %, see V3-04 | fixed at 390 and 320; regressed at 200 % | `shots/51`, `shots/72-320-rest.png`: "70 kg × 7", "Add 5 per side → 20 + 5". At root 200 %, the plate line's `elementFromPoint` hits `.rest-clock` (`shots/76`). |
| V2-03 | Design | 3 | 0 | fixed | `shots/50`: no up-next rows; the weight Dial is at y 575–639. |
| V2-04 | Design | 2 | 0 | fixed | `shots/51` "PR at 8 reps"; `shots/54` "PR if logged"; no "e1RM" on Now. |
| V2-05 | Design | 3 | 0 | fixed | `shots/01`: rows `3 × 60 kg · 8–10`, no bars or legend, "2 of 3" at y 117. |
| V2-06 | Design | 2 | 0 | fixed | No matrix on Sessions (`shots/20`). Program shows only the planned list (`shots/30`). The summary has one grid (`shots/60b`). |
| V2-07 | Design | 2 | 0 | fixed; partly reversed by operator → V3-09 | `shots/20`: first row at y 131. The calendar returns under V3-09. Volume charts and the matrix stay out. |
| V2-08 | Design | 2 | 0 | fixed | `shots/10`: cards ~94 px, 4 on the first screen, one "All 14 lifts" row. |
| V2-09 | Design | 2 | 2 | not fixed (implement now) | `shots/40-settings-full.png`: 13 sections, 49 controls, 2,710 px. Active program, equipment and Compare volume are still present. |
| V2-10 | Design | 2 | 0 | fixed | `shots/60b`: Share… + Done; no switch, no Health block. |
| V2-11 | Design | 2 | 2 | partly → V3-02 | `shots/55`: "Deadlift done · same" is visible with no tap, but the wording is empty. The header PR count was not re-verified (the toast covers the header for 3 s, `shots/54b`). |
| V2-12 | Execution | 3 | 0 | fixed (its check) | `shots/74`, `shots/75`: no overprinting at 200 %. New 200 % issues: V3-04, V3-10. |
| V2-13 | Execution | 2 | 2 | regressed → V3-12 | `shots/10b`: the Progress home Muscles row reads "Traps 2.25 · Abdominals 3". |
| V2-14 | Execution | 2 | 2 | not fixed (carry) | `shots/77-swap-list.png`: 5 buttons named exactly "Do this instead". |
| V2-15 | Execution | 1 | 0 | fixed | `shots/02`: no footnote. |
| V1-10 | Execution | 2 | 0 | fixed (by V2-02) | `shots/72-320-rest.png`: the card and the chips are visible at 320 × 568. |
| V1-12 | Execution | 2 | 3 | not fixed, worse → superseded by V3-05 | `shots/73b`: "GET READY · SET 1 · 40 kg × 3" for warm-up 2, and "Set 1 effort". |
| V1-13 | Execution | 2 | 0 | fixed (v2 after-shot stands) | Not re-shot. |
| V1-14 | Execution | 2 | 2 | not fixed → folded into V3-03 step 3 | `shots/51`: chips "RIR 0 · 1 · 2 · 3+", labelled "Set 1 effort". |
| V1-15 | Execution | 2 | — | not re-shot | Check restated: on Workout A › Back squat, the note shows as one line on Now, and the weight Dial's centre stays at y ≥ 420. |
| V1-16 | Design (moves a feature) | 2 | 2 | not fixed (carry) | `shots/58-tools-sheet.png`: "Step 2.5 kg" and "Bodyweight exercise" are still in the sheet. |
| V1-17 | Execution | 2 | 2 | not fixed (carry) | `shots/78-after-swap.png`: "Deadlift with Bands", no snackbar, no Undo. |
| V1-19 | Execution | 2 | 2 | not fixed (carry) | `.all-cell--future` border `rgb(202,202,211)` dashed on `rgb(246,246,248)`, about 1.5:1. |
| V1-20 | Execution | 2 | 2 | not fixed (carry) | `shots/79-zoom200-now.png` (195 × 422): title "Worko…", cell 3 clipped, Dials under the Log set bar. V3-07 frees 56 px towards it. |
| V1-24 | Execution | 2 | 0 | fixed (v2 after-shot stands) | Not re-shot. The harness's `tap:` didn't open a row this time. |
| V1-28 | Design (moves fields) | 2 | 2 | not fixed (carry) | `shots/31`: reps 22 × 40, Sets 36 × 40, handle 16 × 44, ⋯ 24 × 44. |
| V1-30 | Execution | 2 | 2 | not fixed (folds into V2-09) | `shots/02`: gear dot on an empty install. Settings says "Never synced", with no "Last backup". |
| V1-31 | Execution | 1 | 1 | not fixed (carry) | `shots/15`: "No A session" overprints "Deload". |
| V1-32 | Execution | 1 | 1 | not fixed (carry) | `src/ui/SetScreen.css:451` `.rest-over[data-over='true'] { color: var(--color-danger) }`. |

V2 "observed, for the reviewer":
- The done-state gap and the terse verdict are now V3-01 and V3-02.
- "Train week strip cannot be tapped" is now V3-09, step 4.
- The 200 % live header title sits tight against the top edge (`shots/75`). It's cosmetic and goes away with V3-07.

## What improved since last iteration
- The set loop has one primary in every state, including the transition (V2-01, `shots/55`).
- Rest shows what to load, with the plate change, at 390 and 320 (V2-02, `shots/51`, `shots/72`).
- Now is down to 6 tap targets with the Dials in the thumb zone (V2-03, `shots/50`).
- The PR target is a goal, not arithmetic (V2-04, `shots/51`, `shots/54`).
- Train shows today's Workout as it will be lifted (V2-05, `shots/01`). Sessions leads with the list (V2-07). Progress cards are 3 lines (V2-08). The summary ends on Done (V2-10).
- No overprinting at 200 % (V2-12).

## Verdicts

### Design verdicts

#### Live Session

### V3-01 · Sev 3 · Design · Live Session › the Exercise transition stops instead of handing over
- **Type:** Design (S)
- **Location:** `src/ui/SetScreen.tsx` (done state, `onNext` / `upNext`), `src/features/workout/WorkoutFeature.tsx` (current-Exercise selection after a log)
- **Evidence:** `shots/55-exercise-done.png`, `shots/56-next-exercise.png`. Start Workout B and log 3 Sets. The screen shows a grey card "Deadlift done · same", ~200 px blank (y 390–580), the Rest dock, "+ Add set" and "Next: Assisted pull-ups". The next Exercise's weight, Plate line and last time appear only after that tap. This happens 6 times per Workout.
- **Issue:** The trainee walks to the next station during this Rest. The app knows exactly what they need there, but it waits for a tap before showing it. Strong, Hevy and the Guided Session stream ("Then Lunges") hand over by themselves.
- **Recommendation (target design):** see the transition wireframe in the critique. After an Exercise's last Set is logged, Now switches to the next unfinished Exercise with the Rest still running. Its Get ready card and its "Log set 1 · …" bar come up, and one line above the card reads "Deadlift done · <verdict> · Add set". "Add set" adds a Set to the Exercise just finished and returns to it.
  Removed: the done state, the "Next: <Exercise>" primary and the separate "+ Add set" button. The verdict card shrinks to one line. When no Exercise is left, the bar becomes "Finish workout" (as Single-Set Focus does).
- **Steps:** 1) On logging the last Set, select the next unfinished Exercise, using the existing `onNext` logic (S). 2) Render the verdict line, with its "Add set" link, above the Get ready card for that Rest only (S). 3) Delete the done-state branch and its Action bar variant (S).
- **Acceptance check:** At 390 × 844, after Deadlift Set 3, with no further tap: the Get ready card reads "BW−19 × 6", the Action bar reads "Log set 1 · BW−19 × 6", a line starting "Deadlift done ·" is visible, and no button's name starts with "Next:". From Deadlift Set 3 to logging Assisted pull-ups Set 1 takes 1 tap. Tapping "Add set" shows Deadlift with 4 cells. After the last Exercise, the primary reads "Finish workout".
- **Value/effort:** High / S · **Refs:** rubric 3.0 (primary-action clarity), 3.6 (next-set guidance); Guided Session stream; Strong / Hevy auto-advance

### V3-03 · Sev 3 · Design · Rest › 16 tap targets, two dock bands, and a decision mid-Rest
- **Type:** Design (M)
- **Location:** `src/ui/live/RestPanel.tsx`, `src/ui/SetScreen.tsx` (rest state, effort row), `src/ui/SetScreen.css`; ⋯ › Rest time row in the Exercise tools sheet
- **Evidence:** `shots/51-rest.png`. 16 tap targets: Minimise, Finish, Now, All, ⋯, the logged cell, 4 chips, Change, "Use 3:50 for Deadlift", −15 s, +15 s, Skip rest, Log set. The clock row (y 622, 83 px) and the button row (y 704, 56 px) are separate bands. ~110 px is blank between the card and the clock. The chips read "RIR 0 · 1 · 2 · 3+" under "Set 1 effort" (V1-14).
- **Issue:** Rest is when the trainee has the least attention to spare, and it carries the most controls in the app. "Use 3:50" asks them to change a Rest rule while out of breath. "RIR" is jargon, and only the first chip carries it.
- **Recommendation (target design):** see the Rest wireframe in the critique, which borrows Set Table's one-row rest dock: `2:59 of 3:00  [−15 s] [+15 s] [Skip]` in one band, with the countdown still ≥ 56 px. The Get ready card and effort row sit just above it, and the flexible space goes above them.
  Moved: "Use 3:50" goes into ⋯ › Rest time as "3:00 · usually 3:50 · Use" (the Rest storage rules are unchanged).
  Relabelled: the effort row becomes "Reps left on set 1", with chips `0 1 2 3+` (Effort semantics unchanged).
  Removed: the second dock band and the blank band.
- **Steps:** 1) Move the "Use <usual>" offer into the tools sheet's Rest time row (S). 2) Merge the clock and the ±/Skip into one dock row, and bottom-anchor the card and the effort row (M). 3) Relabel the effort row and the first chip (S, closes V1-14).
- **Acceptance check:** At 390 × 844 during Rest: no element named "Use 3:50…"; the countdown, −15 s, +15 s and Skip share one row ≤ 80 px tall; the countdown's font-size is ≥ 56 px; no vertical gap > 48 px between the Get ready card and that row; ≤ 15 tap targets on screen; and no visible text "RIR". ⋯ › Rest time shows "usually 3:50".
- **Value/effort:** High / M · **Refs:** rubric 3.0 (element budget), 3.6 (cognitive load), H2; Set Table rest dock; principles §2.5

### V3-05 · Sev 3 · Design · Warm-ups › Warm-ups take working-Set numbers
- **Type:** Design (M), supersedes V1-12
- **Location:** `src/ui/SetScreen.tsx` (cells, Get ready card, bar label, effort row), `src/ui/SetScreen.css` (`.set-cells`)
- **Evidence:** `shots/73-warmup.png`, `shots/73b-warmup-rest.png`. Deadlift › ⋯ › Add warm-ups. Warm-up 1 sits in cell "1", and the bar reads "Log set 1 · 30 × 5". After it, the cells read `W 30×5 · 1 40×3 · 2 70×7 · 3 70×7`, the card says "GET READY · SET 1 · 40 kg × 3", the bar says "Log set 1 · 40 × 3", and "Set 1 effort" chips ask about a Warm-up. With 3 warm-ups, an Exercise grows to 6 cells (see V3-06).
- **Issue:** Warm-ups don't count toward stats. Yet the screen labels them Set 1, so the trainee can't tell whether the real Set 1 has been done or whether a 40 kg triple will count. Single-Set Focus solved this with one collapsed cell.
- **Recommendation (target design):**
```
[W 1/3] [1 70×7] [2 70×7] [3 70×7]
GET READY · WARM-UP 2 OF 3
40 kg × 3 · Add 5 per side → 5 + 5
[    Log warm-up 2 · 40 × 3    ]
```
  All Warm-ups share one `W n/N` cell, which ticks to `W ✓` when done; tapping it opens the tools sheet's Warm-up tab. Working cells keep 1..N. The Get ready card and the bar say "Warm-up". No effort row appears after a Warm-up.
  Removed: the per-Warm-up cells and the effort chips after Warm-ups. The Warm-up rules are unchanged.
- **Steps:** 1) Bar and Get ready labels say "warm-up n" for Warm-up Sets (S). 2) Hide the effort row after a Warm-up (S). 3) Collapse Warm-up cells into one `W n/N` cell (M).
- **Acceptance check:** With 3 Warm-ups added on Deadlift, at 390 × 844: the cell row has exactly 4 cells, labelled `W…`, 1, 2, 3. Before warm-up 2, the bar reads "Log warm-up 2 · 40 × 3", and no visible text reads "SET 1" or "Set 1 effort". After the last Warm-up, the bar reads "Log set 1 · 60 × 10".
- **Value/effort:** High / M · **Refs:** rubric 3.1 H2/H4, 3.5; CONTEXT "Warm-up"; Single-Set Focus `W 3/3` cell

### V3-07 · Sev 2 · Design · Live header › the Now | All segment costs a full band on every live screen
- **Type:** Design (S)
- **Location:** `src/ui/LiveHeader.tsx`, `src/ui/LiveHeader.css`, `src/features/workout/WorkoutFeature.tsx` (view state)
- **Evidence:** `shots/50` (segment at y 55–93, plus its band to y 100), `shots/72-320-rest.png`, `shots/76-200pct-rest.png`, `shots/79-zoom200-now.png` (195 × 422: the Dials sit under the Log set bar).
- **Issue:** The segment is a mode switch the trainee uses a few times per Workout, yet it takes 56 px on the screens that are shortest on space. On Now it adds 2 targets where 1 would do.
- **Recommendation (target design):** `⌄ Workout B · 00:01 · 0/23 sets   [≡ All] [Finish]`. A 44 × 44 list button toggles All. Its name is "All exercises", and on All it reads "Now" (Single-Set Focus's Session-map icon, with a text label kept for clarity).
  Removed: the segment band.
- **Steps:** 1) Replace the segment with a header button that toggles the view (S).
- **Acceptance check:** At 390 × 844 on Now, the Exercise name's top is at y ≤ 70 (was 115). There is no `role=tab` "Now" or "All" in the DOM, and one button toggles between them (≥ 44 × 44). At 195 × 422, the reps Dial is not covered by the Log set bar.
- **Value/effort:** Med / S · **Refs:** rubric 3.0 (element budget), 3.2 (reflow); Single-Set Focus session map
- **Status:** carry to iteration 4 (do it after V3-03, which changes the same vertical budget).

#### Train

### V3-08 · Sev 2 · Design · Train › the header says "Train" and "Not synced"; the dock repeats the Workout
- **Type:** Design (S)
- **Location:** `src/features/dashboard/DashboardView.tsx`, `src/features/dashboard/DashboardScreen.css`; the sync status component in the Train header
- **Evidence:** `shots/01-train-seeded.png`. The h1 is "Train" (the tab label). Line 2, "Thu 15 Oct · Not synced · saved on this phone", wraps to 2 lines. The dock repeats "Workout B due · last Mon 12 Oct" and "7 exercises · 23 sets · ~66 min" above "Start Workout B". That's 5 text lines of chrome around 7 useful rows.
- **Issue:** The landing view should read "Workout B, today" in one glance. Today the first words are the tab name and a sync warning, and the Workout's name and date sit in the dock 600 px lower.
- **Recommendation (target design):** see the Train wireframe in the critique (Guided Session's "Workout A today." headline). The h1 is "Workout B". The sub-line is "Thu 15 Oct · last done Mon 12 Oct". The dock is "~66 min · Change" over Start.
  Removed: the "Train" h1, the "Not synced · saved on this phone" text (the cloud icon keeps it as its accessible name and state, and Settings › Data & sync states it), the "Workout B due · last …" dock line (merged into the sub-line), and "7 exercises · 23 sets" (the rows show it).
- **Steps:** 1) Title and sub-line from the due Workout (S). 2) Move the sync sentence into the cloud icon's name and state (S). 3) Trim the dock to time + Change + Start (S).
- **Acceptance check:** At 390 × 844 with seeded data: the h1 text is "Workout B"; "Workout B" appears exactly twice in visible text (h1 and Start); no visible text contains "Not synced"; the cloud button's accessible name contains "saved on this phone"; the first Exercise row's top is at y ≤ 150; and Start is fully visible with no scroll.
- **Value/effort:** High / S · **Refs:** rubric 3.0 (purpose, content priority), 3.9 (sync is quiet); Guided Session Today

#### Sessions (operator direction)

### V3-09 · Sev 2 · Design · Sessions › restore the colour-coded 6-week calendar, compact, as the list's header
- **Type:** Design (M); partly reverses V2-07 (the list-first order and the cuts of the matrix and volume charts stay)
- **Location:** `src/features/sessions/SessionsScreen.tsx`, `SessionsScreen.css` (the V2 calendar component, from git history before V2-07); `src/features/dashboard/DashboardView.tsx` (Train week strip)
- **Evidence:** `shots/20-sessions.png` today: one row "6 weeks 3 · 1 · 3 · 3 · 3 · 2 · 15 sessions". V2's calendar (`../v2/shots/20-sessions.png`): 6 × 7 cells with A/B letters in Workout colours and today outlined. Its card ran to y≈500 because of a 3-item legend and a 48 px "15 sessions" figure, not because of the grid.
- **Issue:** "Have I been consistent, and am I alternating A and B?" is a picture question. The number row makes the trainee decode it, and the operator wants the picture back. It must come back without the clutter that sat around it.
- **Recommendation (target design):** see the Sessions wireframe in the critique. One card at the top of Sessions: the header line "Last 6 weeks · 15 sessions", a day-letter row, and 6 week rows of 7 cells. Session days are filled in the existing Workout A / B tokens and carry their letter; empty days are dots; today is outlined. The card is static: its accessible name summarises each week ("Week of 12 Oct: Workout B Mon, Workout A Wed"), and the list below stays the way in. The week-grouped list follows directly.
  Removed: the "6 weeks 3 · 1 · …" number row (replaced), the multi-line legend (the letters carry it), and the large "15 sessions" figure (it moves into the header line).
  Not brought back: the muscle matrix (it lives on Progress › Muscles) and the volume charts.
  Train: the 6-week grid does **not** go on Train. Train's strip is redrawn as this calendar's current-week row (the same cell component and colours, today outlined), and the whole strip becomes one button to Sessions.
- **Steps:** 1) Restore the calendar card in compact form in place of the number row (M). 2) Fold the legend and the session count into one header line (S). 3) Give the card a per-week accessible summary (S). 4) Render Train's week strip with the same cell component and make it open Sessions (S).
- **Acceptance check:** At 390 × 844 with seeded data, on Sessions:
  - a calendar with 6 week rows × 7 day cells is visible with no scroll;
  - Workout A and Workout B cells have different fills and show "A" or "B";
  - today's cell has an outline;
  - the calendar card is ≤ 300 px tall;
  - ≥ 3 Session rows are fully visible on the first screenful;
  - the page has no muscle matrix, no volume chart, no legend list, and no text "3 · 1 · 3".

  On Train, the week strip is one row of the same cells (A on Wed, B on Mon), and tapping it opens Sessions. Train shows no more than one calendar row.
- **Value/effort:** Med / M · **Refs:** operator direction (iteration 3); rubric 3.0 (content priority, visual consistency), 3.7 (weekly consistency, never a streak); Hevy history feed; Progress Dashboard Sessions calendar

#### Progress and summary

### V3-11 · Sev 2 · Design · Progress › three summary statements before the first verdict
- **Type:** Design (S)
- **Location:** `src/features/progress/Home.tsx`, `Home.css`
- **Evidence:** `shots/10-progress.png`: "11 of 14 lifts moving." (y 70), the counter row "▲11 moving ■2 stalled ▼1 slipping ↑1 ready" (y 110–165), and "12 of 14 lifts stepped up since Fri 18 Sep." (y 185). The first card starts at y≈208, and "11 moving" is stated twice.
- **Issue:** The verdict feed is the answer, and three restatements of the headline sit on top of it. All lifts already filters by status.
- **Recommendation (target design):** one line, "11 of 14 lifts moving · 12 stepped up since 18 Sep" (Guided Session's single Progress lead sentence), then the cards.
  Removed: the counter row and the separate stepped-up line.
- **Steps:** 1) Remove the counter row (S). 2) Merge the stepped-up line into the headline (S).
- **Acceptance check:** At 390 × 844, the first verdict card's top is at y ≤ 140, the text "moving" appears exactly once above the first card, and there are no counter tiles.
- **Value/effort:** Med / S · **Refs:** rubric 3.3 (duplicated information); Guided Session Progress lead

### V3-13 · Sev 1 · Design · Summary › Worked today is a 12-cell grid with 5 zeros and a legend
- **Type:** Design (S)
- **Location:** `src/ui/SessionSummary.tsx`
- **Evidence:** `shots/60b-summary-full.png`: 12 cells, 5 of them "0" (Chest, Shoulders, Triceps, Biceps, Abs on a pull day), plus a 5-item legend.
- **Issue:** Five seconds of attention, spent on muscles that weren't trained.
- **Recommendation (target design):** "Worked today: Lower back 3 · Lats 2.5 · Mid back 2 · Quads 1.5 …" as one wrapped line, in descending order of sets.
  Removed: the zero cells, the colour legend and the grid.
- **Steps:** 1) Replace the grid with the sorted non-zero line (S).
- **Acceptance check:** On the summary, no muscle shows "0", and there is no legend text "sets / session".
- **Value/effort:** Low / S · **Refs:** rubric 3.3; Apple Fitness summary
- **Status:** carry to iteration 4.

### Execution verdicts

#### 3.2 Accessibility

### V3-04 · Sev 3 · Execution · A11y › at 200 % text the Rest panel covers the Get ready card
- **Location:** `src/ui/SetScreen.tsx` / `src/ui/SetScreen.css` (rest-state layout; the compact layout is keyed to viewport height, not to the content's height)
- **Evidence:** `shots/76-200pct-rest.png`. At root 200 % and 390 × 844, log Deadlift Set 1. The card shows only "GET READY · SET 2 / 70 kg × 7". At the plate line "Add 5 per side…" (y 530), `elementFromPoint` hits `.rest-clock`, and no ancestor scrolls.
- **Recommendation:** Let the rest body scroll above a fixed dock, or switch to the compact layout when the content would overlap rather than by viewport height. V3-03's one-row dock also returns ~60 px.
- **Acceptance check:** At root 200 % at 390 × 844, and at 320 × 568 at 100 %, during Rest, `elementFromPoint` at the centre of the "Add … per side" line and of the "Last time" line returns the card (not `.rest-clock`), with at most one scroll.
- **Value/effort:** High / S · **Refs:** WCAG 1.4.4, 1.4.10; V2-02's acceptance check

### V3-10 · Sev 2 · Execution · A11y › Train cuts Exercise names and overlaps tab labels at 200 %
- **Location:** `src/features/dashboard/DashboardScreen.css` (row layout), the tab bar CSS
- **Evidence:** `shots/74-200pct-train.png`: "Assiste…", "Narr…", "Machine …"; the week strip letters crowd "2 of 3"; the tab labels run together as "ProgressSessionsProgram"; the cloud and gear icons stay 16 px.
- **Recommendation:** At large text, stack each row (name on line 1, `3 × 60 kg · 8–10` on line 2) instead of ellipsizing. Let tab labels wrap or drop to icons with names. Size the header icons in rem.
- **Acceptance check:** At root 200 % at 390 × 844, no Train Exercise name has `text-overflow` clipping (`scrollWidth ≤ clientWidth`), and no two tab-label bounding boxes intersect.
- **Value/effort:** Med / S · **Refs:** WCAG 1.4.4, 1.4.12

#### 3.3 Clutter / layout

### V3-06 · Sev 2 · Execution · Now › 4+ set cells overflow the row
- **Location:** `src/ui/SetScreen.css` (`.set-cells`, `overflow-x: auto`)
- **Evidence:** `shots/56-next-exercise.png`. On Assisted pull-ups (4 Sets), `.set-cells` has scrollWidth 382 against clientWidth 358, and cell 4's right edge is at x 398 on a 390 px viewport. "BW−19×5" is cut, with no visible scroll affordance. With Warm-ups, an Exercise reaches 6–7 cells.
- **Recommendation:** Cells share the row width (flex 1, min 56 px wide), and the value drops to two lines ("BW−19" over "×6") when narrow. V3-05 caps the count at Sets + 1.
- **Acceptance check:** At 390 × 844 and 320 × 568, on Assisted pull-ups and on Deadlift with 3 Warm-ups, `.set-cells` has scrollWidth ≤ clientWidth and every cell is fully inside the viewport.
- **Value/effort:** Med / S · **Refs:** rubric 3.2 (reflow), principles §2.4

#### 3.7 Delight / honest feedback

### V3-02 · Sev 2 · Execution · Verdict wording › "same" says nothing, and partial Exercises are compared with full ones
- **Location:** `src/domain/exerciseVerdict.ts`, `src/ui/SessionSummary.tsx` (Lift by lift)
- **Evidence:** `shots/55-exercise-done.png`: "Deadlift done · same". `shots/60b-summary-full.png`: "Deadlift · Same", and "Assisted pull-ups · Fewer reps · 6 vs 23" after 1 of 4 Sets.
- **Recommendation:** Name what stayed the same, with numbers: "same as last time · 3 × 70 × 7". When fewer Sets were logged than planned, compare only Set-for-Set ("set 1: 6 reps, same"), or show "1 of 4 sets" with no comparison. This is the same rule V2-10 applied to volume.
- **Acceptance check:** No verdict text is exactly "same" or "Same". With 1 of 4 Sets logged, the Assisted pull-ups line contains "1 of 4 sets" and no "vs 23".
- **Value/effort:** Med / S · **Refs:** rubric 3.7 (one true, specific win), §3.7 "no guilt"

#### 3.1 H4 Consistency

### V3-12 · Sev 2 · Execution · H4 › the Progress Muscles row says "Traps 2.25 · Abdominals 3"
- **Location:** `src/domain/sessionsView.ts` (muscle labels, including `{ label: 'Traps', … }`), `src/features/progress/Home.tsx` (the Muscles row line)
- **Evidence:** `shots/10b-progress-full.png`. The Muscles page uses "Abs" and lists 12 muscles, without Traps (`shots/11`). Its own footnote says traps are "counted in each lift's detail".
- **Recommendation:** Build the row from `src/domain/muscleLabels.ts` and the Muscles page's 12 muscles, and show its out-of-range verdict ("Shoulders 21 above · Abs 3 below").
- **Acceptance check:** The rendered Progress home contains no "Abdominals" and no "Traps", and the Muscles row names the same muscles the Muscles page flags as above or below.
- **Value/effort:** Low / S · **Refs:** H4; V2-13

13 verdicts, 8 Design (62 %), 5 Execution. The Top 5 holds 4 Design verdicts.

## Not checked
- DPR 3. Shots are DPR 1, and all measurements are in CSS px.
- Backgrounding, landscape, the Rest push and sound, and Reminders: not possible headless. Offline reload: dev mode has no service worker.
- The header "· 1 PR" count (V2-11 step 2): the PR toast covered the header for the whole shot window.
- Session detail and editor (V1-24) and the Exercise note (V1-15): the harness's `tap:` on a Session row didn't open it this run. The v2 after-shots stand.
- Program editor flows (reorder, Custom Exercise) were only opened, not exercised.
- **For the operator (domain rule, carried):** a heavy first Set still raises every later Set's Preset. Logging 72.5 × 10 opened Set 2 at **82.5** kg ("+12.5 kg: carried from set 1 (last 70)", `shots/54b`), and the Get ready card then says "PR if logged" about a +12.5 kg jump. Worth a look at decision 0020.
