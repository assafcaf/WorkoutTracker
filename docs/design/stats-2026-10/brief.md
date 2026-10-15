# Stats brief: four concepts for how the app shows statistics

Date: 2026-10-15. Author: design director. Audience: the four designers, each building one concept.

Read before starting, in this order:
1. `frame.md` (the task frame; freedom is "anything goes").
2. `research/principles.md`: the stat-validity table (§2), the question hierarchy (§3), and the
   **30-item acceptance checklist (§6)**. The checklist is the review rubric.
3. `research/audit.md`: what the app computes today and what is wrong with it.
4. `research/market.md`: 22 products, chart forms (§4), IA archetypes (§5).
5. This brief, then **`brief-data.json`**, the shared numbers.
6. The `dataviz` skill (the frame gives its path): `references/choosing-a-form.md`,
   `marks-and-anatomy.md`, `interaction.md`, `anti-patterns.md`, and the validator in `scripts/`.

Paths are relative to `docs/design/stats-2026-10/`, unless they start with `docs/` or `src/`; those
are relative to the repository root (the folder that holds `CLAUDE.md`).

**What the owner asked for.** Stats researched as thoroughly as the 2026-10 UI run. "Good" means: a
lifter opens stats and **in seconds knows whether they are progressing, where, and what to do next**.

**What the last run taught.** The four UI concepts diverged on how a set is logged, then converged
on the same e1RM line, volume bar chart, records table and body-map card. This brief prevents that
in two ways:
- every concept has a different thesis for **the headline stat, where stats live (IA), the primary
  chart form, the interaction model and the visual stance**;
- Part 3 states the divergence axis **for every frame**. If your frame looks like the row next to
  yours in that table, it is wrong.

Comparability comes from **shared data**, not shared layouts. All four mocks show the same lifter,
the same 45 sessions and the same numbers, character for character.

You build **exactly** what your concept section says. Where this brief is silent, follow
`research/principles.md`. Where the brief and the principles disagree, the brief wins. Do not add
stats, frames or data that are not listed. Do not open the other concepts' folders.

---

## Part 1 — Shared foundation (all four concepts)

### 1.1 The fixed frame list

Every concept draws the same 18 frames. Each is a phone screen at **exactly 390 × 844 CSS px**,
with a 47 px status bar (`9:41`, signal, wifi and battery glyphs in the ink colour) and a 34 px
home-indicator zone (a 134 × 5 px rounded bar, 8 px from the bottom). No bezel; clip to a 40 px
outer radius (board presentation only).

| Code | Frame | What it must show |
|---|---|---|
| **P** | Live prototype | Interactive. Opens on S1. See 4.3 for what must work. |
| **S1** | Stats home | Where the lifter lands to ask "am I progressing?". Today is Thu 15 Oct, 18:05, no session open. The concept's headline stat is the first thing read. |
| **S1b** | Stats home, second screen | The same page scrolled one screen (or the concept's second landing view). What sits below the fold. |
| **S2** | One loaded lift in depth | **Back squat**, default range. Real time axis with the holiday and sick-week gaps, the deload week, warm-ups excluded and visibly so, Wed 14 Oct's heavier set with a lower e1RM shown as progress. |
| **S3** | The assisted lift | **Assisted pull-ups**. Less assistance is better: reversed axis, labelled `BW−19`, nothing negated, the BW−27 → BW−19 staircase. |
| **S3b** | A bodyweight lift | **Hyper-extension**: 18 bodyweight-only sessions, then `BW+5` from Wed 7 Oct. One continuous history; the switch is annotated, not a reset. |
| **S4** | Muscles and volume against the plan | 12 muscles, hard sets per week against the planned sets, over a window that does not zig-zag with A/B. Answers "which muscles am I under-training?". |
| **S5** | Records | The curated records of the last 3 weeks (1.3.6), plus Back squat's records table. |
| **S6** | Post-workout summary, the stats part | Workout A, Wed 14 Oct, just finished. What the session achieved, lift by lift. |
| **S7a** | Sparse: fresh install | A program chosen (A/B Split), 0 sessions. No empty axes, no grids of zeros. |
| **S7b** | Sparse: 1 session | Only Mon 22 Jun (Workout A) logged. Today is Tue 23 Jun. |
| **S7c** | Sparse: 3 sessions | Mon 22 Jun A, Wed 24 Jun B, Fri 26 Jun A logged. Today is Sat 27 Jun. |
| **S8a** | Interaction: range change | The concept's range control, changed from its default to a longer range, on Back squat. |
| **S8b** | Interaction: scrub / selection | A hairline snapped to **Fri 9 Oct** on Back squat, with a sticky readout of that session's working sets. |
| **S8c** | Interaction: compare | The concept's comparison mechanism (named in its section), in use. |
| **S8d** | Interaction: drill-down | From the DB bench press stall to its evidence, to the session where it last moved (**Fri 7 Aug**). Show the destination, with the path in the board caption. |

**Why this list differs from the suggested one.** S1b exists because a stats home is a scroll and
the below-the-fold content is where concepts converged last time. S3b exists because the audit's
worst bodyweight bug is the hyper-extension series switch, and the assisted lift alone does not test
it. S7 and S8 are split into one frame per state and per interaction, so the reviewer can check each
against checklist items 22 and 25 without guessing.

**Out of scope.** The live set screen, rest timer, program editor and settings. Where your IA
changes where the live screen's stats (projection line, PR toast, volume vs last time) point to,
say so in `rationale.md`; do not draw them.

### 1.2 Board geometry (fixed, so renders can be cropped and compared)

- Board **2760 × 3240 px**: `body { margin: 0; width: 2760px; height: 3240px }`.
- Board background: `#E4E5E7` for light concepts, `#0B0C0E` for Concept 3. Board text 14 px.
- **Header, y 0–352**, padded 48 px: concept name (40 px), thesis (20 px), four short lines
  (Headline stat · IA · Primary form · Interaction), and a token strip: the neutral ramp, the
  accent, every data colour as 40 px swatches with hexes, plus one font specimen line.
- **Frames** at column x = **48, 494, 940, 1386, 1832, 2278**, all 390 × 844. Each label sits 36 px
  above its frame in 14 px/600 board text: code + name + one-line note.

| Row | Frame top y | Columns 1–6 |
|---|---|---|
| 1 | 400 | P · S1 · S1b · S2 · S3 · S3b |
| 2 | 1356 | S4 · S5 · S6 · S7a · S7b · S7c |
| 3 | 2312 | S8a · S8b · S8c · S8d · panel spanning columns 5–6 |

- The row-3 panel is 836 × 844 at x = 1832: the 4-question tap-count table (4.1) and the 30-item
  self-check, 13 px.
- S8 frames carry a 2-line caption under the frame (board text), e.g. `Tap 3M → 1Y · the holiday
  and sick week appear as breaks`.
- Tap and drag markers are **board annotations, not design**: a 44 px circle with a 2 px dashed
  `#E5007E` stroke; a drag is the same circle plus a 2 px dashed arrow.
- Static frames are pixel-accurate screens. Content that would scroll is cut at the frame bottom
  (`overflow: hidden`).

### 1.3 The canonical data

#### 1.3.1 Source and adjustments

**`brief-data.json` is the single source of numbers.** It is built by `brief-data.py` (run from the
repo root: `python docs/design/stats-2026-10/brief-data.py`) from `research/dataset.json`, plus the
adjustments below. Use its values character for character. If you need a number it does not hold,
derive it with the rules in 1.3.2 and list it in `rationale.md` under "Derived numbers".

The audit's seed is an optimistic novice: nearly every lift climbs every week, which inflates
records and under-tests the hard states. Three realism adjustments, used by all four concepts:

1. **A deload week: Mon 21, Wed 23 and Fri 25 Sep** (the week after the sick week). Every working
   weight × 0.9 rounded down to the lift's step; assistance +2 kg (BW−21 → BW−23); one working set
   fewer per exercise; RIR +1; sessions 12 min shorter (58, 54, 56 min). The Mon 21 Sep session note
   is `Deload week, back from being sick.` Deload sessions set no records and never count toward a
   stall or a "down" verdict.
2. **A regression: Narrow-grip pull-down.** Fri 2 Oct `47.5 × 10 · 47.5 × 9 · 47.5 × 8`; Wed 7 Oct
   `46.25 × 10 · 46.25 × 9 · 46.25 × 9` with the session note `Right elbow sore on pull-downs,
   dropped the weight.`; Mon 12 Oct `46.25 × 9 · 46.25 × 8 · 46.25 × 8`.
3. **Two stalls are already in the seed** and stay: DB bench press (13 kg × 9 since Fri 7 Aug) and
   Push-ups (best set 17 reps since Mon 3 Aug). The **gap** (holiday, week of 10 Aug) and the **sick
   week** (14 Sep, one B session) stay too.

So the realism quota is: 1 gap, 1 short week, 1 deload, 2 stalls, 1 regression, 1 heavier-set-but-
lower-e1RM day (Back squat Wed 14 Oct; Deadlift Mon 12 Oct), 1 bodyweight-to-loaded switch.

#### 1.3.2 The rules every concept models (the must-fix truths)

These fix the audit's correctness findings. Every concept must model all seven **and make each one
visible somewhere on the board** (the frame is named after each rule).

| # | Rule | Exact definition | Must be visible in |
|---|---|---|---|
| T1 | **Warm-ups are excluded** | Warm-up sets never count toward records, e1RM, verdicts, volume, set counts or muscle sets. Drop and failure sets count as full working sets for volume and muscle sets; **drop sets never set records**. | S2 (warm-ups drawn distinctly or listed apart, with the words "warm-ups not counted"), S6 |
| T2 | **Real time axes, gaps visible** | The x-axis is the calendar. A lift's line **breaks across any calendar week in which it had no session**; the gap is labelled (`Holiday`, `No A session`). Never interpolate. | S2, S3, S8a |
| T3 | **Honest verdicts and stalls** | Per lift, over non-deload sessions only. Fewer than 4 → `too new` (say how many more). **Slipping**: the last 2 sessions are both below the best top set of the 4 sessions before them (lower weight, or same weight and fewer reps). **Stalled**: no record (T4) in the last 4 sessions. **Moving**: otherwise. Deloads are skipped; a gap never counts. | S1, S8d |
| T4 | **A sane PR definition** | At most **one record per lift per session**, first match wins: **Heaviest weight** (or **Least assistance**, or **First added load**) > **Rep record** (more reps in one set at a weight or assistance already lifted) > **Estimated 1RM** (+0.5 kg or more; e1RM lifts only). A lift's first session is its **baseline**, not a record. Deload sessions set none. "Most reps at the heaviest weight" and volume records are gone. One count everywhere: live, summary, session rows. | S5, S6 |
| T5 | **e1RM only where it means something** | Epley `w × (1 + r/30)`, only for the 5 lifts programmed at ≤ 10 reps (Back squat, DB bench press, Machine shoulder press, Deadlift, Machine row), only from sets of ≤ 10 reps. Always labelled **estimated**, never the only progress measure, never the headline. The other 9 lifts show weight × reps, reps, or assistance, and **no e1RM at all**. | S2 (secondary to the top set), S5 |
| T6 | **Assisted on a reversed axis** | Assistance is plotted with **less assistance higher** (or further along the "better" direction), axis labelled `assistance · less is better`, ticks `BW−27 … BW−19` with U+2212. No negative kilograms anywhere, no `-19`. A step down in assistance wears the "good" treatment. | S3 |
| T7 | **One muscle taxonomy everywhere** | 12 muscles: Chest, Shoulders, Triceps, Lats, Mid back, Biceps, Quads, Hamstrings, Glutes, Calves, Lower back, Abs. Fractional sets: 1 per primary muscle, 0.5 per secondary, working sets only. Forearms and Traps are counted but appear only in drill-downs. **Lats and Mid back are never merged.** If a concept groups muscles (push / pull / legs / core), a group is the plain sum of its muscles' fractional sets. Week = calendar week, Monday to Sunday, by session start. | S4, S6 |

**Display rounding.** Muscle sets show whole numbers (half up) in rows: 18.75 → `19`, 7.5 → `8`.
Exact values (`18.75`) only in a drill-down or table view. Kilograms keep the lift's step precision
(`46.25 kg`, `62.5 kg`, `13 kg`).

#### 1.3.3 Today, the program, consistency

- **Today is Thu 15 Oct 2026, 18:05.** Program `A/B Split`, 3 sessions a week, Mon/Wed/Fri,
  alternating. This week: Mon 12 Oct B, Wed 14 Oct A done; **Workout B is due Fri 16 Oct**.
- 45 sessions over 17 calendar weeks (22 Jun – 14 Oct). Sessions per week:
  `3 3 3 3 3 3 3 0 3 3 3 3 1 3 3 3 2` (weeks of 22 Jun … 12 Oct).
- Adherence: last 4 full weeks **10 of 12**; last 8 full weeks **22 of 24**; 16 full weeks **43 of 48**.
- Session duration: median **67 min** (deload sessions 54–58); the program estimate is ~53 min.
- Working sets per normal week 69–70; the deload week 48; this week so far 47 (warm-ups 3).

Workout A: Back squat 4 × 8–10 · Lunges 3 × 10–12 · DB bench press 4 × 8–10 · Push-ups 3 × 10–15 ·
Machine shoulder press 3 × 8–10 · Lateral raises 3 × 10–15 · Cable push-down 3 × 10–12.
Workout B: Deadlift 3 × 8–10 · Assisted pull-ups 4 × 5–8 · Narrow-grip pull-down 3 × 10–12 ·
Machine row 4 × 8–10 · Face pull 3 × 10–15 · Hyper-extension 3 × 10–15 · Seated biceps curls 3 × 10–12.

#### 1.3.4 The 14 lifts now (`brief-data.json → lifts`)

"Next step" is decision 0006's double-progression count: reps done in the latest session's sets at
its top weight, against those sets × the top of the range. Full means "try the next weight".

| Lift | Day | Kind | Verdict (T3) | Why | Latest top set | e1RM (est.) | Next step | Records |
|---|---|---|---|---|---|---|---|---|
| Back squat | A | loaded | **moving** | 4 records in last 4 sessions | 62.5 kg × 8 | 79.2 (best 80.0, Fri 9 Oct) | 15 of 20 reps at 62.5 kg | Heaviest set 62.5 kg × 8 · Wed 14 Oct; Best estimated 1RM 80.0 kg · Fri 9 Oct |
| Lunges | A | loaded | moving | 3 records | 13 kg × 10 | — | 30 of 36 at 13 kg | Heaviest set 13 kg × 10 · Wed 14 Oct |
| DB bench press | A | loaded | **stalled** | no record since Fri 7 Aug: 10 sessions, 9.9 weeks | 13 kg × 9 | 16.9 (best 16.9, Fri 7 Aug) | 33 of 40 at 13 kg | Heaviest set 13 kg × 9 · Fri 7 Aug; Best estimated 1RM 16.9 kg · Fri 7 Aug |
| Push-ups | A | bodyweight | **stalled** | no record since Mon 3 Aug: 11 sessions, 10.4 weeks | BW × 15 | — | 44 of 45 reps | Most reps in a set 17 · Mon 3 Aug |
| Machine shoulder press | A | loaded | moving | 4 records | 12.5 kg × 8 | 15.8 | 21 of 30 at 12.5 kg | Heaviest set 12.5 kg × 8 · Wed 14 Oct; Best estimated 1RM 15.8 kg · Wed 14 Oct |
| Lateral raises | A | loaded | moving | 3 records | 7 kg × 10 | — | 29 of 45 at 7 kg | Heaviest set 7 kg × 10 · Fri 9 Oct |
| Cable push-down | A | loaded | moving | 4 records | 32.5 kg × 10 | — | 28 of 36 at 32.5 kg | Heaviest set 32.5 kg × 10 · Wed 14 Oct |
| Deadlift | B | loaded | moving | 4 records | 70 kg × 7 | 86.3 (best 90.0, Wed 7 Oct) | 14 of 20 at 70 kg | Heaviest set 70 kg × 7 · Mon 12 Oct; Best estimated 1RM 90.0 kg · Wed 7 Oct |
| Assisted pull-ups | B | assisted | moving | 4 records | BW−19 × 6 | — | 23 of 32 at BW−19 | Least assistance BW−19 × 6 · Mon 12 Oct; Most reps at BW−19 6 · Mon 12 Oct |
| Narrow-grip pull-down | B | loaded | **slipping** | last 2 sessions below 47.5 kg × 10 (Mon 28 Sep) | 46.25 kg × 9 | — | 25 of 36 at 46.25 kg | Heaviest set 47.5 kg × 10 · Mon 28 Sep |
| Machine row | B | loaded | moving | 4 records | 75 kg × 9 | 97.5 | 35 of 40 at 75 kg | Heaviest set 75 kg × 9 · Mon 12 Oct; Best estimated 1RM 97.5 kg · Mon 12 Oct |
| Face pull | B | loaded | moving | 4 records | 25 kg × 13 | — | 38 of 45 at 25 kg | Heaviest set 25 kg × 13 · Mon 12 Oct |
| Hyper-extension | B | bodyweight | moving | 1 record (first added load) | BW+5 × 12 | — | 33 of 45 at BW+5 | Heaviest added load BW+5 × 12 · Wed 7 Oct; Most reps, bodyweight only 15 · Mon 13 Jul |
| Seated biceps curls | B | loaded | moving, **ready** | 4 records | 14 kg × 12 | — | **36 of 36 at 14 kg → try 15 kg** | Heaviest set 14 kg × 12 · Mon 12 Oct |

**Summary counts:** `11 moving · 2 stalled · 1 slipping`. One lift ready to step up (Seated biceps
curls → 15 kg). Push-ups are one rep from "add a set" (0006's bodyweight branch).
**Stepped up since Fri 18 Sep** (a Heaviest weight, Least assistance or First added load record):
12 of 14 lifts; not DB bench press, not Push-ups. Narrow-grip pull-down stepped up (Mon 28 Sep) and
then slipped.

#### 1.3.5 Series for the depth frames

Every lift's full series is in `lifts.<id>.points[]`: `label`, `deload`, `sets` (working sets),
`warmups`, `top`, `e1rm`, `totalReps`, `rir`, `pr`, `note`. Key ones:

**Back squat (S2, S8).** Top set by session (e1RM in brackets, `D` = deload):
`Mon 22 Jun 50×7 (61.7) · Fri 26 Jun 50×8 (63.3) · Wed 1 Jul 50×9 (65.0) · Mon 6 Jul 50×10 (66.7) ·
Fri 10 Jul 50×10 (66.7) · Wed 15 Jul 52.5×8 (66.5) · Mon 20 Jul 52.5×9 (68.2) · Fri 24 Jul 52.5×10
(70.0) · Wed 29 Jul 55×7 (67.8) · Mon 3 Aug 55×9 (71.5) · Fri 7 Aug 55×10 (73.3) · [holiday week] ·
Wed 19 Aug 57.5×8 (72.8) · Mon 24 Aug 57.5×7 (70.9) · Fri 28 Aug 57.5×9 (74.8) · Wed 2 Sep 57.5×9
(74.8) · Mon 7 Sep 57.5×10 (76.7) · Fri 11 Sep 57.5×10 (76.7) · [no A session, sick week] · Mon 21
Sep 50×10 D (66.7) · Fri 25 Sep 52.5×7 D (64.8) · Wed 30 Sep 60×7 (74.0) · Mon 5 Oct 60×9 (78.0) ·
Fri 9 Oct 60×10 (80.0) · Wed 14 Oct 62.5×8 (79.2)`.
- Wed 14 Oct sets: warm-ups `20 × 10 · 37.5 × 5` (not counted); working `47.5 × 10 · 57.5 × 9 ·
  62.5 × 8 · 62.5 × 7`; record `Heaviest weight · 62.5 kg × 8 · +2.5 kg`. Its e1RM (79.2) is below
  Fri 9 Oct's (80.0): the chart must read this as a step up, not a dip.
- **S8b readout, Fri 9 Oct:** `Fri 9 Oct · 45 × 10 · 55 × 10 · 60 × 10 · 60 × 10` · `Rep record
  · 60 kg × 10 · +1 rep` · `e1RM 80.0 (estimated)` · warm-ups `20 × 10 · 35 × 5` not counted.
- Ranges: 1M = 15 Sep – 15 Oct (6 sessions, 2 of them deload); 3M = 15 Jul – 15 Oct (18 sessions, 2 of them deload);
  1Y and All = all 23.

**DB bench press (S1, S8d).** 13 kg since **Fri 7 Aug** (`13 × 9 · 13 × 9 · 13 × 8 · 13 × 7`,
record `Heaviest weight · 13 kg × 9 · +1 kg`). Since then the top set reads 13 × 8 or 13 × 9 every
session; deload 11 × 8 and 11 × 9. Latest Wed 14 Oct `13 × 9 · 13 × 9 · 13 × 8 · 13 × 7`.
Wed 30 Sep's session note: `Left shoulder a bit tight on bench.`
Fri 7 Aug session (S8d destination): Workout A, 68 min, 23 sets, 3,938 kg, 5 records: Back squat
Rep record 55 kg × 10 · Lunges Rep record 9 kg × 12 · DB bench press Heaviest weight 13 kg × 9 ·
Machine shoulder press Rep record 7.5 kg × 9 · Cable push-down Rep record 22.5 kg × 12.

**Assisted pull-ups (S3).** Steps: BW−27 (24 Jun – 13 Jul) → BW−25 (17 Jul – 5 Aug) → BW−23
(17 Aug – 4 Sep) → BW−21 (9 Sep – 2 Oct, deload Wed 23 Sep at BW−23 × 6 · 6 · 6) → **BW−19** (Wed 7
Oct – now). Each step starts at 5 reps and climbs to 8. Latest Mon 12 Oct `BW−19 × 6 · 6 · 6 · 5`
(23 of 32). Record Wed 7 Oct `Least assistance · BW−19 × 5 · −2 kg assistance`.

**Hyper-extension (S3b).** BW × 10 / 10 / 10 (24 Jun) climbing to BW × 15 / 15 / 15 from Mon 13 Jul,
then flat to Fri 2 Oct, 15 sessions (the deload Wed 23 Sep is BW × 15 · 15), then **BW+5 × 12 · 11 · 10** on
Wed 7 Oct (`First added load · BW+5 × 12 · +5 kg`) and again Mon 12 Oct. Not a stall: it moved on
the load lever.

**Narrow-grip pull-down (slipping).** As in adjustment 2. It must read as slipping, with the elbow
note attached to Wed 7 Oct.

#### 1.3.6 Records (S5): the last 3 weeks, newest first

Deload week: no records. Then (`brief-data.json → sessions[].prs`):

| Date | Records |
|---|---|
| Wed 14 Oct (A) | Back squat · Heaviest weight · 62.5 kg × 8 · +2.5 kg — Lunges · Heaviest weight · 13 kg × 10 · +1 kg — Machine shoulder press · Heaviest weight · 12.5 kg × 8 · +1.25 kg — Cable push-down · Heaviest weight · 32.5 kg × 10 · +2.5 kg |
| Mon 12 Oct (B) | Deadlift · Heaviest weight · 70 kg × 7 · +2.5 kg — Assisted pull-ups · Rep record · BW−19 × 6 · +1 rep — Machine row · Rep record · 75 kg × 9 · +1 rep — Face pull · Rep record · 25 kg × 13 · +1 rep — Seated biceps curls · Rep record · 14 kg × 12 · +1 rep |
| Fri 9 Oct (A) | Back squat · Rep record · 60 kg × 10 · +1 rep (also Estimated 1RM 80.0 kg, +2 kg) — Machine shoulder press · Rep record · 11.25 kg × 10 · +1 rep — Lateral raises · Heaviest weight · 7 kg × 10 · +1 kg — Cable push-down · Rep record · 30 kg × 12 · +1 rep |
| Wed 7 Oct (B) | Deadlift · Rep record · 67.5 kg × 10 · +1 rep (also Estimated 1RM 90.0 kg) — Assisted pull-ups · Least assistance · BW−19 × 5 · −2 kg assistance — Machine row · Heaviest weight · 75 kg × 8 · +5 kg — Face pull · Rep record · 25 kg × 12 · +2 reps — Hyper-extension · First added load · BW+5 × 12 · +5 kg — Seated biceps curls · Rep record · 14 kg × 11 · +1 rep |
| Mon 5 Oct (A) | 5 rep records: Back squat 60 kg × 9 (+2) · Lunges 12 kg × 12 · Machine shoulder press 11.25 kg × 9 · Lateral raises 6 kg × 15 · Cable push-down 30 kg × 11 |
| Fri 2 Oct (B) | 5: Deadlift rep 67.5 kg × 9 · Assisted rep BW−21 × 8 · Row rep 70 kg × 10 · Face pull Heaviest weight 25 kg × 10 (+2.5) · Biceps Heaviest weight 14 kg × 10 (+1) |
| Wed 30 Sep (A) | 5: Squat Heaviest weight 60 kg × 7 (+2.5) · Lunges 12 kg × 11 (+1) · Shoulder press 11.25 kg × 8 (+1.25) · Lateral raises rep 6 kg × 14 · Push-down 30 kg × 10 (+2.5) |
| Mon 28 Sep (B) | 6: Deadlift Heaviest weight 67.5 kg × 8 (+2.5) · Assisted rep BW−21 × 7 · Pull-down Heaviest weight 47.5 kg × 10 (+1.25) · Row rep 70 kg × 9 · Face pull rep 22.5 kg × 15 · Biceps rep 13 kg × 12 |

Lifetime total under T4: **201** records in 45 sessions (the app counts 446). The first month is
cheap: nearly every lift sets one every session. Say so wherever a total appears, or show none.

#### 1.3.7 Muscles (S4)

`brief-data.json → plannedMuscleSetsPerWeek`, `muscleSetsAvgLast2FullWeeks`, `weeks[].muscleSets`.

| Muscle | Planned / week | Last 2 full weeks, avg (28 Sep BAB + 5 Oct ABA) | ABA week (5 Oct) | BAB week (28 Sep) | Deload week (21 Sep) | This week so far (B, A) |
|---|---|---|---|---|---|---|
| Chest | 10.5 | 10.5 | 14 | 7 | 10 | 7 |
| Shoulders | 21 | 21 | 23.5 | 18.5 | 16 | 15 |
| Triceps | 12 | 12 | 16 | 8 | 11 | 8 |
| Lats | 18.75 | 18.75 | 12.5 | 25 | 9 | 12.5 |
| Mid back | 12.75 | 12.75 | 8.5 | 17 | 6 | 8.5 |
| Biceps | 9.75 | 9.75 | 6.5 | 13 | 4.5 | 6.5 |
| Quads | 12.75 | 12.75 | 15.5 | 10 | 11 | 8.5 |
| Hamstrings | 9.75 | 9.75 | 10 | 9.5 | 7 | 6.5 |
| Glutes | 9.75 | 9.75 | 10 | 9.5 | 7 | 6.5 |
| Calves | 7.5 | 7.5 | 8.5 | 6.5 | 6 | 5 |
| Lower back | 12 | 12 | 10 | 14 | 7 | 8 |
| Abs | 3 | 3 | 2 | 4 | 1.5 | 2 |

**The honest finding.** Over a matched 2-week window the lifter did exactly the plan. The
calendar-week view zig-zags by ±30–50 % only because of the A/B rotation. So "which muscles am I
under-training?" has a plan-level answer: **Calves (8), Abs (3), Hamstrings and Glutes (10 each)
sit at or below the usual 10–20 sets range** (show the range as muted context, never as pass/fail);
**Lats (19) and Shoulders (21) sit at its top**. Shoulders includes Face pull. This week's pace: 2
of 3 sessions done with Friday's B still to come, which closes a BAB week. The 4-week window
including the deload averages about 75 % of plan; say "includes a deload week" wherever it is shown.

Workout B on Fri 16 Oct adds: Lats 12.5, Mid back 8.5, Biceps 6.5, Lower back 6, Shoulders 4.5,
Hamstrings 3, Glutes 3, Abs 2, Quads 1.5, Calves 1.5.

#### 1.3.8 The post-workout summary (S6): Workout A, Wed 14 Oct

`71 min · 24 working sets (2 warm-ups not counted) · 4 records`. Loaded volume `4,185 kg`
(`+` 44 bodyweight reps). Compared with the last Workout A (Fri 9 Oct: 23 sets, 4,669 kg): volume
down 10 %, because three lifts stepped up to a heavier weight at fewer reps. Volume may appear here
only, never as the verdict.

| Exercise | Today | Last A (Fri 9 Oct) | Lever |
|---|---|---|---|
| Back squat | 47.5 × 10 · 57.5 × 9 · 62.5 × 8 · 62.5 × 7 | 45 × 10 · 55 × 10 · 60 × 10 · 60 × 10 | **Weight up +2.5 kg** · record |
| Lunges | 13 × 10 · 13 × 10 · 13 × 10 | 12 × 12 · 12 × 12 · 12 × 12 | **Weight up +1 kg** · record |
| DB bench press | 13 × 9 · 13 × 9 · 13 × 8 · 13 × 7 | 13 × 9 · 13 × 8 · 13 × 8 · 13 × 7 | Same weight, +1 rep in total · no record · stalled 10 sessions |
| Push-ups | BW × 15 · 14 · 15 | BW × 15 · 15 · 17 (failure) | Fewer reps (44 vs 47) |
| Machine shoulder press | 12.5 × 8 · 7 · 6 | 11.25 × 10 · 10 · 10 | **Weight up +1.25 kg** · record |
| Lateral raises | 7 × 10 · 10 · 9, then 5 × 12 (drop) | 7 × 10 · 10 · 9 | Same |
| Cable push-down | 32.5 × 10 · 10 · 8 | 30 × 12 · 12 · 12 | **Weight up +2.5 kg** · record |

Muscles worked today (fractional): Shoulders 10.5, Chest 7, Triceps 8, Quads 7, Hamstrings 3.5,
Glutes 3.5, Calves 3.5, Lower back 2. Next: Workout B, Fri 16 Oct; Seated biceps curls is ready for
15 kg.

#### 1.3.9 Sparse states (S7)

- **S7a fresh install:** program A/B Split chosen, 0 sessions, today Thu 15 Oct (or any date; do not
  show one).
- **S7b one session**, Mon 22 Jun A (71 min, 24 sets): Back squat `35 × 10 · 45 × 9 · 50 × 7 · 50 ×
  6` (warm-ups `20 × 10 · 30 × 5`), Lunges `7 × 10 ×3`, DB bench press `10 × 8 · 8 · 8 · 7`, Push-ups
  `BW × 10 · 9 · 11 (failure)`, Machine shoulder press `5 × 8 · 8 · 7`, Lateral raises `3 × 10 · 10 ·
  10, 1 × 12 (drop)`, Cable push-down `17.5 × 10 · 10 · 8`. These are **baselines**, not records.
  Workout B's 7 lifts have no data.
- **S7c three sessions:** add Wed 24 Jun B (Deadlift 55 × 8, Assisted pull-ups BW−27 × 5, Pull-down
  41.25 × 10, Row 50 × 8, Face pull 15 × 10, Hyper-extension BW × 10, Curls 8 × 10) and Fri 26 Jun A
  (Back squat 50 × 8: Rep record +1 rep; Lunges 7 × 11, Lateral raises 3 × 11, Cable push-down 17.5 ×
  11: Rep records; DB bench 10 × 8, Push-ups BW × 11, Shoulder press 5 × 8: same). A lifts have 2
  sessions, B lifts 1. Every verdict reads `too new`: A lifts "2 more sessions", B lifts "3 more".
  Sessions: 3 of 3 this week (week of 22 Jun).

#### 1.3.10 Copy and number format

- kg throughout; `×` (U+00D7); `–` (U+2013) for ranges; `−` (U+2212) for minus and in `BW−19`;
  thousands with a comma (`4,185 kg`); human dates (`Wed 14 Oct`), never ISO.
- Verdict words, exactly: `Moving` · `Stalled` · `Slipping` · `Too new` · `Deload`. Each always with
  its glyph (▲ moving, ■ stalled, ▼ slipping, ○ too new; deload is a hatched or labelled band, no
  glyph) and never colour alone.
- Record kinds, exactly: `Heaviest weight` · `Rep record` · `Least assistance` · `First added load`
  · `Estimated 1RM`.
- Suggestions are phrased as suggestions: `Try 15 kg next`, `Consider a lighter week or a variation`.
  No control in stats edits the program.
- Sentence case. No exclamation marks, emoji, trophies, medals or confetti.

### 1.4 Quality bar

- **The 30-item checklist in `research/principles.md` §6 is pass/fail.** Every concept, every item.
  Where a concept's thesis makes an item hard (C2 and item 29, C4 and item 19), its section says how
  to pass it.
- **Carried from the last run (chrome):** ≥ 85 % of each frame's pixels from the neutral ramp; one
  accent, used for the primary action, the active state, focus and emphasis only; data colours only
  inside charts and ≤ 12 px tags/dots; ≤ 6 type sizes and ≤ 3 weights per frame; `tabular-nums` on
  numbers that align in columns, proportional figures on standalone heroes (dataviz anti-pattern);
  radii ≤ 12 on cards; zero decoration; tap targets ≥ 44 px (primary rows ≥ 56 px) with ≥ 8 px gaps;
  text ≥ 4.5:1, row values and verdicts ≥ 7:1.
- **Rejected looks, all four:** no dark + neon lime (or any yellow-green accent, any glow); no
  ivory/cream page with pastel fills ("Court"). Also from the frame: no dual axes, no rainbow, no
  pies, donuts, gauges, radar or rings.
- **Palettes:** every chart colour in your section was run through the dataviz validator (results
  quoted). If you add or change one, re-run it (4.4) and quote the output in `rationale.md`.
- **Every shipped stat keeps a visible home** (checklist item 26): per-lift chart, records, volume
  vs last time (`VolumeVsBaseline`), the muscle map (a body silhouette must exist somewhere), the
  session summary, the sessions list and calendar, the progression hint. Your section says where.

### 1.5 Inconsistencies found in the research, and how this brief settles them

1. `dataset.json → about` says the bench plateau is at **14 kg**; the data and the audit say **13
   kg**. 13 kg is right.
2. Two session notes sat on B days but name A exercises: `Left shoulder a bit tight on bench.` (Fri 2
   Oct, B) and `Gym crowded, did push-ups on the floor.` (Fri 3 Jul, B). They now sit on **Wed 30
   Sep** and **Wed 1 Jul** (both A).
3. The audit counts the bench plateau as "12 sessions (9 weeks)"; the data has 13 sessions at 13 kg
   including Fri 7 Aug. With the deload, the shared figure is **10 non-deload sessions without a
   record since Fri 7 Aug, 9.9 weeks**.
4. The audit's squat records table names "Most reps in a set 60 × 10"; `dataset.json → records`
   holds "Most reps at the heaviest weight 62.5 × 8". Both kinds are replaced by T4.
5. The audit's planned-sets column is rounded (11, 19, 13, 10, 8); the exact values are 10.5, 18.75,
   12.75, 9.75, 7.5. Rows show the rounded value (1.3.2), drill-downs the exact one.
6. The audit's weekly table gives Shoulders 23.5 for ABA weeks; some ABA weeks read 24.5 because a
   lateral-raise drop set adds a full set (T1). Use the per-week values in `brief-data.json`.
7. Median session duration moves from 68 to **67 min** (deload sessions are shorter); records from
   446 to **201** (T4).

---

## Part 2 — The four concepts

| | Slug | Thesis in one line |
|---|---|---|
| 1 | `verdict-feed` | Stats are findings written in words, ranked by what needs action; each opens its evidence. |
| 2 | `lift-ledger` | All 14 lifts on one screen as a table of sparklines; the table is the chart. |
| 3 | `training-week` | The week is the unit: are you doing the plan, and is it paying off, one week at a time. |
| 4 | `progression-ladder` | Stats live at the lift, inside training: each lift's double-progression ladder shows how close the next step is. |

---

### Concept 1 — Verdict Feed · slug `verdict-feed`

**Thesis.** Stats are a short list of findings written in words, ranked by what needs action. Every
finding opens the chart and the sessions behind it.

**Who it suits, and the trade-off.** A lifter who wants to be told what changed and what to do,
not to read charts. Fastest answer to "am I progressing, and what next" (0 taps). The trade-off: it
is only as good as its rules. One wrong finding destroys trust (market: Gravitus), so every card
must show its rule and its data one tap away. Browsing a healthy lift costs more taps than in C2.

**Craft reference.** The FT Visual Vocabulary and the NYT Upshot's annotated charts (the headline
states the finding, annotations name the periods); Whoop's Monthly Performance Assessment (labelled
periods). Market archetype §5.6 (insight cards).

**Headline stat.** A written verdict, then the attention list (T3):
> `11 of 14 lifts moving.` / `DB bench press has stalled for 10 weeks. Pull-down is slipping since
> your elbow note.`

**IA.** Three tabs: **Train · Progress · Program**. Progress is the feed. Three levels, each a pushed
page with a back chevron: feed → finding (evidence page) → session. Sessions (history) is a pushed
page from the feed's footer `All sessions ›`; the lift index is `All 14 lifts ›` (program order,
each row with its verdict word). The body map lives in the session summary and in the Muscles
finding's evidence page.

**Primary chart form: the annotated period chart.** One lift, real time axis, the top-set weight as
a step line with every session as a dot, and **labelled period bands** behind it: `Building`,
`Stalled 10 wk`, `Deload`, `Holiday`, `Sick week`. Bands are neutral washes with a text label; the
finding's period is the one band in the emphasis colour (claret at 12 % opacity, label in claret).
Reps at the top weight print under the dots of the current step only. For e1RM lifts, the e1RM is
a thin secondary line in the reference colour, labelled `e1RM (estimated)` once at its end.

**Interaction model: tap-to-reveal reasoning.** Each finding card has the sentence, a 48 px-tall
evidence sparkline, and `Why?`, which expands in place to the rule in words with the four sessions
that triggered it (`No record in your last 4 sessions: 13 × 9 · 13 × 9 · 13 × 9 · 13 × 9`). Tapping
the card pushes the evidence page: the period chart, range presets `1M · 3M · 1Y · All` (default
3M), scrub with a sticky readout, and the suggestion. Comparison is a **then-vs-now reference**: a
faint horizontal tick at the value 4 weeks ago, labelled (`4 weeks ago · 13 × 9`).

**Frames.**
- **S1 Progress feed.** Title `Progress`, the date line `Thu 15 Oct · week 17`. The verdict in the
  headline face (two sentences, as above). A 4-up word row: `▲ 11 moving · ■ 2 stalled · ▼ 1 slipping
  · ↑ 1 ready`. Then finding cards, ranked: (1) `DB bench press · Stalled` / `13 kg × 9 since Fri 7
  Aug — 10 sessions, no record.` / `Consider a lighter week or a variation, or add a rep before
  adding weight.`; (2) `Narrow-grip pull-down · Slipping` / `Below 47.5 kg × 10 for 2 sessions, after
  "Right elbow sore".` / `Hold 46.25 kg until the elbow settles.`; (3) `Seated biceps curls · Ready`
  / `36 of 36 reps at 14 kg.` / `Try 15 kg next Friday.`; (4) `Push-ups · Stalled` / `17 reps best
  since Mon 3 Aug.` / `One more rep, then add a set.` Only the cards, the verdict and the counts are
  above the fold.
- **S1b scrolled.** `This week` finding: `2 of 3 sessions · Workout B due Fri` with a 7-day strip.
  `Records` finding: `4 records yesterday, all weight steps` with the 4 names. `Muscles` finding:
  `You did the plan over the last 2 weeks. Calves, abs, hamstrings and glutes sit at or under 10
  sets a week by plan.` Then `11 lifts moving ›` as one collapsed row (expands to 11 rows, each name +
  `▲` + latest top set). Footer rows `All 14 lifts ›`, `All sessions ›`, `All records ›`.
- **S2 Back squat evidence.** Finding sentence `Back squat · Moving · up 10 kg on the bar since
  Wed 15 Jul.` Range 3M selected. The period chart with bands `Holiday` (10 Aug week), `No A session`
  (14 Sep week), `Deload` (21–25 Sep), line breaks at both missed weeks. Annotation on Wed 14 Oct:
  `62.5 × 8 · heavier, fewer reps — a step up`. e1RM line with `80.0 · Fri 9 Oct` best and `79.2`
  end label. Under the chart: `Next: 15 of 20 reps at 62.5 kg`; then the records (2 rows) and
  `Warm-ups (20 × 10 · 37.5 × 5) are not counted.`
- **S3 Assisted pull-ups.** Finding `Assisted pull-ups · Moving · 8 kg less assistance since Wed 24
  Jun.` Reversed axis, staircase step line, bands for each step labelled `BW−27` … `BW−19`, the
  deload band, `assistance · less is better`.
- **S3b Hyper-extension.** Finding `Hyper-extension · Moving · added 5 kg on Wed 7 Oct after 15
  sessions at BW × 15.` Two-band chart: a `Bodyweight only` period with reps per set, then a
  `BW+5` period, joined by an annotation, one history.
- **S4 Muscles evidence.** Sentence first (the honest finding of 1.3.7). Then a **Cleveland dot
  plot**: 12 rows, a hollow dot for planned and a filled dot for done (2-week average), the 10–20
  range as a muted wash, sorted by distance below the range. Window control `2 weeks · 4 weeks`
  (4 weeks says `includes a deload week`). Tapping a row opens its contributors.
- **S5 Records.** Title `Records`, a sentence `40 records in the last 3 weeks. None in the deload
  week.` Records grouped by session date (1.3.6), each row `Lift · kind · value · gain`; rows
  of a day collapse after 3 (`+2 more`). Below: `Back squat records` 2-row table.
- **S6 Summary.** A written recap paragraph in the headline face: `Workout A, 71 minutes. Four lifts
  moved up a weight: squat, lunges, shoulder press and push-down. Bench held at 13 × 9, its 10th
  session there. Push-ups fell to 15.` Then the lever table (1.3.8) with glyphs, the 4 records, the
  body map `Worked today`, and `Volume 4,185 kg · down 10 % on Fri 9 Oct, from heavier weights at
  fewer reps` as a quiet last line.
- **S7a.** `Findings start after your second workout. After the first, you will see your starting
  points.` One primary `Start Workout A`.
- **S7b.** `Your starting points` list: 7 rows `Back squat · 50 kg × 7 · baseline`, and `Workout B's
  lifts appear after Wednesday.`
- **S7c.** Verdict `Too early to call. Back squat went 50 × 7 → 50 × 8 (+1 rep).` Four first-delta
  findings, and `Verdicts need 4 sessions of a lift: A lifts 2 more, B lifts 3 more.`
- **S8a** 3M → 1Y on the squat evidence page. **S8b** scrub at Fri 9 Oct, sticky readout card above
  the chart. **S8c** the `4 weeks ago` reference tick on DB bench (`13 × 9 → 13 × 9 · no change`).
  **S8d** bench card → evidence → the Fri 7 Aug session page (its sets and 5 records).

**Visual stance: editorial broadsheet.** Pure white paper, black ink, one claret highlight.

| Role | Hex | Contrast |
|---|---|---|
| page | `#FFFFFF` | — |
| surface (cards) | `#F4F5F6` | — |
| hairline | `#E2E4E7` | — |
| muted text | `#5F6670` | 5.80:1 on page, 5.31 on surface |
| secondary text | `#3F454E` | 9.67:1 |
| ink | `#111317` | 18.59:1 |
| primary action (button fill) | ink `#111317`, white label | 18.59:1 |
| **emphasis (attention, the finding's band and line)** | **`#9E1F4E`** claret | 7.61:1 on page, 6.97 on surface |
| reference (e1RM line, then-vs-now tick) | `#2B5DA8` | 6.49:1 |
| context marks (other periods, grid labels) | `#8A9099` | 3.22:1 |

- Validator, light, surface `#FFFFFF`: `#9E1F4E,#2B5DA8` → all checks PASS (worst CVD ΔE 16.0
  protan, normal 23.8).
- Status: there is **no green**. Moving lifts are ink with `▲`; attention is claret with `■`/`▼` and
  the word. Red and green never carry meaning together.
- Type: headline sentences and the summary paragraph in a serif (`Georgia, "Sitka Text", Cambria,
  serif`, 22 / 28 px), at most 2 serif elements per frame and **never on numbers**. Everything else
  `"Segoe UI", system-ui, sans-serif` 400/600; hero numbers in the sans.
- Radius 8 on cards, 6 on chips. 20 px margins. Hairlines only, no shadows.

**Risk warning.** It sits nearest **the last run's Guided Session** (serif plus a coach voice) and
nearest the **insight-card trust** anti-pattern: a feed of claims with no visible data. And editorial
whites slide toward cream: the page is `#FFFFFF`, never ivory. Every card must carry an evidence
sparkline, not only words. Keep sentences under 20 words; no adjectives that judge the lifter.

**Checklist notes.** Item 19 is native. Item 22: the scrub lives on the evidence page (S8b). Item
29: the verdict and the first two cards must sit above y = 797.

**Homes of shipped stats.** Per-lift chart: evidence page. Records: `All records` + S5. Volume vs
last time: summary last line and the Session page. Muscle map: summary and Muscles evidence.
Sessions list and calendar: `All sessions`. Progression hint: the `Ready` finding.

---

### Concept 2 — Lift Ledger · slug `lift-ledger`

**Thesis.** All 14 lifts on one screen, as a table whose rows are sparklines on one shared time
axis. The table is the chart: every number is visible and comparable.

**Who it suits, and the trade-off.** A numbers person who wants to scan everything and judge for
themselves, the spreadsheet tracker's user. It answers "where am I progressing" for all lifts at
once, with no clicks. The trade-off: density. It is the concept nearest a dashboard; type and row
height must stay at gym size, so the 14th row sits below the fold.

**Craft reference.** Tufte's sparkline tables (*Beautiful Evidence*); the FT and Bloomberg markets
tables (sparkline + last + change columns); MacroFactor's exercise tiles; the spreadsheet tracker
(market §2.20).

**Headline stat.** The ledger itself, led by its totals row: `14 lifts · ▲ 11 · ■ 2 · ▼ 1`, then
one row per lift with the current top set and the change over the range **in the lift's own units**
(`+2.5 kg`, `+2 reps`, `−2 kg assist.`, `same`).

**IA.** Four tabs: **Ledger · Sessions · Train · Program**. The Ledger has a segmented control
`Lifts | Muscles | Records`: three tables of the same shape (rows × time). There are no chart pages:
tapping a row **expands it in place** to a full-width chart (accordion, one open at a time); tapping
a session dot in the expanded chart pushes the session. Sessions is the session list with a 6-week
calendar header and the summary on tap.

**Primary chart form: sparkline rows, small multiples on one shared time axis.** Every row's
sparkline spans the same dates and the same height; each has its own y-scale (min and max printed
small at the row's right edge, principle 9), the latest point marked, gaps broken (T2), deload
sessions as hollow dots. Rows for stalled and slipping lifts draw their line in the emphasis colour;
all other lines are ink-grey (emphasis, not categories).

Row anatomy (56 px minimum, 390 px wide): name (15 px/600) with verdict glyph and the next-step
count under it (`15/20 at 62.5`, 13 px) · sparkline (~120 × 32) · now (top set, 20 px tabular) ·
change (13 px, glyph + units).

**Interaction model: linked scrub across all rows.** Dragging on any sparkline moves **one hairline
through all 14 rows at once**; every row's "now" column switches to that date's value and the header
reads `On Fri 7 Aug`. Release keeps the selection (sticky) with a `Back to today` chip. One global
range control in the header (`1M · 3M · 1Y · All`, default 3M) scopes every row. A sort control
`Attention · Program · A/B` (default Attention: slipping, stalled, ready, then the rest). Compare is
**baseline switching**: the change column's baseline toggles between `range start` and `4 weeks
ago`, and the header says which.

**Frames.**
- **S1 Ledger → Lifts.** Header `Ledger`, range 3M, sort Attention. Totals row. Rows in order:
  Narrow-grip pull-down (▼, emphasis line), DB bench press (■), Push-ups (■), Seated biceps curls
  (▲, `36/36 · ready`), then Back squat, Deadlift, Machine row, … At least 10 rows above the fold.
- **S1b scrolled.** The last 4 lift rows, then a `Lifts · how to read` note in one line (`Line =
  top set at working weight · hollow = deload · gap = no session that week · warm-ups not counted`),
  then the `This week` row group: `Sessions 2 of 3 · B due Fri` and `Sets 47 of 69 planned`.
- **S2 Back squat, expanded.** The squat row open in place to a 390 × 300 chart: top-set weight step
  line with dots, a second small panel below on the same time axis for reps at the top weight (bars
  from zero), and the e1RM as a third thin panel labelled `e1RM (estimated)`. Never two units on one
  axis. Under it a mini table: the last 6 sessions (date · working sets · record), warm-ups listed
  apart in muted text. Rows above and below stay visible as context (one above, one below).
- **S3 Assisted pull-ups, expanded.** Same anatomy, reversed axis, `less is better`, staircase.
- **S3b Hyper-extension, expanded.** The top panel shows added load (0 → +5), the reps panel shows
  reps per set; one continuous x-axis with the switch annotated `+5 kg from Wed 7 Oct`.
- **S4 Ledger → Muscles.** A **heat table**: 12 muscle rows × 5 columns: four 2-week blocks
  (`17–30 Aug`, `31 Aug–13 Sep`, `14–27 Sep`, `28 Sep–11 Oct`) and `Plan`. Cells print the number
  (2-week average, whole sets) on an ordinal blue ramp keyed to **% of plan** (4 steps: < 50 %,
  50–80 %, 80–100 %, ≥ 100 %), with a swatch legend. The `14–27 Sep` block is marked `sick + deload`.
  A muted right column `10–20 typical` per row. Row tap expands: the muscle's contributing lifts.
- **S5 Ledger → Records.** A records table: rows = 14 lifts, columns `Best` (heaviest weight or least
  assistance, with date), `e1RM` (only the 5 lifts, else `—` with a footnote `not estimated above 10
  reps`), `Last record` (date + kind). Above it, a 3-week strip: `Records per session` as a small bar
  row (count per session, from zero; deload sessions show 0 with a hatch).
- **S6 Summary.** A table: Exercise · Today (top set) · Last A · Lever (glyph + word), a totals row
  (`24 sets · 4 records · 71 min · 4,185 kg`), then a compact 12-row muscle table for today, and the
  body map as a 120 px thumbnail at the end.
- **S7a.** The 14 lift names in program order with their prescription in the "now" column and one
  line `Each row fills in after its first session.` No sparkline cells, no zeros.
- **S7b.** The 7 A rows show a single baseline dot and `baseline 50 × 7`; B rows show `—` and `after
  Wednesday`. Totals row `7 baselines · verdicts after 4 sessions`.
- **S7c.** A rows: 2 dots joined, change `+1 rep` where true, `too new · 2 more`; B rows: 1 dot.
- **S8a** 3M → 1Y in the header: every row redraws over 1Y; the holiday gap lines up across all rows.
  **S8b** linked scrub at Fri 9 Oct (squat row's readout shows `45 × 10 · 55 × 10 · 60 × 10 · 60 ×
  10`; the other rows show their own Fri 9 Oct or Mon 12 Oct value, or `—` for B lifts on an A day).
  **S8c** baseline switch to `4 weeks ago`, change column re-computed. **S8d** bench row expanded,
  scrub to Fri 7 Aug, tap the dot → the session.

**Visual stance: Swiss ledger.** Near-white, hairline rules, no cards, tabular figures everywhere,
one orange emphasis, one ultramarine for selection.

| Role | Hex | Contrast |
|---|---|---|
| page | `#FBFBFC` | — |
| row surface (expanded row) | `#FFFFFF` | — |
| rule / grid | `#E4E5E9` | — |
| muted text | `#5E636B` | 5.85:1 |
| secondary text | `#3D4148` | 9.91:1 |
| ink | `#0F1012` | 18.41:1 |
| context lines (sparklines) | `#8A9099` | 3.11:1 |
| **emphasis (stalled and slipping rows' lines)** | **`#C4511A`** | 4.47:1 (marks; text in ink beside it) |
| **selection (hairline, active range, primary)** | **`#2156D9`** | 5.98:1 |
| heat ramp, % of plan | `#8EAAE0` · `#5C86D8` · `#2F62D2` · `#1B45A8` | light end 2.26:1; numbers in cells always printed (ink on the light two, white on the dark two) |

- Validator: `#2156D9,#C4511A` light → all PASS (worst CVD ΔE 29.1). Ramp `--ordinal` → all PASS
  (light end 2.26:1, hue spread 1°).
- Type: numerals `Consolas, "Cascadia Mono", monospace` (tabular by nature) for the now/change
  columns and axis ticks; labels `"Segoe UI", system-ui` 400/600. Sizes 12 · 13 · 15 · 20 · 28.
- Radius 4 on chips and the range control; no cards. 16 px margins. Rules, not boxes.

**Risk warning.** It sits nearest **the shipped Progress Dashboard** (generic analytics: tiles,
sparklines, a heat matrix) and the **overwhelming-dashboard** complaint (JuggernautAI, Fitbod).
Difference must come from the table discipline: no cards, no KPI tiles, one shared axis, aligned
columns. Never shrink rows under 56 px or values under 20 px to fit 14 rows (items 27–28); accept the
scroll and pass item 29 with the attention sort (the answer is in the top 4 rows).

**Checklist notes.** Item 19: the totals row is a written verdict (`11 of 14 moving · 2 stalled ·
1 slipping`), not just counts; put it above the first chart. Item 17 is native. Item 22: S8b.

**Homes of shipped stats.** Per-lift chart: expanded row. Records: Records segment. Volume vs last
time: the summary table and expanded row's mini table. Muscle map: summary thumbnail and the
Muscles row expansion. Sessions list and calendar: Sessions tab. Progression hint: the next-step
count in every row plus `ready`.

---

### Concept 3 — Training Week · slug `training-week`

**Thesis.** The week is the unit. Stats answer "am I doing the plan, and is it paying off?" one
calendar week at a time, this week first, with what is left to do.

**Who it suits, and the trade-off.** A lifter on a fixed weekly program for whom showing up and
doing the planned sets is most of the battle. Forward-looking: it says what this week still needs.
The trade-off: per-lift trends are one level deeper than in C1 or C2, and a week view is noisy on an
A/B split unless it compares matched weeks, which this concept must do everywhere.

**Craft reference.** Stephen Few's bullet graph specification; Strava's weekly Relative Effort with
a shaded "your normal" band; Hevy's Monthly Report order; Fitbod's weekly targets (`6 of 14`).

**Headline stat.** Adherence and plan-vs-done for this week, as a big figure: **`2 / 3`** sessions,
`Workout B due Fri`, with `47 of 69 planned sets` and the per-muscle pace beneath.

**IA.** Three tabs: **Week · Lifts · Program**. Week is a pager: this week by default; `‹` and `›`
(or a horizontal swipe) step through past weeks, and each past week is a **recap page in a fixed
order**: sessions → muscles vs plan → lifts (stepped up / held / slipped) → records. A `Block` button
zooms out to an 8-week calendar of week rows (one row per week: day dots, sessions, sets vs plan, a
deload or holiday label). Lifts is a plain list (program order, verdict word, top set) that pushes
the lift page. Sessions open from the week's day strip.

**Primary chart form: bullet graphs.** Few's spec: one linear scale from zero, a featured bar
(done), a comparative tick (plan), and up to 3 qualitative bands in one hue's intensities. Used for:
sessions vs 3; each muscle's sets vs plan; each lift's reps vs the next-step target. Lower-is-better
variant for assistance. A lift's own trend is a **week-binned strip**: x = calendar weeks (empty
weeks drawn as empty columns, labelled), each session a dot at its top-set weight within its week
column, the deload week's column shaded.

**Interaction model: week stepping with matched-week comparison.** `‹ ›` steps a week; the header
names its type (`ABA week`, `BAB week`, `Deload week`, `Holiday`). Compare is a toggle **`vs last
same week`**: every bullet gains a second comparative tick at the last week of the same parity
(this BA-so-far week vs the last BAB week, Mon 28 Sep), and the totals say `same parity`. Drill:
week → session → lift.

**Frames.**
- **S1 Week → this week.** Header `Week of 12 Oct · BAB week so far`. Hero `2 / 3` (proportional
  figures, ≥ 60 px) with `sessions · Workout B due Fri`. A 7-day strip (Mon ✓ B, Wed ✓ A, Fri ○ B).
  Then `Sets 47 of 69 planned` as one bullet. Then `Muscles this week`: 12 compact bullet rows
  (done so far vs this week's plan; the plan tick for a BAB week), each with the text `7 of 7`
  etc.; under-pace rows are amber with `·` remaining (`Lats 12.5 of 25 · Fri adds 12.5`).
  Above the fold: hero, strip, sets bullet, first 6 muscle rows.
- **S1b scrolled.** `Lifts this week`: four groups with counts (they total 14), `Stepped up 5`
  (Deadlift on Mon; Back squat, Lunges, Shoulder press, Push-down on Wed), `More reps 4` (Assisted
  pull-ups, Row, Face pull, Curls), `Held 3` (DB bench, Lateral raises, Hyper-extension), `Down 2`
  (Push-ups fewer reps, Pull-down ▼ slipping); then `Next up Fri` (B's 7 lifts with their next-step
  bullets: Deadlift 14 of 20 at 70 kg, … Curls `36 of 36 → try 15 kg`). Then `Records this week 9`.
  Then the `Block` entry row: `Last 8 weeks · 22 of 24 sessions`.
- **S2 Back squat (lift page).** Title, verdict line, the week-binned strip over 3M (13 week columns:
  the `Holiday` and `Sick` columns empty with labels, the `Deload` column shaded), the next-step
  bullet `15 of 20 reps at 62.5 kg`, a small `e1RM (estimated)` row of numbers per week (not a line),
  records, warm-ups note. Range control `1M · 3M · 1Y`.
- **S3 Assisted pull-ups.** Week-binned strip on a reversed axis (`less is better`), each week's
  assistance step labelled; next-step bullet in Few's lower-is-better form: `23 of 32 reps at BW−19`.
- **S3b Hyper-extension.** Week-binned strip with reps per set for bodyweight weeks and `BW+5` for
  the last two; a column label at Wed 7 Oct `+5 kg added`.
- **S4 Muscles.** Window `2 weeks · 4 weeks · this week`, default 2 weeks (`28 Sep – 11 Oct`). 12
  horizontal bullet rows sorted by deficit to the 10–20 range: featured bar = done, tick = plan, the
  10–20 range as the lightest band. All at plan → the copy says so: `On plan for 2 weeks. The plan
  gives Calves 8, Abs 3, Hamstrings and Glutes 10 a week, at or under the typical 10–20.` Tap a row
  → contributors. Body map: a small front/back index at the top, one hue, tap a region to jump to
  its row.
- **S5 Records.** Records **by week**: `‹ Week of 12 Oct ›`, 9 records listed by session; a row per
  past week above it as a 3-week mini history (`5 Oct week · 15`, `28 Sep week · 16`, `21 Sep week ·
  0 · Deload`). Back squat records reached from the lift page.
- **S6 Summary.** `What Wed did for your week`: the week bullets updated (sessions 2/3, sets 47/69,
  muscles moved by today's work), today's 4 records, the lever table, `Next: Workout B, Fri 16 Oct`.
- **S7a.** `Week 1 starts with your first workout.` The plan shown as targets in words (`3 sessions ·
  69 sets · 14 lifts`), no empty bars. One primary.
- **S7b.** Week of 22 Jun: `1 / 3`, 24 of 69 sets, muscle bullets partly filled (A's muscles only),
  lifts `7 baselines`.
- **S7c.** Week of 22 Jun complete: `3 / 3` and the recap page; lifts `too new · A 2 more · B 3 more`.
- **S8a** Range change = `Block`: from this week to the 8-week calendar (holiday and sick weeks
  visible as rows). **S8b** drag along the squat strip, snapped to Fri 9 Oct, readout card.
  **S8c** `vs last same week` toggled on S1 (ticks for Mon 28 Sep's BAB week). **S8d** bench (from
  `Held` on S1b) → bench lift page → Fri 7 Aug session.

**Visual stance: dark instrument.** Graphite, not black; one cool azure for data and action; amber
only for "under plan". Calm, low-glare, for a dim gym.

| Role | Hex | Contrast |
|---|---|---|
| bg | `#121417` | — |
| surface-1 | `#1A1D21` | — |
| surface-2 | `#23272C` | — |
| hairline | `#2E3338` | — |
| muted text | `#9AA1AA` | 7.07:1 on bg, 6.49 on surface-1 |
| secondary text | `#B4BAC2` | 9.44:1 |
| text | `#E6E8EB` | 15.03:1 |
| **accent (primary, active, selection)** | **`#7DB7E8`**, dark label `#0E1A26` | 8.62:1 on bg; label 8.21:1 |
| data: done / on plan | `#3F95D6` | 5.69:1 |
| data: under plan | `#BC7F25` | 5.45:1 |
| bullet bands (one hue) | `#3E5B78` · `#4F80AE` · `#6DA6DA` · `#A3CEF3` | light end 2.39:1 on surface-1 |
| context marks | `#5B636D` | 3.03:1 |

- Validator, dark, surface `#1A1D21`: `#3F95D6,#BC7F25` → all PASS (L inside 0.48–0.67, worst CVD ΔE
  23.4). Bands `--ordinal --mode dark` → all PASS.
- Type: `Bahnschrift, "Segoe UI", system-ui` at normal width, 400/600. Hero `2 / 3` 72 px.
  Sizes 12 · 13 · 15 · 20 · 28 · 72.
- Radius 8 on cards, 4 on chips. Elevation by lighter surfaces, no shadows, no glow.

**Risk warning.** It sits nearest **the rejected dark + neon lime**. No yellow-green anywhere, no
glow, no pure black, no saturated accent on large areas; the accent is a light, low-chroma azure.
Also the dark-readability complaint (JuggernautAI "blue on black"): all values and verdict words
≥ 7:1. And the week view must not reintroduce the audit's partial-week trap: this week is always
shown as "so far" with the remaining plan, never compared with a full week.

**Checklist notes.** Item 1: the headline is adherence (a §2 headline stat). Item 19: the hero
carries a sentence (`2 of 3 sessions this week. On plan for the last 2 weeks.`) above the strip.
Item 6 is native (2-week default). Item 21: one range control per view (the week pager on Week,
presets on the lift page).

**Homes of shipped stats.** Per-lift chart: lift page. Records: S5 and the lift page. Volume vs last
time: the summary and the session page. Muscle map: S4 index and the summary. Sessions list and
calendar: the week strip and `Block`. Progression hint: `Next up` bullets.

---

### Concept 4 — Progression Ladder · slug `progression-ladder`

**Thesis.** Stats live at the lift, inside training, not in a separate place. Each lift's
double-progression ladder shows where it stands on its current step and how close the next one is;
the post-workout summary is the main stats moment.

**Who it suits, and the trade-off.** A lifter who thinks in "add reps, then add weight", and who
looks at stats around a workout, not on a rest day. It is the only concept whose primary chart
encodes the program's own rule (0006), so a heavier day with fewer reps can never look like a loss.
The trade-off: there is no single "stats home". "Am I progressing overall?" is answered by the
Program list's ladder column, which is less immediate than C1's sentence.

**Craft reference.** Swiss Timing and sports-results boards (big condensed numerals, ranks and
deltas in columns); Nike Run Club's and Strava's activity stats typography; StrongLifts' program-
scoped graph list (market §2.6).

**Headline stat.** Working-weight progress: **steps climbed**. `12 of 14 lifts stepped up since 18
Sep` on the Program tab, and on Train, the due workout's ladder: `Fri · Workout B · 1 lift ready to
step up`.

**IA.** Three tabs: **Train · Program · History**. No Stats tab.
- **Train** shows the due workout card with each lift's next-step bar (`Deadlift · 14 of 20 at 70 kg`).
- **Program** is the stats index: the A/B lists, each exercise row carrying a mini ladder and its
  verdict glyph; a header `Climbed` summary; a `Muscles` segment (`Lifts | Muscles`) with the body map
  as the index.
- **History** is the sessions list; every session opens its summary.
- The **lift dossier** (full screen, pushed from any lift row, from a summary row, or from the live
  set screen's `Lift history`) holds the ladder, the records table and the lift's sessions.

**Primary chart form: the progression ladder.** Two stacked panels on one real time axis (never
two units on one axis):
- **Top panel, weight:** the working weight as a **step line** (each step a horizontal tread from its
  first to its last session), session dots on the tread, step labels at the tread start (`55`,
  `57.5`, `60`, `62.5`). Assisted: reversed (`BW−27` low, `BW−19` high, `less is better`).
- **Bottom panel, reps:** for each session, the reps done at that weight as a bar **from zero**, with
  the next-step target (sets × top of range) as a horizontal tick per tread. Reps climb along a
  tread, reset when the weight steps: the sawtooth that e1RM turns into fake dips becomes the
  program's visible rhythm.
- Gaps break both panels (T2); deload sessions are hollow dots and hatched bars, labelled once.
- e1RM is not on the ladder. For the 5 e1RM lifts it is one line of text under it: `e1RM 79.2
  (estimated) · best 80.0 Fri 9 Oct`.

**Interaction model: direct manipulation on the ladder.** Drag anywhere on the ladder: a hairline
snaps to the nearest session, the readout docks at the bottom of the screen (in thumb reach) with
the session's sets, and stays after release. Compare is a **two-handle span**: a long-press drops a
second hairline; the readout shows the change between them per lever (`+12.5 kg on the bar · same
reps · 8 sessions`). Range presets `Step · 3M · 1Y · All` (default `Step` = the current tread plus
the previous two).

**Frames.**
- **S1 Program → Lifts.** Header `Program · A/B Split`, the line `Climbed 12 of 14 lifts since 18 Sep
  · bench and push-ups have not`. Workout A and B lists; each 64 px row: name, verdict glyph, a mini
  ladder (last 3 treads, 96 × 32), `62.5 kg · 15/20`. Bench and push-ups show `■ Stalled 10 wk`,
  pull-down `▼`. Above the fold: the summary line and all of Workout A plus the first rows of B.
- **S1b Train.** The due workout card: `Fri · Workout B · due tomorrow`, 7 rows with next-step bars
  (bullet: reps done at the current weight vs target): Deadlift `14 of 20 at 70 kg`, Assisted
  `23 of 32 at BW−19`, Pull-down `25 of 36 at 46.25 kg · ▼ slipping · elbow note`, Row `35 of 40`,
  Face pull `38 of 45`, Hyper-extension `33 of 45 at BW+5`, Curls `36 of 36 → try 15 kg`.
  Primary `Start Workout B`. This frame is the concept's answer to "what next".
- **S2 Back squat dossier.** Big current value `62.5 kg × 8` (condensed numerals, ≥ 60 px), the
  ladder over `Step` range (treads 57.5, 60, 62.5, with the deload treads hatched and labelled),
  e1RM text line, `Next: 15 of 20 reps at 62.5 kg`, records table, warm-ups line `20 × 10 · 37.5 × 5
  · not counted`.
- **S3 Assisted pull-ups dossier.** The ladder reversed: five treads BW−27 → BW−19 climbing; reps
  bars 5 → 8 per tread with target 32 (4 × 8) as the tick.
- **S3b Hyper-extension dossier.** One tread at `BW` from Mon 13 Jul to Fri 2 Oct (reps bars at 45 of 45, the
  target met: the moment the rule says add load), then the `BW+5` tread with bars at 33. Caption
  `Added 5 kg on Wed 7 Oct after reaching 45 of 45`.
- **S4 Program → Muscles.** The front/back body map as an **index** (one hue, % of plan over 2
  weeks, swatch legend, labels on the map for the 4 under-10 muscles). Below it, the selected muscle
  (`Hamstrings`, preselected as the largest gap to the 10–20 range): a stacked horizontal bar of its
  2-week sets by contributing lift (`Back squat 3 · Lunges 2.25 · Deadlift 2.25 · Hyper-extension 2.25`;
  derive and list in rationale), with the plan tick and the 10–20 band. Tap another region to switch.
- **S5 Records (dossier → Records).** Back squat's **rep-records table**: one row per weight lifted
  (`62.5 kg · 8 reps · Wed 14 Oct`, `60 kg · 10 · Fri 9 Oct`, `57.5 kg · 10 · Mon 7 Sep`, …), the
  current weight highlighted. Above it, `Recent records` for all lifts (the 3 weeks of 1.3.6),
  grouped by session, opened from History's `Records` filter.
- **S6 Summary (the stats moment).** `Workout A · Wed 14 Oct` and a 7-row ladder list: each row shows
  the lift's last 2 treads with today's session highlighted and the move in words (`Stepped up to
  62.5 kg`, `Held 13 kg · 33 of 40`, `Fewer reps · 44 of 45`). Records 4. Body map `Worked today`.
  `Next time: Back squat 15 of 20 at 62.5 kg`.
- **S7a.** Program list with each lift's empty ladder replaced by its start: `Starts at 50 kg · 4 ×
  8–10`. Line `Ladders grow from your first session.`
- **S7b.** Workout A rows each with one dot and `baseline 50 × 7 · 13 of 20 to the next step`
  (rows show 0006's count from session 1). B rows `not yet`.
- **S7c.** A rows: 2 dots on one tread, bars rising; B rows: 1 dot. Verdicts `too new`.
- **S8a** `Step → 1Y` on the squat ladder: all treads from 50 kg, the holiday and sick breaks.
  **S8b** drag snapped to Fri 9 Oct, docked readout `Fri 9 Oct · 45 × 10 · 55 × 10 · 60 × 10 · 60 ×
  10 · 20 of 20 at 60 kg · ready`. **S8c** two-handle span Fri 7 Aug → Wed 14 Oct on squat: `+7.5 kg on the
  bar`. **S8d** S1's bench row → bench dossier (`Stalled` banner, one long tread at 13 kg with bars
  at 30–33 of 40, the target never met) → tap the tread's first dot → Fri 7 Aug session.

**Visual stance: sports results board.** White, black, cobalt. Big condensed numerals, ranks and
deltas in columns, hard rules, no tints behind data.

| Role | Hex | Contrast |
|---|---|---|
| page | `#FFFFFF` | — |
| surface (rows, sheets) | `#F2F3F5` | — |
| rule | `#DADDE1` | — |
| muted text | `#5A5F66` | 6.43:1 |
| secondary text | `#3A3E44` | 10.76:1 |
| ink | `#0B0B0C` | 19.67:1 |
| **accent (primary, current tread, selection)** | **`#1F3FB8`** cobalt, white label | 8.53:1 |
| reps bars, past treads | `#8C9199` | 3.17:1 |
| below-last-time glyph and word (status, never alone) | `#C73A1E` | 5.18:1 |

- Validator, light, surface `#F2F3F5`: `#1F3FB8,#C73A1E` → all PASS (worst CVD ΔE 25.8, normal 35.8).
- Type: `"Bahnschrift Condensed", "Bahnschrift SemiCondensed", Bahnschrift, "Arial Narrow",
  sans-serif` 600 for numerals and titles (check the condensed face rendered); `"Segoe UI",
  system-ui` 400/600 for text. Sizes 12 · 13 · 16 · 20 · 32 · 64.
- Radius 4 everywhere except the primary button (8). Rules, not cards. 16 px margins.

**Risk warning.** It sits nearest the **"thick saturated blocks read loud, even childish"**
anti-pattern and a sporty look's pull toward neon. Cobalt only on the primary, the current tread and
the selection; no colour blocks, no stripes, no number-on-every-point. Bahnschrift at big sizes is
loud enough. Cobalt is bluer than the shipped indigo `#4338A8`: keep it that way.

**Checklist notes.** Item 19 (verdict before the first chart): S1's first line is the written
verdict. Item 20: Program row → dossier → session = 2 taps. Item 13: reps bars from zero; the
weight panel is a non-zero line axis with labelled min and max treads. Item 26: "History | Stats
access" is the History tab plus dossiers.

**Homes of shipped stats.** Per-lift chart: dossier. Records: dossier + History `Records` filter.
Volume vs last time: the summary and the session page. Muscle map: Program → Muscles (index) and
the summary. Sessions list and calendar: History. Progression hint: the Train card's next-step bars.

---

## Part 3 — Divergence per frame

Same data in every column; different answers in every row. If a frame of yours could be swapped
into another column of its row unnoticed, it fails review.

| Frame | 1 Verdict Feed | 2 Lift Ledger | 3 Training Week | 4 Progression Ladder |
|---|---|---|---|---|
| **S1** home | Verdict sentence + ranked finding cards (stall, slip, ready) | Totals row + 14 sparkline rows on one time axis, attention-sorted | Hero `2 / 3` sessions, day strip, sets and muscle bullets for this week | Program list with a mini ladder per lift + `Climbed 12 of 14` |
| **S1b** below the fold | Week, records and muscles as findings; moving lifts collapsed | Last rows + `how to read` legend + this-week group | Lifts stepped / held / next-up bullets; block entry | Train: due workout's next-step bars |
| **S2** Back squat | Annotated period chart (labelled bands), e1RM as thin reference line | Row expanded in place: 3 stacked panels (weight, reps, e1RM) + mini table | Week-binned strip (empty week columns) + next-step bullet + e1RM numbers per week | Ladder: weight treads over reps bars to target |
| **S3** assisted | Bands per assistance step, reversed | Expanded row, reversed panels | Week-binned strip reversed + lower-is-better bullet | Reversed ladder, 5 treads |
| **S3b** hyper-ext | Two labelled periods joined by annotation | Load panel 0 → +5 over reps panel | Week columns with a `+5 kg added` column label | Tread met (45 of 45), then a new tread |
| **S4** muscles | Sentence + Cleveland dot plot (plan vs done), range as wash | Heat table: muscles × 2-week blocks, ramp = % of plan | Bullet graphs sorted by deficit, window toggle, body map as small index | Body map as index + stacked bar of one muscle's contributors |
| **S5** records | Sentence + records grouped by date | Records table (lift × best / e1RM / last), records-per-session bar row | Records by week, week pager | Rep-records table (best reps at each weight) + recent list |
| **S6** summary | Written recap paragraph + lever table | Summary table with totals row + muscle table | What the session did for the week's bullets | 7 mini ladders, today's move in words |
| **S7** sparse | Starting points, then first deltas as findings | Rows that fill one by one; baselines in cells | Week 1 as a week | Ladders start from one dot with 0006's count |
| **S8a** range | 3M → 1Y presets on an evidence page | One global range redraws all rows | Week → 8-week block zoom | Step → 1Y on the ladder |
| **S8b** scrub | Sticky readout card on one chart | One hairline through all 14 rows at once | Drag along the week strip | Readout docked at the bottom, thumb reach |
| **S8c** compare | `4 weeks ago` reference tick | Change column baseline switch | `vs last same week` parity ticks | Two-handle span with per-lever delta |
| **S8d** drill | Card → evidence → session | Row expand → scrub → dot → session | Held group → lift page → session | Program row → dossier → tread's first dot → session |
| **Headline stat** | Stall/slip list in words | Change per lift in its own units | Adherence and plan vs done | Steps climbed, next-step count |
| **IA** | Progress feed, pushed evidence pages | One Ledger with 3 table segments, accordion | Week pager with recaps; block zoom | No stats tab: Program, Train, dossiers, summary |
| **Look** | Editorial white, serif headlines, claret | Swiss ledger, monospace numerals, orange + ultramarine | Dark graphite instrument, azure + amber | Results board, condensed numerals, cobalt |

---

## Part 4 — Designer instructions (common to all)

### 4.1 Deliverables, in `mocks/<slug>/`

1. **`index.html`**, one self-contained file: inline `<style>`, `<script>` and SVG only. **No
   network at all**: no web fonts, no CDNs, no images. Use the system font stacks given in your
   section and check in the render that the named face actually drew (Bahnschrift, Consolas,
   Georgia and Segoe UI are on the render host). Every colour, size and radius in `:root` custom
   properties named by role, and only those used. Charts are hand-drawn SVG.
2. **`board.png`**, rendered with `render.sh` (4.4), the final clean render.
3. **`rationale.md`**, at most two pages:
   - the thesis and 5–8 key decisions, each with its reason;
   - **tap counts for the 4 core questions**, from app open on the concept's default tab, as a
     table (Question · Taps · Sequence · Frame):
     1. "Am I progressing?"
     2. "How's my bench?" (DB bench press)
     3. "Which muscles am I under-training?"
     4. "What did today's workout achieve?" (Wed 14 Oct, the latest session)
   - honest weaknesses: at least three, specific (which question this concept answers worst, which
     frame is weakest, what a skeptic would say);
   - the **30-item self-check** against `research/principles.md` §6: item · pass/fail · evidence
     (frame and what in it);
   - the must-fix truths T1–T7: where each is visible;
   - "Derived numbers": anything not in `brief-data.json`, with how you computed it;
   - palette validator output (pasted) and any shade you added, with its contrast;
   - the render log (4.4).

### 4.2 The board

As 1.2. The row-3 panel holds the tap-count table and the 30-item self-check.

### 4.3 Interactivity (frame P, and the same frames navigable)

P starts on S1 and works with mouse clicks and drags:
1. The concept's navigation (tabs, pager, feed, accordion) reaches S1, S1b, S2, S3, S3b, S4, S5, S6
   and back. Back affordances work.
2. The range control works on Back squat (redraws with the right points per range: 1.3.5).
3. Scrub works: pointer drag on the squat chart snaps a hairline to the nearest session and shows
   that session's working sets from `brief-data.json`; release keeps it.
4. The concept's compare mechanism toggles.
5. Drill-down S8d works end to end.
6. A small board-level control **outside the phone** (board annotation style) switches the data state
   `Full · 3 sessions · 1 session · Fresh`, so S7a–c are reachable in P.

Embed the subset of `brief-data.json` you need as a JS constant (no fetch). Plain JS, small.
Respect `prefers-reduced-motion`; motion 150–250 ms ease-out, only to explain a change.

### 4.4 Render, look, fix (mandatory, at least two rounds)

From the repository root:

```bash
bash docs/design/stats-2026-10/render.sh \
  docs/design/stats-2026-10/mocks/<slug>/index.html \
  docs/design/stats-2026-10/mocks/<slug>/board.png 2760 3240
```

Crop the frames into a temp folder **outside the repo** and view every crop with the Read tool.
Write the crop script to a file with the Write tool (no shell heredocs; they hung last run), then run
it with `python` (not `python3`):

```python
from PIL import Image; import os, sys, tempfile
slug = sys.argv[1]
src = f'docs/design/stats-2026-10/mocks/{slug}/board.png'
out = os.path.join(tempfile.gettempdir(), f'{slug}-frames'); os.makedirs(out, exist_ok=True)
xs = [48, 494, 940, 1386, 1832, 2278]; ys = [400, 1356, 2312]
names = [['P','S1','S1b','S2','S3','S3b'], ['S4','S5','S6','S7a','S7b','S7c'], ['S8a','S8b','S8c','S8d']]
im = Image.open(src)
for r, row in enumerate(names):
    for c, n in enumerate(row):
        im.crop((xs[c], ys[r], xs[c]+390, ys[r]+844)).save(os.path.join(out, n + '.png'))
im.crop((0, 0, 2760, 352)).save(os.path.join(out, 'header.png'))
im.crop((1832, 2312, 2668, 3156)).save(os.path.join(out, 'panel.png'))
print(out)
```

Each round, look for and fix: clipping and overflow; label collisions in charts; a fallback font;
misaligned numbers; text under 4.5:1 (values under 7:1); tap targets under 44 px; a gap drawn as
continuous; a number that differs from `brief-data.json`; anything decorative; a frame that looks
like another concept's row in Part 3. **Log each round in `rationale.md`** (round · what you saw ·
what you changed). At least two rounds; the final `board.png` is the clean one.

**Palettes:** run the validator for your data colours (and again for any change):

```bash
node "<dataviz>/scripts/validate_palette.js" "<hex,hex>" --mode light --surface "<page hex>"
node "<dataviz>/scripts/validate_palette.js" "<ramp hexes>" --ordinal --mode light --surface "<hex>"
```

`<dataviz>` is the skill path in `frame.md`. Use `--mode dark` for Concept 3.

### 4.5 Don'ts

- No numbers, names, dates or notes other than `brief-data.json`'s and this brief's.
- No tonnage on any landing frame; no e1RM for the 9 non-e1RM lifts; no negative kilograms; no
  "PR count" that disagrees with T4.
- No dual axes, pies, donuts, gauges, rings, radar, 3D, rainbow ramps, gradients, emoji,
  illustrations, trophies, medals, confetti, exclamation marks.
- No browser-default controls (`<select>`, radios, checkboxes, date inputs). Draw them.
- No second accent beyond your section's. Data colours stay inside data.
- The body-map silhouette (where your section asks for one) is an anatomical front/back outline
  from simple paths, about 120 px tall per view, regions filled from your ramp, outline in a neutral.
- Do not look at the other concepts' folders. Divergence is the point.

---

## Part 5 — Where I departed from the research, and why

1. **e1RM cut-off at 10 reps, not 12.** The market cites StrongLifts' "NA above 12"; the principles
   cite equation drift above 10. I took 10 and restricted e1RM to the 5 lifts programmed at ≤ 10
   reps, so 9 lifts show no e1RM at all. Simpler to explain, and it removes the noisiest numbers.
2. **One record per lift per session, with a strict priority.** The principles let "rep PR at
   working weight" and "heaviest set" lead and keep e1RM PRs labelled; the market suggests a typed
   feed of every kind. Counting several kinds per set is what produced 11 PRs on Wed 14 Oct. One per
   lift (others listed as "also") gives 4, which a lifter can believe. Volume records are dropped.
3. **Stall is defined by records, and "slipping" is new.** The principles' stall rule (no
   improvement in weight, reps or e1RM over 4 exposures) is restated as "no record (T4) in the last
   4 non-deload sessions" so the same definition drives records and verdicts. The research had no
   regression state; the seed did not need one. With a realistic seed it does.
4. **The seed was changed.** The research treats `dataset.json` as given. I added a deload week and
   a regression and moved two notes, because the process memo shows an optimistic seed under-tests
   exactly the states stats must handle.
5. **Gap rule: a missed calendar week, not "longer than ~14 days".** For a lift trained 1.5 times a
   week, the holiday is a 12-day gap; the 14-day rule would have drawn it as continuous.
6. **Muscle groups are sums of fractional sets, not "first primary muscle only".** The app's
   Program tab uses primary-only families (Push 29 · Pull 21 · Legs 10 · Core 9); everywhere else it
   uses fractional muscles. T7 picks one rule. Consequence: the audit's "push-heavy split" largely
   disappears; the remaining finding is that the plan gives calves, abs, hamstrings and glutes few
   sets. The brief presents that as plan-level context, not an alarm.
7. **Scrub with a sticky readout, against decision 0006's "no pointer tooltips".** The principles
   (§5, item 22) require it and the market shows no product without it. The readout never holds
   information the table view lacks, which is 0006's concern.
8. **The body map is optional as a measure.** The market calls it a garnish and the principles an
   index. It must still exist in every concept (item 26), but only Concept 4 navigates by it.
9. **No universal monthly recap.** The market recommends Hevy's monthly report; only Concept 3
   adopts a recap (weekly). Making all four do it would reintroduce convergence.
10. **Default ranges differ by concept.** The principles' 3M default holds for C1 and C2; C3 defaults
    to the current week and C4 to the current step plus two, because their theses are about now.
11. **No web fonts.** The last run linked Google Fonts. This deliverable must work with no network,
    so each concept uses system faces present on the render host.
12. **Frame list.** S1b, S3b and the split S7/S8 frames were added (1.1), against the suggested
    8-frame list, so that below-the-fold content, the bodyweight switch, each sparse state and each
    interaction are reviewable on their own.
