# Review: Single Set Focus (Concept 2)

Reviewer: independent (did not make the mock). Date: Tue 13 Oct 2026.
Inputs: `mocks/single-set-focus/{index.html, rationale.md, board.png}`, `brief.md`, `research/principles.md`.

## Method

- Cropped all 16 frames, the header, the panel and the caption rows from `board.png` at 1:1 into
  `reviews/_crops/single-set-focus/`. Read each crop, and zoomed in on the set track, the bar
  drawing and the heat-map.
- Measured the neutral share of each frame. A pixel counts as non-neutral if its channel spread is
  greater than 24. Computed WCAG contrast for every text token on bg and on surfaces 1–3.
- Drove the live prototype P with a click-through harness (`_test*.html`, temp copies). The harness
  ran: start → log set 3 → ±15 → forced rest end → log set 4 → `Start Lunges` → over-time with the
  keypad open → pause and resume → delete a set and undo → `⋯` → `Finish early` → summary →
  `Done`. Each step's result was printed onto the board and rendered (`P_step*.png`, `testlog*.png`).

### Interaction result

The whole core loop works:
- `Log set 3` shows the banner `Heaviest set · 62.5 kg × 8 · +2.5 kg`, gives cell 3 a PR tag, and
  starts rest at 3:00.
- `+15` gives `3:15 of 3:15`.
- At 0 it auto-returns to `SET 4 OF 4`, pre-filled `62.5 × 8`, with `Rested …`.
- `Log set 4` gives `ALL 4 SETS LOGGED · UP NEXT: LUNGES` and the primary `Start Lunges`.
  `Start Lunges` lands on Lunges set 1 of 3.
- Over-time with the keypad open gives `+0:12` in danger.
- `×` gives the resume bar `Workout A · 14:12 · Resume`.
- `Set deleted · Undo` restores the set.
- Finish early asks for confirmation (`18 sets not logged`). After it come the summary and then
  `Done`, which returns to Train.

Defects found in P:
1. The over-time `+0:12` at 120 px is wider than the ring and runs into the stroke (`P_step8.png`).
2. In P, DB bench press at 12 kg is flagged as a PR (12 > 11), which contradicts the canonical
   2 PRs.
3. Jumping to an exercise from the Session map during rest drops the rest timer silently.

## Is this dark calm and premium?

Mostly, yes. It is a clear break from the rejected lime look:
- The graphite base (`#111315`) is not black.
- Elevation is only ever a lighter surface.
- Condensed Archivo numerals read as a scoreboard, not a toy.
- Neutral share is 89–97% in every frame.

What keeps it from "premium" is the **mass** of apricot rather than its hue:
- A solid 350 × 64 apricot slab sits at the bottom of almost every frame, about 10% of the area.
- On the rest screens the slab is joined by a 248 px apricot ring, the apricot current cell, the PR
  tag and the PR banner's apricot border. That is five accent shapes at once.

The rest screen, which should be the calmest moment, is the most orange. Whoop and Apple Fitness
keep progress strokes neutral or thin and let one action carry the colour. A second issue: danger
`#F07A6E` (coral) sits close in hue to apricot. So the over-time ring and `Remove from Workout A`
read as a second, warmer accent.

## Checklist (principles §5): 22 Pass · 2 Partial · 1 Fail

| # | Score | Evidence |
|---|---|---|
| 1 | Pass | Neutral share: S2 97.3, S3b 97.5, S6a 96.6, S6b 95.9, S7a 94.9, S3 91.4, S7b 91.1, S8 90.8, S4 89.9, S5a 89.8, S1/P 89.4, S5b 89.3%. All are above 85%, but the apricot bar alone is about 10%. |
| 2 | Pass | One accent, `#F2A65E`: primary bar, active tab, current cell, focus underline, PR tag, ring, e1RM line, resume outline and Undo. All of these are within the brief. Note that danger `#F07A6E` is near-hue and reads as a second warm accent (fix 10). |
| 3 | Pass | Family colours appear only as 8 px dots and bar fills (S7a); the heat ramp only in the silhouette and legend; the volume bars are neutral A/B. |
| 4 | Pass | S3 uses 13/17/20/96, S4 uses 13/15/17/20/40/120, S1 uses 13/15/17/32/40. Weights are 400/500/600. |
| 5 | Pass | `*{font-variant-numeric:tabular-nums lining-nums}`. The P timer does not jitter. |
| 6 | Pass | Cells and chips 4, cards, buttons and steppers 8, segment buttons 6, sheets 12. Pills only on the toggle; the avatar is circular. |
| 7 | Pass | No ornament. The ring encodes time, the bar drawing encodes plates. The silhouette is crude (ellipse "mannequin") but is data. |
| 8 | **Partial** | List screens hold a 20 px edge, with numbers right-aligned (S1, S6b records, S7a). The in-workout frames mix three logics. In S3 the labels and values are centred, the tools are edge-to-edge and the track is centred. In S4 the ring is centred, `−15 s`/`+15 s` are pinned to opposite edges with a 158 px gap, and the Next card and RIR are left-aligned. In S3b the plate labels sit at random (`1.25` above, `20` below, right side only). |
| 9 | Pass | Only surfaces bg → s1 → s2 → s3; no shadows. |
| 10 | Pass | Lucide paths, stroke 2, round caps, used throughout. |
| 11 | Pass | `Log set 3`, `Skip rest`, `Start Lunges`, `Use A/B Split`, `Keep training`. No `!` (grep confirmed). |
| 12 | Pass | Hero 96 px (S3), timer 120 px (S4). |
| 13 | **Partial** | Hero `#F5F6F7` is 17:1 and the label on the accent is 9.15:1. But in-workout numerals in `--sec #8B939C` fall below 7:1: `Last time 60 × 9 · Fri 9 Oct` (a mandatory default-view item) is 5.99:1 on bg; `Last time 60 × 8` on the Next card is 5.50:1 on s1; the future cell `62.5×8` is 5.99:1. On s2: the S3b sub-lines `Per side: 10 · 2.5` are 4.96:1, and the S2 current-row meta `2/4` (muted on s3) is 6.53:1. |
| 14 | **Fail** | Set-track cells are 46 × 56 with **4 px gaps**, so they miss both the 56 px and the 8 px rules. They are tap targets (edit/delete) on every set and rest screen. The S2 drag handle hit area is 24 px wide. The panel self-grades this as "Pass*"; the rationale says "Partly". |
| 15 | Pass | The primary sits at y 722–786 (64 px), 58 px above the frame bottom. |
| 16 | Pass | Swap, Info, History, Rest time, Finish early and Discard are all in `⋯`. Minor: `Delete set` sits directly under `Save set` in the edit sheet. It is undoable, so this is acceptable. |
| 17 | Pass | S3 shows the exercise, `SET 3 OF 4 · TARGET 8–10`, last time, the inputs and Log. Plates, warm-up, type and note are one tap away. |
| 18 | Pass | Graphite `#111315`, a desaturated apricot, no pure black. The concern is the amount of accent, not its saturation (see the section above). |
| 19 | Pass | Full-screen takeover with no tabs. `×` gives the 64 px resume bar; verified in P. |
| 20 | Pass | One filled primary per frame. Sheets carry their own primary. |
| 21 | Pass | Verified: one tap on `Log set 3` starts rest at 3:00 automatically. |
| 22 | Pass | One tap: `Start Workout A`. |
| 23 | Pass | `Set deleted · Undo` verified. Swap and remove-exercise both show Undo. Confirms appear only for Finish early and Discard. |
| 24 | Pass | Keypad, Bar & warm-up, Set type, Note, Rest time and Edit set are sheets, and they never stack. Swap, Info and History are full screen. |
| 25 | Pass | S8 shows the empty state with `Offline · saved on this phone` and one primary. The PR shows as a banner, not a modal. Logging never waits on sync. |

## Scores (1–10)

| | Score | Why |
|---|---|---|
| (a) Professional, not childish | **8** | Restrained graphite, scoreboard numerals and tight radii read as a tool. It loses points for the apricot slab and ring mass on the rest screens and for the mannequin silhouette. |
| (b) Gym usability mid-set | **8** | 96/120 px numerals, 64 px steppers, keys and primary, 1-tap log and 0-tap next set are excellent. It loses points for undersized track cells and sub-7:1 `Last time` numerals. |
| (c) IA & flow clarity | **8** | Three tabs, a takeover workout mode, a one-tap Session map and auto-advance all work end to end in P. It loses points because session context is hidden by design, the rest timer drops silently on a jump, and P shows a spurious DB bench PR. |
| (d) Visual craft | **7** | It loses points for the over-time overflow, the dead 110 px band in S3, the cramped track, the orphaned ±15 buttons, the scattered plate labels, two PR-tag styles, a truncated heat legend, and a validation message shown on valid input. |
| (e) Fidelity to brief | **8** | Close overall. S3b hides the mandated `Log` and `Skip warm-ups`. S6b family bars and gap lines are below the fold. S7b does not show reorder or add. F3 invents `17:22`. S8 adds workout rows. The self-check overstates item 14. |
| (f) Distinctness as its own concept | **9** | Unmistakable: a dark instrument, a ring timer, and one set at a time. Nothing else in the set looks like it. |

## Ranked fix list

1. **Major · S3, S4, S5a, F1–F3: the set track is the most cramped thing on the calmest screen.**
   - The problem: seven 46 × 56 cells with 4 px gaps and 13 px condensed values fail rule 14. The
     PR tag in cell 3 is squeezed (`3 PR`).
   - The fix: collapse the warm-ups into one cell (`W 3/3 ✓`). That leaves 5 cells of about 63 px
     with 8 px gaps. Show a cell's value only once it is logged.

2. **Major · S4, S5a, F2: there is too much apricot on the rest screen.**
   - The problem: the ring arc, a 64 px solid bar, the PR banner border, the current cell and the
     PR tag make five accent shapes. The rest moment should be the calmest.
   - The fix: draw the ring's progress arc in `--text #E8EBEE` over an `--s3` track. Make the PR
     banner border `--hair`, so only the `PR` tag is apricot. Keep the accent for `Skip rest` and
     the tag.

3. **Major · P (over-time): `+0:12` at 120 px overflows the 248 px ring and collides with the stroke.**
   - The fix: set the over-time timer at 96 px, or condense it further. Keep the glyph run at or
     under 210 px wide, and test `+1:05`.

4. **Major · S3, F1, F3: a dead band of about 110 px between the reps row (ends at y ≈ 540) and the tools (y 650).**
   - The problem: the instrument looks top-heavy and unfinished.
   - The fix: redistribute the space. Weight row at about y 296, reps row at about y 456, and the
     divider centred between them. Alternatively, centre the value block between the labels and
     the tools row.

5. **Major · S3, S4, F3: secondary numerals sit under the 7:1 gym rule.**
   - The problem: `Last time 60 × 9 · Fri 9 Oct`, the delta lines, the Next card's
     `Last time 60 × 8` and the future cells all use `--sec` (5.5–5.99:1).
   - The fix: use `--muted #AEB5BD` (8.99:1 on bg, 8.27:1 on s1) for every in-workout numeral.
     Keep `--sec` for non-numeric meta only.

6. **Major · S3b: the brief-mandated per-row `Log` buttons and `Skip warm-ups` are not visible.**
   - The problem: the frame shows only `✓ Logged` × 3, so the owner never sees how a warm-up is
     logged.
   - The fix: render S3b at the moment warm-up 3 is pending: rows 1–2 `✓ Logged`, row 3 with an
     outline `Log`, and `Skip warm-ups` below. Note the moment in the frame label.

7. **Minor · S4, S5a, F2: `−15 s` and `+15 s` are pinned to opposite edges with a 158 px gap.**
   - The problem: they read as orphans and break the centred axis.
   - The fix: centre the pair under the ring, 96 × 56 each with a 16 px gap (x ≈ 91 and 203).

8. **Minor · S6b: the Body block is cut off by the tab bar.**
   - The problem: the legend stops at `10–20` (`21+` is missing), and the family bars and gap lines
     the brief puts in this frame are not visible.
   - The fix: tighten the chart card (by about 16 px) and the record rows (40 → 36 px). Put the
     silhouette and legend side by side at a smaller size, so all 4 swatches and at least the
     first gap line clear y 760.

9. **Minor · S7b: `Max reps must be at least min reps` shows while 8 ≤ 10.**
   - The problem: valid input reads as an error, and the frame never shows reorder or add.
   - The fix: show the hint only when invalid, in danger with its icon. Show the S7a Reorder state
     (drag handles on, `+ Add exercise`) in the frame behind the sheet, or as the S7b moment.

10. **Minor · S7b, P: danger `#F07A6E` is about 25° from the apricot.**
    - The problem: `Remove from Workout A` and the over-time ring read as a second accent.
    - The fix: shift danger to a cooler, deeper red (for example around `#E5484D`). Verify at least
      4.5:1 on s2, and always pair it with the icon.

11. **Minor · S5b: the PR tag has two styles.**
    - The problem: it is solid in New records and an outline in Exercises, and the `PRs` stat label
      breaks the caps style of its siblings.
    - The fix: use one tag style (solid) everywhere and set the label as `PRS` caps like the others,
      or rename it `RECORDS`.

12. **Minor · S2: the Session map is not finished.**
    - The problem: the in-product instruction line `Drag an upcoming exercise to reorder. Tap any
      row to go to it.` is followed by 200 px of empty sheet, and the drag-handle hit area is 24 px
      wide.
    - The fix: delete the hint line, and give the handle a 56 × 64 hit area. Optionally show today's
      totals (`9 of 23 sets · 31:40`) as a footer.

### Also noted (below the cut)

- **S6b/S5b silhouette.** It is built from stacked ellipses, so it reads as a mannequin. Use a
  smoother anatomical outline.
- **F3.** The elapsed clock `17:22` is not in Part 1. Use `14:10` or omit the time.
- **P.** DB bench press at 12 kg triggers a PR banner, which contradicts the canonical 2 PRs.
- **P.** A Session-map jump during rest discards the rest timer without notice.
- **Panel.** It self-grades item 14 "Pass*" while `rationale.md` says "Partly". The green "Pass"
  uses the legs data colour as UI text.
- **S8.** The program card adds Workout A/B rows that the brief does not list, and leaves a 270 px
  void above the primary.
