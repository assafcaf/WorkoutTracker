# UX review iteration 3: fixes and after-evidence

Checked against the Vite dev server with `scripts/ux-review/shoot.mjs` (headless Edge via
`PW_CHANNEL=msedge`, touch on), data `scripts/render-states/stats-45.json` (clock pinned to
Thu 15 Oct 2026), 390 × 844 unless stated. After shots reuse the before shot's file name
(`shots/` → `after/`); side-by-side composites (before left, after right) are in `compare/`.

## Results

| Verdict | What changed | Acceptance check | Compare |
|---|---|---|---|
| V3-04 | The Rest dock is one row; the rest body scrolls above the sticky dock at large text and short screens. | **Met with one scroll** at root 200 % and at 320 × 568: the plate line and Last time line hit the card, not `.rest-clock`. Without scrolling, at 200 % the card still shows only its first two lines. | [76](compare/76-200pct-rest.png), [72](compare/72-320-rest.png) |
| V3-01 | Logging an Exercise's last Set opens the next unfinished one, Rest still running; one line above the Get ready card reads "Deadlift done · same as last time · 60 × 10, 70 × 7, 70 × 7 · Add set". "Next:" and the separate "+ Add set" are gone. After the last Exercise the primary reads "Finish workout". | **Met.** Bar "Log set 1 · BW−19 × 6" with no extra tap. | [56](compare/56-next-exercise.png) |
| V3-03 | Countdown, −15 s, +15 s, Skip in one 80 px row (countdown 64 px, 56 px at 320). "Use 3:50" moved to ⋯ › Rest time ("usually 3:50 · Use"). Effort row reads "Reps left on set N", chips 0 1 2 3+; logged cells say "2 left". Closes V1-14. | **Met.** 14 tap targets, card-to-dock gap 29 px, no visible "RIR". | [51](compare/51-rest.png) |
| V3-05 | Warm-ups share one `W n/N` cell; bar, counter and card say "warm-up n"; no effort row after a Warm-up. Supersedes V1-12. | **Met.** Cells W, 1, 2, 3; "Log warm-up 2 · 40 × 3", then "Log set 1 · 60 × 10". | [73](compare/73-warmup.png), [73b](compare/73b-warmup-rest.png) |
| V3-06 | Set cells share the row width and wrap at "×". | **Met** at 390 and 320 (scrollWidth ≤ clientWidth). | [56](compare/56-next-exercise.png) |
| V3-02 | `honestMoveText` names the numbers; a partial lift reads "1 of 3 sets" with no "vs". Used live and in the summary's Lift by lift. | **Met** (unit-tested; live shot above). | [56](compare/56-next-exercise.png) |
| V3-09 | The colour-coded 6-week calendar is back at the top of Sessions (262 px card, "Last 6 weeks · 15 sessions", A/B cells, today outlined, per-week screen-reader summary), replacing the number row. Train's week strip is the same cells for this week and opens Sessions. No legend, matrix or volume charts. | **Met.** 5 Session rows visible below it. | [20](compare/20-sessions.png), [01](compare/01-train-seeded.png) |
| V3-08 | Train's h1 is the due Workout, sub-line "Thu 15 Oct · last done Mon 12 Oct"; sync state lives in the cloud button's name (red dot when sync failed); dock "~66 min · Change" over Start. | **Met.** First row y 145, Start fully visible. | [01](compare/01-train-seeded.png) |
| V3-10 | At 200 % Train rows stack name over preset; tab labels step down and never overlap; header icons in rem. Session rows on Sessions wrap too. | **Met.** | [74](compare/74-200pct-train.png) |
| V3-11 | Progress opens on one lead line; counter row and stepped-up line gone. | **Met.** First card y 114. | [10](compare/10-progress.png) |
| V3-12 | Progress home Muscles row uses the Muscles page's muscles and rule: "Shoulders 21 above · Abs 3 below · Calves 8 below". | **Met.** No "Traps" or "Abdominals". | [10b](compare/10b-progress-full.png) |
| V2-09 | Settings is Workout · Reminders · Data & sync (+ Apple Health): 2,710 → 1,186 px, 49 → 37 controls. Active program removed (Program › Programs picks it); Compare volume removed (a stored baseline still applies); equipment switches moved to Program › Exercises as "My gym's equipment"; "Last backup" line added. V1-30: no gear dot on an empty install. | **Met.** | [40](compare/40-settings-full.png) |

## Tests

Full suite via `.claude/workflow/bin/vitest-gate.sh`: **236 files, 4,323 tests passed** (baseline
before this iteration: 236 files, 4,297). The first full run had 3 reds in `App.test.tsx` E6-T1: under
load the test clicked Add set on Deadlift's brief done state before the hand-over to the next
Exercise loaded; the tests now wait for the hand-over. Typecheck and eslint clean. No existing test title was renamed or deleted; bodies were rewritten for the new
behaviour and new tests added.

## Carried to iteration 4

From the report: V3-07 (Now | All segment → header button), V3-13 (summary Worked today grid),
V2-14, V1-15, V1-16, V1-17, V1-19, V1-20, V1-28, V1-31, V1-32.

Observed in this pass, for the reviewer to judge:
- Rest has a ~150 px empty band between the cells and the effort row now that the card is
  anchored to the dock (`after/51`). The expert accepted flexible space there; check it still reads
  as calm rather than broken.
- At 200 % the Get ready card needs a scroll to show the plates (V3-04 is met only "with one scroll").
- After auto-advance the effort row says "Reps left on set 3" above Assisted pull-ups' cells: it is
  about Deadlift's last Set but sits under the new Exercise's name.
- The Warm-up ramp line ("Warm-up 2 of 3 · 40 kg × 3") repeats the card; the Warm-up card's "Last
  time 60 × 10" refers to the working Set.
- Between logging an Exercise's last Set and the hand-over, the old Exercise's done state shows for
  the length of one IndexedDB read (milliseconds); render the hand-over without that flash.
- A finished Exercise reopened from All still shows a done state with "Go to <next>".
- Bar and plates opens in place inside Settings rather than as its own page.
- Operator ruling (2026-11-15): a heavy first Set raising later Sets' Presets (decision 0020) is
  intended; don't flag it again.
