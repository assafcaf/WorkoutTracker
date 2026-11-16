# UX re-check: iteration 7, before the PR (2026-11-16, commit 3855d5f)

Reviewer: Dana Reyes (`docs/ux-expert/persona.md`). The build is the full "Ledger & Instrument" rebuild
(`study.md`) plus the new Home (`home/home.md`).

**Method.** `scripts/ux-review/shoot.mjs` drove headless Edge (touch) against the worktree's dev server
on 127.0.0.1:5192.
- Data: `stats-45.json` at four clocks: Fri 16 Oct 07:40 (training day), Thu 15 Oct 18:05 (rest day),
  Wed 14 Oct 19:20 (just finished) and Mon 9 Nov 07:40 (26 days off). Also `full-history.json` (real
  clock, Mon 16 Nov) and a clean profile.
- Viewports: 390×844, 320×568, and root font 200 %, plus reduced motion.
- Sizes are CSS px read from the DOM, including `::before` hit areas. A script checked the WCAG
  contrast of every text node on 9 screens.
- Shots are in `recheck/NN-slug.png`.

## Summary

This is the best-looking and calmest build so far.
- Home answers "what am I doing today?" in one glance, with one ring, 14 lines, a grid and one row
  (`01`–`05`). It has almost no text.
- The rest screen leads with a 236 px ring and a "Next" panel that names the plates (`12`).
- A PR now says what it beat ("Heaviest weight · 72.5 × 7 · 2.5 kg more than Mon 12 Oct", `15`), and
  a rep best is one quiet green line (`19`).
- Progress is a ledger of 14 rows, and decisions moved to Program.
- Every text node passes contrast on all 9 screens checked.

Four v6 bugs are fixed:
- Discard → Undo restores the Session intact, with no duplicate Set (`22`, `23`; V6R-01).
- Program's Swap opens a real swap with Undo (`46`–`48`; V6R-02).
- A short Session is followed by "Workout B again" (`37`; V6R-03).
- Back from a Lift page returns to the summary (`54`; V6R-05).

The rebuild created a new class of problem: **the new surfaces state numbers that the older surfaces
don't keep.**
- The workout page promises curls at 15 kg, but Start opens them at 14 kg.
- Home says Wednesday beat Friday on 5 of 7 lifts, while that Session's summary says 6 of 7.
- Home says 26 days off, and the workout page says 28.
- Home says 23 sets, and Sessions and the summary say 24.

A lifter who notices one of these stops trusting all of them. They are the must-fix list.

---

## §1 Scores

v6 is the after-score from `docs/ux-expert/iterations/v6/recheck.md`. The 7th goal's v6 baseline
is scored from `build/*/before/` and `iterations/v6/recheck/`.

| Goal | v6 | **v7** | Why (evidence) |
|---|---|---|---|
| User-friendly | 7.5 | **8** | **Up:** Start is one tap from launch on every state (`01`–`04`). Discard → Undo round-trips (`23`). Swap and Undo swap work live and from Program (`27`, `28`, `47`, `48`). Delete → Undo works (`58`). **Held back:** the workout page's "3×15 kg" starts as 14 × 12 (`06`, `31`, V7R-01). Log a past workout still defaults to a day that already has a Session (`60`) |
| Accessible | 7 | **7** | **Up:** 0 contrast failures on 9 screens. Home's 14 sparklines are 46×44 buttons named "Narrow-grip pull-down: lowered". The rest controls are 56–88 px. Reduced motion has no running animations. **Down/left:** at 320 the new Home's Lifts block wraps to 5 + 2 lines with an orphaned "›" (`70`). At 200 % "this week" spills over the ring (`78`). Program truncates names at the **default** size: "Machine should…", "Narrow-grip pull-do…" (`45`). "Prog… / Exer…" and the Lift page title still clip at 200 % (`83`, `84`). The screen-reader status says "Set 4 logged" for set 1 (V7R-05) |
| Less crowded | 8 | **8.5** | **Up:** Home has four blocks and about 25 words (`01`). Rest has one panel (`12`). Progress is one row per lift with no cards (`40`). The summary reads as a verdict and a ledger (`52`). **Left:** All exercises shows "Volume vs last workout: 0%" under all 7 lifts (`29`). The session editor still has 46 Edit/Delete buttons (`55`). After a lift's last set, the "DEADLIFT DONE" card pushes the reps-left row under the dock (`17`). A live Session on Home shows three resume controls (`88`) |
| Features in the right place | 7 | **8** | **Up:** decisions live on Program, with working Swap buttons (`45`). Home is a glance and the workout page is one tap away (`06`). A Lift page opens from every door: Home sparkline, Progress, summary, Program (decision and table), My lifts and ⋯ Lift history (`41`, `42`, `49`, `50`, `53`, `62`, `63`). Back returns to where you came from (`43`, `54`). **Left:** the Session note still shows on lifts it doesn't name (`50`, V6R-13) |
| Intuitive | 6 | **6.5** | **Up:** the PR / rep best split reads right at the bar (`15`, `19`). "Workout B again · last one was cut short" (`37`). **Down:** four new number contradictions between the new and the old surfaces (V7R-01 to V7R-04). The curls chart puts "PR 18.7" below today's 19.6 (`32`, V7R-09). Push-ups is "↑ Ready" with "−1" on Progress (`40`), "↓ −3 reps … Push-ups dipped" on the summary (`52`), and a sawtooth line (V6R-06 still open). "First time · start light" sits over a 60 × 10 preset after a swap (`27`) |
| Helpful / fun real-time | 8 | **8.5** | **Up:** "Add 5 per side → 20 + 5" and "Same plates: 25 + 1.25" (`12`, `15`). The PR line names the gain, and the gold tag sits on the cell (`15`). The rep best is "↑ Rep best · 70 × 8 · 1 more than Mon 12 Oct" (`19`). "Eased after 28 days off: 55 (from 60)" (`66`). **Held back:** "Ready for 15 kg · Use 15 kg" is a fix-it-yourself step for a promise the page already made (`31`) |
| **Visual design / design language** (new) | **5** | **8** | **v6 (`foundations/before/01`, `02`, `07`):** a generic purple accent on buttons, status and links alike. Floating cards with competing headers on Progress. The set numbers sat in the bottom third under a 280 px hole, and the PR showed as amber text. **v7:** ink is the only action colour; blue means *now*, green *better*, rust *lower* and gold *a record*. The A/B hues are the calendar's alone. Numerals are tabular and large (`07`, `12`). Home is calm and pictorial (`01`). **Held back:** Program mixes the paper ledger ("Needs a decision") with white bordered cards for the tables and the muscle map (`45`). "Use 15 kg" and the rest dock's "Log set 2 · 70 × 7" are bare text with no affordance, beside an outlined "Skip rest" (`12`, `31`). There is still a ~150 px empty band above the Dials on the set screen (`07`, `31`) |

---

## §2 Verification of the open v6 findings

| ID | Status | Evidence |
|---|---|---|
| V6R-01 Discard → Undo corrupts | **fixed** | Log 60×10, 70×8 → Finish → Discard → "Discard 2 logged sets" → Undo shows cells 60×10 ✓ · 70×8 ✓ · 70×7 planned, with no duplicate (`21`–`23`) |
| V6R-02 Stalled "Swap ›" dead end | **fixed** (new issue V7R-11) | Program › "Swap DB bench press" → "Replace DB bench press in Workout A", 6 rows plus "Show all (66)" → the Plan changes, with "… replaces DB bench press in Workout A · Undo" (`46`–`48`) |
| V6R-03 "6 lifts left" restarts all | **fixed** | "Workout B again · last one was cut short on Fri 16 Oct" (`37`) |
| V6R-04 "First time · start light" over a preset | **open** | After the swap to Romanian Deadlift: "First time · start light" over 60 × 10, with the Deadlift warm-ups "30–50" still there (`27`). New user: 10 × 8 (`87`) |
| V6R-05 Back from Lift drops the summary | **fixed** | Summary › Back squat › Back returns to the Wed 14 Oct summary (`53`, `54`) |
| V6R-06 Push-ups Ready vs −2 reps | **open** | Progress "↑ Ready · 15 reps −1" with a sawtooth line (`40`). Lift page "↓ −1 rep since 24 Jul" (`44`). Summary "↓ −3 reps", counting the 17 F failure set (`52`). No hint on the Workout A page (`91`) |
| V6R-07 200 % truncation | **open, and worse** | Now at 390 and default text: "Machine should…", "Narrow-grip pull-do…" (`45`). At 200 %: "Prog… / Exer…" and a clipped Lift title (`83`, `84`) |
| V6R-08 Break: one number, eased BW lifts | **open** | Home "26 days off" vs the workout page and Set screen "28 days off" (`03`, `65`, `66`; V7R-03). Assisted pull-ups stay BW−19 and Hyper-extension BW+5 (`65`). Progress on a break: "0 of 14 lifts are moving. Back squat has had 33 days off. Lunges has had 33 days off. DB bench press has had 33 days off." (full-history; V7R-14) |
| V6R-09 "Use 15 kg" | **superseded** by V7R-01 | |
| V6R-10 "top set on" | **open** | Rest card: "60×10 · 72.5×7 PR · 72.5×8 PR · +2.5 kg top set on Mon 12 Oct" (`17`). The summary itself is fixed ("↑ +2.5 kg", `35`) |
| V6R-11 "Rep record · 10 kg more" | **fixed** | "Heaviest weight · 72.5 × 7 · 2.5 kg more than Mon 12 Oct" (`15`); "↑ Rep best · 70 × 8 · 1 more than Mon 12 Oct" (`19`) |
| V6R-12 Chart labels and records | **partly** | Records still differ by lift: Deadlift and Back squat have "Best est. strength", but curls and pull-down don't (`32`, `42`). Session rows are now 350×52–90 buttons. The chart hit columns are 12–30 px wide (17 per chart) |
| V6R-13 Note on unrelated lifts | **open** | "Right elbow sore on pull-downs" appears under Machine row and Deadlift (`50`, `41`) |
| V6R-14 Train rows look like text | **fixed** | Workout-page rows are 219–269×44 buttons |
| V6R-16 Log past default date | **open** | The date defaults to 2026-10-14, which already has Workout A, and every Set is pre-filled as done, including the 5×12 drop set (`60`) |
| V6R-17 Swap double message | **open** | "for Deadlift · Undo swap" and the snackbar "Swapped from Deadlift" appear together (`27`) |
| V6R-18 Summary muscle chips 30 px | **fixed** (removed) | |
| V6R-20 Lowered lift target | **open** | Pull-down: "Set 1 of 3 · target 10–12" over 46.25 × 9 · 8 · 8, with no "aim" line (`33`) |

---

## §3 New findings

Severity: 3 breaks trust or a flow, 2 confuses or blocks some users, 1 is polish.

| ID | Sev | Type | Where | What I saw (exact) | Fix |
|---|---|---|---|---|---|
| **V7R-01** | 3 | Trust | Workout page → Start (curls) | Home: "↑ Curls up to 15 kg" (`01`). Workout page: "Seated biceps curls · ↑ was 14 kg · **3×15** kg" (`06`). Program: "14 ↑15" (`45`). After Start, All shows "14×12 · 14×12 · 14×12" (`29`), and the curls Set screen opens at **14** × 12, "Ready for 15 kg · Use 15 kg", "Log set 1 · 14 × 12" (`31`). The v6 Train said "3 × 14 kg · Ready for 15 kg" (`foundations/before/01`), so the 15 is a new promise that the Session doesn't keep | The Preset is the promise: when the workout page shows 15, the Session's curls Presets are 15 × 10 (the bottom of the range), and the Set screen says "Up from 14 kg" in place of "Use 15 kg". Otherwise the page shows "3×14 · ↑ Ready for 15". Test: `workoutPage(lift).kg === sessionPreset(lift).kg` for every lift |
| **V7R-02** | 3 | Trust | Home "Last time" vs the Session summary | Home (`01`, `04`): "Wed 14 Oct · ↑ 5 of 7 · 4 PR". The summary of the same Session (`52`): "**6 of 7** lifts beat Friday … Lateral raises 7×10 · 10 · 9 · 5×12 **↑ +12 reps**". Fri 9 Oct was 7×10·10·9 and Wed 14 was the same plus a **drop set** (`kind: drop`, 5×12). The summary counts drop-set reps as progress | One `sessionMoves()` for both. Drop, failure and warm-up Sets never count toward "beat". Lateral raises reads "= same" |
| **V7R-03** | 2 | Trust | Break, Home vs workout page | Home: "26 days off · loads eased 10 % for today", "Wed 14 Oct · 26 days ago" (`03`). One tap later, the workout page: "Back after **28** days off: loads eased 10 %" (`65`), and the Set screen: "Eased after 28 days off: 55 (from 60)" (`66`). Home counts from the last Session; the workout page counts from the last Workout B | One number: days since the last Session, on every surface |
| **V7R-04** | 2 | Trust | Set counts for one Session | Home (d): "Workout A · 71 min · **23** sets" (`04`). Sessions row: "71 min · **24** sets · 4,185 kg" (`51`). Summary: "**24** sets · 4,185 kg · 44 bodyweight reps · 2 warm-ups not counted" (`52`). The 24th is the drop set | One count. Either drop sets count everywhere ("24 sets") or nowhere ("23 sets + 1 drop") |
| **V7R-05** | 2 | Trust (screen reader) | Set screen live region | Add warm-ups → log all 3 → Log set 1. The `role="status"` text is "**Set 4** logged · 60 kg × 10". Set 2 is announced as "Set 5 logged · 72.5 kg × 7" (`p.set-logged`, read from the DOM after `11`, `12`, `15`). Without warm-ups it's correct ("Set 1 logged") | Number working Sets by their `setIndex` among working Sets; warm-ups announce "Warm-up 2 of 3 logged" |
| **V7R-06** | 2 | Trust | All exercises, before any Set | Every lift reads "Volume vs last workout: **0%**" at 0/3 sets (`29`; also on Workout A and on a Break, `67`). 0 % says "same as last time" when nothing is done | Hide the line until the lift has a logged Set, then compare like for like ("−42 % so far", or "2 of 3 sets · on pace") |
| **V7R-07** | 2 | Layout | Home at 320×568 | The Lifts header wraps "↑ 12 of 14 moving" and leaves "›" on its own line. The A and B rows wrap to 5 + 2 sparklines, and the B chip floats under the first line. Sessions is entirely below the fold (`70`) | At < 360 px make the sparklines 36 px wide (7 × 36 + chip fits 280), or scroll the row horizontally. Keep "›" inline |
| **V7R-08** | 2 | Accessibility | Home at 200 % text | "2/3 this week" overflows the 112 px ring, and "this week" crosses the arc (`78`) | Size the ring's centre text in px (as the hero numerals are), or drop "this week" from the ring and keep it in the accessible name |
| **V7R-09** | 2 | Intuitive | Lift page chart, curls | The hero is "19.6 kg ↑ +5.9 since 27 Jul". The gold "PR 18.7" ring sits on 2 Oct, **below** the 12 Oct point (19.6), which is not marked (`32`). The 12 Oct 14×12 beat the e1RM, but records list no "Best est. strength" | Either 12 Oct is the PR (a rep record that beat the 1RM, per `asPr`) and the ring moves there, or the label reads "Heaviest 14 kg". Always show the same 3 record rows |
| **V7R-10** | 2 | Layout | Program at default size | "Machine should…" and "Narrow-grip pull-do…" in the Workout tables at 390 px (`45`); 12 clipped names at 320 (`76`) | Let the name column wrap (2 lines), or stack the numbers under the name below 400 px |
| **V7R-11** | 2 | Design | Program → Swap DB bench press | The first alternative is "Bent-Arm Dumbbell Pullover", a lats/pullover movement. Choosing it puts "Bent-Arm Dumbbell Pullover 4 × 8–10 · **0**" kg in the plan, and Lats goes from 19 to "22 · above 20" (`46`, `47`) | Rank by same primary muscle and pattern (press): Neutral-grip DB bench, Incline DB press first. Carry a starting weight (~80 % of the old lift's), never 0 |
| **V7R-12** | 2 | Crowding | Rest after a lift's last set | "NEXT · SET 1 BW−19×6" plus the "DEADLIFT DONE · 2 PR · Add set · 60×10 · 72.5×7 PR · 72.5×8 PR · +2.5 kg top set on Mon 12 Oct" card push "Set 3: reps left 0 1 2 3+" under the dock at 390×844 (`17`). That set's effort can't be logged without scrolling | Collapse the done card to one line ("Deadlift done · 2 PR ›"), and keep the reps-left row above the fold |
| **V7R-13** | 2 | Intuitive | The PR count on one lift in one Session | 72.5×7 then 72.5×8 in the same Session give "DEADLIFT DONE · **2 PR**" (`17`). The second PR beats only a Set from 3 minutes earlier, so the lift's PR count grows as one Session goes on | A lift earns at most one PR per Session: its best Set against earlier Sessions |
| **V7R-14** | 2 | Tone | Progress on a Break (full-history) | "0 of 14 lifts are moving", then "Back squat has had 33 days off. Lunges has had 33 days off. DB bench press has had 33 days off. 11 more lifts below." Home says "As you left them" | One sentence: "Back after 33 days · your lines are where you left them." Hide the "n of 14 moving" verdict on a Break |
| **V7R-15** | 1 | Visual | Rest dock and the advice line | "Log set 2 · 70 × 7" is bare text beside an outlined "Skip rest" (`12`), so the action you'll take next looks like a caption. "Use 15 kg" is bold text with no box (`31`) | Give both the outline (secondary) button style |
| **V7R-16** | 1 | Crowding | Home during a live Session | Three resume controls: the strip's "Return", the panel's "Resume Upper" and the dock's "Resume" (`88`) | Keep the strip and the dock. The panel shows the Session's progress ("DB bench press · set 1 of 4") instead of a third button |
| **V7R-17** | 1 | Copy | Home (d) after a 1-Set Session | "0 min · **1 sets**" | "1 set" |
| **V7R-18** | 1 | Consistency | "12 weeks" start date | Progress: "SINCE 23 JUL · 12 WEEKS". Lift pages: "since 27 Jul" (Deadlift), "since 24 Jul" (Back squat). Chart axes start "17 Jul" and "15 Jul" (`40`, `41`, `53`) | One window start, shown once |
| **V7R-19** | 1 | Visual | Home sparklines | Each line is scaled to its own min/max. "DB bench press: flat" draws a deep V (`01`), and curls' single 14 → 15 step draws a cliff. The picture says "volatile" where the dot says "flat" | Use a shared relative scale (±% of the 12-week start), or clamp the y-range to at least ±5 % |
| **V7R-20** | 1 | Consistency | Workout page status marks | Curls get "↑ was 14 kg" in green, but the Lowered pull-down (46.25) and the Stalled DB bench have no mark (`06`, `91`). Home shows the pull-down's rust dot one screen earlier | A quiet "↓ eased" or "= hold" under those rows |
| **V7R-21** | 1 | Copy | Set screen header | "Set 1 of 3 · target 8–10" over a preset of 70 × 7 for sets 2–3 (`07`). Pull-down "target 10–12" over 46.25 × 9 · 8 · 8 (`33`) | When the preset is under target: "target 8–10 · last time 7" |
| **V7R-22** | 1 | Crowding | Swap sheet | Six identical outlined "Do this instead" buttons (`26`, `46`) | Make the row the button, with a quiet "›" |
| **V7R-23** | 1 | Accessibility | Small targets | Program/Exercises segmented control 106×30 (`45`). "Edit" 38×44. Tools-sheet "Warm-up / Notes" 175×42 (`25`). Settings reminder day chips 32–47×26, and the "How to set it up" link 105×18 (`64`). Sessions calendar days 34×44 at 320 (`77`) | 44 px via `::before`, as the calendar has at 390 |
| **V7R-24** | 1 | Layout | Warm-up cell after a Break | "27.5–\n45" wraps inside the W cell (`66`) | Show "W 3" (the count) when the range doesn't fit |
| **V7R-25** | 1 | Spec drift | New-user plan picker | Two plans (A/B Split, Upper/Lower). The spec's three, with "Full body starter" preselected, aren't there. The dock reads "Start Workout A" before a plan is picked (`05`) | Ship the third bundled plan, or update `home.md`. Have the dock name the plan ("Start A/B Split") |
| **V7R-26** | 1 | Consistency | Sync state | "Not synced · Retry" shows on the workout page (`06`), not on Home. The amber dot on the gear on a Break (`03`) has an accessible name ("A backup is due") but no visible meaning | Home shows the same quiet sync line. The dot gets a one-word label in Settings ("Backup due") |

26 new findings: 2 Sev 3, 12 Sev 2, 12 Sev 1. 10 v6 findings are still open.

---

## §4 Must fix before the PR (Sev 3 and trust bugs)

These six make two surfaces disagree about the same fact, or misreport what was logged.

1. **V7R-01: curls promised at 15, started at 14.**
   - Repro: `stats-45`, `--now 2026-10-16T07:40+03:00`. Home reads "↑ Curls up to 15 kg".
   - Tap the Today panel. The workout page reads "Seated biceps curls 3×15 kg".
   - Tap Start Workout B, then All. Curls read 14×12 ×3. Tap curls set 1: "14 × 12 · Ready for 15 kg · Use 15 kg".
2. **V7R-02: "5 of 7" on Home, "6 of 7" on the summary.**
   - Repro: `stats-45`, Home reads "Wed 14 Oct · ↑ 5 of 7 · 4 PR".
   - Sessions › Wed 14 Oct reads "6 of 7 lifts beat Friday", with Lateral raises "↑ +12 reps" from its 5×12 drop set.
3. **V7R-03: 26 vs 28 days off.**
   - Repro: `stats-45`, `--now 2026-11-09T07:40+02:00`. Home reads "26 days off".
   - Tap the panel. The workout page reads "Back after 28 days off". Start reads "Eased after 28 days off".
4. **V7R-04: 23 vs 24 sets for one Session.**
   - Repro: `stats-45`, `--now 2026-10-14T19:20+03:00`. Home reads "71 min · 23 sets".
   - Sessions › Wed 14 Oct reads "24 sets"; the summary's totals line reads "24 sets".
5. **V7R-05: the screen reader announces the wrong set.**
   - Repro: Start Workout B, tap the W cell (Add warm-ups), log 3 warm-ups (Skip rest after each), then Log set 1.
   - `p.set-logged[role=status]` reads "Set 4 logged · 60 kg × 10".
6. **V7R-06: "Volume vs last workout: 0%" before any Set.**
   - Repro: Start any workout and tap All. All 7 lifts read "0%" at 0/3.

## §5 Later (next iteration), in order

1. V7R-07 and V7R-08: the new Home at 320 px and at 200 %.
2. V7R-10 and V6R-07: Program name truncation, now visible at the default size.
3. V7R-09 and V6R-12: one PR marker and one set of record rows on every Lift page.
4. V6R-06: Push-ups. Exclude failure Sets from deltas, and say "Ready" in one voice.
5. V7R-11: swap ranking and a non-zero starting weight. V6R-04: the first-time preset and warm-ups after a swap.
6. V7R-12 and V7R-13: the done card hides the effort row, and a lift gets one PR per Session.
7. V7R-14 and V6R-08: Break copy and eased bodyweight lifts.
8. V7R-15: give "Use 15 kg" and the rest dock's Log a button affordance (most of "Use 15 kg" goes away with V7R-01).
9. V6R-13 (notes under unrelated lifts), V6R-16 (log-past default), V6R-17 (double swap message), V6R-10 ("top set on").
10. The Sev 1 polish: V7R-16 to V7R-26.

The full-res shots for every row are in `recheck/`.
