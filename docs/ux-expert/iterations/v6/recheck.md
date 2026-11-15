# UX re-check: iteration 6, after the fixes (2026-11-15, commit eb6a089)

Reviewer: Dana Reyes (`docs/ux-expert/persona.md`). Same method as `report.md`: `scripts/ux-review/shoot.mjs` (headless Edge, touch) against this worktree's dev server on 127.0.0.1:5180, now serving the fixed code.
- Viewports: 390×844, plus 320×568 and root font 200 %.
- Data: `stats-45.json` (clock Thu 15 Oct 2026), `full-history.json` (real clock, Sun 15 Nov), and a clean profile.
- Shots: `recheck/NN-slug.png`. Before/after pairs: `compare/NN-slug.png` (before left, after right).
- Sizes are CSS px, read from the DOM, including `::before` hit areas.

## Summary

The three big problems from `report.md` are fixed.
1. **The advice reaches the bar.** Train says "Ready for 15 kg", and Now has a 44 px "Use 15 kg" that moves the Dial and every cell to 15 (`recheck/12`, `13`).
2. **One lift, one answer.** The pull-down is "↓ Lowered · Stay at 46.25 kg until all 3 sets reach 12" on the card, the Why?, the Lifts row and the Lift page. Train and Now both open at 46.25 (`02`, `03`, `05`, `14`).
3. **Past work by lift has doors.** One Lift page opens from Train, the summary, Program, Exercises › My lifts and the ⋯ sheet. Search for "squat" finds Back squat first (`30`, `33`, `35`, `36`, `37`, `41`).

Break, a short Session, logging a missed workout and Add exercise are all new and work.

The hunt found **two Sev 3 regressions**:
- **Undo after Discard brings back a broken Session.** Set 1 appears twice, the 70 kg ramp becomes 60 kg, and the Log bar asks for Set 1 again (`47`). The builders' own after shot `live/after/25` shows the same state.
- **The Stalled card's only action is a dead end.** "Swap ›" opens the raw catalog, not a swap (`04`, `07`).

Smaller contradictions remain:
- "First time · start light" sits above a 70 kg preset (`43`).
- "Finish Workout B: 6 lifts left" restarts all 7 lifts (`56`).
- Push-ups is "Ready" while its row says "−2 reps" (`20`).
- At 200 %, Program shows "Ba… sq…" (`69`).

---

## §1 Scores, before → after

| Goal | v6 before | **v6 after** | Why (evidence) |
|---|---|---|---|
| User-friendly | 7 | **7.5** | Up: "Use 15 kg" is 1 tap (`13`); the warm-up line has Add (`10`); Log a past workout takes 3 taps (`57`, `58`); Discard now has Undo (`46`). Held back: that Undo restores a corrupted Session (`47`, V6R-01). A short Session's "6 lifts left" restarts all 7 (`56`, V6R-03) |
| Accessible | 6 | **7** | Up: calendar and week-strip days have a 44×44 hit area (`::before`); Progress wraps at 200 % (`65`); editor buttons have full names ("Delete Deadlift set 1, 60 × 10"); the Deload row is 358×44. Left: at 200 % Program reads "Ba… sq…", "Lu…", "Prog…/Exer…" (`69`), and the Lift page title reads "Narrow-grip pull…" (`66`). Summary muscle chips are still 30 px tall (`32`) |
| Less crowded | 7 | **8** | Up: the dashboard is a headline, ≤ 4 cards and one Lifts list (`02`); the Lift page is one status box, a hero, one chart, Records and Sessions (`22`); the past summary says each thing once (`32`). Left: a Break gives 4 identical "Ease back in" cards plus "10 more" (`51`). The log-past editor has 46 Edit/Delete buttons (`58`) |
| Features in the right place | 5 | **7** | Up: the Lift page is ≤ 2 taps from Train, the summary, Program and My lifts. Exercises opens on My lifts (`36`). Sessions has "+" Log a past workout, and the editor has Add exercise (`57`, `59`). Left: Progress "Swap ›" is a dead end (V6R-02). Back from a Lift page opened from a summary drops the summary (V6R-05). Lift page session rows don't open their Session |
| Intuitive | 4 | **6** | Up: one status per lift everywhere, and each Why? ends with the card's own sentence (`03`, `06`). Left: "First time · start light" on a 60/70/70 preset (`43`, `73`); Push-ups "Ready" with "−2 reps" (`02`, `20`); "Eased after 34 days off" while Progress says 32 (`51`, `52`); "Rep record · 10 kg more" (`live/after/25`); Program editor "~54 min" vs Train "~70 min" (`74`) |
| Helpful / fun real-time | 7 | **8** | Up: Ready line and Use 15 kg on Now, with "+1 kg · PR if logged" (`13`); warm-up ramp visible before Set 1 (`10`); Break eases loads with a reason line (`52`, `53`); Rest names the day ("Same as Mon 12 Oct", `15`). Left: Push-ups' Ready has no hint on Train or Now (`16`, `17`) |

---

## §2 Verification of every finding

Status: **fixed** / **partly** / **open**. Shots are in `recheck/` unless a folder is named.

### V6 findings

| ID | Status | Evidence |
|---|---|---|
| V6-01 Advice at the bar | **fixed** (minor rest in V6R-09) | `12`: "Ready for 15 kg · Use 15 kg" (82×44). `13`: tap → cells 15×12, "Log set 1 · 15 × 12", "+1 kg · PR if logged". Reps stay at 12 rather than the spec's 10, and the line loses its date |
| V6-02 One lift, four answers | **fixed** for loaded lifts, **partly** for bodyweight | Pull-down: Lowered on the card, Why?, row and Lift page; Train and Now show 46.25 (`02`, `03`, `05`, `14`). Biceps: Ready on the card and the row (`02`). Push-ups: Ready on Progress, but no hint on Train (`16`) or Now (`17`), and "−2 reps" on its row and hero (`20`) |
| V6-03 Lift page doors | **fixed**, with a new Back bug (V6R-05) | Train names are 44 px buttons (`30`); summary rows are 332×44 (`33`); Program names (`35`); My lifts (`38`); ⋯ → Lift history opens a Sheet with Done (`41`); search "squat" lists Back squat first (`37`) |
| V6-04 Deload after a failed deload | **fixed** | `06`: "Try a variation for 4 weeks." Why? names "Your deload week of 21–25 Sep came back to the same reps" |
| V6-05 Time away | **fixed** (edges in V6R-08) | `50`: "Back after a break · loads eased for today", biceps 13 kg. `51`: "Last session 32 days ago · ease back in", every lift "‖ Break". `52`: "Eased after 34 days off: 55 (from 60)" |
| V6-06 Muscles link vanishes | **fixed** | `51`: "Muscles · No sets in the last 2 weeks" |
| V6-07 Hidden sentence | **fixed** | 0 `.progress-visually-hidden` / `aria-describedby` on the dashboard; the note shows on the card (`02`) |
| V6-08 Notes follow the lift | **fixed** (noise in V6R-13) | Train: "Note from Wed 7 Oct: Right elbow sore…" (`01`); the Lift page quotes it under 7 Oct (`05`) |
| V6-09 History chart lies | **fixed** | One Lift page: a step line, deload hollow inside a band, "Deload 21–25 Sep" under the axis (`22`, `41`). Label thinning in V6R-12 |
| V6-10 Swap offers bands/chains | **fixed** | `42`: 6 rows (Deficit Deadlift, Rack Pulls, … Romanian Deadlift), "Show all (23)", no band or chain entries |
| V6-11 Finishing early | **partly** | `54`: "Short session · 2 of 23 sets". `55`: "Finish Workout B: 6 lifts left". `56`: Start restarts Deadlift at Set 1, 0/23 (V6R-03) |
| V6-12 200 % truncation | **fixed on Progress**, **open elsewhere** | `65`: Progress wraps. `69`: Program "Ba… sq…". `66`: Lift page title "Narrow-grip pull…" (V6R-07) |
| V6-13 Log a missed Session / add a lift | **fixed** | `57`: "+" → "Log a past workout", date + Workout. `58`: the editor for Tue 13 Oct. `59`: Add exercise with My lifts first. Empty calendar days are still not tappable; the "+" carries it |
| V6-14 Editor kinds and names | **fixed** | `39`: "Edit · Workout B · Mon 12 Oct", "W40 × 5", full accessible names, the Deload row is 358×44 |
| V6-15 Program kg; durations | **fixed in read mode**, **open in the editor** | `35`: kg column "47.5 → 62.5", "14 ↑15", A ~70 / B ~66 as on Train. `74`: the editor still says "~54 min" (V6R-19) |
| V6-16 Warm-ups behind ⋯ | **fixed** | `10`: "Warm-up: 30×5 · 40×3 · 50×2 · Add" on Now |
| V6-17 First run | **partly** | `73`: "First time · start light" over 50 × 8 with a 42.5 kg warm-up ramp. No "Build my own" link (`71`) |
| V6-18 "· same" / "top set on" | **partly** | Now: "Last time 46.25 × 9 · Mon 12 Oct" (`14`). Summary: "3 fewer reps than Wed 7 Oct" ✓, but "+2.5 kg top set on Wed 7 Oct" is still there (`32`) |
| V6-19 Muscles units | **fixed** (one edge, V6R-15) | `70`: "3 sets/week · as planned", "21 sets/week · above 20 · plan 21" |
| V6-20 All lifts names, sparklines | **fixed** | `02`: one Lifts list; names wrap without hyphen breaks; a visible step sparkline |

### V5 findings

| ID | Status | Evidence |
|---|---|---|
| V5-01 Discard | **partly** | Confirm "Discard 1 logged set" (`45`), then "Workout discarded · Undo" (72×56, `46`). Undo restores a corrupted Session (`47`, V6R-01) |
| V5-02 Swap numbers | **fixed** (new copy clash V6R-04) | `43`: one Preset carried over, "for Deadlift · Undo swap" |
| V5-03 Progress advice | **fixed** | §6.1 statuses render verbatim (`02`, `03`, `06`) |
| V5-04 Snackbar wording | **fixed** | "Workout discarded" (`46`), "Swapped from Deadlift" (`43`) |
| V5-05 Past summary | **fixed** | `32`: "1 h 06 min · 23 sets · 2 PRs · vs Wed 7 Oct: volume −1.6 %"; no "This week" and no "Worked today" on a past Session |
| V5-06 PR inflation | **partly** | One rule now (heavier, or a better est. max). Sessions still show 1–4 PRs on almost every row (`31`), and Back squat is PR on 4 Sessions running (`22`). That is correct under the rule but still reads as inflation. Consider showing only the heaviest-weight PR in the list |
| V5-07 Ramped plan on Train | **fixed** | "4 sets · 47.5 → 62.5 kg" (`16`) |
| V5-08 Two histories | **fixed** | The same page from Progress and from ⋯ (`22`, `41`) |
| V5-09 Chart labels | **fixed** | No "No A sDeload"; no "4 weeks ago" toggle (`22`, `05`) |
| V5-10 Editor load and rest | **fixed** | `74`: "Now 47.5 kg", Rest m:ss |
| V5-11 Swap search | **fixed** | `42`: "Search exercises" with a magnifier; Close is a 44 px ×. The × has square corners and a black border (V6R-17) |
| V5-12 Calendar 36×32 | **fixed** | Visible 40×32, `::before` inset −6/−2 → 44×44 hit area (`31`) |
| V5-13 Rest PR wording | **partly** | "Last time 70 × 7 · PR at 9 reps" ✓ (`44`). "Rep record · 10 kg more than Mon 12 Oct" mixes the two (`live/after/25`, V6R-11) |
| V5-14 Train week strip | **fixed** | Per-day buttons, 36×28 visible, 44×44 hit area |
| V5-15 200 % header on Now | **partly** | `67`: the header keeps "0/23 sets" but the timer is cut, and the lift name scrolls under the header, so only "curls" shows |

---

## §3 New findings

| ID | Sev | Type | Where | What I saw (exact) | Fix |
|---|---|---|---|---|---|
| **V6R-01** | 3 | Execution | Finish › Discard › Undo (`SetScreen` / session restore) | Log Set 1 (60 × 10) → Finish → Discard → "Discard 1 logged set" → Undo. Now shows cells "1 ✓ 60×10 · **1** 60×10 · 2 **60×7** · 3 **60×7**", "GET READY · SET 1", "Log set 1 · 60 × 10" (`47`). The plan was 60×10 · 70×7 · 70×7. The builders' `live/after/25` shows the same duplicate | Undo restores the exact pre-discard Session object (sets, plan, cursor). Test: discard→undo round-trips deep-equal |
| **V6R-02** | 3 | Design | Progress card "Swap ›" (DB bench, Push-ups) | Opens Program › Exercises filtered to Chest, "Page 1 of 9": "Alternating Floor Press" (kettlebells), "Behind Head Chest Stretch". The dropdown still reads "All Muscles". Tapping a row opens the catalog detail with no "Use instead" (`04`, `07`). The card's one action can't be done | "Swap ›" opens the V6-10 swap list (6 rows, my gym, history first), titled "Replace DB bench press in Workout A". The choice replaces the Plan's Exercise, with Undo |
| **V6R-03** | 2 | Design | Train after a short Session | "Finish Workout B: 6 lifts left from Thu 15 Oct", yet the list shows all 7 lifts and "~66 min" (`55`). Start opens Deadlift Set 1, "0/23 sets" (`56`) | List and start only the 6 untouched lifts (Deadlift greyed "done Thu"), ~N min for those. Or say "Start Workout B again" |
| **V6R-04** | 2 | Execution | Now, a lift with no history | After a swap to Romanian Deadlift: "First time · start light", while cells read 60×10 · 70×7 · 70×7 and the deadlift warm-ups stay (`43`). Clean profile: "First time · start light" over 50 × 8 with a ramp to 42.5 (`73`) | When the lift is new, the Preset is empty (or the swapped lift's ~60 %) and the line reads "First time · pick a weight you can do for 10". Drop the inherited warm-up line |
| **V6R-05** | 2 | Execution | Lift page Back from a Session summary | Sessions › Mon 12 Oct › Deadlift → Lift page → ‹ Back lands on the Sessions list, and the summary is gone (`33` → `34`) | Back returns to the summary Sheet it came from |
| **V6R-06** | 2 | Design | Push-ups (bodyweight Ready) | Card "↑ Ready · Add load or a harder variation." Lifts row "BW × 15 · −2 reps" (`02`). Hero "Wed 14 Oct · −2 reps"; the chart plots failure sets (17 F) as tops, a 15↔17 sawtooth (`20`). Train "3 × BW · 10–15" with no hint (`16`); Now has no Ready line (`17`) | Exclude failure/AMRAP sets from the top-set series and the 4-week delta (same `straightSets` as the status). On Train/Now: "↑ Ready · add 2.5 kg or swap" |
| **V6R-07** | 2 | Execution | 200 % text | Program table "Ba… sq…", "Lu…", "DB be…"; segmented control "Prog… / Exer…" (`69`). Lift page title "Narrow-grip pull…" (`66`). Train note clamped to "Right elbow…" (`64`) | Program at large text stacks the row (name full line, numbers below). Titles wrap to 2 lines. The note is not clamped (or clamps at 3 lines with "more") |
| **V6R-08** | 2 | Design | Break | Now "Eased after **34** days off: 55 (from 60)" vs Progress "Last session **32** days ago" (`52`, `51`). Assisted pull-ups stay BW−19 and Hyper-extension BW+5, not eased (`50`). 14 Break cards collapse to 4 identical "Ease back in: … next time." plus "10 more in Lifts" (`51`) | One number: the days since the last Session ("32 days off"). Ease assisted lifts by adding assistance, and BW+ lifts by dropping the plate. When every lift is Break, show one card: "Back after 32 days · every load eased ~10 % for one session" |
| **V6R-09** | 1 | Execution | Now after "Use 15 kg" | Reps stay 12 (spec: × lo = 10); the line becomes "Last time 14 × 12 · +1 kg · PR if logged" and loses "Mon 12 Oct" (`13`) | Set reps to the range bottom (10); keep the date |
| **V6R-10** | 1 | Execution | Session summary | "Deadlift … +2.5 kg top set on Wed 7 Oct" (`32`) | "+2.5 kg on the top set vs Wed 7 Oct" |
| **V6R-11** | 1 | Execution | Rest PR line | "PR · Rep record · 10 kg more than Mon 12 Oct" for 70×8 vs 60×10 (`live/after/25`) | A heavier set is "Heaviest at 8 reps"; "Rep record" only names reps ("1 more than …") |
| **V6R-12** | 1 | Execution | Lift page chart and records | Back squat's three 60 kg points (7, 9, 10 reps) show only "9", hiding the climb that makes it "Moving" (`22`). Push-ups "15" labels sit on their dots (`20`). Records: "Best est. max" appears on Back squat and DB bench, but not on Pull-down or Biceps (`05`, `23`). Session rows are not buttons (spec: open the Session) | Label every point; offset labels 6 px above the dot. Always 3 record rows. Rows open the summary |
| **V6R-13** | 1 | Design | Lift page Sessions log | The Session note "Left shoulder a bit tight on bench." shows under Back squat, Lunges and Push-ups for 30 Sep (`22`, `20`, `38`) | Show the note only on lifts it names; otherwise prefix it "Session note:" in muted text |
| **V6R-14** | 1 | Design | Train rows | Lift names are 44 px buttons that look like plain text (color #16161D, no chevron, cursor default). Only the name opens the page: "Deadlift" is 54×44, and the weights on the right do nothing (`30`) | Make the whole row the button, with a quiet "›" |
| **V6R-15** | 1 | Execution | Muscles page | "Abs 3 sets/week · as planned" but "Shoulders 21 sets/week · above 20 · plan 21" (`70`) | When done = plan, write "as planned (above the typical 10–20)" |
| **V6R-16** | 1 | Design | Log a past workout | The date defaults to 14 Oct, which already has Workout A (`57`). Picking B pre-fills all 23 Sets as if done, at today's Presets (`58`). No note when the day already has a Session, or when B would follow B | Default to the most recent empty day. Pre-fill the cells as placeholders, so a set counts only when tapped or "Mark all done". Warn "Mon 12 Oct already has Workout B" |
| **V6R-17** | 1 | Execution | Swap | Two messages at once: "for Deadlift · Undo swap" and the snackbar "Swapped from Deadlift" (`43`). The swap sheet's × is square with a 2 px black border, unlike every other Close (`42`) | Drop the snackbar (the line carries it). Use the radius token on × |
| **V6R-18** | 1 | Execution | Summary muscle chips | 30 px tall ("Abs, 2 sets" 36×30) (`32`) | 44 px hit area via `::before`, as on the calendar |
| **V6R-19** | 1 | Execution | Program editor | "Workout 1 · 23 sets · ~54 min" vs Program and Train "~70 min" (`74`) | Use the shared duration function |
| **V6R-20** | 1 | Design | Now, Lowered lift | Pull-down cells open at 46.25 × 9·8·8, below the 10–12 range, with no echo of "until all 3 sets reach 12" (`14`) | A quiet target line: "Aim: 10+ on every set at 46.25" |

20 findings: 2 Sev 3, 6 Sev 2, 12 Sev 1.

---

## §4 Iteration 7: prioritised list

1. **Undo after Discard restores the exact Session** (V6R-01). Add a regression test that round-trips discard → undo. *S, must-fix.*
2. **Progress "Swap ›" becomes a real swap** in the Plan, reusing the V6-10 list, with Undo (V6R-02). *M.*
3. **Short Session resumes the lifts left** (V6R-03). *S.*
4. **A new lift starts empty, not from the replaced one's numbers** (V6R-04, V6-17 rest). Also add a "Build my own" link on first run. *S.*
5. **Bodyweight Ready end to end:** straight sets only for the top-set series and the delta; a Ready hint on Train and Now (V6R-06). *S.*
6. **Navigation stack:** Lift page Back returns to the summary; Lift page session rows open their Session; whole Train rows are tappable with "›" (V6R-05, V6R-12 rows, V6R-14). *S.*
7. **200 % pass on Program, Lift page title, Train note and Now header** (V6R-07, V5-15). *S.*
8. **Break polish:** one day count; ease assisted and BW+ lifts; one card when everything is Break (V6R-08). *S.*
9. **Log a past workout safety:** an empty-day default, placeholder Sets, a same-day warning (V6R-16). *S.*
10. **Copy and consistency pass:** "Use 15 kg" sets reps to 10 and keeps the date (V6R-09); "vs Wed 7 Oct" (V6R-10); Rest "Heaviest at 8 reps" (V6R-11); Muscles "as planned" for above too (V6R-15); one duration in the editor (V6R-19); the Lowered aim line (V6R-20). *S.*
11. **Lift page chart:** every point labelled, labels clear of the dots, always 3 records, Session notes scoped (V6R-12, V6R-13). *S.*
12. **Small targets and visual leftovers:** summary chips 44 px, swap × radius, a single swap message (V6R-17, V6R-18). *S.*
13. **PR density in the Sessions list** (V5-06): show at most the heaviest-weight PR per row, or a count only when > 0 under a "real record" filter. Needs an owner ruling. *S.*

## Not checked
- Offline, reload-resume and the Rest push: unchanged and not re-walked.
- Hevy/Strong import and CSV export.
- Workers/sync (`/api/*`): dev mode only.
