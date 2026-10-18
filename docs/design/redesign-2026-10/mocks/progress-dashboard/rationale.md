# Progress Dashboard: rationale (revision 2)

**Key decisions**
1. **Home is data, and Start is docked.** KPIs, the muscle-week matrix and lift sparklines scroll above a fixed 128 px Today panel. `Start Workout A` stays 1 tap away, in the thumb zone (S1). The Sessions and Lifts tabs are the densest screens of the four concepts on purpose; the live session is kept calm.
2. **The projection line is the signature.** `e1RM 75.0 · record 74.2 → PR if logged` is recomputed on every stepper or keypad change, using e1RM = kg × (1 + reps/40), which reproduces 62.5 × 8 → 75.0.
3. **Now and All are one screen.** Now shows one card, with the other exercises as rows of set dots and planned load. A bullet bar appears only once an exercise has started. All is a grid where any open cell logs that set as planned, and any done cell opens the edit sheet.
4. **During rest, the countdown is the only hero.** The steppers collapse to one 56 px row, `Next: set 4 · 62.5 × 8 · last 60 × 8`, which expands on tap. The other-exercise rows hide. `−15 s`, `+15 s` and `Skip rest` are equal outline buttons. A full-width bar plots elapsed rest against the `you usually rest 2:40` marker.
5. **Edits are reversible.**
   - Tapping a done cell opens `Edit set n` (S2b): the steppers, set kind, RIR, `Save set`, and `Delete set` at the top right.
   - Delete shows a `Set deleted · Undo` snackbar for 5 s, above the primary bar.
   - `Discard` sits at the top right of the Finish sheet, returns to the Dashboard and shows `Workout discarded · Undo`.
6. **PRs are records, not trophies.** A toast with a 48 × 20 sparkline that covers the header while it shows, a 12 px `PR` tag inside the cell's index row, and the counter ticking up.
7. **Planned is not muted.** Planned values use secondary `#45454F` (8.78:1). A dashed control-grey border marks a cell as planned. Done cells use fill plus a check in both views. The warm-up cell reads `W` and `3/3`.

**Derived numbers and data choices**
- The header volume includes warm-ups: 1,530 = 390 + 600 + 540. S2's `3,042 / 2,974 kg` follows the same rule.
- The S5b per-exercise volume excludes warm-ups, so it is a different measure from the header's. This is a known inconsistency.
- The S6a four-week matrix is built from the per-session counts in Part 1.
- DB bench press on S1 reads `15.0 · +0.2` with a 14.8 → 15.0 sparkline. This follows the Deadlift row's pattern, where 81.3 is the end of 78.0 → 81.3. Part 1's S1 list says `14.8`.
- Elapsed time per moment: S3 and F1 14:10, F2 14:11, S5a 14:12, S4 14:22, F3 17:10.

**Deviations from the brief**
- The live header text is 12 px, not 13, and the header is 96 px tall. The `Now | All` control is 48 px. Set-grid cells are 70 × 64, not 76 × 64.
- The rest dock is 152 px of panel, plus a 56 px offer row and a 72 px full-width rest bar.
- S2b is an extra frame at row 3, column 5. The panel shrinks to column 6 and shows results without evidence; the evidence is below.
- S7b moves Rest and `AMRAP last set` into each row's `⋯`, so the exercise names fit on one line.

**Added shade:** `--bar-b #8A8A97` (Workout B bars): 3.41:1 on white, which clears 3:1 for a non-text mark. Text on the heat ramp is ink on `#4E9DA4` (5.73:1) and white on `#1D6970` (6.35:1).

## Tap counts
| Task | Taps | Sequence |
|---|---|---|
| Start today's workout | 1 | Dock → `Start Workout A` |
| Log a set as planned | 1 | `Log set 3`, or the current cell in All |
| Change weight one step, then log | 2 | `+` → `Log set 3` |
| Type a weight, then log | 4 | Numeral → `6` → `5` → `Log ✓` |
| Finish, all sets done | 1 | `Finish workout` |
| Finish early | 2 | `Finish` → `Finish workout` |
| Delete a set, then undo | 3 | Done cell → `Delete set` → `Undo` |

## Self-check: 20 Pass · 4 Partial · 1 n/a
| # | Result | Evidence |
|---|---|---|
| 1 | Pass | Neutral chrome; colour only in charts, matrix cells, 8 px dots and tags |
| 2 | Pass | Accent is on primary bars, the active tab, current and selected cells, PR tags, record dots and `Save`. Text buttons and icons are now in ink. |
| 3 | Pass | Family colours only in the S7a/S7b bars and dots; the heat ramp only in matrix cells |
| 4 | Pass | Live frames use 12·14·16·20·60·64. The PR tag is now 12 px. Weights are 400/500/600. |
| 5 | Pass | `tabular-nums lining-nums` on body and buttons |
| 6 | Pass | Cards and sheets 12, buttons 10, cells, chips and inputs 6 |
| 7 | Pass | No ornament; dashed borders encode the planned state |
| 8 | **Partial** | The 16 px edge holds and S7b names now sit on one line. The S5b KPI strip still has unequal columns, because `9,840 kg` at 28 px needs a wider cell. |
| 9 | Pass | Hairlines; shadow only on sheets, the toast, the snackbar and the S7b impact panel |
| 10 | Pass | Lucide geometry, 1.75 stroke |
| 11 | Pass | `Log set 3`, `Save set`, `Delete set`, `Skip rest`; no exclamation marks |
| 12 | Pass | Steppers 60 px; the countdown 64 px is the only hero during rest |
| 13 | Pass | Planned numerals in secondary 8.78:1, ink 16.7:1, white on accent 8.86:1. Muted (5.57:1) is used only for labels. |
| 14 | Pass | Steppers, chips, cells, the next row and the snackbar's Undo are all ≥ 56 px; keys 64 px; gaps 8 px |
| 15 | **Partial** | Logging frames: a 64 px bar at y 734–798. Rest frames have three equal outline buttons and no filled bar, so the countdown leads. |
| 16 | Pass | `Finish` is in the top bar; `Discard` and `Delete set` sit at the top of their sheets; Swap and Info are in the ⋯ sheet |
| 17 | **Partial** | Rest is calm (about 6 bands). The logging frame still carries the header volume and the projection line the brief requires. |
| 18 | n/a | Light concept |
| 19 | Pass | Tabs hidden in the Live session; the live strip is on every tab (P) |
| 20 | **Partial** | One filled control on every non-rest frame. Rest frames have none, by design. |
| 21 | Pass | `Log set 3` → rest starts at 3:00 (F1 → F2; verified in P) |
| 22 | Pass | 1 tap |
| 23 | Pass | `Set deleted · Undo` and `Workout discarded · Undo`, both wired in P and shown on the board (S2b) |
| 24 | Pass | Tools, keypad, edit and finish are single sheets, never stacked |
| 25 | Pass | S8 empty + offline; PR non-modal; logging never waits on sync |
