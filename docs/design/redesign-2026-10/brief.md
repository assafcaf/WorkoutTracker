# Redesign brief: four concepts for the 2026-10 redesign

Date: 2026-10-13. Author: design director. Audience: the four designers, each building one concept.

Read the three research reports before starting:
- `research/market.md` covers 19 apps, archetypes, flows and tap counts.
- `research/audit.md` covers our app as built and the real content.
- `research/principles.md` covers the rules and the 25-item checklist.

Every path below is relative to `docs/design/redesign-2026-10/`, unless it starts with `docs/`. In
that case it is relative to the repository root, the folder that holds `CLAUDE.md`.

**What the owner asked for.** The current app "looks like a child did it". They want:
- a full rethink of IA, screen structure, decision flow and interaction model, not a re-skin;
- a look that is "colourful but mellow, professional and sporty".

**What has already been rejected:**
- dark with neon lime (too aggressive);
- light ivory with pastel "Court" colours (childish).

**What stays.** Every feature stays: set logging with previous values, rest timer, warm-up ramp,
plate calculator, PRs, session summary, edit and undo, set kinds, effort (RIR), notes, the program
editor, history, stats and charts, the muscle heat-map, the exercise library with alternatives,
and settings (sync and backup). Where each feature lives is open.

You build **exactly** what your concept section says. Where this brief is silent, follow
`research/principles.md`. Where the brief and the principles disagree, the brief wins. Do not add
features, screens, data or decoration that are not listed.

---

## Part 1 — Shared foundation (applies to all four concepts)

### 1.1 Required frames

Each frame is a phone screen at **exactly 390 × 844 CSS px**. Each frame has:
- a 47 px status bar at the top (time `9:41` and simple signal, wifi and battery glyphs, all in the
  ink colour);
- a 34 px home-indicator zone at the bottom (a 134 × 5 px rounded bar, centred, 8 px from the
  bottom).

No device bezel. Clip the frame to a 40 px outer radius. That radius is board presentation, not
part of the design.

| Code | Frame | Moment it shows |
|---|---|---|
| **P** | Live prototype | Interactive. It opens on Home, and the whole core flow is clickable (see 4.3). |
| **S1** | Home / Today | 17:58, about to train. No session open. |
| **S2** | Active workout overview | Moment M2, mid-session (see 1.3). |
| **S3** | Set logging | Moment M1: Back squat, set 3 of 4, values pre-filled, nothing open. |
| **S3b** | Secondary tools | The concept's tools surface open over S3. Your section names which one. |
| **S4** | Rest state | After logging set 3 of Back squat: 2:48 left of 3:00. |
| **S5a** | PR moment | 2:58 left of 3:00, just after set 3 was logged as a PR. The PR notice is visible. |
| **S5b** | Session summary | Workout A finished. |
| **S6a**, **S6b** | History and progress | Between them they show the session list, a volume-per-session chart, the e1RM chart, the records and the muscle heat-map. Your section assigns what goes where. |
| **S7a** | Program, view | A/B Split, read mode. |
| **S7b** | Program, editing | How a single exercise's prescription is changed, plus how reorder and add work. |
| **F1, F2, F3** | Flow strip | The core loop: log a set → rest → next set (see 4.2). |
| **S8** | States | A new user's Home (empty state), with the offline indicator showing. |

### 1.2 The canonical data

All four mocks show this data, character for character. Use:
- kg throughout;
- `×` (U+00D7) for sets × reps;
- `–` (U+2013) for ranges;
- `−` (U+2212) for minus;
- a comma for thousands (`9,840 kg`);
- short human dates (`Tue 13 Oct`), never ISO dates.

Today is **Tue 13 Oct 2026**.

**Program: "A/B Split".** 3 sessions per week, 2 workouts, 14 exercises. The current weight is what
the program view shows. The start weight is the bundled seed.

| Workout A | Sets × reps | Rest | Current kg | Family | Equipment | Last time (Fri 9 Oct) |
|---|---|---|---|---|---|---|
| Back squat | 4 × 8–10 | 3:00 | 62.5 | legs | barbell | 60×10 · 60×10 · 60×9 · 60×8 |
| Lunges | 3 × 10–12 | 1:30 | 8 | legs | dumbbell | 8×12 · 8×11 · 8×10 |
| DB bench press | 4 × 8–10 | 1:30 | 12 | push | dumbbell | 11×10 · 11×10 · 11×9 · 11×9 |
| Push-ups | 3 × 10–15 | 1:30 | BW | push | body only | BW×14 · BW×12 · BW×10 |
| Machine shoulder press | 3 × 8–10 | 1:30 | 7.5 | push | machine | 7.5×9 · 7.5×8 · 7.5×8 |
| Lateral raises | 3 × 10–15 | 1:30 | 4 | push | dumbbell | 4×14 · 4×12 · 4×12 |
| Cable push-down | 3 × 10–12 | 1:30 | 20 | push | cable | 20×12 · 20×10 · 20×10 |

| Workout B | Sets × reps | Rest | Current kg | Family | Equipment |
|---|---|---|---|---|---|
| Deadlift | 3 × 8–10 | 3:00 | 65 | core | barbell |
| Assisted pull-ups | 4 × 5–8 | 1:30 | BW−27 | pull | assisted |
| Narrow-grip pull-down | 3 × 10–12 | 1:30 | 42.5 | pull | cable |
| Machine row | 4 × 8–10 | 1:30 | 55 | pull | machine |
| Face pull | 3 × 10–15 | 1:30 | 17.5 | push | cable |
| Hyper-extension | 3 × 10–15 | 1:30 | BW | core | body only |
| Seated biceps curls | 3 × 10–12 | 1:30 | 9 | pull | dumbbell |

Workout A has 23 working sets (~53 min). Workout B has 23 working sets (~48 min).

**Equipment settings:**
- Weight steps: 2.5 kg for barbells, 1 kg for dumbbells, 1.25 kg for the machine shoulder press and
  the pull-down, 5 kg for the machine row.
- Bar: 20 kg.
- Plates: 25, 20, 15, 10, 5, 2.5 and 1.25 kg.
- Library: 876 exercises.

**Session history** (newest first; A and B alternate; the week starts Monday):

| Date | Workout | Duration | Sets | Volume | PRs |
|---|---|---|---|---|---|
| Tue 13 Oct | Workout A | 52 min | 26 | 9,840 kg | 2 |
| Mon 12 Oct | Workout B | 49 min | 23 | 8,920 kg | — |
| Fri 9 Oct | Workout A | 55 min | 26 | 9,410 kg | 1 |
| Wed 7 Oct | Workout B | 47 min | 23 | 8,650 kg | — |
| Mon 5 Oct | Workout A | 54 min | 26 | 9,180 kg | — |
| Fri 2 Oct | Workout B | 46 min | 23 | 8,300 kg | — |
| Wed 30 Sep | Workout A | 53 min | 26 | 9,250 kg | 1 |
| Mon 28 Sep | Workout B | 48 min | 23 | 8,110 kg | — |
| Fri 25 Sep | Workout A | 51 min | 26 | 9,020 kg | — |
| Wed 23 Sep | Workout B | 45 min | 23 | 7,940 kg | — |
| Mon 21 Sep | Workout A | 50 min | 26 | 8,760 kg | — |

The volume-per-session bar chart uses these 11 sessions:
- y-axis 0–10,000 kg, with ticks at 0, 5,000 and 10,000;
- A and B bars told apart by a neutral shade, never by family colour;
- the latest bar labelled `9,840`.

**Back squat e1RM series**, one point per Workout A:

| 21 Sep | 25 Sep | 30 Sep | 5 Oct | 9 Oct | 13 Oct |
|---|---|---|---|---|---|
| 66.7 | 68.0 | 70.0 | 72.0 | 74.2 | 75.0 |

Draw x-axis ticks at `21 Sep`, `30 Sep`, `9 Oct` and `13 Oct`. Label the latest point `75.0 kg`.

**Back squat records:**
- `Heaviest set · 62.5 kg × 8 · 13 Oct`
- `Best estimated 1RM · 75 kg · 13 Oct`
- `Most reps in a set · 50 kg × 12 · 30 Sep`

**Other numbers:**
- Progression suggestion: `Next: 62.5 kg`.
- Bodyweight stat: `Workout B: 46 bodyweight reps`.
- Other lifts for pickers and sparklines: DB bench press (e1RM 14.8 → 15.0), Deadlift (78.0 → 81.3),
  Machine row (66.0 → 68.8).

**This week's muscle data** (Mon 12 Oct B, done; Tue 13 Oct A, done; next B planned):

| Region | Done this week | Planned this week | Today's session (A) |
|---|---|---|---|
| Chest | 7 | 7 | 7 |
| Shoulders | 9 | 12 | 6 |
| Triceps | 3 | 3 | 3 |
| Lats | 11 | 22 | 0 |
| Biceps | 3 | 6 | 0 |
| Quads | 7 | 7 | 7 |
| Lower back | 6 | 12 | 0 |
| Hamstrings, Glutes, Calves, Abs | 0 | 0 | 0 |

**Bands:**
- Week bands: `0 · 1–9 · 10–20 · 21+`.
- Session bands: `0 · 1–2 · 3–5 · 6+`.
- Always show a legend with swatches.

**Gap lines:** `No direct calves work` and `No direct abdominals work`.

**Family sets per week:**

| Family | Done | Planned |
|---|---|---|
| Push | 19 | 22 |
| Pull | 14 | 28 |
| Legs | 7 | 7 |
| Core | 6 | 12 |

### 1.3 The frozen moments

**S1 (Home), 17:58:**
- Workout A is due, because B was done yesterday.
- Workout A was last done Fri 9 Oct; Workout B was done yesterday, Mon 12 Oct.
- This week: 1 of 3 sessions (Mon ✓, today pending).
- Progression note: `Back squat — try 62.5 kg`.
- Sync: `Synced 2 min ago`.
- No backup reminder, because none is due.

**M1 (S3, S3b, S4, S5a, flow strip): elapsed 14:10, exercise 1 of 7.** Back squat is in progress.

Logged so far:
- warm-ups: `W · 30 × 5`, `W · 45 × 3`, `W · 52.5 × 2`;
- `1 · 60 × 10`;
- `2 · 60 × 9 · RIR 1`.

Set 3 of 4:
- target `8–10 reps`;
- pre-filled **62.5 kg × 8**. The progression rule fired because set 1 hit the top of the range;
- last time for this set: `60 × 9`;
- delta: `+2.5 kg`;
- plates: `Per side: 20 · 1.25`;
- exercise note: `Belt from set 3`.

Logging it is a PR: `New PR · Heaviest set · 62.5 kg × 8`. Set 4 is then pre-filled
**62.5 kg × 8**, last time `60 × 8`.

Warm-up ramp for 62.5 kg:

| Set | Load | Per side |
|---|---|---|
| Warm-up 1 of 3 | 30 kg × 5 | 5 |
| Warm-up 2 of 3 | 45 kg × 3 | 10 · 2.5 |
| Warm-up 3 of 3 | 52.5 kg × 2 | 15 · 1.25 |

**M2 (S2): elapsed 31:40.**
- Back squat done: 4/4, 1 PR.
- Lunges done: 3/3.
- DB bench press in progress: 2 of 4 logged (`12 × 10`, `12 × 10`), set 3 next, pre-filled `12 × 9`.
- Push-ups, Machine shoulder press, Lateral raises and Cable push-down are not started.
- Session progress: **9 of 23 sets**, 2 of 7 exercises done.

**S5b (summary): Workout A · Tue 13 Oct · 52 min · 26 sets · 9,840 kg · 2 PRs.**

| Exercise | Sets today |
|---|---|
| Back squat | W 30×5 · 45×3 · 52.5×2, then 60×10 · 60×9 · 62.5×8 PR · 62.5×8 |
| Lunges | 8×12 · 8×12 · 8×10 |
| DB bench press | 12×10 · 12×10 · 12×9 · 12×8 |
| Push-ups | BW×15 · BW×12 · BW×11 |
| Machine shoulder press | 7.5×10 · 7.5×9 · 7.5×8 |
| Lateral raises | 4×15 · 4×13 · 4×12 |
| Cable push-down | 20×12 · 20×11 · 20×10 |

PRs:
- `Heaviest set · Back squat · 62.5 kg × 8 · +2.5 kg`
- `Best estimated 1RM · Back squat · 75 kg · +0.8 kg`

Compared with the last Workout A: `+4.6% volume`.

**Copy strings to use verbatim where the feature appears:**
- Set kinds: `Warm-up` (W), `Working`, `Drop` (D), `Failure` (F), `AMRAP` (A).
- Effort: `RIR 0 · 1 · 2 · 3+`.
- Rest offer: `Use 2:40 for Back squat` → `Saved to A/B Split`.
- Edit feedback: `Set deleted · Undo`.
- End of exercise: `All 4 sets logged · Up next: Lunges`.
- Bodyweight variant for any example: `Assisted pull-ups · BW−27 × 6`.
- Empty Home (S8): `No program yet` / `Pick a program to get a plan for every session.`, with one
  card `A/B Split · 3× per week · 2 workouts · 14 exercises` and one primary button
  `Use A/B Split`.
- Offline: `Offline · saved on this phone`.
- Sync error, if a concept shows one: `Not synced · saved on this phone · Retry`.

### 1.4 Quality bar: every concept passes all 25 items

The checklist in `research/principles.md` §5 is a **pass/fail gate**, not a suggestion. These items
bind in every concept, whatever its style:

- **Neutral field.** At least 85% of every frame's pixels come from the neutral ramp. There are no
  tinted cards and no pastel fills.
- **One accent.** It is used only for the primary action, the active state, focus and the PR tag.
- **Data colours.** The four muscle-family colours and the heat ramp appear only in charts, the
  heat-map and small tags or dots (≤ 12 px dot, or tag text). Never as a card or row background.
- **Type.** At most 6 sizes and 3 weights per frame. `font-variant-numeric: tabular-nums
  lining-nums` on every number.
- **Radii.** ≤ 12 px on cards and sheet tops. ≤ 6 px on inputs, chips and cells. Full pills only for
  small tags and toggles.
- **Zero decoration.** No stripes, medallions, trophies, confetti, emoji, gradients, illustrations or
  photos. A PR is typographic: a `PR` tag in the accent, plus the delta.
- **In-workout frames (P, S2–S5a, F1–F3):**
  - hero weight × reps and the rest countdown ≥ 60 px;
  - numerals and primary labels ≥ 7:1 contrast, other text ≥ 4.5:1;
  - every tap target ≥ 56 px, keypad keys ≥ 64 px, gaps ≥ 8 px;
  - one full-width primary bar ≥ 56 px tall in the lower third, its bottom edge at least 42 px above
    the frame bottom;
  - destructive or rare actions in the top bar or an overflow menu;
  - no tab bar.
- **Taps and states:**
  - logging a pre-filled set takes **1 tap** and starts rest automatically;
  - starting today's workout takes **≤ 2 taps**;
  - delete, swap and discard-exercise use an Undo snackbar;
  - short tools open in a bottom sheet, long ones full screen, and sheets never stack;
  - the PR shows without a modal.
- **Copy.** Sentence case, verb-led buttons, no exclamation marks, units always shown.

The palettes below were contrast-checked (WCAG 2.x). Use the hexes exactly. If you add a shade,
check it yourself and list it in `rationale.md`.

---

## Part 2 — The four concepts

The four differ first in **where things live and how the set is logged**, and only second in
skin.

### Concept 1 — Set Table · slug `set-table`

**Thesis.** The whole workout is one editable page: every set is a row, and you tick it.

**Who it suits, and the trade-off.** It suits an experienced lifter who wants to see the whole
session, jump between exercises, fix any row at any time, and run supersets out of order. It is
the Strong/Hevy prototype, so it reads as "a serious tool" instantly. The trade-off: it is denser
mid-set, so glanceability from 1 m depends on the active row being drawn big. It is also the least
novel of the four.

**Navigation.**
- 4 bottom tabs: **Today · History · Progress · Library**.
  - Library has a two-way segmented control, `Program | Exercises`.
  - Settings sits behind a gear icon in the Today header.
- The tab bar is 49 px plus the safe area, line icons with 11 px labels, and the active tab in the
  accent.
- **Workout mode** is a full-height sheet that slides up over the tabs, with its top corners at
  12 px.
  - **Minimise:** a chevron-down at the top left, or dragging the grabber. The sheet collapses to a
    **64 px mini-bar** docked above the tab bar: `Workout A · 31:40 · Rest 2:48` with a chevron-up.
    Tapping the bar restores the sheet.
  - **Sheet header:** chevron-down on the left; centred `Workout A` with `31:40` under it (tabular,
    13 px); `Finish` on the right as an accent text button, out of the thumb's reach.
  - **Discard workout** is the last row at the bottom of the sheet, as a red text button, far from
    Finish.

**Set-logging interaction (an editable table).**
- Each exercise is a block:
  - a header row: name (17 px/600), with `4 × 8–10 · rest 3:00` under it in muted text, and a `⋯`
    button (56 × 56);
  - the exercise note, if any, as one muted line;
  - the table.
- Column header: `SET | PREVIOUS | KG | REPS | ✓`, 12 px/600 caps, muted.
- Rows are **56 px**. Columns are fixed and aligned in every row:
  - SET: 36 px, a 28 px rounded label holding `W`, `1`, `2`…;
  - PREVIOUS: 72 px, muted `60×9`;
  - KG: input cell;
  - REPS: input cell;
  - ✓: 56 × 56.
- Input cells are filled neutral-100, 6 px radius, with centred numerals at 20 px/500.
- **The active row** (the next set to log) **expands to 136 px**:
  - line 1 is small: `Set 3 of 4 · target 8–10 · last 60 × 9 · +2.5 kg`;
  - line 2 is two big cells, `62.5` (kg) and `8` (reps), with **numerals at 60 px** in Inter Tight
    600, each cell 64 px tall, and a 64 × 64 ✓ in solid accent with a white check.
  - It is the only accent-filled ✓ on the page, and so the brightest target.
- **Done rows** have no fill. They show the ✓ as an accent check on accent-tint, and their numerals
  in the secondary text colour.
- **Logging as planned:** tap the active ✓, or the dock bar `Log set 3 · 62.5 × 8` (full width,
  56 px, accent) pinned at the bottom of the sheet. Both do the same thing.
- **Changing a value:** tap a KG or REPS cell. A **keypad sheet** replaces the dock. It keeps the
  active row visible by scrolling it above the sheet.
  - Its header line: `Weight · kg · step 2.5 · Per side: 20 · 1.25`.
  - Keys are a 4 × 4 grid of 64 px keys with 8 px gaps:

    | | | | |
    |---|---|---|---|
    | `1` | `2` | `3` | `−2.5` |
    | `4` | `5` | `6` | `+2.5` |
    | `7` | `8` | `9` | `Next` |
    | `.` | `0` | `⌫` | `Log ✓` |

  - `Next` moves to REPS. `Log ✓` logs the row and closes the keypad.
  - The first digit typed replaces the value.
- **The set kind:** tap the SET label to open a 5-option bottom sheet: Warm-up, Working, Drop,
  Failure, AMRAP.
- **Effort (RIR):** while resting, if effort tracking is on, the rest dock shows a row
  `How hard was set 3? RIR 0 · 1 · 2 · 3+`. The chips are 56 px tall and optional.

| Task | Taps | Sequence |
|---|---|---|
| Start today's workout | **1** | Today → `Start Workout A`. The sheet opens with Back squat's first row active. |
| Log a set as planned | **1** | Active ✓, or the dock bar. |
| Change weight one step, then log | **3** | KG cell → `+2.5` → `Log ✓`. |
| Type a weight, then log | **4** | KG cell → `6` → `5` → `Log ✓`. |
| Finish, all sets done | **1** | `Finish` → summary. |
| Finish early | **2** | `Finish` → sheet `14 sets not logged` → `Finish workout`. |

**Rest timer.**
- It starts on ✓.
- A 4 px accent progress strip runs under the just-logged row, draining, with `2:48` right-aligned
  at 13 px.
- The dock becomes the **rest dock**, 112 px tall:
  - the countdown on the left at **64 px** Inter Tight 600 tabular, with `of 3:00` under it in
    muted text;
  - on the right, three 56 × 56 buttons with 8 px gaps: `−15`, `+15`, `Skip`.
- The table stays scrollable and editable throughout.
- Tapping the countdown opens a small bottom sheet with a 15-second-step list to set the exact rest,
  and the `Use 2:40 for Back squat` offer.
- **At zero:** a chime, and the dock reverts to `Log set 4 · 62.5 × 8`.
- **Over-time:** the dock shows `+0:12` in the danger colour until the next set is logged.

**PR behaviour.**
- On a PR ✓, the row flashes accent-tint for 1.2 s, and a `PR` tag (accent outline, 11 px caps)
  plus `+2.5 kg` appear in the PREVIOUS cell.
- A toast slides down under the sheet header: `New PR · Heaviest set · 62.5 kg × 8`, white surface,
  hairline, one soft shadow, 3 s.
- The toast is non-blocking.

**Secondary tools.**
- The block's `⋯` opens the **exercise tools sheet** (this is **S3b**). It has five rows:
  - **Warm-up ramp:** 3 lines, plus an `Add 3 warm-up rows` button.
  - **Plates:** a drawn bar with per-side plates (20 · 1.25) as proportional rectangles, plus the
    text.
  - **Rest:** 3:00 ›.
  - **Note:** `Belt from set 3` ›.
  - Then `Swap exercise` (full-screen alternatives list), `Exercise info` (full screen) and
    `History` (full screen).
- The plate line also shows in the keypad header.
- Swapping is undoable: `Swapped to Front squat · Undo`.

**Screens.**

- **S1 Today.**
  - Large title `Today` (28 px) at the top left; gear and a sync glyph at the top right, with
    `Synced 2 min ago` under the title in muted 13 px.
  - A **week strip**: 7 day cells M–S, Mon with a ✓, Tue ringed as today, and the label
    `1 of 3 this week`.
  - The **Workout A card** (white, hairline, 10 px radius):
    - eyebrow `Next in A/B Split`;
    - `Workout A` at 22 px;
    - meta `7 exercises · 23 sets · ~53 min · last done Fri 9 Oct`;
    - 4 exercise rows (name left; `4 × 8–10` and `62.5 kg` right-aligned), then `+3 more`;
    - the progression line `Back squat — try 62.5 kg` with an up-arrow icon;
    - a full-width `Start Workout A` (56 px, accent) as the card's last element, so it sits at
      y ≈ 610–666.
  - Below the card, a quiet list row `Workout B · done yesterday` with a chevron (it opens a preview
    with Start).
  - Not on this screen: program management, stats and backup.
- **S2 Overview (M2).**
  - The sheet header, then a slim progress line `9 of 23 sets` with a 4 px bar.
  - Done exercises **collapse to one line**: `Back squat · 4/4 · best 62.5 × 8 · PR`, and
    `Lunges · 3/3`.
  - DB bench press is **expanded**, with its table and set 3 as the active row.
  - Upcoming exercises are collapsed rows: name plus `3 × 10–15 · last BW×14`.
  - The dock shows `Log set 3 · 12 × 9`.
- **S3 Set logging (M1).**
  - The Back squat block is expanded. Its warm-up rows show `W` labels.
  - Set 3 is the active expanded row.
  - The Lunges header peeks at the bottom above the dock.
- **S3b.** The exercise tools sheet over S3, with the scrim at 40% ink.
- **S4 Rest.**
  - The rest dock at 2:48, and the strip under row 3.
  - Row 3 shows `PR`.
  - Row 4 is now active and expanded, editable.
  - The effort row is in the dock.
- **S5a PR.** As S4 at 2:58, with the toast visible and the row 3 flash.
- **S5b Summary** (a full-screen page in the sheet, not a modal over a modal):
  - title `Workout A`, `Tue 13 Oct`;
  - a 4-stat strip: Duration `52 min`, Volume `9,840 kg`, Sets `26`, PRs `2`. Labels are 12 px
    caps; values are 28 px;
  - a `PRs` list (2 rows with the `PR` tag and the delta);
  - an exercise table: name, best set and sets count;
  - a front/back body map, `Worked today` (session bands);
  - primary `Done`.
- **S6a History tab.**
  - A volume-per-session bar chart (11 bars) at the top, 160 px tall.
  - Then sessions grouped `This week` / `Last week`. Each row is 64 px: `Tue 13 Oct` (13 px muted)
    over `Workout A` (17 px/600), with `52 min · 26 sets · 9,840 kg` right-aligned below, and
    `2 PR` as a tag.
  - Tapping a row opens the session detail (a set table, read-only, with `Edit`).
- **S6b Progress tab.**
  - Lift chips (Back squat, DB bench press, Deadlift, Machine row; selected = accent outline).
  - The e1RM line chart (accent line, light grid, dated x-axis).
  - `Next: 62.5 kg`.
  - The records list.
  - `This week by muscle`: a front/back silhouette heat-map plus the 4 family bars (done vs
    planned).
  - The gap lines.
- **S7a Library → Program.**
  - A header `A/B Split` with `3× per week · 2 workouts · 14 exercises`, and `Edit` at the top
    right; `⋯` holds Copy, Switch program, Reset to original and Delete.
  - Workout A and Workout B as **tables**: name | `4 × 8–10` | `3:00` | `62.5 kg`, with a 8 px
    family dot before the name.
  - `Weekly sets` as 4 family bars, and the gap lines.
- **S7b Edit.**
  - The same tables with drag handles on the left.
  - **Tapping a row expands it in place** into a stepper grid: Sets, Min reps, Max reps, Rest
    (15 s steps), Start weight (hidden for BW), and an `AMRAP last set` toggle. Each stepper is
    56 px.
  - `Remove exercise` is a red text button in the expanded row, with Undo.
  - `+ Add exercise` under each workout (opens the library full screen with search and `My gym
    only`); `+ Add workout` at the end.
  - `Cancel` at the top left, `Save` at the top right.

**Visual language — light, cool neutral, court green (the green brand thread).**

| Role | Hex |
|---|---|
| page (grouped bg) | `#F4F5F7` |
| surface (cards, sheet) | `#FFFFFF` |
| fill (input cells) | `#EDEFF2` |
| hairline | `#E0E3E7` |
| control border | `#C9CED4` |
| muted text (≥ 4.68:1) | `#646B73` |
| secondary text (7.46:1) | `#4A5058` |
| ink (16.5:1) | `#14171A` |
| **accent** (white on it 7.95:1) | **`#185C3F`** |
| accent pressed | `#124A33` |
| accent tint | `#E7F1EC` |
| danger | `#B42318` |

- Data families: push `#3A6F9A`, pull `#7A4F8E`, legs `#86651C`, core `#A9573A`.
- Heat ramp (slate): `#E8EDF3` · `#B9CADB` · `#6F93B5` · `#2F5F8A`.
- Type: **Inter** 400/500/600 for the UI, and **Inter Tight** 600 for titles and hero numerals.
  Link:
  `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@600&display=swap`.
- Scale: 12 caps label · 13 meta · 15 secondary · 17 body/row · 22 section · 28 title ·
  hero 60 · rest 64.
- Radius: 6 for cells and inputs · 10 for cards and buttons · 12 for sheet tops · pills only for
  tags.
- Spacing: 4-pt scale, 16 px side margins, 24 px between blocks.
- Icons: Lucide geometry, 24 grid, 1.75 stroke, round caps.
- Elevation: hairlines on light; one shadow (`0 8px 24px rgba(20,23,26,.12)`) for sheets and toasts
  only.

**Why it is not childish.**
- One deep green is used only for action. The canvas is cool grey and white.
- Aligned tabular columns, 6–10 px radii, no fills behind data, and Inter.
- It looks like the category prototype, so the 50 ms first impression is "serious tool".

---

### Concept 2 — Single Set Focus · slug `single-set-focus`

**Thesis.** One set at a time, as an instrument you can read from the bench. Everything else is one
tap away.

**Who it suits, and the trade-off.** It suits a lifter who trains in a straight line through the
plan and wants zero thinking mid-set, often with the phone on a bench 1 m away. It has the biggest
numerals, the most forgiving targets, and a dark screen for dim gyms. The trade-off: you see one
exercise at a time, so jumping around or editing earlier sets costs a tap (into the Session map),
and the session is less visible at a glance.

**Navigation.**
- 3 bottom tabs: **Train · Progress · Program**.
  - Progress has a segmented control, `Sessions | Lifts | Body`.
  - Program has a segmented control, `Program | Exercises`.
  - Settings sits behind an avatar circle (initial `A`, neutral) at the top right of Train.
- **Workout mode is a full-screen takeover.** There is no tab bar and no sheet.
  - **Top bar** (56 px):
    - on the left, `×` (56 × 56). It **pauses**: it returns to Train with a resume bar;
    - in the centre, `Back squat` (17 px/600) with `Exercise 1 of 7 · 14:10` under it (13 px
      muted);
    - on the right, a list icon (56 × 56) that opens the **Session map**, and `⋯`, which holds
      Swap, Exercise info, History, Rest time, Finish early and Discard workout.
  - **Paused:** Train shows a 64 px resume bar docked above the tabs:
    `Workout A · 31:40 · Resume` (accent outline, accent text).

**Set-logging interaction (a single focused set card with steppers and a keypad).**
- The screen, top to bottom:
  - **Set track** (64 px): one cell per set, `W` `W` `W` `1` `2` `3` `4`. Each logged cell shows its
    value under the number (`60×10`). The current cell has an accent outline; future cells are dim.
    Tapping a logged cell opens an edit sheet (Save set / Delete set; delete is undoable).
  - **Labels:**
    - `SET 3 OF 4 · TARGET 8–10` at 13 px/600 caps, muted;
    - `Last time 60 × 9 · Fri 9 Oct` at 17 px, secondary.
  - **Weight row** (128 px): a `−` button (64 × 64, surface-2) on the left; on the right, a `+`
    button. In the centre, `62.5` at **96 px** Archivo, width 75, weight 600, with `kg` at 20 px
    muted and a line under it, `+2.5 kg vs last time`, at 13 px secondary.
  - **Reps row** (128 px): the same pattern, with `8` and `reps`.
  - **Tools row** (56 px): 4 equal buttons with icon and 13 px label: `Plates` · `Warm-up` ·
    `Set type` · `Note`. Each opens a bottom sheet.
  - **Primary:** `Log set 3`, full width, **64 px**, accent fill, with the dark label `Log set 3 ·
    62.5 × 8`.
- Tapping a numeral opens the **keypad sheet** (surface-2, covering the tools row and the primary):

  | | | | |
  |---|---|---|---|
  | `1` | `2` | `3` | `⌫` |
  | `4` | `5` | `6` | `−2.5` |
  | `7` | `8` | `9` | `+2.5` |
  | `.` | `0` | `Next` | `Log` |

  Keys are 64 px with 8 px gaps.
- The steppers repeat on long-press.

| Task | Taps | Sequence |
|---|---|---|
| Start today's workout | **1** | Train → `Start Workout A`. It lands on Back squat with the warm-up offer as a tool badge (`Warm-up · 3`). |
| Log a set as planned | **1** | `Log set 3`. |
| Change weight one step, then log | **2** | `+` → `Log set 3`. |
| Type a weight, then log | **4** | Numeral → `6` → `5` → `Log`. |
| Finish, all sets done | **1** | After the last set, the rest screen's primary is `Finish workout`. |
| Finish early | **3** | `⋯` → `Finish early` → confirm `Finish workout`. |

**Rest timer (the screen changes state; it is not an overlay).**
- On log, the weight and reps rows animate away (200 ms). The upper half becomes the instrument:
  - a 248 px ring (6 px track in surface-3, accent arc draining);
  - inside the ring, `2:48` at **120 px** Archivo, width 75, weight 500, tabular, with `of 3:00` at
    15 px muted under it.
- Flanking the ring, under it: `−15 s` and `+15 s`, outline buttons of 96 × 56.
- Under that, the **Next card** (surface-1, 8 px radius):
  - `NEXT · SET 4 OF 4`;
  - `62.5 kg × 8` at 40 px, with tap-to-edit opening the same keypad;
  - `Last time 60 × 8`.
- The **effort row**, when tracking is on: `How hard was set 3?` with chips `0 · 1 · 2 · 3+`, each
  56 px.
- Primary: `Skip rest`, full width, 64 px.
- **At zero:** a chime, then an automatic return to the set card for set 4 with no tap. A small
  `Rested 3:00` shows under the labels and fades after 5 s.
- **Over-time** (the user lingers on the Next card's edit): the ring turns into `+0:12` in the
  danger colour.
- **After the last set of an exercise:** the Next card reads `Up next · Lunges · 3 × 10–12 · 8 kg`,
  and the primary is `Start Lunges` (a skip-rest equivalent).

**PR behaviour.**
- On a PR log, a 56 px banner slides in under the top bar: accent hairline border, surface-2
  background, a `PR` tag in solid accent with a dark label, then `Heaviest set · 62.5 kg × 8 ·
  +2.5 kg`. It shows for 4 s.
- Set-track cell 3 keeps a small `PR` tag.
- Nothing blocks the rest screen.

**Secondary tools.**
- `Plates`, `Warm-up`, `Set type` and `Note` are bottom sheets from the tools row.
- **S3b is the Plates sheet** with the warm-up ramp under it, as one sheet called `Bar & warm-up`:
  - a drawn bar with per-side plates;
  - `Per side: 20 · 1.25`;
  - the three warm-up rows, each with its own `Log` button;
  - `Skip warm-ups`.
- Swap, Info and History are full screen from `⋯`. Rest time is also in `⋯` (a sheet).

**Screens.**

- **S1 Train (dark).**
  - The eyebrow `Tue 13 Oct · 1 of 3 this week` (13 px caps muted), with 3 small week dots.
  - `Workout A` at 40 px/600.
  - `A/B Split · next in rotation`.
  - A **3-stat row**: `7` exercises · `23` sets · `~53` min. Numerals are 32 px; labels are 12 px
    caps.
  - A compact list of all 7 exercises at 40 px rows: name left; `4 × 8–10` and `62.5 kg`
    right-aligned in tabular figures.
  - The line `Back squat — try 62.5 kg` (accent icon, text in ink).
  - Primary `Start Workout A` at 64 px, at y ≈ 690 above the tabs.
  - Under it, the text link `Do Workout B instead`.
  - A sync glyph next to the avatar.
- **S2 Session map** (a full-height sheet over the set screen, top radius 12, M2):
  - header `Workout A · 31:40 · 9 of 23 sets`, with `Finish` as a text button at the top right;
  - 7 rows of 64 px:
    - a status glyph: ✓ done, accent dot current, hollow circle upcoming;
    - the name;
    - `4/4 · 62.5 × 8 PR`, `2/4`, or the target for upcoming;
  - the current row on surface-2;
  - drag handles to reorder upcoming exercises;
  - tapping a row jumps to it.
- **S3 Set (M1)** as specified above.
- **S3b** the `Bar & warm-up` sheet.
- **S4 Rest** at 2:48, the PR banner gone, with the Next card and the effort row.
- **S5a PR** at 2:58, with the banner.
- **S5b Summary** (a full-screen page):
  - `Workout A` / `Tue 13 Oct · 52 min`;
  - a 2 × 2 stat grid (Duration, Volume `9,840 kg`, Sets `26`, PRs `2`) with 40 px numerals;
  - the PR list;
  - the exercise list with best set;
  - a front/back body map on dark (session bands);
  - primary `Done`.
- **S6a Progress → Sessions.**
  - The volume bar chart.
  - Session rows: date, workout, then `52 min · 26 sets · 9,840 kg` and a `2 PR` tag.
- **S6b Progress → Lifts.**
  - The lift picker as a horizontal chip row.
  - The e1RM chart (accent line on a surface-1 card, grid at 8% white).
  - `Next: 62.5 kg`.
  - The records.
  - `Body` is the third segment. In S6b, show its heat-map **below the records**, under the
    heading `This week`: the silhouette on dark, plus the family bars and the gap lines.
- **S7a Program.**
  - Header `A/B Split`, with `3× per week · 2 workouts · 14 exercises`.
  - Two collapsible sections, `Workout A` and `Workout B`. Rows show name | `4 × 8–10` | `62.5 kg`;
    rest shows as muted sub-text.
  - `Weekly sets` family bars.
  - `⋯` for Copy, Switch, Reset, Delete and `Edit program details` (name, sessions per week, add,
    remove and reorder workouts).
- **S7b Edit an exercise.**
  - Tapping a row opens a **full-height prescription sheet** with big steppers, each a 64 px row
    with `−` value `+`:
    - Sets `4`;
    - Reps `8` to `10` (two steppers);
    - Rest `3:00` (15 s steps);
    - Start weight `62.5 kg`;
    - toggle `AMRAP last set`.
  - Inline validation (`Max reps must be at least min reps`).
  - Primary `Save`, `Cancel` at the top left, and `Remove from Workout A` as a red text button at
    the top.
  - Reorder is a `Reorder` text button that turns on drag handles.
  - Add is `+ Add exercise` (full-screen library).

**Visual language — dark graphite, apricot accent (the non-neon dark).**

| Role | Hex |
|---|---|
| bg | `#111315` |
| surface-1 | `#191C1F` |
| surface-2 | `#212529` |
| surface-3 | `#2A2F34` |
| hairline | `#30363C` |
| control border | `#454C54` |
| secondary text (5.99:1) | `#8B939C` |
| muted text (8.99:1) | `#AEB5BD` |
| text | `#E8EBEE` |
| hero numerals | `#F5F6F7` |
| **accent** (9.2:1 on bg; dark label `#1B1206` on it 9.15:1) | **`#F2A65E`** |
| danger | `#F07A6E` |

- Data families: push `#7FA8D9`, pull `#B49BD8`, legs `#8FC19A`, core `#D99494`.
- Heat ramp (sky): `#2A2F34` · `#2E4A63` · `#4F7EA6` · `#8EC1EE`.
- No pure black, and no shadows: elevation is a lighter surface.
- Type: **Archivo** (variable). UI at width 100, weights 400/500/600. Hero numerals and the timer
  at width 75 (`font-stretch: 75%`). Link:
  `https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&display=swap`.
- Scale: 13 caps label · 15 secondary · 17 body · 24 title · 40 stat · hero 96 · timer 120.
- Radius: 4 for chips and inputs · 8 for cards, buttons and steppers · 12 for sheet tops.
- Spacing: 4-pt scale, 20 px side margins.
- Icons: Lucide geometry, 2.0 stroke.

**Why it is not childish.**
- The look is a sports instrument (scoreboard numerals, condensed grotesk), not a toy.
- Graphite, not black. One warm, desaturated accent instead of neon.
- Square-ish 4–8 px radii. Colour appears only in data.

---

### Concept 3 — Guided Session · slug `guided-session`

**Thesis.** The app is your coach. It reads the plan to you, leads you step by step, and tells you
what changed and why.

**Who it suits, and the trade-off.** It suits a lifter who follows a program and wants to be told
what to do next, including warm-ups, weight increases and when to swap a busy machine. It needs no
thought, and it has an editorial calm. The trade-off:
- It is opinionated and linear: jumping ahead takes the Session plan.
- Starting costs 2 taps, because of the briefing.
- Serif headlines are the most "brand" choice, so they may polarise.

**Navigation.**
- **No tab bar.** Home is a single scrolling **Today** page, the hub. Everything else is a pushed
  page with a back chevron (iOS navigation stack):
  - `History`, `Progress`, `Program`, `Exercises`, reached from rows on Today;
  - `Settings`, reached from the avatar at the top right.
- **Workout mode** is a full-screen **stream**.
  - Top bar: `Workout A` with `Exercise 1 of 7 · 14:10`, and `⋯` on the right. `⋯` holds Pause,
    Session plan, Swap exercise, Exercise info, History, Finish early and Discard workout.
  - **Pause** returns to Today, where a **Resume card replaces the Today card** as the single
    primary: `Workout A in progress · 3 of 7 exercises · 31 min`, `Resume`.

**Set-logging interaction (a guided step stream, confirm or adjust).**
- The session is a vertical sequence of **steps**. For barbell lifts, warm-ups are inserted
  automatically as steps; they are skippable with `Skip warm-ups`.
- A **2 px left rail** runs down the page at x = 28, with step nodes:
  - ✓ for done;
  - a 12 px accent dot for current;
  - a hollow circle for upcoming.
- **Done steps compress** to one 40 px line: `Set 2 · 60 × 9 · RIR 1`.
- **The current step is a large card** (white, hairline, 8 px radius):
  - eyebrow `BACK SQUAT · SET 3 OF 4` (12 px caps, muted);
  - a **coach line** in Newsreader 22 px: `Step up to 62.5 kg. Set 1 went 60 × 10.`;
  - the values row, **left-aligned**: `62.5 kg × 8` with numerals at **64 px** IBM Plex Sans 600
    and units at 20 px. The whole row is tappable to adjust, with a pencil icon at the right
    (56 × 56);
  - a sub line: `Target 8–10 · last time 60 × 9`;
  - a tools row of 3 text buttons, each with an icon and 56 px tall: `Plates` · `Note` · `Swap`.
- Below the current card, only the **next** step shows, dimmed (`Set 4 · 62.5 × 8–10`), then
  `then Lunges`.
- **Primary:** a full-width 64 px bar, `Done · 62.5 × 8`.
- **Adjust** (tap the values) opens a bottom sheet:
  - two stepper rows, weight and reps, each 72 px with `−` and `+` at 64 px;
  - tapping a number opens the keypad in the same sheet;
  - the sheet's own primary is `Done · 65 × 8`.

| Task | Taps | Sequence |
|---|---|---|
| Start today's workout | **2** | Today → `Start Workout A` → briefing → `Begin`. |
| Log a set as planned | **1** | `Done · 62.5 × 8`. |
| Change weight one step, then log | **3** | Values → `+` → `Done · 65 × 8`. |
| Type a weight, then log | **5** | Values → number → `6` → `5` → `Done`. |
| Finish, all sets done | **1** | The stream ends with a `Finish workout` card; tap its primary. |
| Finish early | **3** | `⋯` → `Finish early` → confirm. |

**The briefing step** (the full screen after Start):
- `Workout A` in Newsreader 34 px;
- the coach paragraph `Seven exercises, about 53 minutes. Back squat moves up to 62.5 kg; everything
  else as last Friday.`;
- a numbered exercise list with prescriptions;
- a toggle row `Include warm-ups for Back squat` (on);
- primary `Begin`.

**Rest timer (rest is a step in the stream).**
- After `Done`, the card compresses to its done line, and a **rest card** takes the current slot:
  - eyebrow `REST · AFTER SET 3`;
  - `2:48` at **80 px** Plex Sans 600 tabular, left-aligned;
  - a full-card-width 6 px bar draining in the accent;
  - `−15 s` and `+15 s` outline buttons (56 px);
  - a coach line from the exercise note: `Belt from set 3. Brace before you unrack.`;
  - the effort question, when tracking is on: `How did set 3 feel?` with chips `RIR 0 · 1 · 2 · 3+`.
- The next step card shows below it, editable.
- Primary: `Skip rest`.
- **At zero:** a chime. The stream scrolls itself (250 ms) so set 4 becomes the current card.
- **Over-time:** the rest card shows `+0:12` in the danger colour.
- **After the last set of an exercise:** the rest card's coach line reads
  `All 4 sets logged · Up next: Lunges, 3 × 10–12 at 8 kg.`

**PR behaviour.**
- There is no toast. The PR is written into the stream.
- The done line for set 3 gets a `PR` tag (accent outline).
- The rest card opens with a **PR banner inside the card**: accent-tint background, 8 px radius,
  `New PR · Heaviest set · 62.5 kg × 8` in Plex 17/600, and `+2.5 kg on Friday` under it.
- It animates in like a toast (slide and fade, 200 ms), stays for the whole rest, and never blocks.

**Secondary tools.**
- `Plates` and `Note` open bottom sheets. `Swap` is full screen; it lists alternatives ranked by
  the gym's equipment, with `Do this instead`.
- Set type lives in the Adjust sheet as a segmented row.
- **S3b is the Session plan** (from `⋯`), a full-screen page:
  - the 7 exercises as numbered stations with status and best set (M2-style data, but at M1:
    Back squat 2/4);
  - each upcoming station has a `Do next` button, which reorders the stream. This is the coach's
    answer to a busy machine;
  - a `Swap` button per station.

**Screens.**

- **S1 Today** (the hub page; the frame shows the top of the scroll):
  - eyebrow `Tuesday 13 October`, with the avatar and sync glyph at the top right;
  - headline `Workout A today.` in Newsreader 34 px;
  - the coach paragraph `Back squat moves up to 62.5 kg. Everything else as last Friday.` in
    Newsreader 20 px, secondary ink;
  - the **session card**: the 7 exercises as numbered lines (`1  Back squat  4 × 8–10`) and
    `~53 min · 23 sets`;
  - the section `This week`: `1 of 3 · Workout B done yesterday` with a 3-segment bar;
  - the start of the section `Recent` peeking above the sticky bar;
  - a **sticky bottom bar**: `Start Workout A` (64 px, accent).
  - Rows further down the scroll, not visible in S1 and listed in the prototype: Recent (3
    sessions, `All history ›`), Your lifts (3 rows with e1RM and a sparkline, `All progress ›`),
    Program (`A/B Split ›`), Exercises (`876 exercises ›`).
- **S2 Session plan** at M2 (the S3b page at the M2 moment):
  - Back squat and Lunges done, with their best sets;
  - DB bench press current, `2 of 4`;
  - 4 upcoming, each with `Do next`.
- **S3 Step (M1)**: the stream with the rail.
  - Visible above the current card: the compressed done lines `Warm-ups · 3 done`,
    `Set 1 · 60 × 10`, `Set 2 · 60 × 9 · RIR 1`.
  - The current card for set 3.
  - The dimmed next step.
  - The primary bar.
- **S3b** the Session plan, at M1.
- **S4 Rest** at 2:48; the rest card's PR banner is still present (it lasts the whole rest).
- **S5a PR** at 2:58: the moment the banner animates in, with the set-3 line highlighted.
- **S5b Summary** (a full-screen page):
  - the headline `Workout A, done.` in Newsreader 34 px;
  - the coach paragraph `52 minutes, 26 sets, 9,840 kg. Two records on Back squat. Volume up 4.6%
    on last Friday.`;
  - a stat row;
  - `Records` with 2 rows;
  - the exercise list (name and best set);
  - a body map, `Worked today`;
  - the coach line `Next: Workout B, Thursday.`;
  - primary `Done`.
- **S6a History page** (pushed):
  - the title `History` in Newsreader 34;
  - the volume bar chart;
  - sessions grouped under editorial headings `This week` / `Last week`. Each row: `Tue 13 Oct` /
    `Workout A`, with stats right-aligned and the `2 PR` tag.
- **S6b Progress page** (pushed):
  - the title `Progress`;
  - lift tabs (text tabs with an accent underline);
  - the coach line `Back squat e1RM up 8.3 kg in three weeks.`;
  - the e1RM chart;
  - `Next: 62.5 kg`;
  - the records;
  - `This week` heat-map (silhouette) with the family bars and gap lines.
- **S7a Program page** (pushed), which reads as a document:
  - `A/B Split` (Newsreader 34);
  - `Three sessions a week, alternating A and B.`;
  - each workout as a numbered list. Each line is the name, then a prescription line `4 × 8–10 ·
    62.5 kg · rest 3:00` in Plex tabular;
  - `Weekly volume` as one sentence plus the family bars and gaps;
  - `Edit` at the top right; `⋯` for Copy, Switch, Reset and Delete.
- **S7b Edit (token editing).**
  - In edit mode, each prescription line breaks into **tappable tokens**: `[4 sets] [8–10 reps]
    [62.5 kg] [rest 3:00]`. Tokens are outlined chips, 6 px radius, 44 px tall, in rows with 56 px
    pitch.
  - Tapping a token opens a small bottom sheet with one stepper (and the AMRAP toggle on the reps
    token).
  - Drag handles on the left reorder lines. Removing a line is undoable.
  - `Add exercise…` ends each workout list; `Add workout` ends the page.
  - Rename and sessions per week are tokens in the header sentence: `[A/B Split]`,
    `[Three] sessions a week`.
  - `Cancel` and `Save` in the top bar.

**Visual language — light, ink navy, rust accent (editorial).**

| Role | Hex |
|---|---|
| page | `#F7F7F5` |
| surface | `#FFFFFF` |
| fill | `#EEEEEA` |
| hairline | `#E2E2DD` |
| control border | `#C8C8C1` |
| muted text (5.46:1) | `#5E6573` |
| secondary text (8.73:1) | `#3E4757` |
| ink (14.9:1) | `#14213D` |
| **accent** (white on it 7.31:1; as text 6.81:1) | **`#9A3412`** |
| accent pressed | `#7F2A0E` |
| accent tint | `#FBEDE6` |
| danger | `#B42318` |

- Use danger only with an icon, so it is never confused with the accent.
- Data families: push `#2F5D8A`, pull `#6B4F8F`, legs `#486F46`, core `#8F5A16`.
- Heat ramp (navy): `#E6E8EE` · `#B5BED0` · `#6C7FA3` · `#2B3F68`.
- Type: **Newsreader** 500/600 for headlines and coach lines only, at most 2 serif elements per
  frame and never on numbers. **IBM Plex Sans** 400/500/600 for the UI and all numerals, tabular.
  Link:
  `https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap`.
- Scale: 12 caps · 15 secondary · 17 body · 22 coach line · 34 headline · values 64 · rest 80.
- Radius: 4 for inputs · 6 for chips and tokens · 8 for cards · 12 for sheet tops. Buttons are 6.
- Spacing: 4-pt scale, 20 px margins, 32 px between Today sections.
- Icons: Lucide geometry, 1.5 stroke.

**Why it is not childish.**
- The voice is a coach's: terse sentences, a serif used like a sports magazine, numbers in a sober
  grotesk.
- Navy ink in place of black, and one rust accent.
- Tight radii and a strong left edge. The rail encodes progress; it is not ornament.

---

### Concept 4 — Progress Dashboard · slug `progress-dashboard`

**Thesis.** Home is your training data. Each workout is a live entry into it, and every set shows
what it means before you log it.

**Who it suits, and the trade-off.** It suits a lifter motivated by numbers: e1RM trends, weekly
volume balance and records. They want progress visible every time the app opens, and they like
knowing "this set is a PR attempt". The trade-off:
- The busiest Home of the four. It must stay disciplined, or it slides into dashboard clutter.
- Data-flavoured logging adds lines that the other concepts omit.

**Navigation.**
- 4 bottom tabs: **Dashboard · Sessions · Lifts · Program**.
  - The exercise library is a segment in Program (`Program | Exercises`) and also a search inside
    Lifts.
  - Settings sits behind a gear at the top right of Dashboard.
- **Workout mode** is a full-screen **Live session** with the tabs hidden.
  - **Minimise:** a chevron-down at the top left. The session becomes a **48 px live strip pinned to
    the top of every tab** (just below the status bar, surface colour with a hairline):
    - a 8 px accent dot;
    - `Workout A · 31:40 · Rest 2:48`;
    - a `Return` text button.
  - Tapping the strip restores the session.
  - `Finish` sits at the top right of the Live session header.

**Set-logging interaction (a set grid with projection).**
- The Live session screen, top to bottom:
  - **Live header** (88 px):
    - `Workout A` with the elapsed time `14:10`;
    - a slim bullet bar `Volume 1,530 kg · last A at this point 1,470 kg`, where the bar shows
      today against the last A marker;
    - the counters `Sets 2/23 · PRs 0` (working sets; warm-ups don't count), all 13 px tabular.
  - A **`Now | All` segmented control** (44 px; outside the hero zone, so 44 px is acceptable
    only here. If you can, make it 56 px).
  - **Now view, the current exercise card:**
    - `Back squat · Set 3 of 4 · target 8–10`;
    - a **set grid**: 4 cells of 76 × 64, one per working set, plus a `W 3` cell. Done cells show
      `60×10` with a check; the current cell has an accent outline and shows `62.5×8`; future cells
      show the plan;
    - `Last time 60 × 9 · Fri 9 Oct`;
    - the **hero stepper pair**: `−` / **`62.5`** kg / `+`, then `−` / **`8`** reps / `+`. Numerals
      are **60 px** Geist 600; steppers are 56 × 56;
    - **the projection line** (the concept's signature): `e1RM 75.0 · record 74.2 → PR if logged`.
      The `PR if logged` part is an accent-outline tag, recomputed live as the steppers change.
  - Under the card, **the other exercises as compact 56 px rows**: name, mini set dots (✓ / ○) and
    a bullet bar of volume against last time. This is what makes the Now view also an overview.
  - **Primary:** `Log set 3`, full width, 64 px, accent.
- **The `All` view (S2)** shows every exercise as a row with its full set grid (cells 56 × 56).
  **Tapping a cell logs that set as planned**, so you can quick-log in any order, for supersets or a
  missed tick. Tapping a logged cell opens the edit sheet.
- Tapping a numeral opens the keypad sheet (the 4 × 4 layout from Concept 1, keys 64 px).

| Task | Taps | Sequence |
|---|---|---|
| Start today's workout | **1** | Dashboard dock → `Start Workout A`. |
| Log a set as planned | **1** | `Log set 3`, or the current cell in `All`. |
| Change weight one step, then log | **2** | `+` → `Log set 3`. |
| Type a weight, then log | **4** | Numeral → `6` → `5` → `Log`. |
| Finish, all sets done | **1** | The rest panel's primary becomes `Finish workout`. |
| Finish early | **2** | `Finish` → sheet `14 sets not logged` → `Finish workout`. |

**Rest timer (a bottom rest panel that replaces the primary bar).**
- The panel is 152 px, on surface with a hairline top:
  - the countdown `2:48` at **64 px**, left;
  - to its right, a **rest bar**: a horizontal track with a marker labelled `you usually rest 2:40`.
    This is data in place of a bare ring;
  - a row of three 56 px buttons: `−15` · `+15` · `Skip`;
  - the offer `Use 2:40 for Back squat` as a quiet text button above the panel.
- The card above stays live. The set grid's next cell (set 4) becomes the current target. Tapping
  it logs early. The steppers edit set 4.
- Effort chips (`RIR 0 · 1 · 2 · 3+`, 56 px) appear under the set grid for the just-logged set, when
  tracking is on.
- **At zero:** a chime, and the panel reverts to `Log set 4`.
- **Over-time:** `+0:12` in the danger colour.

**PR behaviour.**
- A toast drops from the top for 3 s: `New PR · Heaviest set · 62.5 kg × 8 · +2.5 kg`. Beside the
  text is a **48 × 20 px sparkline** of that record's history. That is data, not a trophy.
- The live header's `PRs` counter ticks to 1.
- The grid cell keeps a `PR` tag.

**Secondary tools.**
- The exercise card's `⋯` (top right of the card, 56 × 56) opens the **exercise tools sheet** (this
  is **S3b**). It is a bottom sheet with three segments: `Plates | Warm-up | Notes`.
  - Plates: a drawn bar.
  - Warm-up: the ramp with `Add to grid`.
  - Notes: the note and the session note.
  - Below the segments: `Set type`, `Rest time`, `Swap exercise`, `Exercise info`, and
    `Lift history` (which opens that lift's page in Lifts, full screen).

**Screens.**

- **S1 Dashboard.**
  - The title `Dashboard`, with the gear and the sync glyph.
  - A **KPI row** of 3 tiles (surface, hairline, 12 px radius; numerals 28 px):
    - `Sessions 1/3`;
    - `Sets 23` (this week);
    - `Volume 8,920 kg`.
    Each has a muted sub-line against last week: `vs 3`, `vs 75`, `vs 27,240`.
  - **Muscle week**, a compact **matrix heat-map**: 11 region rows × 1 column (this week), as cells
    with labels, using the heat ramp and a swatch legend. Gap lines under it.
  - **Lifts**: 3 rows (Back squat 74.2, DB bench press 14.8, Deadlift 81.3), each with a 64 × 24
    sparkline and a delta, before today.
  - A **docked Today panel** above the tabs (surface, hairline top, 128 px):
    - `Workout A due · last Fri 9 Oct`;
    - `7 exercises · 23 sets · ~53 min`;
    - `Start Workout A`, full width, 56 px.
    It stays docked while the data above scrolls.
- **S2 Live session → All** (M2): the live header with `Sets 9/23 · PRs 1`, the `All` segment, the
  7 exercises with their set grids, DB bench press current, the primary `Log set 3`.
- **S3 Live session → Now** (M1) as specified.
- **S3b** the exercise tools sheet on `Plates`.
- **S4 Rest** at 2:48: the panel, with the effort chips and the grid showing set 3 done with `PR`.
- **S5a PR** at 2:58, with the toast and its sparkline.
- **S5b Summary** (full screen, data-dense):
  - 4 KPI tiles: Duration `52 min`, Volume `9,840 kg` with `+4.6% vs last A`, Sets `26`, PRs `2`;
  - a per-exercise **table**: Exercise | Best set | Volume | Δ vs last;
  - the PR rows, each with a sparkline;
  - the session matrix heat-map (session bands);
  - primary `Done`; secondary `Share`.
- **S6a Sessions tab.**
  - A 6-week calendar strip: 7 columns × 6 rows of 20 px squares. A filled neutral square marks a
    session day; today has an accent outline.
  - The volume bar chart.
  - The session list rows.
  - The full **muscle matrix**: regions × the last 4 weeks, with a swatch legend.
- **S6b Lifts tab → Back squat.**
  - Search, and the lift chips.
  - A range toggle `1M | 3M | 1Y`.
  - The big e1RM chart (220 px tall; dated x-axis; latest labelled; record points as accent dots).
  - `Next: 62.5 kg`.
  - The records table.
  - `Workout B: 46 bodyweight reps` as a stat line.
- **S7a Program tab.**
  - Header `A/B Split`.
  - At the top, a **weekly-volume stacked bar** by family (planned), with values.
  - Workout A and B as **grids**: Exercise | Sets×Reps | Rest | kg columns, tabular,
    right-aligned.
  - `Edit` at the top right.
- **S7b Edit (spreadsheet with impact).**
  - The grids become editable cells (tap a cell → keypad sheet). Rows get drag handles and a `⋯`
    (Remove with Undo, AMRAP last set).
  - A docked **impact panel** at the bottom shows how the edit changes the weekly volume:
    `Legs 7 → 8 sets/week` with a before/after bar. The example change is Back squat sets 4 → 5.
  - `+ Add exercise` per workout opens the library full screen.
  - `Cancel` and `Save` in the top bar.

**Visual language — light, cool neutral, indigo accent (analytical).**

| Role | Hex |
|---|---|
| page | `#F6F6F8` |
| surface | `#FFFFFF` |
| fill | `#EEEEF2` |
| hairline | `#E3E3E9` |
| control border | `#CACAD3` |
| muted text (5.57:1) | `#62626F` |
| secondary text (8.78:1) | `#45454F` |
| ink (16.7:1) | `#16161D` |
| **accent** (white on it 8.86:1) | **`#4338A8`** |
| accent pressed | `#362C8C` |
| accent tint | `#EEEDF8` |
| danger | `#B42318` |

- Data families: push `#256F91`, pull `#96506F`, legs `#4F7A33`, core `#93611A`.
- Heat ramp (teal): `#E6F1F2` · `#A9D3D6` · `#4E9DA4` · `#1D6970`.
- Charts: series lines are 2 px; grid is the hairline colour; axis labels are 12 px muted
  tabular.
- Type: **Geist** 400/500/600 for everything, tabular. Link:
  `https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap`.
- Scale: 12 label · 14 meta · 16 body · 20 section · 28 KPI · hero 60 · timer 64.
- Radius: 6 for cells and inputs · 10 for buttons · 12 for cards and sheet tops.
- Spacing: 4-pt scale, 16 px margins, 12 px gaps between tiles.
- Icons: Lucide geometry, 1.75 stroke.

**Why it is not childish.**
- It reads as an analytics product: a grid, aligned tabular figures, labelled axes, legends with
  swatches.
- Colour lives only in charts and the matrix. The chrome is grey.
- Records are sparklines, not medals.

---

## Part 3 — Comparison

| | 1 Set Table | 2 Single Set Focus | 3 Guided Session | 4 Progress Dashboard |
|---|---|---|---|---|
| IA | 4 tabs: Today · History · Progress · Library | 3 tabs: Train · Progress · Program | No tabs: Today hub, with pushed pages | 4 tabs: Dashboard · Sessions · Lifts · Program |
| Workout mode | A sheet that minimises to a mini-bar above the tabs | A full-screen takeover; pause gives a resume bar | A full-screen stream; pause gives a Resume card on Today | Full screen; minimises to a live strip at the top of every tab |
| Logging model | An editable table, ✓ per row, with the active row enlarged | One set card, 96 px numerals, steppers and keypad | A step stream: confirm (`Done`) or adjust (sheet) | A set grid with a projection line (`PR if logged`) |
| Start / log / change+log / finish (taps) | 1 / 1 / 3 / 1 (early 2) | 1 / 1 / 2 / 1 (early 3) | 2 / 1 / 3 / 1 (early 3) | 1 / 1 / 2 / 1 (early 2) |
| Rest | An inline strip plus a 112 px dock | The screen becomes the instrument (120 px ring timer) | A rest card in the stream; auto-advances | A bottom panel with a "usual rest" marker |
| PR | A toast under the header, and a row flash | A banner under the top bar | A banner inside the rest card | A toast with a record sparkline |
| Theme | Light | Dark (graphite) | Light | Light |
| Accent | Court green `#185C3F` | Apricot `#F2A65E` | Rust `#9A3412` on navy ink | Indigo `#4338A8` |
| Fonts | Inter + Inter Tight | Archivo (width 75 for numbers) | Newsreader + IBM Plex Sans | Geist |
| Best for | Experienced lifters, non-linear sessions | Phone-on-the-bench, dim gyms, zero thought | Plan followers who want to be led | Data-motivated lifters |
| Risk | Generic, a "Strong clone"; table density | Session context hidden; dark not for everyone | Linear and opinionated; the serif may polarise | A cluttered Home; the most text mid-set |

---

## Part 4 — Designer instructions (common to all)

### 4.1 Deliverables

Two files in `mocks/<slug>/`:

1. **`index.html`** — one self-contained file. Allowed:
   - inline `<style>` and `<script>`;
   - the single Google Fonts `<link>` given in your concept;
   - inline SVG icons only (Lucide path data is fine; it is ISC-licensed).

   Not allowed: other external assets, images, frameworks or CDNs.

   Put every colour, size and radius in `:root` custom properties, named by role (`--page`, `--ink`,
   `--accent`…), and use only those.

2. **`rationale.md`** — at most one page:
   - the 5–8 key decisions and why;
   - a 25-row checklist table (item # · pass · evidence: frame and measurement);
   - the tap-count table;
   - any shade you added, with its contrast ratio.

Also commit **`board.png`**, the final full render.

### 4.2 Board layout (fixed geometry, so renders can be cropped)

- Board size **2760 × 3240 px**. `body { margin: 0; width: 2760px; height: 3240px }`.
- Board background: `#E4E5E7` for light concepts, `#0B0C0E` for Concept 2. Board text: 14 px.
- **Header, y 0–352**, padded 48 px:
  - the concept name (40 px);
  - the thesis (20 px);
  - three short lines: Navigation · Logging · Look;
  - a token strip: neutral ramp, accent and the 4 data colours as 40 px swatches with their hexes,
    plus one line of font specimen.
- **Frames** at column x = **48, 494, 940, 1386, 1832, 2278**, all 390 × 844. Each label sits 36 px
  above its frame, in 14 px/600 board text: code + name + one-line note.

| Row | Frame top y | Columns 1–6 |
|---|---|---|
| 1 | 400 | P · S1 · S2 · S3 · S3b · S4 |
| 2 | 1356 | S5a · S5b · S6a · S6b · S7a · S7b |
| 3 | 2312 | F1 · F2 · F3 · S8 · panel spanning columns 5–6 |

- The row-3 panel is 836 × 844 at x = 1832. It holds the tap-count table and the 25-item
  self-check (as on the board, 13 px).
- **Flow strip** (F1–F3), with captions under each frame:
  - **F1** is S3 with a tap marker on `Log set 3`;
  - **F2** is the rest state at 2:59 with the PR notice;
  - **F3** is set 4 ready, after the rest ended.
  - Caption examples: `Tap 1 · Log set 3`, `Rest starts automatically · PR shown, nothing blocks`,
    `At 0:00 → set 4 pre-filled · 0 taps`.
  - Tap markers are **board annotations, not design**: a 44 px circle with a 2 px dashed `#E5007E`
    stroke.
- Static frames are pixel-accurate screens. Content that would scroll is simply cut off at the
  frame bottom (`overflow: hidden`).

### 4.3 Interactivity (frame P, the live prototype)

P starts on S1 and must work with mouse clicks:

1. Tabs, or the hub rows for Concept 3, switch between Home, History/Progress and Program. You may
   reuse the static frames' markup.
2. Start (plus `Begin` for Concept 3) opens workout mode **at moment M1**: Back squat, sets 1–2
   logged, set 3 pre-filled at 62.5 × 8. The steppers and `+`/`−` change values by 2.5 kg and 1 rep.
3. Logging set 3:
   - shows the PR notice in the form the concept specifies;
   - marks the set done;
   - **starts the rest countdown from 3:00, ticking in real seconds**. Use `Date.now()` and a
     250 ms interval, with tabular figures.
4. `−15`, `+15` and `Skip` work. At 0, or on Skip, **set 4 appears**, pre-filled 62.5 × 8. Over-time
   shows if the concept specifies it.
5. Logging set 4 starts rest and shows `All 4 sets logged · Up next: Lunges`.
6. Finish → summary (S5b content) → `Done` → back to Home.
7. Minimise, Pause or Return works as your concept specifies.

Keep the JS plain and small. Respect `prefers-reduced-motion`. Motion is 150–250 ms ease-out,
and only to explain a change.

### 4.4 Render check (mandatory before you declare done)

Run from the repository root:

```bash
bash docs/design/redesign-2026-10/render.sh \
  docs/design/redesign-2026-10/mocks/<slug>/index.html \
  docs/design/redesign-2026-10/mocks/<slug>/board.png 2760 3240
```

The script cannot take a query string. To inspect frames at true size, crop the board with Python
3 and Pillow, into a temp folder outside the repo:

```bash
python - <<'PY'
from PIL import Image; import os, tempfile
src = 'docs/design/redesign-2026-10/mocks/<slug>/board.png'
out = os.path.join(tempfile.gettempdir(), '<slug>-frames'); os.makedirs(out, exist_ok=True)
xs = [48, 494, 940, 1386, 1832, 2278]; ys = [400, 1356, 2312]
names = [['P','S1','S2','S3','S3b','S4'], ['S5a','S5b','S6a','S6b','S7a','S7b'], ['F1','F2','F3','S8']]
im = Image.open(src)
for r, row in enumerate(names):
    for c, n in enumerate(row):
        im.crop((xs[c], ys[r], xs[c]+390, ys[r]+844)).save(os.path.join(out, n + '.png'))
im.crop((0, 0, 2760, 352)).save(os.path.join(out, 'header.png'))
print(out)
PY
```

Use `python3` if `python` is not Python 3 on your host.

Then **view every crop with the Read tool** and fix what looks wrong:
- clipping and overflow;
- fallback fonts (check that the specified face actually rendered);
- misaligned columns;
- text under 4.5:1;
- a hero under 60 px;
- two competing primaries;
- anything that looks like decoration.

Re-render until it is clean. The final `board.png` must be the clean one.

### 4.5 Don'ts

- No numbers, names or dates other than Part 1's.
- No lorem ipsum, emoji, exclamation marks, gradients, stock photos, illustrations, trophies,
  medals or confetti.
- No browser-default controls (`<select>`, radios, checkboxes, date inputs). Draw them.
- No second accent. Data colours stay inside data.
- Only the body-map silhouette may be drawn freehand. It is an anatomical front/back outline built
  from simple paths: no face, no hands detail, no cartoon proportions, about 120 px tall per view,
  regions filled from the heat ramp, the outline in control-border grey.
- Do not look at the other concepts' folders. Divergence is the point.
