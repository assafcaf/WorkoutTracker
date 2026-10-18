# Design audit: Workout Tracker as built (2026-10-13)

The owner says the app "looks like a child did it". This audit is blunt and covers both the
**visual** layer and the **structure and interaction** layer, ranked together.

Evidence comes from:
- reading every screen and component in `src/ui`, `src/features` and `src/styles`;
- the seed data in `src/data`;
- a live run of the dev build in Chrome at about 390 px wide. That run drove the real flow from a
  new user through choosing a program, starting Workout A, logging a set, the rest state and
  finishing. Geometry was measured with `getBoundingClientRect` and a few frames were captured.
  The browser connection was unstable, so most screens are audited from code. Measured facts are
  marked **[measured]**.

File references are `path:line` against `main` at `3726e6a`.

---

## 0. The diagnosis in one paragraph

The app does not look childish because of its colours. It looks childish because **nothing has
been designed at the component level**:
- The headings are browser defaults.
- The keypad keys are unstyled system buttons.
- The weight and reps dials are physically broken at phone width.
- The rest timer sits on top of other controls.
- Every secondary action is the same clay-text-on-white blob.
- The screens are vertical piles of every feature the epics added, in the order they were added.

The palette (ivory, white, beige) has too little contrast between layers, so the result looks
mushy rather than calm. The "court stripe" reads as a ribbon on a school project.

Structurally:
- The **Workout tab is nearly empty**.
- The **Program tab is overloaded** with five body maps.
- **Settings duplicates Program**.
- The **Set screen tries to be every tool at once**, so the one number that matters in the gym
  (what to lift now, against what you lifted last time) is a 14 px muted line.

---

## 1. Inventory of screens and components

The navigation is a **top** tab bar with five tabs: Workout, Program, Exercises, History and
Settings (`src/ui/TabBar.tsx`, `src/ui/TabBar.css:12-13` `position: fixed; top: 0`).
- The tab bar hides inside a session or an editor (`src/ui/AppShell.tsx:225`).
- Every screen is one `AppShell`: a sticky header (back chevron, Barlow title, CourtStripe under
  the title, trailing "Update ready" pill), then the content, then an optional sticky bottom
  action bar.

| # | Screen / component | Purpose | What is on it (top → bottom, as built) | Primary action | Hierarchy as built |
|---|---|---|---|---|---|
| 1 | **Workout tab, picker** (`WorkoutFeature.tsx:710-734`, `WorkoutStartButtons.tsx`) | Start today's workout | Header "Workout" + stripe; backup nag in ochre; ResumeCard if a session is open; program name as a browser-default `h2` (24 px/700 system font **[measured]**); one white card per workout with a default `h3` ("Workout A", 18.7 px/700 **[measured]**) and a full-width green "Start Workout A"; cards get alternating green/clay 4 px left borders | Start Workout X (one per workout, all equal) | Flat. The `h2` is bigger than the screen title (20 px Barlow). Nothing says which workout is next, when each was last done, or what it contains |
| 1a | NoProgram (`NoProgram.tsx`) | Empty state for a new user | "No program yet" + green "Choose a program" in a beige card | Choose a program → Program tab | Fine, but bare. No explanation |
| 1b | ResumeCard (`ResumeCard.tsx`) | Resume an open session | Program name (muted) + green "Resume Workout A" | Resume | A second green button above the Start buttons, so two or three equal primaries |
| 2 | **Exercise list (in session)** (`ExerciseList.tsx`, `.css`) | The session's map: what's done, what's next | Back + workout name; raw unstyled elapsed time "00:13" (16 px system, no CSS at all); one white row per exercise: name, `working/planned` ("0/4"), a "Volume vs last workout: 0%" bar or "No previous workout"; optional "Undo swap" or "Last time: X"; session note; "Add note" and "Discard workout" as two equal clay-text pills; sticky "Finish workout" | Tap a row → Set screen; Finish workout | **Broken row layout [measured]**: the row is a flex row with `space-between` (`ExerciseList.css:22`), so name, "0/4" and the volume block become three columns. "0/4" floats at x=143..195 depending on name length. Rows are 46 or 69 px tall when names wrap. "No previous workout" repeats 7×. No target weight, reps or "next up" marker |
| 3 | **Set screen** (`SetScreen.tsx`, 1168 lines; `SetScreen.css`; `dial.css`) | Log the current set | Back + exercise name; elapsed time; links row (Exercise info · Alternatives · History, clay-on-white pills); "SET 1 OF 4" (Barlow caps, 14 px muted); "Last time: 60×10 · 60×10 · …" (14 px muted); logged-set chips ("50 × 8", 1 px black outline pills, PR badge); exercise note / "Add note"; **two dials side by side** (Weight, Reps), each with heading, −, a 64 px readout, unit, "Type weight", a scroll ladder, +; Weight step `<select>`; plate line "Per side: 15"; Bodyweight toggle; set-kind row (W-up / Working / Drop / Fail / AMRAP); "Add warm-ups" / warm-up ramp line; errors; sticky **Log set**; undo bar; PR toast; "Set 1 logged · 50 kg × 8"; effort chips (RIR 0/1/2/3+); "Next: set 2 · 50 kg × 8–10"; RestDial (inline, at the bottom); "Use 2:30 for Back squat" offer | Log set | **About 18 stacked blocks [measured: 972 px tall before logging, 1041 after]**. The confirmation and "Next:" lines sit at y≈900, below the fold. The dials are broken (§2, P1) |
| 3a | **Rest state** (same screen, `SetScreen.tsx:887-912`) | Rest between sets | "Rest" label + a 64 px Barlow clock in a white 20 px-radius tile, absolutely positioned top-right (`SetScreen.css:53`); −15 s / +15 s / Skip; the Log button's label becomes "Rest 2:58" (`SetScreen.tsx:859-863`) | Still "Log set", now labelled "Rest 2:58" | **Overlaps [measured]**: the 376×158 timer box covers the links row, the set counter and the first logged chip. `elementFromPoint` at the "Exercise info" pill returns `.rest-timer`, so Info, Alternatives and History **cannot be tapped while resting**. The clock appears twice (tile + button) |
| 3b | Keypad (`Keypad.tsx`, `Keypad.css`) | Type a weight or rep count | Opens **inside the half-width dial** (`dial.css` `.dial > .keypad` spans the 184 px card); 3-column grid of buttons with **no styling beyond min-height** (`Keypad.css:23-24`), so they are grey OS-default buttons; Cancel / OK | OK | The single most amateur-looking control in the app |
| 3c | RestDial (`RestDial.tsx`) | Set the rest length | Tapping the clock at the *top* inserts a dial card at the *bottom* of the screen (`SetScreen.tsx:1138`), off-screen | Set rest | Cause and effect are 900 px apart |
| 3d | Warm-up ramp | Barbell warm-ups | "Add warm-ups" pill → ramp 50 % × 5, 70 % × 3, 85 % × 2 (`domain/warmup.ts:11-15`); line "Warm-up 1 of 3 · 30 kg × 5" | Log set (logs the warm-up) | Good feature; it reads as a footnote |
| 3e | Plate line | Plates per side | "Per side: 20 · 1.25" or "Nearest 62.5 kg · per side: …" — 14 px muted, centred between a `<select>` and a toggle **[measured]** | — | Squeezed between unrelated controls |
| 3f | PR (`SetScreen.css:192-212`) | Celebrate a record | Clay pill "PR" on the chip + a clay toast "New PR · Heaviest set · 62.5 kg × 8", fixed `bottom: 6rem` for 3 s | — | The PR "medallion" of decision 0009 isn't used here. Clay pill ≠ gold |
| 4 | **Session summary** (`SessionSummary.tsx`) | Close the session | Full-screen overlay: stripe; "Session summary" (system bold 28 px, not Barlow); "1 min"; "400 kg" (16 px plain, **no labels**) **[measured]**; PR bullet list; front/back body map (left-aligned, max 280 px); legend "0 / 1–2 / 3–5 / 6+ sets" as **text with no swatches**; "Done" pill | Done | The payoff moment of the whole app is a plain text list |
| 4a | RegionPanel (`RegionPanel.tsx`) | Which exercises hit a region | Another full-screen overlay on top of the summary: region name, count, contributors, "Browse exercises", "Close" | Browse exercises | Full-screen-over-full-screen; should be a sheet |
| 5 | **Program tab** (`ProgramPage.tsx`) | Choose, edit and inspect programs | "Active program" legend; "New program"; per program a radio row + Edit + Copy (+ Delete / Reset → Confirm); program name `h2` (default); **per workout** a card with a default `h3`, plan lines "Back squat 8-10 x 4, rest 180s", a body map and a legend; "Weekly volume" card with a body map, legend and gaps ("No direct calves work"); "This week" card with Planned and Done body maps, legend and "No sets logged in the last 7 days" | Edit / switch program | **Five body maps** for a two-workout program (`ProgramPage.tsx:126, 228, 244, 248`). "Weekly volume" and "This week → Planned" draw the **same map twice**. "A/B Split" is printed twice in a row **[measured]** |
| 5a | New-user picker (`ProgramPage.tsx:258-283`) | First choice | "Choose a program" + one card per bundled program: name + green "Use this A/B Split" + outlined "New program" | Use this … | The copy "Use this A/B Split" reads as machine-generated |
| 6 | **ProgramEditor** (`ProgramEditor.tsx`, 501 lines) | Edit a program | Header "Edit program"; a "Cancel" button as the first body element; Program name; Sessions per week; "Workouts" heading; per workout a fieldset: name + Move up / Move down / Remove workout; **per exercise** a box with Sets, Min reps, Max reps, Rest (s), Starting weight (kg), a "Last set AMRAP" checkbox and Move up / Move down / Remove; "Add exercise" (full-screen picker overlay: search + 876-item list + Pick); "Add workout"; sticky Save | Save | A database form. 14 exercises × (5 inputs + checkbox + 3 buttons) ≈ **126 controls on one scroll**. No drag-to-reorder and no collapsed summary rows |
| 7 | **History tab** (`HistoryFeature.tsx`, `HistoryList.tsx`, `HistoryStatsSwitch.tsx`) | Past sessions + stats | Segmented control History \| Stats; per session one big button whose label is six inline spans: "2026-10-13 A/B Split Workout A 52 min 26 sets 9,840 kg" (ISO date, `HistoryList.tsx:47`); expanding shows per-exercise groups with an Edit each, then "Open session" (→ summary overlay) and "Edit workout" (→ SessionEditor) | Expand → Open / Edit | The row is a sentence, not a card. Wrapping is uncontrolled |
| 7a | SessionEditor (`SessionEditor.tsx`) | Fix a past session | Workout name; groups; per set Edit / Delete; Add set; Keep / Confirm; Delete workout; Cancel; Save | Save | Text-button soup |
| 7b | **Stats** (`Stats.tsx`) | Progress | Card "Exercise progress": native `<select>` of exercises; ProgressionBar ("Next: 62.5 kg"); LineChart (e1RM / reps / load, clay line, y-ticks, **no x-axis or dates**); records list, each with a 20 px gold circle containing a 4 px stripe (the "medallion"), label, value (Barlow) and ISO date. Card "Volume": BarChart, clay bars with **no axes, labels or values** | Pick exercise | Two charts with no way to read them. Records are the best thing here and are drawn at 14 px |
| 8 | **Exercises tab** (`ExercisesFeature.tsx`, `LibraryList.tsx`) | Browse the 876-exercise library | Search + muscle and equipment `<select>`s; "My gym only" chip; rows (name + one MuscleChip pastel pill); **Previous / Next pager, 10 rows per page** (`LibraryList.tsx:7`) | Open detail | Pagination on a phone list of 876 items |
| 8a | ExerciseDetail overlay (`ExerciseDetail.tsx`) | Exercise reference | Back; name `h1`; "Primary muscle: [chip]", "Secondary muscles: …", "Equipment:", "**Mechanic:**", "**Force:**", "**Level:**" (`:96-101`); video link; numbered instructions; photos; "Similar exercises"; optional "Do this instead" | Swap (when opened from a session) | A raw dump of the open-source dataset's fields |
| 8b | Alternatives overlay (`AlternativesOverlay.tsx`, `AlternativesList.tsx`) | Swap mid-session | Heading, Close, "Show all equipment", ranked list with "Do this instead" | Do this instead | Full screen; fine functionally |
| 8c | ExerciseHistoryOverlay | This exercise's past sets | "History · Back squat", Close, rows "2026-10-06 60×10 · 60×10 · 60×9 PR" | Close | OK content, plain list |
| 9 | **Settings** (`Settings.tsx`) | Configuration + backup + sync | Active program (radios, **duplicate of the Program tab**, `Settings.tsx:158` vs `ProgramPage.tsx:206`); My gym's equipment (checkbox per type); Bar and plates editor; Compare volume (select, Using, Since); Effort (Track effort checkbox); Export; Import backup; Account (email, last sync, Sync now, Sign in, mismatch) | — | Native radios, checkboxes, selects and date inputs, unstyled; every row is the same white 20 px card |
| 10 | Global states | Loading / error / offline / update | Loading = `<div />`, blank (`WorkoutFeature.tsx:261`); error = unstyled text "Could not load the workout programs: …" (`:255`); StorageUnavailableBanner; BackupBadge nag; UpdatePill "Update ready"; sync status only inside Settings | — | No skeletons, no visible sync state, and the backup nag fires on day one ("it has been a while…" when the user has never exported, `BackupBadge.tsx:32`) |

---

## 2. Current flows, step by step, with tap counts

The happy path assumes the preset weight is right.

| Task | Steps | Taps |
|---|---|---|
| **Open app → first set logged** | Launch lands on Workout tab → *Start Workout A* → exercise list → *Back squat* → Set screen (preset 50 kg × 8) → *Log set* | **3** |
| Adjust weight before logging | + or − per step (2.5 kg), or *Type weight* → keypad digits → *OK*. The ladder is unusable (P1) | +1 to +5 |
| Next set of the same exercise | Rest starts; the button reads "Rest 2:58"; tap it to log set 2 | **1 per set** |
| Move to the next exercise | When all sets are logged the bar shows "Up next: Lunges" + *Finish exercise* (+ *Add set*) → opens Lunges | **1** (good) |
| Jump to an arbitrary exercise | *Back* → list → tap row | 2 |
| Swap an exercise | Set screen → *Alternatives* (blocked while resting) → *Do this instead* | 2 (+ wait for rest) |
| Check last time in detail | Set screen → *History* (blocked while resting) → *Close* | 2 |
| Log effort (RIR) | After logging, chips appear **below the fold** → scroll → tap | 1 + scroll |
| **Finish the session** | From the Set screen: *Back* → *Finish workout* (**no confirmation**, `WorkoutFeature.tsx:672`) → summary overlay → *Done* | **3** |
| Discard the session | *Back* → scroll → *Discard workout* → *Discard* | 3 |
| Resume after closing the app | Launch drops straight into the exercise list (`landInSession`) | **0** (good) |
| **Change one exercise's sets or reps in the program** | *Program* tab → *Edit* (next to the program radio) → scroll the 126-control form → edit 1–2 number fields → *Save* | **3 + typing + long scroll** |
| Change rest for one exercise | Mid-session: tap the rest clock → RestDial appears at the bottom → scroll → pick → *Set rest* → *Use 2:30 for Back squat* | 4 + scroll |
| Switch active program | *Program* → radio (or *Settings* → radio) | 2 |
| See exercise progress | *History* → *Stats* → exercise `<select>` → choose | **4** |
| Open a past session | *History* → expand row → *Open session* → summary overlay | 3 |
| Fix a past set | *History* → expand → *Edit* on the group → SessionEditor → *Edit* set → change → *Save* | 5+ |

What these counts show:
- The core logging loop (3 taps to the first set, 1 per set after) is efficient. **Keep it.**
- The cost is perceptual, not motor. Each of those taps lands on a screen where the target is
  hard to find, or is covered (rest overlap), or sits below the fold (confirmation, effort,
  next).
- Finishing has no guard against a mis-tap.
- Program editing and progress viewing are the expensive flows.

---

## 3. Why it reads as amateur: top problems ranked (visual + UX together)

Ranked by how much each one damages the impression and the gym use.

### P1. The Set screen's dials are physically broken at phone width **[measured]**
- `.set-dials` is a two-column grid (`SetScreen.css:312`), so each dial card is 184 px wide.
- Inside that card is a three-column grid (`dial.css:21`) of a 56 px − button
  (`dial.css:109`), the body and a 56 px + button, plus 16 px padding and 12 px gaps.
- That leaves **16 px** for `.dial-body`. Measured: body 16×281, ladder column 16×132.
- The 65 px "50" readout and the 54 px "Type weight" button overflow it. The ladder shows clipped
  digits ("7 ‹6 2"). The "Type weight" pill wraps into "Type / weigh" between the two round
  buttons.
- This is the screen used 20+ times per session, and its centrepiece looks broken because it is.
- The keypad opens inside the same 184 px card with **unstyled OS buttons** (`Keypad.css:23`).

### P2. The rest state overlaps and disables the screen **[measured]**
- `.rest-timer` is `position: absolute; top: 0; right: 0` (`SetScreen.css:53`) with a 64 px clock
  in a white tile.
- It draws a 376×158 box over the links row, the set counter and the logged chips, and it
  captures their taps. Info, Alternatives and History are dead for the whole rest period, which
  is exactly when the user has time to use them.
- The primary button changes its label to "Rest 2:58" but still means "log next set"
  (`SetScreen.tsx:859-863`). Its label no longer says what it does.
- The RestDial opens 900 px below the clock that summons it.

### P3. The Set screen has no hierarchy: about 18 equal blocks in order of feature history
- The information a lifter needs is:
  1. this set's target (weight × reps);
  2. what they did last time;
  3. the rest clock;
  4. log.
- As built, the "Last time" line is 14 px muted (`.set-last-time`). The target is split across
  two broken dials. Rarely used controls sit between them and the Log button:
  - the weight-step `<select>`;
  - the Bodyweight toggle;
  - a five-way set-kind row;
  - Add note;
  - Add warm-ups.
- The feedback ("Set 1 logged", effort chips, "Next: set 2 …") is at y≈900, below the fold.
- One page tries to be the logger, the editor, the note-taker, the rest dial, the plate
  calculator and the settings page.

### P4. Browser defaults and unstyled native controls are everywhere
- **Headings:** `<h2>` and `<h3>` with no class render at 24 px/700 and 18.7 px/700 in the system
  font (`WorkoutStartButtons.tsx:18,25`; `ProgramPage.tsx:119,222,226,241,260`) **[measured]**.
  On the Workout tab the program name (24 px) is **larger than the screen title** (20 px Barlow).
- **Native controls**, unthemed:
  - radios and checkboxes (`Settings.css:75`);
  - `<select>`s (weight step, Stats exercise picker, library filters, Compare volume);
  - a date input;
  - a file input;
  - the keypad.
- **No styling at all:** the elapsed-time readout has no CSS (`.elapsed-time` has no rule). It
  sits as a bare "00:13" in the top-left of every in-session screen.
- **Loading** is a blank `<div />`. **Errors** are raw sentences.

Native defaults mixed with custom pills are the single strongest "nobody designed this" signal.

### P5. One button style for everything secondary, and three shapes for primaries
- **Secondary actions all look the same.** Every secondary action is clay text on a white pill
  of radius 20:
  - Exercise info, Alternatives, History;
  - Add note, Discard workout, Undo swap, "Last time: …";
  - Add warm-ups, "Use 2:30 for …", rest ±15 s.
  
  Selectors: `SetScreen.css:91,144`, `ExerciseList.css:73`. **Discard workout looks exactly
  like Add note.** Destructive, navigational and trivial actions are indistinguishable.
- **Primary actions use three shapes:**
  - "Start Workout A" is radius 12 (`WorkoutStartButtons.css:34`);
  - the action-bar "Log set" and "Finish workout" are radius 20 (`AppShell.css:104`);
  - summary "Done" is a full pill (`SessionSummary.css:26`).
- **Chips and toggles use a fourth vocabulary:** 1 px `currentColor` outlines with an 8 px radius
  (set kind, `SetKindRow.css:11-12`) or 999 px (logged sets, `SetScreen.css:168-169`), filled
  green when on (effort, bodyweight).
- Nothing uses an icon except the tab bar and the back chevron. All controls are words.

### P6. Navigation model: an empty home, an overloaded Program tab, duplicates
- **The Workout tab is nearly empty:** a program name and two identical green buttons. It does
  not say:
  - which workout is due (A/B alternation is the whole point of the program);
  - when each was last done;
  - what each contains;
  - how the week is going.
- **The Program tab carries everything else:**
  - the switcher;
  - Edit, Copy, Delete;
  - per-workout plan text;
  - **five body maps**, two of them identical (`ProgramPage.tsx:228` and `:244`).
- **Active program is chosen in two tabs** (Program and Settings).
- **Exercises**, an 876-item reference used rarely in the gym, has a top-level tab, while
  **Stats** is hidden behind a segmented control inside History.
- **The tab bar is at the top of the screen** (`TabBar.css:12-13`), out of thumb reach on a
  6.1" phone. It was moved there as a fix ("the operator's phone had it pinned to the bottom").
  That points to a bottom-bar positioning bug, not a design choice.
- **Inside a session, `.app-shell` still reserves the tab bar's height**
  (`AppShell.css:22`, unconditional). Every in-session screen starts with a 68 px empty band
  above the header **[measured: header at y=68 with no tab bar]**.

### P7. The palette is low-contrast between layers, and the motif is decoration
- **Three near-identical warm surfaces:** ivory `#F5F1E8`, raised `#ECE6DA` and white
  (`tokens.css:13-15`).
  - Cards "separate by tint, with no hairline or shadow" (decision 0009).
  - At a 2–4 % luminance step under gym lighting, everything blurs into beige.
  - With no borders or elevation, nothing looks pressable vs. static. A white row button and a
    white info card are identical.
- **The CourtStripe has no meaning:**
  - It is a 2 px green line over a 2 px clay line, under every screen title
    (`AppShell.tsx:126`), at the top of the summary, and inside a 20 px gold circle as the
    "PR medallion" (`Stats.tsx:130`).
  - It reads as a school-binder ribbon.
  - At 20 px the medallion is a tiny striped dot.
- **Colour breaks its own rules.** The workout cards' alternating green/clay left borders
  (`WorkoutStartButtons.tsx:23`, `.css:26-31`) use primary green as decoration, which 0009
  forbids. They also imply a meaning (A vs B) that doesn't exist.
- **PR colour is inconsistent.** PR badges are clay (`SetScreen.css:192`) in one place and gold in
  another.
- **Saturation is not the issue.** The pastels only appear on MuscleChips and the body map. The
  issue is mush plus decoration.

### P8. The type system is underused and partly faked
- Barlow Semi-Condensed 600 is used in only **5 selectors**: header title, dial readout, set
  counter, rest clock and record value. Every other heading and number is the system font. The
  numerals that should carry the "sport voice" are 14–16 px system text:
  - volumes ("9,840 kg");
  - the "0/4" counts;
  - history durations;
  - summary stats.
- **Faux bold.** Only weight 600 is shipped (`fonts.css:10`), but `.dial-readout` and the selected
  `.dial-rung` ask for 700 (`dial.css:102,135`). The browser synthesises a smeared bold on the
  biggest numbers in the app.
- **Flat sizes.** 56 of about 110 `font-size` declarations are 14 px and 34 are 16 px. The 28 px
  and 64 px steps are almost unused outside the rest clock and dials. Everything else lives at
  14–16 px, so there is no scale to read.
- **Off-token values** creep in: `0.75rem`, `0.8125rem`, `0.8em`, `0.5rem` gaps, `999px` and `8px`
  radii (`SetScreen.css:158-212`, `SetKindRow.css`, `MuscleChip.css:5-7`). These are signs that
  later epics stopped using the system.

### P9. Data presentation and copy read like a developer console
- **Dates are ISO** ("2026-10-13") in History and Stats (`HistoryList.tsx:47`, `Stats.tsx:88`).
- **History rows are a sentence** of six inline spans.
- **The plan reads as source text:** "Back squat 8-10 x 4, rest 180s". That is a hyphen and an
  ASCII x, while the Set screen correctly uses "×" and "–".
- **The summary stats have no labels:** "1 min" and "400 kg".
- **The body-map legend is text with no swatches:** "0 / 1–2 / 3–5 / 6+ sets"
  (`BodyMapLegend.tsx:18`).
- **The charts have no x-axis and no dates.** The volume bar chart has no axis, labels or values
  at all.
- **ExerciseDetail is a field dump:** "Mechanic: compound · Force: push · Level: beginner".
- **Assorted copy problems:**
  - "No previous workout" ×7 on the exercise list;
  - "Use this A/B Split";
  - "Step 2.5 kg [2.5 ▾]";
  - "W-up";
  - "No earlier Sessions" (domain capitalisation leaking out);
  - "Back up your data — it has been a while since the last export" shown to a user who has
    never exported.

### P10. Overlays, feedback and states fight the gym context
- **Every secondary view is a full-screen `.overlay-panel`** (`styles/overlay.css`) with a
  text "Close" button. This covers Exercise detail, Alternatives, Exercise history, the session
  summary, the region panel and the program-editor picker.
- **Full-screen overlays stack.** The region panel opens full-screen over the full-screen
  summary. A bottom sheet would keep context.
- **Feedback is weak.**
  - "Logged ✓" lasts briefly in the button.
  - The confirmation line and the family-tint glow are below the fold.
  - The PR toast is a clay pill for 3 s.
  - There is no haptic-style moment, no clear set-row tick and no progress across the session
    beyond "1/4".
- **Destructive actions are unguarded or under-guarded.** "Finish workout" has no confirmation.
  "Discard" is a quiet inline confirm.
- **Sync and offline state are invisible** outside Settings.
- **Library pagination** (10 rows, Previous/Next) instead of a scrolling, sectioned list.
- **Program editing** is a 126-control form rather than a list of exercise rows that open a small
  editor.

### Honourable mentions
- **Spacing has no rhythm.** It is `--space-4` (16 px) for page padding, card padding, gaps and
  margins everywhere. Sections don't group, so every screen is an evenly spaced stack.
- **The volume bar in exercise rows** (`VolumeVsBaseline`) is an 8 px clay bar. On a new user it is
  absent and replaced by text, so rows change shape.
- **Logged-set chips use `color: inherit` + 1 px `currentColor` borders.** They draw as black
  outlines, the only black outlines in the app.

---

## 4. What is good and worth keeping

**Information architecture and features** (the product is strong; the presentation is not):
- **Local-first, offline PWA, wake lock, relaunch lands back in the session** (`useLandOnWorkout`,
  `landInSession`). That is exactly right for a gym.
- **A 3-tap path to the first set, 1 tap per set after**, with presets from last time
  (`domain/prefill.ts`), a session-wide rest stored on the set, and a **"Finish exercise → Up
  next" lead-on**.
- **Smart helpers:**
  - plate math with the user's inventory (`domain/plates.ts`);
  - a one-tap warm-up ramp (`domain/warmup.ts`);
  - PR detection at log time (`domain/records.ts`, six record kinds);
  - progression suggestion "Next: 62.5 kg" (`ProgressionBar`);
  - "Use 2:30 for Back squat" learning the rest from behaviour;
  - "Last time: X" swap memory;
  - alternatives ranked by the gym's equipment.
- **Optional depth that stays optional:** set kinds, RIR effort (behind a setting), notes,
  bodyweight with signed load (BW+10 / BW−20).
- **Editing safety:** undo after deleting a set, inline confirms, discarded sessions as marked
  documents, an editable past session.
- **Muscle-family model:** four families (push, pull, legs, core) instead of 17 hues. Keep the
  *model*; reconsider where it shows.
- **Body map** as the visual for "what did I train". Good in the summary; overused on Program.

**Engineering guardrails to keep in any redesign:**
- **One token file, audited as data** (`tokens.test.ts`, `cssAudit.test.ts`,
  `controlAudit.test.ts`). A redesign can be largely a token + component-CSS change.
- **The 44 px tap-target floor** enforced by test (`--tap-min`, E3-T8 audit).
- **Contrast** of every documented text/background pair asserted at 4.5:1 or better
  (`contrast.test.ts`). The family inks hit 6.5:1.
- **`prefers-reduced-motion`** kills all motion (`base.css:139-146`). Presses scale 0.97.
- **Light theme for bright gyms** (NN/g rationale in 0009). The owner rejected dark + neon. A
  light theme is not the problem; *this* light theme's low layer contrast is.
- **Tabular numerals**, and the instinct to give numbers a display face. Just apply it
  everywhere numbers are the content, and ship the right weights.

---

## 5. Content inventory for mocks (real data)

Use these exact names, numbers and strings so the mocks show realistic density. Units are kg.

### Real program (bundled `src/data/programs/assaf-ab-2026.json`, "A/B Split", 3 sessions/week)

| Workout A | Sets × reps | Rest | Start kg | Primary muscle (family) | Equipment |
|---|---|---|---|---|---|
| Back squat | 4 × 8–10 | 3:00 | 50 | quadriceps (legs) | barbell |
| Lunges | 3 × 10–12 | 1:30 | 7 | quadriceps (legs) | dumbbell |
| DB bench press | 4 × 8–10 | 1:30 | 10 | chest (push) | dumbbell |
| Push-ups | 3 × 10–15 | 1:30 | BW | chest (push) | body only |
| Machine shoulder press | 3 × 8–10 | 1:30 | 5 | shoulders (push) | machine |
| Lateral raises | 3 × 10–15 | 1:30 | 3 | shoulders (push) | dumbbell |
| Cable push-down | 3 × 10–12 | 1:30 | 17.5 | triceps (push) | cable |

| Workout B | Sets × reps | Rest | Start kg | Primary muscle (family) | Equipment |
|---|---|---|---|---|---|
| Deadlift | 3 × 8–10 | 3:00 | 55 | lower back (core) | barbell |
| Assisted pull-ups | 4 × 5–8 | 1:30 | BW−27 | lats (pull) | assisted |
| Narrow-grip pull-down | 3 × 10–12 | 1:30 | 41.25 | lats (pull) | cable |
| Machine row | 4 × 8–10 | 1:30 | 50 | lats (pull) | machine |
| Face pull | 3 × 10–15 | 1:30 | 15 | shoulders (push) | cable |
| Hyper-extension | 3 × 10–15 | 1:30 | BW | lower back (core) | body only |
| Seated biceps curls | 3 × 10–12 | 1:30 | 8 | biceps (pull) | dumbbell |

Weight steps per exercise: 2.5 for barbell, 1 for dumbbell, 1.25 for machine shoulder press and
pull-down, 5 for machine row. Selectable steps: 0.5 / 1 / 1.25 / 2.5 / 5 / 10. Default plates:
20 kg bar; 25, 20, 15, 10, 5, 2.5 and 1.25 kg. The library has 876 exercises.

String formats the app already produces:
- set: `62.5 × 8`;
- compact: `62.5×8`;
- bodyweight: `BW × 12`, `BW+10 × 6`, `BW−27 × 8`;
- last time: `60×10 · 60×10 · 60×9 · 60×8`;
- plates: `Per side: 20 · 1.25` / `Nearest 62.5 kg · per side: 20 · 1.25` / `Bar only`;
- warm-up: `Warm-up 1 of 3 · 30 kg × 5`;
- PR toast: `New PR · Heaviest set · 62.5 kg × 8`;
- record labels: Heaviest set, Best estimated 1RM, Most reps at the heaviest weight, Most reps in
  a set, Heaviest load, Most reps at the heaviest load;
- set kinds: Warm-up (W), Working, Drop (D), Failure (F), AMRAP (A);
- effort: RIR 0 / 1 / 2 / 3+.

### Screen 1: Today / Workout (home)
Must show:
- **The active program:** "A/B Split", 3× per week.
- **Due workout, emphasised:** "Workout B", because the last session was A. The data exists in
  `sessions`; the logic is new.
- **Its contents preview:** 7 exercises, e.g. "Deadlift · Assisted pull-ups · Narrow-grip
  pull-down · +4"; about 24 sets; estimated duration (~55 min, from past sessions).
- **When each workout was last done:** "Workout A · Mon 12 Oct", "Workout B · Fri 9 Oct".
- **The other workout** as a secondary choice (Workout A).
- **Resume state** (when a session is open): "Workout A in progress · 3 of 7 exercises · 24 min".
  Resume is the single primary.
- **Week strip:** 2 of 3 sessions this week; maybe the family split of sets.
- **Quiet system status:** sync state ("Synced 2 min ago" / offline), and the backup reminder only
  when actually due.
- **Empty state:** no program → "Choose a program" with the A/B Split card.

### Screen 2: Active Set logging (Back squat, set 3 of 4)
Must show:
- **Header:** back to the list; "Back squat"; family tint for legs; session clock "24:10";
  workout progress (e.g. 2/7 exercises, 9/24 sets).
- **Set position:** "Set 3 of 4"; target "8–10 reps"; AMRAP variant "Set 4 of 4 · 8+ reps".
- **Today's logged sets as rows:** "1 · 60 × 10", "2 · 60 × 9 · RIR 1"; a warm-up row "W ·
  30 × 5"; a PR marker on one.
- **Last time** (the most important reference), per set aligned to today's rows:
  "60×10 · 60×10 · 60×9 · 60×8", dated "Mon 5 Oct".
- **Suggestion:** "Next: 62.5 kg" (progression rule).
- **The two values being entered, large:** weight **62.5 kg** and reps **8**, with −/+ (2.5 kg
  step) and tap-to-type. A bodyweight variant: Assisted pull-ups **BW−27** × 6.
- **Plates:** "Per side: 20 · 1.25" on a 20 kg bar.
- **Secondary, collapsed:** set kind (W/Working/Drop/Fail/AMRAP), Add warm-ups (ramp 30 × 5 /
  45 × 3 / 52.5 × 2 for a 62.5 working weight), exercise note ("Belt from set 3"), Alternatives,
  Exercise info, History, weight step, Bodyweight toggle.
- **Primary: Log set.** After logging: confirmation "Set 3 logged · 62.5 kg × 8", optional
  effort chips 0 / 1 / 2 / 3+.
- **End of exercise:** "All 4 sets logged" · "Up next: Lunges" · Finish exercise / Add set.
- **Editing a logged set:** Save set / Delete set / Cancel; "Set deleted · Undo".

### Screen 3: Rest timer state (after set 2 of Back squat)
Must show:
- **A big countdown** "2:48" of 3:00, with a progress ring or bar, and an over-time state
  "+0:12" (clay).
- **Controls:** −15 s, +15 s, Skip; tap to set exact rest (15 s steps up to 10:00).
- **Next set, with its prefilled values:** "Next: set 3 · 62.5 kg × 8–10", editable before
  logging.
- **Last time for that set:** "60×9".
- **Up next exercise** when this was the last set: "Up next: Lunges".
- **Offer:** "Use 2:30 for Back squat" → "Saved to A/B Split".
- **PR toast if just earned:** "New PR · Heaviest set · 62.5 kg × 8".
- **Still reachable:** Alternatives, Exercise info, History, and logging early.
- **Behaviour notes for mock designers:** sound plays at zero; the screen stays awake.

### Screen 4: History / Stats
**History list** (newest first). Each card shows:
- date "Tue 13 Oct";
- workout "Workout A";
- program "A/B Split";
- duration "52 min";
- "26 sets";
- volume "9,840 kg";
- PR count "2 PRs";
- maybe 3–4 family dots.

Expanded or detail view shows:
- per exercise: name + sets "60×10 · 60×10 · 60×9 · 60×8" + kind markers;
- session note;
- Edit workout / Open summary.

Empty state: "No finished workouts yet."

**Stats** must show:
- **An exercise picker** (search or chips), e.g. Back squat, DB bench press, Deadlift, Machine
  row.
- **The progress line chart:** estimated 1RM in kg over sessions. Example e1RM series for Back
  squat: 66.7 → 68.0 → 70.0 → 72.0 → 74.2 → 75.0 across Sep–Oct. Needs dated x-axis ticks and the
  latest value labelled.
- **Progression suggestion:** "Next: 62.5 kg".
- **Records list** with medallions:
  - "Heaviest set · 62.5 kg × 8 · 13 Oct";
  - "Best estimated 1RM · 75 kg · 13 Oct";
  - "Most reps in a set · 12 reps · 2 Oct".
- **Volume per session bar chart**, labelled by workout (A/B alternating), values 7,000–10,500 kg,
  with an axis.
- **Bodyweight reps line:** "Workout B: 46 bodyweight reps".
- **Optional:** weekly sets per family (push / pull / legs / core) and the body map "this week:
  planned vs done".

### Screen 5: Program
Must show:
- **Active program header:** "A/B Split" · 3 sessions/week · 2 workouts · 14 exercises; actions
  Edit / Copy / Switch program (other: "Full body starter" if unhidden, plus user programs); New
  program; Delete or Reset to original with confirm.
- **Per workout** (A and B), a compact list of exercise rows:
  - name;
  - "4 × 8–10";
  - rest "3:00";
  - starting / current weight "62.5 kg";
  - family chip.
- **Weekly volume:** **one** body map or family bar showing prescribed weekly sets per region
  (session bands 0 / 1–2 / 3–5 / 6+; week bands 0 / 1–9 / 10–20 / 21+, with swatches). Gaps:
  "No direct calves work", "No direct abdominals work".
- **This week, planned vs done** (one place, not two duplicate maps); empty: "No sets logged in
  the last 7 days".
- **Edit mode** must handle:
  - rename;
  - sessions per week;
  - add, remove and reorder workouts;
  - add an exercise from the 876-item library (search, "My gym only");
  - reorder or remove exercises;
  - per exercise: sets, min reps, max reps, rest (s), starting weight (kg; hidden for
    bodyweight), "Last set AMRAP";
  - inline validation messages;
  - Save / Cancel.

---

## 6. Implications for the redesign

These follow directly from the evidence above.

1. **Fix the Set screen first.** It needs:
   - a single-column numeric entry: weight row and reps row, each full width with big −/+;
   - a properly designed keypad sheet;
   - the rest timer as a real state of the screen, not an overlay box;
   - secondary tools collapsed behind one "More" row or a sheet.
2. **Make Today a real home** (due workout, last done, the week), and fold the Program detail
   into it or slim it down. Stop picking the active program in Settings.
3. **Give the tab bar back to the thumb** (bottom, with safe-area handling done properly). Drop
   the reserved padding inside sessions.
4. **Build a real component set:**
   - one primary button, one secondary button (bordered or tonal), one quiet text button and one
     destructive style;
   - one chip;
   - one list row;
   - one card with real elevation or a hairline;
   - styled form controls;
   - a bottom sheet for overlays.
5. **Fix the palette's layer contrast.** Keep light, keep the green, keep clay for data. Add a
   hairline or elevation, and a clearly different background for the page vs. cards. Retire the
   stripe or make it mean something.
6. **Type:** ship Barlow 500/700 (or drop faux bold), and use the display face for every number
   that is content. Set a real scale for title, section, row and meta text.
7. **Humanise data:**
   - relative and short dates;
   - labelled stats;
   - legends with swatches;
   - chart axes;
   - "×" and "–" everywhere;
   - copy written for a lifter, not a test.
