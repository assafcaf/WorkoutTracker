# 0017. Stats are verdicts from tested rules: one record per lift per Session, ladders on a calendar axis, muscles against the plan, in a Progress tab

Date: 2026-10-15 · Status: accepted · Tracker: E18 · Supersedes in part: 0006, 0013, the 2026-10 redesign's tab set

## Context
The stats audit (`docs/design/stats-2026-10/research/audit.md`) found wrong numbers, not just
weak charts: warm-ups in the region panel, Lats and Mid back merged on one tab, 446 records in
45 Sessions, two PR counts, index-spaced time axes, e1RM dipping on PR days, a hyper-extension
history wiped by one loaded Session, and stats screens no longer mounted. The research run
compared four concepts and recommended a hybrid built on Verdict Feed
(`docs/design/stats-2026-10/reviews/cross-concept.md` §5). The full rules are in
`docs/design/stats-2026-10/spec-draft.md`, which served as this epic's scope.

## Decision
- **The rules are pure functions in `src/domain/stats/`**, tested against the brief's fixture
  (`src/test/fixtures/stats/`, built from `brief-data.json`) before any screen uses them; every
  number or date in generated copy comes from `copy.ts`. Working sets exclude warm-ups; drop
  sets never set records or top sets.
- **One record per lift per Session**, first match wins: Heaviest weight (Least assistance,
  First added load) > Rep record at a lever already lifted > Estimated 1RM (+0.5 kg, e1RM lifts
  only). No record at a lift's baseline or in a deload. One count for the live strip, the
  summary and the Sessions rows. This replaces 0013's "a PR is what `recordsFor` changes".
- **e1RM** (Epley, 0006) only for lifts that are not Bodyweight and whose Plan's top rep is ≤ 10,
  only from sets of ≤ 10 reps, always "estimated", never the headline.
- **Verdicts**: too new (< 4 non-deload Sessions), slipping (last 2 below the best top set of
  the 4 before), stalled (no record in the last 4), moving; deloads skipped.
- **Deload is an explicit optional field**, `Session.deload: true`, set by the trainee.
- **One week**: Monday to Sunday, local, by `startedAt`, everywhere.
- **Muscles**: 12 muscles, Lats and Mid back separate, against planned sets, over the last 2
  full weeks; this week shows done plus still planned.
- **Progress tab** replaces the History | Stats switch (0006) and the Lifts tab: tabs are
  Train · Progress · Sessions · Program. The lift page is a ladder (working weight as treads
  over reps-to-target bars) on a calendar axis with labelled gaps and hollow deload dots, and a
  scrub readout docked above the tab bar (replacing 0006's "no pointer tooltips").
- The app still suggests and never edits (0006). No new tokens: the Progress Dashboard palette stays.

## Alternatives rejected
- **No stats tab (Progression Ladder whole):** two taps to today's summary, and word-sized
  minis on the landing.
- **Training Week's adherence-first hero and dark stance:** adherence is a tile, progress leads.
- **Inferring deloads from lighter weights:** a bad week would be excused as a deload.
- **Keeping e1RM as the lead line:** it reads a heavier, fewer-rep day as a loss.
- **Every record kind per Session:** the 446-record inflation.

## Consequences
- A wrong rule now prints as a sentence, so the engine's tests are the protected oracle.
- Records counted before this change disagree with the new count; nothing stored changes.

## Outcome
Built in run E18 (2026-10-15) on `epic/E18-stats-verdicts`, 20 tickets, without `/spec` or
`/tickets` on the operator's word: the draft spec was the scope and the orchestrator picked the
hybrid above. Final gates at `66e1ab8`: 165 test files, 3126 tests, lint, typecheck and surfaces
green.

Departures from the draft, and why:
- **Train has no weekday**: its due card reads "Workout B next · 1 more this week" instead of
  the mock's "Fri · due tomorrow" (decision 4: a Program has no days).
- **Back from a Session summary opened from Progress returns to the Sessions list**, not the
  lift page (O23 partly met): the shell remounts tabs and has no cross-tab history stack.
- **The old `records`, `series`, `lifts`, `dashboard` and `sessionsView` modules stay**: live
  code (summary, live strip, charts, Sessions, Program) still imports them. Only the unmounted
  screens (`Stats`, `HistoryStatsSwitch`, `ProgressionBar`, `HistoryList`, `features/history`,
  `features/lifts`) were deleted, every test title kept in `src/stats-retired.test.ts`.
- **The ladder chart draws a view model it owns** (`src/ui/charts/ladderView.ts`); the lift
  page maps the engine's ladder onto it, so the chart could be built before the engine landed.
- **The render command** (`scripts/render-route.sh`) now takes a tab by label plus taps by
  visible text, and stats states pin `now` (`scripts/render-states/stats-*.json`).
