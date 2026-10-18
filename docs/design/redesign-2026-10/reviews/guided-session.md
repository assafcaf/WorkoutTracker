# Review: Guided Session (`mocks/guided-session/`)

Reviewer: independent senior design review, 2026-10-13. Method: I cropped all 16 frames from `board.png` at 1:1 and zoomed into details; read the full `index.html`; and ran a click-through harness (`reviews/_crops/guided-session/_test.html` → `_test.png`, log in `_t_log.png`). I measured contrast with the WCAG formula and the neutral-pixel share for each frame. The designer self-graded all 25 items Pass. I did not take that on trust.

## Verdict in one paragraph

This is the most coherent concept *as an idea*. The rail stream, coach copy, a hub with no tab bar and a Session plan with `Do next` hang together, and the live prototype really does run end to end. The serif is handled with restraint: Newsreader 500, navy ink, tight tracking, no italics, never on numbers. On Today, the Summary and Program it reads like an editorial sports page, not quaint. Two things hold it back. First, the in-workout frames are less disciplined than the hub: the rest frames break the neutral-field rule, numerals sit in muted grey, the PR banner wraps badly, and the 40 px done lines fail the tap-target gate. Second, the overall warmth (a brick-rust bar, a peach banner and serif sentences on an off-white page) is the light concept closest to the owner's rejected "ivory + pastel" look. It is not pastel. It does read "artisan" more than "sporty" in S4/S5a/F2.

## Interaction test (verified, not assumed)

Harness log, in sequence:

| Step | Result |
|---|---|
| Today → `Start Workout A` → briefing → `Begin` | Opens at M1; primary `Done · 62.5 × 8`. **2 taps ✓** |
| `Done` (set 3) | PR banner shown, timer `3:00` and running, primary `Skip rest`. **1 tap ✓** |
| `+15 s` | Offer `Use 3:15 for Back squat` ✓ |
| `Skip rest` | `BACK SQUAT · SET 4 OF 4`, `62.5 kg × 8` ✓ |
| `Done` (set 4) | Coach line `All 4 sets logged · Up next: Lunges, 3 × 10–12 at 8 kg.`, no false PR ✓ |
| Skip | `LUNGES · SET 1 OF 3` ✓ |
| Values → `+` | Sheet primary `Done · 9 × 12` ✓ (1 kg dumbbell step) |
| `⋯` → Pause | Today shows the Resume card ✓ (copy differs from the brief) |
| Resume, then Done/Skip ×38 | Reaches the `End of Workout A` Finish card, primary `Finish workout` ✓ |
| `Finish workout` | Summary `Workout A, done.` ✓ |
| Summary `Done` | Today, session cleared ✓. **But** it reads `Workout A today.` / `Start Workout A` again |
| Rest past 0 with a sheet open | `+0:12` over-time in danger ✓. Closing the sheet auto-advances to set 4 ✓ |

**The Finish-card click path works.** Defects found while running it:
- after finishing, Today does not reflect the finished session;
- the simulation gives DB bench press a PR (12 kg > 11 kg) that is not in the canonical data (summary: 2 PRs, both Back squat);
- the last exercise's sets show as bare `Set 1 · Set 2 · Set 3` lines with no exercise name;
- the final set gets no rest card and no effort question;
- in live mode, coach lines break values across lines (`Last time 8 / × 12.`).

## Measurements

- **Neutral share** (pixels with chroma > 18, navy ink counted as neutral). Rest frames fail the ≥ 85% rule: S4 82.9%, S5a 79.2%, F2 79.3%. All others are 88.8–96.4%. The rationale's "banner ≈ 6% of S4" leaves out the full-width rust bar, the rust drain bar and, in S5a/F2, the lit set-3 row.
- **Contrast:**
  - muted `#5E6573` on page: 5.46:1;
  - secondary on page: 8.73:1;
  - accent `#9A3412` text on tint: **6.39:1** (the `New PR` label);
  - accent-pressed `#7F2A0E` on tint: 8.20:1;
  - upcoming node `#C8C8C1` on page: 1.57:1 (graphic only).
- **Tap targets:** done lines are **40 px with 0 px gaps**, and they are buttons in live mode (`data-act="editset"`). The Session plan back button (in-workout) is 44 px. The primary is 64 px at y 738–802, 42 px clear of the bottom. Tools, ±15 s, RIR chips and `Do next` are 56 px. Steppers are 64 px.
- **Serif count:** S6a has 4 serif elements (`History` plus the group headings `This week`, `Last week`, `Week of 28 Sep`), against the brief's "at most 2 per frame".

## Checklist (principles §5), scored independently

| # | Score | Evidence |
|---|---|---|
| 1 Neutral ≥ 85% | **Partial** | S4 82.9%, S5a 79.2%, F2 79.3%: peach banner + lit row + rust bar + drain bar. Other frames pass. |
| 2 One accent, role-bound | **Partial** | One hue, mostly on-role. Also used as link/text colour for `Edit` (S7a), `Save` (S7b) and `Add exercise…`. Full rust bars for `Close` (Plates sheet) and `Save note` spend the primary on non-actions. |
| 3 Data colours in data only | Pass | Family colours only in the S6b/S7a bars and the 8 px dots in Exercises. The heat ramp only in body maps. |
| 4 ≤ 6 sizes, ≤ 3 weights | Pass | S3: 12/15/17/20/22/64. S4: 12/15/17/22/80. S5b: 12/15/17/20/22/34. Weights 400/500/600. |
| 5 Tabular figures | Pass | `tabular-nums lining-nums` on body and in the SVGs. Serif sentences wrap figures in Plex. (The `×` is not wrapped and renders in Newsreader, smaller; see fix 5.) |
| 6 Radii | Pass | Cards 8, sheets 12, buttons/chips/tokens 6, tags 4, toggles pill. |
| 7 Zero decoration | Pass | The rail encodes progress and the body map encodes sets. No gradients or trophies. |
| 8 One left edge, numbers right | **Partial** | `Warm-ups 3 done` pushes its value about 27 px right of `Set 1 60 × 10` (S3). On S6a, `13 Oct` and `9,840` run into the chart card's right border. |
| 9 One elevation method | Pass | Hairlines; one shadow, on sheets. |
| 10 One icon family/stroke | **Partial** | Lucide geometry, but strokes are mixed: 1.5 (most), 2 (`⋯`, timer, arrow, check in the offer) and 2.5 (rail checks). The rationale claims 1.5 throughout. |
| 11 Copy | Pass | Sentence case, verb-led, no exclamation marks. |
| 12 † Hero ≥ 60 px | Pass | Values 64 px, timer 80 px. |
| 13 † Contrast 7:1 numerals | **Partial** | Numerals in muted (5.46:1): top-bar elapsed `14:10` on every in-workout frame, the upcoming `Set 4 62.5 × 8–10`, the next card's `Last time 60 × 8`, and the Session plan's `31:40 · 9 of 23 sets`. The `New PR` label is 6.39:1. |
| 14 † Targets ≥ 56, gaps ≥ 8 | **Fail** | Done lines are 40 px tall with 0 px gaps, and tappable (edit set): 3–4 per in-workout frame. The Session plan back button is 44 px. The board panel prints this row as a plain "Pass"; only `rationale.md` admits the deviation. |
| 15 † Primary placement | Pass | Full width, 64 px, bottom edge 42 px above the frame bottom. |
| 16 † Rare actions away | Pass | Pause, Finish early and Discard (danger + icon) are in the `⋯` sheet. |
| 17 † Minimal set view | Pass | Beyond the minimum: the coach line, tools row and dimmed next step. All are brief-mandated, and the brief wins. |
| 18 Dark theme | n/a | Light only. |
| 19 † No tab bar, return path | Pass | Full-screen stream; Pause → Resume card (verified). |
| 20 One primary per screen | Pass | One rust bar per frame. The Resume card replaces the dock. |
| 21 † 1-tap log, auto rest | Pass | Verified in the harness. |
| 22 Start ≤ 2 taps | Pass | Verified. |
| 23 Undo over confirm | Pass | `Set deleted`, `Swapped to Front squat`, `Workout discarded`, `<exercise> is next`, `<line> removed` all use Undo. The only confirm is Finish early. |
| 24 Sheets vs full screen | Pass | Short tools are sheets; Plan, Swap and Info are pages. The `⋯` → Finish-early confirm replaces the sheet rather than stacking. |
| 25 States designed | **Partial** | Empty + offline (S8), PR, and over-time are done. No error state anywhere (no sync error, no failed save), and the post-session Today state is missing (Today reverts to `Start Workout A`). |

**Tally: 17 Pass · 6 Partial · 1 Fail · 1 n/a.**

## Scores (1–10)

| Axis | Score | Why |
|---|---|---|
| (a) Professional, not childish | **7** | The serif reads editorial, not quaint, in S1/S5b/S7a: restrained weights, navy ink, 8 px radii, a strong left rail. Deductions: rust-brick + peach warmth in the rest frames, mannequin-like body maps in S6b, and four serif headings on History, which reads bookish. |
| (b) Gym usability mid-set | **6** | A 64 px hero, a 64 px bar, 1-tap logging and auto-advance are all solid. But a 2-line 22 px serif sentence takes the prime slot above the hero. The rest card stacks banner + timer + ±15 + bar + coach line + RIR + next card. Done lines are 40 px with no gaps, and numerals are in muted grey. |
| (c) IA & flow clarity | **8** | The hub, stream and Session plan with `Do next` form a clean mental model, and the whole loop works. Deductions: Today after finishing, Resume copy, and the unlabelled final-exercise lines. |
| (d) Visual craft | **6** | Wrap with a dangling separator in the PR banner; values broken across lines; serif `×`; chart labels hitting the card border; a broken value column; mixed strokes; the S7b header wrap. |
| (e) Fidelity to brief | **8** | Nearly every specified string, size and frame is present. Misses: the serif count on S6a, Resume copy, S7b not showing Add, and the over-time reinterpreted (shown only while a sheet is open; defensible). |
| (f) Distinctness | **8** | No other concept has the rail stream, the coach voice, or a Session plan with reordering. It owns its idea. |

## Ranked fix list

1. **Major · S4, S5a, F2. Problem:** the PR banner title wraps as `New PR · Heaviest set ·` / `62.5 kg × 8`, with a separator dangling at the line end. This is the first thing a picky owner sees on the hero moment. **Fix:** set it as two intended lines. Line 1: `New PR · Heaviest set`. Line 2: `62.5 kg × 8 · +2.5 kg on Friday`, Plex 15/500 secondary. Use `white-space: nowrap` on each phrase.
2. **Major · S3, S4, S5a, F1–F3, P. Problem:** done lines are 40 px tap targets with 0 px gaps (item 14 fails), and the board panel reports it as "Pass". **Fix:** either make done lines 56 px pitch (the rail still compresses), or make them non-interactive in the stream and move "edit a logged set" to the Session plan row or a `⋯` item. Raise it with the director as a brief conflict, and correct the panel row to Fail/Deviation.
3. **Major · S4, S5a, F2. Problem:** the neutral field is 79–83%, under the 85% gate. **Fix:** drop the tint fill on the lit set-3 row (the `PR` tag plus a 2 px accent left rule is enough). Render the banner as a white inset with a 3 px accent left rule and ink text instead of a peach fill. Keep the drain bar.
4. **Major · all in-workout frames. Problem:** numerals in muted at 5.46:1 (elapsed `14:10`, upcoming `62.5 × 8–10`, `Last time 60 × 8`, `31:40 · 9 of 23 sets`), and `New PR` at 6.39:1 on tint. **Fix:** put every numeral in secondary `#3E4757` (8.73:1) or ink. Dim upcoming steps with weight and the hollow node, not with ink. Set `New PR` in accent-pressed `#7F2A0E` (8.20:1 on tint) or ink.
5. **Major · P (live) and S3/F3 coach lines. Problem:** values break across lines (`Last time 8 / × 12.`), and the `×` renders in Newsreader at a different size and baseline from the Plex figures around it (`60 × 10`). **Fix:** extend `C()` to wrap whole expressions (`\d[\d.,]* × \d+`, plus `kg`) in one `.n` span with `white-space: nowrap`.
6. **Major · art direction, rest frames. Problem:** a rust-brick 64 px bar, a peach banner and two serif sentences on `#F7F7F5` drift warm and "artisan". This is the light concept closest to the owner's rejected ivory/pastel look, and the least "sporty". **Fix:** in workout mode, limit serif to one element (the step card's coach line). Set the rest card's coach line in Plex 17 secondary. Use the white surface for the active card, as already done, and keep the peach tint off large areas (see fix 3).
7. **Minor · S6a. Problem:** `13 Oct` and `9,840` collide with the chart card's right border, and 4 serif elements break the ≤ 2 rule. **Fix:** raise `volChart` right padding from 8 to 24. Set the group headings as 12 px caps or Plex 17/600, which keeps "editorial" by spacing, not by serif.
8. **Minor · P, end of flow. Problem:** after Finish → `Done`, Today still says `Workout A today.` / `Start Workout A`, contradicting the summary's `Next: Workout B, Thursday.` The simulation also awards DB bench press a PR that is not in the canonical data. **Fix:** add a post-session Today state (headline `Workout A, done.`, Workout B card for Thursday). Limit PR detection to the canonical PRs.
9. **Minor · P, Finish card. Problem:** the final exercise's sets show as bare `Set 1 · Set 2 · Set 3  20 × 12` with no exercise name, and the last set skips rest and the effort question. **Fix:** collapse it to `Cable push-down  3 sets · best 20 × 12` when the Finish card appears, and put the `How did set 3 feel?` chips on the Finish card.
10. **Minor · S3, F1. Problem:** the value column breaks: `Warm-ups  3 done` starts its value about 27 px right of `Set 1  60 × 10`. **Fix:** a fixed 76 px label column for all done lines (`.dl .lb { width: 76px }`).
11. **Minor · S7b. Problem:** the frame does not show how Add works (`Add exercise…` is hidden under the sheet). The header sentence also uses a forced `<br>` that leaves the `[Three]` token stranded. **Fix:** scroll the frame so `Add exercise…` sits above the sheet, or open the sets token (a shorter sheet). Set the header as `[Three] sessions a week` on one line in edit mode.
12. **Minor · global. Problems:** icon strokes are mixed (1.5 / 2 / 2.5). The Resume card reads `Exercise 2 of 7 · 14 min` instead of the brief's `3 of 7 exercises · 31 min` format, under a stale `Back squat moves up to 62.5 kg` paragraph. Body-map silhouettes read slightly mannequin/paper-doll. **Fix:** use a 1.5 stroke everywhere (document any exception). Use the brief's Resume copy, and swap the paragraph for the current step (`Next: DB bench press, set 3 at 12 kg.`). Use narrower shoulders, a smaller head and no neck block, so the figure reads anatomical.
