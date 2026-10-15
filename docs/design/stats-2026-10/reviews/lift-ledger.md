# Review: Lift Ledger (`lift-ledger`)

Reviewer: independent design review, 2026-10-15. Judged against `brief.md` as amended by the
orchestrator's eight rulings, `research/principles.md` §6 and the dataviz anti-patterns.

Method: I cropped all 16 board frames plus the header and panel at full resolution and looked at
each one. I ran a scripted click-through of 28 steps on a temp copy of `index.html`. The steps
sent real pointer events to frame P and were rendered headless with `render.sh`: range
1M/All/1Y, sort Program and A/B, a sparkline scrub to Mon 12 Oct and to Fri 7 Aug, a chart
scrub to Fri 9 Oct, the baseline switch, expanding bench, pull-down and squat (at 1M and 1Y),
the totals buttons, Muscles, Records with a row expanded, Sessions, "Open session" from the
readout, Back to today, the S8d path end to end with Back, and all three sparse data states. One
step failed: no muscle-row selector matched, so I did not open a muscle row. I checked 40+
displayed numbers against `brief-data.json` with a script and ran the dataviz validator.

## 1. Verdict

Lift Ledger is the most rigorous concept in its data handling. Every one of the roughly 40
numbers I checked matches `brief-data.json`, and the deload, gap and assisted-axis treatments are
textbook. On top of that the shared-axis hairline through 14 rows is a real idea. Its honesty
breaks in two places. At the default 3M baseline the change column contradicts the verdict on
**both** problem lifts: the maker admitted the bench (`■ Stalled … ▲ +2 kg`) but not the
pull-down (`▼ Slipping … ▲ +3.75 kg`). And the prototype's session callout hard-codes "No record
in the 10 sessions since", which is false for any lift except bench. Its gym ergonomics fail the
rulings: all controls are at the top, the selected range is a solid ultramarine block, the range
segments are 38 px wide and touch, and the baseline toggle is a 24 px header line. The heat table
also uses a cell colour the validator cannot tell apart from the selection accent.

## 2. Checklist (principles §6)

Tally: **20 Pass · 7 Partial · 3 Fail** (maker claimed 22 / 8 / 0).

| # | Result | Evidence |
|---|---|---|
| 1 | Pass | S1: the totals verdict `▲ 11 of 14 moving · ■ 2 stalled · ▼ 1 slipping`, then each lift's change in its own units. No tonnage, no PR count. |
| 2 | Pass | `4,185 kg` / `3,938 kg` appear only on the session pages (S6, S8d). |
| 3 | Pass | S2: third panel `e1RM (estimated) · kg`, below the weight and reps panels. S5 footnote. No e1RM column for lunges, pull-down and the other non-e1RM lifts. |
| 4 | Pass | S3 ticks `BW−27…BW−19`, `less is better ↑`, step-down labelled `Least assistance`. S3b `BW → BW+5`. Push-ups in reps. No negative load anywhere. |
| 5 | Pass | S2 `Warm-ups not counted (2 a session, e.g. 20 × 10 · 37.5 × 5)`; S6 header `2 warm-ups not counted`; S8b readout. |
| 6 | Pass | S4: 2-week blocks (one ABA and one BAB week each) against `Plan / wk`. Cells match the data (Chest 11/11/5/11, Lats 19/19/11/19 …). |
| 7 | Partial | Verdicts wait correctly (`○ Too new · 3 more` / `2 more`, S7b/c). But S7c puts `▲ +1 rep` on 2-session lifts. The brief asked for this, so it is a brief conflict. |
| 8 | Pass | S2/S3/bench expansion: deloads are hollow dots *off* the step line inside a hatched `Deload` band. `Holiday` and `No A session` are grey bands with the line broken. No V-dips. |
| 9 | Pass | S5: at most one record per lift per session, kind named. The strip counts per session (6,5,5,5,6,4,5,4 = 40) match `sessions[].prs`. |
| 10 | Partial | S4 encodes % of plan by colour alone. The numbers are printed, but the one comparison that matters (done vs plan vs 10–20) has no position or length encoding. |
| 11 | Pass | No dual axes, pies or gauges. Weight, reps and e1RM are three panels. |
| 12 | Pass | 14 small multiples. Orange marks only the stalled and slipping rows. |
| 13 | Pass | Reps bars from zero. Every sparkline prints its max and min. Expanded axes are labelled. |
| 14 | Partial | Sparklines show only the latest point and the deload dots; raw session dots appear only when a row is expanded. |
| 15 | Partial | The e1RM panel labels `best 80.0, Fri 9 Oct` as well as `now` (ruling 5: latest and scrubbed only). S5's strip prints a count on every bar. |
| 16 | Pass | Every delta has ▲/▼/`same`/`=`. `▲ −6 kg assist.` treats less assistance as good. (The glyphs are true *against the baseline*; the problem is the baseline, under fix 1.) |
| 17 | Pass | Click-through at 1M/3M/1Y/All: one domain and height in all rows; the holiday band lines up through every row (S8a). |
| 18 | Pass | Each row is its own table; expanded rows add a 6-session mini table, and the chart sits beside the table in the rows. |
| 19 | Pass | The totals verdict and `Seated biceps curls is ready: try 15 kg next` sit above the first sparkline. They are counts more than "what changed", but they meet the brief's wording. |
| 20 | Partial | Landing → lift is 1 tap (expand). Lift → session needs a scrub plus a tap on the dot, or a second tap on the same dot (first tap selects, second opens): 3 actions, and it lands on a ~10 px dot. `‹ Ledger` back works and restores scroll (steps 21–23). |
| 21 | **Fail** | Ruling 4: the range presets sit in the header, top-right, not below the chart in thumb reach. Muscles and Records have no range control at all (fixed labelled windows). |
| 22 | Pass | S8b: one hairline through all rows at Fri 9 Oct. Readout `45 × 10 · 55 × 10 · 60 × 10 · 60 × 10`, `Rep record · 60 kg × 10 · +1 rep`, `e1RM 80.0 (estimated)`, warm-ups `20 × 10 · 35 × 5` (all match the data). It is sticky, with `Back to today`. |
| 23 | Partial | The totals counts are buttons (verified: `■ 2 stalled` opens bench). But the S5 records-per-session bars and S1b's `This week` bars lead nowhere. |
| 24 | Pass | `Try 15 kg next`. Nothing in stats edits the program. |
| 25 | Pass | S7a: prescriptions in the now column plus one primary. S7b/c: `Start B ›` and the number of sessions still needed. |
| 26 | Pass | Per-lift chart = expanded row; records = Records; volume vs last time = session page; body map = session page; calendar + list = Sessions; progression hint = row line 2. |
| 27 | Partial | Values are 20 px mono at 18:1, but the per-row verdict is a 13 px glyph plus word in secondary grey. |
| 28 | **Fail** | Range segments are 38 × 44 hit areas with 0 gap. The baseline toggle is a 24 px column header. Mini-table rows are ~22 px. `Back to today` is ~26 px tall. |
| 29 | Pass | Totals, the ready line and 10 rows sit above the fold; the four attention rows answer "where". |
| 30 | **Fail** | Range, sort, baseline and the scrub readout are all at the top of the screen, out of one-thumb reach. |

**Orchestrator rulings.**
- (1) **Fail:** the selected range (`3M`, `1Y`) is a solid `#2156D9` fill.
- (2) Pass: kinds and bests use `brief-data.json`'s names. The data itself carries two vocabularies (see fix 11).
- (3) **Partial:** the S8d callout says `No record in the 10 sessions since`, but the `■ Stalled` verdict word and glyph are gone.
- (4) **Fail.**
- (5) Partial: the best e1RM is also labelled.
- (6) Pass.
- (7) Pass: muscle sets are whole numbers in S4; exact values (`10.5`, `3.5`) appear only in session pages.
- (8) Partial: orange paints a stalled lift's *whole* history, so push-ups' July climb is orange too, not just the stalled window.

## 3. Scores (1–10)

| Axis | Score | Why |
|---|---|---|
| Professional look | 7 | Disciplined Swiss ledger: hairlines, no cards, Consolas numerals that render. Pulled down by the saturated blue S4 heat table (84.8 % neutral, under the 85 % bar), the solid range block and the blocky body map. |
| Gym context | 4 | 20 px values are good, but the controls are top-only and undersized, the verdict is 13 px, mini-table rows are 22 px, and the 90 × 55 sparklines with 12 px min/max labels are hard to read at arm's length. |
| IA | 7 | One Ledger with three table segments and an in-place accordion; Sessions separate. Clear. Session drill-down is fiddly (dot tap). |
| Chart craft | 7 | Step lines, deloads off the line, aligned gap bands, rule-stating annotations (`▼ Slipping · last 2 below 47.5 × 10`). Loses points for colour-only heat cells, label collisions (1M pull-down `42.5` into the bench row; S2 at 1M `60`/`62.5` and `50`/`52.5` ticks crowd) and over-labelling. |
| Data honesty | 6 | Numbers are near-perfect (40+ spot checks pass), but the default change column contradicts 2 of the 3 attention verdicts, and the prototype generates a false sentence (fix 2). |
| Fidelity to brief | 7 | Every frame is built as specified, with documented departures. Broken against rulings 1, 4 and 5. |
| Distinctness | 8 | No other concept puts 14 lifts on one shared axis with a linked hairline or uses baseline switching; S4's heat table and S5's per-lift table are unique in their rows of Part 3. |

## 4. The four core questions

| Question | Taps | How well |
|---|---|---|
| Am I progressing? | 0 | Strong in structure: the totals verdict, the ready line, and the attention sort put the answer in rows 1–4. Weakened by the default change column: rows 1–2 read `▲ +3.75 kg` / `▲ +2 kg` beside `Slipping` / `Stalled`. |
| How's my bench? | 0 (1 for evidence) | Row 2: `■ Stalled · 33/40 at 13`, `13×9`. One tap shows a long flat orange tread at 13 kg since 7 Aug, labelled `■ Stalled · no record since Fri 7 Aug`, plus the mini table with the shoulder note. Good, apart from the `▲ +2 kg`. |
| Which muscles am I under-training? | 1 | Weakest. The heat table is nearly all the darkest blue (everything ≥ 100 % of plan); the real finding (calves, abs, hamstrings and glutes are low *by plan* against 10–20) lives in one 13 px sentence and a muted `10–20` column. It is not sorted by gap, and Lats/Shoulders at the top of the range go unsaid. |
| What did today's workout achieve? | 2 | Sessions → Wed 14 Oct. A compact, correct lever table (`▲ Up +2.5 kg · Heaviest weight` … `▼ 44 vs 47 reps`), the totals line, the muscles table and the body map. Answers well. |

## 5. Ranked fix list

### Maker defects

1. **Blocker · S1, S8a, P.** The change column contradicts the verdict on the attention rows: pull-down `▼ Slipping · … ▲ +3.75 kg` (3M) and `▲ +5 kg` (1Y), bench `■ Stalled · ▲ +2 kg`. The maker's rationale admits only bench. **Fix:** for stalled and slipping rows, measure the change against the verdict's own window (`same since 7 Aug`, `▼ −1.25 kg since 28 Sep`), or default the baseline to `4 wk ago`. Never print ▲ beside ■ or ▼.
2. **Major · P (S8d mechanism).** `index.html` line 1201 hard-codes the sentence `<lift> last moved here: … No record in the 10 sessions since.` for any highlighted lift. Scrub squat to Fri 9 Oct, then `Open session ›`, and the page says "Back squat last moved here … No record in the 10 sessions since", but squat set a record on Wed 14 Oct. **Fix:** compute it, or show it only when the session really is the lift's last record.
3. **Major · S1–S3b, S8a–c.** Rulings 1 and 4. **Fix:** move range (and baseline, and `Back to today`) into a bottom control bar above the tab bar. Segments ≥ 44 × 44 with 8 px gaps. The selected state becomes an outline or underline, not a solid accent fill.
4. **Major · S4.** The heat-ramp step `#2F62D2` vs the selection accent `#2156D9` fails the validator (ΔE 3.5 normal, 2.1 protan): data and accent are one colour. Saturated blocks give 84.8 % neutral pixels, and colour carries the comparison. **Fix:** draw a done-vs-plan tick or bar per block (position), lighten the fills or keep them to a small cell marker, and sort by distance below 10–20. State Lats/Shoulders at the top of the range.
5. **Major · P (S8b mechanism).** Dragging a sparkline snaps to *every* session, including the other workout's days. Dragging the squat line lands on Mon 12 Oct, and the readout says `Back squat · no session that day`. **Fix:** snap to the touched lift's sessions. Other rows still show `—` or their nearest value.
6. **Major · S1, S2, S8b.** Targets: baseline toggle 24 px, mini-table rows ~22 px (these are also the session tap targets in S8d's path), `Back to today` ~26 px, session dots ~10 px. **Fix:** make them ≥ 44 px, or make the mini-table row the 44 px session link instead of the dot.
7. **Minor · S8d.** Ruling 3: add the bench verdict (`■ Stalled · 10 sessions`) to the destination callout, not only the prose.
8. **Minor · S2, S8b.** Ruling 5: drop the `best 80.0, Fri 9 Oct` label. Show e1RM only at the latest and scrubbed points; the best stays in Records.
9. **Minor · S1, S8a, 1M.** Min/max labels collide with neighbouring rows. At 1M, pull-down's `42.5` sits in the bench row; after scrolling it peeks under the sticky header. Crowded y-ticks at 1M. **Fix:** clip labels to the row, and thin the ticks.
10. **Minor · S1, S1b.** Verdict line at 13 px secondary grey (item 27): raise it to 15 px ink. Mini-table dates drop the weekday (`14 Oct`, not `Wed 14 Oct`).
11. **Minor · S1, S8a (ruling 8).** Orange paints the whole sparkline of a stalled lift (push-ups' climbing July is orange). **Fix:** colour only the stalled or slipping window.
12. **Minor · S6, S7a.** The session body map reuses the % of plan ramp for raw set counts (`1–2, 3–5, 6–9, 10+`): one ramp, two meanings. S7a hides the Workout B rows behind the primary button.

### Brief / spec conflicts (for the orchestrator)

- **C2's compare default is the root of fix 1.** The brief says "change over the range" from range start, while T3 verdicts use a 4-session window. Whenever a lift moved earlier in the range, the two disagree by design. The spec should say what the change column measures for stalled and slipping rows.
- **The range control's place:** the brief put it "in the header"; ruling 4 puts it below the chart. A ledger has no single chart, so the spec should name a bottom control bar for this concept.
- **The heat ramp is the accent's hue** (brief palette table): `#2F62D2` and `#2156D9` are indistinguishable. The brief's palette needs a different data hue or a de-saturated ramp.
- **S7c `+1 rep`** (brief) vs item 7 (no deltas before 4 sessions).
- **Sparkline size:** the brief says ~120 × 32, but its own row anatomy (162 px name, 20 px value column, 390 px width) leaves 90 px.
- **Record vocabulary inside `brief-data.json`:** bests are `Heaviest set` / `Most reps at BW−19` / `Best estimated 1RM`, while kinds are `Heaviest weight` / `Rep record`. S5 shows both on one panel. Ruling 2 needs one list.

## 6. Ideas worth stealing

- **Deloads as hollow dots off the line**, inside a hatched band, with the line continuing at working weight. It ends the "deload looks like a regression" problem; every concept's per-lift chart should do it.
- **The rule printed on the chart:** `▼ Slipping · last 2 below 47.5 × 10`, `■ Stalled · no record since Fri 7 Aug`. It is the verdict's evidence in one line (Verdict Feed's `Why?` in miniature).
- **Session notes inline in the mini table**, under the session they belong to (`Right elbow sore on pull-downs`, `Left shoulder a bit tight on bench`).
- **The baseline named in the column header** (`vs 15 Jul ▾`), so a delta always says what it is measured against.
- **Totals counts as buttons** that open the first lift with that verdict.
- **One holiday or sick band through every row:** a cross-lift "it was the calendar, not you" read.
- **S7a: the prescription sits in the value column** until the first session replaces it. Not an empty chart, and nothing to apologise for.
- The **lever column** on the session page (`Up +2.5 kg · Heaviest weight`, `+1 rep total · stalled 10 sessions`): a compact "what this session achieved" any concept's summary could use.

## Delta review (Revision 1)

Method:
- Re-cropped all 16 frames of the new `board.png` at full resolution and looked at each one.
- Ran 12 scripted click-through steps on a temp copy, sending real pointer events to P:
  - expanded push-ups, bench at All, and pull-down at 1M;
  - swept a sparkline scrub across the squat line;
  - scrubbed to 9 Oct, then pressed `Open`;
  - opened a session from a mini-table row, and Mon 3 Aug via a push-ups chart tap;
  - opened Records with the assisted row expanded;
  - checked the S7b, S7c and fresh states;
  - measured the hit boxes in S2.
- Re-ran the validator.
- Checked every new sentence and delta against `brief-data.json`.

### Original blocker and majors

| # | Status | Evidence |
|---|---|---|
| 1 Blocker: change column vs verdict | **Partly** | Pull-down `▼ −1.25 kg, last 2` and bench `= 0 since 7 Aug` are now true (bench 13×9 vs 13×9). No ▲ sits beside ■ or ▼ at 1M, 3M, 1Y or `4 wk ago` (S1, S8a, S8c). **But push-ups `= 0 since 3 Aug` is false.** The data has 17 on Mon 3 Aug and 15 now (Wed 14 Oct), so the change is −2 reps, and the row's own `BW×15` and sparkline max `17` contradict it. Cause: `index.html` line 881 returns the literal `'= 0 since '` for every stalled lift. |
| 2 Major: hard-coded callout | **Partly** | It is now computed. Squat on Fri 9 Oct reads `▲ Moving · … Moved again since: Heaviest weight, Wed 14 Oct` (true). Push-ups on Mon 3 Aug: `none in the 11 sessions since` (true). **New garble:** opening the latest session (Wed 14 Oct from the squat mini-table) reads `Its last record: none in the 0 sessions since.` See R2. |
| 3 Major: controls (rulings 1, 4) | **Fixed** | Bottom bar: `1M 3M 1Y All` measured at 44 × 44 at y 714, with ≥ 8 px gaps. The selected range is a 2 px outline. `Sort` and `Change vs` are in the bar too; `‹ Back to today` and `Open <date> ›` replace them while scrubbing (S8b). |
| 4 Major: S4 ramp equals accent | **Fixed** | Teal ramp passes `--ordinal`, and the nearest step to the accent is ΔE 22.2 normal / 20.6 deutan (tritan 7.0, carried by bar length and printed numbers). Every block is a done bar plus an ink plan tick. Sorted lightest plan first (Abs 3 … Shoulders 21, as the data says). The summary names `Shoulders 21, Lats 19` at the top of 10–20. 92.4 % neutral by my count. |
| 5 Major: scrub snaps to other workout's days | **Fixed** | A sweep across the squat sparkline lands on Wed 14 Oct, a squat day. B rows read `— no session`. |
| 6 Major: small targets | **Fixed** (mostly) | Mini-table rows are 358 × 44 session links; a row tap opens the session (2 taps from the landing, verified). Bar buttons are 44 × 44. Remaining: the `Lifts` segment is 33 × 44, and `Start B ›` and the totals counts are about 20 px text links. |

### Minors claimed fixed

- **7, S8d verdict:** fixed. The callout starts `■ Stalled`. Its copy, `DB bench press here: … Its last record: none in the 10 sessions since.`, is true but clumsy.
- **8, e1RM labels:** fixed. `79.2 latest`, and the scrubbed value on scrub. The S5 strip labels only the max (6) and latest (4) bars.
- **9, label collisions:** partly. Min labels are now clamped and the 1M ticks thinned. But the scrub readout line `Back squat 47.5 × 10 · 57.5 × 9 · 62.5 × 8 · 62.5 ×` is cut at the right edge on Wed 14 Oct (4 sets do not fit in the 13 px mono line).
- **10, verdict size:** not fixed (still 13 px). Admitted.
- **11, orange only on the stalled stretch:** fixed (S1, S8a, S2).
- **12, separate body-map ramp, S7a B rows:** fixed. Grey ramp on the session body map; S7a now shows the Workout B rows, with `Start A ›` in the totals.

### New rulings

- **11, deltas use the verdict's window: partly.** Bench and pull-down are right; push-ups is wrong (R1).
- **12, bottom bar ≥ 44 px: fixed.**
- **13, distinct heat ramp plus a length encoding: fixed.**
- **14, no deltas before 4 sessions: fixed.** S7c shows `50×8 · 2 sessions` and `baseline`, with no ▲.
- **15, sparklines sized to the space left: fixed.** The row's grid leaves 90 px and the sparkline uses all of it (90 × 55).
- **16, `kinds` record names: fixed.** S5 Bests read `Least assistance` and `Rep record`. On the assisted row both show the same `BW−19 × 6 · Mon 12 Oct`, which is redundant but true.

**Mini table at 4 sessions, not 6: justified.** I measured S2: 44 px rows, and the 4th row ends at y 653 (phone coordinates). The bottom bar starts at about y 706, and the context row below (Deadlift) fills the gap. Six rows would end at about 741: past the bar, with the row below gone and the last row covered. Six 44 px rows and one row of context below cannot both fit with the bar, and 44 px rows are a ruling. Accept 4. The brief should be amended to say 4. Side effect: at the default range the table no longer shows a deload row; deloads stay visible in the chart (hatched band, hollow dots), so T1 and T2 still hold. Warm-ups are now only a count (`Sets · 2 warm-ups not counted`). That carries the required words, and the sets themselves are in the S8b readout.

### Regressions

- **R1, Major. Two stalled-lift texts disagree on the expanded push-ups row.** The row says `= 0 since 3 Aug`, while the chart caption directly below says `■ Stalled · no record since Fri 7 Aug`. Line 1010 hard-codes the bench date and rule for any stalled lift, so it is wrong for push-ups (its last record was Mon 3 Aug). The `= 0` is itself false (−2 reps, see item 1). **Fix:** compute both from the lift's last record and its actual change: push-ups `▼ −2 reps since 3 Aug (best 17)`, or `no record since 3 Aug` with no number.
- **R2, Minor. The callout on the latest session reads `Its last record: none in the 0 sessions since.`** (Wed 14 Oct squat). **Fix:** when the lift set its record in this session, print `Latest record`.
- **R3, Minor. The scrub readout clips its set list** (14 Oct squat, 4 sets).
- **R4, Minor. One column, two windows.** With `Change vs 4 wk ago` selected, the column header says `vs 4 wk ago` while the stalled and slipping rows measure `since 7 Aug` / `last 2`. Each row labels its own window, so this is honest, but the header should say something like `vs 4 wk ago · problem rows: own window`.
- Checked and **not** regressed:
  - session totals: 3 Aug `23 sets · 6 records · 70 min · 3,648 kg · 47 BW reps`; 9 Oct `4,669`;
  - volume baselines: `vs 4,311 on Mon 5 Oct`; `vs 3,355 on Wed 29 Jul`;
  - S4 block values;
  - the S5 strip sum (40);
  - S7b/S7c counts (`7 baselines`, `3 of 3 sessions`, `2 more` / `3 more`);
  - the S8b readout.
  - The verdict line and totals still agree with the rows (11/2/1).

### Updated tally and scores

Checklist: **26 Pass · 4 Partial · 0 Fail** (was 20 / 7 / 3).
- Now Pass: 7, 10, 15, 20, 21, 23.
- Still Partial:
  - 14: sparklines show only the latest and deload points.
  - 27: the verdict is 13 px.
  - 28: the `Lifts` segment is 33 px wide, and `Start B ›` and the totals counts are text-sized links.
  - 30: the segment switch is still at the top.
- Item 16 stays Pass, but R1 counts against data honesty below.

| Axis | Before | Now | Why |
|---|---|---|---|
| Professional look | 7 | 8 | S4 is calm and legible, the outline selection, the bottom bar reads native |
| Gym context | 4 | 7 | Thumb-reach 44 px bar and 44 px session rows; the verdict is still 13 px |
| IA | 7 | 8 | Landing → lift → session is 2 taps on real targets |
| Chart craft | 7 | 8 | Length encoding in S4, orange only on the stalled stretch, e1RM labels pared back |
| Data honesty | 6 | 7 | Bench and pull-down fixed; the push-ups `= 0` and the hard-coded `since Fri 7 Aug` caption are new false or contradictory text on a headline row |
| Fidelity to brief | 7 | 8 | Rulings 1–16 met except 11 (push-ups); the 4-row mini table is a justified departure |
| Distinctness | 8 | 8 | Unchanged |

**Remaining must-fix before a pick:** R1 (push-ups delta and caption, `index.html` lines 881 and 1010), then R2.
