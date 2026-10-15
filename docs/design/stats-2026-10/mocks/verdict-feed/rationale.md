# Verdict Feed: rationale

**Thesis.** Stats are a short list of findings written in words, ranked by what needs action. Every
finding carries a 48 px evidence sparkline and opens the chart and the sessions behind it.

## Key decisions

1. **The verdict comes before any chart.** S1 opens on two serif sentences, then a 4-up count row
   (`▲ 11 · ■ 2 · ▼ 1 · ↑ 1`). The first two attention cards end at y ≈ 718, above the tab bar, so the
   answer to "am I progressing, and what next?" needs no scroll.
2. **No claim without its data (the risk warning).** Every card has a sparkline on one shared 3-month
   span and the current top set at 20 px. `Why?` expands in place to show the rule in one sentence and
   the four sessions that triggered it. The finding's period is the only claret band on its chart.
3. **The annotated period chart.** A step line of the top set, a dot for every session, and labelled
   bands: `Holiday`, `No A session`, `Deload`, `Stalled 10 wk`, `Slipping`, `Bodyweight only`, and the
   assistance steps. The line breaks across any week without a session of that lift. Deload segments
   are grey with hollow dots. Band labels are packed into lanes, and the plot starts below the
   lanes actually used.
4. **e1RM is a thin reference line, never the lead.** It shares the kg axis (same unit, one axis)
   and is labelled `e1RM (estimated)` at its end. Wed 14 Oct's ring and the gutter note
   "heavier, fewer reps: a step up" make the 79.2 < 80.0 dip read as progress.
5. **Hand off to words when a mark can't be clear.** On S3b the reps axis drops from 15 to 12 when load
   is added, so a claret note says "+5 kg added, reps reset to 12: a step up, not a drop". On S3 less
   assistance is plotted higher, with ticks from `BW−27` to `BW−19` and no negative numbers.
6. **The readout is always present.** The grey card above each chart shows the latest session.
   Scrubbing (S8b) or comparing (S8c) rewrites it in place, so the hairline never covers data. The
   warm-ups line ("not counted") is always in view.
7. **No green.** Moving is ink with `▲`. Attention is claret with `■`/`▼` and the word. Blue appears
   only as the reference (the e1RM line and the then-vs-now tick) and in the body-map ramp.

## Tap counts (from app open, Progress tab)

| Question | Taps | Sequence | Frame |
|---|---|---|---|
| Am I progressing? | 0 | Read the verdict and the count row | S1 |
| How's my bench? | 0 (answer) · 1 (evidence) | Card 1 states it; tap the card | S1 → S8c |
| Which muscles am I under-training? | 1 + scroll | Muscles finding answers it; tap it for the dot plot | S1b → S4 |
| What did today's workout achieve? | 1 + scroll | Records finding "4 records yesterday" → summary | S1b → S6 |

## Honest weaknesses

- **Muscles and the latest workout sit below the fold.** Both need a scroll. Concept 3 answers the
  muscle question with no taps at all.
- **Browsing a healthy lift is slow.** It is scroll → `11 lifts moving` → expand → row, or footer →
  `All 14 lifts`. Eleven lifts that are fine are collapsed into one line by design.
- **The trust ceiling is the rules.** A skeptic will say this is a coach voice over a ledger. If a
  rule misfires, the sentence states it in large serif type. `Why?` reduces the risk but does not
  remove it.
- **The weakest frames are S8c (bench compare) and S3.** In 3M the bench chart stacks three label lanes
  and prints a reps figure under 12 dots, which is dense. The S3 staircase is honest but small: five
  steps in 216 px.
- **Thumb reach.** Range presets sit at y ≈ 230, top-third of the screen, per item 21's "above the
  content". The range buttons are 40 px tall inside a 44 px control.
- **Sparse states.** The S7b/S7c rows are not tappable (no evidence page for 1–2 sessions).

## Departures from the brief

- **S3 and S3b open on `All`, not 3M.** Their findings ("since Wed 24 Jun", "after 15 sessions") are
  longer than 3M. The rule is: the evidence page opens on the shortest preset that holds the
  finding's period. Back squat and bench open on 3M.
- **Biceps added to the under-10 list** (S1b, S4). Its plan is 9.75 sets, the same as hamstrings and
  glutes. Leaving it out would be a wrong finding.
- **S6 order.** The volume line sits under the lever table, before the body map, so it stays on
  screen. In the brief's order it fell below the fold.
- **Pushed pages hide the tab bar** (iOS `hidesBottomBarWhenPushed`). This gives the chart and records
  room. Back is always the top-left chevron.
- **1Y equals All** because history starts on Mon 22 Jun. The 1Y axis starts there, not on an empty year.
- **The live set screen** (out of scope): its PR toast and projection would point to the lift's
  evidence page. They are not drawn here.

## Self-check (principles §6)

| # | Result | Evidence |
|---|---|---|
| 1 | Pass | S1 leads with the stall/slip list in words. |
| 2 | Pass | Tonnage only on S6 and session pages (S8d). |
| 3 | Pass | `e1RM (estimated)` on S2, S8a–c; top set is the primary line. |
| 4 | Pass | S3 reversed, `assistance · less is better`, U+2212; S3b reps and `BW+5`. |
| 5 | Pass | S2/S8b readout: "Warm-ups … not counted"; S6 meta line. |
| 6 | Pass | S4 sets vs plan, 2-week ABA+BAB window; 4-week flags the deload. |
| 7 | Pass | S7c `○ Too new · 2 more sessions`; verdict counts with glyphs. |
| 8 | Pass | S2 Holiday / No A session / Deload bands, hollow grey deload dots, line breaks. |
| 9 | Pass | S5 one per lift per session, kind named, newest first, 3 per day. |
| 10 | Pass | Position and length only; claret marks the finding period. |
| 11 | Pass | One axis per chart; no pies, gauges, rings. |
| 12 | Pass | One lift per chart; feed sparklines are small multiples. |
| 13 | Pass | Labelled min and max ticks on every axis; progress bar from 0. |
| 14 | Pass | Every session is a dot. |
| 15 | Partial | Selective end/best/annotation labels, but bench prints reps under 12 dots. |
| 16 | Pass | Glyph + word on every verdict and lever; less assistance plotted up. |
| 17 | Pass | Feed sparklines: 3M span, 48 px. |
| 18 | Pass | Sentence above every chart plus the readout/records rows. |
| 19 | Pass | S1 verdict before any chart. |
| 20 | Pass | Card → evidence → Records row → session: 2 taps; back works (scripted). |
| 21 | Pass | One preset control per evidence page, above the chart, selected state drawn. |
| 22 | Pass | S8b hairline at Fri 9 Oct, readout of its working sets. |
| 23 | Partial | Full feed: everything leads somewhere; sparse rows S7b/S7c do not. |
| 24 | Pass | "Try 15 kg next Friday", "Consider …"; no editing control. |
| 25 | Pass | S7a expectations + `Start Workout A`; S7b baselines; S7c first deltas. |
| 26 | Partial | Every home exists; History is a footer row (scroll + tap), not a tab. |
| 27 | Pass | Row values 20 px; the verdict 22 px serif in ink, 18.6:1. |
| 28 | Partial | Rows ≥ 44 px, cards ≥ 56 px; range buttons 40 px inside a 44 px control. |
| 29 | Pass | Verdict, counts and two cards above y 754 on S1. |
| 30 | Partial | Presets are mid-top, outside easy thumb reach; no pinch anywhere. |

## Must-fix truths: where visible

T1 S2/S8b readout + S6 meta · T2 S2, S3, S8a (breaks + labelled bands) · T3 S1 cards and `Why?`, S8d
· T4 S5 (one per lift, kinds), S6 · T5 e1RM only on the 5 lifts, labelled; S3/S3b/S1 cards have none ·
T6 S3 · T7 S4 (12 muscles, Lats and Mid back separate; forearms/traps only in the body map note), S6.

## Derived numbers

- Calves contributors, S4 drill-down: 1.5 sessions a week × planned sets × ½ (secondary). Back squat
  3, Lunges 2.25, Deadlift 2.25, total 7.5 = `avg2`.
- "4 weeks ago" = the last non-deload session on or before 17 Sep: Fri 11 Sep (A lifts) and
  Mon 14 Sep (B lifts).
- Session pages other than Wed 14 Oct: the volume change against the previous same workout, from
  `loadedKg` (Fri 7 Aug: 3,938 vs Mon 3 Aug 3,648 kg → up 8 %).
- S5 "6 earlier days · 31 records" = 40 − 4 − 5.
- Moving lifts without a written finding: "N records in your last 4 sessions", counted from
  `sessions[].prs`.

## Palette validator output

```
node validate_palette.js "#9E1F4E,#2B5DA8" --mode light --surface "#FFFFFF"
  [PASS] Lightness band · Chroma floor · CVD worst adjacent ΔE 16.0 (protan) · Normal-vision ΔE 23.8 · Contrast ≥ 3:1
  → ALL CHECKS PASS
node validate_palette.js "#9DB5DE,#6F90CA,#466FB5,#1F4C8F" --ordinal --mode light --surface "#FFFFFF"
  [PASS] Lightness monotone · Adjacent ΔL ≥ 0.06 · Light-end contrast 2.08:1 · Single hue (spread 3°)
  → ALL CHECKS PASS
```

Added shades: the body-map ramp above. Two earlier, lighter ramps (`#DCE5F3…`, `#A3BBE2…`) failed
light-end contrast and were dropped. I also added `--band #ECEEF1`, a neutral wash for gap and
deload bands.

## Revision 1 (after the independent review)

**Maker defects fixed**

- **Sick week vs deload.** A gap is a flat wash; a deload is a 45° hatched band. Neighbouring bands
  keep 1 px of page between them, and each label is centred on its own span (S2, S8a–c).
- **Reps and e1RM labels (ruling 5, C).** Reps (`×8`) and the e1RM value print only at the latest
  point and the scrubbed point; events say theirs in words. The per-dot e1RM markers and the
  "80.0 best" label are gone; the best e1RM stays in the Records rows. This removes the Pull-down
  `109`, the Curls `101112`, S3's riser `5` and the bench row of 12 numbers.
- **Body map.** Redrawn as an anatomical front/back silhouette from mirrored paths (delts, pecs,
  biceps, forearms, abs, quads, calves; traps, mid back, lats, lower back, triceps, glutes,
  hamstrings). Unworked muscles use the band neutral.
- **Deadlift e1RM dip.** Any e1RM lift whose latest session is a Heaviest weight record with an e1RM
  under its best gets the gutter note "heavier, fewer reps: a step up". That is Back squat and
  Deadlift (70 × 7, 86.3 under 90.0).
- **Push-ups sparkline.** The feed y-scale ignores deloads (they clamp to the floor) and is never
  narrower than 25 % of the top value. 15 ↔ 17 is now a modest step, not a cliff.
- **S3 wording.** "2 kg less / assistance / Wed 7 Oct", no minus sign.
- **Copy.** The Push-ups Why? now reads "Wed 14 Oct: 44 of 45 reps". `ALSO THIS WEEK` becomes
  `MORE FINDINGS`.
- **Also fixed from the review's list.**
  - The S1b mini-strip is replaced by "Fewest: abs 3, calves 8 · most: shoulders 21 sets a week".
  - S7b and S7c get a start button; the S7c count tiles are now plain text.
  - S6 and S8d each carry a glyph key.
  - The S4 plot is 200 px wide (was 170).

**Rulings applied**

1. The active compare chip is an outline, not a filled block.
3. The S8d session page shows "■ DB bench press · Stalled" under the nav.
4. Range presets and compare sit under the chart, 44 px.
5. Applied as above.
- **A.** A DOM pass moves every numeric run inside serif text (`11`, `13 kg × 9`, `50 × 7 → 50 × 8`)
  into a sans span with lining, tabular figures. This also covers the board header specimen.
- **B.** Claret now marks only Stalled/Slipping and their annotations. Good periods (Ready, BW−19,
  BW+5) use a blue wash `rgba(43,93,168,.09)`, with ink labels and rings. Token `--good-wash` was
  added; it is a tint of the already-validated `#2B5DA8`.
- **D.** The 4-week note reads "which hold the sick week and the deload week".
- **E.** The S6 recap reads "its 10th session without a record". I did not use the suggested "the
  10th session at 13 kg": the data has 11 non-deload sessions at 13 kg counting Fri 7 Aug.
- **F.** Biceps is kept.

**Re-self-check**

Changed results only; the board panel holds all 30.

| # | Result | Evidence |
|---|---|---|
| 15 | Pass | Reps and e1RM appear only at the latest and scrubbed points. |
| 21 | Partial | The control now sits below the chart (ruling 4); the item's text says above. |
| 25 | Pass | S7a–c each give a next step; S7c's sits just below the fold. |
| 26 | Pass | As the reviewer scored it. |
| 28 | Partial | S4 primary rows are still 44 px. |
| 30 | Pass | Presets at y ≈ 590, in thumb reach. |
| 23 | Partial | S7b/S7c lift rows are still not tappable. |

Tally: 27 Pass, 3 Partial (21, 23, 28).

**Remaining weaknesses**

- The S6 recap is now six lines, because the sans numerals run wider.
- The S7c start button sits under the tab bar in the static frame.

## Revision 2 (rulings 2, 11, 14 and two regressions; no new features)

- **Ruling 2.** Records rows use the kind names: `Heaviest weight`, `Estimated 1RM`, `Rep record`
  (also `Rep record at BW−19`, `Rep record, bodyweight only`), `First added load` and
  `Least assistance`. The rename happens at display time; `brief-data.json` keys are untouched.
- **Ruling 11.** The S2 and S3 headlines now use the verdict's own window. S2: "4 records in the
  last 4 sessions: 60 kg × 7 → 62.5 kg × 8." S3: "BW−21 × 7 → BW−19 × 6." The 3-month gains are
  gone. The compare readout already names its baseline ("4 weeks ago → now").
- **Ruling 14.** S7c shows no deltas. It lists raw top sets (Mon 22 Jun, then Fri 26 Jun), the
  record kind, and "○ Too new · 2 more sessions to a verdict". B lifts get "3 more".
- **Regressions.**
  - The S7c start button is fixed above the tab bar.
  - Blue now means "good period" only. The then-vs-now reference is a grey dashed line with a
    dashed ring and a grey gutter tick.
  - The e1RM line is secondary ink (`#3F454E`, 1.25 px), labelled `e1RM (estimated)`.
- **Optional, done.** The feed sparkline floor is 8 % of the top value for loaded lifts (still
  25 % for reps), so the Pull-down slip stays visible.
- **Render fix.** Numeric runs in serif headlines no longer wrap mid-number (`white-space: nowrap`).
- **Re-checked.** I re-rendered `board.png` and re-ran the drill and sparse click-throughs; both
  pass. Self-check is unchanged: 27 Pass, 3 Partial (21, 23, 28).

## Render log

| Round | Saw | Changed |
|---|---|---|
| 0 | Blank board: `top` collided with `window.top`. | Renamed the helper. |
| 1 | Count row showed one chip (`.cw` class clash). Huge black chevrons on records rows. Header four-line grid overlapped the token strip. Chart annotations sat on the lines. `(estimated)` was clipped. Band labels collided. S6 cut before the volume line. | Renamed the class, styled `.chev` globally, stacked the header lines. Moved annotations to a right gutter or a low band, widened the gutter, and added 3 label lanes with a dynamic plot top. Tightened S6. |
| 2 | S3 tick labels clipped, step labels collided with `BW−19`, reps labels clashed on S3b, sets line wrapped. | Wider left axis. The last step is labelled in the gutter in claret. No reps labels on reps axes. `BW−19 × 6 · 6 · 6 · 5` short form. |
| 3 | S8c bench: the best label overlapped the "Last record" annotation; the compare label overlapped the reps row. | Skip the best label when it is the annotated session. The compare label moved to the gutter. |
| 4 | S6 volume line still below the fold. | Volume line moved above the body map; body-map key added. |
| R1-a | After the revision edits: deload hatched and separate, serif numerals now sans. The body map's mirrored halves left a seam down the centre. | Fill and outline drawn as separate paths. |
| R1-b | Off-board pages (Pull-down, Curls, Deadlift, scrolled Muscles and S6) rendered in a temp copy: no reps collisions, Deadlift note present. The S6 map key wrapped badly. | Key set as swatch + label pairs. Final clean render; click-throughs re-run and passing. |

Derived for Revision 1: "Start Workout B · Mon 29 Jun" on S7c, the next B day under Mon/Wed/Fri
alternation after Fri 26 Jun (A).

Click-throughs were scripted in temp copies with injected JS, and every result matched. Range
presets draw 6 / 18 / 23 squat points for 1M / 3M / 1Y. Scrubbing to Fri 9 Oct shows `45 × 10 ·
55 × 10 · 60 × 10 · 60 × 10`, the rep record, e1RM 80.0 and the warm-ups line. Compare on bench
shows `13 × 9 → 13 × 9 · no change`. Bench card → records row → Fri 7 Aug session → back → back
returns to the feed. Why? expands and collapses. The data-state control reaches S7a–c. The muscle
row opens its contributors.
