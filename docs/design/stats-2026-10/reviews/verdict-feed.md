# Review: Verdict Feed (`verdict-feed`)

Reviewer: independent design review (data-vis and mobile UX), 2026-10-15.
Method: every board frame cropped at full resolution. Then 50 scripted click-through states of P,
rendered headless at 2× from temp copies with injected JS: Why? ×4, the moving list, range
1M/3M/1Y/All, compare on squat, bench and hyper-extension, scrubs at Fri 9 Oct, Fri 7 Aug and the
deload Mon 21 Sep, the full drill-down and its back path, every evidence page, Muscles at 2 and 4
weeks plus a row drill, Records expand, All lifts, All sessions with the calendar, tabs, and the
three data states. I checked 16 displayed numbers against `brief-data.json` and ran the dataviz
validator.

## 1. Verdict

This is the strongest answer to "am I progressing, and what next?": a 0-tap written verdict whose
numbers I could not fault, and every claim one tap from its rule and the four sessions behind it.
The look is a restrained broadsheet (white, Segoe UI, one Georgia sentence, claret used sparingly)
that reads professional, not precious. Three things pull it toward editorial: Georgia's old-style
figures inside the headlines, the five-line serif recap on S6, and a toy-like body map. The
weakness is chart craft at the edges. Reps labels collide on pages the board does not show. The
sick-week gap and the deload merge into one grey wash. Positive findings wear the same claret as
problems. None of these is a blocker. Most are small maker fixes, and three are rules in the brief
that need a ruling.

## 2. Checklist (principles §6)

**Tally: 25 Pass · 5 Partial · 0 Fail.** The maker's panel lists 5 Partials (15, 23, 26, 28, 30).
I move 26 to Pass and 25 to Partial, and add notes to 8 and 16.

| # | Result | Evidence |
|---|---|---|
| 1 | Pass | S1: the serif verdict "11 of 14 lifts moving. DB bench press has stalled for 10 weeks…" then `▲ 11 · ■ 2 · ▼ 1 · ↑ 1`. No tonnage, e1RM or PR count. |
| 2 | Pass | Tonnage appears only on S6's last line (`Volume 4,185 kg · down 10 %`) and on S8d's session page. |
| 3 | Pass | S2/S8a–c: axis title `kg · top set and e1RM (estimated)` plus the end label `e1RM (estimated)`. Records rows say `80.0 kg estimated`. Only the 5 e1RM lifts draw it; Lunges, Pull-down and Curls show `kg · top set` (P). |
| 4 | Pass | S3: `BW−27…BW−19` (U+2212), less assistance plotted higher, `assistance · less is better ↑`. S3b is in reps with `BW+5 × 12`. One wording slip, `−2 kg on Wed 7 Oct`, is fix 6. |
| 5 | Pass | S2 readout `Warm-ups 20 × 10 · 37.5 × 5 · not counted`; the S8b and deload scrubs list their warm-ups; S6 meta `2 warm-ups not counted`; footer line on every evidence page. |
| 6 | Pass | S4: sets/week against plan, `28 Sep – 11 Oct · one ABA + one BAB week`. 4 weeks says `includes a deload week` (see conflict D). |
| 7 | Pass | S7c: `○ 14 too new`, "A lifts 2 more, B lifts 3 more", and each card has `2 more sessions`. |
| 8 | Pass (note) | Deload dots are hollow and grey, gaps break the line, and bands are labelled `Holiday`, `No A session`, `Deload`. But on S2, S8a and S8c the sick-week band and the deload band touch and form one undifferentiated grey wash, with two stacked labels over it (fix 1). |
| 9 | Pass | S5: one record per lift per session, kind named, newest first, 3 per day then `+1 more` / `+2 more`. 40 and 31 are correct. |
| 10 | Pass | Position and length only. Claret marks the finding's period. |
| 11 | Pass | e1RM shares the kg axis (same unit, one scale). No pies, gauges or rings. |
| 12 | Pass | One lift per chart; the feed sparklines are small multiples. |
| 13 | Pass | Labelled min and max ticks on every line axis (50–80, 10–18, BW−27–BW−19, 6–16). The `Next` progress bar starts from 0. |
| 14 | Pass | Every session is a dot, deloads hollow. |
| 15 | **Partial** | S8c prints reps under 12 dots (`8 8 8 9 9 9 … 9 9 9 9`), which the brief requires (conflict C). Labels also collide on pages the board does not show: Pull-down `109` on the ring, Curls `101112` cut by the step line, and S3's `5` on a step riser (fix 2). |
| 16 | Pass (note) | Glyph and word on every verdict and lever row. Less assistance is plotted up. The good step, though, is painted in the attention claret (conflict B). S8d mixes `+` and `↑` glyphs (fix 10). |
| 17 | Pass | All feed sparklines share the 3M span and 48 px height. Each card scales y to its own min and max, which exaggerates Push-ups (fix 5). |
| 18 | Pass | Every chart has a sentence above it and a readout card or records rows. |
| 19 | Pass | S1: the verdict precedes every chart. |
| 20 | Pass | Scripted: bench card → evidence → `Heaviest set · Fri 7 Aug` row → session page (2 taps). Back twice returns to the feed. |
| 21 | Pass | One preset control per evidence page, above the chart, with the selected state drawn. |
| 22 | Pass | S8b: hairline at Fri 9 Oct. The readout reads `45 × 10 · 55 × 10 · 60 × 10 · 60 × 10`, `Rep record · 60 kg × 10 · +1 rep`, `e1RM 80.0 (estimated)`, and warm-ups `20 × 10 · 35 × 5`. Scrubbing the deload also shows "Deload session · sets no records" and the note. |
| 23 | **Partial** | Every full-state landing element leads somewhere. S7b rows, the S7c cards and the S7c count tiles (rendered as buttons) do nothing. |
| 24 | Pass | `Try 15 kg next Friday.`, `Consider a lighter week…`. The Ready Why? adds "your program stays as it is until you change it." |
| 25 | **Partial** | S7a has expectations and `Start Workout A`. S7b and S7c say what to expect but offer no next step. |
| 26 | Pass | Per-lift chart → evidence page. Records → S5. Volume vs baseline → S6 and S8d. Muscle map → S6 and S4. Sessions list and calendar → `All sessions` (calendar plus `last 4 full weeks: 10 of 12`). Progression hint → the Ready card and `Next: x of y`. |
| 27 | Pass | Row values 20 px/600 sans; the verdict is 22 px serif in ink. |
| 28 | **Partial** | Range buttons are 40 px inside a 44 px control. S4 muscle rows (primary rows) are 44 px, not 56. Why? sits inside the card's own tap target. |
| 29 | Pass | S1: the verdict, counts and both attention cards end at about y 757, above the 790 tab bar. |
| 30 | **Partial** | Range presets sit at y ≈ 250, in the top third. No pinch anywhere. |

**Must-fix truths.**

- **T1 (warm-ups excluded):** holds. See items 5 and 22.
- **T2 (real time axes, gaps):** holds. Weeks are bucketed Monday to Sunday, the line breaks on a skipped week, and nothing is interpolated. The sick-week and deload bands merge visually, though.
- **T3 (honest verdicts and stalls):** holds. Why? shows the real last 4 non-deload sessions: bench 13 × 9 ×4, push-ups 17 · 17 · 17 · 15, pull-down 47.5 × 10 against 46.25 × 10 / × 9.
- **T4 (record rule):** holds. One record per lift per session and the kinds are exact. Mon 22 Jun and Wed 24 Jun show 0 records (baselines).
- **T5 (e1RM only where valid):** holds. Only the 5 lifts draw e1RM.
- **T6 (assisted on a reversed axis):** holds, apart from the `−2 kg` wording.
- **T7 (one muscle taxonomy):** holds. 12 muscles, with Lats and Mid back separate. Forearms and traps appear only in the S4 body-map note. The Calves drill-down shows 3 + 2.25 + 2.25 = 7.5.

**Numbers spot-checked, all correct:**

1. Counts 11 / 2 / 1 / 1.
2. Bench: 10 non-deload sessions since Fri 7 Aug.
3. Squat: +10 kg since Wed 15 Jul (52.5 → 62.5).
4. Squat 3M = 18 points; 1M = 6.
5. The S8b readout.
6. Compare: Fri 11 Sep, bench 13 × 9 and squat 57.5 × 10 → 62.5 × 8.
7. S5: 40 records; 31 on the earlier days.
8. S6: 71 min, 24 sets, 4,185 kg, −10 % against 4,669.
9. S8d: 68 min, 23 sets, 3,938 kg, +8 % on 3,648, 45 bodyweight reps, 5 records.
10. S4 rounding: 18.75 → 19, 9.75 → 10, 7.5 → 8.
11. 4-week average 106 / 140.25 = 75.6 %, so "about 75 %".
12. Assisted: 23 of 32 and 8 kg less assistance.
13. Biceps 36 of 36.
14. Push-ups: 44 vs 47 reps.
15. Lunges: "3 records in your last 4 sessions".
16. Calendar: alternation and 10 of 12.

**Copy slips:**

- Push-ups Why? says "**Today**: 44 of 45 reps". That session was yesterday.
- The 1M range keeps the headline "since Wed 15 Jul", which is off the chart.
- S1b heads 2-week muscles with "ALSO THIS WEEK".

**Palette validator** (`validate_palette.js`):

- `#9E1F4E,#2B5DA8` (light, on `#FFFFFF` and `#F4F5F6`): ALL PASS. Worst CVD ΔE 16.0 (protan), normal-vision ΔE 23.8.
- Ramp `#9DB5DE…#1F4C8F` `--ordinal`: ALL PASS (monotone, light end 2.08:1, hue spread 3°).
- Adding ink and context grey as categorical slots fails (lightness and chroma). That is expected: they are neutrals, and the mock never uses them as series colours.

## 3. Scores (1–10)

| Axis | Score | Why |
|---|---|---|
| Professional look | **7** | Clean white, hairlines, one accent, disciplined type. Points lost: Georgia old-style digits bob inside numeric headlines (`13 kg × 9`, `50 × 7 → 50 × 8`), the S6 serif paragraph is five lines of magazine text, the body map is a blocky robot, and the 11 % claret washes read pink at card size. |
| Gym context | **7** | 0-tap answer at arm's length with 20 px values. Against it: charts are 216 px wide with 13 px labels, presets sit top-third, and range buttons are 40 px. |
| IA | **8** | Feed → evidence → session is clear and shallow, and back works everywhere. "What did today's workout achieve?" hides behind a card titled `Records`. |
| Chart craft | **6** | The annotated period chart is good: label lanes, hollow deloads, line breaks, e1RM as a thin reference. Against it: label collisions off-board, merged gap/deload wash, numbers under every dot, per-card y autoscale, an unreadable 12-dot mini-strip on S1b, and a cramped S4 dot plot (0–25 drawn in about 150 px). |
| Data honesty | **8** | Every rule is stated and every number checks out. Lost on: claret on good news, Deadlift's 90.0 → 86.3 e1RM dip left unannotated, the 4-week muscle note omitting the sick week, and "Today" for yesterday. |
| Fidelity to brief | **8** | All 18 frames as specified, and the departures are justified (Biceps added to the under-10 list, S3/S3b default to All, S6 order). The deload is labelled but neither hatched nor separated. |
| Distinctness | **8** | No other concept leads with sentences or annotated period bands. Overlaps are minor: S1b's M–S day strip echoes Training Week, and the `Next: 15 of 20 reps` bar echoes Progression Ladder. Both are secondary. |

## 4. The four core questions

| Question | Taps | How well |
|---|---|---|
| Am I progressing? | **0** | Excellent. The sentence and the 4-up count answer it, and the two attention cards say what to do next. |
| How's my bench? | **0** to answer, **1** for evidence | Excellent. Card 1 states the stall, its length and a suggestion. Why? shows the 4 sessions and "A record needs 13 kg × 10". The evidence page shows the stalled band from Fri 7 Aug. |
| Which muscles am I under-training? | **0 + scroll** (sentence), **1** for the dot plot | Good. "You did the plan…; calves, abs, hamstrings, glutes and biceps sit at or under 10" is right and honest. The card's mini-strip adds nothing (12 dots, 3 labels, overlaps), and S4's plot crams its scale into the left half of the row. |
| What did today's workout achieve? | **scroll + 1** (`Records · 4 records yesterday` → S6) | Fair. S6 itself is excellent: the recap, the lever table with glyphs, volume as a quiet causal line. The route is weak: nothing on the feed is labelled "last workout", and a lifter will not guess that `Records` leads there. |

## 5. Ranked fix list

### Maker defects

| # | Sev | Frame | Fix |
|---|---|---|---|
| 1 | major | S2, S8a, S8b, S8c | The `No A session` (week of 14 Sep) and `Deload` (21–25 Sep) bands touch and draw as one grey block. Give the deload its own treatment (the brief allows "hatched or labelled band": a 2 px surface gap between the bands, or a distinct wash) and centre each label over its own span. |
| 2 | major | P: Pull-down, Curls; S3, S8c | Reps labels collide: `109` on the Wed 7 Oct ring, `101112` cut by the step line, `5` on the assisted riser, and the `9` under the Fri 7 Aug ring. Add collision avoidance: skip a label when neighbours are under ~14 px apart, and always keep the last one. |
| 3 | major | S6, S4 | The body map is stacked rounded rectangles (a toy robot). Redraw it as the anatomical front/back outline from simple paths, about 120 px, that the brief asks for. It is the one element that cheapens the broadsheet look. |
| 4 | minor | P: Deadlift | Mon 12 Oct (70 × 7, record) has e1RM 86.3 below the 90.0 best, and the e1RM line dips with no note. Generalise S2's "heavier, fewer reps: a step up" annotation to any Heaviest-weight session whose e1RM is lower. |
| 5 | minor | S1 cards | Each sparkline autoscales y, so Push-ups' 15↔17 reads as full-height cliffs and Pull-down's slip looks tiny next to the deload drop. Pad the y domain (for example a minimum span of 3 steps) or drop deloads from the scale. |
| 6 | minor | S3 | The gutter `−2 kg on Wed 7 Oct` reads as negative kilograms (T6). Write `2 kg less assistance · Wed 7 Oct`. |
| 7 | minor | P, S1b | Copy truth: Push-ups Why? `Today: 44 of 45` → `Wed 14 Oct: 44 of 45`. Relabel `ALSO THIS WEEK` (Muscles covers 2 weeks). On 1M, word the headline for the visible range or mark the start as off-chart. |
| 8 | minor | S7b, S7c | Add one next step (`Start Workout A` / `Start Workout B`). Make the S7c count tiles plain text, or have them lead somewhere (items 23, 25). |
| 9 | minor | S1b | The Muscles card mini-strip has 12 unlabelled, overlapping dots. Show two labelled extremes (Abs 3, Calves 8 … Shoulders 21) or drop it; the sentence already carries the finding. |
| 10 | minor | S8d, S6 | Unify the glyph vocabulary. S8d uses `+` for a rep record and `↑` for heaviest weight, while S6 uses `↑` for "weight up". |
| 11 | minor | S2, S4 | Make range buttons 44 px and S4 muscle rows 56 px. Widen the S4 plot: the 0–25 scale uses about 150 of 350 px, so plan and done dots crowd into a 60 px band. |

### Brief/spec conflicts (for the orchestrator to rule on; not traded silently)

| # | Sev | Where | Conflict |
|---|---|---|---|
| A | major | S1, S6, S7c, S8c headlines | The brief says serif "**never on numbers**", yet it dictates serif sentences full of numbers ("11 of 14…", "13 kg × 9 since Fri 7 Aug — 10 sessions", the S6 recap). Georgia has only old-style figures, so these bob. Rule one of three: allow numbers but switch to a serif with lining figures, set numerals in a sans run inside the sentence, or keep numbers out of the serif sentence. |
| B | major | S2, S3, S3b, Curls page | Claret is defined both as "attention" (Stalled, Slipping) and as "the finding's period". Positive findings therefore wear the alarm colour: the squat step up, `Ready`, `BW−19`, `BW+5`. T6 asks that less assistance wear "the good treatment", but this palette has none (no green, by design). Decide whether positive periods should be ink-labelled neutral bands, keeping claret for attention only. |
| C | minor | S8c | "Reps print under the dots of the current step" collides with item 15 (no number on every point) when the step is 12 sessions long. Suggest: label the first and last dots of the step, plus any change. |
| D | minor | S4, 4 weeks | The 4-week window (14 Sep – 11 Oct) contains the sick week (1 of 3 sessions) as well as the deload. "About 75 % … including a deload week" credits the shortfall to the deload alone. The brief's copy should say "includes the sick week and a deload week". |
| E | minor | S6 | The brief's copy "Bench held at 13 × 9, **its 10th session there**" is ambiguous. Wed 14 Oct is the 10th non-deload session since the record, the 11th at 13 kg, and the 8th with a 13 × 9 top set. Suggest "10 sessions without a record". |
| F | minor | brief 1.3.7 | Biceps (9.75 a week) sits under 10 like Hamstrings and Glutes, but the brief's under-training list omits it. The maker correctly added it. Fix the brief so all four concepts agree. |

## 6. Ideas worth stealing for the other concepts

- **Why? with the triggering sessions and the next target.** "No record in your last 4 sessions: 13 × 9 ×4 · A record needs 13 kg × 10, or more weight." This is the best trust device in the run: rule, data and the exact bar to clear, in place.
- **The readout card above the chart, rewritten by scrub and compare.** The hairline never covers data. Scrubbing a deload explains itself: "Deload session · sets no records", plus the session note.
- **Then-vs-now as one tick plus a sentence.** `57.5 × 10 → 62.5 × 8 ▲ +5 kg on the bar · deloads skipped`. Cheap, honest, and it works for an assisted or bodyweight lift (`BW × 15 → BW+5 × 12 ▲ +5 kg added`).
- **Label lanes with a dynamic plot top.** Band labels never sit on the data.
- **The fresh-install expectation ladder.** "Starting points after 1 session · First changes after 2 · A verdict after 4 of a lift · Muscles after 2 weeks." Any concept's S7a should copy it.
- **Muscle-row drill-down with the arithmetic shown.** "Back squat 3 (secondary, ½ per set) · Lunges 2.25 · Deadlift 2.25". This makes fractional sets believable.
- **Volume demoted to a causal footnote.** "down 10 % on Fri 9 Oct, from heavier weights at fewer reps".
- **One rule sentence on the Records page.** "One record per lift per session: heaviest weight first, then rep record, then estimated 1RM."

## Delta review (Revision 1)

Method: all 16 board frames re-cropped at full resolution. Then 16 changed paths of P re-run
headless at 2× from temp copies with injected JS: Why? on Push-ups and Pull-down; the evidence pages
for Pull-down, Curls, Push-ups and Deadlift; squat 1M and the Fri 9 Oct scrub; compare on bench and
hyper-extension; Muscles at 4 weeks plus a row drill; the S6 bottom; S8d; the 3-session state.
Every new sentence was read against `brief-data.json`.

### My majors and the minors claimed fixed

| Item | Status | Evidence |
|---|---|---|
| 1 Gap vs deload merged | **Fixed** | S2, S8a–c and the Push-ups and Deadlift pages: the gap is a flat wash, the deload a 45° hatch, with 1 px of page between them and each label over its own span. |
| 2 Reps label collisions | **Fixed** | Reps (`×8`, `×9`, `×12`) appear only at the latest or scrubbed point: the S8c row of 12 numbers, Pull-down `109`, Curls `101112` and S3 riser `5` are all gone. Some collisions remain (not claimed): Push-ups' `Last record / 17 reps` label sits on the leader and the y-axis area, and Pull-down's `"Right elbow sore"` is crossed by the deload riser. |
| 3 Body map | **Fixed** | S6 and S4 now show a real front/back silhouette with region fills, and it no longer cheapens the page. The key still wraps into `1– / 3.5 · 4– / 6.5 · 7– / 9.5`; the maker said this was fixed, so it is **partly**. |
| 4 Deadlift e1RM dip | **Fixed, honest** | Gutter note "70 kg · heavier, fewer reps: a step up". Checked: Mon 12 Oct 70 × 7 is a Heaviest-weight record (+2.5 kg), and its e1RM 86.3 is below the 90.0 best (Wed 7 Oct, 67.5 × 10). Fewer reps after a weight step is the program's own rule (0006), so "step up" is true. The rule fires only on squat and deadlift, which is correct. |
| 5 Sparkline scale | **Fixed, honest** | Push-ups' 15↔17 is now a half-height step, not a cliff. A floor of 25 % of the top value keeps magnitudes proportional to load, which suits these cards. One cost: the Pull-down slip (47.5 → 46.25 kg, −2.6 %) is now barely visible. It is honestly small, and the claret band and the sentence carry it. Deloads clamp to the floor only when out of range; none of the four cards triggers that. |
| 6 `−2 kg` | **Fixed** | S3: "BW−19 / 2 kg less / assistance / Wed 7 Oct". |
| 7 Copy | **Partly** | `Wed 14 Oct: 44 of 45 reps` is fixed, and so is `MORE FINDINGS`. **Not fixed:** on the 1M range the headline still reads "Up 10 kg on the bar since Wed 15 Jul", a date off the chart. |
| 8 S7b/S7c next step | **Fixed, with a regression** | S7b has `Start Workout B · Wed`, and the S7c count tiles are now plain text. But S7c's `Start Workout B · Mon 29 Jun` sits under the tab bar in the static frame, cut in half. The maker lists this. S7b/S7c rows are still dead ends (item 23). |
| 9 Mini-strip | **Fixed** | "Fewest: abs 3, calves 8 · most: shoulders 21 sets a week", which matches the 2-week averages. |
| 10 Glyph vocabulary | **Fixed** | S6 has the key `↑ up · = same · ↓ down`; S8d has `↑ weight up · + more reps`. |
| 11 Tap sizes, S4 width | **Partly** | Presets are 44 px (CSS `.seg button{height:44px}`). The S4 plot is wider. S4 muscle rows are still 44 px, not 56. |

### Conflicts A–F and the orchestrator's rulings

| Ruling | Status | Evidence |
|---|---|---|
| A Serif numerals | **Applied** | S1 `11`, `10`; S8c `13 kg × 9`; S7c `50 × 7 → 50 × 8`; S6 recap: all digits are sans with lining figures inside the Georgia sentence. The S6 recap grows to 6 lines. |
| B Claret only for problems | **Applied** | Ready, `BW−19` and `BW+5` sit in a blue 9 % wash with ink labels. The squat and deadlift step-up notes are in ink. Small catch: blue is also the reference colour (the e1RM line, the then-vs-now tick), so blue now means both "reference" and "good". It reads fine in practice. |
| C No number on every point | **Applied** | See item 2. |
| D 4-week note | **Applied** | S4 at 4 weeks: "About 75 % of plan over 4 weeks, which hold the sick week and the deload week." 106 / 140.25 = 75.6 %. **New adjacency issue:** the next sentence keeps the plan values, "Calves (8), abs (3)… (10 each)", directly above rows that read `6 / plan 8` and `2 / plan 3`. At 4 weeks, either drop the parentheses or say "plan:". |
| E Bench wording | **Applied; maker is right** | `brief-data.json` has 11 non-deload sessions at 13 kg counting Fri 7 Aug (7 Aug; 19, 24, 28 Aug; 2, 7, 11 Sep; 30 Sep; 5, 9, 14 Oct). Wed 14 Oct is the 10th without a record, so "its 10th session without a record" is true. It agrees with S1's "10 sessions, no record". (My suggestion was "10 sessions without a record", not "10th session at 13 kg"; either way, the new copy is correct.) |
| F Biceps | **Kept** | Correct. |
| 1 No solid accent for selected | **Applied** | The compare chip is a 2 px ink outline (S8c, hyper-extension); presets use a white chip with a hairline. |
| 2 One record vocabulary (`kinds`) | **Not applied** | The S2, S3, S3b, S5 and Push-ups records tables still say `Heaviest set`, `Best estimated 1RM`, `Most reps in a set`, `Most reps at BW−19`, `Heaviest added load` (the kind is `First added load`) and `Most reps, bodyweight only`. The readouts above them use the kind names (`Heaviest weight`, `Rep record`), so the two disagree on the same page. |
| 3 Drill-downs keep the verdict | **Applied** | Evidence pages lead with `▲ Moving` / `■ Stalled`; S8d has "■ DB bench press · Stalled · No record since this session". |
| 4 Presets below the chart, ≥ 44 px | **Applied** | All evidence pages, about y 590–630. |
| 5 No number on every point | **Applied** | See item 2. |
| 6 Fold carries lift progress | **Partly** | Above the fold, S1 carries "11 of 14 lifts moving" and `▲ 11` as counts, but both cards are problems; no gain is shown (for example "12 of 14 stepped up since Fri 18 Sep"). |
| 7 Whole on landing, exact in drill | **Applied** | S1b `abs 3, calves 8`; S4 rows are whole; exact values (`7.5`, `2.25`) appear in the muscle-row drill. |
| 8 Warning colour only for real shortfalls | **Applied** | Claret appears only on Stalled and Slipping (S1 cards, S6 bench row, S8d). S4 shortfalls under plan at 4 weeks stay neutral. |
| 11 Delta uses the verdict's window | **Not applied** | S2/S8a–b put "▲ Moving · Up 10 kg on the bar since Wed 15 Jul" (3M) beside a verdict judged on the last 4 sessions. In that window the gain is +2.5 kg, 60 → 62.5 since Wed 30 Sep. S3 does the same: "8 kg less assistance since Wed 24 Jun" (All) beside `▲ Moving`. Deadlift and Lunges get it right ("4 / 3 records in your last 4 sessions"). |
| 13 Colour never alone for done vs plan | **Applied** | S4 uses hollow (plan) vs filled (done); S1b uses filled (done) vs outlined (due) day cells, with letters. |
| 14 No deltas before 4 sessions | **Not applied** | S7c still leads with "Back squat went 50 × 7 → 50 × 8 (+1 rep)" and four `+1 rep` first-change cards under `○ Too new`. S7a still promises "First changes · after 2". This contradicts the ruling; the brief's S7c asked for first deltas, but the ruling supersedes it. |

### Regressions

- **Minor:** S7c's start button is half hidden under the tab bar in the static frame.
- **Minor:** S6's recap grew to 6 serif lines.
- **Minor:** blue now carries two meanings, "good" and "reference".
- **Minor:** the hatch is texture on by default, which the dataviz skill discourages. The brief allows "hatched", and the band is small, so this is acceptable.

### Updated checklist tally

**27 Pass · 3 Partial · 0 Fail.**

- **Now Pass:** 8 (hatch plus gap), 15, 16 (no claret on good), 21 (under ruling 4), 25, 30.
- **Partial:** 23 (S7b/S7c rows are dead ends), 28 (S4 rows 44 px), and 7, newly Partial under ruling 14 (S7c shows deltas before 4 sessions).

### Updated scores

| Axis | Was | Now | Why |
|---|---|---|---|
| Professional look | 7 | **8** | Sans numerals, the anatomical map and no pink-on-good. The S6 recap is heavy, and the map key wraps. |
| Gym context | 7 | **8** | Presets are 44 px and in thumb reach. S4 rows are still 44 px. |
| IA | 8 | **8** | The verdict persists on drill-downs. The "today's workout" route is still the `Records` card. |
| Chart craft | 6 | **8** | Collisions gone, gap and deload separated, sane sparkline scale. Two label overlaps remain (Push-ups, Pull-down). |
| Data honesty | 8 | **8** | The new notes and copy are true. Off: the ruling-11 window mismatch, the 1M headline off-range, the S4 4-week parentheses, and S7c's early deltas. |
| Fidelity to brief and rulings | 8 | **7** | Rulings 2, 11 and 14 are not applied; 6 is partly. |
| Distinctness | 8 | **8** | Unchanged. |

**Still to do, in order:**

1. Ruling 2: use the record-kind names in the records tables.
2. Ruling 14: S7c and S7a without deltas.
3. Ruling 11: "+2.5 kg in your last 4 sessions" beside `▲ Moving`, or move the 3M gain away from the verdict.
4. The S7c button position.
5. The 1M headline.
6. The two label overlaps.
7. The body-map key.
8. S4 rows at 56 px.
