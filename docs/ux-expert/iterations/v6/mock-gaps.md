# Mock gaps: the four redesign mocks against the app (v6, 2026-11-16)

**Sources.** The mocks are `docs/design/redesign-2026-10/mocks/{progress-dashboard,set-table,single-set-focus,guided-session}/`. I read each `index.html` in two ways: the board text rendered through jsdom, and the prototype-only sheets and pages in its JS (briefing, swap, info, settings, finish, notes). I also read `rationale.md` and looked at `board.png`. The app is branch `ux-loop-v6` at `f1a3118`. I judged it from `src/` plus the shots in `v6/recheck/` and `v6/*/after/`. I did not drive the app.

**Reading the status column**
- **Conflicts** means an earlier UX iteration removed or changed the mock's version on purpose. The finding ID is cited. Don't re-add these without an owner ruling.
- **Progress Dashboard (PD) was the concept the owner picked** (2026-10-13). The other three mocks — Set Table (ST), Single Set Focus (SSF) and Guided Session (GS) — are alternatives. Their navigation and theme differences are not gaps.
- **"verify"** marks a row I inferred from code and did not see in a shot.

## 1. Inventory

### Navigation
| # | Feature (mock · screen · copy) | Status | Evidence |
|---|---|---|---|
| N1 | Tab shell: PD `Dashboard · Sessions · Lifts · Program`; ST `Today · History · Progress · Library`; SSF `Train · Progress · Program` | **in app** as `Train · Progress · Sessions · Program` | recheck/01 |
| N2 | GS: no tab bar. Today is a hub, and History, Progress, Program, Exercises and Settings are pushed pages | **conflicts**: tabs follow PD | — |
| N3 | Workout is full-screen with the tabs hidden. It minimises to a live strip (PD, 48 px), a mini-bar (ST), a resume bar (SSF), or Pause → Resume card `Workout A in progress · Resume` (GS) | **in app** | `ui/LiveStrip.tsx` (shows `Rest m:ss`), `DashboardView.tsx` ResumeDock |
| N4 | Settings from a gear or avatar on Home (all) | **in app** | recheck/01 |
| N5 | One Lift page you can reach wherever a lift name appears (PD S6b, ST S6b, SSF S6b) | **in app** | `routes.ts` `{tab:'lift'}` (V6-03), recheck/30, 38 |

### Plan: Train / Today
| # | Feature | Status | Evidence |
|---|---|---|---|
| H1 | Today's workout as rows of sets × reps × kg, `7 exercises · 23 sets · ~53 min`, `Last done Fri 9 Oct` (ST S1, SSF S1, GS S1, PD dock) | **in app** | recheck/01 |
| H2 | Week strip `1 of 3 this week`, M–S days (ST S1, GS "This week", SSF header) | **in app** | recheck/01 (`2 of 3 ›`) |
| H3 | Progression hint `Back squat — try 62.5 kg` (PD, ST, SSF) | **in app**, per row: `↑ Ready for 15 kg` | recheck/01 |
| H4 | GS coach paragraph: `Back squat moves up to 62.5 kg. Everything else as last Friday.` | **partly**: per-row markers only, no sentence | recheck/01 |
| H5 | `Do Workout B instead` (SSF S1) | **in app** as `Change` | recheck/01, 16 |
| H6 | Sync stated in words: `Synced 2 min ago` (PD, ST, GS) | **partly**: icon with a red dot. Text exists only for the error case (`Not synced · saved on this phone`) | recheck/01, `DashboardView.tsx:98` |
| H7 | Home KPIs `This week vs last week`: `Sessions 1/3 vs 3 · Sets 23 vs 75 · Volume 8,920 vs 27,240` (PD S1) | **conflicts / partly**: on Progress as the headline `This week 2 of 3 sessions` plus a `Last week` card. Train is today's workout (V2-05) | progress/after/01 |
| H8 | `Muscle week · sets done · of planned` matrix on Home (PD S1) | **conflicts**: one home for muscles is Progress › Muscles (V2-06), linked from Progress | progress/after/01 |
| H9 | Lift sparklines on Home (`Lifts · e1RM, kg · 3 weeks`, PD S1; `Your lifts`, GS S1) | **in app on Progress**, not on Train (V2-05) | progress/after/01 |
| H10 | `Recent` sessions and `All history` on Home (GS S1) | **conflicts**: the Sessions tab covers this | — |
| H11 | Post-workout Today: `Workout A, done.`, `Two records on Back squat today. Workout B is next, on Thursday.`, with `Not synced · … · Retry` (GS P) | **partly**: Train jumps to the next workout. No "done today" state and no next weekday. verify | recheck/55 |
| H12 | Briefing page before Begin, with the toggle `Include warm-ups for Back squat` (GS P) | **conflicts**: 1-tap start (PD, ST, SSF all 1 tap) | — |
| H13 | Empty state for a new user, offline: `No program yet` / `Pick a program to get a plan for every session.` / `Use A/B Split` / `Offline · saved on this phone` (S8, all four). PD adds `Sessions, lifts and muscle balance fill this page after your first workout.` | **in app** (PD's extra line: unverified) | `ui/NoProgram.tsx`, `DashboardView.tsx` |

### Train: the live set screen
| # | Feature | Status | Evidence |
|---|---|---|---|
| L1 | One-tap pre-filled bar `Log set 3 · 62.5 × 8` that starts rest (all) | **in app** | recheck/10 |
| L2 | Set track: done cells show their values, planned cells are dashed, the current cell is outlined, and a `PR` tag stays on the cell (PD S3, SSF S3) | **in app** | recheck/10, live/after/30 |
| L3 | Warm-ups as one `W 3/3` cell that opens Bar & warm-up, with `Warm-up 3 of 3 · Per side: 15 · 1.25`, `Log warm-up · 52.5 × 2` and `Skip warm-ups` (SSF S3b; PD `W 3/3`; ST `W` rows plus `Add 3 warm-up rows`) | **partly**: a line `Warm-up: 30×5 · 40×3 · 50×2  Add`, and a tools Warm-up segment with per-side plates and `Add warm-ups`. No warm-up progress cell, no per-warm-up log or skip (V6-16 surfaced the line) | recheck/10, 40 |
| L4 | Large steppers, and a keypad when you tap the numeral (all) | **in app** | `ui/Keypad.tsx` |
| L5 | Per-side plates under the weight (SSF `Per side: 20 · 1.25`) | **in app**: `Per side: 20`, `Add 5 per side → 20 + 5` | recheck/10, live/after/30 |
| L6 | Plate drawing: PD S3b Plates segment, ST `Per side, kg · Collar outboard`, GS Plates sheet | **conflicts**: V1-07 swapped it for a text line and removed the Plates segment | `SetScreen.tsx:1410` |
| L7 | `Last time 60 × 9 · Fri 9 Oct`, plus SSF's delta `+2.5 kg vs last time` / `−1 rep vs last time` | **in app** (`Last time … · +1 rep · PR if logged`, V4-02) | recheck/10 |
| L8 | PD projection `e1RM 75.0 · record 74.2 → PR if logged` | **conflicts / adapted**: V2-04 changed it to `PR at N reps` / `PR if logged` | `SetScreen.tsx:1140-1182` |
| L9 | Header volume `Volume 1,530 kg · last A at this point 1,470 kg` with a bullet bar (PD) | **conflicts**: V1-10 removed it | — |
| L10 | Header counters `Sets 2/23 · PRs 1` (PD), `2 of 23 sets` (ST) | **in app** (`00:07 · 2/23 sets · 1 PR`) | live/after/30 |
| L11 | Other exercises listed under the current card (PD S3); ST shows all exercises collapsed under the table | **conflicts**: V2-03 removed the up-next rows from Now | — |
| L12 | `Now | All` (PD) | **in app** as one header button (V3-07) | recheck/10, 11 |
| L13 | All grid: tapping any open cell logs that set as planned, and tapping a done cell edits it (PD S2) | **partly**: All exists and lets you work out of order. Tapping a done cell edits it. A planned cell jumps to the set rather than logging it in one tap. verify | recheck/11 |
| L14 | Session map or plan: per-exercise `4/4 · best 62.5 × 8 PR`, `Do next` to reorder, drag handles, and a footer `2 of 7 exercises done · 9 of 23 sets` (SSF S2, GS S2/S3b) | **partly**: All shows `0/3 · 3 × 8–10` per exercise, and you can jump to any exercise. No reorder of what's left, no `exercises done` count | recheck/11 |
| L15 | `Set 3 of 4 · target 8–10` (all) | **in app** | recheck/10 |
| L16 | Exercise note on the set screen: `Belt from set 3` (ST sticky header, GS rest coach line) | **in app** (E14-T11; the last note also shows on Train, V6-08) | recheck/01 |
| L17 | GS per-set coach line: `Step up to 62.5 kg. Set 1 went 60 × 10.` / `Same weight again.` | **in app (adapted)**: `Add 5 per side → 20 + 5`, `Same plates: 25`, and a Get ready card | live/after/30 |
| L18 | ⋯ tools: `Set type`, `Rest time`, `Swap exercise`, `Exercise info`, `Lift history`, Warm-up, Notes (PD S3b, ST S3b, SSF tool row, GS ⋯ sheet) | **in app** | recheck/40 |
| L19 | Session note: `Session note · Add a session note` (PD Notes segment) | **in app** (on All) | `ui/ExerciseList.tsx:67` |
| L20 | Swap page `Ranked by the equipment in your gym` / `Same muscles · in my gym`, then `Do this instead` → `Swapped to Front squat · Undo` (all) | **in app** (V6-10) | recheck/42, 43 |
| L21 | Exercise info page (all) | **in app** | `features/overlays/DetailOverlay.tsx` |
| L22 | Edit a logged set: steppers, `Set kind` Warm-up/Working/Drop/Failure/AMRAP, `Effort` RIR, `Save set`, `Delete set` → `Set deleted · Undo` (PD S2b; GS `Edit logged sets`; ST, SSF) | **in app** | live/after/31, 32 |

### Train: rest
| # | Feature | Status | Evidence |
|---|---|---|---|
| R1 | Countdown `2:48 of 3:00`, `−15 s`, `+15 s`, `Skip rest` (all) | **in app** | recheck/15 |
| R2 | Effort: `How hard was set 3? RIR 0 1 2 3+` (all) | **in app** (`Reps left?`) | recheck/15 |
| R3 | Next set during rest, `Next: set 4 · 62.5 × 8 · last 60 × 8`, which you can expand or edit (PD S4, GS `Edit next set`, SSF) | **in app**: `GET READY · SET 2 … Change ›` | recheck/15 |
| R4 | Usual rest: the bar marker `you usually rest 2:40` and the offer `Use 2:40 for Back squat` (PD S4) | **conflicts**: V1-11 and V3-03 moved it to tools, `Rest time 3:00 · usually 3:50` | recheck/40 |
| R5 | At 0:00 the next set returns pre-filled with 0 taps. A chime (ST, SSF), and `Rested 3:00` (SSF F3) | **in app**: beeps (`ui/restSound.ts`), push alarm (decision 0023), `Rested 3:00 · +0:12` | `SetScreen.tsx:1363` |
| R6 | Over-time in danger red, `+1:05` with an alert icon (SSF); `Over rest · +0:12` (PD); `Rest is over` (ST) | **conflicts**: V1-32 and V4-06 made it quiet and muted | — |
| R7 | Rest keeps running when you jump to another exercise, shown as a pill `Rest 2:12 left` that chimes at 0 (SSF S2) | **partly**: the countdown shows in the live strip when minimised, and rest hands over between exercises (V3-01). No pill on All or on another exercise's Now. verify | `ui/LiveStrip.tsx:36` |
| R8 | End of plan: GS `End of Workout A · That is the whole plan for today. Finish to see your summary.`; SSF `Go to Lunges` / `Finish workout` on rest after the last set | **in app**: the done state `Back to X · set N` / handover (V4-07, V3-01) | `SetScreen.tsx:1389` |

### Train: the PR moment
| # | Feature | Status | Evidence |
|---|---|---|---|
| P1 | A PR that never blocks. PD: a 3 s toast with a sparkline, `New PR · Heaviest set · 62.5 kg × 8 · +2.5 kg`. SSF/GS: a banner that lasts the rest. ST: the row flashes for 1.2 s | **in app** as V4-01's "Just done" band, which lasts the whole rest (`PR · Rep record · 1 more than Mon 12 Oct`), plus a cell flash and a tone (V4-04). The toast with a sparkline **conflicts** (V4-01 removed the toast) | live/after/30 |
| P2 | PR tag stays on the cell; PR count in the header | **in app** | live/after/30 |

### Finish and summary
| # | Feature | Status | Evidence |
|---|---|---|---|
| F1 | Finish sheet: `14 sets not logged. Logged sets are kept.` → `Finish workout` / `Keep going` (all) | **in app** (`22 sets not logged`) | recheck/44 |
| F2 | `Discard workout` → `Workout discarded · Undo` (all) | **in app**: a confirm that names what's lost, plus Undo (V6R-01 fixed exact restore) | recheck/45–47 |
| F3 | KPI tiles `Duration 52 min · Volume 9,840 kg · Sets 26 · PRs 2` (all four S5b) | **partly / conflicts**: one figures line, `1 h 06 min · 23 sets · 2 PRs · vs Wed 7 Oct: volume −1.6 %` (V4-03) | recheck/32 |
| F4 | `+4.6% volume vs last Workout A` | **in app** | recheck/32 |
| F5 | `Records` section: `Heaviest set · Back squat 62.5 kg × 8 +2.5 kg`, `Best estimated 1RM … +0.8 kg` (all) | **partly**: the first PR is the headline and PR tags show in Lift by lift. The Records list shows only with 2 or more PRs (V4-03) | `ui/SessionSummary.tsx:131-138` |
| F6 | Per-exercise table: best set (all); volume in kg and `Δ vs last` (PD); `4 + 3 W` sets (ST) | **partly**: Lift by lift gives the sets plus a sentence vs last time. No per-exercise volume | recheck/32 |
| F7 | `Worked today`: front/back body map with heat (ST, SSF, GS); a list of 11 regions (PD) | **conflicts**: V3-13 replaced it with one sorted line, `Worked today: Lower back 2 · Lats 1 …` | recheck/54 |
| F8 | GS `Next: Workout B, Thursday.` | **partly**: `This week 3 of 3 · next up Workout B`, with no day | recheck/54 |
| F9 | `Share` + `Done` (PD) | **in app** | recheck/54 |

### Come back: Sessions and history
| # | Feature | Status | Evidence |
|---|---|---|---|
| S1 | 6-week calendar coloured by A/B, `Last 6 weeks · 11 sessions` (PD S6a) | **in app** | recheck/31 |
| S2 | List grouped by `This week / Last week / Earlier`; each row shows `52 min · 26 sets · 9,840 kg` and `2 PR` (all) | **in app** | recheck/31 |
| S3 | Bar chart `Volume per session, kg` for A/B (PD, ST, SSF, GS) | **conflicts**: cut (`SessionsScreen.tsx:156`, V2-07) | — |
| S4 | `Muscle sets by week` 4-week matrix (PD S6a) | **in app, moved**: Progress › Muscles, `4 weeks` segment (V2-06) | `MusclesPage.tsx:41` |
| S5 | Tapping a session opens its detail; the read-only set table has `Edit` (ST) | **in app** | recheck/32, 39 |
| S6 | Workout cards that list each exercise's best set: `4 × Back squat · 62.5 kg × 8 … +3 more` (ST S6a) | **missing** | recheck/31 |
| S7 | Journal: a header line `Eleven sessions in four weeks, none missed. Workout A volume is up from 8,760 to 9,840 kg.` and one coach sentence per week, `All three done. Workout A rose from 9,180 to 9,410 kg and set a record on Friday.` (GS S6a) | **missing** | recheck/31 |

### Progress and the Lift page
| # | Feature | Status | Evidence |
|---|---|---|---|
| G1 | Lift picker chips (all), and `Search 876 exercises` in Lifts (PD S6b) | **in app**: Progress Lifts list, All lifts, Program › Exercises search with My lifts | progress/after/01, recheck/36–37 |
| G2 | e1RM chart with `1M / 3M / 1Y` (PD) | **in app**: `Weight / Est. max`, `3M / 1Y / All` | recheck/22 |
| G3 | Headline delta over the range: `75.0 kg +8.3 kg since 21 Sep · Record` (PD); `Back squat e1RM up 8.3 kg in three weeks.` (GS) | **partly**: `62.5 kg × 8 · Wed 14 Oct · up 2.5 kg` gives the last step only, plus a verdict card | recheck/22 |
| G4 | `Next: 62.5 kg · top of range hit` (all) | **in app** (`Next time: 62.5 kg × 9.` + `Why?`) | recheck/22 |
| G5 | Records: `Heaviest set / Best estimated 1RM / Most reps in a set`, with dates (all) | **in app** | recheck/22 |
| G6 | Sessions as a table, `Date · Sets · e1RM · Δ`, e.g. `13 Oct PR 60×10 … 75.0 +0.8` (ST S6b) | **partly**: the Sessions log lists sets with PR tags. No e1RM or Δ per session | recheck/22 |
| G7 | Other lifts as one-line deltas, `DB bench press 14.8 → 15.0 kg` (GS) | **in app**: the Lifts card has a sparkline, top set and 4-week delta | progress/after/01 |
| G8 | This week by muscle: front/back heat map, plus family bars done vs planned `Push 19 / 22 · Pull 14 / 28 · Legs 7 / 7 · Core 6 / 12` and `No direct calves work` (ST S6b, SSF Lifts/Body, GS History) | **partly**: the Muscles page has a body map and each muscle against the plan. There are no done/planned bars per family (Push, Pull, Legs, Core) | `MusclesPage.tsx` |
| G9 | `Workout B: 46 bodyweight reps` (PD S6b) | **conflicts**: bodyweight counts in volume (decision 0021) | — |

### Program
| # | Feature | Status | Evidence |
|---|---|---|---|
| PG1 | Read mode: `A/B Split · 3× per week · 2 workouts · 14 exercises`, `Weekly sets, planned 69 sets` family bar, per-workout table `Sets × reps · Rest · kg`, `23 sets · ~53 min` (all) | **in app** | recheck/35 |
| PG2 | Gap notes `No direct calves work / abdominals` (all) | **in app** as `Calves 8 · below 10`, `Abs 3 · below 10` | recheck/35 |
| PG3 | `Program | Exercises` segment; the library has search, `My gym only`, a family dot and the equipment (all) | **in app** | recheck/35–37 |
| PG4 | Edit: `Cancel / Save`, per-row steppers for Sets/Reps/Rest/kg, drag to reorder, `Add exercise`, `Add workout`, Remove (all) | **in app** | live/after/61, 62 |
| PG5 | `AMRAP last set` toggle (ST, SSF, GS) | **in app** (row ⋯ `Last set AMRAP`) | `ProgramEditor.tsx:817` |
| PG6 | `Impact on weekly volume · Back squat · sets 4 → 5 · Legs 7 → 8 sets/week` (PD S7b) | **in app** | `ProgramEditor.tsx:221` |
| PG7 | `Remove exercise` with an Undo snackbar (ST) | **partly**: Remove inside the draft; Cancel discards everything. No per-item Undo | `ProgramEditor.tsx:901` |

### Settings and look
| # | Feature | Status | Evidence |
|---|---|---|---|
| X1 | `Sync and backup`: Cloud sync status, `Sync now`, `Export backup` (GS, ST, SSF) | **in app** (`Data & sync`) | `ui/Settings.tsx:158` |
| X2 | Equipment: bar 20 kg, plates `25 · 20 · … · 1.25` (GS, ST) | **in app** (`Bar and plates`) | `ui/Settings.tsx:142` |
| X3 | `Barbell step 2.5 kg`, `Dumbbell step 1 kg` (GS, SSF) | **in app, per exercise** (Program / the custom-exercise weight step) | `ProgramFeature.tsx` |
| X4 | `Ask how hard each set was` / `Track effort (RIR)` | **in app** (`Track effort`) | `ui/Settings.tsx` |
| X5 | `Warm-ups for barbell lifts` on/off (GS) | **missing** | — |
| X6 | `Chime at end of rest` on/off (SSF) | **missing**: the beep always plays; push is in Notifications | `ui/restSound.ts` |
| X7 | Dark graphite theme (SSF) | **conflicts**: PD's light look was picked (decision 0004, one palette) | — |

**Counts:** about 75 distinct features.
- About 47 are in the app, sometimes adapted.
- 16 conflict, decided on purpose in v1–v6.
- 13 are partly there.
- 3 are missing outright: S6, S7, X5. X6 is missing as a toggle only.

## 2. Ranked: missing and partly-there items

The ranking is by value to a lifter along plan → train → progress → come back.
- **Effort:** S is under a day, M is 1–3 days, L is more.
- **Clutter:** flagged where the item would add a band, a control or text to a screen the owner already calls crowded.

| Rank | ID | Gap | Stage | Value | Effort | Clutter risk | Note |
|---|---|---|---|---|---|---|---|
| 1 | L14 | Session map: reorder what's left (`Do next` or drag) and show `2 of 7 exercises done` | Train | High (busy gym, taken station) | M | Low: lives on All, one footer line | All already jumps; this adds order and a count |
| 2 | R7 | Rest countdown visible while on All or on another exercise (`Rest 2:12 left` pill) | Train | High (rest is lost when you look away) | S | Low: replaces nothing, one small pill in the header | Live strip already has the copy |
| 3 | L13 | All grid: one tap on the current open cell logs it as planned | Train | Med | S | None | verify current behaviour first |
| 4 | L3 | Warm-up progress cell `W 2/3` with `Log warm-up` / `Skip warm-ups` | Train | Med | M | Neutral if it **replaces** the `Warm-up: …  Add` line | V6-16 just moved warm-ups into view; don't add both |
| 5 | G3 | Lift page headline delta over the range (`+8.3 kg since 21 Sep`) | Progress | Med-high (answers "am I progressing?") | S | None: swap the `up 2.5 kg` text | |
| 6 | G6 | e1RM (or best set) and Δ per session in the Lift page Sessions log | Progress | Med | S | **Mild**: one right-aligned number per row | |
| 7 | G8 | Done vs planned by family this week (`Push 19 / 22 …`) | Progress | Med | S | **Flag** if added to the Progress dashboard; fine on the Muscles page only | |
| 8 | H11 | Post-workout Train state: `Workout B, done.`, plus the next workout's weekday | Come back | Med | S | None: replaces the next-workout view for that day only | |
| 9 | S7 | One coach sentence per week in Sessions (`All three done. …`) | Come back | Med | M (copy rules, tests) | **Flag**: one line per week group; keep it to the week header | GS's whole journal concept was not picked |
| 10 | F8 | Name the day on the summary (`next up Workout A, Thursday`) | Come back | Low-med | S | None | needs the planned-day rule |
| 11 | H6 | `Synced 2 min ago` as text | Trust | Low | S | **Mild**: Train's header is already full; tooltip or Settings only | |
| 12 | H4 | A one-sentence Train coach line | Plan | Low (row markers cover it) | S | **Flag**: duplicates the `↑ Ready` markers | Skip |
| 13 | X6 / X5 | Toggles: `Chime at end of rest`, `Warm-ups for barbell lifts` | Train | Low | S | Low: Settings only | |
| 14 | PG7 | Undo snackbar when you remove an exercise in the program editor | Plan | Low (Cancel exists) | S | None | |
| 15 | F5 / F6 / F3 | Summary: Records always, volume per exercise, KPI tiles | Come back | Low | S | **Flag: clutter**, and reverses V4-03 | Don't, without a ruling |
| 16 | S6 | Session cards that list each exercise's best set | Come back | Low-med | M | **Flag: high clutter**: triples the Sessions list height | Don't; the row opens the summary |

**Bottom line**
- The missing pieces sit mostly in the live session's "map": reorder, a rest that follows you, one-tap from All, and warm-up progress.
- On the Lift page, the gaps are a range delta and per-session numbers.
- Most of the other differences from the mocks are deliberate cuts that the owner's crowding complaint drove: the projection line, header volume, up-next rows, plate drawing, usual-rest bar, red over-time, PR toast, volume charts, body maps on the summary, and summary tiles. Re-adding any of them would reopen settled findings.
