# Stats audit: what the app computes, shows and stores (2026-10-15)

Internal auditor's report for the stats research run (`../frame.md`). It covers `main` at `73b60a4`
(Progress Dashboard redesign, #23). File references are `path:line`-free unless a line matters.

---

## 1. Method

**Rendered: yes.** Every stats-bearing screen was rendered in headless Chrome 155 at 390 × 844,
DPR 2, with mobile and touch emulation, against `npx vite --port 5180` (stopped afterwards). No
Chrome extension was used.

- **Driver.** There is no puppeteer or playwright here, so a small CDP driver was written on the
  repo's own `ws` package: launch, navigate, click by text, screenshot, and a layout probe. The
  probe records text under 12 px, horizontal overflow, interactive boxes under 44 px and clipped
  text. The scripts live outside the repo (`%TEMP%/stats-audit/`). Nothing under `src/` was
  touched.
- **Data.** A Python generator produced 45 sessions over 17 calendar weeks (22 Jun to 14 Oct
  2026, "today" is Thu 15 Oct). It wrote them straight into the app's IndexedDB
  (`workout-tracker`, the `sessions` and `settings` stores), then reloaded the page. The seed has
  the same shape as a backup's `sessions`, plus the settings `activeProgramId`, `effortTracking`
  and `exerciseNotes`. The app-format seed is `audit-shots/seed-app-format.json`; the
  designer-facing copy is `dataset.json`.
- **Data states rendered.** Five states, run in parallel profiles:
  - full history (45 sessions);
  - 2 sessions (Mon 12 B, Wed 14 A);
  - 1 session;
  - a program but 0 sessions;
  - a fresh install with no program.
- **Cross-check.** The generator re-implements the app's maths: Epley best set per session,
  warm-ups out, 1 per primary muscle plus 0.5 per secondary, and `recordsFor` and the summary's
  rule for "changed". Its numbers match what the app drew: squat 79.2 kg, deadlift 86.3 kg,
  lunges 17.3 kg, Wed 14 Oct = 11 PRs and 4,185 kg. So the shared content in §6 is what the app
  would show.
- **Read from code only:**
  - `ExerciseHistoryOverlay`;
  - the PR toast;
  - `VolumeVsBaseline` in the exercise list;
  - the Program editor's family impact;
  - the orphaned `Stats.tsx` / `HistoryStatsSwitch` / `HistoryList` / `ProgressionBar` (see the
    end of §2).
- **Not captured.** Two scroll attempts on the summary overlay failed, because the overlay's
  scroller is not `.session-summary-body`. The "Worked today" and exercise-table parts are
  therefore shown in the 1-session summary (`32-one-summary.png`), which fits on one screen.

Screenshots: `docs/design/stats-2026-10/research/audit-shots/`. Probe output is in `audit-shots/probes/`.

---

## 2. Stat inventory (as built)

"Working set" in the app means every set that is not a warm-up: drop, failure and AMRAP sets count
in full (`setKind.ts`). Loaded volume is `Σ reps × weightKg`. Bodyweight and assisted sets never
enter kg volume; they appear only as "bodyweight reps". e1RM is Epley `w × (1 + r/30)`, the best
set per session.

### Dashboard tab (`features/dashboard`, `domain/dashboard.ts`)

| # | Stat | Formula / sets counted | Exercise kinds | Shown as | Interaction | Empty / sparse |
|---|---|---|---|---|---|---|
| D1 | **Sessions this week** `2/3 vs 3` | Sessions by `startedAt` from Monday 00:00 to now, over `program.sessionsPerWeek`; "vs" is last *full* calendar week | all | KPI tile | none | `0/3 vs 0` |
| D2 | **Sets this week** `47 vs 69` | Working sets of the week's sessions | all | KPI tile | none | `0 vs 0` |
| D3 | **Volume this week** `11,459 vs 16,133` | Loaded kg only | loaded only | KPI tile | none | `0 vs 0` |
| D4 | **Muscle week** (12 muscles, `done · of planned`) | Done = this calendar week's sets by `loggedAt`, 1 per primary and 0.5 per secondary muscle, rounded to whole sets. Planned = `prescribedWeekly`: plan sets × `sessionsPerWeek / workouts`, same split | all (library muscles) | 2-column list, each count in a heat chip; absolute bands 0 / 1–9 / 10–20 / 21+; legend; "No direct X work" when planned = 0 | none (not tappable) | 24 zero chips (`30-zero-dashboard.png`) |
| D5 | **Lifts** sparklines | Up to 3 **loaded** lifts in interleaved program order (A1, B1, A2…), best e1RM per session over the **last 21 days**; latest value; delta = latest − first in the window | loaded only (bodyweight and assisted are skipped) | 64 × 24 px sparkline, min–max normalised, end dot; value; signed delta | none | "Your lifts show here after your first workout."; one point gives a lone dot and `—` |
| D6 | **Progression hint** `Seated biceps curls — try 15 kg` | The first loaded lift (same order as D5) whose last session hit the top of the range at the top weight → `+ weightStep` | loaded only | one line with an ↑ icon | none | hidden |
| D7 | **Due workout** `Workout B due · last Mon 12 Oct · 7 exercises · 23 sets · ~53 min` | Next in rotation after the newest session; minutes = sets × 40 s + rests | — | dock | Change cycles through the workouts | "Workout A due" with no date |

### Sessions tab (`features/sessions`, `domain/sessionsView.ts`)

| # | Stat | Formula / sets counted | Exercise kinds | Shown as | Interaction | Empty / sparse |
|---|---|---|---|---|---|---|
| S1 | **Calendar, 6 weeks** + count `15 sessions` | A day is trained if any session started on it | — | 7 × 6 grid of 20 px squares; today ringed | none (title tooltip) | Whole tab replaced by "No finished workouts yet. Finish one and it appears here." |
| S2 | **Muscle sets by week** (4 weeks × regions) | Sessions by `startedAt` week; `muscleSets` folded into **body regions**: "Lats" = `upper-back` = lats + middle back; "Shoulders" = the front-deltoids region. Extra rows (traps, forearms…) appear when any count > 0 | all | 2 half-tables of heat chips, week band, whole numbers | none | Zero columns are drawn as tinted "0" chips |
| S3 | **Volume per session, kg** | The last 12 sessions' loaded kg; series A = the program's first workout, B = any other | loaded only | Bar chart, 2 y-ticks, spaced x dates, last bar labelled; A dark (#45454F) vs B grey (#8A8A97) | bar `<title>` only | One bar |
| S4 | **Session rows** `71 min · 24 sets · 4,185 kg · 11 PR` | Minutes = finished − started; working sets; loaded kg; PR = number of **records** changed (`recordCount`) | — | List grouped by week (This week / Last week / Week of …) | tap → summary | — |

### Session summary (`ui/SessionSummary.tsx`, `domain/summary.ts`); opened on Finish and from S4

| # | Stat | Formula / sets counted | Exercise kinds | Shown as | Interaction | Empty / sparse |
|---|---|---|---|---|---|---|
| SS1 | **KPI strip** | Duration; volume kg and `±% vs last A` (the last finished session of the *same workout*); `· N bodyweight reps`; working sets; PRs (records count) | kg loaded only | 4-column card | none | `%` is hidden with no earlier same-workout session; PRs 0 on an exercise's first session |
| SS2 | **Records** | Each record kind whose value or weight changed against all earlier sessions, with the gain (`+2.5 kg`, `+2 reps`) and a RecordSpark: that record kind's per-session value, last 6 | all | list of PR tag + label + text + sparkline | none | section hidden |
| SS3 | **Worked today** | `muscleSets` (warm-ups out) folded into regions | all | 2-column region rows with heat chips; session bands 0 / 1–2 / 3–5 / 6+ | row → RegionPanel (contributors per exercise, "Browse exercises") | Zero rows still listed |
| SS4 | **Exercise table** | Best set (heaviest, most reps on a tie); volume (kg, or reps for bodyweight); Δ vs the latest earlier session holding the exercise | all | table | none | Δ shows `—` |
| SS5 | **Share** | Text: workout, date, duration, kg, sets, PR, best set per exercise | — | share sheet | — | — |

### Lifts tab (`features/lifts/LiftsScreen.tsx`, `domain/lifts.ts`, `domain/series.ts`)

| # | Stat | Formula / sets counted | Exercise kinds | Shown as | Interaction | Empty / sparse |
|---|---|---|---|---|---|---|
| L1 | **Lift picker** | Every logged exercise; program order first | all | Horizontally scrolling chips (14 here, 1,828 px wide) + library search | tap a chip | "No sets yet. Log a set and your lifts…" |
| L2 | **Hero** `84.5 kg +4.5 kg since 21 Sep` | The latest point in range; change = last − first point in range | Loaded: e1RM. Bodyweight with any Load ever: "Heaviest load" (signed). Else "Reps per session" (Σ reps) | big number + caption | 1M / 3M / 1Y segmented | With nothing in range the hero still shows the all-time latest, and the chart says "No X sessions in the last month." |
| L3 | **Line chart** | One point per session; x spaced **by index**; ~4 nice y-ticks; record points = running max (first point included) | as L2 | 320 × 180 SVG; record points indigo, others dark grey; latest value labelled | none (no scrub, no tooltip) | 1 point: centred dot, ticks e.g. 60 / 80 |
| L4 | **Next** row `Next: stay at 62.5 kg · 15 of 20 reps` | `progression()` on the newest session holding the lift: only sets at the top weight count; full → add weight / add load / add a set | all three branches | card | none | hidden with no plan |
| L5 | **Records table** | Loaded: Heaviest set (most reps at the top weight), Best e1RM, Most reps in a set (ties go to the heavier). Bodyweight: Most reps in a set, Heaviest load / "Least assistance", Most reps at that load | all | 3-row table with dates | none | hidden |
| L6 | **Bodyweight reps note** `Workout A: 44 bodyweight reps` | The latest session with any bodyweight reps, **whatever lift is selected** | — | one line | none | hidden |
| L7 | **Volume per session** (collapsed) | Every session's loaded kg; then a list of every session's bodyweight reps | — | Bar chart in `<details>`, one colour, no A/B legend; the text list grows by one line per session (45 here) | expand | hidden |

### Program tab (`ui/ProgramPage.tsx`, `domain/programVolume.ts`)

| # | Stat | Formula / sets counted | Exercise kinds | Shown as | Interaction | Empty / sparse |
|---|---|---|---|---|---|---|
| P1 | **Weekly sets, planned** `69 sets · Push 29 Pull 21 Legs 10 Core 9` | Plan sets × `sessionsPerWeek / workouts`. Each set counts **once**, to the family of its first primary muscle (a different rule from D4) | — | Stacked family bar + legend | none | — |
| P2 | **Per-workout table** `23 sets · ~54 min`; kg column | kg = `nextLoad`: the suggested weight when the range was filled, **else the first working set's preset** | — | table | Edit | `–` |
| P3 | **Muscles, planned per week** | `prescribedWeekly` → regions | — | Front/back body map, week bands, gaps list | none | — |
| P4 | **This week, Planned vs Done** | Planned = P3 again; Done = `weekSets`, the **rolling 7 days** by `loggedAt` | — | Two more body maps | none | "No sets logged in the last 7 days" |
| P5 | **Edit impact** (editor) | `familyImpact`: per family, planned weekly sets before → after | — | Panel in the editor | — | — |

### Live session and Set screen (`ui/live/*`, `ui/SetScreen.tsx`, `domain/liveProgress.ts`)

| # | Stat | Formula / sets counted | Exercise kinds | Shown as | Interaction | Empty / sparse |
|---|---|---|---|---|---|---|
| V1 | **Projection line** `Volume 600 kg · last B at this point 600 kg` | Today's loaded kg against the last same-workout session cut to the same per-exercise set count | loaded | Bullet bar (fill + tick, 15 % headroom) | — | no "last" part |
| V2 | **Sets 1/23 · PRs 0** | PRs = **sets** that set at least one record (not the record count of SS1/S4) | all | text | — | — |
| V3 | **Up-next rows** | Dots per planned set; a small bullet of today's exercise volume against the Volume-baseline setting (last / 1w–6m avg or max / since) | loaded; bodyweight reads "bodyweight" | rows | tap opens the next set | — |
| V4 | **VolumeVsBaseline** (exercise list) | `Volume vs last workout: 87%`, bar capped at 100 % | loaded kg / bodyweight reps | progress bar + label | — | "No previous workout" |
| V5 | **Last time** `Last time 60 × 10 · Mon 12 Oct` | Last time's working set at the same position | all | line | — | hidden |
| V6 | **Set projection** `e1RM 80.0 · record 90.0 · no PR at this load` / `→ PR if logged` | Epley of the dialled set; the best e1RM so far, today included; `recordsSetBy` on a hypothetical set | loaded (no e1RM for bodyweight) | text + PR tag | updates as you dial | hidden |
| V7 | **PR toast** | `New PR · Heaviest set`, `62.5 kg × 8 · +2.5 kg`, sparkline of the first record over 7 earlier sessions | all | toast with a 48 × 20 spark | — | none on an exercise's first session |
| V8 | **Usual rest** `you usually rest 3:40` / `Use 3:40 for Deadlift` | Median of the latest 20 rests (stored `restSeconds`, else the gap to the next set, under 15 min), rounded to 5 s, needs ≥ 3 | — | rest bar marker + offer | Use → saves the plan rest | hidden |
| V9 | **ExerciseHistoryOverlay** (code) | Every finished session's sets `60×10 · 60×9`, kind markers (W/D/F/A) **after** the sets, not on them; PR tag per session | all | list | — | "No earlier Sessions" |
| V10 | **LiveStrip** | Elapsed, rest countdown or next set | — | 48 px strip | Return | — |

**Built but unreachable:** `HistoryFeature` (and with it `ui/Stats.tsx`, `HistoryStatsSwitch`,
`HistoryList` and `ProgressionBar`) is not mounted in `App.tsx`. The tabs are Dashboard, Sessions,
Lifts and Program. These are dead code with tests. `HistoryList` is the only place that ever
showed the session **note**.

---

## 3. Stored but not surfaced (raw material for new stats)

| Data (type) | Where stored | Surfaced today | Unused potential |
|---|---|---|---|
| **RIR / effort** `rir: 0–3` per set (only when Track effort is on) | `SetEntry.rir` | **Nowhere after the chip tap.** Only `SetScreen` reads it, as input | Hard sets (RIR ≤ 3), effort trend at a fixed load, RPE-adjusted e1RM, "same weight, easier" progress, readiness |
| **Set kind** warm-up / drop / failure / AMRAP | `SetEntry.kind` | Warm-ups are excluded everywhere. The W/D/F/A markers appear only in the history overlay; drop and failure sets count as full working sets | AMRAP reps as a strength test; failure frequency; drop-set volume shown apart |
| **Per-set timestamp** `loggedAt` | every set | Usual rest; the 7-day window | Real session density (kg per minute), time per exercise, set pacing, time-of-day patterns, rest against plan |
| **Rest actually taken** `restSeconds` (when changed or skipped) | `SetEntry` | Only the usual-rest median | Rest against performance (do short rests cost reps?) |
| **Session start / finish** | `Session` | Duration (summary, rows) | Duration trend; the planned estimate (`~53 min`) never learns: actual median here is 68 min |
| **Signed load** `loadKg` (BW+5 / BW−19) | bodyweight sets | Assisted and loaded-bodyweight chart, records | **Trainee body mass is not stored anywhere**, so no relative strength, no true load for pull-ups or push-ups, no tonnage for bodyweight work |
| **Session note** (≤ 500 chars) | `Session.note` | Live exercise list and the editor only; not in Sessions, the summary or Lifts | Annotate chart points ("shoulder tight"); explain dips |
| **Exercise notes** | setting `exerciseNotes` | Set screen | Same |
| **Swaps** planned → done | `Session.swaps` | Plan lookup only | Substitution history; "you swapped bench 3×" |
| **Plan targets** (rep range, sets, rest, AMRAP) | Program | Next row, live dots | Adherence: % of planned sets done, reps against target, missed sets per exercise |
| **Volume baseline setting** (last / 1w–6m avg/max / since) | setting | Live rows only | The same comparison on the Lifts tab |
| **Ramped working sets** (several weights per exercise) | entries | Collapsed to "best set", or to the first set (Program kg) | Top-set vs back-off view; per-set e1RM spread |
| **Deleted / discarded sessions** `deletedAt` | `Session` | never (by design) | — |
| **Library muscles** (primary and secondary, 17) + `mechanic` / `force` | library | Muscle counts | Compound vs isolation split; push:pull ratio by force |

---

## 4. Screen-by-screen findings, ranked by severity

Measured items carry the probe's numbers. Contrast ratios were computed from `src/styles/tokens.css`.

### High

1. **Session summary: the duration KPI overlaps Volume.**
   - Shots: `03-summary.png`, `32-one-summary.png`, `32-sparse-summary.png`.
   - Measured: the duration value is 107 px wide (`scrollWidth`) inside a 62 px value box (29–91 px).
   - `1 h 11` runs into the volume column, and `min` prints under `4,185` (`durationParts` returns `1 h 11` + `min`).
   - It happens on **every** session over 60 minutes, which is all 45 seeded sessions (63–73 min).
2. **The region panel counts warm-ups, and the Lats region double-counts.**
   - Shot: `18-region-panel-lats.png`, Workout B. The header reads `21 sets`, but the rows sum to **22**:
     - Deadlift 4, which includes the 40 × 5 warm-up;
     - Assisted pull-ups 6, from 4 sets;
     - Pull-down 4.5;
     - Row 6;
     - Face pull 1.5.
   - Cause: `contributors()` in `muscles.ts` does not filter `workingSets`. This breaks the
     must-keep rule "warm-ups never count".
   - Separately, the heading is the raw region id `upper-back` (also in `04-region-panel.png`).
     The panel is a full-screen sheet that is about 70 % empty.
3. **PR inflation makes the summary a wall of records.**
   - Shot: `03-summary.png`. Wed 14 Oct shows **11 PRs**: 9 record rows fill the first screen,
     and "Worked today" falls below the fold.
   - Across the seed there are 446 records in 45 sessions, 6–15 per session (median 11).
   - One set can earn three records: Heaviest set, Best e1RM, and Most reps at the heaviest weight.
   - "Most reps at the heaviest weight" counts as a PR **when the reps went down**. On a weight
     bump (60 × 10 → 62.5 × 8) its RecordSpark ends at the bottom of its own line, a decline
     labelled as a PR. See §5.
4. **Two different "PR" counts.**
   - The live bar counts *sets* that set a record (V2). The summary and session rows count
     *records* (SS1, S4).
   - The same session can read `PRs 4` live and `11 PR` afterwards. Code-read (`liveProgress.ts`
     against `summary.ts`).
5. **The Sessions "Lats" and the Dashboard "Lats" disagree for the same week.**
   - Shots: `01-dashboard.png` against `02-sessions.png`, week of 12 Oct.
   - Dashboard: Lats **13**, Mid back **9**. Sessions: Lats **21**, with no mid-back row.
   - Sessions folds both muscles into the `upper-back` region, so every B session alone reaches
     the darkest band (21+). The week of 28 Sep reads **42**.

### Medium

6. **Record points are encoded by colour only.**
   - Shots: `07-lifts-squat-1Y.png`, `08-lifts-bench-plateau-1Y.png`.
   - Record points are primary `#4338A8` and the rest are secondary `#45454F`: same radius
     (r = 4), luminance contrast **1.07:1**. They are indistinguishable in greyscale or to many
     colour-blind users.
   - The legend "● Record" relies on the same hue.
7. **The lift picker scrolls sideways and hides most lifts.**
   - Shot: `05-lifts-squat-1M.png`.
   - 14 chips sit in a 1,828 px row and only 3½ are visible. Chips are **36 px tall**, under 44.
   - The selected chip can scroll out of view (`10-lifts-assisted-1Y.png` starts at "Cable
     push-down").
   - Nothing ranks or groups the lifts (A/B, moving / stalled).
8. **The x-axis is spaced by session index, not time.**
   - Shots: `07`, `08`, `10`.
   - The missed week (10 Aug) and the 1-session sick week (14 Sep) vanish: 1Y squat looks
     perfectly regular.
   - Unequal date gaps (22 Jun → 20 Jul → 24 Aug → 14 Oct) are drawn as equal.
9. **The plateau is invisible.**
   - Shot: `08-lifts-bench-plateau-1Y.png`. DB bench has been stuck at 13 kg × 8–9 for
     **12 sessions (9 weeks)**.
   - The screen leads with `16.9 kg +4.2 kg since 22 Jun` and the reassuring `Next: stay at 13 kg`.
   - Nothing on the Dashboard ever surfaces it, because D5 always shows squat, deadlift and lunges.
10. **Bodyweight series change meaning silently.**
    - Hyper-extension (`12-lifts-hyperext-1Y.png`): one BW+5 session flips the chart to "Heaviest
      load". 20 sessions of rep history disappear, and the 1Y view is two points:
      `BW+5 · No change since 7 Oct`.
    - Push-ups (`11-lifts-pushups-3M.png`) chart **total reps per session**, so an extra set or a
      failure set reads as strength.
    - Assisted (`10-lifts-assisted-1Y.png`): the y-axis is −20 to −28 with an ASCII-hyphen label
      `-21`, while the hero says `BW−21`. "Most reps in a set: 8 reps · 8 Jul" ignores the
      assistance (that was at BW−27), a stale record that can never be beaten honestly.
11. **The volume charts mix A and B workouts.**
    - Shots: `02-sessions.png`, `13-lifts-volume-open.png`.
    - B sessions (~7,000 kg, deadlift and row) and A sessions (~4,200 kg) alternate, so the chart
      is a sawtooth that says nothing about progress.
    - A and B differ by shade only (`#45454F` against `#8A8A97`, 2.78:1). The Lifts copy drops
      the legend entirely.
    - The last-bar value label (`4,185`) is drawn over the neighbouring B bar.
    - The Lifts "Volume per session" detail appends a 45-line list of "Workout X: N bodyweight
      reps".
12. **Week comparisons are rotation and partial-week noise.**
    - `01-dashboard.png` on a Thursday: `Sets 47 vs 69`, `Volume 11,459 vs 16,133`.
    - The current part-week is compared with a complete one and there is no pace marker.
    - With A/B on 3 days a week, alternate weeks are ABA and BAB, so per-muscle weeks alternate
      (chest 14 / 7 / 14 / 7, lats 12.5 / 25) whatever the trainee does (`02-sessions.png` heat).
13. **The heat chips' bands are absolute and hard to tell apart.**
    - Band 0 against white is 1.15:1; band 0 against band 1 is 1.40:1.
    - The bands ignore the plan: Shoulders `15 of 21` is darker than Quads `9 of 13`, although
      both are at about 70 %.
    - The summary's region rows are **158 × 24 px** tap targets (probe), under 44.

### Low

14. **The dashboard sparklines exaggerate small changes.**
    - Shot: `01-dashboard.png`. They are min–max normalised, so lunges +1.3 kg climbs as steeply
      as squat +5.2 kg.
    - The deadlift line turns down on the day of its heaviest-ever set (70 × 7, see §5).
15. **The "bodyweight reps" note shows under every lift.**
    - `Workout A: 44 bodyweight reps` appears under Back squat, DB bench, etc.
      (`05`, `07`, `08`).
16. **Sparse data.**
    - 1 session (`33-one-lifts.png`): one dot pinned to the top edge of a 60–80 axis; the record
      legend shows anyway.
    - 2 sessions (`30-sparse-dashboard.png`): three lone dots with `—` deltas, and
      `2/3 vs 0 · 47 vs 0`.
    - `31-sparse-sessions.png`: 3 of 4 heat columns are all-zero chips; the volume chart compares
      a B bar with an A bar and reads as a 40 % drop.
    - Zero sessions (`30-zero-dashboard.png`): 24 zero chips and an empty lifts card. The Lifts
      empty state (`33-zero-lifts.png`) is good.
17. **Program tab.**
    - Shot: `14-program-full.png`. The planned body map is drawn twice: "Muscles, planned per
      week" and "This week → Planned".
    - The kg column shows the **first** working set for ramped lifts: Back squat `47.5` while the
      top set is 62.5; Deadlift `60` while the top is 70.
    - "This week" here is a rolling 7 days, but on the Dashboard it is the calendar week.
18. **Live set screen.**
    - Shots: `20-live-set-screen.png`, `21-live-rest.png`.
    - On a ramp set the projection says `e1RM 80.0 · record 90.0 · no PR at this load`: true, but
      noise.
    - The All grid presets every deadlift set at `60 × 10` (the first set), so the logged ramp
      (60 / 70 / 70) is flattened.
    - The dashboard header's sync line wraps to two lines (`Not synced · saved on this phone`).

What works (keep):
- the Lifts records table;
- the "Next: stay at 62.5 kg · 15 of 20 reps" row, which is honest and actionable;
- the calendar;
- the live bullet "last B at this point";
- usual rest from real gaps;
- the Lifts empty state.

---

## 5. Correctness and maths concerns

1. **Warm-ups leak into the region panel** (`muscles.ts contributors`). Measured: 22 against 21.
   This is a must-keep violation.
2. **Region folding double-counts the back.**
   - `toRegionCounts` maps both lats and middle back to `upper-back`.
   - Deadlift adds 0.5 to each, and one exercise can add 1.5 sets to one region (assisted
     pull-ups: 4 sets → 6).
   - Dashboard (muscles) and Sessions / summary (regions) therefore disagree for the same week.
3. **Library mapping drives the "balance" story.**
   - Deadlift is primary lower back (core) only.
   - Hamstrings and glutes are never primary anywhere in the program.
   - Face pull counts as shoulders (push, front-deltoid region).
   - Abs only ever get 0.5s.
   - Result: P1 reads Legs **10** / Push **29** planned sets a week, and actual weeks run legs 7–14
     against push 22–36 (primary-only).
4. **Three week definitions:**
   - Dashboard KPIs: calendar week by `startedAt`;
   - Dashboard muscle week: calendar week by `loggedAt`;
   - Program "This week": rolling 7 days by `loggedAt`;
   - Sessions heat: calendar week by `startedAt`.
5. **Partial against full week** (D1–D3) with no pace or day-matched comparison. A/B rotation
   noise makes week-over-week deltas unreliable at this frequency.
6. **PR definition inflation:**
   - "Most reps at the heaviest weight" resets at every weight bump. The summary counts it as a
     record even though reps fell, and hides the gain because it is negative.
   - e1RM PRs as small as +0.2 kg count fully. Seed total: 446 records, 61 of them weight or load
     records.
   - `summarize` checks value and weight; `recordsSetBy` also checks reps. That is a minor
     mismatch between toast and summary.
7. **The e1RM sawtooth under double progression.**
   - Epley rewards reps, so the session with the heaviest set often shows a **lower** e1RM.
     Deadlift 67.5 × 10 = **90.0**, then 70 × 7 = **86.3** the next session.
   - The Dashboard draws a downturn on a PR day. Squat shows the same pattern (60 × 10 = 80.0,
     then 62.5 × 8 = 79.2).
8. **Index-spaced time axes** (L3, S3, sparklines) hide gaps and make slopes per session, not per
   week.
9. **Bodyweight series selection** (`seriesKind`): any loaded set turns the whole history into
   "heaviest load" and drops unloaded sessions. Reps-per-session conflates sets with capacity.
   "Most reps in a set" for assisted work ignores the assistance level.
10. **Drop and failure sets count as full working sets** in muscle volume and set counts. A
    6 kg → 4 kg drop on lateral raises adds a full shoulder set. This is defensible, but nowhere
    declared.
11. **No body mass is stored**, so kg volume silently excludes every bodyweight and assisted set.
    That is about a fifth of this trainee's working sets: 10 of 46 per A+B pair (push-ups,
    pull-ups, hyper-extensions).
12. **The `~53 min` estimate** uses 40 s per set plus the planned rest. Actual logged sessions here
    are 63–73 min (median 68), and the app has that data.
13. **The Program kg column** (`planLoad.nextLoad`) means two different things: the next weight
    when a suggestion fires, else the first working set. With ramped sets that is a back-off
    weight.

---

## 6. Shared content (use these numbers in every concept)

Source: `dataset.json`. It has 45 sessions, each with date, day A/B, start time, duration, note,
exercises and sets (weight / load, reps, kind, RIR, rest), plus a `derived` block. Today is **Thu 15
Oct 2026**. The program is the A/B Split, 3× a week, Mon/Wed/Fri, alternating.

**Consistency**
- 45 sessions over 17 weeks. Sessions per week:
  `3 3 3 3 3 3 3 0 3 3 3 3 1 3 3 3 2`.
- **Missed week:** 10 Aug (holiday).
- **Sick week:** 14 Sep (1 session, B).
- **This week:** 2 of 3 (Mon 12 B, Wed 14 A). **B is due.**
- Adherence over the 16 full weeks: **89.6 %**.
- Session duration: median **68 min**, range 63–73; the app estimates ~53–54.
- Working sets per full week: 69–70; warm-ups 4–5.
- Weekly loaded volume: 10,259 kg (22 Jun) → 18,008 kg (28 Sep, a BAB week). The ABA / BAB
  alternation is about ±2,000 kg.
- RIR is logged from session 11: 710 working sets carry an RIR (0: 89, 1: 227, 2: 295, 3+: 99).
- Set kinds: 68 warm-ups, 17 failure, 6 drop.

**e1RM series (kg, Epley, best working set per session)**

| Lift | First → latest (best) | Change | Top set now | Shape |
|---|---|---|---|---|
| Back squat (A) | 61.7 → **79.2** (best 80.0, 9 Oct) | +17.5 kg / +28 % | 62.5 × 8 (ramp 47.5 × 10 / 57.5 × 9 / 62.5 × 8 / 62.5 × 7, warm-ups 20 × 10, 37.5 × 5) | sawtooth climb: 66.7 Jul → 70.0 → 73.3 Aug → 76.7 Sep → 80.0 → 79.2 |
| Deadlift (B) | 69.7 → **86.3** (best 90.0, 7 Oct) | +16.6 / +24 % | 70 × 7 (ramp 60 / 70 / 70, warm-up 40 × 5) | 12 Oct: heaviest set ever, e1RM down 3.7 |
| **DB bench press (A): the plateau** | 12.7 → **16.9** | +4.2 / +33 % | 13 × 9 | 13 kg since 7 Aug; e1RM 16.5–16.9 for **12 sessions**; reps 9 / 8 / 8 / 7, never 4 × 10 |
| Machine row (B) | 63.3 → **97.5** | +34.2 / +54 % | 75 × 9 | steady, best mover |
| Narrow-grip pull-down (B) | 55.0 → **66.5** | +11.5 / +21 % | 47.5 × 12 | slow and wobbly (63.3 – 64.9 for 5 weeks) |
| Machine shoulder press (A) | 6.3 → **15.8** | +9.5 / +151 % | 12.5 × 8 | tiny loads, huge % |
| Cable push-down (A) | 23.3 → **43.3** | +20.0 / +86 % | 32.5 × 10 | steady |
| Lunges (A) | 9.3 → **17.3** | +8.0 / +86 % | 13 × 10 | steady |
| Lateral raises (A) | 4.0 → **9.3** | +5.3 / +133 % | 7 × 10 | steady |
| Face pull (B) | 20.0 → **35.8** | +15.8 / +79 % | 25 × 13 | steady |
| Seated biceps curls (B) | 10.7 → **19.6** | +8.9 / +83 % | 14 × 12 | steady; the Dashboard hint is "try 15 kg" |

Full squat series (date: e1RM):
`22 Jun 61.7 · 26 Jun 63.3 · 1 Jul 65.0 · 6 Jul 66.7 · 10 Jul 66.7 · 15 Jul 66.5 · 20 Jul 68.2 · 24 Jul
70.0 · 29 Jul 67.8 · 3 Aug 71.5 · 7 Aug 73.3 · 19 Aug 72.8 · 24 Aug 70.9 · 28 Aug 74.8 · 2 Sep 74.8 ·
7 Sep 76.7 · 11 Sep 76.7 · 21 Sep 76.7 · 25 Sep 74.0 · 30 Sep 74.0 · 5 Oct 78.0 · 9 Oct 80.0 · 14 Oct 79.2`.

Full deadlift series:
`24 Jun 69.7 · 29 Jun 69.7 · 3 Jul 71.5 · 8 Jul 73.3 · 13 Jul 72.8 · 17 Jul 74.8 · 22 Jul 76.7 · 27 Jul
76.7 · 31 Jul 74.0 · 5 Aug 76.0 · 17 Aug 80.0 · 21 Aug 79.2 · 26 Aug 79.2 · 31 Aug 83.3 · 4 Sep 82.3 ·
9 Sep 82.3 · 14 Sep 84.5 · 23 Sep 86.7 · 28 Sep 85.5 · 2 Oct 87.8 · 7 Oct 90.0 · 12 Oct 86.3`.

Bench, row and the rest are in `dataset.json → derived.series`.

**The assisted lift: Assisted pull-ups (B), 4 × 5–8.** Less assistance is better; draw it with a
reversed axis and negate nothing.
- Assistance by period:
  - BW−27: 24 Jun – 13 Jul;
  - BW−25: 17 Jul – 5 Aug;
  - BW−23: 17 Aug – 4 Sep;
  - BW−21: 9 Sep – 2 Oct;
  - **BW−19**: 7 Oct – now.
- That is 8 kg less assistance in 16 weeks: a staircase. Each step starts at 5 reps and climbs to
  8 over 4–5 sessions. Total reps per session go 19 → 32, then reset.
- Latest session: BW−19 × 6 / 6 / 6 / 5 (23 reps). The app says "Next: same again · 23 of 32".

**Bodyweight**
- **Push-ups:** 3 × 10–15. Best set 11 → 17 reps; total reps per session 30 → 44–47, flat since
  August. The app says "Next: add a set".
- **Hyper-extension:** BW × 15 / 15 / 15 from mid-July, then **BW+5 × 12 / 11 / 10** on 7 and 12
  Oct. This is the series-switch case.

**Weekly working sets per muscle** (app rule: 1 per primary, 0.5 per secondary). The rotation
makes two alternating week types.

| Muscle | ABA week (e.g. 5 Oct) | BAB week (e.g. 28 Sep) | Planned / week | This week so far (BA) |
|---|---|---|---|---|
| Chest | 14 | 7 | 11 | 7 |
| Shoulders | 23.5 | 18.5 | 21 | 15 |
| Triceps | 16 | 8 | 12 | 8 |
| Lats | 12.5 | 25 | 19 | 12.5 |
| Mid back | 8.5 | 17 | 13 | 8.5 |
| Biceps | 6.5 | 13 | 10 | 6.5 |
| Quads | 15.5 | 10 | 13 | 8.5 |
| Hamstrings | 10 | 9.5 | 10 | 6.5 |
| Glutes | 10 | 9.5 | 10 | 6.5 |
| Lower back | 10 | 14 | 12 | 8 |
| Calves | 8.5 | 6.5 | 8 | 5 |
| Abs | 2 | 4 | 3 | 2 |

Families (primary only): ABA = push 35 / pull 14 / legs 14 / core 6; BAB = push 22 / pull 28 /
legs 7 / core 12. Planned (P1): push 29 / pull 21 / legs 10 / core 9.
- ABA weeks: 22 Jun, 6 Jul, 20 Jul, 3 Aug, 24 Aug, 7 Sep, 21 Sep, 5 Oct.
- BAB weeks: 29 Jun, 13 Jul, 27 Jul, 17 Aug, 31 Aug, 28 Sep.
- Week of 10 Aug: all 0.
- Week of 14 Sep (B only): lats 12.5, mid back 8.5, biceps 6.5, lower back 6, chest 0, quads 1.5.

**Records**
- 446 record changes in total. Use only a curated subset; the rest is the inflation case.
- Last 3 weeks' weight and e1RM PRs (date · lift · record · gain):
  - 28 Sep: Deadlift heaviest 67.5 × 8 (+2.5) · Row e1RM 91.0 (+2.3)
  - 2 Oct: Deadlift e1RM 87.8 · Face pull 25 × 10 (+2.5) · Biceps 14 × 10 (+1)
  - 5 Oct: Squat e1RM 78.0 (+1.3) · Push-down e1RM 41.0
  - 7 Oct: **Deadlift e1RM 90.0 (+2.2)** · **Assisted least assistance BW−19 (+2)** · Row
    75 × 8 (+5) · **Hyper-ext first load BW+5**
  - 9 Oct: **Squat e1RM 80.0 (+2.0)** · Lateral raise 7 × 10 (+1)
  - 12 Oct: **Deadlift heaviest 70 × 7 (+2.5) while e1RM fell to 86.3** · Row e1RM 97.5 (+2.5)
  - 14 Oct: **Squat heaviest 62.5 × 8 (+2.5)** · Lunges 13 × 10 · Shoulder press 12.5 × 8 ·
    Push-down 32.5 × 10 (+2.5). The app shows 11 PRs for this session.
- Squat records table: Heaviest set 62.5 kg × 8 (14 Oct) · Best e1RM 80.0 (9 Oct) · Most reps in a
  set 60 × 10 (9 Oct; ties go to the heavier weight).

**Sparse variants:** the last 1 and last 2 sessions. In the app these give the `30-one-*`,
`30-sparse-*` and `31-sparse-*` screens.

---

## 7. Implications for the concepts

- **Lead with a verdict per lift, not a picker.** Classify each lift as moving, stalled or
  regressing over a time window, for example "DB bench: 9 weeks at 13 kg". Put stalls on the
  first screen. Today the plateau is the one fact nobody can find.
- **Plot progress against the top set, not raw Epley alone.** Show the top-set weight × reps as
  the primary mark, e1RM as context, and annotate weight bumps. Then a heavier day never reads as
  a decline.
- **Redefine PRs before designing their display.** Count weight or load PRs and true rep PRs at
  an *already-achieved* weight; drop "most reps at the new weight" and sub-0.5 kg e1RM ticks. Use
  one PR count everywhere: live, summary, rows.
- **Use a real time axis everywhere.** Missed weeks must be visible gaps; consistency is half the
  story for this trainee.
- **Compare weeks honestly.** Use a day-matched or pace-adjusted "this week so far". For A/B
  every-other-week noise, compare rolling 2-week or per-rotation (A+B) totals.
- **Pick one muscle model and one week definition.** Show the same numbers on every screen;
  separate lats from mid back, or explicitly merge them in both places. Warm-ups must be out of
  the region panel too.
- **Make muscle volume plan-relative.** Colour by % of planned (or a hard-set target band), not
  by absolute 1–9 / 10–20 / 21+. Show legs and abs under-dosing and the push-heavy split as the
  insight it is.
- **Give each exercise kind its own honest chart:**
  - assisted: a staircase of assistance with reps at each step, reversed axis, labelled `BW−19`
    not `-19`;
  - bodyweight: best set and sets × reps, not summed reps;
  - loaded bodyweight: one continuous series, with the switch to BW+5 annotated.
- **Surface the stored but unused data:**
  - RIR: effort at the same load over time, and hard-set counts;
  - real session duration against the estimate;
  - rest taken;
  - session notes as chart annotations;
  - set kinds, with drop and failure work shown apart.
  - Consider storing body mass: without it, about a fifth of the sets have no load.
- **Design sparse and empty states on purpose:**
  - 1 session: a baseline card ("first squat: 62.5 × 8 · e1RM 79.2"), not a lone dot;
  - 2 sessions of different workouts: no A-against-B comparison;
  - zero: no grids of zeros.
- **Phone mechanics:**
  - ≥ 44 px targets (lift chips 36, region rows 24);
  - no colour-only encodings (record dots 1.07:1, A/B bars);
  - KPI cells that fit `1 h 11 min`;
  - direct labels instead of the 45-line bodyweight-reps dump.
- **Volume as a per-workout trend**, A against A and B against B, or tonnage per muscle. A single
  alternating bar chart of mixed workouts should go.
