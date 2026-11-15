# UX review: iteration 6 (2026-11-15, commit d6b2b96)

Reviewer: Dana Reyes (`docs/ux-expert/persona.md`). I drove the app with `scripts/ux-review/shoot.mjs` (headless Edge, touch on) against this worktree's dev server (127.0.0.1:5180). Viewports: 390×844, plus 320×568 and root font 200 %. Data:
- `stats-45.json`, with the clock pinned to Thu 15 Oct 2026;
- `full-history.json` on the real clock (Sun 15 Nov), which means 34 days since the last Session;
- a clean profile.

All cited shots are in `walk/`. Sizes come from `eval:` on the DOM, in CSS px.

## Summary

The owner had to find the last four problems himself. So this round starts from what a lifter needs (§1), and then hunts for gaps against that list. The set loop is still the best part of the app. Around it, the gaps fall into three new problems.

1. **The app's advice never reaches the bar.**
   - Train and Progress both say "try 15 kg" for Seated biceps curls.
   - The live Set screen opens at 14 × 12 and says "Last time 14 × 12 · same" (`walk/59`).
   - The lifter has to remember the advice and dial it in by hand.
2. **One lift gets four answers.** For Narrow-grip pull-down:
   - Train prescribes 46.25 kg.
   - Now opens at 46.25 × 9.
   - The Progress card says "Consider a lighter week".
   - Its Why? says "Back to 47.5 kg × 10" (`walk/01`, `walk/58`, `walk/13`).
3. **Past work by Exercise can't be reached outside a live Session.**
   - Lift history is only in the Set screen's ⋯ sheet.
   - Rows on Train, the Sessions summary and Program are not tappable.
   - The Exercises tab doesn't list the lifter's own 14 lifts: a search for "squat" returns "Barbell Full Squat"… but not "Back squat" (`walk/34`).

The app also ignores time away. After 34 days off it says "12 of 14 lifts moving". It still says "Ready … on 12 Oct · Try 15 kg next", and Train prescribes the same loads (`walk/16`, `walk/17`).

**Keep:**
- the 1-tap Log set bar with its value;
- "Add 5 per side → 20 + 5";
- "PR at 8 reps" on Rest;
- out-of-order Exercises from All (`walk/57`);
- the Discard confirm "Discard 1 logged set" (`walk/52`);
- the Muscles page;
- the calendar.

---

## §1 What a lifter needs

These are the jobs the owner has asked for across v1–v5, plus what any serious lifter expects:
- v1–v2: log fast, see the next set while resting;
- v3: the calendar picture, a landing view that makes sense;
- v5: calendar tap-through, easy delete, a history graph, a Progress that explains itself.

| # | Job | What "great" looks like | Best benchmark |
|---|---|---|---|
| J1 | **Plan**: know what today is | One screen: today's Workout, each lift's real weight × reps (ramps shown as ramps), how long it takes, Start. Anything due today is already in those numbers, including "add weight" and "ease back after a break". | **Fitbod** (generated "today" with loads); Hevy (routine card → Start) |
| J2 | **Train**: log under fatigue | 1 tap per Set. The next Set and its plates are visible during Rest. Warm-ups are visible before Set 1. The Preset already holds today's change. A notice says why the weight changed and whether this Set would be a PR. | **Strong** (set rows, auto-rest, previous column) |
| J3 | **Recover from mistakes** | Every destructive action (delete Set, delete Session, discard, swap, finish early) has Undo or a confirm that names what is lost. A past Session can be fixed fully: add a Set, an Exercise, or a whole missed Session. | **Hevy** (edit any past workout, add exercises); Apple (Undo everywhere) |
| J4 | **Find past work** | From any place a lift's name appears, one tap opens that lift's history. Sessions can be found by date (calendar) and by lift ("when did I last deadlift 70?"). | **Strong** (exercise → History/Charts/Records tabs, reachable from everywhere) |
| J5 | **Understand progress** | One answer per lift: "going up / flat / down / ready for more". One chart in the lifter's own units (weight × reps). Records that mean something. Each verdict explains itself in one sentence that never contradicts the card. | **Strong** (e1RM + best-set charts, Records); Apple Fitness (calm trends, plain "why") |
| J6 | **Adjust the plan** | Change sets, reps, rest and **the working weight** of a lift outside a Session. Act on a Progress verdict in 1 tap ("Use 15 kg next time"). Swap a lift for one the gym actually has. | **Hevy** (routine editor with weights); Fitbod (one-tap swap filtered by equipment) |
| J7 | **Trust the numbers** | A PR is rare and real. Totals have units. The same value is the same everywhere (durations, statuses, next weights). Time off, deloads and lowered loads are named for what they are, never as failure. | **Strong** (PRs only on true records); Apple (honest rings, no guilt) |

---

## §2 Scores per goal (before this iteration's fixes)

| Goal | v5 | **v6** | Evidence | What would raise it |
|---|---|---|---|---|
| User-friendly | 7 | **7** | The set loop is still 1 tap per Set (`walk/04`, `walk/05`). Discard asks first (`walk/52`). But Discard has no Undo, and with nothing logged "Finish workout" is still the primary (`walk/50`) | Undo on Discard; advice applied at the bar (V6-01) |
| Accessible | 6 | **6** | Calendar cells are 36×32 (`walk/20`). Muscle chips on the summary are 30 px tall (`walk/21`). The Deload toggle is 44×26 (`walk/22`). At 200 %, Progress cuts the lift name to "Narrow-…" and the title to "Progre…" (`walk/72`) | 44 px cells and chips; names wrap, never truncate (V6-12) |
| Less crowded | 7 | **7** | Now and Rest are calm. The past summary still says each PR 3 times (`walk/21`). The lift page stacks a status box, hero, three captions, two charts, a toggle row, "4 weeks ago", Next, e1RM and Bests (`walk/12`) | The single Lift page of §6 |
| Features in the right place | 6 | **5** | Lift history is reachable only mid-Session (`walk/06`). The Exercises tab doesn't hold the lifter's own lifts (`walk/34`). The Muscles link disappears after 2 weeks off (`walk/16`) | Lift page from every lift name; "My lifts" first in Exercises (V6-03) |
| Intuitive | 5 | **4** | One lift gets four answers (V6-02). The best explanation on the dashboard is screen-reader-only (V6-07). After a month off, "12 of 14 lifts moving" (`walk/16`) | §6 status rules, one source for card, list, Why?, Train and Now |
| Helpful / fun real-time | 8 | **7** | Rest and "PR at 8 reps" are still good (`walk/05`). But Now ignores the step-up that Train and Progress both promise: "Last time 14 × 12 · same" (`walk/59`). The note "Right elbow sore on pull-downs" never shows at the pull-down (`walk/58`) | Show the step-up and the last note on Now (V6-01, V6-08) |

---

## §3 Jobs-to-be-done walk

| Job | Works end to end? | Friction | Shot |
|---|---|---|---|
| J1 Plan today | partly | Train rows are not tappable. "Change" swaps A↔B silently, even though A was done yesterday. Ramped lifts read "4 × 47.5 kg". Durations disagree: B is ~66 min on Train, ~53 min on Program. After 34 days off, nothing changes | `01`, `03`, `30`, `17` |
| J2 Train | yes | 1 tap per Set; Rest shows the next Set and plates. Warm-ups hide behind ⋯ → Add warm-ups. The step-up isn't applied or shown. "· same" is ambiguous | `04`, `05`, `06`, `59` |
| J3 Recover: discard, delete, swap | partly | Discard confirms but has no Undo (`53`). Swap offers "Deadlift with Chains" (`55`). Editing a past Session can't add an Exercise. A forgotten Session can't be logged after the fact | `52`, `53`, `22`, `55` |
| J3 Recover: finish early | partly | 2 of 23 Sets counts as "This week 3 of 3 · next up Workout A". The 6 untouched B lifts drop out of the rotation | `54` |
| J4 Find past work by date | yes | Calendar day → that Session (36×32 cells) | `20`, `21` |
| J4 Find past work by lift | **no** | No path outside a live Session. Exercises search doesn't find "Back squat" or the program's "Deadlift" | `32`, `33`, `34` |
| J5 Understand progress | **no** | Wrong statuses: Push-ups "Stalled" at 15/15/15 on 10–15; pull-down "Slipping" after a lowered load. Advice and Why? contradict. Two charts disagree. "No A sDeload". The Muscles link vanishes | `10`, `13`, `12b`, `18`, `19`, `16` |
| J6 Adjust the plan | partly | The editor shows a grey placeholder "50" for load, Rest in seconds, and Assisted pull-ups "Load BW−27" while the lifter does BW−19. No way to set next time's weight. No 1-tap action from Progress | `31` |
| J7 Trust the numbers | **no** | 3–7 PRs on every Session (`20`). PR on every Lift history row (`07`). "12 of 14 moving" after a month off. The Lift history chart dips on a PR day (70 × 7 → est. max 86.3, below 90) | `07`, `16`, `20` |

---

## §4 Re-check of v5 findings

| ID | Was | Now | Status | Evidence |
|---|---|---|---|---|
| V5-01 Discard | Sev 1 | Sev 2 | **partly** (being built) | Confirm: "Discard 1 logged set" (`52`). No Undo afterwards (`53`). With nothing logged, "Finish workout" is still primary (`50`) |
| V5-02 Swap numbers | Sev 1 | — | not re-walked (being built) | Swap sheet only (`55`); see V6-10 for the list's content |
| V5-03 Progress advice | Sev 1 | Sev 1 | **not fixed** | `10`, `13`, `18`, `19`; respecified in §6 |
| V5-04 Snackbar dots | Sev 2 | — | not re-walked (being built) | — |
| V5-05 Past summary | Sev 2 | Sev 2 | **not fixed** (being built) | "Worked today: Lats 12.5…", "This week 1 of 3", "6,815 kg · 56 bodyweight reps" on a past Session (`21`) |
| V5-06 PR inflation | Sev 2 | Sev 2 | **not fixed** (being built) | 3–7 PRs per Session row (`20`); PR on every Lift history row (`07`) |
| V5-07 Ramped plan on Train | Sev 2 | Sev 2 | **not fixed** (being built) | "Back squat 4 × 47.5 kg" (`03`, `63`) |
| V5-08 Two histories | Sev 2 | Sev 2 | **not fixed** | `07` vs `12`; §6 Lift page |
| V5-09 Chart labels | Sev 2 | Sev 2 | **not fixed** | "No A sDeload" (`12b`). "4 weeks ago" overprints the pull-down line (`19b`) |
| V5-10 Editor load and rest | Sev 2 | Sev 2 | **not fixed** (being built) | Placeholder "50", "Rest (s) 180", "Load BW−27" (`31`) |
| V5-11 Swap search | Sev 3 | Sev 3 | **not fixed** (being built) | Blank card at the top, "Close" as small text (`55`) |
| V5-12 Calendar 36×32 | Sev 3 | Sev 3 | **not fixed** (being built) | DOM: 36×32 (`20`) |
| V5-13 Rest PR wording | Sev 3 | — | not re-walked | — |
| V5-14 Train week strip | Sev 3 | Sev 3 | **not fixed** | The strip is one 358×63 button that opens Sessions, not the day (`02`) |
| V5-15 200 % header | Sev 3 | Sev 3 | not re-walked on Now; the same truncation on Progress | `72` (see V6-12) |

---

## §5 Findings

Ranked by how much a lifter loses. Ten of the 20 are Design (50 %).

### V6-01 · Sev 3 · Design · Train/Progress › Now: the advice never reaches the bar
- **Type:** Design (M)
- **Location:** `src/ui/SetScreen.tsx`, `src/features/dashboard/trainCard.ts`, `src/domain/stats/verdict.ts` (`nextStep`)
- **Evidence:**
  - `walk/01`: Train, Seated biceps curls: "↑ step up · try 15 kg".
  - `walk/10`: Progress: "Try 15 kg next".
  - `walk/59`: Start B → All → Seated biceps curls. Now opens at **14 × 12**, "Last time 14 × 12 · same", "Log set 1 · 14 × 12". The step-up appears nowhere on the screen where the lifter acts.
  - The same holds for DB bench: Progress says "Try a deload: 12 kg", and Now opens at 13 × 9 (`walk/59b`).
- **Issue:** The app works out the right next step, then leaves the lifter to remember it and dial it in, mid-workout, with chalk on their hands. Strong and Hevy put the target in the set row itself, and Fitbod puts it into the prescription.
- **Recommendation (target design):** Every lift has one `next` value (§6). On Now, when `next` differs from the Preset, one line replaces "Last time … · same":

      ↑ Ready for 15 kg · last time 14 × 12, 12, 12     [Use 15 kg]

  The chip is 44 px tall. One tap moves the weight Dial to 15 and fills the later Sets' cells. Removed: the trailing word "same".
- **Steps:**
  1. Export `liftStatus().next` from the domain (S).
  2. Add the Now line and chip in `SetScreen` (S).
  3. Train's row hint reads from the same value (S).
- **Acceptance check:** On stats-45, Start B → Seated biceps curls: Now shows "Ready for 15 kg" and a "Use 15 kg" control ≥ 44 px. Tapping it makes the Log bar read "Log set 1 · 15 × 12".
- **Value/effort:** High / M · **Refs:** 3.6 progression cues; Strong set rows

### V6-02 · Sev 3 · Design · Whole app: one lift, four answers
- **Type:** Design (M)
- **Location:** `src/domain/stats/copy.ts` (`homeCopy`, `stallSuggestion`, `LIGHTER`), `verdict.ts`, `src/features/progress/Home.tsx`, `AllLifts.tsx`, `LiftPage.tsx`, `trainCard.ts`
- **Evidence:** Narrow-grip pull-down gets a different answer on each screen.

  | Where | What it says | Shot |
  |---|---|---|
  | Train | "3 × 46.25 kg" | `walk/01` |
  | Now | "46.25 × 9" | `walk/58` |
  | Progress card | "▼ Slipping · Consider a lighter week or a variation" | `walk/10` |
  | Card's Why? | "Back to 47.5 kg × 10 to stop slipping." | `walk/13` |

  Seated biceps curls is "↑ Ready" on the dashboard and "▲ Moving" in All lifts (`walk/11`). The card list is keyed by `exerciseId + kind`, so a lift can be stalled and ready at the same time.
- **Issue:** The lifter can't act on advice that disagrees with itself. This is the owner's "Progress why contradicts" complaint, and it reaches beyond Progress.
- **Recommendation:** One pure function, `liftStatus(history, plan, records, now)` → `{ kind, label, evidence, action, why[], next }`. The card, the list row, the Lift page, the Why?, Train's hint and Now's line (V6-01) all render from it and from nothing else. The exact rules and copy are in §6.
- **Steps:**
  1. The domain function, with tests for the 5 lifts in §6.4 (M).
  2. Wire the dashboard and the list (S).
  3. Wire the Lift page, Train and Now (S).
- **Acceptance check:** For every lift in stats-45, the label and action on the card, the list row and the Lift page are string-equal, and the Lift page's "Next" equals Train's weight hint.
- **Value/effort:** High / M

### V6-03 · Sev 3 · Design · Navigation: past work by lift has no door
- **Type:** Design (L)
- **Location:**
  - `src/features/dashboard/DashboardView.tsx` (rows)
  - `src/ui/SessionSummary.tsx` (Lift by lift rows)
  - `src/ui/ProgramPage.tsx` (rows)
  - `src/features/exercises/ExercisesFeature.tsx` and `src/ui/LibraryList.tsx`
  - `src/ui/ExerciseHistoryOverlay.tsx`
- **Evidence:**
  - Train rows are not buttons. The only tap targets are sync, settings, the week strip, Change and Start (DOM tally, `walk/01`).
  - Summary rows are not buttons (`walk/21`). Program rows are not buttons (`walk/30`).
  - Lift history opens only from the live Set screen's ⋯ sheet (`walk/06` → `walk/07`).
  - Exercises shows 880 catalog entries, "Page 1 of 88". Searching "squat" shows "Barbell Full Squat, Barbell Hack Squat…" but not the lifter's **Back squat** (`walk/34`). Searching "deadlift" opens "Axle Deadlift" (`walk/33`).
- **Issue:** "When did I last deadlift 70?" means starting a fake workout. The owner asked for a history graph; it exists, but behind a door that only opens at the gym.
- **Recommendation (target design):**
  - Every lift name in Train rows, summary rows, Program rows and Progress opens **the Lift page** (§6.3), pushed over the current tab.
  - The Exercises tab opens on **My lifts**, the 14 Program Exercises with their latest top set ("Back squat · 62.5 kg × 8"). Under it: "All exercises (876)", search-first. This borrows the Progress Dashboard mock's S6b "Lifts" chips row.
- **Steps:**
  1. A `openLift(exerciseId)` route (S).
  2. Make the Train, Summary and Program rows buttons ≥ 44 px (S each).
  3. The My lifts section in Exercises (M).
  4. Point the ⋯ sheet's "Lift history" at the same page (S).
- **Acceptance check:** From Train, Sessions › any summary, Program and Exercises, the Back squat Lift page is ≤ 2 taps away. Exercises search for "squat" lists "Back squat" first.
- **Value/effort:** High / L · **Refs:** Strong exercise detail; mock S6b

### V6-04 · Sev 2 · Execution · Progress: "Try a deload" after a deload already failed
- **Type:** Execution (S)
- **Location:** `src/domain/stats/copy.ts` `stallSuggestion`
- **Evidence:** `walk/13`. DB bench press has been at 13 kg × 9·8·8·7 since 7 Aug. The deload week of 21–25 Sep (11 kg) came back to the same 13 × 9·8·8·7. The card still says "Try a deload: 12 kg for one session". Its own Why? ends "A record needs 13 kg × 10, or more weight."
- **Issue:** The app repeats a fix that its own data shows didn't work. The Why? then points the other way (heavier).
- **Recommendation:** The Stalled rule in §6.1. If a deload falls inside the stall, the action is "Try a variation for 4 weeks", with a Swap link. Otherwise it is "Deload once: 12 kg × 10, then back to 13 kg". The Why? ends with the same action.
- **Acceptance check:** In stats-45, the DB bench card reads "Try a variation for 4 weeks", and its Why? names "deload week 21–25 Sep".
- **Value/effort:** Med / S

### V6-05 · Sev 2 · Design · Progress and Train ignore time away
- **Type:** Design (M)
- **Location:** `verdict.ts`, `copy.ts` (`homeCopy`), `trainCard.ts`
- **Evidence:** `walk/16`, `walk/17` (full-history, 15 Nov, last Session 12 Oct).
  - Progress says "12 of 14 lifts moving · 0 stepped up since 19 Oct".
  - Biceps says "↑ Ready · on 12 Oct · Try 15 kg next".
  - Train says "last done Mon 12 Oct", with the same loads as a month ago.
- **Issue:** After 5 weeks off, every lifter comes back weaker. The app calls them "moving" and loads the bar as if nothing happened. That is the most likely moment to fail a Set and lose trust.
- **Recommendation:** Add a **Break** status (§6.1: no Session of the lift for ≥ 21 days). The dashboard headline becomes "Last session 34 days ago · ease back in". Train's subtitle reads "34 days since your last session · loads eased for today". Each row shows the eased weight from `deloadWeight`, the same rule as a Deload. The eased loads apply to one Session only.
- **Acceptance check:** On full-history at 15 Nov, no lift is "Moving" or "Ready". The headline contains "34 days". Train shows eased loads, and the Seated biceps curls row shows 12.5 kg, not 14.
- **Value/effort:** Med / M

### V6-06 · Sev 2 · Execution · Progress: the Muscles link vanishes
- **Type:** Execution (S)
- **Location:** `src/features/progress/Home.tsx` `musclesFinding` (returns `null` when the 2-week window is empty, and the row is not rendered)
- **Evidence:** `walk/16`: the full-history dashboard has no Muscles row at all, so the Muscles page can't be reached.
- **Recommendation:** Always render the row. With no Sets in the window, the subline reads "No sets in the last 2 weeks".
- **Acceptance check:** On full-history, Progress shows "Muscles" and it opens the Muscles page.
- **Value/effort:** Med / S

### V6-07 · Sev 2 · Execution · Progress: the best sentence is screen-reader-only
- **Type:** Execution (S)
- **Location:** `Home.tsx:210` (`progress-visually-hidden` paragraph, `aria-describedby`)
- **Evidence:** The DOM text of `walk/10` has "Slipping, 46.25 kg × 9 on Mon 12 Oct, below 47.5 kg × 10 on Mon 28 Sep, after 'Right elbow sore…'". Sighted users see only "▼ Slipping · Consider a lighter week or a variation".
- **Issue:** The one line that explains *why* (the elbow) is hidden from everyone who can see.
- **Recommendation:** Delete the hidden paragraph. The visible evidence line and Why? (§6.1) carry the note, and VoiceOver reads the visible card.
- **Acceptance check:** No `.progress-visually-hidden` text on the dashboard. The pull-down card visibly shows "Right elbow sore".
- **Value/effort:** Med / S

### V6-08 · Sev 2 · Design · Notes don't follow the lift
- **Type:** Design (S)
- **Location:** `src/features/dashboard/DashboardView.tsx`, `src/ui/SetScreen.tsx`
- **Evidence:** The 7 Oct Session note "Right elbow sore on pull-downs, dropped the weight." does not appear on Train for the next B (`walk/01`), or at the pull-down on Now (`walk/58`). Only Exercise notes ("Elbows 45°") show on Now (`walk/59b`).
- **Issue:** The lifter wrote that note for their future self at that lift. Next time it isn't there.
- **Recommendation:** Train shows the latest Session note of *this Workout* under the date, as one muted line: "Note from Wed 7 Oct: Right elbow sore on pull-downs, dropped the weight." The Lift page's session log shows each Session's note under its row. Nothing is added to Now. The Exercise note stays the at-the-bar channel.
- **Acceptance check:** On stats-45 with Workout B, Train shows "Note from Wed 7 Oct". The pull-down Lift page shows the note under 7 Oct.
- **Value/effort:** Med / S

### V6-09 · Sev 2 · Execution · Lift history chart lies on PR day and on deloads
- **Type:** Execution (M; folded into §6.3)
- **Location:** `src/ui/ExerciseHistoryOverlay.tsx`, `src/ui/charts/TrendChart.tsx`
- **Evidence:** `walk/07`, Deadlift.
  - The line drops to the last point (est. max 86.3) on the day of a real heaviest-weight PR (70 × 7). Best is 90.
  - The 23 Sep deload is a deep solid dip, with no hollow mark and no band.
  - Each row ends with a detached "W" that belongs to the leading "40×5", and every row has a PR pill.
- **Recommendation:** Replace it with the §6.3 Lift page.
- **Acceptance check:** As in §6.3.
- **Value/effort:** Med / M

### V6-10 · Sev 2 · Execution · Swap offers what the gym doesn't have
- **Type:** Execution (S)
- **Location:** `src/ui/AlternativesList.tsx`, `src/features/overlays/AlternativesOverlay.tsx`
- **Evidence:** `walk/55`. "Alternatives to Deadlift": Deadlift with Bands, Deadlift with Chains, Deficit Deadlift, Rack Pull with Bands, Reverse Band Deadlift… The lifter's own Hyper-extension is 9th, as "Hyperextensions (Back Extensions)". There is no Romanian deadlift.
- **Issue:** When the platform is taken, the lifter needs a sensible substitute in 2 taps, not a list to scroll through.
- **Recommendation:** Filter by "My gym's equipment" (setting exists). Rank lifts with history first, then the same primary muscle and equipment. Cap the list at 6, then "Search all".
- **Acceptance check:** Deadlift's list has no band or chain entries. A lift the lifter has logged appears first.
- **Value/effort:** Med / S

### V6-11 · Sev 2 · Design · Finishing early counts as a full Session
- **Type:** Design (S)
- **Location:** `src/ui/SessionSummary.tsx`, `src/domain/stats/weeks.ts` (`thisWeek`), the next-Workout rule
- **Evidence:** `walk/54`. 2 of 23 Sets → "This week 3 of 3 · next up Workout A". Train then offers A (`walk/54`, top of the DOM text). The 6 B lifts the lifter never touched won't come back for a week.
- **Recommendation:** If fewer than half the planned Sets are logged:
  - the summary line reads "Short session · 2 of 23 sets";
  - Train keeps the same Workout next, with the subtitle "Finish Workout B: 6 lifts left from Thu 15 Oct";
  - the week count still counts it (honest, no guilt).
- **Acceptance check:** After logging 2 Sets of B and finishing, Train shows "Start Workout B".
- **Value/effort:** Med / S

### V6-12 · Sev 2 · Execution · 200 % text truncates lift names on Progress
- **Type:** Execution (S)
- **Location:** `src/features/progress/Home.css` (card header `text-overflow: ellipsis`), page header
- **Evidence:** `walk/72`: "Narrow-…", "Progre…".
- **Recommendation:** The card name wraps to 2 lines, and the status drops below it at large text. The page title wraps too.
- **Acceptance check:** At root 200 %, "Narrow-grip pull-down" is fully visible.
- **Value/effort:** Med / S · **Refs:** WCAG 1.4.4

### V6-13 · Sev 2 · Design · Sessions: no way to log a missed Session or add a lift to one
- **Type:** Design (M)
- **Location:** `src/features/sessions/SessionsScreen.tsx`, `src/ui/SessionEditor.tsx`
- **Evidence:** `walk/20`: no add control. `walk/22`: the editor has "Add set" per Exercise only. There is no "Add exercise".
- **Issue:** Forgetting the phone, or doing an extra lift and logging it later, happens to every lifter. Without this, the data and every Progress verdict are wrong.
- **Recommendation:**
  - Tapping an empty past calendar day opens a Sheet: "Log a workout on Tue 13 Oct", with the Workout choice → the Session editor, empty.
  - The editor gets "Add exercise" (the same Exercise list as live "Add exercise") below the last block.
  - Removed: nothing. This is the one add the jobs list requires; there is no element to merge it into.
- **Acceptance check:** From Sessions, a Session dated on a past empty day can be created in ≤ 4 taps. An Exercise can be added to an existing Session.
- **Value/effort:** Med / M · **Refs:** Hevy "log past workout"

### V6-14 · Sev 2 · Execution · Session editor hides Set kind and names
- **Type:** Execution (S)
- **Location:** `src/ui/SessionEditor.tsx`
- **Evidence:** `walk/22`:
  - the Warm-up 40 × 5 shows as a plain Set;
  - there are seven buttons named "Delete set 1", with no Exercise in the name;
  - the Deload toggle is 44×26;
  - two headings are stacked: "Sessions / Workout B".
- **Recommendation:**
  - Prefix warm-ups with "W" in muted text.
  - Accessible names: "Delete Deadlift set 1, 40 × 5".
  - Make the toggle row the 44 px target.
  - Show one header: "Edit · Workout B · Mon 12 Oct".
- **Acceptance check:** Visible "W 40 × 5". No duplicate accessible names.
- **Value/effort:** Low / S

### V6-15 · Sev 2 · Design · Program read mode shows no weights; durations disagree
- **Type:** Design (S)
- **Location:** `src/ui/ProgramPage.tsx`, the duration estimate shared with `trainCard.ts`
- **Evidence:** `walk/30`: Program has Sets × reps and Rest, but no kg; Workout B is "~53 min". Train shows B as "~66 min" (`walk/01`).
- **Recommendation:**
  - Add a kg column with the next Preset (from `liftStatus().next`), as in mock S7a.
  - Use one duration function. Train's, which uses logged history, wins.
  - Rows open the Lift page (V6-03).
- **Acceptance check:** Program and Train show the same minutes for B. The Back squat row shows "47.5 → 62.5".
- **Value/effort:** Med / S

### V6-16 · Sev 2 · Design · Warm-ups hide behind ⋯
- **Type:** Design (S)
- **Location:** `src/ui/SetScreen.tsx`
- **Evidence:** `walk/04`: Deadlift Set 1 shows only working cells. The ramp (30×5, 40×3, 50×2) is two taps away, under ⋯ → Warm-up, and needs "Add warm-ups" (`walk/06`).
- **Recommendation:** For the first barbell lift of a Session with no warm-ups logged, Now shows one line above the cells: "Warm-up: 30×5 · 40×3 · 50×2 [Add]". It disappears after Add or after the first working Set.
- **Acceptance check:** Start B: the warm-up line is visible on Now without opening a Sheet.
- **Value/effort:** Med / S

### V6-17 · Sev 2 · Design · First run: a novice gets 50 kg squats with no question
- **Type:** Design (S)
- **Location:** `src/ui/NoProgram.tsx`, `src/ui/SetScreen.tsx`
- **Evidence:**
  - `walk/60`: two Programs, "Use A/B Split". No "start an empty workout" or "build my own" (the third Program file, full-body starter, is not offered).
  - `walk/63`, `walk/64`: Back squat opens "Log set 1 · 50 × 8" with nothing saying it's a guess.
- **Recommendation:**
  - For a lift with no history, Now's last-time line reads "First time · start light: pick a weight you can do for 10".
  - Add a quiet "Build my own" link under the Program cards that opens the Program editor.
- **Acceptance check:** On a clean profile, the first Set screen says "First time".
- **Value/effort:** Med / S

### V6-18 · Sev 1 · Execution · "· same" and "top set on Wed 7 Oct" are ambiguous
- **Location:** `src/ui/SetScreen.tsx`, `src/ui/SessionSummary.tsx`
- **Evidence:**
  - "Last time 46.25 × 9 · same" (`walk/58`): same as what?
  - The summary line "+2.5 kg top set on Wed 7 Oct" and "3 reps under Wed 7 Oct" (`walk/21`).
- **Recommendation:**
  - "Last time 46.25 × 9 · Mon 12 Oct". Cut "same".
  - "+2.5 kg on the top set vs Wed 7 Oct".
  - "3 fewer reps than Wed 7 Oct".
- **Value/effort:** Med / S

### V6-19 · Sev 1 · Execution · Muscles counts have no unit; planned lows are flagged
- **Location:** `src/features/progress/MusclesPage.tsx`
- **Evidence:** `walk/14`. The "2 weeks" tab shows "Shoulders 21 · above 20". The reader can't tell whether that is per week or over the 2 weeks. "Abs 3 · below 10 · plan 3" warns about a value the plan set.
- **Recommendation:** "21 sets/week". When done equals plan and the plan itself is below 10, write "3 · as planned", not "below 10".
- **Value/effort:** Low / S

### V6-20 · Sev 1 · Execution · All lifts: broken names and invisible sparklines
- **Location:** `src/features/progress/AllLifts.tsx` (replaced by the §6.2 Lifts list)
- **Evidence:** `walk/11`: "Cable push-/down", "Hyper-/extension". The sparklines are about 1 px, pale grey, with gaps.
- **Recommendation:** In §6.2.
- **Value/effort:** Low / S

20 verdicts: 10 Design (50 %), 10 Execution.

---

## §6 Progress: rebuild spec

This corrects the in-flight Progress implementation. **One rule:** every status word, action sentence, Why? line and Next value comes from one function, `liftStatus()` (new, in `src/domain/stats/status.ts`, replacing the card logic in `copy.ts` `homeCopy` and `verdictOf`'s display use). No screen writes its own advice string.

### 6.1 Status rules

**Inputs (per lift):**
- the non-deload Sessions, from `LiftHistory.points`;
- the Plan (`sets`, `repRange [lo, hi]`);
- the Exercise's weight step;
- records under the V5-06 definition (heaviest weight or best est. max);
- Session notes;
- `now`.

**Terms used below:**
- *Load*: the top-set lever.
- *Straight sets*: as in `straightSets` (failure, drop and AMRAP Sets excluded).

**Evaluate in this order; the first match wins.** Each lift has exactly one status everywhere.

| # | Status (label) | Trigger | Card evidence line | Action sentence (card, list, Lift page, Why? last line) | Next value |
|---|---|---|---|---|---|
| 1 | **Too new** `○` | < 4 non-deload Sessions | `{top} · {n} of 4 sessions` | `Log {4−n} more sessions for a verdict.` | the Preset |
| 2 | **Break** `‖` | last Session of this lift ≥ 21 days before `now` | `Last done {date} · {d} days ago` | `Ease back in: {deloadWeight(load)} kg next time.` | `deloadWeight(load)` × hi |
| 3 | **Ready** `↑` | (a) every straight set of the last Session at the load reached ≥ hi, **or** (b) the first straight set reached ≥ hi in each of the last 3 Sessions at the same load. Reps *above* the range always land here. Exception: (a) with every set at RIR 0 → status **Hold** (row 3b) | `{load} × {reps of each set} on {date}` | loaded lift: `Next time: {load + step} kg.` · bodyweight lift at BW: `Next time: BW+{step} kg.` · assisted: `Next time: BW−{assist − step}.` | load + step (× lo) |
| 3b | **Hold** `=` | (a) of Ready, with every set at RIR 0 | same as Ready | `Next time: {load} again, with a rep to spare.` | load |
| 4 | **Lowered** `↓` | the load is below the highest load of the previous 6 Sessions, and the drop came from a lower *load* the lifter chose (a lever change between two non-deload Sessions), not from reps falling at the same load. **A lowered load is never Slipping** | `{load} × {top reps} · down from {prev load} on {date of drop}` + `· note: "{first 6 words}…"` when that Session has a note | `Stay at {load} until all {sets} sets reach {hi}.` | load |
| 5 | **Slipping** `▼` | at the **same load** as the best of Sessions n−6…n−3, the top-set reps of the last 2 Sessions are both below that best's reps | `{load} × {reps} · was × {best reps} on {date}` | `Next time: stay at {load} and aim for {best reps}.` | load × best reps |
| 6 | **Stalled** `■` | no record and no gain in total straight reps at the load in the last 4 non-deload Sessions | `{top} · no new best since {date}` | deload **not** inside the stall: `Deload once: {deloadWeight} × {hi}, then back to {load}.` · deload inside the stall: `Try a variation for 4 weeks.` (with a `Swap ›` link) | deloadWeight, or load |
| 7 | **Moving** `▲` | anything else: a record, a load step-up, or more straight reps at the load within the last 4 Sessions | `{top} · {up {step} kg / +{r} reps} on {date}` | `Next time: {load} × {top reps + 1}.` (capped at hi; at hi → Ready) | load |

Rules that hold across all statuses:
- **One status per lift.** The list is keyed by `exerciseId` only.
- **Deload Sessions** are never a trigger. They show only as a band on the chart.
- **Next** is the value V6-01 offers on Now. Train's hint shows `↑ 15 kg` for Ready, `↓ eased` for Break, and nothing otherwise.

**Why? text: exact templates.** Line 1 is the rule in plain words. Lines 2–5 are the last 4 Sessions as `{Wed 7 Oct} · {load} × {r1}·{r2}·{r3}`. The last line is the action sentence above, identical. Line 1 by status:

| Status | Why? line 1 |
|---|---|
| Ready (a) | `All {sets} sets reached {hi}, the top of your {lo}–{hi} range, on {date}. When every set hits the top, the next step is more weight.` |
| Ready (b) | `Your first set reached {hi} or more, the top of your {lo}–{hi} range, in each of your last 3 sessions. Reps above the range mean the weight is too light.` |
| Hold | `All sets reached the top, but every set ended with 0 reps left. Repeat the weight until one set has a rep to spare.` |
| Lowered | `You lowered the weight from {prev} to {load} on {date}{, with the note "{full note}"}. A lower weight you chose is not a loss. When all {sets} sets reach {hi} at {load}, the app moves you back up to {prev}.` |
| Slipping | `At {load} you did {best reps} on {date}. The last 2 sessions at the same weight were lower: {r}, then {r}. Two sessions below your best at the same weight is a slip. If the next one is lower again, this becomes Stalled.` |
| Stalled (no deload) | `No new best and no extra reps at {load} in your last 4 sessions. One lighter session usually lets the next one move.` |
| Stalled (deload inside) | `No new best at {load} since {date}. Your deload week of {range} came back to the same reps, so another deload is unlikely to help. A new best needs {load} × {best+1}.` |
| Moving | `{Up {step} kg / {r} more reps} vs {prev date}. Moving means a heavier weight or more reps at the same weight in your last 4 sessions.` |
| Break | `You last did this lift {d} days ago. After a break, start about 10 % lighter for one session, then return to {load}.` |
| Too new | `A verdict needs 4 sessions of this lift. You have {n}.` |

### 6.2 Dashboard, top to bottom

    Progress                                Thu 15 Oct
    This week 2 of 3 sessions · 4 lifts need a decision      ← headline (one line)
    ┌ Narrow-grip pull-down                    ↓ Lowered ┐
    │ 46.25 kg × 9 · down from 47.5 kg on Wed 7 Oct ·   │
    │ note: "Right elbow sore on pull-downs, dropped…"  │
    │ Stay at 46.25 kg until all 3 sets reach 12. Why?› │
    └───────────────────────────────────────────────────┘
    [Push-ups ↑ Ready] [DB bench press ■ Stalled] [Seated biceps curls ↑ Ready]
    LIFTS                                   4 weeks
    Workout A
      Back squat      ▲ Moving   ╱‾‾  62.5 kg × 8   +5 kg
      …
    Workout B
      …
    Last week 5–11 Oct   Sessions 3 · Sets 69 · Volume 15,908 kg
    Muscles  ›  Shoulders above the typical range (21 sets/week)
    Body     ›  Log your bodyweight

1. **Headline:** `This week {done} of {planned} sessions · {k} lifts need a decision`, or `… · every lift on track` when k = 0. When any lift is Break: `Last session {d} days ago · ease back in`. Removed: "11 of 14 lifts moving · 12 stepped up since 18 Sep".
2. **Needs a decision:** cards for Ready, Hold, Lowered, Slipping, Stalled and Break, ordered Break > Slipping > Stalled > Lowered > Ready > Hold. Show at most 4, then a quiet row "{m} more in Lifts".
   - Each card: name (wraps, never truncates), status label, evidence line, action sentence, Why? disclosure (a 44 px target).
   - Tapping the card body opens the Lift page.
   - Removed: the per-card 44×24 sparkline, and the hidden `aria-describedby` sentence (V6-07).
3. **Lifts:** every Program lift, grouped by Workout in Plan order.
   - Row (≥ 56 px): name (wraps, no hyphen breaks: `hyphens: manual`), status label, a 96×28 sparkline of top-set **weight** over 3 months in `--text-primary` at 2 px, the latest top set, and the 4-week weight change (`+5 kg`, `same`, `−1.25 kg`).
   - Tap → Lift page.
   - This list **replaces the All lifts page and its filter chips** (cut `AllLifts.tsx` as a route).
4. **Last week:** Sessions, Sets, Volume, with the same layout as today. Cut the "PRs" row until V5-06 ships, then show it under the new definition.
5. **Muscles row:** always rendered (V6-06). The subline names the one most-off muscle with a unit: `Shoulders above the typical range (21 sets/week)`, or `All within 10–20 sets a week`, or `No sets in the last 2 weeks`.
6. **Body row:** unchanged.

### 6.3 One Lift page

This replaces both `src/features/progress/LiftPage.tsx` and `src/ui/ExerciseHistoryOverlay.tsx`. Entry points:
- dashboard cards and Lifts rows;
- Train rows;
- the live ⋯ sheet "Lift history";
- Session summary lift rows;
- Program rows;
- Exercises › My lifts.

From the live Session it opens as a full-height Sheet with "Done". Everywhere else it is a pushed page with ‹ Back.

    ‹  Back squat
    ▲ Moving
    Next time: 62.5 kg × 9.                         Why? ›
    62.5 kg × 8                       ← hero, latest top set
    Wed 14 Oct · up 2.5 kg
    [ Weight | Est. max ]          [ 3M | 1Y | All ]
    ┌ chart ───────────────────────────────────────┐
    │ 62.5 ┤                               ●8 ●7   │
    │ 60   ┤                     ●7 ●9 ●10         │
    │ 57.5 ┤ ●8 ●6 ●9 ●8 ●9 ●10                    │
    │ 52.5 ┤               ○ ○                     │
    └──────┴───────────────────────────────────────┘
      19 Aug        7 Sep   ▒Deload 21–25 Sep▒   15 Oct
    RECORDS
      Heaviest set        62.5 kg × 8     Wed 14 Oct
      Best est. max       80 kg           Fri 9 Oct
      Most reps at 62.5   8               Wed 14 Oct
    SESSIONS
      Wed 14 Oct   47.5×10 · 57.5×9 · 62.5×8 PR · 62.5×7
                   W 20×10 · 37.5×5
      Fri 9 Oct    45×10 · 55×10 · 60×10 · 60×10
                   "Left shoulder a bit tight on bench."   (note, when present)
      Show all 22 sessions
    Est. max ≈ weight × (1 + reps ÷ 30), from your best working set.

- **Status block:** label, action sentence and Why? come from `liftStatus` (§6.1), verbatim. Removed: "Workout A · 4 × 8–10 · 4 records in the last 4 sessions".
- **Hero:** the latest top set at 48 px. One subline: `{date} · {move}`, where move is "up 2.5 kg", "+2 reps", "same", "down from 47.5 kg" or "deload". Removed: "Latest top set ·", the "Warm-ups 20 × 10 · 37.5 × 5 · not counted" line, and "Stepped up to 62.5 kg · +2.5 kg · record".
- **Chart:**
  - Default tab **Weight**: one point per non-deload Session at the top-set weight, joined as a step line. Each point carries its top-set reps as a 12 px label above it. A record point is filled accent; others are filled `--text-primary`.
  - Tab **Est. max**: the e1RM line, Epley, with the same points. Record points are filled. The y-axis label is "est. max, kg".
  - Range tabs: 3M (default), 1Y, All. A tab's range uses the actual dates; never a "Step" tab.
  - **Deload Sessions** are hollow points, not joined to the line, inside a shaded band. **Gaps** (no Session of this Workout for ≥ 10 days) are a dashed segment with no label.
  - **Captions live in one lane under the x-axis, never inside the plot.** Each caption is placed at its band's centre. When two captions' boxes overlap, keep the Deload caption, drop the other, and never draw both.
  - This fixes the Back squat collision **"No A sDeload"** (`walk/12b`): the "No A session" gap caption is cut entirely, and "Deload 21–25 Sep" sits under the axis.
  - Cut the "4 weeks ago" toggle and its overprinting label (`walk/19b`). Cut the second chart, "reps at that weight · tick is the target" (rep bars): reps are the point labels now.
  - Tap a point: a readout above the chart says "Fri 9 Oct · 60 kg × 10, 10" and links to that Session.
- **Records:** three rows. Heaviest set; Best est. max; Most reps at the current load.
- **Sessions log:** newest first, 4 rows, then "Show all {n} sessions".
  - Working Sets come first. Warm-ups go on a second muted line prefixed "W".
  - A PR tag appears only on a Set that set a record under the V5-06 definition.
  - The Session note shows in quotes when present.
  - A row opens that Session's summary.
- **Footnote:** `Est. max ≈ weight × (1 + reps ÷ 30), from your best working set.` It appears once, only when the Est. max tab has been shown.
- Removed from today's two pages:
  - "Estimated max (Epley) from the best set, per session";
  - "Big dots are new bests · tap a point for its set";
  - "2 steps up in this range: 46.25 kg → 47.5 kg → 46.25 kg. Hollow = deload, never a loss.";
  - "Next: 25 of 36 reps at 46.25 kg" (the action sentence replaces it);
  - "e1RM 79.2 kg estimated · latest session";
  - "Last moved: Mon 3 Aug ›";
  - "Fewer reps · 25 vs 28";
  - the "Bests" table header.

### 6.4 Expected statuses on stats-45 (test fixture for `liftStatus`)

| Lift | Last Sessions (straight sets) | Status | Action |
|---|---|---|---|
| Narrow-grip pull-down | 28 Sep 47.5×10·10·10 → 7 Oct **46.25**×10·9·9 (note) → 12 Oct 46.25×9·8·8 | **Lowered** | `Stay at 46.25 kg until all 3 sets reach 12.` |
| Push-ups (10–15) | 5 Oct 15·15 · 9 Oct 15·15 · 14 Oct 15·14·15 | **Ready** (b) | `Next time: BW+2.5 kg.` |
| DB bench press | 13 kg ×9·8·8·7 since 7 Aug; deload 21–25 Sep inside | **Stalled** (deload inside) | `Try a variation for 4 weeks.` |
| Seated biceps curls | 12 Oct 14×12·12·12 | **Ready** (a) | `Next time: 15 kg.` |
| Back squat | 9 Oct 60×10·10 → 14 Oct 62.5×8·7 | **Moving** | `Next time: 62.5 kg × 9.` |

Headline: `This week 2 of 3 sessions · 4 lifts need a decision`.

---

## §7 Prioritised list for implementation

Each item is sized for one implementer.

1. **`liftStatus()` domain function + tests** (§6.1, §6.4 fixture). Files: new `src/domain/stats/status.ts`; retire the advice parts of `copy.ts` (`homeCopy` cards, `stallSuggestion`, `LIGHTER`) and `verdict.ts` display use. (V6-02, V5-03, V6-04)
2. **Dashboard from `liftStatus`** (§6.2): headline, ≤ 4 decision cards keyed by lift, the Lifts list replacing All lifts, the Muscles row always shown, the hidden sentence removed. Files: `src/features/progress/Home.tsx`, `Home.css`, `AllLifts.tsx` (route removed), `pages.ts`. (V6-06, V6-07, V6-12, V6-20)
3. **One Lift page** (§6.3) replacing both histories. The chart has Weight/Est. max tabs, captions under the axis (fixes "No A sDeload") and deload bands. Files: `src/features/progress/LiftPage.tsx`, `LiftPage.css`, `src/ui/ExerciseHistoryOverlay.tsx` (becomes a Sheet wrapper of the page), `src/ui/charts/Ladder.tsx`/`ladderView.ts`/`TrendChart.tsx`. (V5-08, V5-09, V6-09)
4. **Advice at the bar:** a "Ready for 15 kg · [Use 15 kg]" line on Now, and Train's hint from `liftStatus().next`. Files: `src/ui/SetScreen.tsx`, `src/features/dashboard/trainCard.ts`, `DashboardView.tsx`. (V6-01)
5. **Lift page doors:** Train rows, Session summary lift rows and Program rows become buttons that open the Lift page; the ⋯ sheet's "Lift history" opens it too. Files: `DashboardView.tsx`, `src/ui/SessionSummary.tsx`, `src/ui/ProgramPage.tsx`, `src/features/workout/WorkoutFeature.tsx`. (V6-03 steps 1–2, 4)
6. **Exercises › My lifts first**, with search that finds Program Exercises. Files: `src/features/exercises/ExercisesFeature.tsx`, `src/ui/LibraryList.tsx`. (V6-03 step 3)
7. **Break status:** eased loads on Train after ≥ 21 days off, and the headline. Files: `status.ts`, `trainCard.ts`, `DashboardView.tsx`. (V6-05)
8. **Short session keeps the Workout:** fewer than half the Sets logged → the same Workout next, with "Finish Workout B: 6 lifts left". Files: `src/ui/SessionSummary.tsx`, next-Workout selection (`src/features/dashboard/trainCard.ts`). (V6-11)
9. **Notes follow the Workout:** the last Session note of this Workout on Train; notes in the Lift page log. Files: `DashboardView.tsx`, `LiftPage.tsx`. (V6-08)
10. **Sessions: log a missed workout, add an Exercise to a past one,** and editor names/kinds. Files: `src/features/sessions/SessionsScreen.tsx`, `src/ui/SessionEditor.tsx`. (V6-13, V6-14)
11. **Swap list filtered by my gym, history first, 6 items.** Files: `src/ui/AlternativesList.tsx`, `src/features/overlays/AlternativesOverlay.tsx`. (V6-10; pairs with V5-11)
12. **Warm-up line on Now for the first barbell lift.** File: `src/ui/SetScreen.tsx`. (V6-16)
13. **Program read mode:** kg column and one duration function. Files: `src/ui/ProgramPage.tsx`, `trainCard.ts`. (V6-15)
14. **Copy pass:**
    - "Last time 46.25 × 9 · Mon 12 Oct" (cut "same");
    - summary "3 fewer reps than Wed 7 Oct";
    - Muscles "sets/week" and "as planned";
    - "First time · start light" on Now.

    Files: `SetScreen.tsx`, `SessionSummary.tsx`, `MusclesPage.tsx`. (V6-17, V6-18, V6-19)
15. **Train week strip: per-day buttons** that open that day's Session. File: `DashboardView.tsx` / `src/ui/CalendarWeek.tsx`. (V5-14)

Already in flight, so not re-specified: V5-01 Undo, V5-02, V5-04, V5-05, V5-06, V5-07, V5-10, V5-11, V5-12.

## Not checked
- The swap flow end to end (V5-02), snackbar copy (V5-04) and the Rest PR wording (V5-13): being built in parallel; I only opened the swap list.
- Offline, reload-resume and Rest push: unchanged since v4 and not re-walked.
- **For the operator (domain rule):** `nextStep` suggests "one more set" for a plain bodyweight lift. §6.1 instead says "BW+{step} kg", per the owner's "reps above the range ⇒ add load". If added load isn't possible on Push-ups at this gym, the Ready action for bodyweight lifts should become "Next time: a harder variation (Swap ›)". This needs a ruling.
