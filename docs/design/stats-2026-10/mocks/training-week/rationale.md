# Training Week: rationale

**Thesis.** The week is the unit. Stats answer "am I doing the plan, and is it paying off?" one
calendar week at a time: this week first, with what is still to do, then past weeks as recaps in a
fixed order (sessions, muscles against the plan, lifts, records).

## Key decisions

1. **Adherence is the hero, and a sentence comes with it.** `2 / 3` at 72 px, then "2 of 3 sessions
   this week. On plan for the last 2 weeks." It is a §2 headline stat and it is true now, on a
   Thursday with Friday still to come.
2. **This week is only ever compared with this week's plan.** Every bullet shows done, a dim "still
   planned" segment for Friday's B, and the plan tick for a BAB week. Rows behind pace (done / plan
   below sessions done / 3) are amber, and the section says "5 behind pace; Friday's Workout B closes
   all of them." This avoids the partial-week trap without hiding the gap.
3. **Matched-parity comparison, at the same point in the week.** `vs last same week` puts a tick at
   the 28 Sep BAB week *after its B and A*, not at its full total, so the comparison is fair. It shows
   the honest result: identical except Shoulders, 15 against 14, from a drop set.
4. **The week-binned strip is the per-lift chart.** One tile per calendar week; sessions sit at
   their weekday inside the tile; empty weeks have no tile and a vertical label (`Holiday`,
   `No A session`); the deload tile is shaded and labelled; the line breaks across empty weeks.
   It plots the top-set weight, so Wed 14 Oct's 62.5 × 8 reads as a step up. e1RM is a row of
   numbers per week (week best), marked "est.", never a line.
5. **Load and reps never share an axis.** Hyper-extension has an "added load" lane above a reps
   panel. The step to +5 kg is annotated there, the reps line breaks at the switch, and BW+5 sessions
   are squares. Assisted pull-ups use a reversed assistance axis, plus an "assistance removed" bar
   from zero (8 kg).
6. **Block is the range zoom for Week.** The 8 full weeks (22 of 24) are rows of day dots, sets
   against 69 and sessions. Sick, deload and holiday are labelled rows, not losses.
7. **Graphite stays calm.** No pure black, no glow, no shadows. Saturated colour only appears in
   thin marks and 36 px day dots. The accent `#7DB7E8` is a light, low-chroma azure, used for the
   active segment, back links, the primary button, the scrub hairline and the compare tick.

## Tap counts (from app open, Week tab)

| Question | Taps | Sequence | Frame |
|---|---|---|---|
| Am I progressing? | 0 (+1 scroll) | Adherence and muscle pace on S1; lifts stepped up / held / down after one scroll | S1, S1b |
| How's my bench? | 2 | Lifts tab → DB bench press (or scroll → Held → DB bench press) | S8d path |
| Which muscles am I under-training? | 1 | `2-week view ›` or any muscle row | S4 |
| What did today's workout achieve? | 1 | Wed in the day strip | S6 |

## Honest weaknesses

- **"Is it paying off?" sits below the fold.** S1 answers "am I doing the plan" at a glance, but
  which lifts moved is on S1b. A lifter who only wants per-lift trends pays a scroll or a tab.
  This is the concept's worst question (item 29 Partial).
- **Amber on S1 can read as an alarm for something already scheduled.** Five rows are amber only
  because Friday's B carries those muscles. The copy says so, but a skeptic would call it a
  pre-filled warning. On the 1-session sparse state I turned amber off, which makes the rule depend
  on the state.
- **The strip hides reps.** Within a weight step, all dots sit flat (S3's assisted runs especially),
  so the climb from 5 to 8 reps is invisible without scrubbing or the sessions table.
- **S4 cuts Shoulders' bar at the frame bottom**, and the body map is schematic, close to a mannequin.
- **The compare tick (accent) and the done bar fail the validator's normal-vision floor** (ΔE 11.7).
  It is a different mark (a 3 px full-height tick against an 8 px bar), but the colours alone are
  close.
- Muscle-row values are 15 px, not the 20 px row-value target.

## Self-check (§6): 21 Pass, 9 Partial, 0 Fail

1 Pass: adherence hero (S1). 2 Pass: no tonnage on Week; volume only in S6 and session pages.
3 Pass: e1RM is an "est." number row only (S2). 4 Pass: S3 reversed BW−27…BW−19; S3b BW+5 load lane.
5 Pass: "warm-ups not counted" on S1, S2, S6, S8b, S8d. 6 Pass: S4 2-week default; S1 this week
against this week's plan. 7 Pass: S7c "too new", 2 more / 3 more. 8 Pass: deload tile, labelled gaps.
9 Pass: S5 one per lift per session, newest first. 10 Pass: length, ticks and positions. 11 Pass.
12 Pass: one lift per strip. 13 Pass: bars from zero, strips print min and max. 14 Pass: every
session is a dot. **15 Partial**: S2's e1RM row prints a number per week. **16 Partial**: groups use
↑ + = ↓ and words, but amber rows have no per-row word. 17 Pass (n/a, no sparklines). 18 Pass:
summary sentence + "Sessions in range" table. **19 Partial**: the opening sentence is about
adherence, not lift change. **20 Partial**: Lifts → lift → session is 3 taps; 2 from S1b after a
scroll. **21 Partial**: the Week view has both a pager and Block. 22 Pass: S8b. 23 Pass: hero and sets
→ Block, rows → S4, days → sessions, groups → lifts. 24 Pass. 25 Pass: S7a–c. 26 Pass (homes below).
**27 Partial**: muscle values are 15 px. **28 Partial**: S1 muscle rows are 44 px with 0 px gaps.
**29 Partial**: lift progress is below the fold. **30 Partial**: lift-page presets are in the upper half.

**Homes of shipped stats.** Per-lift chart: lift page. Records: S5 and the lift page. Volume vs last
time: S6 and every session page. Muscle map: S4 index and S6. Sessions list and calendar: day strip,
Block, "Sessions in range". Progression hint: `Next up` bullets (S1b) and the lift page.
The live set screen's projection and PR toast would point to the lift page; not drawn.

## T1–T7: where each is visible

T1 S2 note, S1 legend, S6 header, S8b readout (+ S8d warm-up lines). T2 S2, S3, S3b (empty week
columns, broken line; S8a for weeks). T3 lift verdict lines (S2, S3), S1b groups, bench page in the
S8d path; deload weeks never judged. T4 S5 (one record per lift per session), S6 lever table.
T5 e1RM only on the 5 lifts, as "est." numbers. T6 S3. T7 S4 (12 muscles, Lats and Mid back apart,
½ sets in contributors), S6.

## Departures from the brief

- **S1 rows show halves** (`12.5 of 25 · Fri adds 12.5`), as the brief's own S1 example does, because
  whole-number rounding breaks the addition. S4 rows use whole numbers; exact values appear in the
  contributors drill-down.
- **3M has 14 week columns, not 13**: 15 Jul falls in the week of 13 Jul, and 13 Jul – 12 Oct is 14
  calendar weeks.
- **S5 also carries the Back squat records table** that the frame list asks for (the concept section
  puts it only on the lift page).
- **S8d reaches the session through the scrub readout's `Open session ›`** (or the sessions table),
  because a press on the strip scrubs.

## Derived numbers

- Per-session muscle plan A = Wed 30 Sep's muscle sets, B = Mon 12 Oct's. BAB plan = A + 2B (Chest 7,
  Shoulders 18.5, Lats 25 …), ABA plan = 2A + B. Both reproduce `plannedMuscleSetsPerWeek` as averages.
- Same point last BAB week = Mon 28 Sep + Wed 30 Sep muscle sets (Shoulders 14, others as now);
  sets 23 + 23 = 46.
- Behind pace: done / plan < sessions done / 3.
- Lift groups per week: stepped up = a Heaviest weight / Least assistance / First added load
  record; more reps = a Rep record; down = lower weight, or same weight and fewer total reps, than the
  last non-deload session; otherwise held. This reproduces the brief's 5 / 4 / 3 / 2.
- Contributors: prescribed sets × 1.5 sessions a week × 1 or ½ (library primary/secondary muscles).
  Lats: Assisted 6, Row 6, Pull-down 4.5, Deadlift 2.25 = 18.75.
- e1RM per week = best e1RM in that week. Assistance removed = 27 − 19 = 8 kg.
- Session-page volume change: Fri 7 Aug 3,938 against Mon 3 Aug 3,648 kg = up 8 %.

## Palette validator (`--mode dark`)

```
"#3F95D6,#BC7F25" --surface "#1A1D21": ALL CHECKS PASS (worst CVD ΔE 23.4 protan, normal 25.2)
"#3F95D6,#BC7F25" --surface "#121417": ALL CHECKS PASS (same ΔE)
bands "#3E5B78,#4F80AE,#6DA6DA,#A3CEF3" --ordinal, surface #1A1D21: ALL PASS (light end 2.39:1, hue spread 4°)
bands --ordinal, surface #121417: ALL PASS (light end 2.61:1)
"#3F95D6,#7DB7E8" (done vs accent compare tick), surface #1A1D21: FAILED: accent outside L band,
  chroma 0.093, normal-vision ΔE 11.7. Kept as the accent per the brief; separated by mark shape.
```

No shades were added. Bands are used for the "still planned" segment, the 10–20 range wash, the Mon
segment in S6, the records bars and the body map (bins under 10, 10–14, 14–18, 18+).

## Render log

| Round | Seen | Changed |
|---|---|---|
| 1 | S3 ticks at even values (BW−28…BW−18), step labels collide with the end label; S3b reps line plunges 15 → 12 at the load switch and lane labels overlap; S4 body map squeezed to 25 px, Lats and Shoulders cut; S8b drag marker off the dot; S8c compare tick invisible; S8d lift names run into sets; board control overlaps the S4 label; panel empty | Assisted ticks at actual steps; line broken at the load switch, BW+5 as squares, lanes re-laid; map no-shrink + redrawn anatomy, title moved into the nav; marker uses dot y; 3 px full-height compare tick + explanatory copy; table padding; control moved; panel filled |
| 2 | S3b "bodyweight only" collides with the reps caption and a legend hits "now"; S4 note wraps; S6 lever text wraps into the sets column | Labels moved onto the load lane, legend dropped; shorter note; wider lever column |
| 3 | S3 "BW−21" step label collides with "BW−19 × 6"; S8a deload row's sessions column shifted by the "Deload" tag | Step labels below dots, first point unlabelled; grid `minmax(0,1fr)` |
| 4 | Clean (final board.png) | — |

**Click-through test** (a temp copy with injected script, rendered headless): 25 of 26 checks
passed. Checked: Held → bench → Fri 7 Aug session → back → back; squat dots 1M / 3M / 1Y = 6 / 18 / 23;
pointerdown + drag snaps to Fri 9 Oct with `45 × 10 · 55 × 10 · 60 × 10 · 60 × 10`, sticky after
release, × clears; compare on and off; pager to 5 Oct and to the deload; Block 22 of 24 → sick-week
row; Muscles 4 weeks note; Lats contributors; records pager down to the deload; Wed → S6; board
control Full / 3 / 1 / Fresh. The one failure was the test's own wrong week (Wed 7 Oct is in the
week of 5 Oct, not 28 Sep).

## Revision 1 (after `reviews/training-week.md` and the coordinator's rulings)

The sections above describe version 0. Where this section disagrees with them, this section wins.

**What changed**

| Item | Change |
|---|---|
| Item 20 Fail | S1 now has attention chips (`■ DB bench 10 wk`, `■ Push-ups 10 wk`, `▼ Pull-down`). Each stalled lift page has `Last moved: Fri 7 Aug · Heaviest weight 13 kg × 9 ›`. Landing → bench → Fri 7 Aug is 2 taps (scripted). Lift rows on session pages and on S6 now push the lift page. |
| Ruling 3 | A session opened from a lift keeps that lift's verdict in a banner (`DB bench press · ■ Stalled · no record since Fri 7 Aug: 10 sessions, 9.9 weeks. Its last record was set in this session.`). |
| Ruling 6 / T3 | Above the fold on S1: `2 / 3`, "On plan for the last 2 weeks.", "11 of 14 lifts moving · 2 stalled, 1 slipping", the 3 chips, the day strip, sets, then the top 3 muscle rows. Rows are 56 px with 20 px values; the rest are below the fold. S1b's group names carry `■ Stalled` / `▼ Slipping`. |
| Ruling 8 | Amber appears only when a *closed* week is under its own plan *and* its 2-week window is behind (no deload, no holiday in the window). Now no S1 row is amber; work scheduled for Friday is a neutral "Fri adds 13". |
| Ruling 7 | Week rows (S1, recaps, S7) use whole numbers; S4 "this week", contributors and S6 keep halves. This retires my version-0 departure. |
| Ruling 5 / fix 4 | The per-week e1RM row is gone. e1RM appears under the chart for the latest point ("Latest 62.5 kg × 8 · e1RM 79.2 (estimated)") and in the scrub readout. |
| Ruling 4 | Lift-page presets moved under the chart (44 px, with a week-range caption that fixes "from 13 Jul"). S4's window control is docked at the bottom. |
| Ruling 1 | Selected segments, chips and the records bar use an accent outline on surface-2, not a solid accent fill. The primary button stays filled, because it is an action, not a state. |
| Ruling 2 | Records tables use `brief-data.json`'s names verbatim: `Heaviest set`, `Best estimated 1RM`, `Heaviest added load`, `Most reps, bodyweight only`, `Most reps at BW+5`. |
| Fix 2, collisions | Every lift × 1M / 3M / 1Y was rendered as one grid (42 charts) plus Block, then fixed. The axis title and end value share the top lane (the end value has a hairline leader); `Deload` has its own lane. Stall brackets sit under the x-axis, with "last record" left of its ring. Month labels need 32 px between them (no "JunJul"). Assisted step labels were dropped because the ticks are the steps. Hyper-extension's reps title moved to the axis. `elbow note` was re-anchored. Block's `Deload` / `Sick` / `Holiday` moved under the week label. |
| Fix 6 | `vs last same week` shows only on the current week with full data. Stepping weeks resets it, so it no longer stays on while drawing nothing, and it is not offered in week 1. |
| Fix 7 | The body map is a continuous anatomical outline, 120 px per view, with inset muscle regions and a rendered legend (`sets a week · <10 · 10–14 · 14–18 · 18+`), on S4 and S6. |
| Fix 8 | S4 "this week" shows the still-planned segment (`Fri adds`). |
| Fix 10 | Push-ups and hyper-extension reps axes start at 10, and stalled lifts get the generic stall bracket (`11 sessions without a record`). The 15/17 alternation is real data (failure sets), now at a quarter of the height. |
| Fix 11 | Each set is kept together (`nowrap`); S6's lift rows became two-line rows (name + lever, then sets). |
| Fix 12 | The holiday recap collapses to one line, with no zero bullets. |
| Fix 5 | S6 Mon is now `band1` against Wed `done`. Validator: normal ΔE 19.8, CVD 19.0 (pass). It still FAILs the categorical L band and chroma floor, and warns on contrast (2.61:1), because band1 is a ramp step used as "earlier, muted". The legend labels Mon and Wed. I did not disclose the old pair (ΔE 7.3) in version 0; that was a miss. |

**Not done, with reasons.** Every listed maker defect was addressed, apart from the gaps below:
- I kept the compare tick in the accent. It fails the normal-vision floor against `done` (ΔE 11.7); a 3 px full-height tick against an 8 px bar is the only separation.
- S4 still cuts Lats and Shoulders below the fold, because 12 rows at 56 px do not fit with the sentence and the map.

**Re-tests.** The scripted click-through now passes 32 of 32 checks, including the 2-tap path, session → lift, S6 row → lift, and the compare chip hidden on past weeks.

**Re-self-check (Revision 1): 27 Pass, 3 Partial, 0 Fail.**
- 15, 16, 19, 20, 27 and 29 moved to Pass, for the reasons in the table above.
- Still Partial:
  - 21: the Week tab has both a pager and Block.
  - 28: list rows sit edge to edge, with no 8 px gap between hit areas.
  - 30: the compare and Block chips stay at the top.

**Render log, revision**

| Round | Seen | Changed |
|---|---|---|
| R1 | S1 attention chips overflowed the right edge; the muscle note took 2 lines; S6 lever table cramped sets into 3 lines; Pull-down's `▼ Slipping` wrapped in Next up | Equal-width chips; shorter note; S6 as two-line rows with short names; short name + nowrap |
| R2 (42-chart grid) | Collisions on assisted (step labels vs line / Holiday), hyper 1M (`bodyweight only` vs `+5 kg added`, reps title vs Deload), pull-down `elbow note` clipped at the right | Step labels removed; the label drops below the lane when crowded; reps title moved to the axis; note re-anchored |
| R3 | Clean board (`board.png` for Revision 1) | — |

## Revision 2 (after the delta review)

- **Rounded rows add up.** "Fri adds" and "to come" are now the rounded plan minus the rounded done
  figure (`Lats 13 of 25 · Fri adds 12`, `Mid back 9 of 17 · Fri adds 8`, `Biceps 7 of 13 · Fri adds 6`,
  S7b `Shoulders 11 of 24 · to come 13`). I checked this with a script on a temp copy: all 36 muscle
  rows on S1, S8c and S7b sum correctly (0 failures). Bars still draw exact values.
- **Scrub:** while a session is selected, the "Latest … e1RM" line is hidden; the readout carries that
  session's e1RM.
- **Record names:** records tables now read `Heaviest weight` everywhere (S5, the lift pages), matching
  the event kind.
- **S6:** the bench lever reads `= no record in 10 sessions · ■ Stalled`, so the delta uses the stall
  window.
- **S7c:** no "More reps" group. Each of the 14 lifts is a row `○ Too new · 2 more sessions` (A) or
  `3 more sessions` (B), with its raw top sets (`50 kg × 7 · 50 kg × 8`). The lift-page summary lists
  dated values, not arrows.
- **S4:** the sentence adds "Lats 19 and Shoulders 21 sit at its top", so the finding is complete
  above the fold. Their rows still sit below it.

Self-check unchanged: 27 Pass, 3 Partial (21, 28, 30), 0 Fail.
