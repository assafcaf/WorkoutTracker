# Review: Set Table (`mocks/set-table/`)

Reviewer: independent senior design reviewer. Date: 2026-10-13.
Method: cropped every frame of `board.png` at 1:1 (`reviews/_crops/set-table/*.png`), read
`index.html` (CSS and JS) in full, and re-rendered 18 click-through copies of the prototype
(`reviews/_crops/set-table/t_*.html` → `P_*.png`, contact sheets `Pseq_0–4.png`). Contrast was
computed from the hexes (WCAG 2.x).

## Verdict in one paragraph

This is the most "finished-looking" kind of concept: cool grey, white, one deep green, Inter, tight
columns. It reads as a serious tool at first glance and is not childish. The prototype really works.
I clicked through start, log (PR toast, flash, rest from 3:00 in real seconds), −15 twice (2:28),
Skip (set 4 appears), timer hitting zero (`Rest is over · +0:01` in danger, dock back to
`Log set 4 · 62.5 × 8`), set 4 (`All 4 sets logged · Up next: Lunges`), Finish early
(`19 sets not logged` → `Finish workout`), summary, Done → Home, minimise (64 px mini-bar
`Workout A · 14:12 · Rest 2:58`), keypad (`+2.5` → 65, plates update to `20 · 2.5`), the tools,
rest and set-type sheets, delete/remove/discard with Undo, and the History, Progress and Library
edit pages. The self-check ("all pass") is too generous, though. One item fails outright (type
sizes on the rest frames). Eight are partial, and the craft slips in the places a picky owner
looks first: the program editor overflows, the plate drawing is wrong, and the exercise name
disappears during rest.

## Scores (1–10)

| | Score | Why |
|---|---|---|
| (a) Professional, not childish | **8** | Restrained palette, real tabular columns, typographic PR. Points off for the paper-doll body maps (lollipop heads, pill limbs) and the heavy ink-black plate in S3b. |
| (b) Gym usability mid-set | **7** | The 60 px hero and the 64 px ✓ are strong. But during rest the exercise name scrolls away (S4, S5a, F2), the rest dock plus the RIR row eats about 250 px with seven equal outlined buttons, and the pending-row input cells are 40 px tall. |
| (c) IA & flow clarity | **8** | The tabs, the minimisable sheet and finishing early are all clear and they work. The history detail isn't the set table the brief asks for, and Home after `Done` still offers `Start Workout A`. |
| (d) Visual craft | **7** | The base is clean, but: S7b columns overflow the right margin and the last row runs under the home indicator; there are 7 type sizes on rest frames; check strokes are mixed (1.75, 2.25 and 2.5); the plate diagram draws a phantom plate; the active row breaks the column grid; board labels collide. |
| (e) Fidelity to brief | **8** | Nearly every spec value is honoured (row heights, 136 px active row, 112 px trow, keypad 4 × 4 at 64 px, copy strings). Missing: `+4.6% volume` on the summary, a set-table session detail, tools as five rows (the last three are tiles), and body maps at ~120 px (S5b is 112, S6b is 104). |
| (f) Distinctness as its own concept | **5** | It is the category prototype by design, and the brief says so. The enlarged active row and the inline rest strip are its only signatures. Shown next to Strong or Hevy, an owner would struggle to say what is ours. |

## Checklist (principles §5), scored independently

| # | Item | Score | Evidence |
|---|---|---|---|
| 1 | Neutral field ≥ 85% | **Pass** | Chromatic pixels (max−min channel > 18) per frame: S1 9.1%, S2 9.8%, S3 9.6%, S3b 3.6%, S4 3.9%, S5a 4.2%, S5b 11.1%, S6a 3.7%, S6b 5.3%, S7a 7.2%, S7b 4.8%, S8 7.3%. |
| 2 | One accent, only primary/active/focus/PR | **Partial** | Only one accent hue. But it also colours non-primary text buttons: `Edit` (S7a), `+ Add exercise` and `Save` (S7b), and the e1RM line. Done-row checks are accent on tint. The brief sanctions `Finish` and done checks, not the rest. |
| 3 | Data colours only in data | **Pass** | 8 px family dots (S7a and S7b), bars (S6b, S7a), heat ramp only in the body maps. |
| 4 | ≤ 6 sizes, ≤ 3 weights | **Fail** | S4, S5a, F2 and P-rest use 12 (caps, PR tag, RIR sub), 13, **15** (`.prev` PREVIOUS `60×10`), 17, 20, 60 and 64, which is **7 sizes**. The self-check lists S4 as `12·13·17·20·60·64` and omits the 15. Weights pass (400/500/600). |
| 5 | Tabular lining figures | **Pass** | `font-variant-numeric: tabular-nums lining-nums` on `.scr`, charts and panel. The timer does not jitter in the live render. |
| 6 | Radii | **Pass** | Cells, chips and RIR chips are 6; cards, buttons and keys 10; sheet tops 12; PR tag 4; pills only on the toggle, grabbers and progress bars. |
| 7 | Zero decoration | **Pass** | No gradients, art or emoji. The plates and the body map encode data. |
| 8 | One left edge, numbers right-aligned | **Partial** | 16 px edge holds on most frames. In S7b, `Machine shoulder press` and `Narrow-grip pull-down` push their value groups right, so `7.5 kg` and `42.5 kg` end about 8 px past the right margin (x ≈ 382). The active row's hero cells don't sit under the KG/REPS headers (S2, S3). |
| 9 | One elevation system | **Pass** | Hairlines, plus one shadow on sheets and toasts. |
| 10 | One icon family, one stroke | **Partial** | Lucide throughout, but checks are drawn at 2.25 (rows, ✓ buttons, keypad) and 2.5 (column header) while every other icon is 1.75. |
| 11 | Copy | **Pass** | Sentence case, no "!", units shown. Nits: `kg plates` (S3b) is an odd caption, and `THIS WEEK … 1 of 3 this week` (S1) says "this week" twice. |
| 12 | Hero ≥ 60 px | **Pass** | Active-row numerals 60 px Inter Tight 600; countdown 64 px. |
| 13 | Contrast ≥ 7:1 numerals / ≥ 4.5:1 other | **Partial** | Numerals pass: ink 16.5, secondary on white 8.14, on fill 7.07. But the PR delta `+2.5 kg` in accent on the accent-tint flash is **6.89:1** (S5a, F2), and the pending-row ✓ outline (`#C9CED4` on white) is **1.58:1**, so the tap target is nearly invisible (non-text needs 3:1). Muted on fill (`kg` / `reps` units) is exactly 4.68. |
| 14 | Targets ≥ 56, keys ≥ 64, gaps ≥ 8 | **Partial** | Rows, ✓, rest buttons, RIR chips and keys all pass. Pending-row KG/REPS cells are **40 px tall** (`.cell{height:40px}`). The SET label hit area is 36 × 56 (`.chip::after inset:-14px -4px`), and that label opens the set-kind sheet. |
| 15 | Full-width primary bar in lower third | **Partial** | S2, S3, F1 and F3 pass: 56 px, bottom edge 42 px above frame bottom. S4, S5a and F2 have no bar. The lower third is seven equal outlined buttons, and the only primary is the 64 px ✓ at y ≈ 506–570. The concept spec sanctions this, but the foundation rule lists S4/S5a as in scope. |
| 16 | Destructive/rare actions away | **Pass** | `Finish` at the top right; `Discard workout` at the end of the scroll; `Delete set` inside the set-type sheet. |
| 17 | Default set view minimal | **Partial** | The table concept shows three warm-ups, two done sets, the note and a peeking next exercise (by brief). Worse, in rest frames (S4, S5a, F2, live P after Skip) the block header scrolls off, so **no exercise name is on screen**. |
| 18 | Dark theme rules | **N/A** | Light concept. |
| 19 | Tabs hidden in Now, return bar | **Pass** | Verified live: minimise shows the 64 px mini-bar `Workout A · 14:12 · Rest 2:58` above the tabs, and Today's CTA becomes `Resume Workout A`. |
| 20 | Exactly one visual primary | **Partial** | S2, S3, F1 and F3 have two equal-weight solid-accent masses: the 64 × 64 ✓ and the 56 px bar. They do the same action and the brief mandates both, but visually that is two primaries. Keypad state adds a third (`Log ✓` key). |
| 21 | 1-tap log + auto rest | **Pass** | Verified live: one tap on the dock bar starts rest at 3:00, ticking in real seconds (Date.now and a 250 ms interval). |
| 22 | Start ≤ 2 taps | **Pass** | 1 tap; opens at M1 with set 3 active. |
| 23 | Undo, not confirm | **Pass** | Verified live: `Set deleted · Undo`, `Back squat removed · Undo`, `Workout discarded · Undo`; swap is wired with Undo. |
| 24 | Sheets vs full screen, never stacked | **Pass** | Tools, rest, set type, finish and keypad replace each other (single `w.sheet`). Swap, info and history are full-screen pages. Nit: `Note ›` and `Add 3 warm-up rows` just close the sheet. |
| 25 | States | **Pass** | S8: empty state with one next step, plus the offline line. PR via toast, no modal. Over-time `+0:12` is wired and verified. |

**Tally: 15 Pass · 8 Partial · 1 Fail · 1 N/A** (the designer claimed 24 Pass, 1 n/a).

## Ranked fix list

1. **Major · S4, S5a, F2, P (rest)**: The exercise name scrolls off-screen during rest. Auto-scroll brings row 4 into view and pushes the `Back squat` header out, so from the bench you see `Workout A` and a grid of numbers. After set 4 the `All 4 sets logged` toast also covers the new `Lunges` header for 3 s. **Fix:** make the current block's header sticky under the sheet header (`position: sticky; top: 0` inside `.wbody`, 56 px, hairline), or prefix the rest dock with `Back squat · next set 4 of 4`. Anchor the toast below the sticky header.
2. **Major · S4, S5a, F2 (item 4)**: There are 7 type sizes on the rest frames because PREVIOUS is 15 px. The self-check claims 6. **Fix:** set `.prev` to 13 px/500 secondary (still 8.1:1), which drops 15 from all in-workout frames. Then correct the S4 line in the panel and in `rationale.md`.
3. **Major · S7b**: The program editor breaks. Long names push their value groups past the 16 px right margin (`7.5 kg` and `42.5 kg` end at x ≈ 382), so the columns stop aligning. The `Assisted pull-ups` row also runs under the home indicator. **Fix:** `.per .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}` (as `.ptr` already does), and add 34 px safe-area bottom padding to the edit page.
4. **Major · S3b**: The plate diagram is wrong. The secondary-grey rect at x 124 sits between the 20 and the 1.25, so the bar reads as three plates per side. The 20 kg plate is solid ink, which makes it the heaviest mass in the sheet. **Fix:** draw sleeve → 20 → 1.25 → collar (collar outboard). Fill the plates in secondary and control-border grey, not ink, and change the caption `kg plates` to `per side, kg` or drop it.
5. **Major · S4, S5a, F2**: The rest dock plus the effort row is about 250 px, a third of the screen. It holds seven equal outlined 56 px buttons, there is no primary in the thumb zone, and the countdown competes with a second `2:48` on the strip. **Fix:** keep the brief's 112 px dock as the dock. Show RIR as one 56 px line above it that collapses to `RIR 1 ›` once picked, or after 20 s. Make `Skip` the visually primary of the three (filled neutral-ink outline, or a wider text button) so the eye has a default.
6. **Minor · S2, S3 (item 14)**: The pending-row KG/REPS cells are 40 px tall, and the SET label hit area is 36 px wide. **Fix:** make the button 56 px tall with the 40 px fill drawn inside it, and widen the SET hit area to the full 36 + 8 px column at 56 px tall. Raise the pending ✓ outline from `#C9CED4` (1.58:1) to muted `#646B73`, so the per-row ✓ is visible as a target.
7. **Minor · S5b**: The canonical `Compared with the last Workout A: +4.6% volume` (§1.3) is missing. **Fix:** add a 13 px secondary line under the stat strip: `+4.6% volume vs last Workout A`.
8. **Minor · S2, S3, F1, F3 (item 20)**: There are two equal solid-accent log targets (the 64 ✓ and the full-width bar). **Fix:** the brief mandates both, so raise it with the director rather than change it unilaterally. If it stays, give the bar priority (it is in the thumb zone) and drop the ✓ to an accent outline with an accent check, keeping its 64 px size.
9. **Minor · S3, S2 (item 8)**: The active row breaks the grid. The set chip sits alone on line 1, and the 62.5 cell starts under SET/PREVIOUS instead of KG. **Fix:** put the set chip in the SET column, vertically centred on line 2. Start line 1's meta at the PREVIOUS x (60 px), so the SET column runs unbroken top to bottom.
10. **Minor · all in-workout frames (items 2, 10)**: The icon strokes and accent use are inconsistent. Checks are at 2.25 and 2.5, everything else at 1.75, and accent is used on non-primary text buttons (`Edit`, `+ Add exercise`). **Fix:** use one stroke (1.75, or 2 for icons ≤ 16 px) everywhere, and set `Edit` and `Add exercise` in ink (keeping the + icon in accent is acceptable only as an affordance glyph).
11. **Minor · P (History)**: The session detail is a run-on text list (`W 30×5 · W 45×3 · …`), not the read-only set table with `Edit` the brief specifies. **Fix:** reuse the done-row table (SET | KG | REPS) per exercise, read-only, with `Edit` in the top bar.
12. **Minor · board, S5b, S6b, P**: (a) The P label runs into the S1 label (`…FinishS1 · Today`), and the S7b label runs off the board's right edge. Shorten both notes. (b) The body maps are 112 px (S5b) and 104 px (S6b) against about 120 px. With pill limbs and a lollipop head they read toy-like, so use anatomical torso, deltoid and quad shapes at 120 px. (c) After `Done`, Home still shows `Start Workout A`; advance it to `Workout B`, which is now due.
