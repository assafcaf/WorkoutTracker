# UX review iteration 1: fixes and after-evidence

Checked on branch `ux-expert-loop` (HEAD `6a433f1`) against a Vite dev server, driven with `scripts/ux-review/shoot.mjs` (headless Chromium, touch on). Data: `scripts/render-states/stats-45.json` with the clock pinned to Thu 15 Oct 2026, except the reload test (real clock) and first run (empty install). Viewport 390 × 844 DPR 1 unless stated; 320 × 568 and root font 200 % where the verdict asks. Measurements are in CSS px, read from the DOM.

After shots use the same file name as the before shot (`shots/`); extras are `15b`, `43b`, `43c` and `47b`. Side-by-side composites are in `compare/`.

## Results

| Verdict | What changed | Acceptance check result | Before | After |
|---|---|---|---|---|
| V1-01 | The live Session opens and resumes on Now. | **Met.** After Start, the weight Dial is on screen with 0 taps (readout at y 277). Reload 10 s into a 3:00 Rest shows **2:49** with no tap. | [04](shots/04-set-screen.png), [17](shots/17-after-reload.png) | [04](after/04-set-screen.png), [17](after/17-after-reload.png) |
| V1-02 | Each unlogged cell shows its own position's Preset. | **Met.** Workout A Back squat reads 47.5×10, 57.5×9, 62.5×8, 62.5×7. Deadlift reads 60×10, 70×7, 70×7, and cells 2–3 are unchanged after Set 1 is logged at its Preset. | [05](shots/05-set-now-deadlift.png), [12](shots/12-after-skip-rest.png), [53](shots/53-back-squat-note.png) | [05](after/05-set-now-deadlift.png), [12](after/12-after-skip-rest.png), [53](after/53-back-squat-note.png) |
| V1-03 | The Log set bar stays in the Action bar during Rest, and logging ends the Rest. | **Met.** During Rest, "Log set 2 · 70 × 7" is visible at 390 × 844 (y 768–832) and at 320 × 568 (y 492–556). One tap logs Set 2 and opens Set 3. The countdown is 64 px. | [11](shots/11-rest-next-expanded.png), [45](shots/45-320-rest.png) | [11](after/11-rest-next-expanded.png), [45](after/45-320-rest.png) |
| V1-04 | The readouts carry live values, and the bar uses its visible text as its name. | **Met.** The names are "Weight, 60 kg", "Reps, 10" and "Log set 1 · 60 × 10". After + on each Dial they read "Weight, 62.5 kg", "Reps, 11" and "Log set 1 · 62.5 × 11". | [05](shots/05-set-now-deadlift.png) | [05](after/05-set-now-deadlift.png) |
| V1-05 | The line "+20 kg: carried from set 1 (last 70)" sits under the Set title. | **Met.** After Set 1 is typed to 80 × 10, Set 2 opens at 90 × 7 and shows "+20 kg: carried from set 1 (last 70)" during Rest and after it. | [15](shots/15-pr-after-log.png) | [15](after/15-pr-after-log.png), [15b](after/15b-set2-carried-line.png) |
| V1-06 | Finish opens a "Finish workout?" Sheet while planned Sets remain. | **Met.** With 2 of 23 logged, the Sheet says "21 sets not logged", and Keep going returns to Set 3 of Deadlift. With 23 of 23 logged, one tap on Finish reaches the summary. | [43](shots/43-finish-no-confirm.png) | [43](after/43-finish-no-confirm.png), [43b](after/43b-keep-going.png), [43c](after/43c-finish-all-logged.png) |
| V1-07 | A per-side plate line sits under the weight Dial and at the end of the Rest Next line. The Plates segment is gone from the sheet. | **Met.** Deadlift at 60 shows "Per side: 20" with no tap. During Rest, Next reads "Next: set 2 · 70 × 7 · last 70 × 7 · Per side: 25". The sheet now has Warm-up and Notes only. | [05](shots/05-set-now-deadlift.png), [06](shots/06-exercise-tools.png) | [05](after/05-set-now-deadlift.png), [06](after/06-exercise-tools.png) |
| V1-08 | `--text-*` tokens are in rem. | **Met.** At root 200 % (32 px), "Last time" is **28 px**, the weight readout "60" is one line (64 px tall), and scrollWidth is 390 = viewport during the Set and the Rest. Still visible: the header title overlaps the timer line, the first list row's name is clipped ("Assisted pull…"), and the e1RM line breaks badly (see Carried). | [47](shots/47-200pct-set.png) | [47](after/47-200pct-set.png), [47b](after/47b-200pct-rest.png) |
| V1-09 | Cancel on a changed draft asks "Discard N changes?" with Discard and Keep editing. | **Met.** After Back squat sets go 4→5, Cancel opens "Discard 1 change?", and Keep editing keeps **5**. Cancel on a clean draft closes the editor in 1 tap with no dialog. | [32](shots/32-program-edit.png) | [32](after/32-program-edit.png) |
| V1-10 | The Volume line and its bar are gone, and "0/23 sets" moved under the title. | **Partly.** The header, including Now/All, is **101 px** (≤ 110). At 320 × 568 during Rest, "Next: set 2 · 70 × 7" is in the DOM at y 329–392, but the Rest panel covers it: `elementFromPoint` hits `.rest-clock`. The Set 1 Effort chips are cut off there too. | [05](shots/05-set-now-deadlift.png), [45](shots/45-320-rest.png) | [05](after/05-set-now-deadlift.png), [45](after/45-320-rest.png) |
| V1-11 | The timeline and the "usually" line are gone. The ±15 s buttons are renamed. | **Met.** The panel reads "Use 3:50 for Deadlift · 2:59 REST of 3:00 · −15 s +15 s Skip rest": 2 time values plus the offer. The buttons are named "Rest 15 seconds less" and "Rest 15 seconds more". | [11](shots/11-rest-next-expanded.png) | [11](after/11-rest-next-expanded.png) |
| V1-18 | A "Delete digit" key (⌫) fills the empty Keypad slot. | **Met.** Typing 8, 3, Delete digit, 2 shows "82". The key is **114 × 64** and named "Delete digit". | [13](shots/13-keypad.png) | [13](after/13-keypad.png) |
| V1-19 | The Now cells' dashed border uses `--color-muted`. | **Partly.** The Now view border is rgb(98,98,111) on #FFF, **6.01:1**. The All list's upcoming cells (`.all-cell--future`, `src/ui/ExerciseList.css`) still use rgb(202,202,211), **1.63:1**, and the report names that location too. | [05](shots/05-set-now-deadlift.png) | [05](after/05-set-now-deadlift.png), [57](after/57-all-view-no-rest.png) |
| V1-21 | The Train card re-renders for the Workout chosen with Change. | **Met.** After one tap on Change, the card heading is "Workout A" and its first row is "Back squat". | [52](shots/52-change-workout.png) | [52](after/52-change-workout.png) |
| V1-22 | The Deload switch moved to the Program header. | **Met.** Train has no Deload control (seeded and first run). Program shows the "Deload week" switch. | [03](shots/03-train-seeded.png), [02](shots/02-first-run-after-pick.png) | [03](after/03-train-seeded.png), [31](after/31-program.png) |
| V1-26 | The Muscles rows and the headline say below or above the range in words. | **Met.** Abs reads "3 · below 10", Calves "8 · below 10" and Shoulders "21 · above 20". The headline says "Shoulders 21 is above the typical 10–20" and uses "at the top" only for Lats 19. | [25](shots/25-muscles.png) | [25](after/25-muscles.png) |
| V1-27 | The Program view table no longer has a kg column. | **Met.** The headers are Exercise, Sets × reps and Rest. | [31](shots/31-program.png) | [31](after/31-program.png) |
| V1-29 | Calendar days are 32 × 32 and carry the Workout letter. | **Met.** All 15 trained-day buttons are 32 × 32 and print "A" or "B". Their names read like "Mon 7 Sep: Workout A". | [26](shots/26-sessions.png) | [26](after/26-sessions.png) |
| V1-33 | Train is titled "Train", and the legend is hidden while no row has data. | **Met.** The h1 is "Train" on first run and when seeded. A fresh install with A/B Split picked shows no "= next step" legend. | [01](shots/01-first-run.png), [02](shots/02-first-run-after-pick.png) | [01](after/01-first-run.png), [02](after/02-first-run-after-pick.png) |

**Totals:** 17 Met, 2 Partly (V1-10, V1-19), 0 Not met.

## Composites (before | after)
- [Live Session, Now view](compare/live-now-view.png)
- [Rest with Log set](compare/rest-with-log-set.png)
- [Train page](compare/train-page.png)
- [Finish confirm](compare/finish-confirm.png)
- [Program table](compare/program-table.png)
- [Keypad](compare/keypad.png)

## Carried to iteration 2

Fixed in iteration 1 but not fully met:
- **V1-10** (Partly): at 320 × 568 during Rest, the Next line and the Effort chips are hidden under the Rest panel.
- **V1-19** (Partly): the All list's upcoming cells are still 1.63:1 (`src/ui/ExerciseList.css`, `--color-control`).

Not addressed in iteration 1:
- V1-12: Warm-ups numbered as working Sets
- V1-13: chosen Set kind invisible on the bar
- V1-14: Set kinds and RIR unexplained; "Warm-up" chip clipped
- V1-15: Exercise note hidden
- V1-16: Exercise tools sheet still has Step and Bodyweight exercise (see `after/06-exercise-tools.png`)
- V1-17: Swap has no Undo
- V1-20: reflow at 200 % zoom (195 × 422), not re-measured
- V1-23: Sessions list buried under stats
- V1-24: Session editor opens mid-page
- V1-25: summary muscle grid shown twice
- V1-28: Program editor grid targets below 44 × 44 (unchanged in `after/32-program-edit.png`)
- V1-30: last backup not stated
- V1-31: Lift chart labels overlap
- V1-32: "Over rest" in danger red

New observations from this pass, for the reviewer to judge:
- At root 200 %, the live header's title overlaps its timer line, the first exercise row's name is clipped, and the e1RM line breaks mid-phrase (`after/47-200pct-set.png`). V1-08's check is met, but the screen is not clean.
- Logging from the All view still starts no visible Rest countdown (`after/57-all-view-no-rest.png`). V1-01's check covers only Start and reload.
- After a reload mid-Rest, the Set 1 Effort chips are gone (`after/17-after-reload.png` vs `after/45-320-rest.png`).

## Known test failure
`src/services/sessions.test.ts` O13 depends on the date and fails on `main` too. It is not caused by these fixes.
