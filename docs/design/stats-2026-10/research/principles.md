# Stats principles: which numbers mean something, and how to show them on a phone

Research note for the 2026-10 stats run (see `../frame.md`). It builds on
`docs/design/redesign-2026-10/research/principles.md` (visual system, gym context, the 25-item UI
checklist) and on the `dataviz` skill (form heuristic, mark specs, colour validator,
anti-patterns). It does not repeat them: where they already rule, this note cites them as
**[UI-n]** (an item of the earlier checklist) or **[dataviz: file]**.

The lifter this note is written for: one person, intermediate, on a fixed **A/B split, 3 sessions a
week**, 14 exercises, rep ranges **5–15** (most 8–12), double progression (decision 0006). Each
exercise therefore gets about **1.5 exposures a week, about 6 a month, about 19 in 3 months**. Every
"minimum data" figure below is stated in exposures and converted with that rate.

---

## 1. Sources and confidence

**Confidence key.** **P** = primary source read (full text or the authors' abstract). **S** =
reached only through secondary summaries, course slides or search snippets; the claim is the
consensus reading, but not checked against the original. **K** = from standing knowledge of a
well-known work, not re-fetched in this run. Treat **S** and **K** claims as directional.

### Training science

| Source | What it supports here | Conf. |
|---|---|---|
| Nuzzo, Pinto, Nosaka, Steele. *Maximal number of repetitions at percentages of 1RM: a meta-regression.* Sports Med 54 (2024) 303–321. <https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/> | Reps-at-%1RM varies between people and **by exercise** (more reps on leg press than bench at the same %); the between-person SD is large. So any fixed reps→1RM formula is a population average | P (abstract) |
| Mayhew et al. 2008; LeSuer et al. 1997 (via the bench study abstract and a 2026 arXiv paper, <https://arxiv.org/pdf/2603.17495>) | 1RM equations are accurate **at ≤ 10 reps to failure** and drift (over or under, by equation) above 10. Equations correlate r > 0.9 with true 1RM while still carrying meaningful absolute error | S |
| Grgic et al., systematic review of 1RM test–retest reliability (32 studies, n = 1595), via search snippet | A *tested* 1RM varies session to session with a **median CV ≈ 4 %** (range 0.5–12 %). An *estimated* 1RM from a submaximal set is noisier | S |
| Halperin et al. *Accuracy in predicting repetitions to task failure.* Sports Med 52 (2022). <https://pubmed.ncbi.nlm.nih.gov/34542869/> | Lifters **under-estimate reps in reserve by ≈ 1 rep** on average; more accurate near failure and in lower-rep sets; training age barely helps | P (abstract) |
| Zourdos et al. *Novel RT-specific RPE scale measuring RIR.* JSCR 30(1) 2016 | The RIR-based RPE scale (RPE 10 = 0 RIR) is the field standard; our RIR 0/1/2/3+ chips match it | P (abstract) |
| Zourdos et al. 2021 JSCR, <https://pubmed.ncbi.nlm.nih.gov/30747900/> | RIR error is larger at RPE 5–7 (far from failure) and in higher-rep sets | P (abstract) |
| Schoenfeld, Ogborn, Krieger 2017 (weekly sets dose-response) and Baz-Valle et al. 2022 (12–20 vs > 20 sets), via <https://pmc.ncbi.nlm.nih.gov/articles/PMC8884877/> and summaries | More weekly hard sets per muscle → more growth, roughly up to ~10 sets/week; **12–20 sets/muscle/week** is a reasonable range for trained people; no clear benefit beyond 20 for most muscles | S |
| Pelland, Remmert, Robinson, Hinson, Zourdos. *Dose-response of volume and frequency.* Sports Med 2025, doi 10.1007/s40279-025-02344-w (preprint on SportRxiv) | Counting indirect work as **fractional sets (0.5)** predicts outcomes better than counting it as 0 or 1. Strength gains flatten with volume sooner than size does | S (abstract + summaries) |
| Israetel / Renaissance Periodization volume landmarks (MEV / MAV / MRV), via third-party summaries (e.g. <https://arvo.guru/resources/methods/rp-training>) | Practitioner heuristic: a weekly-set floor (MEV ≈ 6–10), a productive band (MAV ≈ 12–20), a recovery ceiling (MRV ≈ 20–25), **individual and per-muscle** | S — heuristic, not a measured threshold |
| Rogerson, Bell et al. *Deloading practices in strength and physique sports.* Sports Med Open 2024. <https://pmc.ncbi.nlm.nih.gov/articles/PMC10948666/> | Athletes deload about **every 5.6 ± 2.3 weeks for ≈ 1 week**, cutting sets and reps and load; triggers include stalled performance | P (abstract + full text) |

### Visualisation and dashboards

| Source | What it supports here | Conf. |
|---|---|---|
| Cleveland & McGill. *Graphical perception.* JASA 79 (1984) | Accuracy ranking of encodings: position on a common scale > non-aligned position > length > angle/slope > area > volume/saturation > hue | S (course slides, FlowingData) |
| Few. *Bullet Graph Design Specification* (rev. 2013). <https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf> | Label, one linear scale, featured bar, 1–2 comparative ticks, 2–5 (ideally 3) qualitative bands in **one hue's intensities**; non-zero scale → use a dot not a bar; a "lower is better" variant reverses the bands | P (full text) |
| Few. *Information Dashboard Design* (2006/2013) | A dashboard is a single-screen, at-a-glance display of the few things that need monitoring | K |
| NN/g. *Dashboards: making charts and graphs easier to understand.* <https://www.nngroup.com/articles/dashboards-preattentive/> | Position and length map to quantity; colour does not read as ordered; avoid pie, donut, gauge, radar, treemap for quick reading | P |
| NN/g. *Progressive disclosure*; *Empty state design* (already cited in the UI note) | Defer secondary detail; empty states give status, teach and offer the next step | P (via UI note) |
| Tufte. *The Visual Display of Quantitative Information* (data-ink, chartjunk); *Envisioning Information* (small multiples); *Beautiful Evidence* ch. "Sparklines" | Maximise data-ink; small multiples on shared scales; sparklines are "data-intense, design-simple, word-sized graphics" | K, S for sparklines (<https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/>) |
| Shneiderman. *The Eyes Have It.* IEEE VL 1996 | "Overview first, zoom and filter, then details-on-demand", plus relate, history, extract | S (DRUM listing) |
| Munzner. *Visualization Analysis & Design* (2014) | Expressiveness (show all and only what the data says) and effectiveness (most important attribute → most salient channel); "eyes beat memory" — side-by-side beats flipping between views | K |
| Wexler, Shaffer, Cotgreave. *The Big Book of Dashboards* (2017) | Chapters "Beware the dead-end dashboard" (every view should lead to an action or a deeper view) and "The allure of red and green" | S (table of contents only) |
| Segel & Heer. *Narrative visualization: telling stories with data.* InfoVis 2010 | Author-driven headline first, then reader-driven exploration ("martini glass") | K |
| Correll, Bertini, Franconeri. *Truncating the y-axis: threat or menace?* CHI 2020 | Truncated axes enlarge perceived effects, consistently; acceptable for lines when labelled, not for bars | K |
| Correll & Gleicher. *Error bars considered harmful.* InfoVis 2014; Hullman et al. *In pursuit of error* (TVCG 2019) | Lay readers misread error bars; uncertainty is usually omitted; prefer bands, ranges in words, or showing the raw spread | K / S |
| Cleveland. *Visualizing Data* (1993), banking to 45° | Aspect ratio controls perceived slope; a short, wide phone chart flattens trends, a tall narrow one exaggerates them | K |
| Apple. WWDC22 *Design an effective chart* / *Design app experiences with charts* (<https://developer.apple.com/videos/play/wwdc2022-110340>); HIG "Charts" | Focused charts, clear marks and axes, a written description, VoiceOver per mark, audio graphs. The HIG page itself did not render in this run | S |
| Material Design "Data visualization" | Page did not render; not relied on | — |

**Gaps.** No source gives a validated "stall" definition for intermediate lifters; the one used
below is a practitioner heuristic sized to the noise figures above. RP landmark numbers are not
from RP's own tables. Nothing here was tested with this lifter.

---

## 2. Stat validity

"Noise" is the session-to-session wobble relative to the change the stat is meant to detect.
"Min data" is the least history before the stat may make a *claim* (it may still be *shown* as raw
points earlier). Rates assume 1.5 exposures/exercise/week and 3 sessions/week. Warm-up sets are
excluded everywhere (frame constraint) and are not repeated in each row.

| Metric | Question it answers | Noise | Min data | Pitfalls | Verdict |
|---|---|---|---|---|---|
| **Working-weight progress** (decision 0006: reps done at the session's heaviest weight vs `sets × top of range`; "x of y reps to the next step") | Am I closing in on the next weight? | Low — reps are counted, not estimated | 1 exposure | One heavy top set becomes the working weight (0006 consequence); small-dumbbell steps (3 → 4 kg is +33 %) make the bar reset hard | **Headline** (per lift, and as a count "3 lifts ready to go up") |
| **Load or reps at working weight over time** (the staircase) | Is this lift moving, in the units I lift in? | Low | 3 exposures (2 weeks) for a direction; 6 (4 weeks) for a trend | Steps are coarse; plateaus are real between steps. Must not interpolate across missed weeks | **Headline** for the per-lift view |
| **e1RM (Epley)** | Is my strength on this lift rising, comparing sets of different weight × reps on one scale? | Medium: ±3–5 % between sessions (tested-1RM CV ≈ 4 %, estimates noisier); higher with reps > 10 | 6 exposures (~4 weeks) before a trend claim; a change < ~5 % over < 4 weeks is inside noise | Above 10 reps every equation drifts (Epley reads *lower* than Brzycki above 10, higher below, equal at 10). Exercise-specific: long-ROM lifts and isolation lifts misestimate in opposite directions. Lateral raises 10–15 reps at 3–4 kg: e1RM is close to meaningless. At 1 rep Epley returns 1.033 × w. Never call it "your max" | **Secondary** as a trend line for loaded compounds in ≤ 10-rep work (squat, deadlift, DB bench, rows, shoulder press); **drill-down only** for 10–15-rep isolation lifts. Label as "estimated" |
| **Hard sets per muscle per week** (working sets, fractional: primary 1, secondary 0.5) | Is each muscle getting enough work? | Low per week, **but alternates**: an A/B split at 3×/week gives 2A+1B one week and 1A+2B the next, so a calendar-week bar zig-zags ±30–50 % by design | 2 weeks (one A/B cycle); compare **2-week or 4-week averages**, or weeks of the same parity | Landmarks (10–20) are heuristics and individual; counting a set without effort data assumes it was hard; secondary-muscle weighting changes the totals | **Headline** for "where" (vs the plan, as a bullet graph); landmark bands as muted context only |
| **Tonnage** (Σ weight × reps) | How much total work did I move? | High: dominated by squat and deadlift, changes with rep choice | — | Rewards junk volume and long sets; bodyweight and assisted lifts contribute ~0 (0006 counts them as reps, mixing units); warm-ups inflate it if leaked; up does not mean better | **Drill-down only** (session summary, per-exercise). **Avoid** as a headline or a cross-muscle comparison |
| **Planned vs done** (sets done / sets planned, per session, per week, per muscle) | Did I do what the program says? | Low | 1 week | Swaps move sets between muscles; a cut-short session reads as "missed" when it was a choice | **Secondary** (feeds the muscle bullet graph's comparative tick and adherence) |
| **Adherence** (sessions done in the last 4 weeks vs 12 planned; calendar of trained days) | Am I showing up? | Low | 2 weeks | **Streaks** punish one missed day and reward training through illness; a calendar heat strip encodes presence, not magnitude | **Headline** as "11 of 12" plus a 4–8 week strip; avoid streak counters as the main figure |
| **RIR / effort trend** (per lift: RIR of the last working set over time, at a given load) | Are these sets getting easier (progress) or harder (fatigue)? | Medium: ±1 rep self-report error, larger far from failure | 4 logged exposures at the same load; show coverage ("RIR logged on 5 of 9 sessions") | Optional field → sparse and biased toward memorable sets; RIR "3+" is open-ended; same RIR at more load = progress, same load at lower RIR = fatigue — only readable together with load | **Drill-down only** (annotation on the per-lift chart); never a standalone chart |
| **Relative intensity** (% of e1RM) | How heavy relative to my max? | High — circular when e1RM comes from the same sets | — | Double counting; meaningless for bodyweight and assisted | **Avoid** |
| **Stall flag** (no improvement in working weight, reps at working weight, *or* e1RM over the last **4 exposures ≈ 3 weeks**, excluding marked deloads) | Which lifts are stuck, and is it time to change something? | Medium; false alarms after a missed week or deload | 4 exposures | Must not fire on a deload or a session cut short (0006 consequence); must say *why* it fired and *what changed* | **Headline** as a short list ("Stalled: machine row, 3 weeks"), suggest-never-edit (frame) |
| **Deload / dip marker** (session where working weights or sets drop ≥ ~10 % across most lifts) | Was this dip planned recovery or regression? | Low once marked | — | No deload concept in the app today; unmarked deloads look like regression on every chart | **Secondary** — an annotation on every time chart, never a metric |
| **Records (PRs)** — the six kinds in `records.ts` | What did I beat, and when? | Low | 1 exposure, but **early PRs are cheap** (first month: nearly every session sets several) | Six kinds × 14 lifts floods the feed; an e1RM PR from a 15-rep set is weak; heaviest-set PR on a lighter-rep day is real | **Secondary**: "rep PR at working weight" and "heaviest set" lead; e1RM PRs labelled estimated; a per-lift records table is the drill-down |
| **Muscle balance** (push : pull, upper : lower, per-family sets) | Is my program lopsided? | Low | 2 weeks | On a fixed program the ratio is a **property of the plan**, not of performance: it only moves through skips and swaps | **Drill-down only** — belongs with the program; show the actual-vs-planned *deviation* if any |
| **Bodyweight lifts** (push-ups, hyper-extension: reps per set and total reps; `BW+x` → load) | Am I doing more reps, or adding load? | Low | 3 exposures | No body-weight log → no e1RM; total reps rise when sets are added (0006's "add a set" suggestion), so normalise per set | Headline-eligible per lift, in reps |
| **Assisted lifts** (assisted pull-up: assistance at working reps, `invertProgress`) | Am I needing less help? | Low | 3 exposures | Less is better: reversed axis, nothing negated (frame); e1RM undefined; a drop in assistance with fewer reps is not clearly progress | Headline-eligible per lift; axis labelled "assistance (less is better)" |
| **Session duration, rest totals, sets per session** | How long do sessions take? | Medium | — | Rest timers left running; not a progress signal | **Drill-down only** (History) |

**Rules that follow from the table**
1. Lead with stats measured in the units the lifter loads and counts (kg on the bar, reps done,
   sets done). Estimated quantities (e1RM) come second and say "estimated".
2. Never show a direction, a percentage change or a "stalled" label before its minimum data;
   before that, show the raw points and say how many more sessions are needed.
3. Compare volume across **matched periods** (2-week or 4-week windows, or same-parity weeks), never
   week against the previous calendar week on an A/B split.
4. Every time chart must be able to show a deload or a gap as such, not as a loss.

---

## 3. The question hierarchy

Ranked by how often a lifter opens stats to answer it, and how much it changes what they do next.

| # | The lifter's question | Best metric | Best form | Where |
|---|---|---|---|---|
| 1 | **"Am I progressing?"** (overall, this month) | Count of lifts up / flat / down over the last 4 weeks by working weight or reps; sessions done | One sentence headline + a small-multiple grid of 14 sparklines (shared time axis, each on its own y-scale, end value labelled) | Stats landing, first screen |
| 2 | **"What should I do next time?"** | Working-weight progress ("2 reps to 65 kg"), lifts ready to step up, stalled lifts | A short ranked list; each row a bullet bar (done vs target reps) + the suggestion in words | Landing, under the headline; also on the workout screen |
| 3 | **"How is *this* lift going?"** | Load (or reps / assistance) at working weight over time; e1RM as a secondary line; records | Per-lift view: step/line chart with raw points, deload and gap marks, end label; records table beneath | Drill-down from any lift row or sparkline |
| 4 | **"Is any lift stuck?"** | Stall flag over 4 exposures, with the reason | Emphasis: the stalled lifts highlighted in the small multiples, everything else grey; a list with "since" dates | Landing (only when non-empty) |
| 5 | **"Am I training every muscle enough?"** | Hard sets per muscle, 2-week average, vs plan and vs a muted 10–20 band | Horizontal bullet graphs, one row per muscle, sorted by deficit; body map as an index, not the measure | Landing section or one tap away |
| 6 | **"Am I showing up?"** | Sessions in the last 4 weeks vs plan; trained-day calendar | Stat tile "11 of 12" + a 4–8 week day strip | Landing, small |
| 7 | **"What did I beat?"** | Records by kind and date | A dated list (newest first), kind as a text tag; per-lift records table | Landing teaser → full list |
| 8 | **"How hard am I pushing?"** | RIR at load, coverage | Annotation on the per-lift chart (marker shape or a small label per point) | Per-lift drill-down only |

---

## 4. Visualisation principles for phone-sized stats

Each extends the `dataviz` skill to a 360–430 px wide, one-handed, glance-and-go context.

1. **Insight first, chart second.** Open with the answer in words ("8 of 14 lifts up this month ·
   2 stalled"), then the evidence. — Segel & Heer 2010 (martini glass); Few, dashboards.
   *In our app:* the landing's first element is a one-line verdict computed from §2's headline
   stats, not a chart title.
2. **Overview → zoom → details on demand.** — Shneiderman 1996. *In our app:* landing = all lifts
   at once; tap a lift = its chart; tap a point = that session's sets. Nothing deeper than three
   levels.
3. **Encode the key quantity by position or length.** — Cleveland & McGill 1984; NN/g.
   *In our app:* progress, sets and reps are bars, ticks and line positions. Colour on the body map
   or a calendar may only say *where* or *whether*, never *how much* alone; the number is always
   printed or one tap away.
4. **Small multiples beat one crowded chart.** — Tufte; dataviz `choosing-a-form` (past ~4
   converging series, facet). *In our app:* 14 lifts are 14 small panels on one shared time axis,
   never 14 lines on one plot, and never a categorical legend of 14 hues.
5. **Sparklines as word-sized evidence.** — Tufte, *Beautiful Evidence*. *In our app:* each lift
   row carries a sparkline in the de-emphasis hue with the latest point in the accent and its value
   as text (dataviz stat-tile contract). No axes; the row's number carries the scale.
6. **Emphasis, not categories.** — dataviz `choosing-a-form`. *In our app:* the stalled or improved
   lift is the one coloured series; everything else is grey. Muscle-family colours (if kept) are
   identity tags, not series fills.
7. **Bullet graphs for "against a target".** — Few, bullet spec. *In our app:* sets per muscle vs
   plan, reps vs the next-step target, sessions vs 3/week. 3 bands at most, one hue's intensities,
   the plan as the comparative tick. Assisted lifts use Few's reversed variant.
8. **Bars start at zero; lines may zoom, and say so.** — Few, bullet spec (non-zero scale → dot,
   not bar); Correll et al. 2020. *In our app:* sets and reps bars from zero; a load or e1RM line
   may use a tight y-range, with labelled min/max ticks.
9. **Mind the aspect ratio.** — Cleveland, banking to 45°. *In our app:* per-lift charts are at
   least ~0.5 as tall as wide; sparklines are compared only against each other on a shared
   rule (same height, same time span), never read as absolute slopes.
10. **One axis, one unit.** — dataviz non-negotiable; frame (no dual axes). *In our app:* e1RM and
    load share kg and may share a plot; reps, RIR, sets never share a y-axis with kg. Show them as
    stacked small panels on one time axis.
11. **Show raw points with the summary.** — Tufte (show the data); Hullman et al. (uncertainty is
    usually hidden). *In our app:* every trend line draws its session points; a smoothed line or
    trend never appears without them.
12. **Honest uncertainty in words and bands, not error bars.** — Correll & Gleicher 2014.
    *In our app:* e1RM says "estimated"; a change inside the noise floor reads "about the same";
    if a band is drawn, it is a light wash (dataviz area spec), never whiskers.
13. **Time is real time; gaps stay gaps.** — Tufte (integrity); Munzner (expressiveness). *In our
    app:* the x-axis is the calendar; a gap longer than ~14 days breaks the line; a deload is
    annotated, not hidden or interpolated.
14. **Label directly, sparingly.** — dataviz `marks-and-anatomy`. *In our app:* the end value, the
    best value and annotated events are labelled; nothing else. Records are text beside the chart,
    not a number on every dot.
15. **Direction-aware good/bad.** — Few (lower-is-better variant); dataviz (delta colour = direction ×
    whether up is good). *In our app:* "down 2.5 kg" on assisted pull-up is good and wears the good
    token; the axis is reversed and labelled "less is better".
16. **Status colour never alone.** — dataviz; Big Book "allure of red and green". *In our app:* up /
    flat / stalled carry a glyph and a word as well as a colour; no red–green pair carries meaning by
    itself.
17. **No dead ends.** — Big Book of Dashboards ch. 32. *In our app:* every stat on the landing leads
    to its evidence (tap → per-lift or per-muscle view) and, where one exists, to a suggestion.
18. **Glanceable at arm's length.** — UI note §2 (hero size, contrast); Few. *In our app:* the
    landing's verdict and per-lift values meet the earlier contrast targets [UI-13]; charts are
    readable without zooming at the device's default text size.
19. **Every chart has a non-visual twin.** — dataviz (table view); Apple WWDC22 (VoiceOver per mark,
    a written description). *In our app:* each chart has a one-line text summary and a table/list of
    its points (today's records list is the table view for the per-lift chart, decision 0006).

---

## 5. Interaction principles

**Ranges**
- One range control per view, **above** everything it scopes, presets only: 1M / 3M / 1Y / All
  (dataviz `interaction`; matches `lifts.ts`). Default **3M**: about 19 exposures per lift, enough for
  a trend, short enough to see recent change.
- A range shorter than a lift's minimum data shows the raw points and says "Not enough sessions in
  this range for a trend".
- Changing the range never reorders or recolours lifts (dataviz: colour follows the entity).

**Scrubbing and detail**
- Line and step charts: drag along the chart to scrub; a vertical hairline snaps to the nearest
  session (dataviz crosshair). The readout shows date, the working sets as `62.5 × 8 · 8 · 7`, and
  any record set. Hit area is the whole plot height, not the dot.
- Release keeps the readout (sticky selection) so the thumb can leave the screen; tap empty space or
  a close control to clear. Tap on a point opens that session.
- No tooltip-only values: the same data is in the list or table below (dataviz).

**Comparison**
- Compare **then vs now** inside one lift with a reference: a faint tick or line at the value N
  weeks ago, labelled ("4 weeks ago 60 kg"), not a second series.
- Compare **lifts** through small multiples on shared time axes, not overlays. If two lifts must
  overlay, index both to 100 at the range start (dataviz anti-pattern on dual axes).
- Compare **volume** periods in matched windows (§2 rule 3).

**Drill-down**
- Three levels, each a full-screen push with a back affordance: landing → lift or muscle → session.
- The drill-down opens in the same range as its parent.
- The landing sorts lifts by what needs attention (ready to step up, stalled), not alphabetically;
  program order is an alternative toggle.

**Empty, sparse and gappy states**
- **0 sessions:** say what stats will show and when ("Stats start after your first workout"), one
  action to start it. No empty axes.
- **1–2 exposures of a lift:** show the points and the working-weight bar; no line, no trend, no %;
  "2 more sessions for a trend".
- **3–5 exposures:** a line, but no up/down verdict and no stall flag.
- **≥ 6 exposures:** full treatment.
- **Gaps:** break the line; label a long gap ("No training 12–28 Sep"); never count a gap toward a
  stall.
- **Deload:** marked on every chart; excluded from stall detection and from "down" verdicts.
- **Optional data (RIR, notes, set kinds):** show coverage, never infer from absence.

---

## 6. Acceptance checklist (review rubric)

Answer each **yes / no** by looking at the rendered mock (all states it provides). Every answer
should be **yes**. Items are about quality, not a look; a concept may satisfy them in any visual
language. The earlier 25-item UI checklist still applies to the chrome; these items add stats.

**A. Stat validity**
1. Is the first stats screen's primary figure or sentence one of the §2 *headline* stats (working-weight progress, load/reps at working weight, sets per muscle vs plan, adherence, stall list) — **not** tonnage, e1RM alone or a PR count?
2. Is tonnage (total kg) absent from the landing, or present only inside a session or per-exercise detail?
3. Is every e1RM figure labelled "estimated" (or "e1RM" with a visible definition), and is e1RM never the only progress measure shown for a lift?
4. Are bodyweight lifts shown in reps (or `BW+x` load) and the assisted lift in assistance on a reversed, labelled axis — with no negative kilograms anywhere?
5. Is there visible evidence that warm-ups are excluded (a note, a legend, or warm-up sets drawn distinctly and outside the totals)?
6. Is weekly per-muscle volume shown as **sets**, against the program's planned sets, over a window that does not zig-zag with the A/B alternation (2+ weeks, or matched weeks)?
7. Does every up/down verdict, percentage change or "stalled" label appear only where the lift has enough sessions, with sparse lifts saying how many more are needed?
8. Is a deload, a cut-short session or a gap distinguishable from a regression on the per-lift chart?
9. Are records limited and ranked (newest or most meaningful first, kind named in words) rather than every record kind for every lift at once?

**B. Chart craft**
10. Is every quantity that the lifter must compare encoded by position or length (bars, lines, ticks), with colour used only for identity, emphasis or status?
11. Are there zero dual-axis charts, pies, donuts, gauges, radar charts and 3D effects?
12. Are multi-lift comparisons small multiples or emphasis (one coloured series, the rest grey), never more than 4 coloured series in one plot?
13. Do bar charts start at zero, and does every non-zero line axis show labelled min and max ticks?
14. Does each time chart show the raw session points under any line or trend?
15. Is labelling selective — end value, best value and annotations — with no number on every point?
16. Does every delta show its direction in a glyph or word as well as colour, and is "less assistance" shown as good?
17. Do all sparklines on one screen share the same time span and height?
18. Does every chart have a one-line text summary or a list/table holding the same values?

**C. IA and interaction**
19. Does the landing open with a written verdict (what changed, in words) before the first chart?
20. Can the lifter go landing → one lift → one session in ≤ 2 taps, and back?
21. Is there exactly one range control per view, above the content, with presets and a visibly selected state?
22. Does the mock show a scrub/selection state with a hairline snapped to a session and a readout of that session's working sets?
23. Does every landing stat lead somewhere (tap target to its evidence or a suggestion), with no dead-end tiles?
24. Is every suggestion phrased as a suggestion (for example "Try 65 kg next"), with no control that edits the program from stats?
25. Are the empty (0 sessions) and sparse (1–5 sessions of a lift) states both designed, each with what to expect and one next step?
26. Do all previously shipped stats (per-lift chart, records, volume vs baseline, muscle map, session summary, History | Stats access) still have a visible home?

**D. Gym context**
27. Are the verdict and per-lift current values legible at arm's length — at least ~20 px for row values and the earlier hero/contrast rules [UI-12, UI-13] for the lead figure?
28. Are tap and scrub targets ≥ 44 px (≥ 56 px for primary rows) with ≥ 8 px gaps?
29. Can the landing's answer to "am I progressing, and what next?" be read without scrolling on a 390 × 844 viewport?
30. Is every claim usable one-handed: range presets and drill-down rows within thumb reach, and no gesture that needs two fingers (pinch) to reach essential data?
