# UX review: iteration 5 (2026-11-15)

Reviewer: Dana Reyes (`docs/ux-expert/persona.md`). I drove the app with `scripts/ux-review/shoot.mjs` (headless Edge, touch on) against this worktree's dev server. Viewports: 390×844, plus spot checks at 320×568, 195×422 and root font 200 %. Data: `scripts/render-states/stats-45.json`, with the clock pinned to Thu 15 Oct 2026. All shots are in `walk/`. Sizes come from `eval:` on the DOM, in CSS px.

> **Addendum after the review:** V5-01 (Discard with no confirm) was fixed on this branch before the PR: with Sets logged, "Discard workout" now asks once more as "Discard 2 logged sets". An Undo snackbar is still left for iteration 6.

## 1. Where the app stands / what's left

The set loop is good now, and three of the owner's four complaints are fixed:
- Tapping a calendar day opens that workout (`walk/41`).
- A past workout can be deleted, with Undo (`walk/43`, `walk/44`).
- An Exercise has a history graph (`walk/33`).

Two trust problems are serious:
- **"Discard workout" deleted logged sets in one tap, with no confirm and no Undo** (`walk/20`). Confirm added after the review; Undo still to do.
- **Swap shows the old Exercise's numbers (60 × 10), then changes to 0 × 8** (`walk/13` → `walk/16`).

The owner is right about Progress, and it is the biggest job left. The page:
- gives advice that contradicts its own "Why?";
- calls Push-ups "Stalled" while the trainee does 17 reps on a 10–15 plan;
- calls a load the trainee chose to lower "Slipping";
- shows a lift in two different charts in two places, and they disagree.

Progress needs a rebuild around one question: "is this lift going up, and what do I do next time?"

## 2. Scores per goal

| Goal | Score | Evidence | What would raise it |
|---|---|---|---|
| User-friendly | 7 | Set loop: 1 tap per Set, Rest is one dock (`walk/03`, `walk/06`) | Undo on Discard; no stale numbers after a swap |
| Accessible | 6 | Most controls are ≥ 44 px. Calendar days are 36×32 (`walk/44`). At 195×422 the reps Dial needs a scroll (`walk/71`, `walk/71b`). The 200 % header truncates "1/23 …" (`walk/73`) | 44 px calendar cells; the Dials pinned above the Log bar at narrow widths |
| Less crowded | 7 | Now and Rest are calm. The past-workout summary repeats each PR 3 times: header, lift row, Records (`walk/41`, `walk/43`) | One PR list; cut "This week 1 of 3" and the volume line from past summaries |
| Features in the right place | 6 | A lift's history lives in two places with two different charts (`walk/32` vs `walk/33`). Plan loads hide behind a placeholder "50" in the Program editor (`walk/51`) | One lift page, reached from Progress, Sessions, Program and the tools sheet |
| Intuitive | 5 | "2 steps up in this range: 46.25 kg → 47.5 kg → 46.25 kg" (`walk/32`); "Consider a lighter week" next to "Back to 47.5 kg × 10" (`walk/31`) | Rewrite every Progress sentence (§5, Progress) |
| Helpful / fun real-time | 8 | "PR if logged" (`walk/05`); "Rep record · +1 rep" stays all Rest (`walk/06`, `walk/07`); "Same as Mon 12 Oct" (`walk/03`) | Fix the wording "+1 rep on Mon 12 Oct" → "1 more than Mon 12 Oct" |

## 3. Jobs-to-be-done walk

| Job | Works end to end? | Friction | Shot |
|---|---|---|---|
| Pick today's workout | yes | "Change" swaps A↔B silently. The duration estimate differs by screen: A is ~54 min on Train and Program, ~70 min on Train after a Session | `walk/01`, `walk/08` |
| Log fast with sweaty hands | yes | One tap logs the Set; the Dials are 56 px | `walk/02` |
| Know what to lift next | partly | On Now and Rest, yes ("Add 5 per side → 20 + 5"). Train says "Back squat 4 × 47.5 kg", but the plan ramps 47.5 → 57.5 → 62.5 → 62.5 | `walk/08` |
| Fix / undo a set | yes | Done cell → Edit → Delete → Undo. The snackbar text reads "Set deleted ·", with a stray dot, and it covers the reps Dial | `walk/09`, `walk/10` |
| Swap an Exercise | partly | Now keeps showing the old 60×10 cells. After you visit All they become 0×8 with "Lighter than the 20 kg bar". The "Swapped from Deadlift ·" notice is a 5 s snackbar only (only All keeps "for Deadlift · Undo swap") | `walk/13`–`walk/16` |
| Abandon a wrong workout | partly | "Discard workout" exists. At review time, with 2 Sets logged, one tap wiped them (confirm since added). With nothing logged, "Finish workout" is still the primary button | `walk/17`, `walk/19`, `walk/20` |
| Find a past workout | partly | The calendar day opens it (good). Lookup by Exercise ("when did I last deadlift 70?") needs Exercise tools during a live Session; there is no entry from Sessions or Program | `walk/41`, `walk/33` |
| Delete a past workout | yes | At the bottom of the summary, with Undo. The toast says "Workout deleted ·" | `walk/43`, `walk/44` |
| See whether a lift is improving, and why | no | Two charts that disagree; wrong status labels; contradicting advice (§5, Progress) | `walk/30`–`walk/37` |
| Adjust the plan | partly | Edit works and the ⋯ menu holds Step and Bodyweight. "kg" shows a grey placeholder "50" while Train prescribes 47.5. Rest is in seconds ("180") while everywhere else uses 3:00 | `walk/51`, `walk/52` |
| Trust what the app says | no | Every past Session shows 3–7 "PRs". In Lift history every row carries a PR tag (`walk/33`). "Ready" in one list is "Moving" in another (`walk/35`) | `walk/33`, `walk/35`, `walk/40` |

## 4. Verification of this iteration's changes

| Change | Verdict | Evidence |
|---|---|---|
| Rest effort chips visible at 320×568 | **met** | Chips end at y 400 of 568 (`walk/70`) |
| Dials usable at 195×422 and 200 % text | **partly** | At 195×422 the reps Dial is below the Log bar and needs a scroll (focusing it scrolls it clear) (`walk/71`, `walk/71b`). At 200 % the header clips "1/23 …", and the Get ready card wraps to "20 + / 5" (`walk/73`, `walk/73b`) |
| Swap shows "Swapped from X · Undo" on Now | **partly** | Only as a 5 s snackbar. After it goes, Now has no trace (`walk/14`). The swapped values are wrong at first (V5-02) |
| Step and Bodyweight moved to Program › Edit › row ⋯ | **met** | `walk/52`. "For Back squat in every workout." is a good line |
| Program editor fields ≥ 44 px with names | **met** | Inputs are 48 px tall and labelled (Sets, Min reps, Max reps, Rest, Starting weight) (`walk/51`) |
| Lift chart labels no longer overprint | **not met** | Back squat: "No A session" and "Deload" overprint as "No A sDeload" (`walk/36`) |
| One comparison sentence shared by Rest and the summary | **met** | "1 rep more than Mon 12 Oct" (`walk/21b`). The Rest PR line "+1 rep on Mon 12 Oct" reads as if the record was set on 12 Oct (`walk/06`) |
| Sessions "n PRs" as plain muted text | **met**, but the number is the problem: 3–7 PRs in every Session (V5-06) | `walk/44` |
| Calendar days are buttons that open the workout | **met** | `walk/41`. The cells are 36×32 px, under 44 |
| Delete workout with Undo | **met** | `walk/44` |
| Finish sheet: Discard, and "Nothing logged yet" | **partly → fixed after review** | Discard had no confirm with Sets logged (V5-01); now asks "Discard N logged sets". No Undo yet |
| Lift history leads with an estimated-max trend | **partly** | The chart is there (`walk/33`). "Estimated max (Epley)" is jargon, every row has a PR tag, and Progress's lift page draws a different chart for the same lift (V5-08) |

## 5. Findings

**V5-01 · Severity 1 · Finish sheet: Discard loses logged sets with no way back** — *confirm fixed after review; Undo open.*
- 2 Sets logged → Finish → "Discard workout" → straight back on Train. No confirm, no toast, no Undo (`walk/20`).
- Fix: with Sets logged, a `Workout discarded · Undo` snackbar on Train for 8 s; label "Discard 2 logged sets"; with nothing logged, Discard is the only action.

**V5-02 · Severity 1 · Swap Exercise: stale, then wrong, numbers**
- After "Do this instead", Now shows the old Deadlift values (60×10, "Log set 1 · 60 × 10"). All shows 0 ×8. Back on Now, "0 kg · Lighter than the 20 kg bar" (`walk/13`, `walk/15`, `walk/16`).
- Fix: re-derive the prescription on swap; with no history keep the replaced load if equipment matches, else "Set a starting weight"; a persistent "for Deadlift · Undo swap" line on Now.

**V5-03 · Severity 1 · Progress gives wrong advice and contradicts itself** — see the Progress section.

**V5-04 · Severity 2 · Snackbars end in a stray separator** — "Set deleted ·", "Swapped from Deadlift ·", "Workout deleted ·" (`walk/10`, `walk/13`, `walk/44`); the Set snackbar covers the reps Dial. Fix: name the thing ("Set 1 deleted · 60 × 10"), place above the Dials.

**V5-05 · Severity 2 · Past-workout summary says the wrong things** — "Worked today: Lats 12.5 · Mid back 8.5" on a past workout; stale "This week 1 of 3 · next up Workout A"; unlabelled "6,815 kg · 56 bodyweight reps"; each PR shown 3 times. Fix: header = date, duration, Sets, verdict; Lift by lift with inline PR tags; cut Records, week line, volume line from past summaries; "Muscles worked" with whole Sets.

**V5-06 · Severity 2 · PR inflation** — every Session has 3–7 "PRs"; Lift history tags every row; "PRs 15" in a week. Fix: PR = new heaviest weight or best e1RM; rep records at a weight become a quieter "rep best".

**V5-07 · Severity 2 · Train misstates ramped plans** — "Back squat 4 × 47.5 kg" when the Sets ramp 47.5 → 62.5. Fix: "4 sets · 47.5 → 62.5 kg". (Not the intended heavy-first-set carry.)

**V5-08 · Severity 2 · One lift, two histories** — Lift history (Epley trend) and Progress › lift (weight steps + rep bars) disagree for Back squat. Fix: one Lift page reachable from Progress, the tools sheet, Sessions and Program.

**V5-09 · Severity 2 · Lift chart overprints and cryptic captions** — "No A sDeload"; "Hollow = deload, never a loss."; a "4 weeks ago" button with no purpose; "Next: 15 of 20 reps at 62.5 kg". Fix: in the Lift page rebuild.

**V5-10 · Severity 2 · Program editor load fields** — grey placeholder "50" vs prescribed 47.5; Rest in seconds. Fix: show the current prescribed load read-only, starting weight in ⋯; Rest as m:ss.

**V5-11 · Severity 3 · Swap sheet search has no affordance** — blank card, no placeholder or icon; "Close" small text. Fix: "Search exercises" + magnifier; ✕ close.

**V5-12 · Severity 3 · Calendar cells are 36×32 px** — fix: 44 px rows.

**V5-13 · Severity 3 · Rest PR line reads as the record's date** — "Rep record · +1 rep on Mon 12 Oct" → "Rep record · 1 more than Mon 12 Oct".

**V5-14 · Severity 3 · Train week strip is one button** — a done day should open its summary, as on Sessions.

**V5-15 · Severity 3 · At 200 % text the header clips** — drop the elapsed timer at large text, keep the set count.

### Progress view: rebuild brief

**What the trainee opens it for** (on the sofa, between Sessions):
1. Am I getting stronger overall?
2. Which lift isn't, and what do I do about it next Session?
3. Show me one lift over time: weight and reps together.

**Sentences that are wrong or meaningless** (`walk/30`, `walk/31`):
1. **Narrow-grip pull-down, "▼ Slipping"** + "Consider a lighter week or a variation", while its Why? ends "Back to 47.5 kg × 10 to stop slipping" (go heavier). The load was lowered on purpose (plan 46.25, after the note "Right elbow sore…"). A planned reduction is not slipping.
2. **Push-ups, "■ Stalled"** + "Consider a lighter week or a variation", with "BW × 17, BW × 17, BW × 17, BW × 15" on a 10–15 plan and "A record needs 18 reps in one set." The trainee is above the range: it should be "Ready: add load or a harder variation". The card line "BW × 15 · no record since 3 Aug" shows the worst Set.
3. **DB bench press "Stalled" → "Try a deload: 12 kg for one session"** vs Push-ups "Stalled" → "Consider a lighter week". Same status, two prescriptions. Visible Why? "none of the last 4 sessions" vs screen-reader "Stalled for 10 weeks, 10 sessions without a record".
4. **Seated biceps curls**: screen-reader "Ready, 36 of 36 reps at 14 kg" has no frame; the visible Why? ("every set of the last session reached the top of the rep range") is the one good explanation — keep it. All lifts labels it "▲ Moving", even under the "Ready" filter (`walk/35`).
5. **Headline "11 of 14 lifts moving · 12 stepped up since 18 Sep"**: two unrelated counts; "stepped up" undefined; the 3 problem lifts unmentioned.
6. **Lift page captions**: "2 steps up in this range: 46.25 kg → 47.5 kg → 46.25 kg" (false); "Hollow = deload, never a loss."; "Fewer reps · 25 vs 28" (vs what?); "Next: 25 of 36 reps at 46.25 kg" (`walk/32`).
7. **Lift history**: "Estimated max (Epley) from the best set, per session" is jargon; PR tag on every row (`walk/33`).
8. **Dashboard tiles**: "Muscles · Shoulders 21 above · Abs 3 below · Calves 8 below" (above what? — the Muscles page itself is clear, keep it); "PRs 15 · −1" counts an inflated metric.

**What the visual should be (from the mocks).**
- **Dashboard** (Progress Dashboard S1 "Lifts" block plus Set Table's terse verdicts):
  1. One true headline: "This week 2 of 3 sessions · 3 lifts need a decision".
  2. **Needs a decision** (≤ 3 cards): lift; status in plain words ("Above the range", "Same for 4 sessions", "Lighter than your best"); one action that matches the Why? exactly; Why? lists the evidence and the rule. A plan- or note-lowered load shows "Lowered on purpose · back to 47.5 when ready", never "Slipping". Reps above the range always produce "add load".
  3. **Lifts**: every lift as one row with a 120×32 estimated-max sparkline, current value and 4-week change ("Back squat 79 kg · +3.3"). Today's sparklines are 44×24, pale, with no number.
  4. Last week, as today.
  5. Muscles link: "Shoulders above typical range".
- **Lift page** (one page replacing both `walk/32` and `walk/33`; Progress Dashboard S6b):
  - Header: "Back squat · est. max 79 kg · +8 kg since 21 Sep".
  - One chart: estimated max line, each point labelled by its top set ("62.5×8"); range tabs 1M / 3M / 1Y; deloads as a shaded band labelled below the axis.
  - "Next: 62.5 kg × 9" (top of range → "+2.5 kg").
  - Records: heaviest set, best est. max, most reps.
  - Session log below, PR tags only on real records.
  - Formula once, in a footnote: "estimated max ≈ weight × (1 + reps/30)".

## 6. Prioritised list for iteration 6

1. **V5-01**: `Workout discarded · Undo` snackbar; with nothing logged, Discard is the only action (confirm already added).
2. **V5-02**: correct prescription immediately on swap; persistent "for Deadlift · Undo swap" on Now.
3. **Progress status rules**: reps above range → "Ready, add load"; plan-lowered load never "Slipping"; one advice string per status, same in card and Why?; one status per lift across dashboard and All lifts.
4. **One Lift page** merging both histories (est-max line with top-set labels, range tabs, Next, records, log), linked from Progress, the tools sheet, Sessions lift rows and Program rows.
5. **Rebuild the Progress dashboard**: true headline, ≤ 3 "Needs a decision" cards, all lifts as readable sparkline rows with numbers.
6. **PR definition** (V5-06) and past-summary cleanup (V5-05).
7. **Copy pass**: snackbars (V5-04); "1 more than Mon 12 Oct" (V5-13); "4 sets · 47.5 → 62.5 kg" on Train (V5-07); no "Worked today" on past workouts; unit labels on volume lines.
8. **Execution**: chart label collision (V5-09); 44 px calendar cells and per-day buttons on Train (V5-12, V5-14); swap search placeholder (V5-11); Program editor load and rest fields (V5-10).
