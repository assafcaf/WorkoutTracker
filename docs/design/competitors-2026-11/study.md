# Design study: what to show, when, and in what language (2026-11)

**Author:** Dana Reyes (design lead persona, `docs/ux-expert/persona.md`). **Inputs:** `research.md` and
`shots/` (competitors), the four mocks in `docs/design/redesign-2026-10/mocks/`, and the app as it is
now (`docs/ux-expert/iterations/v6/recheck/`, `v6/*/after/`). **Data:** `scripts/render-states/stats-45.json`,
Thursday 15 October, Workout B due.

**Proposal files:** `proposal/index.html` (the six screens and the system), `proposal/board.png`,
`proposal/01-train.png` … `proposal/06-lift.png`, `proposal/before-after.png`.

## The answer in four sentences

The app's features are right. What is wrong is the timing: it shows decisions at the moment of review,
evidence at the moment of action, and everything at once on Progress. Its visual language has no rule
for colour: indigo means button, link, selection, "moving" and PR at once, and amber means both
"stalled" and "ready to go up". The fix is a system I call **Ledger & Instrument**: lists are rows on
paper with hairlines, the set screen is one big number, ink is the action colour, and colour is kept
for meaning (blue = now, green = better, rust = lower, gold = record).

---

## 1. Phases of use

Each phase has one question. A screen that answers a different question in that phase is noise, even
if the answer is correct.

### 1.1 Opening the app to decide today

- **State of mind:** at home or in the car, a few minutes before leaving; calm, not tired yet.
- **The one question:** "What am I doing today, and is anything different from last time?"
- **What we show now** (`recheck/01-train.png`): about 20 elements and 12 tap targets on the first screen:
  - the title and a date line;
  - an italic note from Wed 7 Oct;
  - a cloud icon with a **red** dot, and a gear;
  - a 7-day strip with "2 of 3 ›";
  - 7 exercise rows, each with sets, weight and rep range ("3 sets · 60 → 70 kg · 8–10");
  - one advice line, "↑ Ready for 15 kg";
  - "~66 min", "Change", and Start.

  The answer to "what is different" is spread over the italic note, the advice line and an arrow inside
  a prescription. Three of the seven rows carry information that never changes (rep ranges).
- **Best competitor:** Fitbod puts today's workout first, already decided: a title, "7 Exercises · 3
  Muscles", rows with sets • reps • load, and two context numbers that explain the choice
  (`shots/fitbod-today-recovery-equipment.jpg`, research §3). The Guided Session mock is better still
  for an owner-planned programme: "Back squat moves up to 62.5 kg. Everything else as last Friday."
- **Verdict:** this is our closest phase. Train is calm and ships Start in the thumb zone. Keep that.
  The gap is that the *change* is not the headline.
- **Show:**
  - one sentence on what changes today (curls go up to 15 kg; pull-down holds at 46.25 kg because of
    the elbow);
  - today's loads as `sets × kg`, with an ↑ only on the rows that change;
  - the week as A/B day chips;
  - "23 sets · about 66 min", "Do Workout A instead", and Start.
- **Don't show:**
  - **rep ranges** (move to the Set screen's target line and to Program);
  - the **sync cloud with a red dot** while nothing is wrong. Show it only when a sync actually fails,
    and then as words, not a dot;
  - verdicts for lifts that are *not* in today's workout (DB bench's stall belongs to the next A day
    and to Program, not to Thursday).

### 1.2 Walking to the bar

- **State of mind:** between exercises, moving, thinking about loading the bar.
- **The one question:** "What goes on the bar?"
- **What we show now** (`recheck/10-now-deadlift.png`):
  - "Warm-up: 30×5 · 40×3 · 50×2 Add" as a text line;
  - the set tiles;
  - "Per side: 20" in 14 px grey **under** the weight stepper, near the bottom of the screen.

  The plate line is the answer to this phase, and it is the smallest text on the screen. Last time's
  "Same plates: 25" in the Rest card (`live/after/30-rest-pr.png`) is a good line; keep it.
- **Best competitor:**
  - Strong's warm-up sheet: a table of formula → load, with Insert (`shots/strong-exercise-warmup-rest.jpg`).
  - Setgraph's keypad with plate-increment keys (+2.5, +5 … `shots/setgraph-keypad-bodymap.jpg`).
  - The Single Set Focus mock's drawn bar with plates (S3b).
- **Verdict:** the content is right and the emphasis is wrong.
- **Show:** when the weight differs from the last set, draw the plates for one side under the weight,
  with "Per side: 25 on a 20 kg bar". Show warm-ups as a `W` cell in the set track that opens the
  ramp, not as a sentence.
- **Don't show:** the plate drawing when the plates have not changed. Say "Same plates" in one line
  instead.

### 1.3 At the bar

- **State of mind:** chalked hands, heart rate up, phone on a bench 1 m away.
- **The one question:** "How much, how many?"
- **What we show now** (`recheck/10-now-deadlift.png`): about 17 elements and 11 tap targets.
  - The numbers (60 px) sit in the bottom third.
  - Above them is a **280 px empty band** between the set tiles and the weight.
  - The ⋯ button, the "All" toggle, Finish and the warm-up line all compete at the top.
- **Best competitor:**
  - Strong and Hevy put the previous value in the row and prefill today's value, so logging is
    confirming (research §1, §2; `shots/hevy-logging-exercise-chart.jpg`).
  - Alpha Progression highlights the target row (`shots/alphaprogression-plan-logging.jpg`).
  - For a one-set-at-a-time app, the Single Set Focus mock is the reference: weight and reps at 96 px,
    centred, between 64 px steppers.
- **Verdict:** right model, unfinished layout.
- **Show:**
  - the set track (`W`, 1 ✓, 2 current, 3 planned);
  - "Set 2 of 3 · target 8–10";
  - the weight at 88 px with the plates under it;
  - the reps at 88 px;
  - "Last time 70 × 7 · Mon 12 Oct";
  - one ink bar: `Log set 2 · 70 × 8`.
- **Don't show:**
  - session elapsed time as a peer of the exercise name (keep it in the header subtitle);
  - advice text ("Ready for 15 kg · Use 15 kg") *below* the numbers. If the weight changes today,
    the Preset already holds it, and the reason was given on Train.

### 1.4 Rest

- **State of mind:** breathing, sitting on the bench, glancing at the phone.
- **The one question:** "How long until the next set, and what is it?"
- **What we show now** (`recheck/15-rest-pulldown.png`, `live/after/30-rest-pr.png`): about 24
  elements and 14 tap targets, in five regions:
  - the set track;
  - a grey "GET READY" card with Change;
  - an effort card ("Reps left?" with 4 chips);
  - a 64 px countdown, **bottom-left**, beside −15 s / +15 s / Skip;
  - the filled primary bar, **"Log set 3"**.

  The countdown is the answer and it is the fourth thing you see. The only filled button does
  something else.
- **Best competitor:** Strong shows a big ring with the countdown, the total under it, and −30 s /
  +30 s / Skip (`shots/strong-exercise-warmup-rest.jpg`). Research §6 notes that Strong does not show
  *what's next*, and that showing it is the gap to beat.
- **Verdict:** the content is right; the hierarchy is inverted.
- **Show:**
  - a 236 px ring with the 76 px countdown and "of 3:00";
  - −15 s and +15 s;
  - one panel, "Next · set 3 · 70 kg × 8 · Same plates · Last time 70 × 7";
  - one row, "Set 2: reps left 0 1 2 3+";
  - the bar becomes **Skip rest** (outline). At 0:00 the screen returns to the instrument by itself.
- **Don't show:**
  - "Log set 3" as the filled primary during rest. It is still one tap away after Skip;
  - the "Change ›" link (tap the next-set panel instead);
  - "Same as Mon 12 Oct" restating the set you just logged.

### 1.5 The PR moment

- **State of mind:** just racked it; a hit of pride, and doubt about whether it counted.
- **The one question:** "Did that count?"
- **What we show now** (`live/after/30-rest-pr.png`): a `PR` tag on track cell 2, "1 PR" in the
  header, and "PR · Rep record · 1 more than Mon 12 Oct" in the effort card.
  - **This is a trust bug to verify.** 70 × 8 after 70 × 7 is more reps at a weight already lifted.
    Under the V6 rule in `CONTEXT.md` (Record), that is a *rep best*, "shown quietly and never counted
    as a PR". Its e1RM (88.7) is also under the 90.0 best.
  - If this shot is current, the PR tag here contradicts the rule. Research §8 lists unreliable PR
    detection as what sank Gravitus.
- **Best competitor:** Hevy shows a small banner and a medal on the set; Boostcamp a badge on the set
  (research §2, §5). Fitbod's full-screen trophy is the anti-pattern mid-workout
  (`shots/fitbod-logging-record-targets.jpg`).
- **Verdict:** the right size, but the wrong label on the wrong sets.
- **Show:**
  - a real PR as a gold `PR` tag on its track cell, plus one line under the track for 3 s ("PR ·
    heaviest · 70 kg × 7 · +2.5 kg");
  - a rep best as one quiet green line: "↑ Rep best · 70 × 8, one more than Monday".
- **Don't show:** a PR count in the live header, the PR inside the effort card, or anything gold for a
  rep best.

### 1.6 Right after the session

- **State of mind:** done, sweaty, a little proud or a little flat; 20 seconds of attention.
- **The one question:** "Was that a good session?"
- **What we show now** (`recheck/32-past-summary.png`):
  - a run-on header line: "1 h 06 min · 23 sets · 2 PRs · vs Wed 7 Oct: volume −1.6 %", then
    "1 warm-up not counted";
  - a card with each lift as a sentence of numbers: "60×10 · 70×7 (PR) · 70×7 · +2.5 kg top set on
    Wed 7 Oct". You have to read every line to learn the verdict;
  - in the short-session variant (`recheck/54-short-summary.png`), a "Worked today" list of seven
    muscles with counts, and "Volume 1,090 kg";
  - "Share…" as an outlined peer of Done.
- **Best competitor:** Alpha Progression shows each exercise with a small ↑/↓ for whether it progressed
  (`shots/alphaprogression-summary.jpg`). Hevy shows records first and keeps share secondary (research
  §2). Research §8 calls generic confetti an anti-pattern.
- **Verdict:** the information is right. It is presented as prose where a verdict glyph is needed.
- **Show:**
  - a date and duration label;
  - a verdict sentence ("5 of 7 lifts beat Wednesday. Two records. Pull-down dipped, as expected
    after Wednesday's elbow.");
  - the PR rows in gold;
  - **Lift by lift vs Wed 7 Oct**: per lift, the sets in small grey, and one verdict on the right
    (`↑ +2.5 kg`, `↑ +3 reps`, `↓ −3 reps`, `= same`);
  - one line of totals, then "Next: Workout A, Wednesday";
  - Share as a text link, and Done.
- **Don't show:**
  - **muscles worked** (move to Progress → Muscles, weekly, where the range means something);
  - **volume as a headline** (one small number in the totals line);
  - "This week 3 of 3" (Train and Sessions own the week).

### 1.7 Later: reviewing the day or the week

- **State of mind:** on the sofa, curious, with time; wants to know if it is working.
- **The one question:** "Am I getting stronger, and am I consistent?"
- **What we show now** (`recheck/02-progress.png`, full scroll `v6/progress/after/01-dashboard.png`):
  - The first screen is four decision cards with about 26 elements and 10 tap targets. Each card has
    a name, a status word, two or three lines of evidence, advice, "Swap ›" and "Why?".
  - The headline is "4 lifts need a decision": it asks the trainee to *act* in the phase where they
    want to *read*.
  - No lift number the trainee chose to see appears before the fold.
  - The full scroll is 2,266 px: 14 lift rows with sparklines whose values wrap under the name on
    long names (Cable push-down, Hyper-extension), a "Last week" table, Muscles and Body.
- **Best competitor:**
  - Fitbod: one plain-language headline metric, "Estimated Strength", renamed from "Projected 1 Rep
    Max" because users understood it better, plus copy that sets expectations ("dips sometimes
    happen") (research §3).
  - Apple: trend arrows with a coaching line (research §4).
  - Hevy: consistency as a calendar of weeks (research §2).
- **Verdict:** wrong first screen. The data is good and the framing is backwards.
- **Show:**
  - the verdict as a headline ("12 of 14 lifts are moving");
  - one sentence on the exceptions ("DB bench has been flat since 7 Aug. Pull-down is down while the
    elbow settles; that is a choice, not a slide.");
  - six weeks as A/B dot columns with "15 sessions in 6 weeks";
  - then **every lift as one ledger row**: name, a status glyph and word, a 72 px trend, est.
    strength in kg, and the 12-week change. Muscles and Body are rows at the end.
- **Don't show:**
  - **decision cards** (Swap ›, "Try a variation for 4 weeks"). Move them to Program ("Needs a
    decision") and to Train on the day the lift is in the workout;
  - "Why?" on every card (the reason is a sentence on the lift page);
  - the "Last week" table (it is the same information as the weeks strip, in a worse form).

**The lift page** (`recheck/33-door-summary-deadlift.png`) has:

- a verdict card with "Why?";
- the headline "70 kg × 7";
- **two stacked segmented controls** (Weight | Est. max, then 3M | 1Y | All): five segments of
  chrome before the chart;
- a step chart with a rep label on every point.

Proposed:

- status and advice as two sentences, including one that sets expectations ("7 reps on a new weight
  is normal");
- **one number with its meaning**: "86.3 kg ↑ +9.6 since 22 Jul · Est. strength: the one-rep max
  your best set predicts";
- one chip row (Est. strength / Top set, plus 3M 1Y All as text tabs);
- a single ink line with the PR point in gold, the deload as a grey band and a hollow point, and no
  per-point labels;
- then Records, then Sessions as set rows.

### 1.8 Planning

- **State of mind:** weekend, deliberate; wants to change the plan and not break the balance.
- **The one question:** "Is my plan balanced, and what should I change?"
- **What we show now** (`recheck/35-program.png`):
  - a weekly-sets bar in four family colours;
  - two workout tables (Sets × reps · kg · Rest);
  - a body map in a teal heat ramp;
  - muscles against 10–20.

  This is a good screen; keep it. The problems:
  - the decisions the trainee must make (DB bench stalled, push-ups ready to load) live on Progress,
    not here, where the plan is changed;
  - the family colours collide with the workout colours: Workout A's teal is the Push colour, and
    Workout B's plum is the Pull colour.
- **Best competitor:** Fitbod shows weekly set targets as "15/30 sets, 15 to go"; Liftosaur shows
  prescribed vs completed (research §6, row 8).
- **Show:** a **Needs a decision** section at the top of Program, with one row per stalled or ready
  lift and Swap or Add load. Then the workouts, then the muscles against the range, marked rust only
  when below.
- **Don't show:** colour per muscle family. Families are labels; colour is taken by the workouts on
  the calendar, and by meaning.

### Summary: show / don't show

| Phase | Show | Don't show (it moves to …) |
|---|---|---|
| Opening | One "what changes today" sentence, today's loads with ↑ on changes, the A/B week, Start | Rep ranges (→ Set target, Program), sync dot when fine (→ only on failure), other days' verdicts (→ Program) |
| Walking to the bar | Drawn plates per side when the weight changes, `W` ramp cell | Plates when unchanged (→ "Same plates") |
| At the bar | Track, target, 88 px weight and reps, last time, one Log bar | Advice text under the numbers (→ Train), elapsed time as a headline (→ header subtitle) |
| Rest | 236 px countdown ring, ±15 s, the next-set panel, one effort row, Skip | "Log set" as the filled primary, Change link, a restatement of the set just logged |
| PR moment | Gold `PR` on the set + a 3 s line; a rep best as a quiet green line | PR counter in the header, PR inside the effort card, PR tags on rep bests |
| Right after | Verdict sentence, PR rows, per-lift ↑/=/↓ vs last time, totals line, Done | Muscles worked (→ Progress Muscles), volume as a headline, week count (→ Train/Sessions), Share as a peer of Done |
| Later | "12 of 14 lifts are moving", exceptions sentence, weeks strip, one row per lift | Decision cards (→ Program, Train), "Why?" links (→ lift page sentence), Last week table |
| Planning | Needs a decision, the workouts, muscles against the range | Family colours, verdict evidence (→ lift page) |

---

## 2. Design language diagnosis

**Colour: nine hues and no rule.** `src/styles/tokens.css` has one primary (indigo `#4338A8`),
warn (`#8A5A12`), danger, four family colours, four heat steps and a chart grey. On screen:

- **Indigo carries five meanings:**
  - the primary button ("Start Workout B", "Log set");
  - links ("Change ›", "Add", "Use 15 kg");
  - selection (the current set cell, the selected tab);
  - *good news* ("▲ Moving" on the lift page, the dots on the chart);
  - the `PR` outline tag.

  A trainee cannot learn what indigo means, because it means everything.
- **Amber carries opposite meanings.** "■ Stalled" and "↑ Ready" share `--color-warn`
  (`recheck/02-progress.png`). "Ready for 15 kg" is the best news the app gives, and it is painted
  like a warning.
- **The workout identity collides with the muscle families.** Workout A's chip on the calendar is
  `--data-push` and Workout B's is `--data-pull` (`recheck/31-sessions.png` vs `recheck/35-program.png`).
- **The red dot on the sync cloud** (`recheck/01-train.png`) uses an alarm colour for a routine
  state.
- **What works:** the A/B colour coding on the Sessions calendar. It reads at a glance, and the owner
  wants to keep it. Keep its two hues and give them to nothing else.

**Type and numerals.**

- Geist with tabular lining figures throughout is right; keep it.
- The problem is too many sizes and weights for numbers. The Set screen's 60 px numerals sit next to
  14 px "Per side". The set tiles show "60×10" at 15 px semibold.
- The lift page headline "70 kg × 7" is set at 44 px with the unit at the same weight as the number.
- The summary sets every number at body size inside sentences.
- There is no single rule for how a weight and reps are written. Compare "60 × 10", "60×10",
  "60 kg × 10", "60\n×10" (the All grid, `recheck/11-all.png`) and "BW × 15·15·15".

**Density.**

- Train is right (one screen, nothing to scroll).
- The live screens are under-dense at the top (the empty band) and over-dense at the bottom (five
  controls in the last 180 px during rest).
- Progress is over-dense everywhere: four cards of 6–8 elements before any lift.
- The summary is dense in words, not in information.

**Cards versus rows.** There is no rule:

- Train uses rows;
- Progress uses cards with rows inside them;
- Sessions uses a calendar card plus grouped list cards;
- Program uses cards with tables inside them;
- the Set screen uses a grey card (Get ready) above a white card (effort).

Cards are used as grouping, so everything is a card and nothing stands out.

**Charts.**

- The lift chart (`recheck/33-door-summary-deadlift.png`):
  - draws a rep label over most points;
  - uses indigo and black dots for two meanings that are never explained;
  - sits under two segmented controls.
- The dashboard sparklines lack a common baseline, and their values wrap onto a second line for long
  names.
- The program uses a stacked bar in four family colours.
- The muscles page uses a teal heat body map.

That is three chart languages.

**Icons.** Few, which is good, but inconsistent:

- the "All" toggle is an icon with a text label in the header;
- "Why?" is a text button;
- "Swap ›" is a text link with a chevron;
- "■ Stalled" uses a filled square as a glyph, next to "↑" and "▲" for related states (Ready and
  Moving).

**Copy tone.** Short and honest, which is the best part of the app. The problems:

- **question-labels**: "Reps left?" and "Why?";
- **demand-framing**: "4 lifts need a decision";
- **code-words**: "Est. max", "GET READY · SET 2", "Lowered".

Fitbod's evidence (research §3) is that "Estimated Strength" is understood where "Projected 1RM" is
not.

**Consistency across screens.** The same set is drawn five ways:

- a tile on Now;
- a two-line cell on All;
- a sentence fragment in the summary;
- "46.25×9 · 46.25×8" on the lift page;
- a table cell on Program.

The same status is drawn three ways:

- a card word in amber;
- a coloured left border on the lift page;
- a glyph and word under the name on the dashboard.

---

## 3. Proposed design language: Ledger & Instrument

The language borrows from five sources:

- **Strong** (`shots/strong-*`): the ledger's calm, and row state as feedback;
- **Single Set Focus** (mock): the instrument numerals;
- **Apple Fitness** (research §4): colour on the numbers, not the chrome;
- **Fitbod** (research §3): "Estimated Strength" and copy that sets expectations;
- **Alpha Progression** and the **Guided Session** mock (`shots/alphaprogression-summary.jpg`): the
  per-lift ↑/↓ and the one-sentence headline.

It is light: it is neither the rejected dark + lime nor the ivory and pastel "Court" look.

### Palette roles

| Role | Hex | Used for | Never for |
|---|---|---|---|
| paper | `#F6F6F3` | page | — |
| surface | `#FFFFFF` | at most one "now" panel per screen (rest's next set, a done cell) | grouping lists |
| line | `#E3E3DE` | hairlines between rows | — |
| ink | `#141518` | text **and the action colour**: filled bars, selected chip | — |
| ink-2 | `#4A4B53` | secondary text | — |
| ink-3 | `#6C6D75` | units, labels, planned values, `×` | numbers you act on |
| live | `#2453D4` | *now*: the current set outline, the rest arc, today on the calendar, the selected tab | buttons, links, good news |
| up | `#17794A` (tint `#E2F2E9`) | better than last time, Moving, ready to go up, rep best | buttons |
| down | `#B04A1C` (tint `#FBEAE2`) | lowered, below the weekly range | errors |
| pr | `#8A6400` on `#FFF0C2` | records only | anything else |
| workout A / B | `#256F91` / `#96506F` | the calendar and the workout chip only | muscles, charts |
| danger | `#B42318` | delete and discard, always with a word | status |
| heat 0–3 | `#ECECE8` `#C6C7CC` `#8C8E97` `#3D3F47` | the body map, neutral; "below range" gets a down outline | — |

### Type

- **Face:** Geist 400/500/600 only.
- **Scale:** 12 (labels, upper case, +6 % tracking) · 14 (secondary) · 16 (body, rows) · 20 (a value
  in a panel) · 28 (screen title; 40 on Train and Summary) · 44 (a page's one headline number) · 88
  (the instrument: weight and reps at the bar; the rest timer is 76).

### Numerals

- Always tabular and lining.
- **A weight is written `70` + `kg`**: the unit at half size in ink-3, right after the number.
- **A set is written `70 × 8`**: the `×` in ink-3 with thin spaces, both numbers at the same weight.
- **Repeated sets are written `46.25 × 9 · 8 · 8`**.
- Bodyweight is `BW`, `BW+5` or `BW−19`, with a real minus sign.
- No number is ever coloured unless it *is* the verdict (`↑ +2.5 kg`).

### The one set row

`[index or W] [weight × reps] [optional tag]`, inside a 52 px cell or a 52–56 px row. It has four
states:

| State | How it is drawn |
|---|---|
| planned | dashed `#C9C9C3` border, ink-3 text |
| current | 2 px live border, ink text |
| done | surface fill, hairline, ink text, ✓ in ink-3 |
| PR | done, plus the gold `PR` tag |

The same row is used in the track, the All grid, the summary sets line, the lift page's sessions and
the session editor.

### Status

A glyph and a word in the status colour, with no box and no border:

- `↑ Moving` and `↑ Up to 15 kg` (up);
- `= Flat since 7 Aug` (ink-3);
- `↓ Lowered` (down).

On a row it sits under the name; on a lift page it is the first line. Advice is a separate ink
sentence ("Next time: 70 kg × 8."), never inside the status.

### Chart

- One series, a 2 px ink line, 3 hairline gridlines, labelled on the right.
- No point labels; tap for a readout.
- The last point is a filled ink dot; a PR point is a gold ring with "PR 90".
- A deload is a grey band with a hollow point.
- Metric chips: filled ink when selected. Range: text tabs, underlined.
- Sparklines: 72 × 26, a grey line, and an end dot in the status colour.

### PR

- The gold tag `PR` (11 px, 700, 4 px radius) on the set that earned it.
- During the session, one line for 3 s and nothing else. In the summary, PR rows come first.
- A **rep best** is green text, never gold and never a tag.

### Spacing and density

- 4 pt base; 20 px screen gutter.
- Rows are at least 52 px (56 in workout mode); tap targets at least 48 (64 for steppers).
- Sections are 20–24 px apart, with a 12 px upper-case label.
- **No cards for lists**: rows on paper with hairlines. At most one surface panel per screen.
- One filled ink bar per screen, docked 12 px above the tab bar or the bottom edge.

### Copy voice

- A coach in one sentence, numbers first, no exclamation marks.
- Statements instead of question-labels: "Set 2: reps left" rather than "Reps left?". The reason
  is shown as a sentence; there is no "Why?".
- Set expectations ("7 reps on a new weight is normal"; "a choice, not a slide").
- "Est. strength" replaces "Est. max" everywhere.
- Buttons are verb + object: "Start Workout B", "Log set 2 · 70 × 8", "Skip rest".

---

## 4. Information placement map

| Information | Belongs to (phase · screen) | Remove from |
|---|---|---|
| Prescription (sets × rep range) | Planning · Program; at the bar · the target line ("target 8–10") | Train rows (rep ranges) |
| Today's load per lift | Opening · Train (`3 × 15 kg`, ↑ when it changes) | — |
| What changed today | Opening · Train headline sentence | Train advice line under a row; Set screen "Use 15 kg" |
| Last time | At the bar · under the reps; Rest · next-set panel | Rest's restatement of the set just logged ("Same as Mon 12 Oct") |
| Plate line | Walking to the bar · drawn under the weight when it changes; "Same plates" otherwise | — (promote it) |
| Warm-up ramp | Walking to the bar · the `W` cell in the track, which opens the ramp | The text sentence above the track |
| PR projection ("PR if you get 8") | At the bar, one ink-3 line under "Last time" when the set would be a real PR | Anywhere else |
| Rest countdown | Rest · the ring hero | The bottom-left corner beside three buttons |
| Effort (reps left) | Rest · one row for the set just done | A card of its own |
| Exercise note | At the bar · one line under the exercise name | — |
| Session note (elbow) | Opening · folded into the headline sentence; the lift page's sessions | The italic block on Train |
| Status / advice | Lift page (status + sentence); a Progress row (glyph + word); Train (only for today's lifts that change); Program · Needs a decision | Progress decision cards; "Why?" links |
| Est. strength (e1RM) | Later · Progress rows and the lift page headline | The live screens |
| Volume | Summary totals line; Sessions list | Summary header; Progress "Last week" table |
| Muscles (weekly sets vs range) | Planning · Program; Later · Progress → Muscles | Summary "Worked today" |
| Week count | Opening · Train label "2 of 3 this week"; Later · the Progress weeks strip | Summary ("This week 3 of 3"); Progress headline |
| Calendar (A/B colour-coded) | Later · Sessions (kept as is); a mini week on Train and Progress | — |
| Records | Lift page; Summary (only new ones) | Live header counter |
| Elapsed time, sets done | At the bar · header subtitle | Header title row |
| Bodyweight | Later · Progress → Body row | — |
| Share | Summary · a text link | A button beside Done |
| Swap | At the bar · ⋯; Planning · Needs a decision | Progress cards |

---

## 5. Proposed screens

`proposal/index.html` (self-contained CSS, 390 × 844 each, rendered at device scale factor 2):

| # | File | Phase | What it shows |
|---|---|---|---|
| 1 | `proposal/01-train.png` | Opening | Workout B, "Same as Monday, except curls move up to 15 kg …", the A/B week, today's loads, Start |
| 2 | `proposal/02-set.png` | Walking to and at the bar | Deadlift set 2, 70 kg with plates drawn (25 per side), 8 reps, last time 70 × 7 |
| 3 | `proposal/03-rest.png` | Rest and the record moment | 2:41 of 3:00 ring, "↑ Rep best · 70 × 8", next set 3 panel, reps-left row, Skip rest |
| 4 | `proposal/04-summary.png` | Right after | Mon 12 Oct Workout B: "5 of 7 lifts beat Wednesday", 2 PR rows, per-lift ↑/=/↓, totals |
| 5 | `proposal/05-progress.png` | Later | "12 of 14 lifts are moving", 6 weeks of A/B dots, lift rows with est. strength and 12-week change |
| 6 | `proposal/06-lift.png` | Later · Lift page | Deadlift: ↑ Moving, "Next time: 70 kg × 8.", 86.3 kg, one chart with PR 90 and the deload band, records, sessions |

There are also two boards: `proposal/board.png` (the system plus all six screens) and
`proposal/before-after.png` (the current shot beside the proposed screen, per phase).

**Numbers:** all from `stats-45.json`.

- Est. strength uses the app's Epley formula (67.5 × 10 → 90.0, matching "Best est. max 90 kg").
- 12-week changes run from the first session on or after 20 July.
- The Summary uses Mon 12 Oct, against Wed 7 Oct, matching `recheck/32-past-summary.png`.

---

## 6. Build plan

Each step is one implementer's worth, in order. Steps 1–3 are the language; 4–10 apply it per
phase. Do not touch behaviour in steps 1–3.

1. **Palette roles.** Remap the Tokens to roles:
   - `--color-primary` → ink;
   - add `--color-live`, `--color-up`, `--color-down`, `--color-pr` (+ tints);
   - add `--workout-a` and `--workout-b`, separate from `--data-*`;
   - make the heat ramp neutral;
   - give Ready its own `up` colour, apart from `warn`.

   Files: `src/styles/tokens.css`, `src/styles/base.css`, and the Token-count test (the closed set is
   49; update `CONTEXT.md` **Token**/**Palette**).
2. **Numerals and the set row.** One `SetFigure` component (weight + unit, `×`, reps, repeated-reps
   form, BW forms) and one `SetCell` with four states. Use it in the track, the All grid, the summary,
   the lift page's sessions and the session editor. Files: `src/ui/live/*`, `src/ui/SetScreen.tsx`,
   `src/ui/SessionSummary.tsx`, `src/ui/LiftView.tsx`, `src/ui/SessionEditor.tsx`.
3. **Status and PR marks.**
   - One `StatusMark` (glyph + word + colour) and one `PrTag`.
   - Rename "Est. max" to "Est. strength".
   - Verify the rep-best-as-PR case in `live/after/30-rest-pr.png` against `isRealRecord`.

   Files: `src/features/progress/Home.tsx`, `src/features/progress/LiftPage.tsx`,
   `src/ui/SetScreen.tsx`, `src/domain/stats/records.ts` (read only, unless the bug is real).
4. **Train.**
   - A headline sentence of today's changes.
   - Rows show `sets × kg`, with ↑ on changes; drop the rep ranges.
   - Fold the session note into the sentence.
   - Show the cloud only on a sync failure.

   Files: `src/features/dashboard/DashboardView.tsx`, `trainCard.ts`, `DashboardScreen.css`,
   `src/ui/CalendarWeek.tsx`.
5. **Set screen at the bar.**
   - Centre the instrument (88 px) and remove the empty band.
   - Draw the plates for one side when the weight changes; otherwise "Same plates".
   - Warm-ups become the `W` cell.

   Files: `src/ui/SetScreen.tsx`, `SetScreen.css`, `src/ui/WeightDial.tsx`, `src/ui/live/*`.
6. **Rest.**
   - The ring hero (236 px, 76 px digits) and ±15 s.
   - The next-set panel and one effort row.
   - The primary becomes Skip rest; return to the instrument at 0:00.

   Files: `src/ui/live/RestPanel.tsx`, `src/ui/live/live.css`, `src/ui/SetScreen.tsx`,
   `src/ui/RestDial.tsx`, `src/ui/LiveStrip.tsx`, `SetScreen.css`.
7. **The PR moment.** The gold tag on the cell, a 3 s line under the track, and the quiet rep-best
   line. Remove the header PR counter and the PR inside the effort card. Files: `src/ui/Toast.tsx`,
   `src/ui/LiveHeader.tsx`, `src/ui/SetScreen.tsx`.
8. **Summary.**
   - The verdict sentence and the PR rows.
   - Per-lift ↑/=/↓ vs the last same workout; the totals line; "Next".
   - Share becomes a text link; remove "Worked today".

   Files: `src/ui/SessionSummary.tsx`, `SessionSummary.css`, `src/ui/VolumeVsBaseline.tsx`.
9. **Progress home.**
   - The headline count and the exceptions sentence.
   - The weeks strip in A/B colours.
   - One ledger row per lift (status, 72 px spark, est. strength, 12-week change).
   - Remove the decision cards and the Last week table.

   Files: `src/features/progress/Home.tsx`, `Home.css`, `AllLifts.tsx`, `src/ui/charts/Sparkline.tsx`.
10. **Lift page and charts.**
    - Status and advice as sentences, plus one expectation-setting line.
    - The 44 px est. strength with its definition.
    - One chip row in place of two segmented controls.
    - A single ink line, with a PR ring, a deload band and no point labels.

    Files: `src/features/progress/LiftPage.tsx`, `src/ui/LiftView.tsx`, `src/ui/charts/LiftChart.tsx`,
    `LiftChart.css`, `ChartReadout.tsx`.
11. **Program: Needs a decision.** Move the stalled and ready decisions (Swap, add load) from Progress
    into a top section of Program. Drop the family colours from the weekly bar. Files:
    `src/ui/ProgramPage.tsx`, `ProgramPage.css`, `src/features/progress/useProgramSwap.tsx`.
12. **Sweep.** Restyle Sessions, Settings, sheets and the editors with the tokens alone (no layout
    changes; keep the A/B calendar exactly as it reads now), then re-run the v6 recheck shots. Files:
    `src/features/sessions/SessionsScreen.css`, `src/ui/Settings.css`, `src/ui/Sheet.css`,
    `src/ui/ProgramEditor.css`, `src/ui/SessionEditor.css`.
