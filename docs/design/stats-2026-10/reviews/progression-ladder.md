# Review: Progression Ladder (`progression-ladder`)

Reviewer: independent data-vis and mobile UX lead. Date: 2026-10-15.

Method:
- Cropped all 16 frames, the header and the panel from `board.png` at full resolution. Zoomed the S1
  mini ladders and the S4 body map 2–4×, and sampled the map's fill colours.
- Ran two scripted click-throughs. I copied `index.html` to `%TEMP%/plrev`, injected a driver that
  dispatches real `click` and `PointerEvent`s into all 16 phone instances, rendered with `render.sh`,
  and read results back through `--dump-dom`. That gave 32 extra screens:
  - bench dossier, tap on the Fri 7 Aug dot, back, back;
  - squat at 3M / 1Y / All, a drag scrub, and a tap plus a 600 ms hold to compare;
  - Muscles → Calves, and the full muscle list;
  - the whole summary scrolled;
  - History sessions, calendar and records;
  - deadlift, assisted (Step), hyper-extension (Step), pull-down, push-ups and bench → Records;
  - Train, Muscles, History and the squat dossier in the Fresh, 1-session and 3-session states,
    including through the board's state control.
- Checked 20 numbers against `brief-data.json`.
- Ran the validator.

## 1. Verdict

This is the most original concept of the four. Its primary chart (weight treads over reps-at-weight
bars, with a target tick per tread) encodes the program's own double-progression rule. The squat's
heavier-but-lower-e1RM day, the hyper-extension switch, the assisted staircase and the deload all
read correctly without any special pleading. The no-Stats-tab IA holds up: every shipped stat has a
findable home, landing → lift → session is 2 taps, and back works.

What holds it back is execution at the edges:
- The "current tread in cobalt" rule turns both stalled lifts' dossiers into walls of saturated
  blue.
- The 96 × 32 mini ladders carry almost nothing at arm's length.
- The pull-down dossier's header breaks.
- One honesty slip in copy: push-ups "bars never reach the target" is false.
- The sparse Muscles and History states are thin.

## 2. Checklist (principles §6)

Tally: **22 Pass · 8 Partial · 0 Fail**. The maker claimed 24 Pass and 6 Partial. I downgrade 16, 24
and 25, and upgrade nothing.

| # | Result | Evidence |
|---|---|---|
| 1 | Pass | S1 leads with "12 of 14 lifts climbed a step since Fri 18 Sep" (working-weight progress). |
| 2 | Pass | No tonnage on S1, S1b or S4. Volume is only the last line of the summary ("Volume 4,185 kg … down 10 % on Fri 9 Oct … context, not a verdict"), seen in the scrolled S6. |
| 3 | Pass | "e1RM 79.2 (estimated) · best 80.0 Fri 9 Oct" sits under the ladder, never drawn. The code gates it on `L.e1`. Push-ups, assisted, hyper-extension and pull-down dossiers show no e1RM. |
| 4 | Pass | S3: "assistance · less is better ↑", BW−27 low → BW−19 high, U+2212 throughout (the only ASCII `BW-` is in the embedded data string). S3b: BW → BW+5. |
| 5 | Pass | S2 "Warm-ups 20 × 10 · 37.5 × 5 · not counted". S6 "2 warm-up sets not counted". S8b dock has the warm-ups line. The deadlift dossier says "Warm-ups 40 × 5 · not counted". |
| 6 | Pass | S4: 2-week average, 28 Sep – 11 Oct, against plan. The list shows "8 / 8", "19 / 19" and so on. The 10–20 band is muted context. |
| 7 | Pass | S7b/S7c show "○ Too new · 2 more / 3 more". The 1-session squat dossier says "3 more for a verdict". Note: the 3-session dossier still shows "▲ +3 reps at 50 kg", a delta under Too new, but it is a lever fact and not a verdict. |
| 8 | Pass | Hollow deload dots, hatched bars, a "Deload" label, and labelled breaks ("Holiday", "Sick week") on S2, S3 and S8a. The caveat: in the S1 mini ladders the deload bars are just pale grey, not hatched. |
| 9 | Pass | S5 and History → Records: grouped by session, newest first, kind in words, "+1 more" after 3, and "40 records since Mon 28 Sep" (the sum checks: 4+5+4+6+5+5+5+6). No lifetime total. |
| 10 | Partial | S4 compares 12 muscles only through 4 colour bins plus a column of numbers. There is no position or length encoding across muscles; only the selected muscle gets a bar. |
| 11 | Pass | Stacked panels, one unit each. No pies, gauges or rings. |
| 12 | Pass | S1 and S6 use one small multiple per lift, with no overlaid series. |
| 13 | Partial | Rep bars start at 0 (labelled 0 and target). The weight panel has no ticks, only tread labels. In the Step range the deload points (50 and 52.5 kg) sit below the lowest labelled value (57.5), so the true axis minimum is unlabelled (S2, S8b). |
| 14 | Pass | Every session is a dot plus a bar. |
| 15 | Pass | Labels are limited to tread starts, the latest reps and gap or deload names. |
| 16 | Partial | ▲ ■ ▼ ○ always come with words, and less assistance wears ▲ (S3). But ▼ is overloaded: it is the *Slipping* verdict glyph and also S6's "▼ Fewer reps" on push-ups, which is Stalled, not Slipping. The S8c dock's "−2 reps" carries only a sign. |
| 17 | Pass | S1 minis share "last 8 weeks" at 96 × 32. S6 shares "8 weeks to Wed 14 Oct". |
| 18 | Pass | Each dossier has a "N steps in this range: 57.5 → 60 → 62.5 kg" sentence and a "Sessions in this range" table with working sets (seen in the scrolled squat dossier). S4 has the 12-muscle list. |
| 19 | Pass | S1's first line is the written verdict, above every chart. |
| 20 | Pass | Verified by script: S1 bench row → dossier → tap on the Fri 7 Aug dot → "Workout A · Fri 7 Aug". Back → bench dossier, back → Program. |
| 21 | Pass | One `Step · 3M · 1Y · All` row above the ladder, underlined when selected. It redraws 12 / 18 / 23 / 23 points, which matches 1.3.5. |
| 22 | Pass | S8b: a hairline snapped to Fri 9 Oct, and a docked readout with `45 × 10 · 55 × 10 · 60 × 10 · 60 × 10`, "20 of 20 at 60 kg · ready", "Rep record · 60 kg × 10 · +1 rep" and the warm-ups. The drag was reproduced by script, and the readout stays after pointer-up. |
| 23 | Partial | Rows, the Next row and "Last workout" all lead somewhere. The headline sentence and the "■ Bench and push-ups stalled 10 wk · ▼ pull-down slipping" line are not tappable. |
| 24 | Partial | "Try 15 kg next" and "Consider a lighter week or a variation" are good. The pull-down banner says "**Hold** 46.25 kg until the elbow settles", which is an instruction, not a suggestion. Nothing edits the program. |
| 25 | Partial | Lifts and Train are well designed for 0, 1 and 3 sessions (S7a–c, and Fresh Train). The gaps: Muscles in the Fresh and 1-session states is one sentence on a blank screen, with no map and no next step. History with 1 session shows a 6-week calendar of empty weeks (the brief says no grids of zeros) under a hard-coded legend, "empty week of 14 Sep: sick, one B session", that is false in June. |
| 26 | Pass | See section 4: every shipped stat has a reachable home. |
| 27 | Pass | 64 px hero, 20 px condensed row values, ink on white. |
| 28 | Partial | Rows are 64 px and the dock's buttons are fine. Opening a session from a ladder dot requires landing within ±12 × ±14 px (per `up()`), about 24 × 28 px, on dots ~10 px apart in 1Y. |
| 29 | Pass | S1 has the verdict, the Next row and all of Workout A above the tab bar. |
| 30 | Partial | Range presets sit in the top third of the dossier (y ≈ 260–300). Hold-to-compare cannot be discovered except through the dock hint. |

## 3. Scores

| Dimension | Score | Why |
|---|---|---|
| Professional look | **7** | Calm results-board type (Bahnschrift does render), hard rules, no tints. It loses points for the solid-cobalt bar walls on the bench and push-ups dossiers, the broken pull-down header, and a blobby body map. |
| Gym context | **7** | Huge hero, 64 px rows, readout docked in thumb reach. Against that: mini ladders that are unreadable at arm's length, presets at the top, and pinpoint dot taps. |
| IA | **8** | No Stats tab, and it works. Program is the index, the dossier holds the depth, Train holds "what next", and the summary is reachable in 2 taps. Records live in two places (but they are the same list). |
| Chart craft | **7** | The ladder is a genuinely good form. Weaknesses: no weight ticks, minis without a target tick, cobalt as area fill, the ordinal ramp used for nominal stacked segments in S4, and the summary map reusing the ramp on different bins (2/4/7) with no legend. |
| Data honesty | **8** | 20 of 20 numbers checked are right, and heavier-but-fewer-reps reads as a step. The stall banners are honest. Deductions: one false generic sentence (push-ups), ▼ overload, and map labels ("Hamstrings 10") disagreeing with their bin ("5–10"). |
| Fidelity to brief | **8** | Every frame is as specified. Departures are documented and reasoned. |
| Distinctness | **7** | The ladder and the docked readout are unique. S1 (a list of per-lift sparklines) and the S2 stacked panels sit closest to Lift Ledger's rows and expanded panels. The divergence is in the encoding more than the layout. |

## 4. The four core questions (from app open on Program)

| Question | Taps | How well |
|---|---|---|
| Am I progressing? | 0 | Good. The sentence is clear and honest, and the exceptions are named on line 2. The 14 minis add little; the row's `62.5 kg · 15 of 20` does the work. |
| How's my bench? | 0 (row) / 1 (dossier) | Very good. The row says "■ Stalled 10 wk · 13 kg · 33 of 40". The dossier banner says "no record since Fri 7 Aug · 10 sessions, 9.9 weeks", over one long tread whose bars never reach 40, with a suggestion. The best answer to this question I have seen in the set. |
| Which muscles am I under-training? | 1 | Good and honest: "On plan for 2 weeks", and the plan itself gives calves, abs, hamstrings, glutes and biceps fewer than 10–20. The map is only an index, and the cross-muscle comparison is weak (item 10). |
| What did today's workout achieve? | 2 (Train → Last workout, or History → row) | Good once there: 7 moves in words, 4 records, Worked today, and the volume line. Two taps is the price of the thesis. |

## 5. Ranked fix list

**Maker defects**

| # | Severity | Frame | Fix |
|---|---|---|---|
| 1 | major | Bench and push-ups dossiers (P, from S1/S8d) | The current tread spans 10+ weeks, so 19–22 rep bars and the whole step line render solid cobalt: the "thick saturated blocks" anti-pattern on exactly the lifts that need calm. Draw the tread in ink and the bars in grey, and keep cobalt for the latest session and the selection only. |
| 2 | major | Push-ups dossier banner | "The tread is long and the bars never reach the target" is false: Fri 7 Aug was 45 of 45 and Fri 9 Oct 47 of 45. The stall is a missing *record*, not a missing target. Write per-lift copy, for example "Hit 45 of 45 several times; no new best set since 17 on Mon 3 Aug". |
| 3 | major | Narrow-grip pull-down dossier | The header breaks: title on 2 lines, hero "46.25 kg ×" / "9", "B · 3 × 10–" / "12", "Mon 12" / "Oct". Scale the hero to fit, or let the meta column go under the hero. Also, "2 steps in this range: 46.25 → 47.5 → 46.25" calls a step down a step; say "1 step up, then back to 46.25". |
| 4 | minor | S1 / S6 minis | Add the target tick per tread and hatch the deload bars, or drop the bars and let the minis be tread-only. At 10 px the bars cannot be read, and the deload is indistinguishable from a light week. |
| 5 | minor | S6 | Use a glyph other than ▼ for "fewer reps than last time" (▼ is the Slipping verdict glyph), or say it in words only. |
| 6 | minor | Sparse Muscles and History (P states) | Muscles at 0 or 1 sessions should show the plan's sets per muscle on the map, plus "Start Workout A". The 1-session History should not draw 5 empty weeks, and its legend must not hard-code the 14 Sep sick week. Full-state wording "empty week of 14 Sep" is also wrong (it had a B session). |
| 7 | minor | S4, S6 | Map labels say "10" while the shade bin says 5–10 (9.75), so bin by the rounded value or label 9.75. The summary's "Worked today" map reuses the 4 slate shades on different bins (2/4/7) with no legend, so the same grey means different numbers on two screens. Add a legend, or use one scale. |
| 8 | minor | P (bench dossier) | The "13" tread label overprints the "Holiday" gap label. |
| 9 | minor | S1b | The pull-down bullet's track is shortened to fit "▼ slipping · elbow note", so its length is not comparable with the other six. Put the note on its own line. |
| 10 | minor | Assisted / deadlift Step | The first x tick is clipped at the left edge ("15 Aug", "1 Sep"). The 2-session sparse dossier has no date ticks and no tread line joining its dots. |

**Brief/spec conflicts (route to the orchestrator; I have not traded one rule for another)**

| # | Conflict | Maker's resolution |
|---|---|---|
| A | The accent rule "cobalt = current tread" collides with the brief's own risk warning ("no colour blocks") whenever a tread is long, as with the stalls. | Not resolved. This is the cause of fix 1. The brief should define the current tread as ink, with cobalt for the latest point only. |
| B | Record vocabulary. 1.3.10 fixes the kinds (`Heaviest weight`, `Rep record`, `First added load`). 1.3.4's lifts table uses best-of labels (`Heaviest set`, `Heaviest added load`, `Most reps in a set`). | The mock shows both: the dossier "Records" table uses the bests, and S5/S6 use the kinds. The brief should decide whether the dossier table is "Bests" (and retitle it) or records. |
| C | S8d must show only the destination, but T3 must be visible in S8d. | The stall banner lives on the intermediate bench dossier, which is not on the board. It is reachable in P. Let S8d show the dossier, or allow a split frame. |
| D | Item 21 (range control above the content) versus item 30 (presets in thumb reach). | The maker kept 21. This needs a rubric ruling, not a maker fix. |
| E | S6 "last 2 treads" and S1 "last 3 treads" versus item 17 (shared span). S4 "% of plan" shading versus data that is exactly 100 % everywhere. | Maker departures 1 and 2. Both are sound; recommend the orchestrator ratify them. |

## 6. Ideas worth stealing

- **The ladder itself.** Weight as treads over reps-to-target bars is the cleanest fix for the e1RM
  sawtooth. Any concept's per-lift depth view could adopt it as its reps panel.
- **The stall banner's wording.** For example: "no record since Fri 7 Aug · 10 sessions, 9.9 weeks"
  plus a suggestion, placed above the chart.
- **The docked readout above the tab bar.** It is in thumb reach and stays after release. The
  compare dock reports the change per lever (`+7.5 kg on the bar`, `55 × 10 → 62.5 × 8 −2 reps`,
  `3 climbed`, `e1RM 73.3 → 79.2 est.`) rather than one blended number, and adds "Includes the
  holiday, the sick week and a deload".
- **S1b Train's next-step bullets as the "what next" answer.** "36 of 36 → try 15 kg" is the one
  place an accent fill is earned.
- **The summary's moves in words.** "Stepped up to 62.5 kg", "Held 13 kg · stalled 10 sessions".
- **The per-weight rep-records table** in S5: best reps at each weight, with the current weight
  marked.
- **S4's honest headline.** "On plan for 2 weeks. The plan itself gives … fewer than the usual
  10–20", with a contributor stack for one muscle.

## Delta review (Revision 1)

Method:
- Re-cropped all 16 frames of the new `board.png` at full resolution.
- Ran a third scripted click-through: bench, push-ups and pull-down dossiers; pull-down scrolled;
  Muscles in the Fresh, 1-session and 3-session states plus the full 12-muscle list; History in the
  1-session and full states; the 3-session squat dossier and the 3-session summary; the scrolled Wed
  14 Oct summary; bench → tap the Fri 7 Aug dot; assisted at Step.
- Re-checked the generated sentences against `brief-data.json`.
- Measured Bahnschrift Condensed digit widths in headless Chrome: "1111" is 48.1 px and "8888" is
  77.9 px, so its figures are **proportional**.

### My majors

| Item | Status | Evidence |
|---|---|---|
| Cobalt walls on stalled dossiers | **Fixed** | Bench and push-ups dossiers: the current tread is a thin line with ink dots. Its bars are a pale tint with a 1 px cobalt outline. Only the latest session is a solid mark. |
| Push-ups banner false | **Fixed** | Push-ups: "45 of 45 or more on several days, but no set has beaten 17 reps", which is true (Fri 7 Aug 45; Mon 3 Aug and Fri 9 Oct 47). Bench: "the bars stay at 30–33 of 40", which I verified for all 11 non-deload sessions since Fri 7 Aug (30–33). |
| Pull-down header broken | **Fixed** | Name on one line, "▼ Slipping · Workout B · 3 × 10–12" under it, and "46.25 kg × 9" on one line. The steps line now reads "1 step up, then back: 46.25 → 47.5 → 46.25 kg". The suggestion is now "Consider staying at 46.25 kg…". |

### Minors the maker claims fixed

| Item | Status | Evidence |
|---|---|---|
| Minis: target tick and hatched deload | **Partly** | Ticks are present. But at 1× the 3–4 px hatched bars render as glyph-like "0"/"8" shapes next to the bars (S1, S6), and the heavy black target ticks now dominate the minis. |
| ▼ reserved for Slipping | **Fixed** | S6 and S8d use "↓ Fewer reps than last time (44, was 47)". The S8c dock reads "2 fewer reps". (The ↓ is in the warning colour; see ruling 8.) |
| Sparse Muscles and History | **Fixed** | Muscles at 0, 1 and 3 sessions shows the plan's map, a legend, "Your own sets appear … from the week of 29 Jun", and Start Workout A or a Next row. History at 1 session: "1 of 3 sessions in your first week", one calendar week, a Next row. The full legend is corrected to "week of 14 Sep: sick, one B session". |
| Map bins and labels | **Partly** | Hamstrings 10 now sits in the 10–14 shade, the stack is one neutral, and the 12-muscle list has length bars with a plan tick (S4, scrolled). New contradictions: see regressions 3 and 4. |
| "13" over "Holiday" | **Fixed** | Gap labels drop below the weight panel (bench dossier). |
| S1b pull-down bullet | **Fixed** | Full-width track, with "▼ Slipping · elbow note on Wed 7 Oct" on its own line. |
| Clipped first x-tick | **Fixed** (left edge) | The new right-edge y-ticks clip instead; see regression 1. The 2-session dossier now has "22 Jun / 26 Jun" ticks. |

### The rejected point: no line through 1–2 sessions

**The rejection is valid.** Principles §5 (line 217) says "1–2 exposures of a lift: show the points
and the working-weight bar; no line, no trend, no %". The sparse dossier now complies: two dots and no
tread line.

The maker has not applied the rule consistently, though. The S7c Program minis and the 3-session
summary's minis still draw a tread line through the same 2 dots. Make them dots only.

### Orchestrator rulings

| # | Ruling | Status | Evidence |
|---|---|---|---|
| 1 | No solid accent fills for current or selected state | **Partly** | Tread walls are gone. Still solid cobalt: the selected range preset (S2, S3, S8a–c), the current-weight bar in the S5 rep-records table, and the latest-session bar and dot on every ladder. |
| 2 | One record vocabulary | **Partly, with a regression** | The names are unified. But the dossier table relabels `lifts[].records`, which are *bests*, with record kinds, and that produces false records (regression 2). |
| 3 | Drill-downs keep the verdict | **Fixed** | S8d band: "DB bench press · ■ Stalled 10 wk · no record since Fri 7 Aug, 10 sessions · This session set the record the stall is counted from." Dossier headers carry the verdict too. |
| 4 | Presets below the chart, ≥ 44 px | **Fixed** | Four 44 px buttons under the ladder, at y ≈ 400–445 on the S8 frames. |
| 5 | No number on every point; e1RM only at latest and scrubbed | **Partly** | No per-point numbers. e1RM still appears beyond latest and scrubbed: "best 80.0 Fri 9 Oct" under every e1RM ladder, the "Estimated 1RM 80.0 kg" record row, and "also e1RM 15.8 / 73.3" in summary records. Brief S2 literally requires the "best" line, so this is a conflict to route (A2). |
| 6 | The landing's fold carries lift progress | **Fixed** | S1: the verdict sentence plus all 7 A lifts with value and x of y above the tab bar. |
| 7 | Whole numbers on landing, exact in drill-downs | **Fixed** | Landing shows kg at step precision (brief 1.3.2) and whole muscle sets. 2.25-style contributors appear only in S4's drill-down. |
| 8 | Warning colour only for real shortfalls against a window | **Not fixed** | "↓ Fewer reps than last time (44, was 47)" is red-orange (`.bl`) for a one-session comparison whose 47 included a failure set (S6). It also appears on S8d for push-ups. |
| 9 | Numerals in a lining tabular face | **Not fixed** | Bahnschrift's digits are proportional, as measured. `.c`, which carries the right-aligned row values on S1, S6 and the muscle list, has no `tabular-nums`. Only `.tab` and `.tbl` cells have it. |
| 10 | The attention colour means attention only | **Partly** | Same cause as ruling 8. Everything else red is the Slipping verdict. |
| 11 | A delta beside a verdict uses the verdict's own window | **Partly** | S6 puts "↓ Fewer reps than last time" (1-session window) directly above "stalled 11 sessions". Dossiers put "▲ Up 2.5 kg on Wed 14 Oct" (last session) under "▲ Moving" (4-session window). |
| 13 | Colour never alone for done-vs-plan | **Fixed** | Train bullets use length plus "x of y". The S4 list has a length bar plus a plan tick. The ready bar also reads "→ try 15 kg". |
| 14 | No deltas before 4 sessions | **Not fixed** | 3-session state: S7c headline "Back squat went 50 × 7 → 50 × 8". The squat dossier shows "▲ +3 reps at 50 kg on Fri 26 Jun" directly beside "○ Too new · 2 more", which is a contradiction. The Fri 26 Jun summary shows "▲ More reps at 50 kg / 7 kg / 3 kg / 17.5 kg". The S7c records (+1 rep) are brief-mandated (1.3.9); route as A3. |

### Regressions introduced by the revision

1. **major. Assisted y-ticks clipped (S3, assisted at Step).** The new right-edge min/max ticks read
   "BW−1…" and "BW−2…". The T6 labels are the point of that frame. Anchor the ticks to end inside
   the plot, or reserve a wider right gutter for `BW−nn`.
2. **major. False record dates from the vocabulary swap.** Every case below dates a record to the
   wrong session or the wrong kind:

   | Where it shows | Shown | What the data says |
   |---|---|---|
   | Assisted dossier | `Least assistance · BW−19 × 6 · Mon 12 Oct` | The Least-assistance record was Wed 7 Oct, BW−19 × 5. Mon 12 Oct was a Rep record. |
   | Machine row | `Heaviest weight · 75 kg × 9 · Mon 12 Oct` | The heaviest-weight record was Wed 7 Oct. |
   | Face pull | `Heaviest weight · 25 kg × 13 · Mon 12 Oct` | The heaviest-weight record was Fri 2 Oct. |
   | Seated biceps curls | `Heaviest weight · 14 kg × 12 · Mon 12 Oct` | The heaviest-weight record was Fri 2 Oct. |
   | 3-session squat dossier | `Heaviest weight · 50 kg × 8 · Fri 26 Jun` | 50 kg was the 22 Jun baseline; 26 Jun was a Rep record. |

   S5 and S6 (from `points[].pr`) now disagree with the dossier tables. Either title the dossier
   table "Bests" and keep best-set wording, or derive each row from the latest `points[].pr` of
   that kind. (See A1.)
3. **minor. Adjacent contradiction on S4 and sparse Muscles.** The copy says the plan gives "abs,
   calves, hamstrings, glutes and biceps fewer than the usual 10–20 sets". The map beside it labels
   Biceps, Hamstrings and Glutes "10" and now shades them in the 10–14 bin. Say "at or below" (the
   brief's words) and name only Abs and Calves as below.
4. **minor.** The summary's "Worked today" legend reads "<5 · 5–10 · 10–15 · 15+" and says "same
   shades as Muscles", while Muscles reads "under 5 · 5–9 · 10–14 · 15+".
5. **minor.** The mini-ladder hatch artefacts noted above. S2's warm-ups line now wraps
   "…not / counted".

### Brief/spec conflicts to route (new)

- **A1.** `brief-data.json → lifts[].records` holds *bests* (`Heaviest set`, `Most reps at BW−19`,
  `Most reps in a set`). Ruling 2 says use record-kind names. Applied literally, the two produce
  false records. The orchestrator should say whether dossier tables are "bests" (exempt from
  ruling 2) or "latest record of each kind".
- **A2.** Ruling 5 (e1RM only at latest and scrubbed) against brief S2 and 1.3.4, which require
  "best 80.0 Fri 9 Oct" and a "Best estimated 1RM" record row.
- **A3.** Ruling 14 (no deltas before 4 sessions) against brief 1.3.9, which has S7c showing "Rep
  record +1 rep" at a lift's 2nd session, and against T4 records.

### Updated checklist

**25 Pass · 5 Partial · 0 Fail** (was 22 / 8 / 0).

- **Now Pass:**
  - 10: the list has length bars;
  - 16: ▼ is reserved, words carry the deltas;
  - 24: suggestions are phrased as "Consider…" or "Try…";
  - 25: the sparse states are designed;
  - 30: presets and the dock sit in the lower half.
- **Still Partial:**
  - 23: the headline is not tappable;
  - 28: a 1Y dot is about 10 px; the dock button is the fallback.
- **Pass → Partial:**
  - 13: the assisted min/max ticks are clipped;
  - 7: "▲ +3 reps" beside "Too new";
  - 9: the dossier record rows are mis-kinded and mis-dated.

### Updated scores

| Dimension | Before | After | Note |
|---|---|---|---|
| Professional look | 7 | **8** | Walls gone, header fixed. Clipped assisted ticks and the mini hatch hold it back. |
| Gym context | 7 | **8** | Presets and dock in thumb reach, bigger dot target. |
| IA | 8 | **8** | Drill-downs now keep the verdict. |
| Chart craft | 7 | **7** | Min/max ticks and muscle length bars added. Solid cobalt latest bar, illegible mini hatch, clipped ticks. |
| Data honesty | 8 | **7** | False banner fixed, but new false record dates and pre-4-session deltas. |
| Fidelity to brief | 8 | **8** | Unchanged. |
| Distinctness | 7 | **7** | Unchanged. |
