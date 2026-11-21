# Design recheck: WorkoutTracker after the DX fixes (round 1)

I'm Maya, the design expert (`docs/design-expert/persona.md`). This recheck tests each verdict in `report.md` against the running dev build at 390x844 (touch, light mode, state `stats-45.json`; Body and Photos use `photos.json`). Where a measurement says "DOM", it came from the page's own geometry or computed styles.

**How a status is set.** The verdict's Acceptance check decides the status, read literally. If the check passes but part of the written Fix was never built, the status is still **Fixed** and the gap goes under "what remains". **Partly fixed** means the Acceptance check itself fails.

**The owner's addition.** The labelled "Change" text button on Train, with its "Choose a workout" sheet, is a deliberate addition (it replaces the unlabelled ‹ › arrows) and is not counted against DX-01.

## 1. Verdict by verdict

| DX | Verdict | Status | What remains |
|---|---|---|---|
| DX-01 | Home becomes Train | **Fixed** | Launch shows "Workout B", its 7 Plans and 1 filled button with no scrolling; 9 tappable elements. The rest-day variant did not trigger on the seeded Thursday. |
| DX-02 | One calendar, not four | **Fixed** | Only Sessions has a calendar. Progress: "Since 23 Jul · 31 Sessions" (seed data has exactly 31). |
| DX-03 | One muscle verdict, one status vocabulary | **Fixed** | Calves and Abs "below 10–20" everywhere; no "Stalled". Minor: a fifth phrase "↑ Up to 15 kg" on Progress. |
| DX-04 | Program tab with visible rows | **Fixed** | One header action ("Edit"), rows for Programs, Deload week, Exercises, Settings. First run: 3 taps to the first Set. Minor: first-run Program shows both "Choose a Program" rows and a "Programs ›" row. |
| DX-05 | "Log set" is the one primary during Rest | **Fixed** | — |
| DX-06 | One Shell rule for every sub-page | **Partly fixed** | Session detail, Exercise info and Bar and plates have no tab bar; Bar and plates uses "‹ Back"; the lift page from live exits with "Done"; the Session editor keeps the tab bar (a tab tap drops an unsaved edit); "Log a past workout" is a handle-only sheet. |
| DX-07 | Live tools as labelled controls | **Partly fixed** | Exercise info is not reachable in a live Session (the lift page opened from History has no "How to do it"). |
| DX-08 | One Exercise picker, one Set Dial | **Partly fixed** | The Exercises library is still a different design; the picker from the Session editor has no "My gym only"; no "Swapped to … · Undo" snackbar. |
| DX-09 | One Resume strip | **Fixed** | — |
| DX-10 | Body leads with the chart; Photos in one place | **Fixed** | — |
| DX-11 | Delete once, with Undo | **Fixed** | Small: after deleting a Session the list opens far down. |
| DX-12 | Progress rows on top; Rep maxes as a section | **Fixed** | — |
| DX-13 | One sync line, honest Sync now | **Fixed** | — |
| DX-14 | Finish, Discard, Summary | **Fixed** | The Summary is still ~60 % blank after a short Session; the totals line shows an unlabelled "600 kg"; "Next: Workout B" has no day. |
| DX-15 | Colour carries one meaning | **Fixed** | — |
| DX-16 | Program tab as plain lists | **Fixed** | — |
| DX-17 | Program editor plus a Plan editor | **Fixed** | See N2. |
| DX-18 | Touch targets ≥ 44 px | **Partly fixed** | Under 44 px: Set/All segments (44x40), "Swap" (37x44), "Notes" (40x44), "My gym only" (112x36), switch inputs (44x26). |
| DX-19 | Live header | **Fixed** | Segments 40 px tall (counted under DX-18). |
| DX-20 | No eyebrows or ALL CAPS | **Fixed** | "Next · Set 2" is still on the Rest card. |
| DX-21 | Empty states: 2 lines, 1 action | **Partly fixed** | Sessions empty has two actions that do the same thing ("Log past" and "Log a past workout"). |
| DX-22 | Copy and labels | **Partly fixed** | "Log a past workout" still calls a Session a workout; the Session-editor picker says "Add to Workout A"; Exercise info still "Primary muscle: …" labels-as-values. |
| DX-23 | Settings layout | **Fixed** | — |
| DX-24 | Live Set screen spacing and chips | **Partly fixed** | The dead band moved: 176 px between "Last time…" and "Log set". |

**Tally:** 17 Fixed, 7 Partly fixed, 0 Not fixed, 0 Regressed.

## 2. New problems the changes introduced

- **N1 · Major · MOD-04 · Train "Choose a workout" sheet and "Log a past workout"**: no visible exit (handle/backdrop only). *Fix:* a 44x44 close X top-right on both; Back dismisses.
- **N2 · Major · CPY-04 · Program tab vs Program editor**: the tab says Back squat "47.5 → 62.5 kg", Workout A "~70 min"; the editor says "50 kg", "~54 min". *Fix:* editor rows show the same string as the Program tab; one function computes "~N min" everywhere.
- **N3 · Major · BTN-07 · Set chip changes the Set kind**: one stray tap on the current Set chip silently turns a working Set into a warm-up. *Fix:* a labelled "Working ▾" control beside Swap/Notes/History, or keep the chip tap with a "Set 1 is now a warm-up · Undo" snackbar.
- **N4 · Minor · CON-01 · Swap feedback**: a top toast "Swapped from Deadlift" with no action, Undo elsewhere. *Fix:* the one bottom snackbar "Swapped to X · Undo".
- **N5 · Minor · CON-02 · gutters**: 16 px on most tabs, 20 px on Progress/Summary/Session detail, 32 px on Body/Photos. *Fix:* one 16 px page gutter.
- **N6 · Minor · LAY-06 · Progress title**: "Progress" repeats the tab label above the headline. *Fix:* the headline is the page title.
- **N7 · Minor · CON-03 · exit labels**: bare ‹, "‹ Back" and "Done" for the same action. *Fix:* a bare ‹ on every pushed page.
- Also: the lift page's selected "Est. strength" chip is filled black like a primary button (BTN-01). *Fix:* ink outline.

## 3. Overall verdict

The structure is fixed. Train opens on today's Workout, each fact lives in one place, Program has visible rows instead of hidden menus, and Rest makes "Log set" the obvious next tap. 17 of 24 verdicts pass, and none got worse. What is left is consistency: pushed pages that drop the tab bar, an editor that keeps it, two sheets with no close button, and a few small targets. Fix N2 and N3 first, because both put wrong numbers in front of a trainee who trusted the screen.
