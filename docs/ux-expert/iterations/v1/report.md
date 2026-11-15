# UX review: iteration 1 (2026-11-15, commit 6e00b00)

Reviewer: Dana Reyes (`docs/ux-expert/persona.md`). Driven with `scripts/ux-review/shoot.mjs` (headless Chromium, touch on) against the Vite dev server at 390 × 844 DPR 1, plus 320 × 568, 195 × 422 (200 % zoom of 390), root font 200 % and reduced motion. Data: fresh install (Pass A); `scripts/render-states/stats-45.json` with the clock pinned to Thu 15 Oct 2026 for the rest; reload tests on the real clock.

## Summary
The set loop's bones are good. Start then Log set is 2 taps. The 64 px Log set bar names exactly what it logs ("Log set 2 · 70 × 7"). Rest starts by itself, survives a reload and never logs a Set; its 64 px countdown reads from a bench. The PR moment is typographic, fast and blocks nothing. Delete set has a 5 s Undo, and offline logging is honest ("Offline · saved on this phone").

The biggest risk is that the live Session hides its best features: it opens and resumes on All, without Dials, Plate line or the running Rest (V1-01), and the upcoming Set cells show weights the trainee won't lift (V1-02). Next comes access: text doesn't scale (V1-08) and the Dials' names carry no values (V1-04). Then clutter: a 4-row header, a Rest panel with five time values, and a 10-item tools sheet.

**Keep:** the Log set wording, auto Rest, the Deload line ("Deload: 55 (from 60)"), the Program editor's "Impact on weekly volume", Move up/Move down as the alternative to drag, the global reduced-motion rule (`src/styles/base.css`), and the offline header line.

## Top 5
| # | ID | Sev | Value/effort | One-line issue |
|---|---|---|---|---|
| 1 | V1-01 | 3 | High / S | The live Session opens and resumes on All: no Dials, no Plate line, no Rest countdown. |
| 2 | V1-02 | 3 | High / S | Upcoming Set cells copy the open Set's Preset; they show 60×10 for Sets that open at 70×7. |
| 3 | V1-03 | 3 | High / S | During Rest the Log set bar disappears; logging early takes Skip rest + Log set. |
| 4 | V1-04 | 3 | High / S | Dials are named "Weight"/"Reps" and the bar "Log set", with no values. |
| 5 | V1-05 | 3 | High / S | Set 2 opened 20 kg above last time, carried from Set 1, with no reason shown. |

## Re-check of prior verdicts
None (iteration 1).

## What improved since last iteration
Not applicable.

## Verdicts

### 3.1 Usability heuristics

### V1-02 · Sev 3 · Usability › H1/H6, upcoming Set cells
- **Location:** Train › live Session › Now, the Set cells (`src/ui/SetScreen.tsx`); also the All list (`src/features/workout/WorkoutFeature.tsx`)
- **Evidence:** `shots/05-set-now-deadlift.png` vs `shots/12-after-skip-rest.png`; `shots/53-back-squat-note.png`. Start Workout B, tap Now: the Deadlift cells read 60×10 ×3. Log Set 1 and cells 2–3 become 70×7. On Workout A, Back squat shows 47.5×10 ×4; last time was 47.5×10, 57.5×9, 62.5×8, 62.5×7.
- **Issue:** Three of four cells show a weight the trainee won't lift, and the numbers change after each log. A trainee planning their plates from the cells is misled, and every number on the screen loses trust.
- **Recommendation:** Give each unlogged cell its own position's Preset (the value it opens with when it becomes current).
- **Acceptance check:** At Workout A start, the Back squat cells read 47.5×10, 57.5×9, 62.5×8, 62.5×7. No unlogged cell changes when the Set before it is logged at its Preset.
- **Value/effort:** High / S · **Refs:** H1, H6; CONTEXT "Preset"

### V1-06 · Sev 3 · Usability › H5, Finish
- **Location:** live header Finish (`src/ui/LiveHeader.tsx`; `handleFinish` in `src/features/workout/WorkoutFeature.tsx`)
- **Evidence:** `shots/43-finish-no-confirm.png`. Log 2 Sets, then tap Finish.
- **Issue:** The Session ends at once with 21 of 23 Sets unlogged: no count, no confirm, no Undo. The button sits top-right next to the timer, and there is no way back into the Session.
- **Recommendation:** When planned Sets remain, Finish opens a Sheet: "21 sets not logged" with Finish workout / Keep going. With nothing left, Finish stays 1 tap.
- **Acceptance check:** With 2/23 logged, Finish shows "21 sets not logged", and "Keep going" returns to the same Set. With everything logged, Finish reaches the summary in 1 tap.
- **Value/effort:** Med / S · **Refs:** H5, H3

### V1-09 · Sev 3 · Usability › H3, Program edit Cancel
- **Location:** Program › Edit › Cancel (`src/ui/ProgramEditor.tsx`)
- **Evidence:** `shots/32-program-edit.png`. Change Back squat sets 4→5 and tap Cancel: the change is discarded with no prompt and no Undo. A reload also drops the draft.
- **Issue:** One mis-tap on Cancel throws away a whole edit of a Program.
- **Recommendation:** If the draft is dirty, Cancel asks "Discard 1 change?" (Discard / Keep editing). A clean draft cancels at once.
- **Acceptance check:** After one change, Cancel shows "Discard 1 change?", and Keep editing keeps the value at 5. With no changes, Cancel is 1 tap.
- **Value/effort:** Low / S · **Refs:** H3; rubric 3.9

### V1-14 · Sev 2 · Usability › H10, Set kinds and Effort
- **Location:** ⋯ › Set type chips; the Effort chips (`src/ui/SetKindRow.tsx`, `src/ui/SetScreen.tsx`)
- **Evidence:** `shots/08-set-type.png`, `shots/10-rest-after-warmup.png`
- **Issue:** Warm-up/Working/Drop/Failure/AMRAP and "RIR 0/1/2/3+" come with no explanation, and "Warm-up" is clipped in its chip.
- **Recommendation:** Show one line under the selected kind ("AMRAP: as many reps as you can; the target is a floor"). Title the Effort row "Reps left", with chips 0/1/2/3+.
- **Acceptance check:** Each kind shows a description of ≤ 60 characters; no chip text contains "RIR"; no chip is clipped at 390 px.
- **Value/effort:** Med / S · **Refs:** H10

### V1-15 · Sev 2 · Usability › H6, Exercise note hidden
- **Location:** Now view (`src/ui/SetScreen.tsx`, `exerciseNote`)
- **Evidence:** `shots/53-back-squat-note.png`. Back squat's note "Belt from set 3" is not shown; it is only in ⋯ › Notes.
- **Issue:** A note meant to be read at the bar is two levels deep, so it is never seen.
- **Recommendation:** Show the note as one truncated line under "Set n of N · target", and tap it to edit.
- **Acceptance check:** "Belt from set 3" is visible on Now with no tap, and the weight Dial's top stays at y ≤ 360 at 390 × 844.
- **Value/effort:** Med / S · **Refs:** H6; CONTEXT "Exercise note"

### V1-17 · Sev 2 · Usability › H3, Swap has no Undo
- **Location:** ⋯ › Swap exercise › Do this instead (`src/ui/AlternativesList.tsx`, `src/features/workout/WorkoutFeature.tsx`)
- **Evidence:** `shots/42-after-swap.png`
- **Issue:** The title becomes "Deadlift with Bands" with no snackbar, no "instead of Deadlift" and no Undo. Going back means finding Deadlift again by memory.
- **Recommendation:** Show the snackbar "Swapped for Deadlift · Undo" (5 s), the same pattern as Delete set.
- **Acceptance check:** After a Swap, Undo is visible ≥ 5 s and restores "Deadlift" with the same Presets.
- **Value/effort:** Low / S · **Refs:** H3

### V1-18 · Sev 2 · Usability › H9, Keypad has no delete
- **Location:** `src/ui/Keypad.tsx`
- **Evidence:** `shots/13-keypad.png` (bottom-right slot empty)
- **Issue:** A mistyped digit means Cancel, reopen and retype.
- **Recommendation:** Put a "Delete digit" key, 114 × 64, in the empty slot.
- **Acceptance check:** Typing 8, 3, Delete, 2 shows "82"; the key is ≥ 64 px tall and named "Delete digit".
- **Value/effort:** Med / S · **Refs:** H9; principles §2.4

### V1-21 · Sev 2 · Usability › H1, Change contradicts the card
- **Location:** Train › Change (`src/features/dashboard/DashboardView.tsx`)
- **Evidence:** `shots/52-change-workout.png`
- **Issue:** The Action bar says "Start Workout A" while the card above still reads "Workout B · next" and lists Deadlift.
- **Recommendation:** Re-render the card for the chosen Workout.
- **Acceptance check:** After one tap on Change, the card heading reads "Workout A" and its first row is "Back squat".
- **Value/effort:** Med / S · **Refs:** H1, H4

### V1-27 · Sev 2 · Usability › H4, Program "kg" column
- **Location:** `src/ui/ProgramPage.tsx` vs `src/ui/ProgramEditor.tsx`
- **Evidence:** `shots/31-program.png`, `shots/32-program-edit.png`. Back squat reads 47.5 in view mode and placeholder 50 in edit mode; the trainee's working weight is 62.5.
- **Issue:** Three numbers for one row, and the trainee can't tell which one is used.
- **Recommendation:** Remove the kg column from the view-mode table and keep Starting weight only in the editor.
- **Acceptance check:** Program view shows Exercise, Sets × reps and Rest only.
- **Value/effort:** Low / S · **Refs:** H4

### 3.2 Accessibility

### V1-04 · Sev 3 · A11y › names and values on the set loop
- **Location:** `src/ui/WeightDial.tsx`, `src/ui/RepsDial.tsx` (readouts named "Weight"/"Reps"); `src/ui/SetScreen.tsx` ~l.1056 (`aria-label="Log set"`)
- **Evidence:** Keyboard pass on Now, focus order: Exercise tools → Decrease weight → "Weight" → … → "Log set"; `shots/05-set-now-deadlift.png`
- **Issue:** A VoiceOver user never hears the value they are about to log, on every Set.
- **Recommendation:** Name the readouts "Weight, 60 kg" and "Reps, 10" (live values), and drop the bar's aria-label so its visible text becomes its name.
- **Acceptance check:** The names read "Weight, 60 kg", "Reps, 10" and "Log set 1 · 60 × 10", and update with the Dial.
- **Value/effort:** High / S · **Refs:** WCAG 4.1.2, 2.5.3

### V1-08 · Sev 3 · A11y › text does not resize
- **Location:** `src/styles/tokens.css` (`--text-*` in px)
- **Evidence:** `shots/47-200pct-set.png` (root 200 % looks identical to 100 %)
- **Issue:** No large text for low-vision trainees: 12–14 px captions stay at 12–14 px.
- **Recommendation:** Set `--text-xs` … `--text-xl` in rem; keep hero/display in px.
- **Acceptance check:** At root 200 %, "Last time" renders at 28 px, the weight readout fits on one line at 390 px, and there is no horizontal scroll.
- **Value/effort:** High / M · **Refs:** WCAG 1.4.4

### V1-19 · Sev 2 · A11y › non-text contrast, upcoming cells
- **Location:** `src/ui/SetScreen.css` (and the All list cells)
- **Evidence:** `shots/05-set-now-deadlift.png`; the dashed border is #CACAD3 on #FFF, 1.6:1
- **Issue:** The only boundary of an upcoming cell all but disappears.
- **Recommendation:** Draw the border in `--color-muted` (#62626F, 6:1).
- **Acceptance check:** The border measures ≥ 3:1.
- **Value/effort:** High / S · **Refs:** WCAG 1.4.11

### V1-20 · Sev 2 · A11y › reflow at 200 % zoom
- **Location:** `src/ui/LiveHeader.css`, `src/ui/SetScreen.css`
- **Evidence:** `shots/48-zoom200-set.png` (195 CSS px). The Workout name truncates to "V", the third cell is clipped and the Dials fall below the bar.
- **Recommendation:** Let the Set cells row wrap below 280 px.
- **Acceptance check:** At 195 × 422 all cells are fully visible, with no horizontal scroll.
- **Value/effort:** Med / S · **Refs:** WCAG 1.4.10

### V1-28 · Sev 2 · A11y › target size, Program editor grid
- **Location:** `src/ui/ProgramEditor.tsx`/`.css`
- **Evidence:** `shots/32-program-edit.png`. Measured: Min/Max reps 22×40, Sets 36×40, Rest 40×40, reorder handle 16×44, row ⋯ 24×44.
- **Issue:** Below the 24 px floor, so thumbs hit the neighbouring field.
- **Recommendation:** Move Rest and Starting weight into the row's existing ⋯ panel, leaving Sets and Reps ≥ 56 px wide.
- **Acceptance check:** Every control in a Plan row is ≥ 44 × 44 with ≥ 8 px gaps.
- **Value/effort:** Low / M · **Refs:** WCAG 2.5.8

### V1-29 · Sev 2 · A11y › Sessions calendar targets
- **Location:** `src/features/sessions/SessionsScreen.tsx` (SessionsCalendar)
- **Evidence:** `shots/26-sessions.png`. Day cells are 20×20 buttons; A and B differ by hue only.
- **Recommendation:** Make the cells 32×32 and print "A"/"B" inside.
- **Acceptance check:** Cells are ≥ 32×32 and trained cells carry a letter.
- **Value/effort:** Low / S · **Refs:** WCAG 2.5.8, 1.4.1

### V1-26 · Sev 2 · A11y › Weekly set range shown by position only
- **Location:** `src/features/progress/MusclesPage.tsx` (headline ~l.129)
- **Evidence:** `shots/25-muscles.png`. Abs 3 and Calves 8 (below the range) and Shoulders 21 (above) carry no words. The headline says Shoulders 21 "sit at the top of the typical 10–20".
- **Recommendation:** Reuse the Program tab's row wording ("3 · below 10", "21 · above 20") and say "above" in the headline.
- **Acceptance check:** The Abs row shows "below 10", Shoulders shows "above 20", and the headline doesn't say "at the top" for 21.
- **Value/effort:** Low / S · **Refs:** WCAG 1.4.1; rubric 3.7

### 3.3 Clutter and hierarchy

### V1-10 · Sev 2 · Clutter › live header
- **Location:** `src/ui/LiveHeader.tsx`, `src/ui/live/LiveSessionBar.tsx`
- **Evidence:** `shots/05-set-now-deadlift.png`, `shots/45-320-rest.png`. The header has 4 rows, 160 px: 19 % of 844 and 28 % of 568. At 320×568 during Rest it pushes the Next line off screen.
- **Recommendation:** Remove the "Volume … last B at this point" line and its bar, and put "1/23 sets" in the title row.
- **Acceptance check:** The header is ≤ 110 px. At 320×568 during Rest, "Next: set 2 · 70 × 7" is visible.
- **Value/effort:** High / M · **Refs:** rubric 3.3

### V1-11 · Sev 2 · Clutter › Rest panel
- **Location:** `src/ui/live/RestPanel.tsx`
- **Evidence:** `shots/11-rest-next-expanded.png`, `shots/10-rest-after-warmup.png`. The panel shows "2:59", "of 3:00", "you usually rest 3:50", "0:00", "3:50" and "Use 3:50 for Deadlift". The bar is scaled to 3:50, not to the Rest, and −15 s doesn't say what it changes.
- **Recommendation:** Remove the timeline and the "usually" line; keep the countdown, "of 3:00" and the Use 3:50 offer.
- **Acceptance check:** ≤ 2 time values plus the offer. The buttons are named "Rest 15 seconds less" and "Rest 15 seconds more".
- **Value/effort:** High / S · **Refs:** rest-timer patterns

### V1-25 · Sev 2 · Clutter › summary muscle grid shown twice
- **Location:** `src/ui/SessionSummary.tsx` ("Worked today")
- **Evidence:** `shots/43-finish-no-confirm.png`. The second grid uses other names (Middle back/Mid back, Quadriceps/Quads, Abdominals/Abs) and adds Traps and Forearms.
- **Recommendation:** Remove the second grid and use the CONTEXT labels in the first.
- **Acceptance check:** One grid, with each muscle named once.
- **Value/effort:** Med / S

### V1-31 · Sev 1 · Clutter › Lift chart labels overlap
- **Location:** `src/ui/charts/Ladder.tsx`
- **Evidence:** `shots/24-lift-back-squat.png`. "No A session" sits over "Deload", and the caption sits over the 50 kg label.
- **Recommendation:** Alternate the lines of adjacent band labels and move the caption below the chart.
- **Acceptance check:** No text boxes intersect at 390 px.
- **Value/effort:** Low / S

### 3.4 Information architecture

### V1-01 · Sev 3 · IA › the live Session's default view
- **Location:** `src/features/workout/WorkoutFeature.tsx` (`setView('list')` on start and resume, ~l.307), `src/ui/live/LiveSessionBar.tsx`
- **Evidence:**
  - `shots/04-set-screen.png`: after Start.
  - `shots/57-all-view-no-rest.png`: logging from All shows no Rest, and Log set 2 is ready at once.
  - `shots/17-after-reload.png`: a reload mid-Rest lands on All with the countdown hidden.
- **Issue:** No Dials, Plate line or last time are shown. Rest is invisible, so the trainee logs Set 2 seconds later.
- **Recommendation:** Open on Now at Start and on resume; All stays one tap away.
- **Acceptance check:** After Start, the weight Dial is visible with 0 extra taps. After a reload 10 s into a 3:00 Rest, ~2:50 shows with no tap.
- **Value/effort:** High / S · **Refs:** rubric 3.6, 3.9; principles §4.1

### V1-16 · Sev 2 · IA › Exercise tools sheet
- **Location:** `src/ui/SetScreen.tsx` tools sheet; `WeightStepControl` in `src/ui/WeightDial.tsx`
- **Evidence:** `shots/06-exercise-tools.png`. The sheet holds 10 items, including Step and Bodyweight exercise, catalog settings that change every future Session.
- **Recommendation:** Remove Step and Bodyweight from the in-workout sheet; they stay in Program › Exercises.
- **Acceptance check:** ≤ 8 rows, and no Step or Bodyweight control.
- **Value/effort:** Med / S · **Refs:** H5

### V1-22 · Sev 2 · IA › Deload switch at the top of Train
- **Location:** `src/features/dashboard/DashboardView.tsx` ~l.325
- **Evidence:** `shots/03-train-seeded.png`, `shots/02-first-run-after-pick.png`
- **Issue:** The first control on Train, even on first run and mid-Session, makes every Preset 10 % lighter.
- **Recommendation:** Move it to the Program header (`src/ui/program/ProgramHead.tsx`); Train keeps the "Deload week · Presets 10% lighter" line while it is on.
- **Acceptance check:** With Deload off, Train has no Deload control and Program does.
- **Value/effort:** Med / S

### V1-23 · Sev 2 · IA › Sessions list buried under stats
- **Location:** `src/features/sessions/SessionsScreen.tsx` (MuscleWeeks, VolumeByWorkout)
- **Evidence:** `shots/26-sessions.png`. The first row is at y≈900. Editing one Set's reps on 12 Oct took 7 taps and 2 scrolls.
- **Recommendation:** Move "Muscle sets by week" and "Volume per session" to Progress.
- **Acceptance check:** The first Session row is visible without scrolling at 390×844.
- **Value/effort:** Med / M

### 3.5 Intuitiveness

### V1-12 · Sev 2 · Learnability › Warm-ups numbered as working Sets
- **Location:** `src/ui/SetScreen.tsx`
- **Evidence:** `shots/09-warmup-on-dials.png`, `shots/10-rest-after-warmup.png`. The screen reads "Log set 1 · 30 × 5", "Set 1 logged", "Next: set 1 · 40 × 3 · last 60 × 10", and shows "Set 1 effort" chips after a Warm-up.
- **Recommendation:** Label it "Log warm-up 1 · 30 × 5", drop "last …" from Next during the ramp, and hide Effort after a Warm-up.
- **Acceptance check:** No "set 1" text refers to a Warm-up, and no Effort chips show after logging one.
- **Value/effort:** Med / S

### V1-24 · Sev 2 · Learnability › Session editor opens mid-page
- **Location:** `src/features/sessions/SessionsScreen.tsx`, `src/ui/SessionEditor.tsx`
- **Evidence:** `shots/28-session-editor.png`. It opens on Assisted pull-ups, with the title and Deadlift off screen.
- **Recommendation:** Scroll to the top when the editor opens.
- **Acceptance check:** "Workout B" and "Deadlift" are at the top of the viewport.
- **Value/effort:** Low / S

### V1-33 · Sev 1 · Learnability › Train is titled "Dashboard"
- **Location:** `src/features/dashboard/DashboardView.tsx`
- **Evidence:** `shots/01-first-run.png`; also the empty-state legend in `shots/02-first-run-after-pick.png`.
- **Recommendation:** Title the page "Train" and hide the legend while no row has data.
- **Acceptance check:** The h1 reads "Train", and a fresh install shows no legend.
- **Value/effort:** Low / S

### 3.6 In-workout helpfulness

### V1-03 · Sev 3 · In-workout › Log set during Rest
- **Location:** `src/ui/SetScreen.tsx` ~l.1039, `src/ui/live/RestPanel.tsx`
- **Evidence:** `shots/11-rest-next-expanded.png`, `shots/10-rest-after-warmup.png`
- **Issue:** Logging early takes Skip rest + Log set, and the Dials are folded under Next.
- **Recommendation:** Keep the Log set bar in the Action bar during Rest, with the panel above it; logging ends the Rest. The space comes from V1-10 and V1-11.
- **Acceptance check:** During Rest at 390×844 and 320×568, "Log set 2 · 70 × 7" is visible and logs in 1 tap, with the countdown ≥ 60 px.
- **Value/effort:** High / S

### V1-05 · Sev 3 · In-workout › unexplained Preset jump
- **Location:** `src/ui/SetScreen.tsx`
- **Evidence:** `shots/15-pr-after-log.png`. Set 1 was typed to 80 × 10, then Set 2 opened at 90 × 7 (last 70 × 7).
- **Recommendation:** Use the Deload line's pattern: "+20 kg: carried from set 1 (last 70)".
- **Acceptance check:** Set 2 shows a line containing "+20 kg" and "last 70".
- **Value/effort:** High / S · **Refs:** rubric 3.6

### V1-07 · Sev 3 · In-workout › Plate line hidden
- **Location:** `src/ui/SetScreen.tsx`, `src/ui/live/PlatesDrawing.tsx`
- **Evidence:** `shots/05-set-now-deadlift.png`, `shots/06-exercise-tools.png`
- **Recommendation:** Show one text line under the weight Dial and in the Rest Next line, and remove the Plates segment from the sheet.
- **Acceptance check:** Deadlift at 60 kg shows "Per side 20" with no tap, and the Rest Next line ends with per-side plates.
- **Value/effort:** High / M

### V1-13 · Sev 2 · In-workout › chosen Set kind invisible
- **Location:** `src/ui/SetScreen.tsx`
- **Evidence:** `shots/38-amrap-on-dials.png`. With AMRAP chosen, only "8+ reps" shows; the bar says "70 × 7" and the reps Dial stays at 7, below the floor of 8.
- **Recommendation:** The bar reads "Log AMRAP set 2 · 70 × 8+" and the reps start at the floor.
- **Acceptance check:** The bar contains "AMRAP" and reps are ≥ 8.
- **Value/effort:** Med / S

### 3.7 Delight

### V1-32 · Sev 1 · Motivation › "Over rest" in danger red
- **Location:** `src/ui/SetScreen.tsx`
- **Evidence:** `shots/55-rest-ended.png`
- **Recommendation:** Use `--color-muted`.
- **Acceptance check:** The computed colour is #62626F.
- **Value/effort:** Med / S

### 3.8 Performance
No verdicts: taps answered within 100 ms, the PR toast appeared within one frame, and there were no spinners.

### 3.9 Offline trust

### V1-30 · Sev 2 · Offline trust › last backup not stated
- **Location:** `src/ui/Settings.tsx`, `src/ui/BackupBadge.tsx`
- **Evidence:** `shots/36-settings-full.png`; `shots/01-first-run.png` (the gear dot shows on a fresh install).
- **Recommendation:** Show "Last backup: <date>/Never" under Export, and no dot while there are no Sessions.
- **Acceptance check:** A "Last backup" line is shown, and a fresh install has no dot.
- **Value/effort:** Low / S

## Not checked
- Offline reload: dev mode has no service worker. Logging 3 Sets offline worked and was honestly labelled.
- Backgrounding, landscape, Rest push, Reminders and Rest sound: not possible headless. A reload mid-Rest kept the right time.
- `/api/*` sign-in and sync: absent in dev, as expected. The UI says "Not synced · saved on this phone".
- DPR 3: shots are DPR 1; measurements are in CSS px.
- Pass E Custom Exercise and Program › Exercises: not reached.
- **For the operator (domain rule):** the Preset for later Sets carries Set 1's change within a Session. 80 kg on Set 1 (last 60) opened Set 2 at 90 (last 70), and "Next time" then said 90 kg. This is worth a review of decision 0020; V1-05 only asks the screen to say why.
