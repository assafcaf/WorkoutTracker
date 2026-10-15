# Lift Ledger — rationale

**Thesis.** All 14 lifts on one screen, as a table whose rows are sparklines on one shared time
axis. The table is the chart: every number is visible and comparable, and the answer to "am I
progressing, where, what next" sits in the totals row and the top four rows.

## Key decisions

1. **Totals row first, written as a verdict** (`▲ 11 of 14 moving · ■ 2 stalled · ▼ 1 slipping`),
   then the next step (`Seated biceps curls is ready: try 15 kg next`). Each count is a button that
   opens the first lift with that verdict. Reason: item 19, and the counts must not be a dead end.
2. **Attention sort by default** (slipping, stalled, ready, then the rest), so the answer is in rows
   1–4 without scrolling, and rows stay 56 px with 20 px values (the risk warning). Ten rows sit
   above the fold; the 11th peeks under the tab bar to show there is more.
3. **One sparkline anatomy for 14 rows.** Same domain and size (90 × 55) in every row. The line is
   the top set's *lever* (weight; assistance for assisted, plotted with less assistance higher;
   added load for hyper-extension; best-set reps for push-ups). It is a step line, because weight
   changes in steps. Max and min are printed small at the right. Deload sessions are hollow dots
   *off* the line, so a deload never looks like a regression. Weeks without a session break the
   line, and the holiday week is one grey band that lines up through every row. Only stalled or
   slipping rows are orange; everything else is grey.
4. **Change column in the lift's own units** (`+10 kg`, `−6 kg assist.`, `same`, `▼ −3 reps`), with
   the baseline named in the column header (`vs 15 Jul ▾`). **Compare is a baseline switch**: at
   `vs 4 wk ago` the slip (`▼ −3 reps`) and the stall (`same`) show, where the 3-month view says
   `+3.75 kg` and `+2 kg`.
5. **No chart pages: the row opens in place** as three panels on the same time axis (top-set
   weight; reps per set at that weight, as bars from zero; e1RM marked *estimated*, thin and last),
   plus the last six sessions with warm-ups listed apart. Bands are labelled (`Holiday`,
   `No A session`, hatched `Deload`). A heavier set with a lower e1RM (Wed 14 Oct) reads as a step
   up in panel 1, annotated `Heaviest weight +2.5 kg`.
6. **Linked scrub.** Dragging any sparkline moves one hairline through all rows. Every row's value
   switches to that date (`—` on the other workout's days), and a sticky readout gives the touched
   lift's working sets, its record, its e1RM and its warm-ups, with `Back to today` and
   `Open session ›`.
7. **Muscles and Records are the same kind of table** (rows × time). Muscles is a heat table of
   2-week blocks against the plan, numbers printed and the typical range muted. Records has a
   records-per-session strip and then one row per lift: best, e1RM (5 lifts only), last record.
8. **Swiss ledger look.** Near-white page, hairline rules, no cards, Consolas numerals and
   Segoe UI labels, one ultramarine for selection, orange only on data that needs attention.

## Tap counts (from app open, Ledger → Lifts)

| Question | Taps | Sequence | Frame |
|---|---|---|---|
| Am I progressing? | 0 | Totals row + attention-sorted rows with change per lift | S1 |
| How's my bench? | 0 (1 for evidence) | Row 2 reads `■ Stalled · 33/40 at 13`, `13×9`; tap the row for the chart and last 6 sessions | S1 → S8d |
| Which muscles am I under-training? | 1 | Muscles segment | S4 |
| What did today's workout achieve? | 2 | Sessions tab → Wed 14 Oct | S6 |

## Honest weaknesses

- **Muscles is the weakest answer.** The heat table is mostly one dark blue, because the lifter did
  the plan. The real finding (the *plan* is light on calves, abs, hamstrings and glutes) lives in a
  sentence and a muted `10–20` column, not in the colour. Colour also carries % of plan (item 10
  partial). S4 is also the most colourful frame: about 85 % neutral pixels, on the limit.
- **The 3M default flatters stalled lifts.** The bench row says `■ Stalled` but its change reads
  `▲ +2 kg`, because 15 Jul was before the plateau. The verdict word wins, but a sceptic will call
  the row self-contradicting until the baseline is switched.
- **Density at All/1Y.** With 22 sessions, the per-set reps bars in S3/S3b become a fine barcode;
  sparklines show no raw points except the latest and the deloads (item 14 partial).
- **Controls live at the top.** Range, sort and baseline are out of thumb reach (item 30); the
  range segments touch, and the baseline toggle is a 24 px header line (item 28).
- A sceptic would say "it's a dashboard". The defence is the table discipline (no tiles, one axis,
  aligned columns). It is still the most demanding concept to read.

## 30-item self-check (principles §6)

| # | | Evidence |
|---|---|---|
| 1 | Pass | S1: totals verdict, change per lift in own units |
| 2 | Pass | kg volume only inside S6 / S8d sessions |
| 3 | Pass | S2 third panel `e1RM (estimated)`; S5 footnote; none for 9 lifts |
| 4 | Pass | S3 `BW−27…BW−19`, `less is better ↑`; S3b `BW+5`; push-ups in reps |
| 5 | Pass | S2 `Warm-ups not counted`; S6 `2 warm-ups not counted`; S8b readout |
| 6 | Pass | S4 2-week blocks (ABA + BAB) vs plan |
| 7 | Partial | Verdicts wait (`Too new · 2 more`), but S7c shows `+1 rep` on 2-session lifts (as briefed) |
| 8 | Pass | S2 hatched deload band, hollow dots off the line; gap bands; breaks |
| 9 | Pass | S5 newest first, at most one per lift per session, kind named |
| 10 | Partial | S4 encodes % of plan by colour (numbers printed) |
| 11 | Pass | none |
| 12 | Pass | 14 small multiples; one emphasis colour |
| 13 | Pass | bars from zero; min/max on every line |
| 14 | Partial | raw points in expanded charts only |
| 15 | Pass | end/best/band annotations only |
| 16 | Pass | ▲ ▼ = on every delta; `−2 kg assist.` wears ▲ |
| 17 | Pass | one domain, one size, holiday band aligned (S8a) |
| 18 | Pass | table is the chart; 6-session mini table |
| 19 | Pass | totals verdict above the first chart |
| 20 | Pass | row → dot or table row → session (2 taps); back works |
| 21 | Partial | one range control on Lifts; Muscles/Records use fixed labelled windows |
| 22 | Pass | S8b |
| 23 | Partial | S5 per-session bars are not tappable |
| 24 | Pass | `Try 15 kg next`; nothing edits the program |
| 25 | Pass | S7a button; S7b/c `Start B ›` + sessions to verdict |
| 26 | Pass | see "homes" below |
| 27 | Partial | values 20 px; the per-row verdict is a 13 px glyph + word |
| 28 | Partial | range segments touch; mini-table rows 22 px; baseline toggle 24 px |
| 29 | Pass | totals + 4 attention rows above the fold |
| 30 | Partial | top controls out of thumb reach |

**Homes of shipped stats.** Per-lift chart: the expanded row. Records: the Records segment.
Volume vs last time: the S6 volume line and the lever column. Muscle map: the S6 body thumbnail
and the Muscles row expansion. Session summary and History: the Sessions tab (calendar + list).
Progression hint: the next-step count in every row, plus `Try 15 kg next`.

## Must-fix truths

T1 S2 mini table, S6 header, S8b readout, S1b legend · T2 S2/S3/S8a bands and breaks, holiday
band through every row · T3 S1 verdicts, S8d `last moved here … no record in the 10 sessions
since` · T4 S5, S6 (4 records), S8d (5) · T5 S2 panel 3, S5 e1RM column (5 lifts) · T6 S3 reversed
axis, ▲ on `−2 kg assist.` · T7 S4 (12 muscles, Lats ≠ Mid back), S6 fractional table.

## Derived numbers (computed in the page from `brief-data.json`)

- Change column = latest non-deload top set vs a baseline: the first non-deload session in range
  (3M: from 15 Jul; 1Y/All: 22 Jun), or the last session on or before Thu 17 Sep (`4 wk ago`).
  Lever differs → kg difference, otherwise top-set reps difference. 3M: pull-down +3.75 kg,
  bench +2 kg, push-ups same, curls +5, squat +10, deadlift +12.5, row +20, shoulder press +7.5,
  assisted −6 kg assist., lunges +5, lateral +3, push-down +12.5, face pull +10, hyper +5 kg.
  4 wk: pull-down −3 reps, bench same, push-ups −2 reps, curls +1, squat +5, deadlift +5, row +5,
  shoulder press +2.5, assisted −2 kg assist., lunges +2, lateral +1, push-down +5, face pull +2.5,
  hyper +5. 1Y: as S8a.
- S4 cells: the mean of the two weeks in `weeks[].muscleSets`, rounded half up; % of plan from
  `plannedMuscleSetsPerWeek`.
- S6/S8d lever: reps summed over the sets at the top weight (bench +1, push-ups 44 vs 47);
  volume change (4,185 − 4,669) / 4,669 = −10 %; Fri 7 Aug vs Mon 3 Aug +8 %.
- Muscle contributions per lift: primary and secondary muscles from `src/data/library/exercises.json`;
  they reproduce the brief's 14 Oct totals.
- 1Y range: the data starts 22 Jun, so 1Y and All draw the same 17 weeks.

## Palette validation

```
node validate_palette.js "#2156D9,#C4511A" --mode light --surface "#FBFBFC"
  [PASS] Lightness band · [PASS] Chroma floor · [PASS] CVD separation ΔE 29.1 (protan), tritan 29.5
  [PASS] Normal-vision floor ΔE 35.3 · [PASS] Contrast vs surface  → ALL CHECKS PASS
node validate_palette.js "#8EAAE0,#5C86D8,#2F62D2,#1B45A8" --ordinal --mode light --surface "#FBFBFC"
  [PASS] Lightness monotone · [PASS] Adjacent ΔL ≥ 0.06 · [PASS] Light-end contrast 2.26:1
  [PASS] Single hue (spread 1°)  → ALL CHECKS PASS
```
Added neutral: gap band `#EFF0F2` (a page-level band, never text). Cell text: ink on the two light
steps, white on the two dark steps (≥ 5.2:1, under the 7:1 asked for row values).

## Render log

| Round | Seen | Changed |
|---|---|---|
| 1 | Deload sessions pulled the step line into deep V-dips (looked like regressions); reps bars were heavy blocks; S2 pushed the row below off-screen; S4 legend and summary clipped at the right; S5 `—` sat low; S6 lever text wrapped and `11.25×10` overflowed, header read `Last A 9`; the body map looked robotic and was cut off; S7b/c hid the B rows under a sticky button; S8 captions wrapped | Deloads drawn off the line (breaks still from all sessions); push-ups get a minimum 6-rep span; thinner, lighter bars; legend removed (bands are labelled); tick thinning; shorter lever wording; 13 px last-A column; anatomical silhouette; next step moved into the totals row on S7b/c |
| 2 | Clean layout; scripted click-through (31 checks) crashed on "tap the dot", because `scrubAt` read the cleared drag; bench's best e1RM was dated 14 Oct (a tie) | Fixed both; the best is the first date that reached the value (Fri 7 Aug) |
| 3 | S4 at 78 % neutral pixels | Heat cells 34 × 24: 84.8 %, at the limit; 31 of 31 click-throughs pass |

## Departures from the brief

- The change and next-step lines use Segoe UI with tabular figures, not Consolas: in mono,
  `▲ −6 kg assist.` does not fit the 90 px column at 13 px.
- S1b shows the last 6 lift rows (the natural end of the scroll), not 4.
- S3 and S3b are drawn at range **All**: the BW−27 step and the 18 bodyweight sessions fall
  before 3M's 15 Jul start.
- The live screen's projection, record moment and volume-vs-last-time would point to the lift's
  Ledger row (not drawn).

---

## Revision 1 (after `reviews/lift-ledger.md` and rulings 1–16)

This section supersedes anything above that it contradicts. In particular, controls, the change
column, S4 and the self-check have changed.

### What changed, by review fix

| Fix | Change | Where to see it |
|---|---|---|
| 1 Blocker (ruling 11) | Stalled and slipping rows measure their change over the verdict window: bench `= 0 since 7 Aug`, push-ups `= 0 since 3 Aug`, pull-down `▼ −1.25 kg, last 2` (from 47.5 × 10 on Mon 28 Sep, the best of the 4 sessions before the last 2). Moving rows keep the range baseline, named in the header. The click-through checks that no ▲ appears beside ■ or ▼ at 1M, 3M, 1Y, All and `4 wk ago`. | S1, S8a, S8c |
| 2 Major | The session callout is computed: what the lift did that day, whether it moved again later, or how many sessions have passed since its last record. It also carries the verdict (ruling 3). Squat on 9 Oct now reads `▲ Moving · … Moved again since: Heaviest weight, Wed 14 Oct`. | S8d, P |
| 3 Major (rulings 1, 4, 12) | New bottom control bar above the tab bar: `1M 3M 1Y All` at 44 × 44 with 8 px gaps, `Sort` and `Change vs` (the baseline). While scrubbing, it holds `‹ Back to today` and `Open <date> ›`. The selected range is a 2 px outline, not a fill. The title and the Lifts/Muscles/Records switch share one 44 px header row, so 10 lift rows still sit above the fold. | all Lifts frames |
| 4 Major (ruling 13) | Heat ramp is now teal `#7FBCB4 #4F9E94 #2F8A80 #1B6159` (ΔE ≥ 20.5 from the accent). Every block is a done-vs-plan bar with an ink plan tick, so length carries the comparison and colour only repeats it. Rows are sorted lightest plan first, and the summary names Shoulders 21 and Lats 19 at the top of 10–20. S4 is now 94.5 % neutral pixels (was 84.8 %). | S4 |
| 5 Major | A drag snaps only to the touched lift's own sessions. The squat line can no longer land on Mon 12 Oct. | S8b, P |
| 6 Major | Mini-table rows are 44 px session links (`›`), so landing → lift → session is 2 taps. Back to today and Open are 44 px in the bar. | S2, S8d |
| 7 Minor | The S8d callout starts `■ Stalled`. | S8d |
| 8 Minor (ruling 5) | e1RM labels show only the latest value (`79.2 latest`) or the scrubbed one (`80.0 on Fri 9 Oct`). The best stays in Records. The S5 strip labels only the max and latest bars. | S2, S5 |
| 9 Minor | Min labels are clamped inside the row, and the 1M ticks are thinned. | S1, S8a |
| 10 Minor | The verdict word is ink 600. It is still 13 px; see self-check 27. | S1 |
| 11 Minor (rulings 8, 10) | Orange only on the stalled or slipping stretch of the line (bench from 7 Aug, push-ups from 3 Aug, pull-down from 28 Sep). Deload dots stay grey. | S1, S2 |
| 12 Minor | The session body map uses its own neutral grey ramp (`#AEB2B9 #90959E #737982 #50565F`, sets today), not the % of plan ramp. S7a's start button moved out of the way of the B rows: a link in the totals, plus the button at the end of the list. | S6, S8d, S7a |
| Ruling 14 | S7c shows raw top sets and `2 sessions` / `baseline`; no ▲ or ▼ before 4 sessions. | S7c |
| Ruling 16 | Bests use the kind names: `Heaviest weight`, `Estimated 1RM`, `Least assistance`, `Rep record` (e.g. `Rep record · BW−19 × 6`). | S5 |

**Kept, against a suggestion, with evidence.**
- *Mini table: last 4 sessions, not the brief's 6.* With 44 px rows, 6 sessions add 88 px to the
  expanded squat row. The rendered S2 has only ~40 px of the row below in view (the board
  crop), so 6 rows would push that row out of view. Four rows keep one row above and one row below in view.
- *The S2 warm-up example line is gone.* The table header now reads `Sets · 2 warm-ups not counted`,
  and the warm-up sets themselves are listed in the scrub readout (S8b). The full line cost the
  row below.

### Palette validation (revision)

```
heat ramp --ordinal "#7FBCB4,#4F9E94,#2F8A80,#1B6159": monotone PASS · adjacent ΔL PASS ·
  light end 2.08:1 PASS · single hue (1°) PASS → ALL CHECKS PASS
each step vs the accent #2156D9 (normal / worst CVD): #7FBCB4 32.1 / 30.4 · #4F9E94 25.2 / 23.8 ·
  #2F8A80 22.2 / 20.6 (tritan 7.0, secondary-encoded by bar length and printed numbers) ·
  #1B6159 21.5 / 20.5
body-map grey ramp --ordinal "#AEB2B9,#90959E,#737982,#50565F": ALL CHECKS PASS (light end 2.06:1)
accent + emphasis "#2156D9,#C4511A": unchanged, ALL CHECKS PASS (ΔE 29.1)
```

### Render log (revision)

| Round | Seen | Changed |
|---|---|---|
| R1 | S1: the bottom bar works, 10 rows above it, verdict-window deltas fit. S4's legend clipped. S2 lost the row below (4 × 44 px table + warm-up line). | Legend shortened; chart panels trimmed (weight 72, reps 30, e1RM 28); warm-up note moved into the table header |
| R2 | S2 shows the row below; S5 had a stray `0` beside `Deload · 0`; S4 legend still clipped `≥100` | Both fixed |
| R3 | Clean. Neutral pixels per frame 94.5–98.2 %. | — |

Click-through (temp copy, real pointer events, 47 checks): **47 pass, 0 fail**. It covers no ▲
beside ■/▼ in every range and baseline; bar targets 44 × 44 with ≥ 8 px gaps, in the bottom third;
outline (not fill) selection; squat drag never landing on a B day; the computed squat callout; the
S8d path; the 44 px table row opening a session; muscle bars and ticks; kind names in bests;
records bars opening sessions; and the sparse states without deltas.

### Self-check, revision 1: 26 Pass · 4 Partial

Changed from the first pass: **7 → Pass** (S7c raw values) · **10 → Pass** (bar + plan tick) ·
**15** stays Pass, now true under ruling 5 · **20 → Pass** (2 taps via a 44 px row) · **21 → Pass**
(bottom bar; fixed windows allowed by ruling 12) · **23 → Pass** (strip bars open sessions).

Still Partial:
- **14**: sparklines show only the latest and deload dots.
- **27**: the per-row verdict is 13 px, though now ink 600.
- **28**: the totals counts and `Start B ›` are ~20 px text buttons.
- **30**: the Lifts/Muscles/Records switch stays at the top.

The rulings also hold:
- 1: the selected range is an outline; the tab and segment use colour text and an underline.
- 2 / 16: one record vocabulary.
- 3: the S8d callout carries the verdict.
- 4 / 12: the bottom bar.
- 5: e1RM at the latest or scrubbed point only.
- 6: 10 lift rows above the fold.
- 7: whole numbers in S4, exact values in the drill-downs.
- 8 / 10: orange only on the stall or slip stretch.
- 9: Consolas numerals.
- 11: verdict-window deltas.
- 13: teal ramp plus bars.
- 14: S7c.
- 15: 90 × 55 sparklines.

## Revision 2 (hard-coded strings)

These were fixed, and all generated text is now computed from the data:
- **Stalled delta:** it compares the last record with the latest set. Push-ups now reads `▼ −2 reps, 3 Aug`; bench still reads `= 0 since 7 Aug`.
- **Chart status line:** it now names each lift's own last-record date, or the slip reference, instead of bench's date for every lift.
- **Session callout:** it handles n = 0 (`Its latest record, set in its latest session.`). The `stalled N sessions` count is now computed.
- **Scrub readout:** the lift name moved to the first line, so every set list fits (assisted pull-ups, the longest, included).

I also replaced every other literal date, count or delta inside generated text:
- range dates and the 4-week baseline are derived from today;
- the "last 3 weeks" window, the 2-week muscle blocks and their `sick+deload` flag come from the data;
- the next session and its weekday, this week's sessions, sets and planned sets (69 from the prescriptions), and the 4-week adherence are computed;
- the ready lift's next weight (`15 kg` = latest + its step) is computed, and so are the attention order's head, the S4 summary, the sparse-state counts and the session-note matching.

One computed line now differs from the brief:
- **S4 "light plan":** it also lists **Biceps** (plan 9.75 → 10), which the brief's prose omits. The data puts it in the same place as Hamstrings and Glutes.

**Verification:**
- An injected dump plus an independent Python re-derivation from `brief-data.json` made **1,046 checks** over the 14 lifts (rows at 1M/3M/1Y/All × both baselines, chart captions, mini tables, readouts, callouts, records, muscles, this-week, sparse states and captions). **0 failures.**
- Click-through: 47 of 47 pass.
- Neutral pixels: 94.5–98.2 % per frame.

**Remaining weaknesses.**
- S4 is now honest and legible, but the A/B finding is still that nothing is under plan. The
  plan-level gap lives in the sort and the summary.
- At All, the per-set reps bars in S3/S3b are still a dense barcode.
- The bottom bar costs 52 px. Ten rows fit only because the header was merged into one row.
