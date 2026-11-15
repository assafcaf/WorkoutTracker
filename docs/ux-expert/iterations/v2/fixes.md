# UX review iteration 2: fixes and after-evidence

Checked against the Vite dev server with `scripts/ux-review/shoot.mjs` (headless Edge via
`PW_CHANNEL=msedge`, touch on), data `scripts/render-states/stats-45.json` (clock pinned to
Thu 15 Oct 2026), 390 × 844 unless stated. After shots use the before shot's file name
(`shots/` → `after/`). Side-by-side composites are in `compare/`.

## Results

| Verdict | What changed | Acceptance check | Before | After |
|---|---|---|---|---|
| V2-01 | The done state's one primary is "Next: <Exercise>" (358 × 64, accent); "Add set" is a quiet text button; "Finish exercise" and the Dials are gone from the done state. It opens the next unfinished Exercise on Now with the Rest still running ("All exercises" when none is left). | **Met.** One tap shows "Assisted pull-ups · Set 1 of 4" on Now with 2:57 still counting. | [56](shots/56-next-exercise.png), [61](shots/61-after-finish-exercise.png) | [56](after/56-next-exercise.png), [61](after/61-after-finish-exercise.png) |
| V2-03 | Now no longer renders the up-next rows (All keeps them); a spacer drops the Dials to just above the Action bar. | **Met.** 0 up-next rows, 6 tap targets besides the Dials, weight Dial centre y 607 (≥ 420). | [50](shots/50-now-deadlift.png) | [50](after/50-now-deadlift.png) |
| V2-02 | A Get ready card replaces the folded Next line during Rest: "Set 2", "70 kg × 7" at 28 px, "Add 5 per side → 20 + 5", "Last time 70 × 7 · PR at 8 reps", and Change. "Use 3:50" joins the countdown row. Short screens get a compact layout. | **Met** at 390 × 844 and 320 × 568: the card is fully visible and `elementFromPoint` hits it, not `.rest-clock`. Closes V1-10. | [51](shots/51-rest.png), [70](shots/70-320-rest.png) | [51](after/51-rest.png), [70](after/70-320-rest.png) |
| V2-04 | "e1RM 80.0 · record 90.0 · no PR at this load" is replaced by "PR at N reps" (fewest reps at the Dial weight that set a Record; Record rules unchanged), "PR if logged" once reached, or nothing. | **Met.** 65 × 7 reads "PR at 10 reps", 65 × 10 "PR if logged"; no "e1RM" or "no PR" on Now. | [54](shots/54-pr-projection.png) | [54](after/54-pr-projection.png), [54b](after/54b-pr-if-logged.png) |
| V2-11 | After an Exercise's last Set a verdict card reads e.g. "Deadlift done · more reps · 15 vs 14 · 1 PR" (summary wording, via `src/domain/exerciseVerdict.ts`); the header sub-line adds "· 1 PR". | **Met.** | [55](shots/55-pr-moment.png), [56](shots/56-next-exercise.png) | [55](after/55-pr-moment.png), [56](after/56-next-exercise.png) |
| V2-05 | Train rows read "3 × 60 kg · 8–10" (the Set 1 Preset via `presetForSet`) with "↑ step up · try 15 kg" on ready lifts; the heading, estimate line, legend and 7 bars are gone; the week strip moved here from Progress. | **Met, one number differs:** Deadlift reads 3 × **60** kg, not the check's 70: Set 1 really opens at 60 × 10; 70 was the old bar's step weight. "Workout B" appears twice, "2 of 3" at y 117, Start fully visible. | [01](shots/01-train-seeded.png) | [01](after/01-train-seeded.png) |
| V2-08 | Progress verdict cards are 3 lines (name and status; value vs comparison with sparkline; action and Why?); the sentence became the accessible description. "11 lifts moving" merged into "All 14 lifts" with a status filter. | **Met.** Cards 94 px; 4 cards on the first screen; one lifts row. | [10](shots/10-progress.png), [10b](shots/10b-progress-full.png) | [10](after/10-progress.png), [10b](after/10b-progress-full.png), [12](after/12-progress-moving.png) |
| V2-15 | The first-run footnote that promised content is gone. | **Met.** | [02](shots/02-first-run.png) | [02](after/02-first-run.png) |
| V2-10 | Summary dock is Share… + Done (only accent); Apple Health lives in the Share sheet; a "Best today" line; Deload switch moved to the Session editor, Health setup to Settings › Apple Health; no "down %" on a short Session. | **Met.** 2 dock buttons, 0 switches, volume "1,580 kg" without "down 77 %". | [60b](shots/60b-summary-full.png) | [60b](after/60b-summary-full.png), [60c](after/60c-summary-share-sheet.png), [60d](after/60d-summary-past-session.png), [40](after/40-settings-apple-health.png) |
| V2-07 | Sessions opens on one row of week totals, then the list; the calendar, matrix and volume charts are gone; tag reads "4 PRs". Supersedes V1-23. | **Met.** First row y 131–195, 9 rows on the first screen (was y≈1,300). | [20](shots/20-sessions.png), [20b](shots/20b-sessions-full.png) | [20](after/20-sessions.png), [20b](after/20b-sessions-full.png) |
| V2-06 | One muscle home: the summary keeps one grid, Program loses "This week", Progress › Muscles gains This week / 2 weeks / 4 weeks (the 4-week matrix moved from Sessions). Folds in V1-25. | **Met.** Per-muscle counts only on Muscles, Program (planned) and the summary. | [11](shots/11-progress-muscles.png), [30](shots/30-program-full.png) | [11](after/11-progress-muscles.png), [11b](after/11b-progress-muscles-4weeks.png), [30](after/30-program-full.png) |
| V2-13 | One set of muscle names (`src/domain/muscleLabels.ts`: Quads, Mid back, Abs). | **Met.** No "Middle back", "Quadriceps" or "Abdominals" on Program, Muscles or the summary. | | |
| V2-12 | All 58 `line-height: Npx` under `src/**/*.css` are now rem. | **Met.** At root 200 % the Set screen and Train no longer overprint. | [72](shots/72-200pct-set.png), [73](shots/73-200pct-train.png) | [72](after/72-200pct-set.png), [73](after/73-200pct-train.png) |
| V1-13 | The bar names the Set kind: "Log set 2 · 70 × 8+ · AMRAP" (also "· drop", "· failure"). | **Met.** | | [38](after/38-amrap-on-dials.png) |
| V1-15 | The Exercise note shows as one line under the Set counter; a tap edits it. | **Partly.** The old "weight Dial top ≤ 360" check conflicts with V2-03 (Dials now at the bottom on purpose); the reviewer should restate it. | | [53](after/53-back-squat-note.png) |
| V1-24 | The Session editor scrolls to the top when it opens. | **Met.** From a list scrolled to 2,831 px, scrollY is 0 and the heading at y 50. | [21](shots/21-session-editor.png) | [21](after/21-session-editor.png) |

Outside the verdicts (operator requests): the installed app now checks for a new version on
launch, on every return to the foreground and hourly, and shows "Sign in to update" when the
Access login turns that check away (`/sw.js` is behind Access).

**Tests:** full suite via `.claude/workflow/bin/vitest-gate.sh` before the last audit fixes:
4293 passed, 4 failed (architecture and control audits); those 4 were fixed and their files
re-run green (18 files, 553 tests). Typecheck clean.

## Carried to iteration 3

Not addressed in iteration 2:
- V2-09 Settings regroup (Workout · Reminders · Data & sync; Active program and Compare volume out; equipment to Program › Exercises).
- V2-14 Swap list buttons all named "Do this instead".
- V1-12 Warm-ups numbered as working Sets; V1-14 Set kinds and RIR unexplained; V1-16 Exercise tools sheet still has Step and Bodyweight exercise; V1-17 Swap has no Undo; V1-19 All-list upcoming cells 1.63:1; V1-20 reflow at 200 % zoom; V1-28 Program editor grid targets; V1-30 last backup not stated; V1-31 Lift chart labels overlap; V1-32 "Over rest" in danger red.

Observed in this pass, for the reviewer to judge:
- The done state still leaves empty space between the verdict card and the Rest panel, and its verdict wording ("more reps · 15 vs 14") is terse.
- The Train week strip cannot be tapped (it could on Progress).
- At root 200 % the live header's title sits tight against the top edge.
- Operator direction for iteration 3 (in `persona.md`): start with the live Session view, mine all four redesign concepts, cut crowding, and justify every element from the trainee's side; the landing view is called out.
