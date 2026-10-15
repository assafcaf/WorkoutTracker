# Stats that say whether you are progressing: verdicts, ladders, muscles against the plan
Status: draft (input to `/spec`, not approved)   ·   Tracker: — (next free key is probably E18; roadmap R7, partial)

Drafted 2026-10-15 from `docs/design/stats-2026-10/` without the operator Q&A. Every decision
that would normally be asked is listed under **Decisions taken without the operator**; `/spec`
may revisit any of them. The draft decision record is `decision-draft.md` beside this file.

Paths below are relative to `docs/design/stats-2026-10/` unless they start with `src/`, `docs/`
or `scripts/`. That folder is untracked: from a worktree, read it in the main checkout.

## Problem
A lifter opening the app cannot tell in seconds whether they are progressing, where, and what to
do next. Today's stats lead with an e1RM line that dips on PR days, hide gaps on index-spaced
axes, count warm-ups in one panel, merge Lats and Mid back on one tab, and report 446 records in
45 sessions (`research/audit.md` §4–5). The research run picked a hybrid built on Verdict Feed
(`reviews/cross-concept.md` §4–5); this epic builds it on correct, tested rules.

## Non-goals
- A bodyweight log, body measurements, or bodyweight-aware volume (the rest of R7).
- RIR/effort trends, rest-vs-performance, duration trends: stored data not surfaced here.
- A dark mode or a new palette. The shipped Progress Dashboard tokens stay
  (`src/styles/tokens.css`, closed set enforced by `tokens.test.ts`).
- Any control in stats that edits a Program or a stored value (0006: suggest, never edit).
- Weekday scheduling of workouts (the Program has no days, so nothing says "due Fri").
- A charting library (0006: hand-drawn SVG).
- Lift Ledger's ideas beyond the prescription-in-the-value-column sparse state.

## References
- **Hybrid definition:** `reviews/cross-concept.md` §4 (ideas and conflicts) and §5 (the pick).
- **Rules (the must-fix truths T1–T7) and copy format:** `brief.md` §1.3.2 and §1.3.10.
- **Golden numbers:** `brief-data.json`, built by `brief-data.py` from `research/dataset.json`
  plus the realism adjustments of `brief.md` §1.3.1 (deload week, pull-down regression, notes
  moved). Every engine outcome below is checked against it.
- **Orchestrator rulings 1–16:** `process-memo.md`, Phase 4 "Rulings log" and the bullets after
  it. They override `brief.md` where they differ.
- **Acceptance checklist:** `research/principles.md` §6 (30 items).
- **Bugs to fix:** `research/audit.md` §4 (findings 1–17) and §5 (concerns 1–13);
  `reviews/cross-concept.md` §5 "Fix in the current app regardless of the pick".
- **Mock crops, 390 × 844** (board geometry `brief.md` §1.2; per-frame crops in
  `reviews/_compare/`):
  - Progress home: `mocks/verdict-feed/` S1, S1b; the "climbed a step" line from
    `mocks/progression-ladder/` S1; the adherence day strip from `mocks/training-week/` S1.
  - Lift page: `mocks/progression-ladder/` S2, S3, S3b, S8a, S8b, S8d (ladder, docked readout),
    with `mocks/verdict-feed/` S2 bands and S8c's `4 weeks ago` tick.
  - Muscles: `mocks/training-week/` S4 (bullets, 2-week default) and S1's still-planned segment.
  - Session summary: `mocks/progression-ladder/` S6 (moves in words, `Next time`) with
    `mocks/training-week/` S6's header ("What Wed did for your week").
  - Sparse: `mocks/verdict-feed/` S7a (expectation list), S7b, S7c; prescription column from
    `mocks/lift-ledger/` S7a.
  - Train (due workout with next-step bars): `mocks/progression-ladder/` S1b.
  - Each mock folder's `rationale.md` explains its frames. Visual stance is **not** taken from
    the mocks (see Decisions); structure, order and content are.
- **Rendering:** the audit's headless CDP driver (`%TEMP%/stats-audit/cdp.js`, built on the
  repo's `ws`) and its app-format seed `research/audit-shots/seed-app-format.json`.

## Protected paths
- `src/types.ts`, `src/storage/**`, `src/services/sessions.ts`, `src/sync/**`, `src/worker/**`,
  `migrations/**` — the data model and its storage and sync.
- `src/domain/stats/**` — the lift-classification rules. Their tests are the only oracle (a
  false verdict prints in large type), so they take the strict discipline.

## Domains
- **Stats engine** (`src/domain/stats/`): lift history per Session, records, verdicts, steps
  climbed, next step, weeks and adherence, muscles against the plan, ladder geometry, session
  moves, and every generated sentence.
- **Deload mark**: an optional flag on a Session, its Service write, and its toggle.
- **Progress tab**: home feed, all-lifts list, lift page, muscles page.
- **Charts**: the ladder (full and mini) with the docked scrub readout.
- **Train tab** (today's Dashboard): the due workout and its next steps.
- **Sessions tab and the session summary**: one record count, 12 muscles, moves in words.
- **Live session**: PR count, PR toast and set projection on the new record rule.
- **Program tab**: one week definition.
- **Retirement**: the unmounted History/Stats code and the old stats modules.
- **Fixtures and render harness**: the brief's data in app format, and a 390 × 844 render script.

## The rules (exact definitions)

These are the engine's contract. Each is checked against `brief-data.json` (fixture
`expected.json`, see O1). Where a rule names a kind of Exercise, the kind comes from the
catalog through `bodyweightOf` / `applyBodyweight` (`src/domain/bodyweight.ts`) and the sign of
the Load. `invertProgress` no longer exists (0016); assisted means a Bodyweight Exercise whose
Load is negative. No call site decides a kind.

- **R-W Working sets.** Every Set without `kind: 'warmup'` (`countsTowardStats`). Drop and
  failure Sets count in full for set counts, volume and muscle sets. **Straight sets** are
  working Sets that are not `drop`; only straight sets set records, top sets and e1RM.
- **R-L Lever.** A Set's comparable weight: `weightKg` on a loaded Exercise; on a Bodyweight
  Exercise the signed `loadKg`, with `BW` (no Load) as 0. Higher is better in every kind
  (0016), so less assistance is a higher lever. Displayed as `62.5 kg`, `BW`, `BW+5`, `BW−19`
  (U+2212); never a negative kilogram.
- **R-T Top set** of a lift in a Session: the highest lever among its straight sets, and the
  most reps at that lever.
- **R-E e1RM.** Epley `w × (1 + r/30)`, unrounded in the engine, one decimal in copy. Only for
  an **e1RM lift**: not Bodyweight, and its Plan's top rep ≤ 10 (here Back squat, DB bench
  press, Machine shoulder press, Deadlift, Machine row). Only from straight sets of ≤ 10 reps;
  a Session's e1RM is the best such set. Always labelled `estimated`; never a headline, never
  the only progress measure, never on the ladder (text only). Other lifts have no e1RM.
- **R-R Records** (one per lift per Session). Not set in a lift's first Session (its
  **baseline**) or in a deload Session. Otherwise the first that matches, in this order:
  1. **Heaviest weight**: the top lever beats every earlier lever of the lift. Named **Least
     assistance** when the new lever is negative, **First added load** when a Bodyweight lift's
     earlier best lever was ≤ 0 and the new one is > 0. Gain `+2.5 kg`, `−2 kg assistance`,
     `+5 kg`.
  2. **Rep record**: a straight set has more reps than any earlier set at the same lever
     (deload Sessions included in "earlier"). The best such set wins (highest lever, then most
     reps). Gain `+1 rep` / `+2 reps`.
  3. **Estimated 1RM**: e1RM lifts only, the Session's e1RM ≥ the earlier best + 0.5 kg.
  A lower-ranked kind beaten in the same Session is kept as `alsoBeat` for the readout only;
  it never counts. "Most reps at the heaviest weight" and volume records are gone. Fixture
  total: **201** records in 45 Sessions (the app counts 446).
- **R-B Per-lift bests table** (lift page): per kind, the best value and the date, as in
  `brief-data.json → lifts.<id>.records` — loaded: `Heaviest set`, plus `Best estimated 1RM`
  for e1RM lifts; assisted: `Least assistance`, `Most reps at <current lever>`; Bodyweight with
  Load: `Heaviest added load`, `Most reps, bodyweight only`, `Most reps at <current lever>`;
  plain Bodyweight: `Most reps in a set`. Ties go to the earliest date.
- **R-V Verdicts**, per lift, over its non-deload Sessions only (call them *n*):
  - `too new` when n < 4, with "`4 − n` more".
  - `slipping` when the last 2 are both **below** the best top set of the 4 before them (the
    sessions n−6 … n−3 by position, fewer when fewer exist). Below = lower lever, or the same
    lever and fewer reps.
  - else `stalled` when none of the last 4 set a record. Its facts: the date of the last record
    (or the baseline when none), the number of non-deload Sessions after it, and the weeks from
    it to today (`9.9`, shown whole as `10 weeks` on the landing per ruling 7).
  - else `moving`.
  A gap never counts; deloads are skipped. Words and glyphs exactly: `▲ Moving`, `■ Stalled`,
  `▼ Slipping`, `○ Too new`; deload is a labelled band, no glyph; never colour alone.
- **R-N Next step** (0006, unchanged): reps done in the latest Session's straight sets at its
  top lever, against those sets × the top of the Plan's range. Full means **ready**: suggest
  one `weightStep` up (or one Load step) for loaded and Bodyweight-with-Load lifts, or "add a
  set" for plain Bodyweight lifts. Phrased as a suggestion (`Try 15 kg next`).
- **R-S Steps climbed**: lifts with a Heaviest weight / Least assistance / First added load
  record in the Sessions of the 28 days ending today (`since` = the first of those days; on Thu
  15 Oct that is Fri 18 Sep). Fixture: **12 of 14**, not DB bench press and not Push-ups.
- **R-K Week.** Calendar week Monday 00:00 to Sunday 24:00, local time, by Session
  `startedAt`. The one definition for adherence, muscle weeks, Sessions grouping and the
  Program tab. A week in progress is always "so far", shown with what is still planned, never
  compared with a full week.
- **R-A Adherence**: Sessions in a week against `program.sessionsPerWeek`.
- **R-M Muscles.** 12 muscles: Chest, Shoulders, Triceps, Lats, Mid back, Biceps, Quads,
  Hamstrings, Glutes, Calves, Lower back, Abs (library names `middle back`, `quadriceps`,
  `abdominals`). 1 per primary muscle and 0.5 per secondary, working sets only. Forearms and
  Traps counted, shown only in drill-downs. Lats and Mid back never merged. **Planned per
  week** = plan sets × `sessionsPerWeek / workouts`, same split. **Window**: the last 2
  complete weeks, averaged (one ABA + one BAB week on an A/B program at 3 a week). **This week**:
  done so far, plus **still planned** = the Plan sets of the workouts the rotation still owes
  this week (`sessionsPerWeek` − Sessions so far, continuing the rotation from the latest
  Session). Rows show whole numbers (half up), drill-downs exact values; the 10–20 sets range is
  muted context, never pass/fail.
- **R-D Deload.** A Session is a deload when the trainee marked it (`Session.deload: true`).
  Nothing infers it.
- **R-C Copy.** Every number or date inside a sentence comes from an engine function, never
  typed; `brief.md` §1.3.10 formats (×, –, −, thousands comma, `Wed 14 Oct`); sentence case; no
  exclamation marks, emoji, trophies or confetti; no change or delta printed for a lift before
  its 4th non-deload Session (ruling 14); a delta beside a verdict uses the verdict's own window
  (ruling 11).

## Outcomes

Engine outcomes are checked against a fixture: `brief-data.json`'s 45 Sessions rebuilt in app
format with the deload Sessions marked (`sessions.json`), and the expected values from
`brief-data.json` (`expected.json`). "Today" is Thu 15 Oct 2026 18:05 unless an outcome says
otherwise. The sparse fixtures are the first 1 Session (today Tue 23 Jun) and the first 3
(today Sat 27 Jun).

**Fixtures and harness**
- [O1] Given `research/audit-shots/seed-app-format.json` and the adjustments of `brief.md`
  §1.3.1, when the fixture builder runs, then `sessions.json` holds 45 app-format Sessions whose
  per-lift working sets, warm-ups and notes match `brief-data.json → lifts.<id>.points[]`, with
  `deload: true` on Mon 21, Wed 23 and Fri 25 Sep, and `expected.json` carries the lifts'
  verdicts, records, next steps and points, the Sessions' record lists, the weeks and the
  muscle tables. (level: unit)
- [O2] Given the app running in dev mode, when the render script is given a seed, a list of
  taps by visible text and an output path, then it writes a 390 × 844 DPR-2 screenshot of that
  screen. (level: surface web-ui)

**Deload mark (protected)**
- [O3] Given a finished Session, when the trainee marks it a deload, then the stored Session
  carries `deload: true` and a new `updatedAt`, the `sessions` change topic fires, and sync and
  backup carry the field; unmarking removes the field. A Session never marked has no field.
  (level: integration)

**Stats engine (protected)**
- [O4] Given the fixture, when each of the 14 lifts' history is built, then every Session
  point's top set, working sets, warm-ups, e1RM (absent for the 9 non-e1RM lifts) and deload
  flag equal `expected.json`. (level: unit)
- [O5] Given the fixture, when records are computed, then every lift has at most one record per
  Session and each Session's records equal `brief-data.json → sessions[].prs` (kind, set,
  gain); baselines and deload Sessions have none, a drop set never sets one, and the total is
  201. Wed 14 Oct has 4: Back squat, Lunges, Machine shoulder press and Cable push-down, each
  `Heaviest weight`. (level: unit)
- [O6] Given the fixture, when a Session's record count is asked for, then the one function
  answers for the live strip, the summary and the Sessions row alike (Wed 14 Oct → 4, Mon 12 Oct
  → 5). (level: unit)
- [O7] Given the fixture, when each lift's bests table is built, then it equals
  `brief-data.json → lifts.<id>.records` (e.g. Back squat `Heaviest set 62.5 kg × 8 · Wed 14
  Oct`, `Best estimated 1RM 80.0 kg · Fri 9 Oct`; Assisted pull-ups `Least assistance BW−19 × 6
  · Mon 12 Oct`). (level: unit)
- [O8] Given the fixture, when verdicts are computed, then they are 11 moving, 2 stalled (DB
  bench press since Fri 7 Aug, 10 Sessions, 9.9 weeks; Push-ups since Mon 3 Aug, 11 Sessions,
  10.4 weeks) and 1 slipping (Narrow-grip pull-down, below 47.5 kg × 10 of Mon 28 Sep); with 1
  Session every Workout A lift is `too new · 3 more`; with 3 Sessions A lifts `2 more` and B
  lifts `3 more`. (level: unit)
- [O9] Given the fixture, when next steps are computed, then each lift's `repsAtTop of target
  at lever` equals `brief-data.json → lifts.<id>.nextStep`, and only Seated biceps curls is
  ready, suggesting 15 kg. (level: unit)
- [O10] Given the fixture, when steps climbed are counted, then 12 of 14 lifts climbed since
  Fri 18 Sep, all but DB bench press and Push-ups. (level: unit)
- [O11] Given the fixture, when the home's copy is generated, then the verdict sentence, the
  count row (`▲ 11 moving · ■ 2 stalled · ▼ 1 slipping · ↑ 1 ready`), the climbed clause, each
  attention card's sentence, suggestion and `Why?` text (the rule, the 4 Sessions' top sets, and
  the bar to clear, e.g. `A record needs 13 kg × 10`) contain only engine values, and the
  attention list is ordered slipping, then stalled by longest stall, then ready. The sparse
  fixtures yield the expectation list and the starting points, with no delta anywhere. A
  slipping card quotes the note of the first slipping Session when it has one ("after
  'Right elbow sore…'"). (level: unit)
- [O12] Given the fixture, when weeks are computed, then the Sessions per week are `3 3 3 3 3 3
  3 0 3 3 3 3 1 3 3 3 2`, this week is 2 of 3 so far, the last 4 full weeks 10 of 12, and a
  Session at Sunday 23:30 and one at Monday 00:10 fall in different weeks. (level: unit)
- [O13] Given the fixture, when muscle sets are computed, then per-week values equal
  `brief-data.json → weeks[].muscleSets`, planned per week equals `plannedMuscleSetsPerWeek`,
  the 2-week window equals `muscleSetsAvgLast2FullWeeks` (28 Sep – 11 Oct), and warm-ups
  never count. (level: unit)
- [O14] Given Thu 15 Oct, when this week's muscles are computed, then each of the 12 has done so
  far and still planned (Workout B owed): Lats 12.5 + 12.5, Mid back 8.5 + 8.5, Chest 7 + 0.
  (level: unit)
- [O15] Given a muscle and a window, when its contributors are listed, then each lift appears
  with its exact fractional sets from working sets only, summing to the muscle's total; and
  `contributors()` in `src/domain/muscles.ts` (the region panel) no longer counts warm-ups:
  Workout B Mon 12 Oct's upper-back panel rows sum to its header. (level: unit)
- [O16] Given the fixture, when Back squat's ladder is built over All, then its treads are 50,
  52.5, 55, 57.5, 60 and 62.5 kg in date order, the deload Sessions are off-tread points, the
  week of 10 Aug is a gap labelled `No sessions` and the week of 14 Sep `No A session`, and each
  Session has a reps-at-top bar with its tread's target. Assisted pull-ups' treads run BW−27 →
  BW−19 upward; Hyper-extension is one series, a BW tread then a BW+5 tread. (level: unit)
- [O17] Given a lift, when a range is chosen, then `Step` holds the current tread and the two
  before it, and `3M`, `1Y`, `All` cut by date: Back squat 3M holds 18 Sessions, 2 of them
  deload. (level: unit)
- [O18] Given Wed 14 Oct and the last Workout A (Fri 9 Oct), when its moves are written, then
  each lift's move matches `brief.md` §1.3.8's lever column in words (`Stepped up to 62.5 kg ·
  +2.5 kg · record`; `Held 13 kg · 33 of 40 · stalled 10 sessions`; `Fewer reps · 44 vs 47`;
  `Same` for Lateral raises), `Next time` names Back squat `15 of 20 reps at 62.5 kg` and that
  Seated biceps curls is ready for 15 kg, and the volume line reads `4,185 kg · down 10 % on Fri
  9 Oct`. (level: unit)

**Charts**
- [O19] Given a lift's ladder, when it renders, then treads are a step line with a dot per
  Session, deload Sessions are hollow dots off the line in a hatched band labelled `Deload`, gaps
  break the line with their labels, rep bars start at zero with the target tick per tread, the
  x axis is the calendar, and the assisted axis reads `assistance · less is better` with `BW−n`
  ticks. A scrub (pointer or arrow keys) snaps to the nearest Session and the readout docked
  above the tab bar lists its working sets, its record, its e1RM (`estimated`, e1RM lifts only)
  and its warm-ups as `not counted`; it stays after release. A mini variant (48 px) draws the
  treads only. (level: surface web-ui)

**Progress tab**
- [O20] Given the fixture at Thu 15 Oct 18:05, when Progress opens, then above the fold are the
  verdict sentence, the count row, the climbed clause and the first two attention cards (each:
  sentence, mini ladder, suggestion, `Why?` expanding in place); below follow the adherence tile
  (`2 of 3 this week`, Mon–Sun strip whose done days open their Session), the muscles finding
  (opens Muscles), the collapsed `11 lifts moving ›`, and `All 14 lifts ›`. With 0 Sessions the
  page is the expectation list and one Start button; with 1, the starting points with each
  unlogged lift's prescription in the value column; with 3, `Too early to call` and no delta.
  (level: surface web-ui; reference: verdict-feed S1, S1b, S7a–c, progression-ladder S1 line,
  training-week S1 strip)
- [O21] Given a lift, when its page opens, then it shows the verdict banner, the latest top set
  as the hero, the ladder (default `Step`), presets `Step · 3M · 1Y · All` under the chart in
  thumb reach (≥ 44 px), `Next: 15 of 20 reps at 62.5 kg`, the e1RM line (e1RM lifts only), the
  bests table (O7), `Warm-ups … not counted`, and for a stalled lift a stall bracket and `Last
  moved: Fri 7 Aug ›` opening that Session. A `4 weeks ago` toggle draws a reference tick at that
  date's top set and reads `13 × 9 → 13 × 9 · no change`. (level: surface web-ui; reference:
  progression-ladder S2, S3, S3b, S8a, S8b, S8d; verdict-feed S8c)
- [O22] Given the fixture, when Muscles opens, then 12 bullet rows (done bar, plan tick, muted
  10–20 band) sorted by distance below the range show the 2-week window (`28 Sep – 11 Oct`)
  under the sentence `On plan for 2 weeks…`; `This week` adds the still-planned segment; a row
  opens its contributors with the arithmetic (`Lats 18.75 = Assisted pull-ups 6 · Machine row 6
  · Narrow-grip pull-down 4.5 · Deadlift 2.25`); the body map is an index that jumps to a row.
  (level: surface web-ui; reference: training-week S4)
- [O23] Given the app, when it starts, then the tabs are Train · Progress · Sessions · Program;
  Progress → a lift → a Session is two taps and Back returns each step. (level: surface web-ui)

**Train, Sessions, summary, live, Program**
- [O24] Given the fixture, when Train opens, then the due workout card lists each of its lifts'
  next step (`Deadlift 14 of 20 at 70 kg` … `Seated biceps curls 36 of 36 → try 15 kg`), the
  estimate uses the median of that workout's last logged durations when 3 or more exist, and the
  KPI tiles, Muscle week and Lifts sparklines are gone. (level: surface web-ui; reference:
  progression-ladder S1b)
- [O25] Given the fixture, when Sessions opens, then each row's record count is O6's (Wed 14 Oct
  `4 records`), the muscle table has 12 rows with Lats and Mid back apart over R-K weeks, the
  volume chart compares A with A and B with B, and a route naming a Session opens its summary.
  (level: integration)
- [O26] Given Wed 14 Oct just finished, when the summary opens, then it reads "What Wed did for
  your week" with `2 of 3 sessions · 47 of 69 sets`, the duration never overlaps another figure
  (`1 h 11 min` fits), each lift's move in words (O18) beside its top set, the 4 records, `Next
  time`, Worked today in 12 muscles, `2 warm-ups not counted`, volume as a last quiet line, and a
  `Deload session` switch that marks the Session (O3). (level: surface web-ui; reference:
  progression-ladder S6, training-week S6 header)
- [O27] Given a live Workout A replaying Wed 14 Oct, when its last Set is logged, then the live
  strip reads `PRs 4`; a PR toast fires only when a Set changes the lift's record for the
  Session (named by its R-R kind), never on a rep drop after a weight bump; the set projection
  uses R-E. (level: integration)
- [O28] Given the Program tab, when "This week" shows, then it uses R-K weeks, not a rolling 7
  days. (level: integration)
- [O29] Given the app, then `Stats.tsx`, `HistoryStatsSwitch`, `ProgressionBar`, `HistoryList`,
  `HistoryFeature`, `LiftsScreen` and the old record, series, lift-trend and region-week modules
  are no longer in the bundle, and each of their test titles is kept with a body asserting where
  that stat now lives. (level: unit)

29 outcomes. Capabilities with a surface outcome: render harness (O2), ladder (O19), Progress
home (O20), lift page (O21), Muscles (O22), shell (O23), Train (O24), summary (O26).

## Design
- **Engine** `src/domain/stats/`, pure, importing only `src/domain/**` and `src/types.ts`:
  `liftHistory.ts` (R-W, R-L, R-T, R-E), `records.ts` (R-R, R-B, the record count),
  `verdict.ts` (R-V, R-N, R-S), `weeks.ts` (R-K, R-A, the day strip), `muscles.ts` (R-M,
  contributors), `ladder.ts` (treads, gaps, ranges, compare), `moves.ts` (session moves, Next
  time) and `copy.ts` (every sentence). Inputs: Sessions, Programs, a `Resolve` that already
  applied Bodyweight, the library, and `now`. No call site re-derives a rule.
- **Deload**: `Session.deload?: true`; `SessionService.setDeload(id, on)` like `setNote`
  (one write, `updatedAt`, `sessions` topic). Backup `schemaVersion` stays 1.
- **Progress tab**: a screen group `src/features/progress/` that loads once and pushes pages
  (home, all lifts, lift, muscles); pages take loaded data as props. Sessions open through an
  `AppRoute` `{ tab: 'history', sessionId }` into the Sessions tab's summary.
- **Charts**: `src/ui/charts/Ladder.tsx` (full and mini) and its docked readout; tokens only:
  current tread and selection `--color-primary`, attention (stalled, slipping, under plan)
  `--color-warn`, bars `--chart-b`, done `--heat-2`, still planned `--heat-0` outlined, deload
  hatch from `--color-hairline`/`--color-control`.
- **Errors and empty**: an unresolvable Exercise is skipped by every engine function, as today;
  a lift with no Plan in the active Program has no next step and no target tick; zero Sessions
  never draws an axis.

## Hybrid conflicts and how this draft resolves them (`reviews/cross-concept.md` §4)
1. **IA: VF's Progress tab vs PL's no stats tab.** A Progress tab. The ladder is the lift page,
   reached from Progress (and its cards, list and Train's next-up rows lead there too).
2. **Visual stance (VF white + serif, PL condensed numerals, TW dark).** None of them: the
   shipped Progress Dashboard tokens and Geist stay; the mocks give structure only. No serif
   (ruling 9 already bans it on numbers).
3. **Headline metric (verdict count vs steps climbed).** The verdict sentence leads; "12 of 14
   lifts climbed a step since Fri 18 Sep" is its supporting clause, one line under it.
4. **Change baseline (LL range baseline vs verdict window).** Ruling 11: a delta beside a
   verdict uses the verdict's window; range-baseline changes appear only on the lift page's
   compare readout.
5. **TW hero vs VF hero.** Progress first; adherence is a small tile below the fold with the
   day strip, whose days open Sessions (TW's 1-tap route to a summary).
6. **Compare (VF then-vs-now tick vs PL two-handle span).** The tick (one tap, one-handed);
   the span is dropped.
7. **Scrub readout (VF sticky card above the chart vs PL dock above the tab bar).** PL's dock,
   in thumb reach, persisting after release. This departs from 0006's "no pointer tooltips".
8. **Range presets (VF `1M · 3M · 1Y · All` vs PL `Step · 3M · 1Y · All`).** PL's, default
   `Step`, placed under the chart (ruling 4).
9. **Records home (VF Records page vs PL dossier).** Records live on the lift page (bests
   table) and in the summary; a separate Records page is not built. Total counts are never
   shown (`brief.md` §1.3.6).
10. **Where the session summary is reached.** From the day strip (1 tap) and from Sessions; VF's
    `Records · 4 records yesterday` route is dropped.

## Audit bugs this epic fixes (each owned by an outcome)
| Audit item | Outcome |
|---|---|
| Warm-ups counted in the region panel (`contributors()`) | O15 |
| Lats and Mid back merged on Sessions (`toRegionCounts` → `upper-back`) | O13, O25 |
| Record inflation: 446 records, rep drop counted, one set three records | O5 |
| Live strip and summary count PRs differently | O6, O26, O27 |
| Session-indexed time axes hide gaps and deloads | O16, O19 |
| e1RM drops on PR days drawn as a downturn; e1RM as lead line | O16, O19, O21 (R-E) |
| Hyper-extension history wiped by one BW+5 Session; push-ups as total reps | O16 |
| Assisted plotted as negative kg, ASCII hyphen, stale reps record | O7, O16, O19 |
| Three or four week definitions; partial vs full week with no pace | O12, O14, O28 |
| Summary duration KPI overlaps Volume | O26 |
| Unmounted `Stats.tsx`, `HistoryStatsSwitch`, `ProgressionBar` (and `HistoryList`, `HistoryFeature`) | O29 |
| Dashboard plateau invisible; sparklines min–max normalised | O20, O24 |
| A/B volume chart mixes workouts | O25 |
| `~53 min` estimate ignores logged durations | O24 |
| Record points told apart by colour only | O19 (glyph + word, hollow/filled) |

Not fixed here, recorded for later: body mass is not stored (kg volume excludes bodyweight
work); Program kg column shows a back-off weight for ramped lifts; Set screen ramp presets.

## Decisions taken without the operator
`/spec` may revisit any of these.
1. **Tabs become Train · Progress · Sessions · Program.** Dashboard is renamed Train and keeps
   only the due workout with next steps; Lifts becomes Progress. Sessions stays a tab rather
   than VF's pushed page, so the calendar keeps a home.
2. **Deload is an explicit mark** (`Session.deload`), set from the summary's switch, never
   inferred. Inference would turn a bad week into a "deload" and hide a real slip.
3. **Gap labels are `No sessions` / `No <workout> session`.** The app cannot know "Holiday" or
   "Sick week"; a Session note near the gap may be quoted instead.
4. **No weekday schedule.** "Workout B due Fri" becomes "1 more this week · Workout B next".
5. **Steps-climbed window = the 28 days ending today**, which reproduces the brief's Fri 18 Sep.
6. **Attention order:** slipping, then stalled by longest stall, then ready. The verdict
   sentence names the first two.
7. **e1RM eligibility is derived** (not Bodyweight, Plan top rep ≤ 10), not a list of ids.
8. **No new tokens.** Attention uses `--color-warn`; bullets use the heat ramp. The token test
   keeps its 52.
9. **Records page and record totals are not built**; bests per lift and per Session only.
10. **Compare = the `4 weeks ago` tick**; the two-handle span is not built.
11. **Library search leaves the stats tab.** All lifts lists every logged Exercise (program
    order, then the rest); an Exercise never logged has no stats to show.
12. **Unmounted code is deleted**, keeping every removed test title with a body asserting where
    the stat now lives (the weakened-tests gate has no rule for TypeScript deletions; see
    Risks).
13. **Session notes are surfaced** on the ladder readout and in a slipping card's sentence.
14. **Muscle window default is 2 weeks**, with `This week` as the only other choice; 4 weeks is
    dropped (it always includes a deload here and needs a caveat).
15. **The decision record** supersedes 0006's stats placement and no-tooltip rule, 0013's "a
    PR is what `recordsFor` changes", and the redesign's tab set; see `decision-draft.md`.

## Risks and unknowns
- **The verdict engine is the risk** (`reviews/cross-concept.md` §5): every mock had a false
  sentence. Mitigation: O4–O18 against `expected.json` before any UI, and copy only from
  `copy.ts`.
- **`brief-data.json` comes from a Python model of the rules.** Where it and these rules
  disagree, `/spec` must pick one before tests are written; known soft spots: `alsoBeat`,
  Rep record ties, the slipping window when fewer than 6 Sessions exist.
- **Test removals.** Retiring screens and old modules removes tests; the installed
  `weakened-tests.sh` flags any removed title and PAD 0.4's `code-deleted` rule reads only
  Python imports. Either the operator adds a TypeScript `code-deleted` rule, or O29's "keep the
  title, new body" path is used; never an override.
- **Time zones.** Weeks are local; fixture Sessions start around 18:00, but tests must pin a
  zone or build dates locally so a CI zone cannot move a Session across midnight.
- **Visual references** come from four stances; the evaluator judges structure, order and
  content against the crops, not colour or type.
- **Rendering** needs a seeded IndexedDB; O2's script is what makes per-screen evaluation
  possible, so it lands first.
