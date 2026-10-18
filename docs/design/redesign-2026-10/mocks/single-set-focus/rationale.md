# Single Set Focus: rationale (revision 2)

**Thesis.** One set at a time, as an instrument you can read from the bench. Everything else is one
tap away.

## Key decisions

1. **The set screen is a scoreboard, not a form.**
   - Weight and reps are 96 px Archivo at width 75, each between 64 px steppers.
   - The instrument is centred between the labels and the tools: weight row at y 304, reps row at
     y 464.
   - The bar `Log set 3 · 62.5 × 8` (64 px) sits at y 722–786.
2. **The set track is 5 cells, not 7.** Warm-ups collapse into one `W 3/3 ✓` cell, which opens
   Bar & warm-up. Cells are 63 × 56 with 8 px gaps. A cell shows its value only once it is logged.
3. **Rest is the calmest screen.**
   - The screen changes state rather than opening an overlay: a 248 px ring with a 120 px timer.
   - The progress arc is in ink over a surface-3 track. `−15 s` and `+15 s` are a centred pair.
   - Apricot appears only on `Skip rest` and the `PR` tag. The current track cell is outlined in
     neutral during rest.
   - At 0:00 the set card returns by itself.
   - Over-time drops to 96 px (`+1:05` fits inside the ring) in danger red, with an alert icon.
4. **The PR is a banner, not a modal.** A 56 px banner with a hairline border shows the solid `PR`
   tag and `Heaviest set · 62.5 kg × 8 · +2.5 kg` for 4 s. Track cell 3 keeps the tag. There is
   one tag style everywhere.
5. **Session context costs one tap.** The Session map has 64 px rows, 56 × 64 drag handles and a
   totals footer (`2 of 7 exercises done · 9 of 23 sets`).
   - Jumping during rest keeps the timer running as a `Rest 2:12 left` pill, which chimes at 0.
   - Tapping a logged cell opens an edit sheet. Deleting a set shows `Set deleted · Undo`.
6. **A calm dark.**
   - The base is graphite `#111315`, and elevation is a lighter surface only.
   - Danger moved to a cooler red, `#F06065`, about 30° away from the apricot. It always appears
     with an icon.
   - Secondary text buttons are set in ink.
7. **Gym contrast.** Every in-workout numeral uses at least `--muted #AEB5BD` (8.99:1 on bg,
   8.27:1 on surface-1). `--sec` is kept for non-numeric meta.

## Tap counts

| Task | Taps | Sequence |
|---|---|---|
| Start today's workout | 1 | Train → `Start Workout A` |
| Log a set as planned | 1 | `Log set 3` (rest starts automatically) |
| Change weight one step, then log | 2 | `+` → `Log set 3` |
| Type a weight, then log | 4 | Numeral → `6` → `5` → `Log` |
| Finish, all sets done | 1 | Rest screen primary after the last set: `Finish workout` |
| Finish early | 3 | `⋯` → `Finish early` → `Finish workout` |
| Next set after rest | 0 | At 0:00, set 4 returns pre-filled |

## Checklist (principles §5)

| # | Result | Evidence |
|---|---|---|
| 1 | Pass | Neutral share is about 89–97% per frame. The apricot primary bar is the largest accent area. |
| 2 | Pass | One accent: primary, current set/tab, focus underline, PR tag, e1RM line. On the rest screen only `Skip rest` and the PR tag are apricot. |
| 3 | Pass | Family colours only as dots and bars; the heat ramp only in the silhouette and legend. |
| 4 | Pass | S3: 13/17/20/96. S4: 13/15/17/20/40/120. Weights 400/500/600. |
| 5 | Pass | Tabular, lining figures on every element. |
| 6 | Pass | Radii 4 / 8 / 12. Pills only on the toggle. |
| 7 | Pass | The ring, bar drawing and silhouette are all data. The silhouette is now a single-stroke anatomical outline with clipped regions. |
| 8 | **Partial** | List screens hold a 20 px edge. The in-workout instrument is centred, but the Next card and RIR row on the rest screen are left-aligned. |
| 9 | Pass | Surface steps only; no shadows. |
| 10 | Pass | Lucide, 2.0 stroke. |
| 11 | Pass | Sentence case, verb-led, no `!`. |
| 12 | Pass | 96 px hero, 120 px timer. Over-time is 96 px. |
| 13 | Pass | In-workout numerals ≥ 7:1. Danger `#F06065` is 4.82:1 on surface-2 and 5.82:1 on bg. |
| 14 | Pass | Track cells 63 × 56 with 8 px gaps. Steppers and keys 64. Tools, chips, ±15 and top bar 56. Drag handle 56 × 64. Caveat: the keypad sheet's grabber (24 px) is a secondary dismiss; `Next` and `Log` close it too. |
| 15 | Pass | Primary at y 722–786, 58 px above the edge. |
| 16 | Pass | Finish early, Discard and Swap are in `⋯`. |
| 17 | Pass | Default view: exercise, set n/N, target, last time, inputs, Log. |
| 18 | Pass | Graphite base, desaturated apricot, a less orange rest screen. |
| 19 | Pass | Full-screen takeover; `×` gives the resume bar. |
| 20 | Pass | One filled primary per frame. |
| 21 | Pass | F1 → F2. |
| 22 | Pass | 1 tap. |
| 23 | Pass | Undo for delete, swap and remove. Confirm only for Finish early and Discard. |
| 24 | Pass | Short tools are sheets, never stacked; Swap, Info and History are full screen. |
| 25 | Pass | Empty + offline (S8), over-time, PR banner, resume bar, rest kept across a map jump. |

## Added shades

- `--bar-b #66707A`: the Workout B bars, 3.39:1 on surface-1.
- `--danger #F06065` replaces `#F07A6E`: 5.82:1 on bg, 4.82:1 on surface-2.
- Scrim: bg at 72%. Grid: white at 8% (as the brief specifies).

## Not fixed, and why

- **S7b still shows only the prescription sheet.** The brief makes the sheet full-height, so a
  Reorder state behind it cannot be seen. `Reorder` and `+ Add exercise` are on S7a, and they work
  in P.
- **S5b** shows the top of the summary page; the body map is below the fold (scroll it in P).
- **S8** leaves deliberate empty space above `Use A/B Split`. I removed the added workout rows.
