# Set Table: rationale (revision 2)

**Thesis.** The whole workout is one editable page. Every set is a row, and you tick it. In this concept the table is the product, everywhere in the app.

## Key decisions

1. **The active row is the instrument, and it sits on the grid.** Every row shares one grid: SET 36 | PREVIOUS 64 | KG | REPS | ✓ 64. The active row grows to 136 px and stays on that grid. The set chip sits in the SET column, the meta line starts at the PREVIOUS column, and the 60 px KG cell spans PREVIOUS and KG. The REPS cell sits under REPS, and the 64 px ✓ sits under ✓.
2. **One filled primary.** The 56 px dock bar `Log set 3 · 62.5 × 8` is filled accent. The row ✓ is a 64 px accent outline that does the same thing, so logging still takes 1 tap and still starts rest.
3. **The exercise never scrolls away.** The block header (`Back squat · 4 × 8–10 · rest 3:00`) and the column header are sticky. Toasts anchor below them.
4. **Rest is the brief's 112 px dock.** It holds the 64 px countdown, `−15`, `+15` and a filled ink `Skip` as the default. RIR is one 56 px line above it. Once you pick a value, the line collapses to `Set 3 effort · RIR 1 ›`.
5. **History is a log of workout cards.** Each card is a compact table, Strong-style (`4 × Back squat | 62.5 kg × 8`). Tapping a card opens the full read-only set table, with `Edit`. A compact volume chart sits on top.
6. **Progress shows one lift as a table.** You pick a lift, then read its sessions as rows (date · sets · e1RM · Δ). One small e1RM chart sits above the table, records sit as a three-cell strip, and the muscle map comes after.
7. **The PR is typographic and non-blocking.** A `PR` tag and `+2.5 kg` appear in the PREVIOUS cell. The row flashes in accent tint for 1.2 s, and a toast shows for 3 s.
8. **Program editing happens in place.** Rows carry drag handles. Tapping a row expands it into 56 px steppers and an AMRAP toggle, with `Remove exercise` (with Undo) and `Add exercise` / `Add workout`.

## Deviations from the brief

- **The row ✓ is an accent outline, not solid.** Two solid primaries would compete (director's call in revision 2).
- **PREVIOUS is 13 px secondary, not 15 px muted.** This keeps 6 sizes on the rest frames and holds numerals at 7:1.
- **The PR tag is 12 px, not 11 px,** for the same type-size budget.
- **Hero cells have no inline unit.** The sticky KG and REPS column header carries the units.
- **History's Workout B card shows loads, not best sets.** Part 1 has no set data for B sessions.
- **The plate caption reads `Per side, kg`.** In the drawing, the collar is outboard of the plates.

## Checklist (principles §5): honest self-check

| # | Result | Evidence |
|---|---|---|
| 1 | Pass | Grey page and white surfaces. Chromatic pixels are 4–11% per frame. |
| 2 | Pass | Accent #185C3F appears on the log bar, the outline ✓, focus, the active tab, the rest strip, PR, and `Finish` / `Save` (as the brief asks). `Edit` and `Add exercise` are now ink. The e1RM line is accent, as the brief specifies. |
| 3 | Pass | Family colours appear only in 8 px dots and bars. The heat ramp appears only in the body maps. |
| 4 | Pass | S4 uses 12 · 13 · 17 · 20 · 60 · 64. Weights are 400, 500 and 600. |
| 5 | Pass | `tabular-nums lining-nums` is set on every screen root and chart. |
| 6 | Pass | Cells and chips use 6 px. Cards, buttons and keys use 10 px. Sheet tops use 12 px. |
| 7 | Pass | Nothing is decoration: the plate drawing and the body maps encode data. |
| 8 | Pass | The active row is on the grid. S7b names ellipsize, so the value columns hold the 16 px margin. |
| 9 | Pass | Hairlines, plus one shadow on sheets and toasts. |
| 10 | Pass | One stroke rule everywhere: 1.75, or 2 for icons 16 px and under. |
| 11 | Pass | Sentence case, verb-led, units shown. |
| 12 | Pass | The hero is 60 px and the countdown is 64 px. |
| 13 | Pass | Numerals are ink or secondary (≥ 7.07:1 on fill). The PR delta is #124A33 on tint. The pending ✓ outline is #646B73. |
| 14 | Pass | Rows and pending cells are 56 px tall, the ✓ is 64 px, the SET hit area is 44 × 56, and keys are 64 px. |
| 15 | **Partial** | On rest frames the brief's 112 px dock replaces the full-width bar. `Skip` is its filled default. |
| 16 | Pass | `Finish` is at the top right. `Discard` is the last row. Delete is inside the set sheet. |
| 17 | Pass | The sticky header keeps the exercise name on screen during rest. |
| 18 | n/a | Light concept. |
| 19 | Pass | The sheet covers the tabs, and a 64 px mini-bar brings it back. |
| 20 | Pass | Only the dock bar is filled, or `Skip` during rest. |
| 21 | Pass | One tap logs and starts rest. |
| 22 | Pass | 1 tap to start. |
| 23 | Pass | Delete, swap, remove and discard all use an Undo snackbar. |
| 24 | Pass | Sheets never stack. Swap, info and history are full screen. |
| 25 | Pass | S8 covers the empty state and the offline line. The PR shows without a modal. Over-time shows `+0:12`. Finish early opens a sheet. |

**23 pass · 1 partial · 1 n/a.**

## Tap counts

| Task | Taps | Sequence |
|---|---|---|
| Start today's workout | 1 | `Start Workout A` |
| Log a set as planned | 1 | Dock bar or the row ✓ |
| Change weight one step, then log | 3 | KG cell → `+2.5` → `Log ✓` |
| Type a weight, then log | 4 | KG cell → `6` → `5` → `Log ✓` |
| Finish, all sets done | 1 | `Finish` |
| Finish early | 2 | `Finish` → `Finish workout` |

## Added shades

None. Workout A bars use secondary, Workout B bars use the control border, and `Skip` uses ink.

## Known limits

- `Start Workout B` (on Home after `Done`) opens a preview only.
- `Note ›` and `Add 3 warm-up rows` close the sheet.
- The swap list has one entry.
