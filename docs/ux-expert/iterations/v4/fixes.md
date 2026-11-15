# UX review iteration 4: fixes and after-evidence

Checked against this worktree's Vite dev server (127.0.0.1:5174) with `scripts/ux-review/shoot.mjs`
(headless Edge, touch on), data `scripts/render-states/stats-45.json` (clock pinned to Thu 15 Oct 2026),
390 × 844 unless stated. After shots reuse the before shot's file name (`shots/` → `after/`);
side-by-side composites (before left, after right) are in `compare/`.

## Results

| Verdict | What changed | Acceptance check | Compare |
|---|---|---|---|
| V4-01 | Rest has one "Just done" block above the dock: heading for the Set it is about, one comparison sentence (`setComparison` / `exerciseDoneLine` in `exerciseVerdict.ts`), the PR for the whole Rest, and the effort chips. The Get ready card sits under the cells. The PR toast is gone from the live Session. Hand-over variant: "DEADLIFT DONE · 1 PR · Add set", "Set 3 reps left?". | **Met.** Set 1 "Same as Mon 12 Oct"; Set 2 "PR · Rep record · +1 rep on Mon 12 Oct"; Finish hit-tests as Finish at +2.5 s; no `\d+ vs \d+`; card 16 px under the cells; plate line on screen without scroll at root 200 % and at 320 × 568. Persistence through the whole Rest is unit-tested (120 s advance). | [51](compare/51-rest.png), [54](compare/54-pr-moment.png), [56](compare/56-next-exercise.png), [76](compare/76-200pct-rest.png), [72](compare/72-320-rest.png) |
| V4-02 | One live line under the reps Dial: "Last time 70 × 7 · same · PR at 8 reps" → "+1 rep · PR if logged" on one tap. Upper "Last time" line removed. | **Met.** "Last time" once on Now; line 8 px under the Dial; wraps at 320 and 200 %. | [53](compare/53-pr-target.png), [50](compare/50-now-deadlift.png) |
| V4-04 | PR felt beat: 1.2 s accent-tint flash on the PR cell, `playPrSound()` two rising tones on the rest beep's audio context; no flash under reduced motion. | **Met.** Tint at +0.3 s, back by +1.5 s; spy called once, never on a non-PR Set; reduced motion → animation none, PR tag present. Sound not heard (headless). | [54b](compare/54b-pr-after-toast.png) |
| V3-07 | Now \| All segment replaced by one header button (list icon, "All exercises" / "Now"). | **Met.** Exercise name's top y 115 → 70. | [50](compare/50-now-deadlift.png), [59](compare/59-all-view.png) |
| V4-06 | Unanswered effort chips stay on Now after Rest ends until answered or the next Set; "Rested m:ss · +0:11" in muted colour. Closes V1-32. | **Met.** No `--color-danger` on Now. | [57b](compare/57b-rest-over.png) |
| V4-05 | Warm-ups: ramp line removed; "Then set 1 · 60 × 10" replaces "Last time" on Now and the card. | **Met.** "Warm-up 2 of 3" twice, no "Last time". | [73](compare/73-warmup.png), [73b](compare/73b-warmup-rest.png) |
| V4-07 | Next Exercise is read ahead so the hand-over lands with the log; a finished Exercise reopened from All shows its cells, the done block and "Back to Assisted pull-ups · set 3". | **Met.** Frame sampling: 0 frames with "Go to"/"Back to" during the hand-over (test with MutationObserver). | [55](compare/55-handover-flash.png), [59b](compare/59b-reopen-finished.png) |
| V4-03 | Summary: headline is the one win; Lift by lift one sentence per lift (no "vs", no "record"); "vs Mon 12 Oct: volume …" or "5 of 23 sets"; Worked today one line of non-zero muscles; "This week n of N · next up Workout A"; "Next time" and "Best today" gone; Records only with 2+ PRs; "+1 reps" fixed. Closes V3-13. | **Met.** "70 kg × 8" once; no zeros or legend; dock Share… + Done. | [60](compare/60-summary.png), [60b](compare/60b-summary-full.png) |
| V4-08 | Program: Deload week switch removed; "Start a deload week" in the header ⋯ (Programs panel); while on, "Deload week · lighter Presets · End" under the title. | **Met.** Presets 60 → 55 kg etc. on Train while on, back on End. | [30](compare/30-program.png), `after/30b-program-deload-on.png` |
| V2-14 | Swap buttons named "Do <Alternative> instead". | **Met.** 11 distinct names. | [77](compare/77-swap-list.png) |
| V1-19 | Upcoming All cells' dashed border → `--color-muted`. | **Met.** 6.0:1 on the card, 5.6:1 on the page (was 1.6:1). | [59](compare/59-all-view.png) |
| V1-16 | **Partly.** "Use 3:50" folded into the Rest time row's sheet. Step and Bodyweight stay in the sheet: no other screen sets them for a built-in Exercise, so removing them would delete the feature. | Carry: give them a home in Program › Exercises first. | [58](compare/58-tools-sheet.png) |

## Tests

Full suite via `.claude/workflow/bin/vitest-gate.sh`: **237 files, 4,366 tests passed** (baseline:
236 files, 4,323). Typecheck clean; eslint 0 errors (11 pre-existing warnings). No existing test
title was renamed or deleted; bodies were rewritten for the new behaviour and new tests added.

## Carried to iteration 5

From the report: V1-17 (swap Undo on Now), V1-20 (195 × 422: reps Dial still partly under the bar,
y 330–394), V1-28 (Program editor field sizes), V1-31 (lift chart label overprint), V1-16 remainder.

Observed in this pass:
- At 320 × 568 during Rest, the Just done block's chips sit under the dock and need a scroll.
- The finish summary's comparison line reads "0 min" in the scripted run (fixture, not a bug).
- `Toast.tsx` is no longer used by the live Session; keep or remove.
- Summary's `liftLine` wording lives in `summaryLines.ts`; merge with `exerciseVerdict.ts`'s
  `setComparison` so there is one comparison sentence app-wide.
- Sessions rows' "n PRs" pill on every row (reviewer's minor note).
