# Cross-concept review: stats 2026-10

Reviewer: cross-concept review, 2026-10-15. This is the only review that looks at the four concepts
side by side.

**Inputs**
- `frame.md`; `brief.md` Part 1.1, Part 2 and Part 3; `research/principles.md` §3 and §6;
  `research/audit.md` §4–5.
- Each concept's `rationale.md`, including its revision sections.
- Each concept's review, including its delta sections. `lift-ledger` has **no delta review yet**, so
  its scores and tally are from round 0. Its Revision 1 claims (bottom control bar, verdict-window
  deltas, teal bars on S4) are taken from `board.png` and the rationale, and nobody has verified them.

**Pixels**
- I viewed all four `board.png` at 1800 px.
- I cropped S1, S2, S4, S6 and S7b at the brief's fixed geometry into
  `reviews/_compare/{S1-home,S2-lift,S4-muscles,S6-summary,S7b-sparse}.png`. Each strip has four
  phones in the order Verdict Feed · Lift Ledger · Training Week · Progression Ladder.

Short names below: **VF** = Verdict Feed, **LL** = Lift Ledger, **TW** = Training Week,
**PL** = Progression Ladder.

---

## 1. Distinctness

Overall the brief's Part 3 worked on the frames that carry the thesis: S1, the primary per-lift form
and the IA. The concepts converged on the "reporting" frames (S6, S7b, S4). In part this happened
because the orchestrator's rulings (record vocabulary, ruling 13's length-plus-tick for done vs plan,
verdict banners on drill-downs, presets under the chart) pulled every revision toward the same answer.
Most of that convergence is healthy. It is the rubric doing its job, and a hybrid inherits it at no
cost.

| Frame | Where they genuinely differ | Where they converged anyway |
|---|---|---|
| **S1 home** (`S1-home.png`) | Four different first reads. VF opens on a serif sentence plus a `▲11 ■2 ▼1 ↑1` count row and two attention cards. LL opens on a totals line plus 10 dense sparkline rows. TW opens on a 72 px `2 / 3` hero, a day strip and per-muscle bullets. PL opens on `12 of 14 lifts climbed a step` plus lift rows grouped by workout. It is clearly the most divergent frame. | After rulings 3 and 6, all four put the same three exceptions above the fold (bench and push-ups stalled 10 wk, pull-down slipping), as cards (VF), sorted rows (LL), chips (TW) or a sub-line (PL). **LL and PL share an anatomy**: name + verdict word on the left, a small chart in the middle, value + `x of y` on the right. Only the mini-chart (sparkline vs mini ladder) and the order (attention vs program) differ. |
| **S1b** | VF: findings for the week, records and muscles. LL: the last rows plus a legend. TW: the lift groups (stepped up / more reps / held / down). PL: the Train next-step bullets. | VF's "This week" day strip echoes TW's. VF's `Next: 15 of 20` bar echoes PL's next-step bullets. Both are minor. |
| **S2 lift** (`S2-lift.png`) | VF: one annotated period chart (labelled bands, e1RM as a thin reference line on the same kg axis). TW: a week-binned strip on dark, with empty week columns. PL: a huge `62.5 kg × 8` hero over the ladder. | **LL and PL are the near-duplicate pair.** Both stack top-set weight over reps-per-set bars from zero on a shared time axis, with a hatched deload and hollow deload dots off the line. PL adds the target tick per tread and drops the e1RM panel, and that difference matters. All four put presets under the chart (ruling 4), show e1RM only as a latest-session label, and give a `Next: 15 of 20 reps at 62.5 kg` line (VF, TW, PL). |
| **S3 / S3b** | VF uses bands per assistance step. TW uses a separate added-load lane. LL and PL use stacked panels. | All four got T6 right: reversed `BW−27…BW−19`, U+2212, "less is better". |
| **S4 muscles** (`S4-muscles.png`) | VF: a Cleveland dot plot (plan ring vs done dot) on a 10–20 wash. LL: a 4-block time table per muscle. TW: full-width bullets with a body map as an index. PL: a body-map index plus one muscle's contributor stack. | **The strongest convergence.** After ruling 13, LL, TW and PL (in its scrolled list) all draw a horizontal done bar with a plan tick. Three of the four lead with the same sentence: "on plan for 2 weeks; the plan itself is light on calves and abs, Lats and Shoulders at the top". TW and PL both pair the sentence with a front/back silhouette. The findings are identical because the data is "everything at 100 % of plan". No layout could have made S4 interesting with this dataset. |
| **S6 summary** (`S6-summary.png`) | VF opens on a six-line serif recap paragraph. TW reframes the session as "What Wed did for your week" (session and set bullets against the week's plan, muscles moved). | **VF, LL and PL converge on one lever table**: one row per lift, the top set on the right, a move word underneath (`Weight up +2.5 kg · record`, `▲ Up +2.5 kg Heaviest weight`, `▲ Stepped up to 62.5 kg`). Volume is the same quiet last line in all four. PL's 7 mini ladders are the only visual difference, and at 32 px they read as decoration. Even TW's lower half (`Lift by lift · vs Fri 9 Oct`) is the same table. |
| **S7b sparse** (`S7b-sparse.png`) | TW draws week 1 as a week: `1 / 3`, a day strip, muscles "to come". | **VF, LL and PL are nearly interchangeable**: a heading, then 7 rows of `lift · ○ baseline / Too new · 3 more · 50 kg × 7`. PL adds `13 of 20`, LL adds a single dot. This frame fails Part 3's own test ("could be swapped into another column unnoticed"). The answer is probably simply correct, though: with one session there is nothing else honest to show. |
| **S8** | Range: VF presets, LL one global range, TW Block zoom, PL Step → 1Y. Compare: VF's `4 weeks ago` tick, LL's baseline switch, TW's parity tick, PL's two-handle span. Scrub: VF and TW use a sticky card above the chart, LL a hairline through 14 rows, PL a bottom dock. | Every S8b readout is the same content (`45 × 10 · 55 × 10 · 60 × 10 · 60 × 10`, rep record, e1RM, warm-ups). Only its place differs. |

**Is any pair too similar?** **Lift Ledger and Progression Ladder.** Their S1 rows, S2 stacked
panels, S6 lever tables and S7b baseline lists are the same skeleton. They differ in three ways:
- the encoding (a sparkline of the lever vs a ladder with a target tick);
- the IA (a Ledger tab vs no stats tab);
- the stance (Consolas Swiss vs Bahnschrift results board).

The PL reviewer already scored distinctness 7 for this reason. The pair is still worth having
separately, because the comparison isolates exactly one question: does the target tick (PL) beat the
raw sparkline plus change column (LL)? It does (see §2). VF and TW are each clearly distinct from
everything else.

---

## 2. Head-to-head per core question

Taps are counted from app open on each concept's stats entry. Evidence is from the boards and the
reviews' scripted click-throughs.

### "Am I progressing?" (§3 Q1)

| | Taps | Evidence |
|---|---|---|
| VF | 0 | "11 of 14 lifts moving. DB bench press has stalled for 10 weeks. Pull-down is slipping since your elbow note." Then `▲11 ■2 ▼1 ↑1`, then two cards, each with a suggestion. This is the only landing that answers in a sentence a lifter could repeat. |
| LL | 0 | `▲ 11 of 14 moving · ■ 2 stalled · ▼ 1 slipping` and 10 attention-sorted rows. Complete, but you read a table. The verdict word is 13 px, and in round 0 the change column contradicted the verdict (`■ Stalled … ▲ +2 kg`). The Revision 1 board shows `= 0 since 7 Aug`, not yet re-reviewed. |
| TW | 0 | `2 / 3` plus "On plan for the last 2 weeks" answers *adherence* first. Lift progress is one line (`11 of 14 lifts moving`) plus chips, added in revision. The progress answer is secondary by design. |
| PL | 0 | `12 of 14 lifts climbed a step since Fri 18 Sep` is the most *training-literate* headline (working-weight steps, not a verdict count). The 96 × 32 minis carry nothing at arm's length; the numbers do the work. |

**Best: VF**, with PL's "climbed a step" metric as the strongest single number. VF's own review
(ruling 6, Partly) notes the fold shows only problems and no gain. PL's sentence is exactly the
missing gain.

### "How's my bench?"

| | Taps | Evidence |
|---|---|---|
| VF | 0 answer / 1 evidence | Card 1: `13 kg × 9 since Fri 7 Aug — 10 sessions, no record`, a suggestion, and `Why?`, which shows the 4 triggering sessions and "A record needs 13 kg × 10". The evidence page draws a claret `Stalled 10 wk` band. |
| LL | 0 / 1 | Row 2 `■ Stalled · 33/40 at 13`, and the row expands in place. |
| TW | 1 (chip) | The chip `■ DB bench 10 wk` leads to a stall bracket `10 sessions without a record`, and `Last moved: Fri 7 Aug ›` reaches the session in 2 taps. |
| PL | 0 / 1 | Row `■ Stalled 10 wk · 13 kg · 33 of 40`. The dossier's banner reads "One long tread at 13 kg; the bars stay at 30–33 of 40", over one flat tread whose rep bars sit visibly under the target tick. |

**Best: PL for depth, VF for the landing answer.** PL is the only concept whose chart shows *why*
bench is stuck, not only *that* it is: the bars never reach the tick. Its reviewer called it "the best
answer to this question I have seen in the set". VF's `Why?` is the best trust device for the
1-line answer.

### "Which muscles am I under-training?"

| | Taps | Evidence |
|---|---|---|
| VF | 0 + scroll (sentence) / 1 (dot plot) | The S1b finding names calves, abs, hamstrings, glutes and biceps. The S4 dot plot is honest but its rows are 44 px. |
| LL | 1 | Round 0 had a nearly uniform dark heat table. Revision 1 has bars with a plan tick plus a 2-week time dimension. It is the only S4 that shows a muscle's trend across blocks, including the deload dip (`5`, `6`). |
| TW | 0 (this week's pace) / 1 (`2-week view ›`) | Full-width bullets with a still-planned segment and a plan tick, sorted lightest-plan first. The sentence names both ends of the range. Only TW answers part of this on the landing without a scroll. |
| PL | 1 | "On plan for 2 weeks", a map index and one muscle's contributor stack. The 12-row comparison is below the fold. |

**Best: TW.** Its bullets are the §3 Q5 form verbatim (bullets sorted by deficit, map as an index).
The still-planned segment is the only honest treatment of a partial week in the set. With this
dataset every concept's *finding* is the same plan-level sentence. For the drill-down, VF's and TW's
contributor arithmetic (`Lats 18.75: Assisted 6 · Row 6 · Pull-down 4.5 · Deadlift 2.25 (½)`) is
what makes fractional sets believable.

### "What did today's workout achieve?"

| | Taps | Evidence |
|---|---|---|
| VF | scroll + 1 | The route goes through a card titled `Records · 4 records yesterday`, which a lifter will not guess. The S6 content (recap plus lever table) is excellent. |
| LL | 2 | Sessions → Wed 14 Oct. A compact, correct lever table with `9 Oct` and `vs last A` columns. |
| TW | 1 | Wed in the day strip. "What Wed did for your week" (2 of 3, 47 of 69, muscles moved against this week's plan) is the only S6 that places the session in a larger goal. |
| PL | 2 | Train → Last workout. Moves in words (`Stepped up to 62.5 kg`, `= Held 13 kg · stalled 10 sessions`) and a `Next time:` close. |

**Best: TW for the route, PL for the content.** PL's summary is the one that ends on what to do next
(`Next time: back squat 15 of 20 at 62.5 kg … curls are ready for 15 kg`). TW's 1-tap day strip is
the right entry point. VF's `Records` route is the weakest in the set.

### Sparse data (S7a–c)

| | Evidence |
|---|---|
| VF | S7a's expectation ladder: "Starting points after 1 session · First changes after 2 · A verdict after 4 of a lift · Muscles after 2 weeks", plus `Start Workout A`. The best fresh-install screen. S7b/S7c rows are still dead ends (item 23). |
| LL | S7a puts the program's prescription in the value column (`4 × 8–10`) until a session replaces it: no empty axes and no apology. S7b/c add `Start B ›`. |
| TW | Week 1 drawn as a week. `1 / 3`, and muscles "to come 13". It is the only sparse state that feels like progress rather than waiting. |
| PL | Sparse Muscles shows the *plan's* sets on the map, plus a next step. S7c's 3-session minis drew a line through 2 dots in round 1. |

**Best: VF's S7a, plus TW's S7b.** S7b in VF, LL and PL is the same screen (§1).

---

## 3. Score table

These are the latest reviewer scores. VF, TW and PL are after their Revision 1 delta review. **LL is
round 0 only**: its delta review has not landed, and its Revision 1 board visibly addresses the round-0
blocker and the gym-context failures, so its numbers are likely to rise. Checklist tallies are also the
reviewer's latest, not the maker's.

| Axis | VF | LL (r0) | TW | PL |
|---|---|---|---|---|
| Professional look | 8 | 7 | 8 | 8 |
| Gym context | 8 | 4 | 7 | 8 |
| IA | 8 | 7 | 8 | 8 |
| Chart craft | 8 | 7 | 8 | 7 |
| Data honesty | 8 | 6 | 8 | 7 |
| Fidelity to brief and rulings | 7 | 7 | 8 | 8 |
| Distinctness | 8 | 8 | 8 | 7 |
| **Sum / 70** | **55** | **46** | **55** | **53** |
| §6 checklist (reviewer) | 27 P · 3 ½ · 0 F | 20 P · 7 ½ · 3 F (maker R1 claims 26 · 4 · 0) | 27 P · 3 ½ · 0 F | 25 P · 5 ½ · 0 F |
| **Mine: would a serious lifter open this every week?** | **8** | **6** | **7** | **8** |

Why I scored the last row as I did:
- **VF 8.** Monday-morning reading: one sentence tells you whether anything needs action. The risk
  is that it becomes "nothing new" when all is well.
- **LL 6.** A data-minded lifter will love it once a month. Weekly, it is a dense table that needs
  study at arm's length, and its gym context scored 4.
- **TW 7.** It is the screen you open mid-week to see what is left. It is less rewarding as the
  progress question, and the dark stance is a taste bet.
- **PL 8.** You see it whether you open stats or not, because it lives where you train, and
  `15 of 20 reps at 62.5 kg` is the number a double-progression lifter actually chases.

VF and TW tie on reviewer sum. Unlike them, PL's data-honesty deductions after Revision 1 were new
regressions (false record dates, deltas before 4 sessions), and its Revision 2 claims fixes for them
that no one has re-reviewed.

---

## 4. Best ideas to steal

1. **The written verdict plus `Why?` (VF).** "DB bench press has stalled for 10 weeks", then `Why?`
   expands in place to the rule, the four sessions that triggered it, and the exact bar to clear
   ("A record needs 13 kg × 10"). It is the best trust device in the run.
2. **The ladder: weight treads over reps-to-target bars (PL).** It encodes the program's own double
   progression. The squat's heavier set with a lower e1RM, the bench stall and the hyper-extension
   switch all read correctly with no special note. It replaces the e1RM sawtooth (audit §5.7).
3. **"Climbed a step" as the progress metric (PL).** `12 of 14 lifts climbed a step since Fri 18 Sep`
   counts working-weight progress, the §2 headline stat, and gives VF's fold the gain it lacks.
4. **Still-planned segment on a bullet, plus same-point parity compare (TW).** This is the only
   honest display of a partial week, and the only fair week-over-week compare under A/B
   alternation.
5. **The 1-tap day strip into the session summary, framed as "what it did for your week" (TW).** It
   fixes the weakest route in VF and PL.
6. **Deload as hollow dots off the line in a hatched band, and gaps as labelled breaks
   (LL / VF / TW).** All four ended here. Make it a rule, not a design choice.
7. **Docked readout above the tab bar, and a compare readout per lever (PL).** The readout sits in
   thumb reach and persists after release. The compare reports `+7.5 kg on the bar · 3 steps climbed
   · −2 reps · e1RM 73.3 → 79.2 est.` and says "includes the holiday, the sick week and a deload",
   instead of one blended number.
8. **The fresh-install expectation ladder (VF), and the prescription in the value column (LL).** Two
   complementary sparse answers: what will appear when, and what the empty cell shows instead.
9. **A stall bracket and a `Last moved: Fri 7 Aug ›` link on the lift page (TW).** These give a
   2-tap stall → evidence → session path with no scrub or precise dot tap.
10. **Contributors with the arithmetic shown (VF / TW).** For example `Calves 7.5 = Back squat 3 ·
    Lunges 2.25 · Deadlift 2.25 (½ per secondary set)`. Also LL's **holiday band through every
    row**, which reads as "the calendar, not you".

**Conflicts between them**
- **IA: VF's Progress tab vs PL's "no stats tab".** Pick one. I recommend keeping a Progress tab,
  because the verdict needs a landing, and taking PL's ladder as the lift page reached from both the
  Progress feed and the Program row.
- **Visual stance.** VF is white with a Georgia sentence; PL uses Bahnschrift Condensed numerals; TW
  is dark graphite. A hybrid needs one stance. VF's white broadsheet, with sans lining numerals
  (ruling A) and PL's condensed numerals for row values, combines cleanly. TW's dark does not.
- **Headline metric.** VF counts *verdicts* (moving / stalled / slipping over the last 4 sessions).
  PL counts *steps climbed* since a date. Both are valid, but showing both as headlines invites
  "11 or 12?". Lead with the verdict sentence and use the steps count as its supporting clause:
  "12 of 14 lifts climbed a step since 18 Sep; bench and push-ups have stalled."
- **Change baseline.** LL's range-baseline change column vs the rule that a delta beside a verdict
  uses the verdict's window (ruling 11). Ruling 11 wins; LL's header-named baseline is only for the
  moving rows.
- **The TW hero vs the VF hero.** Adherence (`2 / 3`) and progress compete for the first line. Put
  progress first and give adherence a small tile, per §3 (Q6 "Landing, small").

---

## 5. Recommendation

### Pick: a hybrid built on Verdict Feed

| Part | From | What |
|---|---|---|
| **Home (S1)** | VF | The verdict sentence and attention cards with `Why?`. Add PL's "climbed a step" clause, and a small TW-style adherence tile (`2 of 3 this week`, with the day strip) whose days open sessions. |
| **Below the fold (S1b)** | VF + PL | VF's findings for muscles and records, plus PL's next-step bullets (`36 of 36 → try 15 kg`) as the "what next" list. |
| **Lift page (S2/S3/S3b)** | PL | The ladder (treads over reps-to-target bars), with VF's labelled bands and lanes for gaps and deloads, TW's stall bracket and `Last moved ›` link, PL's docked readout, and VF's then-vs-now tick for compare. e1RM only as a labelled latest/scrubbed value. |
| **Muscles (S4)** | TW | Bullets with a plan tick, the still-planned segment for "this week", a 2-week default, the body map as an index, and the contributor arithmetic. |
| **Session summary (S6)** | PL + TW | PL's moves in words and its `Next time:` close, plus TW's "what it did for your week" header. Volume stays a footnote (all four agree). Reached in 1 tap from the day strip. |
| **Sparse (S7)** | VF + LL | VF's expectation ladder on fresh install, LL's prescription-in-the-value-column, and no deltas before 4 sessions (ruling 14). |

**Why this combination**
- It takes the strongest answer to each question: VF for Q1 and the bench headline, PL for bench
  depth, TW for muscles and the session route.
- The only concept whose chart encodes the program's rule (PL) becomes the depth view.
- It drops each concept's weakest frame: VF's records-card route to today's workout, PL's unreadable
  minis, TW's adherence-first hero, and LL's arm's-length density.

**Main risk: the verdict engine.** VF's thesis puts a classifier (moving, stalled, slipping, ready)
in 22 px type, and its review notes "if a rule misfires, the sentence states it in large serif". All
four mocks had at least one rule-copy truth slip in round 0 or 1:
- VF: "Today" for yesterday, and a 3M gain beside a 4-session verdict;
- LL: a hard-coded "No record in 10 sessions";
- TW: rounded rows that do not add up;
- PL: a false push-ups banner and false record dates.

The hybrid is only as good as `domain/` rules that are unit-tested against `brief-data.json`'s 45
sessions before any UI is built. A second, smaller risk is coherence: stitching four mocks invites
four type systems. Fix the stance (§4 conflicts) before the spec.

### Runner-up: Progression Ladder, whole

It is the most original concept, and the only one that needs no new mental model, because it is the
program the lifter already follows. It also has the best bench answer. Pick it whole if the operator
prefers "no stats tab" and accepts:
- a 2-tap route to today's summary;
- word-sized minis on the landing;
- an unreviewed Revision 2 (record dates, deltas before 4 sessions).

Training Week is a close third. It is the best at "am I doing the plan", but its dark stance and its
adherence-first landing make it the riskier whole pick. Lift Ledger should wait for its delta review.
It is best treated as a source of parts (aligned gap band, baseline-named header, prescription
column), not a pick.

### Fix in the current app regardless of the pick (from `research/audit.md` §4–5)

**Correctness bugs: must fix**
1. **Warm-ups leak into the muscle region panel.** `muscles.ts contributors()` does not filter
   working sets: the header says 21, the rows sum to 22. This breaks a must-keep rule.
2. **Region folding double-counts the back.** `toRegionCounts` maps both lats and mid back to
   `upper-back`, so Dashboard (Lats 13, Mid back 9) and Sessions (Lats 21) disagree for the same week.
   Use one 12-muscle taxonomy everywhere (T7).
3. **Record inflation and false records.**
   - "Most reps at the heaviest weight" counts as a record when reps *fell* after a weight bump.
   - One set can earn three records.
   - e1RM records of +0.2 kg count fully.
   - Result: 446 records in 45 sessions, and 11 "PRs" on Wed 14 Oct.
   - Fix: one record per lift per session, ranked kinds (T4).
4. **Two different PR counts.** The live bar counts sets and the summary counts records (`PRs 4` vs
   `11 PR`). `summarize` and `recordsSetBy` also disagree on reps.
5. **Time axes spaced by session index**, not by date, which hides gaps and deloads (T2).
6. **Bodyweight series switching.**
   - One BW+5 session flips hyper-extension to "heaviest load" and drops 20 sessions of history.
   - Push-ups chart total reps per session.
7. **The assisted lift** plots −20…−28 with an ASCII hyphen. Its "most reps in a set" record ignores
   the assistance level, so the record is stale and cannot be beaten honestly (T6).
8. **The e1RM sawtooth.** The heavier-set day draws as a downturn (deadlift 90.0 → 86.3, squat 80.0
   → 79.2), so e1RM must not be the lead line (T5).
9. **Three or four week definitions** (startedAt vs loggedAt, calendar vs rolling 7 days), plus
   partial-vs-full week comparisons with no pace.

**Layout and declared-rule issues to fix with the redesign**
- The summary's duration KPI overlaps Volume on every session over 60 min (all 45).
- Drop and failure sets count as full sets, with no declaration.
- The `~53 min` estimate ignores logged durations (63–73 min).
- Kg volume silently excludes bodyweight and assisted sets.
