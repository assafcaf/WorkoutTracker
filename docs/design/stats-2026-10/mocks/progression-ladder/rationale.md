# Progression Ladder: rationale

**Thesis.** Stats live at the lift, inside training. Each lift's double-progression ladder shows where
it stands on its current weight and how close the next step is. There is no Stats tab: Program is the
index, the dossier holds the depth, and the post-workout summary is the main stats moment.

## Key decisions

1. **The ladder encodes the program's own rule (0006).** The top panel shows the working weight as a
   step line (treads). The bottom panel shows reps at that weight as bars from zero, with a target
   tick per tread. When the weight steps up, reps reset. That is why Wed 14 Oct (62.5 × 8, e1RM 79.2)
   reads as a step up, not a dip below Fri 9 Oct's 80.0. e1RM is one text line, never drawn.
2. **Two panels on one time axis, never two units on one axis.** Gaps break both panels and are
   labelled at the top of the plot (`Holiday`, `Sick week`) with a hairline. Deloads are hollow dots
   and hatched bars, kept off the step line, so they never read as a loss.
3. **Verdict before the chart.** S1 opens with "12 of 14 lifts climbed a step since Fri 18 Sep" and
   a one-line attention summary. A `Next · Fri, Workout B` row leads to Train, which is the
   concept's "what next" screen.
4. **Cobalt only where the brief allows.** It marks the primary button, the active tab, the selected
   range, the selection and the *current tread in the dossier*. Mini ladders draw the current tread in
   ink, so the stalled lifts (one long current tread) are not the bluest rows on the page. Red-orange
   appears only on ▼ "below last time".
5. **The dock.** A drag snaps a hairline to the nearest session. The readout docks above the tab
   bar, in thumb reach, and stays after release. Hold to drop a second handle. Tapping a dot opens its
   session, which gives the 2-tap drill (row → dossier → dot).
6. **One summary format for every session.** S6 and the S8d destination are the same view. It shows
   7 mini ladders with today's dot in cobalt and the move in words (`Stepped up to 62.5 kg`,
   `Held 13 kg`, `Fewer reps (47 on 9 Oct)`). Then come the records, the body map `Worked today`,
   and volume vs the last same workout as a quiet last line.
7. **Results-board type, kept calm.** Bahnschrift Condensed 600 is used for numerals and titles
   (verified in the render), with Segoe UI for text. There are no tints behind data, no badges and
   no colour blocks. Rules are used, not cards.

## Tap counts (from app open on Program)

| Question | Taps | Sequence | Frame |
|---|---|---|---|
| Am I progressing? | 0 | "12 of 14 lifts climbed a step" + 14 mini ladders | S1 |
| How's my bench? | 0 (1 for depth) | Row: "■ Stalled 10 wk · 13 kg · 33 of 40"; tap → dossier | S1 → S8d |
| Which muscles am I under-training? | 1 | Muscles segment: "On plan for 2 weeks" + map labels | S4 |
| What did today's workout achieve? | 2 | Train → `Last workout · Wed 14 Oct` (or History → row) | S6 |

## Honest weaknesses

- **"Am I progressing?" depends on 96 × 32 mini ladders.** They are word-sized. Their rep bars
  (10 px tall) cannot be read at arm's length, so the row's numbers carry the meaning. A skeptic
  would say S1 is a list with decorations.
- **Q4 costs 2 taps.** There is no stats home, and the summary lives behind Train or History. This
  is the price of the thesis.
- **Muscles is the weakest frame (S4).** The body map's shading carries magnitude in 4 bins.
  Numbers appear only on 5 labels and in the list (item 10, Partial). The silhouette is serviceable,
  not illustrative. There is no 2 / 4-week window control, so the deload-inclusive 4-week view is
  not offered.
- **Hold-to-compare cannot be discovered.** It is mentioned only in the dock's hint line.
  Range presets sit mid-screen, out of thumb reach (item 30, Partial).
- **The weight panel's y-domain includes deload weights.** In the Step range this squashes the
  57.5–62.5 treads into the upper half (S2).
- **Single-session treads are hard to tap.** On 1Y the dots are ~10 px apart (item 28, Partial).
  Scrub covers the full plot height, but tapping a specific dot needs precision.
- **Records have two homes.** They live in the dossier → Records page and in History's Records
  segment. It is the same list, which is consistent, but it is still a duplicate.

## Departures from the brief, and why

1. **Mini ladders share one window** (the last 8 weeks on S1, the 8 weeks to the session on S6;
   the first 2 weeks in sparse states) instead of "the last 3 treads". Item 17 requires a shared span.
2. **Body-map shade = sets a week (2-week average) in 4 bins, not % of plan.** All 12 muscles sit at
   exactly 100 % of plan, so a %-of-plan map would be one flat colour. The plan appears as the tick
   on the selected muscle's bar and as a column in the list. The ramp is a single slate hue, not
   cobalt, so it never competes with selection.
3. **Biceps (9.75 → 10) is labelled alongside abs, calves, hamstrings and glutes.** It sits on the
   same line as hamstrings and glutes in the data.
4. **S5 shows the lift's records table first and the recent list below.** The page is pushed from
   the dossier. History → Records shows the recent list alone.
5. **S3 and S3b use the All range.** All five assistance treads, and the full BW tread meeting
   45 of 45, only appear there. The default range is still Step.
6. **S6's volume line does not say "three lifts".** Four A lifts stepped up on Wed 14 Oct (squat,
   lunges, shoulder press, push-down). The copy reads "from heavier weights at fewer reps".

## Self-check (principles §6)

| # | Result | Evidence |
|---|---|---|
| 1 | Pass | S1 leads with steps climbed (working-weight progress) |
| 2 | Pass | Volume appears only in session summaries (S6 last line) |
| 3 | Pass | "e1RM 79.2 (estimated)" text on 5 lifts only; never on the ladder |
| 4 | Pass | S3 "assistance · less is better ↑", BW−27…BW−19; S3b BW → BW+5 |
| 5 | Pass | S2 "Warm-ups 20 × 10 · 37.5 × 5 · not counted"; S6 header; S8b dock |
| 6 | Pass | S4: 2-week average vs plan, plan tick and list column |
| 7 | Pass | S7b/S7c "○ Too new · 2 more"; no verdict under 4 sessions |
| 8 | Pass | Hollow dots, hatched bars, "Deload" label; labelled breaks for gaps |
| 9 | Pass | S5 grouped by session, kinds in words, collapsed after 3 |
| 10 | Partial | Body map uses colour bins for magnitude; numbers only on labels and in the list |
| 11 | Pass | Stacked panels; no dual axes, pies, gauges or rings |
| 12 | Pass | S1/S6 one small multiple per lift |
| 13 | Partial | Bars start at zero; the weight axis is labelled by tread labels (min/max), not ticks |
| 14 | Pass | Every session is a dot plus a bar |
| 15 | Pass | Only tread starts, the latest reps and gap/deload names are labelled |
| 16 | Pass | ▲ ■ ▼ ○ plus words; less assistance wears ▲ |
| 17 | Pass | Shared 8-week window and 96 × 32 size (departure 1) |
| 18 | Pass | Dossier steps sentence + sessions table; muscle list |
| 19 | Pass | S1 sentence above every chart |
| 20 | Pass | S8d: row → dossier → dot → session, 2 taps; back works |
| 21 | Pass | One preset row above the ladder, underlined when selected |
| 22 | Pass | S8b |
| 23 | Partial | Rows and the Next row lead on; the headline sentence is not tappable |
| 24 | Pass | "Try 15 kg next", "Consider a lighter week…"; nothing edits the program |
| 25 | Pass | S7a with Start Workout A; S7b/S7c with baselines and a Next row |
| 26 | Pass | See "Homes" below |
| 27 | Pass | 20 px condensed row values, 64 px hero, verdict text ≥ 7:1 |
| 28 | Partial | Rows 64 px, tabs 49 px; tread dots on 1Y are a ~10 px tap |
| 29 | Pass | Verdict, Next row and all of Workout A above y = 761 |
| 30 | Partial | One finger throughout; presets mid-screen |

**Homes of shipped stats.** The per-lift chart is in the dossier. Records are in the dossier →
Records page and in History → Records. Volume vs last time is the last line of the summary. The
muscle map is in Program → Muscles and in the summary under "Worked today". The session summary is
reached from History rows or Train → Last workout. The sessions list and calendar are in History. The
progression hint is on Train's next-step bars and in every row's `x of y`. On the live screen, `Lift
history` pushes the dossier, and the PR toast and the volume line keep their places (not drawn).

## Must-fix truths

- **T1:** S2's warm-ups line, S6 "2 warm-up sets not counted", and the S8b dock.
- **T2:** S2 (Sick week break), S3 and S8a (Holiday + Sick week). Breaks are calendar weeks with no
  session.
- **T3:** S1 and S8d (Stalled banner: "no record since Fri 7 Aug · 10 sessions, 9.9 weeks").
- **T4:** S5 and S6 show one record per lift per session. The S8b dock reads `Rep record · 60 kg × 10`.
- **T5:** The e1RM text appears on the 5 lifts only, labelled "(estimated)".
- **T6:** S3.
- **T7:** S4 (12 muscles, Lats and Mid back separate; forearms and traps drawn neutral) and S6.

## Derived numbers

- **Reps at the working weight, and the target, per session.** Reps are the sum of working (non-drop)
  sets at the session's top weight. The target is the number of those sets × the top of the range.
  Examples:
  - Squat, the 57.5 tread: 16, 13, 17, 17, 19, 18 of 20. Squat Fri 9 Oct: 20 of 20.
  - Hyper-extension at BW: 45 of 45 from Mon 13 Jul. The deload reads 30 of 30.
  - Push-ups Fri 9 Oct: 47 of 45.
- **S8c span, Fri 7 Aug → Wed 14 Oct:**
  - 12 sessions later, +7.5 kg on the bar.
  - Top set 55 kg × 10 → 62.5 kg × 8 (−2 reps).
  - Steps 55 → 57.5 → 60 → 62.5 (3 climbed); next step 20 of 20 → 15 of 20.
  - e1RM 73.3 → 79.2 (estimated). The span includes the holiday, the sick week and a deload.
- **S5, best reps at each squat working weight (first date reached):**
  - 62.5 kg × 8 · Wed 14 Oct
  - 60 × 10 · Fri 9 Oct
  - 57.5 × 10 · Mon 7 Sep
  - 55 × 10 · Fri 7 Aug
  - 52.5 × 10 · Fri 24 Jul
  - 50 × 10 · Mon 6 Jul
- **S4 contributors.** Working sets in 28 Sep – 11 Oct × the factor (1 primary, 0.5 secondary), ÷ 2.
  Hamstrings: Back squat 3 · Lunges 2.25 · Deadlift 2.25 · Hyper-extension 2.25 = 9.75. Every
  muscle's total matches `muscleSetsAvgLast2FullWeeks`.
- **Muscles worked in a session.** Computed the same way, per session. Wed 14 Oct matches the brief:
  Shoulders 10.5, Triceps 8, Chest 7, Quads 7, Hamstrings / Glutes / Calves 3.5, Lower back 2.
- **Fri 7 Aug summary:** volume 3,938 kg vs Mon 3 Aug 3,648 kg = up 8 %. Push-ups 45, vs 47 on
  3 Aug ("fewer reps").
- **S7a starting weights.** Each lift's first-session top weight, e.g. Back squat 50 kg,
  Assisted BW−27, Push-ups bodyweight.
- **S7b next-step counts from session 1:** Squat 13 of 20, Lunges 30 of 36, Bench 31 of 40, Push-ups
  30 of 45, Shoulder press 23 of 30, Laterals 30 of 45, Push-down 28 of 36.

## Palettes (validator output)

```
"#1F3FB8,#C73A1E" --mode light --surface "#FFFFFF"
  [PASS] Lightness band · [PASS] Chroma floor · [PASS] CVD separation ΔE 25.8 (protan)
  [PASS] Normal-vision floor ΔE 35.8 · [PASS] Contrast vs surface → ALL CHECKS PASS
"#ADB4BF,#858D9A,#5B6471,#2F3640" --ordinal --mode light --surface "#FFFFFF"   (added: body-map ramp)
  [PASS] Lightness monotone · [PASS] Adjacent ΔL ≥ 0.06 · [PASS] Light-end contrast 2.09:1
  [PASS] Single hue (spread 3°) → ALL CHECKS PASS
```

Rejected attempts:
- The cobalt-family ramp `#D3DBF4…` failed the light-end contrast check at 1.38:1.
- `#9FB0E6…` passed, but was dropped: it read as cobalt, i.e. as selection.
- The slate ramp fails against `#F2F3F5` (1.88:1), so the map always sits on the white page.
- Added shade: none beyond the ramp. The deload texture is a 45° hatch in `#8C9199`.

## Render log

| Round | Seen | Changed |
|---|---|---|
| 1 | Mini ladders all-cobalt on stalled lifts; S2 records and warm-ups below the fold; gap label collided with the deload dots; cut-off hero on the scrolled S8 frames; blocky body map with a clipped "Biceps" label; S7a prescription repeated and overflowing; summary moves wrapping to 3 lines; heavy dark bullet bars | Current tread in ink on minis; compact dossier header, warm-ups under the hero, shorter chart; gap labels moved; sticky nav with a small title, and S8 frames scrolled to the presets; smoothed outline body map at 1.04×; S7a cleaned; shorter move words; lighter bullets |
| 2 | Body-map labels still clipped; S2 hero meta wrapped; "Holiday" clipped among bars in 3M; record tag wrapped on long names | Re-placed views and labels; meta moved to the title row; gap labels at the plot top with a hairline; record tag dropped from rows (the records list follows) |
| 3 | Sparse minis cramped (2 dots on one pixel) | Sparse window = first 2 weeks |
| 4 | Panel "Partial" wrapped | Wider key column; final board |

**Scripted click-through** (temp copy with injected JS, headless `--dump-dom`; all passed):
- Train → Last workout summary → back.
- Muscles → tap Calves.
- Squat dossier: Step / 3M / 1Y / All = 12 / 18 / 23 / 23 points.
- Drag → sel Fri 9 Oct, with the dock showing `45 × 10 · 55 × 10 · 60 × 10 · 60 × 10 · 20 of 20 at 60 kg · ready`.
- Hold → second handle.
- Clear; Records page; bench dossier → tap the Fri 7 Aug dot → session ("5 records").
- History → Records.
- Board state control: Full / 3 / 1 / Fresh.

## Revision 1 (after `reviews/progression-ladder.md` and the orchestrator's rulings)

### Fixes, in the review's order

1. **Cobalt walls (major, ruling 1).**
   - The current tread is now a thin cobalt line, 1.5 px.
   - Its bars are a light tint (`#DDE2F4`) with a 1 px cobalt outline.
   - The tread's dots are ink.
   - Only the latest session is a solid cobalt mark: its dot and its bar.
   - Checked on the bench, push-ups and pull-down dossiers in P.
2. **Push-ups banner (major).** The banner copy is now per lift:
   - Push-ups: "45 of 45 or more on several days, but no set has beaten 17 reps."
   - Bench: "One long tread at 13 kg; the bars stay at 30–33 of 40."
   - The bench line is true: 30–33 every non-deload session since Fri 7 Aug.
3. **Pull-down header (major).**
   - The name runs full width, and the verdict and prescription sit on one line under it.
   - The hero no longer shares its row with anything.
   - Render check: "46.25 kg × 9" fits on one line at 64 px.
   - The steps sentence is now "1 step up, then back: 46.25 → 47.5 → 46.25 kg".
4. **Mini ladders.**
   - A 1 px ink target tick runs along each tread at 100 %.
   - Deload bars are hatched.
   - Today's bar in the summary is cobalt.
5. **Glyphs.**
   - ▼ is reserved for the Slipping verdict.
   - Summary moves below last time use ↓ plus words ("↓ Fewer reps than last time (44, was 47)").
   - The S8c dock says "2 fewer reps" instead of "−2 reps".
6. **Sparse states.**
   - **Muscles at 0 / 1 / 3 sessions:**
     - shows the plan's sets per muscle on the map, with a legend;
     - says when your own sets start;
     - ends with Start Workout A (Fresh) or a Next row.
   - **History:**
     - the calendar never starts before the first session's week;
     - the 1-session state reads "1 of 3 sessions in your first week" plus a Next row;
     - the sick-week legend appears only in the full state, and is corrected to "week of 14 Sep: sick, one B session".
7. **Map bins.**
   - Bins use the displayed, rounded value, and the legend now reads "under 5 · 5–9 · 10–14 · 15+". "Hamstrings 10" now sits in the 10–14 shade.
   - The summary's "Worked today" map uses the same bins and has its own legend.
   - The S4 contributor stack is one neutral (`#3A3E44`) with gaps, not ramp shades.
   - Each row of the 12-muscle list now has a length bar (done, 2-week average) with a plan tick and a 10–20 rule.
8. **"13" label over "Holiday".** A gap label that would hit a tread drops to just under the weight panel, with a white halo, and is drawn last.
9. **S1b.** The pull-down bullet is full width; "▼ Slipping · elbow note on Wed 7 Oct" moves to its own line.
10. **Clipped first x-tick.** Ticks closer than 16 px to the left edge are skipped. Spans of 20 days or less tick each session's date, so the 2-session dossier has dates.
    - *Rejected:* the review asked for a tread line joining the 2-session dots. Principles §5 say 1–2 exposures show points and no line, so I kept the dots.

### Rulings applied

- **Ruling 1:** fix 1 above.
- **Ruling 2, records vocabulary.** I used the record kinds from `brief-data.json` (`points[].pr.kind`, as fixed in brief 1.3.10) everywhere:
  - The dossier table now reads `Heaviest weight` / `Estimated 1RM` / `Least assistance` / `First added load` / `Rep record`.
  - The values are unchanged: they equal `lifts[].records`.
  - Push-ups and hyper-extension's bodyweight best show as "Rep record · BW × 17" and "BW × 15".
- **Ruling 3.** A session opened from a dossier shows a one-line status band for that lift. On S8d it reads "DB bench press · ■ Stalled 10 wk · no record since Fri 7 Aug, 10 sessions", then "This session set the record the stall is counted from."
- **Ruling 4.** `Step · 3M · 1Y · All` now sits under the ladder as four 44 px buttons, with the selected one filled. The S8 frames scroll so the ladder sits right under the sticky nav, which puts the presets at y ≈ 400–445 of 844.

### Also fixed

- "Hold 46.25 kg…" → "Consider staying at 46.25 kg until the elbow settles."
- The weight panel has labelled min and max ticks at the right edge, including a deload minimum such as 50 under the 57.5 tread.
- The dot-tap target grew to ±14 × ±22 px.
- The dock's "Open session ›" is 44 px tall.

### Re-render and checks

- **R1-a:**
  - Bench dossier: "Sick week" collided with "Deload" → moved gap labels.
  - S8 frames showed a clipped line under the sticky nav → scroll offset set to the ladder's top.
- **R1-b:** clean.
- Scripted click-through re-run: all 24 checks pass, including Step / 3M / 1Y / All = 12 / 18 / 23 / 23.
- Extra renders for review: bench, push-ups and pull-down dossiers; sparse Muscles; 1-session History.
- Every frame is still ≥ 89 % neutral.

### Self-check after revision: 27 Pass · 3 Partial

| # | Before → after | Evidence |
|---|---|---|
| 10 | Partial → Partial | Per-muscle length bars exist, but only in the list below the S4 fold; the map is still colour. |
| 13 | Partial → Pass | Labelled min and max on the weight panel; bars from zero. |
| 16 | (reviewer Partial) → Pass | ▼ = Slipping only; ↓ + words for moves; "2 fewer reps". |
| 21 | Pass → Pass | One preset row, under the chart, per ruling 4. |
| 23 | Partial → Partial | The headline sentence is still not a tap target. |
| 24 | (reviewer Partial) → Pass | Every suggestion is a "Consider…" or "Try…". |
| 25 | (reviewer Partial) → Pass | Sparse Muscles and History designed, each with a next step. |
| 28 | Partial → Partial | A 1Y dot is still about 10 px wide; "Open session" in the dock is the 44 px fallback. |
| 30 | Partial → Pass | Presets and the dock sit in the lower half; one finger throughout. Hold-to-compare is still discoverable only through the dock hint. |

## Revision 2 (delta review, rulings 5, 8, 9, 14)

- **Record dates (major).** Each dossier row is now the latest `points[].pr` of its kind, with that
  session's date. For example: `Least assistance · BW−19 × 5 · Wed 7 Oct` and
  `Rep record · BW−19 × 6 · Mon 12 Oct`.
  - A script compared every dossier row (kind, text and date, all 14 lifts) and every session's
    record list (all 45) against `brief-data.json`: **0 mismatches**.
- **Assisted y-ticks (major).** The min and max labels are right-aligned to the plot edge, and
  "BW−19" and "BW−27" now draw in full.
- **Ruling 5.** "best 80.0 Fri 9 Oct", the Estimated 1RM record row, S5's best-e1RM line and the
  summary's "also e1RM" are gone. e1RM now appears only for the latest session (S2) and in the
  scrub readout. Tread labels stay: they label the steps, not individual points.
- **Ruling 8.** "↓ Fewer reps than last time" is in secondary ink. Red appears only on ▼ Slipping.
- **Ruling 9.** `.c` values now use `tabular-nums lining-nums`. Measured in headless Chrome,
  Bahnschrift Condensed's tabular figures give "1111" = "8888" = 74.6 px (proportional: 48.1 vs
  77.9), so no face switch was needed. The 64 px hero stays proportional, per dataviz.
- **Ruling 14.** The 3-session state shows no deltas:
  - S7c reads "No trends yet…".
  - Dossiers under 4 sessions read "N sessions so far… M more before a verdict or a trend".
  - Summary rows read "Session N of the first 4 · no trend yet".
  - Records stay, because the brief mandates them (1.3.9).
- **§5 on the minis.** Lifts with 1–2 sessions get dots with no line. Deload bars are hollow (the
  3 px hatch read as a glyph). Target ticks are 1 px muted.
- **S4 copy and legends.** S4 now reads: abs (3) and calves (8) are "fewer than" the 10–20 range;
  hamstrings, glutes and biceps "sit at its bottom (10)". Both map legends read
  "under 5 · 5–9 · 10–14 · 15+".
- **S2.** The warm-ups line no longer wraps.
- **Re-checks.** I re-rendered the board, viewed S2, S3, S6 and S7c, and re-ran the click-through:
  all checks passed.
