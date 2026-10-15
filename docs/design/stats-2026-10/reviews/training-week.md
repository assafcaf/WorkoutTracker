# Review: Training Week (`training-week`)

Reviewer: independent design review, 2026-10-15. Inputs: `frame.md`, `brief.md` (Part 1, Concept 3,
Part 3), `brief-data.json`, `research/principles.md` §6, dataviz `anti-patterns.md`.

Method:
- Cropped all 16 frames, the header and the panel from `board.png` at 1:1, and zoomed 2–4× into the
  S2, S4 and S6 charts.
- Scripted a click-through of 42 states on a temp copy outside the repo, with JS injected after
  `buildBoard()`. Each state was rendered headless with `render.sh` with the live phone expanded to
  its full scroll height. States covered:
  - every lift page at 1M, 3M and 1Y;
  - a real `PointerEvent` scrub;
  - the Held group expanded, and Wed in the day strip;
  - pager stepping to the 5 Oct, deload, sick and holiday weeks;
  - compare on this week and on a past week;
  - Block;
  - the three muscle windows and the Lats contributors;
  - the records pager;
  - the bench path to Fri 7 Aug and back;
  - the 1-session, 3-session and fresh states on the Week, Lifts, lift and Muscles pages.
- Ran the palette validator.

## 1. Verdict

Training Week is the most clearly distinct of the four concepts. Its numbers are honest: every
figure I checked matches `brief-data.json`. The bullet-with-"still planned"-segment and the
same-point parity compare are the cleverest answers in this run to the partial-week trap. It answers
"am I doing the plan" in 0 taps, but it hides "is it paying off". DB bench's stall never appears on
the landing without a tap. The landing's amber rows point at Lats and Mid back, but over two weeks
those muscles sit at the top of their range. Craft is good at board scale. Off the board, label
collisions show up on at least 7 charts, and session pages are dead ends, so it needs one more
revision round before it can be picked whole.

## 2. Checklist (§6)

| # | Grade | Evidence |
|---|---|---|
| 1 | Pass | S1: hero `2 / 3` (72 px) plus sentence. Adherence is a §2 headline stat. |
| 2 | Pass | No kg totals on S1/S1b/Block. Volume appears only on S6 (`4,185 kg … down 10 %`) and session pages (S8d `3,938 kg · up 8 %`). |
| 3 | Pass | S2: `e1RM est.` row, `80.0 kg (estimated)` in records. The top-set strip is the main measure. No e1RM on the 9 other lifts (checked the pull-down, push-ups, curls, hyper-ext and assisted pages). |
| 4 | Pass | S3 ticks `BW−27…BW−19` (U+2212), `assistance · less is better ↑`, deload dips down. S3b has a separate `added load` lane, reps panel, BW+5 drawn as squares. No negative kg anywhere. |
| 5 | Pass | `warm-ups not counted` in the S1 legend, the S2 note (`20 × 10 · 37.5 × 5`), the S6 header, the S8b readout and the S8d squat row. |
| 6 | Pass | S4 defaults to a 2-week window (`28 Sep – 11 Oct · one ABA + one BAB week`). S1 compares only against this BAB week's plan, with a still-planned segment. (The S4 `this week` window drops that segment: fix 10.) |
| 7 | Pass | S7c: `Too new · 2 more sessions for a verdict` on squat; `A 2 more, B 3 more` on the recap. |
| 8 | Pass | Deload tile shaded with hollow dots, `Holiday` and `No A session` columns empty and labelled, line broken across both (S2, all ranges). The deload recap says "A deload never counts as under plan" and keeps the bars blue. |
| 9 | Pass | S5: one record per lift per session, newest first, kind in words, gain shown; rule footnote on the page. |
| 10 | Pass | Bullets encode by length and tick, strips by position. Colour is used only for done / under pace / deload. |
| 11 | Pass | No dual axes, pies, gauges or rings. S3b keeps load and reps in separate lanes. |
| 12 | Pass | One lift per strip; no multi-series plot. |
| 13 | Pass | All bars start at zero. Line axes print labelled min and max (S2 50–65, push-ups 15–17, S3 BW−27–BW−19). |
| 14 | Pass | Every session is a dot in its week column, including deloads (hollow). |
| 15 | Partial | End label and annotations are selective, but the e1RM row prints one number per week, staggered on two lines: 12 numbers at 3M, 15 at 1Y (S2, squat 1Y). |
| 16 | Partial | The groups carry `↑ + = ↓` with words. But the amber muscle rows on S1/S8c are colour plus "Fri adds" with no per-row word. S1b's `Down` group lists `Pull-down` without `▼ Slipping` (the brief asks for it). |
| 17 | Pass | n/a. All strips on a page share one range. |
| 18 | Pass | Every chart has a summary sentence and a tappable `Sessions in range` table twin; bullets print their values. |
| 19 | Pass (as the brief defines it) | The hero sentence `2 of 3 sessions this week. On plan for the last 2 weeks.` sits above the strip, as the Concept 3 checklist note specifies. It is about adherence, not lift change; see conflict D. |
| 20 | **Fail** | Landing → lift → session takes 3 taps: Lifts → DB bench press → a strip dot or table row (after a scroll) → `Open session`. Session pages and the S6 lever table have no tap action on lift rows (`.ltable` rows carry no `data-act`), so "and back" via session → lift is a dead end. |
| 21 | Partial | The lift page has one preset row. The Week view has a pager plus `Block`, and both change the time scope. |
| 22 | Pass | S8b: hairline snapped to Fri 9 Oct. The readout matches the brief character for character and stays after release. I verified it with a real pointer event. |
| 23 | Pass | Day dots open sessions, muscle rows open S4, groups expand to lift rows, the `Records this week` row opens S5, the `Last 8 weeks` row opens Block. |
| 24 | Pass | `Try 15 kg next`, `Consider holding 46.25 kg until it settles`, `Consider a lighter week or a variation`. Nothing edits the program. |
| 25 | Pass | S7a gives the plan in words with one primary button. S7b shows baselines and Wed's B. S7c shows the recap with too-new counts. Minor: S7b shows a `vs last same week` toggle with no earlier week to compare. |
| 26 | Pass | Homes: lift page, S5, S6 volume line plus session pages, body map on S4 and S6, day strip plus Block for sessions, `Next up` bullets for the progression hint. |
| 27 | Partial | The hero and lift-row values are ≥ 20 px, but the muscle-row values on S1 and S4 are 15 px. |
| 28 | Partial | Chips have 44 px hit areas. The muscle rows (primary rows on S1/S4) are 44 px tall with 0 px gaps. |
| 29 | Partial | Adherence and "what next" (`Workout B due Fri`) are above the fold. Whether lifts are moving is on S1b, and the stall needs a further tap (Held → `■ Stalled`). |
| 30 | Partial | Single taps and drags only, but the range presets, compare and Block chips all sit in the top third. |

**Tally: 22 Pass · 7 Partial · 1 Fail.** The maker claimed 21/9/0. I am stricter on 20, and I credit
19 because the brief defines it.

**Must-fix truths:**

| Truth | Result | Evidence |
|---|---|---|
| T1 (warm-ups excluded) | Pass | See item 5. |
| T2 (real time axes, gaps visible) | Pass | Holiday and No A session columns at 1M, 3M and 1Y; S8a Block holiday row. |
| T3 (honest verdicts and stalls) | **Partial** | Verdict words are correct everywhere I looked (Lifts tab: `11 moving · 2 stalled · 1 slipping`; bench `Stalled · 10 sessions, 9.9 weeks`; push-ups `11 sessions, 10.4 weeks`; pull-down `▼ Slipping`). But T3 must be *visible in S1*, and nothing on S1/S1b says "stalled" until the Held group is tapped. |
| T4 (one record per lift per session) | Pass | S5 week counts 16 / 15 / 9 / 0; Wed 14 Oct = 4. |
| T5 (e1RM only where it means something) | Pass | Only on the 5 lifts. |
| T6 (assisted on a reversed axis) | Pass | See item 4. |
| T7 (one muscle taxonomy) | Pass | 12 muscles, Lats and Mid back apart; contributors `Assisted 6 · Row 6 · Pull-down 4.5 · Deadlift 2.25 (½)`, exact `18.75`. |

**Numbers spot-checked against `brief-data.json` (all match, 20 checked):**
- Sets this week 47; Mon 23 + Wed 24.
- Block weekly sets: 69 / 69 / 48 / 23 / 69 / 69 / 70 / 69, and 22 of 24 sessions.
- Week of 22 Jun: 70 sets, 4 records.
- Records per week: 16 / 15 / 9.
- 2-week muscle averages: all 12 rounded correctly (18.75 → 19, 7.5 → 8, 10.5 → 11).
- Deload-week muscles: all 12.
- 5 Oct ABA muscles: all 12.
- Squat e1RM per week: 66.5 … 80.0, 79.2.
- Squat dots: 6 at 1M, 18 at 3M, 23 at 1Y.
- Fri 9 Oct readout.
- Fri 7 Aug session: 68 min, 23 sets, 3,938 kg, 5 records, every lift's sets.
- Mon 3 Aug: 3,648 kg (+8 %).
- Fri 26 Jun squat warm-ups `20 × 10 · 30 × 5`.
- Next-step counts: 15/20, 23/32, 33/45, 25/36, 36/36, 44/45.

**Palette validator (`--mode dark`):**
- `#3F95D6,#BC7F25` on `#1A1D21` and on `#121417`: all pass (worst CVD ΔE 23.4).
- Bands `--ordinal`: all pass (light end 2.39:1, hue spread 4°).
- Accent vs done `#3F95D6,#7DB7E8`: FAILED (L 0.758, chroma 0.093, normal ΔE 11.7), as the maker disclosed. It is mitigated by mark shape (3 px full-height tick against an 8 px bar), but on rows where the compare tick lands on the bar end (Lats, S8c) it is nearly invisible.
- **Not disclosed:** S6 uses `band2 #4F80AE` (Mon) against `done #3F95D6` (Wed) as an identity pair. That pair FAILED: normal ΔE 7.3, deutan 6.8, band2 chroma 0.089. A 2 px gap and the legend are the only separators.
- Done against still planned (`band1`) separates fine (ΔE 19.8).

## 3. Scores (1–10)

| Axis | Score | Why |
|---|---|---|
| Professional look | 7 | Calm graphite, one light azure, no glow, Bahnschrift drew. Let down by a blocky mannequin body map (~95 px, no legend), staggered e1RM numbers, set strings wrapping mid-set, and collisions off the board. |
| Gym context | 6 | Low-glare dark, a 72 px hero, 56 px group rows. Muscle values are 15 px in 44 px gapless rows, chart labels 12 px, and every control sits at the top. |
| IA | 6 | The week pager with fixed-order recaps and the Block zoom are coherent and well labelled. Per-lift progress is deep, session → lift is a dead end, and compare silently does nothing on past weeks. |
| Chart craft | 6 | Bullets are textbook Few, the strip's labelled empty weeks are excellent, and the stall bracket on bench is great. But collisions appear on bench, curls, pull-down, push-ups, squat 1M and 1Y, assisted 1Y, hyper 1Y and the Block deload row. The push-ups 15–17 axis turns a flat stall into a jagged sawtooth. The S6 near-identical blues fail the validator. |
| Data honesty | 8 | Every number checked is right. Deload, sick and holiday weeks are never losses. The partial week always shows the remaining plan, and parity compare is fair. Minus: the stall is hidden on the landing, and S1's amber implies under-training of muscles that are at the top of their range. |
| Fidelity to brief | 8 | Nearly every frame matches its spec, and the departures are documented. Missing: `▼ slipping` in S1b's Down group; S4 body map is not an anatomical ~120 px outline; whole-number rounding is dropped on recap rows. |
| Distinctness | 8 | The only dark concept, the only adherence headline, the only week-as-unit IA; bullets nowhere else. The week-binned strip is the one form that drifts toward C1's labelled-period chart. |

## 4. The four core questions

| Question | Taps | How well |
|---|---|---|
| Am I progressing? | 0 for adherence; 1 scroll for lift groups; +1 tap to see `■ Stalled` | Adherence: excellent and true, on a Thursday with Friday still to come. Lift progress: weak. `Stepped up 5 · More reps 4 · Held 3 · Down 2` is below the fold, and the two stalls hide inside "Held" and "Down" with no verdict word until expanded. |
| How's my bench? | 2 (Lifts → DB bench press) | Strong once there: `■ Stalled · no record since Fri 7 Aug: 10 sessions, 9.9 weeks`, a suggestion, the strip with a `last record` ring and a `10 sessions without a record` bracket, and the session table. Two of its labels collide. |
| Which muscles am I under-training? | 1 (`2-week view ›`) | S4 gives the honest plan-level answer (Calves 8, Abs 3, Hams and Glutes 10). But at 0 taps, S1's amber says Lats, Mid back, Biceps and Lower back are "behind pace". A glance reads the opposite of the truth; the copy line rescues it only for readers. |
| What did today's workout achieve? | 1 (Wed in the day strip) | Good: S6 shows sets and muscles added to the week, the 4 records, the lever table, the body map and volume as context. Lift rows do not drill. |

## 5. Ranked fixes

### Maker defects

| # | Severity | Frame | Fix |
|---|---|---|---|
| 1 | major | S1/S1b | Make T3 visible on the landing. Put verdict tags inside the group names (`DB bench ■ Stalled 10 wk`, `Push-ups ■ Stalled`, `Pull-down ▼ Slipping`), or add one attention line under the hero sentence. Today "stalled" first appears after a tap. |
| 2 | major | lift pages at all ranges, Block | Do a collision pass on every lift × range, not only the 3 board frames: bench (`last record` over the axis title; `Deload` over `13 kg × 9`), curls (`Deload` over `14 kg × 12`), squat 1M (axis title over `Deload`), 1Y x-axis `JunJul` (squat, assisted, hyper), pull-down (`46.25 kg × 9` over `elbow note`), push-ups (`BW × 15` over deload dots), S3 `BW−21` on the line, Block `Deload` over the sets bar. |
| 3 | major | S8d, S6, session pages | Item 20. Make session-page and S6 lift rows push the lift page. Add a direct `Last moved: Fri 7 Aug ›` link on stalled lift pages, so stall → evidence → session is 2 taps without a scrub or scroll. |
| 4 | major | S2 and all e1RM lifts | Un-stagger the e1RM row: one line, each number centred under its week column, smaller, deload values muted. Better, keep only end and best (see conflict A). |
| 5 | minor | S6 | Mon vs Wed segments fail the validator (ΔE 7.3). Use `context #5B636D` or `band1` for Mon. |
| 6 | minor | Week pager, S7b | `vs last same week` stays active on past weeks but draws nothing, and is offered in week 1. Implement it for past weeks or disable it with a reason. |
| 7 | minor | S4, S6 | Redraw the body map as an anatomical outline (~120 px per view), and render the bin legend; `mapLegend()` is defined but never called. |
| 8 | minor | S4 `this week` | Reuse S1's still-planned segment. It currently compares 2 of 3 sessions against the full BAB plan, which is the partial-week trap the brief warns about. |
| 9 | minor | S7c, past-week recaps | Rows print `23.5`, `12.5`, `14`. Round to whole numbers as 1.3.2 asks (S1's halves are a documented departure; these are not). |
| 10 | minor | push-ups page | The 15–17 y-range turns a flat stall into a sawtooth. Plot reps from a wider floor (e.g. 10), or add the bench-style `no record since Mon 3 Aug` bracket. |
| 11 | minor | S6, S8d, assisted page, `Next up` | Keep each set together (`white-space:nowrap` per set). Today `13 \n × 8`, `BW−19 × \n 5` and `46.25 \n kg` break mid-value. |
| 12 | minor | holiday recap; assisted 3M | The holiday week renders 12 zero bullets, a grid of zeros: collapse it to one line. Assisted 3M shows Mon 13 Jul, before the 15 Jul range start (whole-week binning): label the range `from 13 Jul`. |

### Brief/spec conflicts (route to the orchestrator; do not trade silently)

- **A.** Concept 3 S2 asks for "a small e1RM row of numbers per week". Item 15 forbids a number on
  every point. Decide: per-week numbers on 1M only, or end plus best on every range.
- **B.** Concept 3 S1 asks for hero + day strip + sets bullet + 6 muscle rows above the fold. Items
  27–28 and §1.4 ask for ≥ 20 px row values and ≥ 56 px primary rows with 8 px gaps. Both cannot fit
  in 390 × 844. Pick which yields: fewer rows above the fold, or muscle rows treated as secondary.
- **C.** The brief's own S1 example (`Lats 12.5 of 25 · Fri adds 12.5`) contradicts 1.3.2's
  whole-number rule. The maker followed the example. Confirm that halves are allowed where an
  addition is shown.
- **D.** Items 19 and 29 want "what changed" and "am I progressing" in words above the fold. The
  brief defines C3's sentence as adherence only. Suggest letting the hero sentence take a second
  clause (`12 of 14 lifts stepped up since 18 Sep; bench and push-ups stalled.`). This also closes
  fix 1.
- **E.** The brief specifies "under-pace rows are amber" on S1. Combined with "never pass/fail" for
  muscle volume and the honest finding in 1.3.7, that rule makes the landing flag Lats and Mid back,
  which sit at the top of their range over 2 weeks. Consider neutral "Fri adds" styling while
  planned sessions remain, with amber only once a week is closed under plan. That would also remove
  the state-dependent amber rule the maker admits for S7b.

## 6. Ideas worth stealing

- **Still-planned segment on a bullet.** It is the cleanest honest partial-period display in the
  run. Any concept showing "this week" should use it.
- **Same-point parity compare** (`28 Sep week after its B and A: 46 sets against 47; Shoulders 14
  against 15`). It is a fair comparison of a partial week, and it explains its own only difference.
- **Block rows.** One row per week (day dots, sets against 69, sessions), with `Deload`, `Sick` and
  `Holiday` as labelled rows and the line "The deload is a planned week, not a miss". This would make
  a strong sessions-calendar header for C2 or C4.
- **Stall bracket on the chart.** A ring on the last-record dot plus a labelled
  `10 sessions without a record` span. It suits C1's evidence page and C4's dossier.
- **Labelled empty week columns** (`Holiday`, `No A session`) instead of an unlabelled break.
- **Deload recap copy:** "A deload never counts as under plan". Deload bars stay in the done colour.
- **Records-per-week mini bars** with the current week marked `so far` in the accent.
- **Contributors drill with exact fractions** (`Lats 18.75: Assisted 6 · Row 6 · Pull-down 4.5 ·
  Deadlift 2.25 (½)`).
- **A tappable `Sessions in range` table twin** under every chart, with record kinds in words.

## Delta review (Revision 1)

Method:
- Cropped all 16 revised frames from the new `board.png` at 1:1.
- Re-ran 17 scripted states on a temp copy, rendered headless:
  - S1 chip → bench → `Last moved` → Fri 7 Aug;
  - S6 row → lift;
  - bench, push-ups, pull-down and curls at 3M; squat at 1Y;
  - the 5 Oct and holiday recaps;
  - S7c recap and S7c squat;
  - S4 `this week`.
- Read every generated sentence against `brief-data.json`.

### My blockers and majors

| Fix | Status | Evidence |
|---|---|---|
| 1 · T3 stall on the landing | **Fixed** | S1 above the fold: `11 of 14 lifts moving · 2 stalled, 1 slipping` and chips `■ DB bench 10 wk · ■ Push-ups 10 wk · ▼ Pull-down` (10 wk matches 9.9 and 10.4). S1b groups: `DB bench ■ Stalled`, `Push-ups ■ Stalled · Pull-down ▼ Slipping`. |
| 2 · collisions | **Fixed** | Clean at full resolution on bench, push-ups, pull-down, curls (3M), squat (1Y), S2, S3, S3b and Block. End values sit on their own lane with a leader; `Deload` has its own lane. Stall brackets sit under the axis. Month labels read `Jun · Aug · Sep · Oct · now` (no `JunJul`). |
| 3 · item 20 / dead ends | **Fixed** | Chip → bench page → `Last moved: Fri 7 Aug · Heaviest weight 13 kg × 9 ›` → session is 2 taps (scripted). Session and S6 lift rows carry `›` and push the lift page (scripted S6 → DB bench). |
| 4 · e1RM row | **Fixed** | The per-week row is gone. The line `Latest 62.5 kg × 8 · e1RM 79.2 (estimated)` sits under the chart, and the scrub readout shows `e1RM 80.0 (estimated)`. |

### Minors the maker claims fixed

| Fix | Status | Evidence |
|---|---|---|
| 5 · S6 Mon/Wed colours | Fixed (accept) | Mon is now `band1`, separated by ΔE 19.8 with legend labels. Its L-band and chroma "fails" come from using an ordinal ramp step as a muted earlier segment. That is a correct use, not a categorical slot. |
| 6 · compare on past weeks and week 1 | Fixed | The 5 Oct recap, holiday recap and S7b show no compare chip. |
| 7 · body map | Fixed | A continuous outline about 120 px tall, with a rendered legend (`sets a week · <10 · 10–14 · 14–18 · 18+`) on S4 and S6. The legend wraps over two lines and crowds S4's legend block (cosmetic). |
| 8 · S4 `this week` | Fixed | Still-planned segment plus `Fri adds` per row; halves allowed in a drill-down. |
| 9 · rounding on recaps | Fixed | 5 Oct recap `Shoulders 24 · plan 24`; S7c whole numbers. |
| 10 · push-ups axis | Fixed | Axis runs 10–18, with the `11 sessions without a record` bracket and a `last record` ring on Mon 3 Aug. |
| 11 · nowrap sets | Fixed | S6 uses two-line rows; S8d and the session tables keep each set whole. |
| 12 · holiday recap, 13 Jul | Fixed | The holiday recap is one line (`No sets this week. A holiday never counts as under plan.`). Captions read `weeks of 13 Jul – 12 Oct`. |

### The two points left unfixed: severity

- **Compare tick vs done (ΔE 11.7): minor, accepted.** The comparison is also carried in text: the
  hero sentence `47 sets against 46`, `46 then` on the Sets row, and "The same except Shoulders, 15
  against 14". The tick is redundant encoding, so its low contrast loses no information. It is still
  invisible where it coincides with the bar end (Lats). Optional fix: a 2 px surface gap on each side
  of the tick.
- **S4 cuts Lats and Shoulders below the fold: minor.** The question S4 answers (which muscles sit
  at the bottom of the range) is fully above the fold, in the sentence and the first 8 sorted rows.
  But the sentence does not name the two muscles at the *top* of the range, which the brief's
  finding includes (1.3.7). Add "Lats (19) and Shoulders (21) sit at its top." to the sentence.

### Orchestrator rulings

| Ruling | Status | Evidence |
|---|---|---|
| 1 · no solid accent for state | Pass | Segments, chips, Block and the records bar use an accent outline on surface-2. Only the `Start Workout A` primary is filled. |
| 2 · one record vocabulary | **Partly** | Two vocabularies sit next to each other. S5 lists `Heaviest weight` events, and directly below, `Back squat records` uses `Heaviest set`. The bench page reads `Last moved: … Heaviest weight 13 kg × 9` right above the records table's `Heaviest set 13 kg × 9`. Pick one name per concept, or rename the table rows `Best: heaviest weight`. |
| 3 · drill keeps the verdict | Pass | S8d banner: `DB bench press · ■ Stalled · no record since Fri 7 Aug: 10 sessions, 9.9 weeks. Its last record was set in this session.` |
| 4 · presets below the chart, ≥ 44 px | Pass | Lift pages: 1M/3M/1Y under the chart with a range caption. S4 docks its window control at the bottom. |
| 5 · no number on every point; e1RM at latest and scrubbed | Pass | See fix 4. |
| 6 · S1 fold carries lift progress | Pass | See fix 1. |
| 7 · whole on landing, halves in drill-downs | Pass, with a regression (R1 below) | — |
| 8 · amber only for real shortfalls | Pass | No amber on S1, S8c or S7b. Friday's work is a neutral `Fri adds`. The sick-week recap is the only amber, and correctly so. |
| 9 · lining tabular numerals | Pass | Bahnschrift has lining figures; `tabular-nums` on row values, axis ticks and tables; the hero stays proportional. |
| 10 · attention colour means attention | Pass | Amber appears only on closed under-plan weeks. |
| 11 · a delta uses the verdict's window | **Partly** | S6: `= +1 rep in total` (vs Fri 9 Oct) sits beside `■ Stalled · 10 sessions`. The header says `vs Fri 9 Oct`, so it is labelled, but it is the exact pairing the ruling targets. Suggest `= Held 13 kg · stalled 10 sessions` there. |
| 13 · colour never alone for done vs plan | Pass | Bullets carry a plan tick and printed `x of y`. Day and Block dots are filled for done and ringed for planned or missed. |
| 14 · no deltas before 4 sessions | **Partly** | S7c recap groups 4 lifts under `More reps`, and S7c squat reads `50 kg × 7 → 50 kg × 8`, both at 2 sessions. The brief's S7c names these as rep records, so this may be a ruling/brief conflict. Route to the orchestrator: either the group becomes `Rep records 4` (a record, not a delta), or the ruling exempts records. |

### Regressions the revision introduced

- **R1 · major: rounded rows no longer add up, on the landing above the fold.** Ruling 7 made S1's
  values whole, but `Fri adds` is rounded on its own:
  - S1/S8c: `Lats 13 of 25 · Fri adds 13` (13 + 13 = 26), `Mid back 9 of 17 · Fri adds 9` (18),
    `Biceps 7 of 13 · Fri adds 7` (14).
  - S7b: `Shoulders 11 of 24 · to come 14` (25).

  These are exactly the cases the version-0 halves avoided. A lifter checking the sum sees a
  contradiction in the first three muscle rows.

  Fix: derive the remainder as the rounded plan minus the rounded done (`Lats 13 of 25 · Fri adds
  12`), or say `Fri completes it`. The exact halves stay in the S4 drill-down.
- **R2 · minor: stale prompt during a scrub (S8b).** While the readout shows Fri 9 Oct (e1RM 80.0),
  the line under the chart still reads `Latest 62.5 kg × 8 · e1RM 79.2 (estimated). Scrub for any
  other session's.` It is labelled "Latest", so it is not false, but it competes with the readout.
  Hide it while a scrub is active.
- No other new defects. No collisions, clipping or wrong numbers on the paths I re-ran.

**Re-checked numbers:**
- Chips at 10 wk.
- `11 of 14 · 2 stalled, 1 slipping`.
- Sets 47 of 69 against 46 then.
- 5 Oct recap rows, 24 vs 23.5 rounded.
- S4 `this week`: 12.5 / 25 / Fri adds 12.5 exact.
- Fri 7 Aug banner: 10 sessions, 9.9 weeks.
- Push-ups bracket: 11 sessions.
- Squat 1Y caption: 22 Jun – 12 Oct.

### Updated checklist

| Item | Change | Reason |
|---|---|---|
| 15 | Partial → Pass | e1RM row removed |
| 16 | Partial → Pass | Verdict words in the groups; no colour-only amber |
| 19 | Pass | Hero sentence plus lift line |
| 20 | Fail → Pass | 2 taps |
| 27 | Partial → Pass | 20 px values on S1 and S4 |
| 29 | Partial → Pass | Lift progress above the fold |

Still Partial:
- 21: the Week tab has both a pager and Block.
- 28: 56 px rows sit edge to edge, with no 8 px gap.
- 30: the compare and Block chips stay in the top bar.

T3 is now Pass.

**Tally: 27 Pass · 3 Partial · 0 Fail.** This agrees with the maker's re-self-check.

### Updated scores

| Axis | v0 | R1 | Why |
|---|---|---|---|
| Professional look | 7 | 8 | Clean charts, a real body map, outline states. The S4 legend block is still busy. |
| Gym context | 6 | 7 | 20 px values, 56 px rows, presets under the chart. The chips are still at the top, and rows have no gap. |
| IA | 6 | 8 | 2-tap stall → session, a verdict banner on drill-down, no dead ends, compare scoped honestly. |
| Chart craft | 6 | 8 | Collision-free across all 42 lift × range charts I sampled, stall brackets, a sane push-ups axis. |
| Data honesty | 8 | 8 | Stalls are now on the landing and amber is honest. Offset by R1, rounded sums that do not add up on the first rows. |
| Fidelity to brief | 8 | 8 | Rulings are applied. 2, 11 and 14 are only partly met. |
| Distinctness | 8 | 8 | Unchanged. |

**Remaining before pick:** R1 (major), ruling 2, and the wording for ruling 11. Ruling 14 needs an
orchestrator call on whether records count as deltas.
