# Review: Progress Dashboard (`mocks/progress-dashboard/`)

Reviewer: independent senior design review, 2026-10-13. Method: every board frame cropped at 1:1
from `board.png` (crops in `reviews/_crops/progress-dashboard/`). The prototype was driven with
injected click scripts (`t_flow.html`, `t_strip.html`, `t_set4.html` in the same folder) and
rendered in headless Chrome. The mock was not edited.

## Verdict on density: calm Home, borderline mid-set

- **Home (S1) stays disciplined.** It has three KPI tiles, one matrix, three lift rows and a docked
  Start. It reads like an analytics product, not an admin panel. The only noise is four `0 of 0`
  matrix rows that repeat the gap lines under them.
- **The set screen (S3) is at the limit.** It shows a header volume bullet, two counters, a
  segment control, the grid, last time, two 60 px steppers, the projection line, and three
  more-exercise rows, each with an empty bullet bar.
- **The rest frames (S4, S5a, F2) cross the limit.** They stack about ten bands: a 60 px weight
  hero and a 64 px countdown compete, and the only filled control is `Skip`. This is where the
  concept slides toward an admin panel.

## Interaction test (prototype P)

Verified by script:
- Start opens M1. `+` changes the load to 65 and the projection recomputes (`e1RM 78.0 · record 74.2 → PR if logged`).
- `Log set 3` shows the toast, sets `PRs 1`, shows the effort chips and starts rest at `3:00`.
- `+15` gives `3:15`. Two taps of `−15` give `2:45`.
- `Skip` leads to `Log set 4 · 62.5 × 8`. Logging set 4 shows `All 4 sets logged · Up next: Lunges`.
  Skip then moves to Lunges, set 1 of 3.
- Minimise gives the live strip (`Workout A · 14:13 · Rest 2:57 · Return`). The strip stays on the
  Lifts tab, and Return goes back to the session.
- `Finish` opens a sheet (`19 sets not logged`). `Finish workout` opens the summary. `Done` goes
  back to Dashboard.

The core loop works.

Broken or missing:
- Tapping a logged cell does nothing (`data-a="noop"`). There is no edit sheet, no delete, and no
  `Set deleted · Undo` anywhere.
- `Discard workout` is a no-op. It sits at the bottom of the Finish sheet, which is the thumb zone.
- When rest ends naturally, the danger-coloured `Rest over · +0:00` line appears at once and keeps
  counting. F3 does not show this line.

## Checklist (principles §5), scored independently

| # | Score | Evidence |
|---|---|---|
| 1 | Pass | The chrome is grey and white. Teal appears only in matrix cells, and family colours only in the S7a/S7b bars and 8 px dots. |
| 2 | Partial | Accent also colours text buttons (`Edit`, `Save`, `Return`, `+ Add exercise`, `Add a session note`), the progression arrow icons (S1, S6b) and the S8 check. That goes beyond primary, active, focus and PR. |
| 3 | Pass | Data colours stay in charts, the matrix and dots. |
| 4 | **Fail** | `.tag.sm` is 10 px. S4, S5a and F2 therefore use 7 sizes (10·12·14·16·20·60·64), and 10 px is under the 12 px label floor. The self-check claims 6. |
| 5 | Pass | `tabular-nums lining-nums` is set on body. The timer does not jitter. |
| 6 | Pass | Cards are 12, buttons 10, cells and chips 6. Pills appear only on tags. |
| 7 | Pass | No ornament. The PR is a tag, a delta and a sparkline. |
| 8 | Partial | The 16 px edge holds. S7b names wrap to two lines, so rows are ragged. The S5b KPI strip has unequal columns. |
| 9 | Pass | Hairlines throughout. Shadow appears only on sheets and the toast. |
| 10 | Pass | Lucide icons, 1.75 stroke. |
| 11 | Pass | Verb-led, sentence case, no exclamation marks. |
| 12 | Pass | Steppers are 60 px and the timer 64 px. |
| 13 | Partial | Planned-set numerals are muted `#62626F`: 5.57:1 on white and about 5.1:1 on fill. That misses the 7:1 numeral rule. Cases: the S3 set 4 cell `62.5×8`, the S2 future cells and the `×10` reps. |
| 14 | Pass | Steppers, chips and All-view cells are 56 px or more, with 8 px gaps. The segment control is 48 px, which the brief allows. Finish has a 56 px hit area around a 36 px visual. |
| 15 | Pass | `Log set` is 64 px at y 734–798, 46 px above the bottom. In rest, the button row sits at the same height. |
| 16 | Partial | Finish is top right. But `Discard workout` sits at the bottom of the Finish sheet (thumb zone), in danger red, with no undo or confirm. It is a no-op. |
| 17 | Partial | The brief mandates the extras (header bullet, projection, other-exercise rows), so this is a sanctioned deviation. In practice it is the busiest mid-set view of the four. |
| 18 | n/a | Light concept. |
| 19 | Pass | Tabs are hidden in Live. The strip was verified on the Dashboard and Lifts tabs. |
| 20 | Pass | One filled control per frame. Its semantics in S4 are questionable (see fix 3). |
| 21 | Pass | Verified: 1 tap, then rest at 3:00. |
| 22 | Pass | 1 tap from the dock. |
| 23 | **Fail** | No edit sheet, delete or Undo snackbar is designed or wired. The evidence `Set deleted · Undo` exists only in the self-check text. |
| 24 | Pass | Tools, keypad and finish are single sheets, never stacked. |
| 25 | Pass | S8 shows the empty state with one action and the offline line. The PR is a non-modal toast. Logging never waits on sync. |

**Tally: 17 Pass · 5 Partial · 2 Fail · 1 n/a.** The designer self-graded 24 Pass and 1 n/a.

## Scores (1–10)

| Axis | Score |
|---|---|
| (a) Professional, not childish | 8 |
| (b) Gym usability mid-set | 6 |
| (c) IA and flow clarity | 7 |
| (d) Visual craft | 7 |
| (e) Fidelity to brief | 7 |
| (f) Distinctness | 8 |

## Ranked fix list

1. **Blocker · S2 / P (no frame)** — The concept has no edit, delete or Undo path. Logged cells
   are `noop`, and `Set deleted · Undo` appears only in the self-check. Fix: tapping a logged cell
   opens an edit sheet with steppers, set kind, RIR and `Delete set`. Delete shows a
   `Set deleted · Undo` snackbar above the primary bar. Show this in S2 or wire it in P, and
   correct item 23.
2. **Major · S4 / S5a / F2** — The rest frame stacks about ten bands, and a 60 px weight competes
   with the 64 px countdown. This is where the dashboard becomes an admin panel. Fix: during rest,
   collapse the steppers into one row, `Next: set 4 · 62.5 × 8 · last 60 × 8`, that expands on
   tap. The countdown is then the only hero. Keep the effort chips.
3. **Major · S4 / S5a / F2** — `Skip` is the only filled accent control, so the loudest instruction
   on the rest screen is to abandon rest. Fix: make `−15`, `+15` and `Skip` equal outline buttons
   so the countdown leads. Or make the filled control `Log set 4` (the early log the brief allows).
4. **Major · S2 / S4 / S5a / S5b / F2 / F3** — Grid PR tags are 10 px (`.tag.sm`). That is a 7th
   size and below the 12 px floor. In S2 the tag also straddles the cell's top border. Fix: use a
   12 px tag everywhere, placed inside the cell's index row (`3 · PR`), not overlapping the border.
5. **Major · S2 / S3 / S4 / F1–F3** — Planned numerals are muted (5.57:1, about 5.1:1 on fill),
   under the 7:1 numeral rule. Fix: set future-cell values and All-view reps in secondary
   `#45454F` (8.78:1), and signal "planned" with the border style, not text contrast.
6. **Major · S1** — The DB bench press row shows a lone dot and `—`. This contradicts the canonical
   data (last time Fri 9 Oct; e1RM 14.8 → 15.0) and looks broken on the first screen anyone sees.
   The rationale's claim that it has no history is wrong. Fix: draw its sparkline and delta like
   the other rows.
7. **Major · S3 / F1 / F3** — Every other-exercise row carries a bullet bar that is empty at this
   point (0 against last), and Push-ups swaps in the word `bodyweight`. This is data with no
   information, mid-set. Fix: in Now, show only the set dots and the planned load. Show the
   bullet once an exercise has started, or only in All.
8. **Major · S6a** — The 4-week muscle matrix, required in S6a, is below the fold and never
   appears on the board. Fix: order the tab as calendar, matrix, volume chart, list, or compress
   the calendar so the matrix is visible.
9. **Minor · S4 / S5a / F3** — Elapsed time is frozen at `14:10` in every M1 frame. F3 comes after a
   full 3:00 rest and should read about `17:10`; S4 should read `14:22` and S5a `14:12`. Fix the
   values.
10. **Minor · S2 / S3 / S4** — The `W 3` cell is cryptic: `3` reads as a load. Done cells carry a
    check in Now but not in All. Fix: label it `W` with `3/3 done`, and use the same done marker
    (check plus fill) in both views.
11. **Minor · S1** — Muscle week lists four `0 of 0` rows (Hamstrings, Glutes, Calves, Abs), then
    repeats the gaps as text. This is noise on the busiest Home. Fix: drop the zero-planned rows,
    keep the 7 trained regions, and let the gap lines carry the rest.
12. **Minor · S7b** — Four exercise names wrap to two lines, and the editable cells are only about
    36 px tall, so the grid looks ragged. Fix: move Rest into the row's `⋯`, or narrow the
    numeric cells so names fit on one line. Use cells of at least 44 px.

Also noted, not ranked:
- Accent is overused on text buttons and icons (item 2).
- In S5a the toast leaves the header's bullet bar and `Sets 3/23 · PRs 1` peeking out under it.
- Header volume counts warm-ups but the S5b table excludes them, so there are two definitions of
  volume.
- The rest bar fills with elapsed time while the numeral counts down.
- The rest dock is 242 px, not the 152 px in the brief.
- Natural rest end shows red `Rest over · +0:00` at once.
