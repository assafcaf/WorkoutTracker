# Design review: WorkoutTracker, structure first

Reviewer: Maya Okafor (design expert, `docs/design-expert/persona.md`). Viewport 390x844, touch, light mode. Seeded state `scripts/render-states/stats-45.json` (clock Thu 15 Oct), clean first run, and photos state. Dev mode only: `/api/*` is absent, so sign-in and sync fail by construction; only the honesty of the UI about that is judged. Every screenshot cited is in `before/` and was looked at.

---

## 1. Verdict summary

The designer was right, but the anti-patterns are mostly **not** on the core loop. The train loop is fast: launch -> first Set logged is 2 taps, log next Set 1 tap, change weight 1 tap. The damage is in the **information architecture around it**: the same data is drawn in two or three places, with different windows, different words and different verdicts. The trainee has to learn several models of one thing, and the screens contradict each other.

### The 8 biggest structural problems, in plain words

1. **Home is a second Progress page and a second Sessions page, and it hides today's Workout.** Home shows a weekly ring, 14 lift sparklines, a 12-week session heatmap and the last Session (`before/A01-home.png`). Each one copies a tab. What the trainee needs before the gym (what is in today's Workout, what weights) sits one tap deeper, on a Workout page that has no tab bar (`before/A02-home-tap-card.png`).
2. **Three session calendars that disagree.** Home: "30 sessions in 12 weeks". Progress: a 6-week dot calendar with "15 sessions in 6 weeks", under a header that says "12 weeks". Sessions: the real colour-coded calendar, 6 weeks, 15 sessions (`before/A01-home.png`, `before/C01-progress.png`, `before/D01-sessions.png`).
3. **Muscle volume and lift status each live in two tabs and give different answers.** Progress -> Muscles says Calves 8 sets "as planned" and Abs 3 "as planned"; Program says "Calves 8 · below 10" and "Abs 3 · below 10". Progress calls DB bench press "Flat since 7 Aug"; Program and the lift page call it "Stalled" (`before/C07-muscles.png`, `before/E03-program-3.png`, `before/C01-progress.png`, `before/E01-program.png`).
4. **Program management is split across four controls and hides the deload week.** A "Switch program" dropdown, an "Edit" button, an unlabelled "..." that opens a Programs page with its own Edit/Copy per Program, and "Start a deload week" only inside that "..." page. First run adds two more Program pickers: a "Pick a plan" radio card on Home and "Use this ..." primaries on the Program tab (`before/E01-program.png`, `before/E05-program-more.png`, `before/F01-first-run.png`, `before/F05-first-run-program.png`).
5. **The Shell behaves differently on every sub-page.** The tab bar vanishes on 10 non-modal pages (Workout page, lift page, Muscles, Body, Photos, Settings, Session detail, Programs, Add exercise, Exercise info) but stays on the Session editor. Exits are a chevron, "Done", "Close" (centred text), an X, "Cancel", or nothing at all (Session editor: no header exit; Cancel is ~2,000 px down).
6. **The live Session's "..." is a catch-all page in a sheet.** One icon opens a near-full-height sheet with two tabs (Warm-up, Notes) and six rows (Set type, Rest time, Swap exercise, Exercise info, What can I lift, Lift history). Each row opens another sheet or a full page on top of the modal Session (`before/B10-exercise-tools.png` and B11-B16).
7. **One job, several different UIs.** Four exercise pickers (live Swap, Program "Replace", editor "Add exercise" paginated over 169 pages, the Exercises library), three Set-entry controls (live stepper, Session-editor wheel, Program-editor fields), five entry points to progress photos, and two "Delete workout" buttons.
8. **Colour means two things.** Muscle-family tints reuse the Workout A teal, the Workout B plum and the "up" green. Workout A/B colours leak out of the calendar onto Home, Progress and the Workout page, which the Palette reserves for the calendar.

### Target structure

Four tabs, one per moment, each with one job. Every other place links to these and does not redraw them.

| Tab | Moment | One job | Gains | Loses |
|---|---|---|---|---|
| **Train** (replaces Home, launch screen) | plan -> train | Show today's Workout and start it. | The Workout page content (A02) becomes the tab, with the Shell. A one-line Program picker on first run. | Ring card, 14 sparklines, heatmap, last-Session row, gear. |
| **Sessions** | progress (history) | What did I do, and when. | Session detail as a pushed page with the Shell. The only sync-status line. | Nothing. The calendar stays exactly where it is. |
| **Progress** | progress | Am I getting stronger? | One status vocabulary. Muscles and Body as rows at the top. Rep maxes as a section of the lift page. | The 6-week mini calendar. The Photos row (moves into Body). |
| **Program** | plan | What will I do, and how do I change it. | Programs, Deload week, Exercises and Settings as visible rows. | Segmented control, "Switch program" select, "..." page, "Needs a decision", the planned-muscles card and bar. |

The live Session stays a **modal over the Shell**. Minimised, it shows one resume strip above the tab bar, and nothing else on any tab duplicates it.

```
                      ┌────────────────────────────────────────────┐
Tab bar (always)      │  Train     Sessions     Progress    Program │
                      └────┬──────────┬────────────┬───────────┬────┘
                           │          │            │           │
 Train ──────────────────────┘          │            │           │
[first run] Choose a Program (2 rows) │            │           │
Workout B  · Thu · 2 of 3 this week   │            │           │
change note ("curls move up to 15")   │            │           │
Plan list: Deadlift 3×60→70 kg ...    │            │           │
Action bar: [ Start Workout B ]       │            │           │
   │                                  │            │           │
   └─► LIVE SESSION (modal, covers Shell)          │           │
        Set screen ⇄ All exercises     │            │           │
        Rest  (Log set = primary)      │            │           │
        Exercise row: Swap · Notes · History (visible, no "...")
        Finish ─► Summary (= Session detail) ─► Done ─► Train
        minimise ─► one strip above the tab bar: "Workout B · Rest 2:59 · Resume"
                                      │            │           │
 Sessions ──────────────────────────────┘            │           │
Calendar (colour-coded, unchanged)                 │           │
"Saved on phone · not synced"  (only sync line)    │           │
List by week ─► Session detail (Shell kept, ‹ back, Edit)      │
                  └─► Session editor (Cancel / Save in header; │
                       Delete Session at bottom, with Undo)    │
[Log past] text button in header                   │           │
                                                   │           │
 Progress ───────────────────────────────────────────┘           │
"12 of 14 lifts are moving" + 1 line                           │
Muscles ›   Body ›   (rows, above the list)                    │
Lift list (status · sparkline · value · change)                │
   └─► Lift page (one component, also from Exercises & live History)
         status · next time · chart · records · Rep maxes · Sessions
Body page: chart + history first, [Log bodyweight] action, Photos section
                                                               │
 Program ────────────────────────────────────────────────────────┘
A/B Split · 3× week · 69 sets/week          [Edit]
Workout A (plain list)     Workout B (plain list)
Muscles this plan hits: 1 line ─► Progress › Muscles
Programs ›  (switch · new · copy)
Deload week ›
Exercises ›  (library; same picker everywhere)
Settings ›   (incl. Sign in & sync)
```

**Screens that die:** Home dashboard (A01); the Progress mini-calendar; Program's "Needs a decision" section, "Weekly sets, planned" bar and "Muscles, planned per week" card; the "Switch program" select; the Program/Exercises segmented control; the What-can-I-lift sheet (becomes a lift-page section); the live tools sheet (its rows become visible controls or move to the lift page); the Photos row on Progress (Photos becomes a section of Body); the "Pick a plan" radio card; the "Discard workout" link in the All view (Discard moves to one place, DX-14).

**Screens that merge:** Workout page (A02) + Home -> Train. Body + Photos -> Body. Program "Replace", live "Swap", editor "Add exercise" and the Exercises library -> one exercise picker. Session detail and the post-finish Summary already share one component; keep it.

---

## 2. Whole-app model and flow counts

### 2.1 Current navigation model

```
Tab bar: Home | Progress | Sessions | Program        (4 tabs, all navigate: NAV-01/02 pass)

Home ──┬─ gear ─► Settings (no tab bar) ─► Bar and plates (inline expand)
     ├─ ring card ─► Workout page (no tab bar; gear again; "Not synced · Retry")
     ├─ Lifts header / 14 sparklines ─► Progress / lift page
     ├─ heatmap ─► Sessions
     ├─ last-Session row ─► Session detail
     └─ Start Workout B ─► LIVE
LIVE ──┬─ ⌄ minimise ─► Home with banner "Return" + card "Resume Workout B" + bar "Resume"
     ├─ All/Now toggle (replaces screen) ─► footer: Add exercise · Add note · Discard workout
     ├─ ... tools sheet ─┬─ Set type (inline), Rest time (2nd sheet), What can I lift (2nd sheet)
     │                   ├─ Swap exercise (full page), Exercise info (full page, ‹)
     │                   └─ Lift history (full page, "Done")
     └─ Finish ─► sheet (Finish / Keep going / Discard) ─► Summary ─► Done
Progress ─┬─ lift ─► lift page (no tab bar) ─► What can I lift (sheet)
        ├─ Muscles ─► Muscles page        ├─ Body ─► Body page ─► View photos ─► Photos
        └─ Photos ─► Photos page
Sessions ─┬─ + ─► "Log a past workout" sheet
        └─ calendar cell / row ─► Session detail (no tab bar, "Done") ─► pencil ─► Session editor (tab bar!)
Program ──┬─ [Program|Exercises] segmented ─► Exercises list ─► lift page
        ├─ Switch program <select>     ├─ Edit ─► Program editor ─► Add exercise picker (no tab bar)
        ├─ ... ─► Programs page (Edit, Copy, New program, Start a deload week)
        ├─ Needs a decision row ─► lift page;  Swap ─► Replace picker
        └─ Workout tables, planned-muscles card (read-only)
```

### 2.2 Every duplicated path (NAV-06)

| Job | Places it is drawn today | Canonical home after |
|---|---|---|
| Session frequency / calendar | Home heatmap (12 wk), Progress dot grid (6 wk), Sessions calendar (6 wk), Workout-page week strip | Sessions calendar |
| "Am I on track this week" | Home ring "2/3", Workout-page strip "2 of 3" | One line on Train |
| Lift trend | Home 14 sparklines, Progress list | Progress list |
| Lift status (needs a decision) | Progress list ("Flat"), Program "Needs a decision" ("Stalled"), lift page ("Stalled") | Progress list + lift page, one vocabulary |
| Muscle volume | Progress -> Muscles (done vs plan), Program bar (Push/Pull/Legs/Core), Program body-map card | Progress -> Muscles |
| Last Session | Home row, Sessions list | Sessions list |
| Resume live Session | Home banner "Return", card "Resume Workout B", Action bar "Resume" | Resume strip only |
| Choose / switch Program | Home "Pick a plan" (first run), Program "Use this ..." (first run), "Switch program" select, Programs page | Programs page (first run: on Train) |
| Edit Program | Program header "Edit", Programs page "Edit" per Program | Program header "Edit" |
| Rep maxes | Lift page "What can I lift ›", live tools "What can I lift" | Lift page section |
| Exercise picker | live Swap, Program Replace, editor Add exercise, Exercises library | One picker component |
| Progress photos | Progress Photos row, Body "Add photo", Body "View photos", Summary "Add progress photos", Session editor "Add photos" | Body page, Photos section |
| Delete a Session | Session detail "Delete workout", Session editor "Delete workout" | Session editor only |
| Discard live Session | All view footer, Finish sheet | All view footer only, with Undo (DX-14) |
| Settings entry | gear on Home, gear on Workout page; none on 3 other tabs | Program -> Settings row |
| Sync status | Workout-page header only; Settings "Never synced" | Sessions header line + Settings |

### 2.3 Flow counts (mandate §5.3)

| Flow | Budget | Measured | Result |
|---|---|---|---|
| Launch -> first Set logged | 2 | 2 (Start Workout B, Log set 1) | Pass |
| Log next Set | 1 | 1 (Log set 2, but styled as text on Rest: DX-05) | Pass on count, fails affordance |
| Change weight | 1 | 1 (+) | Pass |
| End Session | 2 | 2 (Finish, Finish workout) + Done on Summary | Pass; the confirm should be Undo (DX-14) |
| Find last week's numbers for an Exercise | 2 | 0 in a Session ("Last time 60 × 10 · Mon 12 Oct"); 2 + ~700 px scroll outside (Progress -> lift) | Pass |
| Edit a Plan | 3 | 3 (Program, Edit, field); 4 for weight step via the row's "..." | Pass |

The flows are within budget. The structure, not the tap count, is what fails.

### 2.4 First screen (mandate §5.5)

Before the gym the trainee wants today's Workout: what Exercises, what weights, what changed. Home shows statistics about the past instead, and the Workout itself is one tap away on a page without the Shell. During a Session, launch correctly reopens the live Session. Fails, fixed by DX-01.

---

## 3. Per-screen blocks

Counts are for the first viewport at 390x844, Shell excluded. "Boxes" = visible bordered or filled containers.

### A01 Home  (screenshot: before/A01-home.png)
Moment: plan (claims), progress (delivers)
One job (<=12 words): none. "Show week status and lift trends and calendar and last Session and start."
Elements in first viewport: 21 tappable (gear, card, ‹, ›, Lifts header, 14 sparklines, heatmap, last row, Start) / 9 text blocks / 3 boxes / 0 filled primaries (Start is outline)
Focal element: three things (ring "2/3", "On track", "30")
Fails: NAV-06 (ring, sparklines, heatmap, last row each copy a tab), NAV-07 (one tab serves plan and progress), LAY-01, LAY-02 (21 > 7), LAY-03 (three focal numbers), LAY-06 / TYP-03 (eyebrows "THU 15 OCT", "LIFTS · 12 WEEKS", "SESSIONS · 12 WEEKS", "REST DAY"), BTN-04 (‹ › on the card with no label), TYP-05 (A/B badges in Workout colours off the calendar), TYP-02 (16 strings at 12 px)
Passes worth keeping: one Action-bar button that names the Workout ("Start Workout B").

### A02 Workout page  (screenshot: before/A02-home-tap-card.png; A03, A04 identical)
Moment: plan -> train
One job: preview today's Workout and start it.
Elements in first viewport: 13 tappable / 12 text blocks / 1 box / 1 primary
Focal element: "Workout B" title, then the Start button
Fails: NAV-04 (no tab bar on a non-modal page), NAV-06 (week strip duplicates the ring and calendar; gear duplicates Home's), BTN-04 (‹ › flank the title with no labels; "2 of 3 ›"), FDB-06 ("Not synced · Retry" appears only here)
Passes worth keeping: the change note ("Same as Monday, except curls move up to 15 kg"), "was 14 kg", "23 sets · about 66 min". This is the best plan screen in the app; it should be the Train tab.

### A05 Home, Session minimised  (screenshot: before/A05-home-during-session.png)
Moment: train
One job: get back to the live Session.
Elements in first viewport: 23 tappable / 3 resume controls / 2 filled primaries
Focal element: two (card "Resume Workout B" and bar "Resume")
Fails: NAV-06 (3 resume controls), BTN-01 (2 filled primaries), BTN-06 ("Return" vs "Resume" for one action)
Passes worth keeping: the top strip "Workout B · 00:02 · Rest 2:59" is exactly the right status.

### B01 Live Set screen  (screenshot: before/B01-live-set.png)
Moment: train
One job: set weight and reps, then log the Set.
Elements in first viewport: 12 tappable / 8 text blocks / 10 boxes / 1 primary
Focal element: the "60 kg" Dial value (correct)
Fails: LAY-02 (12 > 7, mostly justified), BTN-04 ("..." Exercise tools; "W 30–50 +" chip), TYP-02 ("00:01 · 0/23 sets" progress at 12 px), LAY-05 (10 boxes: 4 dashed chips + 4 stepper squares + 2), dead band of ~130 px between chips and Dial (y 200-330)
Passes worth keeping: 88 px values, 64 px steppers, "Last time 60 × 10 · Mon 12 Oct", plate line "Per side: 20 on a 20 kg bar", Log button carries the values.

### B03 Rest  (screenshot: before/B03-rest.png)
Moment: train
One job: rest, then log the next Set.
Elements in first viewport: 17 tappable (incl. 4 effort chips, ±15 s, next-set card) / 9 text blocks / 11 boxes / 0 filled primaries
Focal element: the 2:59 ring (correct), but no next action stands out
Fails: BTN-07 (Log set 2 is plain text; Skip rest has the button shape and is 48 px wider), LAY-03 (the next step does not pop), LAY-02 (17), CPY-01 ("Set 1: reps left" at 12 px for RIR), TYP-03 ("NEXT · SET 2")
Passes worth keeping: big countdown, ±15 s, "Add 5 per side -> 20 + 5", "PR at 9 reps".

### B04/B05 All exercises view  (screenshots: before/B04-all-view.png, before/B05-all-view-scrolled.png)
Moment: train
One job: see the whole Workout and jump to an Exercise.
Elements in first viewport: 25 Set chips + 3 header + 1 primary
Focal element: Log set (correct)
Fails: LAY-04/LAY-05 (25 dashed boxes for homogeneous Sets), BTN-04 (header toggle icon changes between "All" and a dumbbell "Now"), BTN-05 ("Discard workout" in red, 8 px from "Add note"), NAV-06 (Discard also in the Finish sheet)
Passes worth keeping: per-Exercise "1/3 · 3 × 8–10" progress counters.

### B07 Finish sheet  (screenshot: before/B07-finish-confirm.png)
Moment: train
One job: end the Session.
Elements: 3 buttons / 1 filled primary / sheet covers the rest
Fails: MOD-05 (confirm where Undo belongs), BTN-05 (red "Discard workout" directly under "Keep going", 12 px gap), MOD-04 (no close X; grab handle only, plus "Keep going")
Passes worth keeping: "22 sets not logged" states the consequence plainly.

### B08 Summary after finishing  (screenshot: before/B08-summary.png)
Moment: train -> progress (the Peak-end)
One job: show what this Session achieved.
Elements: 4 tappable / 6 text blocks / 1 primary
Focal element: "Done"
Fails: VIZ-02 (a short Session shows "2 of 3 sets", no comparison), NAV-06 ("Add progress photos" is the 3rd photo entry), the Peak-end moment is ~70 % blank space
Passes worth keeping: same component as Session detail (D06), so the full Session shows "6 of 7 lifts beat Wednesday".

### B10 Exercise tools sheet  (screenshot: before/B10-exercise-tools.png; B15-set-type.png)
Moment: train
One job: none. "Warm-ups, notes, Set type, rest, swap, info, maxes and history."
Elements: 11 tappable / 1 segmented control / 3 warm-up rows / 0 primary
Fails: LAY-01, MOD-03 (sheet 735 px tall, used as a page), NAV-09 (lift history and rep maxes are progress features in the train hot path), BTN-04 (the only entry is "..."), MOD-02 (Rest time opens a second sheet, B16; Swap, Info and History replace it with full pages, B11, B12, B14)
Passes worth keeping: warm-up ramp rows with per-side plates.

### B11 Swap / E14 Replace  (screenshots: before/B11-swap.png, before/E14-program-swap.png)
Moment: train (B11), plan (E14)
One job: pick an Alternative.
Elements: 13 tappable / 6 "Do this instead" outline buttons
Fails: BTN-03 (6 identical CTAs), CPY-03 (button label 3 words, repeated 6 times), CON-02 (third and fourth picker designs; see E12), MOD-04 partial (X only, top-right, 360 px from the thumb)
Passes worth keeping: alternatives ranked by similarity, with search and "Show all (47)".

### B12 Lift history from live  (screenshot: before/B12-lift-history.png)
Moment: train (borrowed from progress)
One job: this lift's history.
Fails: CON-01 (the same page has "Done" top-right here and a ‹ chevron top-left from Progress, C04), NAV-09
Passes worth keeping: it is the same lift component as C04 and E09, so there is one canonical lift page.

### B13/C15 What can I lift  (screenshots: before/B13-what-can-i-lift.png, before/C15-what-can-i-lift.png)
Moment: progress
One job: rep maxes from one Set.
Elements: 13 tappable / 11 bordered boxes
Fails: MOD-03 (list runs past the viewport; rows 9-10 below the fold), LAY-05 (10 heavy-bordered rows), BTN-07 (rows are buttons that look like a table), NAV-06 (two entries). Bug: the Reps field overflows the viewport (x 272 -> 516 px).
Passes worth keeping: prefilled with the latest Set.

### B14 Exercise info  (screenshot: before/B14-exercise-info.png)
Moment: plan/train
One job: how to do this Exercise.
Fails: CPY-02 ("Equipment: barbell", "Mechanic: compound", "Force: pull", "Level: intermediate"), TYP-06 (muscle chips tinted green, plum and brown; see DX-15), the body map sits above the instructions the trainee came for
Passes worth keeping: video links and numbered steps.

### B16 Rest time sheet  (screenshot: before/B16-rest-time.png)
Moment: train
Fails: MOD-02 (opened from the tools sheet), BTN-01 ("Set rest" filled, "Use 3:50" below it competes), CON-02 (a wheel, unlike the ±15 s on the Rest screen)
Passes worth keeping: "usually 3:50" learned from behaviour.

### C01/C02 Progress  (screenshots: before/C01-progress.png, before/C02-progress-2.png)
Moment: progress
One job: am I getting stronger?
Elements in first viewport: 8 tappable / 10 text blocks / 0 boxes / 0 primary
Focal element: "12 of 14 lifts are moving" (correct)
Fails: NAV-06 (6-week dot calendar copies Sessions), VIZ-02 (header "12 weeks" vs "15 sessions in 6 weeks"), LAY-07 (Muscles, Body and Photos rows start ~1,500 px down, below 14 lifts), CPY-04 ("Flat" here, "Stalled" on Program and the lift page), TYP-05 (A/B colours in the mini calendar)
Passes worth keeping: an answer-first headline with one explanatory sentence; list rows with sparkline, value and change.

### C04 Lift page  (screenshots: before/C04-lift.png, before/C05-lift-2.png, before/E13-program-decision-tap.png)
Moment: progress
One job: this lift's trend and what to do next.
Elements in first viewport: 8 tappable / 7 text blocks / 1 primary-styled chip
Focal element: "79.2 kg"
Fails: NAV-04 (no tab bar), BTN-01 ("Est. strength" chip filled black, the same style as the Action-bar primary), TYP-03 ("RECORDS", "SESSIONS"), VIZ-02 minor ("PR" chip on 4 of 4 visible Session rows dilutes it)
Passes worth keeping: "Next time: 62.5 kg × 9" with a one-line why; the deload band on the chart; gold only for PRs.

### C07 Muscles  (screenshots: before/C07-muscles.png, before/C08-muscles-2.png, before/C16-muscle-tap.png)
Moment: progress
One job: is each muscle getting enough Sets?
Fails: NAV-06 + CPY-04 (contradicts Program on Calves and Abs), CPY-03 (legend line plus a 3-clause instruction line plus a footnote), VIZ-02 ("10 sets/week · plan 10" repeated for 9 rows when done equals plan: the comparison carries no news)
Passes worth keeping: tap a muscle to see which lifts fed it (C16).

### C09/C13 Body  (screenshots: before/C09-body.png, before/C13-body-populated.png, before/C14-body-populated-2.png)
Moment: progress
One job: track bodyweight over time.
Elements in first viewport: 8 tappable / 4 fields / 1 primary
Focal element: an empty form and a "Save" bar
Fails: LAY-07 (the chart and history start at y 475 and y 745, below an empty form), LAY-01 (form + height + photos + chart + list), BTN-07 ("Save height" and "View photos" plain text beside an outline "Add photo"), NAV-06 (Photos entry #2 and #3), FDB-03 (empty: "Log your first bodyweight to start the chart." under a form, acceptable), BTN-05 (Delete on every history row, no undo)
Passes worth keeping: bodyweight and waist chart toggle with direct-labelled last value.

### C11/C12 Photos  (screenshots: before/C11-photos.png, before/C12-photos-populated.png)
Moment: progress
One job: compare photos over time.
Fails: NAV-06 (5 entry points), layout (2-column grid leaves the right third empty; 2 photos per row at 103 px wide), no side-by-side compare
Passes worth keeping: the empty state (one line of why, one button), the "7 photos since 25 Aug · −2.3 kg" headline.

### D01 Sessions  (screenshots: before/D01-sessions.png, before/D02-sessions-2.png)
Moment: progress (history)
One job: find a past Session.
Elements in first viewport: 21 tappable / 1 box (calendar card)
Focal element: the calendar (correct)
Fails: A11Y-01 (calendar cells 40x32 px), BTN-04 ("+" with no label opens "Log a past workout"), TYP-03 ("THIS WEEK", "WEEK OF 28 SEP"), FDB-03 on first run (F04: one line, no action)
Passes worth keeping: colour plus letter in each cell (passes TYP-07), today outlined, a plain list grouped by week, "Deload" marked.

### D06 Session detail  (screenshots: before/D06-calendar-tap.png, before/D03-session-open.png, before/D04-session-open-2.png)
Moment: progress
One job: what happened in this Session vs last time.
Elements in first viewport: 7 tappable / 1 primary
Focal element: "Workout A" title, then "Done"
Fails: NAV-04 (no tab bar, while the editor under it keeps the bar), BTN-06 ("Done" as a filled primary on a read-only page), BTN-04 (pencil icon-only edit), NAV-06 ("Delete workout" here and in the editor)
Passes worth keeping: "5 of 7 lifts beat Friday. Four records. Push-ups dipped." and per-lift deltas.

### D05 Log a past workout  (screenshot: before/D05-session-add.png)
Moment: progress (backfill)
Fails: MOD-04 (no close control; handle only), BTN-04 (entry is a bare "+"), BTN-06 (buttons "Workout A"/"Workout B" do not say they create a Session)
Passes worth keeping: date first, then one tap per Workout.

### D07 Session editor  (screenshots: before/D07-session-edit.png, before/D08-session-edit-bottom.png, before/D09-session-edit-set.png)
Moment: progress (correction)
One job: correct a past Session.
Elements in first viewport: 18 tappable / 13 boxes / 0 primary
Fails: NAV-04 (no header exit: no ‹, no Cancel; Cancel and Save sit at the bottom of a ~2,500 px page), BTN-05 (red "Delete" 8 px from "Edit" on every Set row, ×23; "Delete workout" in the same row as Cancel and Save), MOD-05/H3 (no Undo seen), CON-02 (a third Set-entry design: wheel plus ±)
Passes worth keeping: Deload toggle, Add set and Add exercise per Session, Set kind letter (W, D) before the value.

### E01-E04 Program  (screenshots: before/E01-program.png to before/E04-program-4.png)
Moment: plan
One job: none. "Choose a Program, decide on lifts, see Workouts and plan muscles."
Elements in first viewport: 17 tappable / 4 boxes / 2 outline CTAs (Swap) / 1 select
Focal element: none (title, select, 2 Swap buttons and the decision list compete)
Fails: LAY-01, NAV-06 (decisions duplicate Progress; muscles duplicate Progress -> Muscles; select duplicates the Programs page), NAV-05 / BTN-04 ("..." hides Programs and the deload week), LAY-04 (Workouts as cards holding 4-column tables), TYP-02 (12 px table headers, 14 px rows), TYP-03 ("NEEDS A DECISION"), LAY-06 (segmented control "Program | Exercises" stands in for a title)
Passes worth keeping: Workout tables show "47.5 -> 62.5" and "14 ↑15", so the next change is visible.

### E05 Programs page  (screenshot: before/E05-program-more.png)
Moment: plan
One job: switch, create or copy a Program.
Fails: BTN-03 (7 buttons), BTN-07 (the active Program is a big outlined button; the inactive one a grey filled block, so "active" reads as "disabled"), NAV-09 ("Start a deload week" is a training decision hidden here), CPY-03 ("ACTIVE PROGRAM" label over both cards)
Passes worth keeping: Copy as a first-class action.

### E06 Program editor  (screenshots: before/E06-program-edit.png, before/E07-program-edit-2.png, before/E10-editor-workout-menu.png, before/E11-editor-exercise-menu.png)
Moment: plan
One job: change Plans.
Elements in first viewport: 26 tappable / 22 boxes
Focal element: none
Fails: LAY-05 (4 filled boxes per Plan, ×14 = 56 boxes plus 2 name fields), BTN-04 ("..." per Plan and per Workout; ⠿ drag handle), NAV-06 (drag handle and "Move up / Move down" both reorder), TYP-06 (coloured dots before each name = Muscle family), FRM-02 (Rest typed as "m:ss"), "Sessions per week" typed into a free field
Passes worth keeping: Cancel/Save in the header (the only editor that does this); "For Back squat in every workout" scope hint.

### E08 Exercises  (screenshot: before/E08-exercises.png)
Moment: plan
One job: find an Exercise and its last Set.
Fails: NAV-09 (a catalog behind a segmented control on Program), TYP-03 ("MY LIFTS")
Passes worth keeping: last Set and date inline on each row; plain list.

### E12 Add exercise picker  (screenshot: before/E12-add-exercise-picker.png)
Moment: plan
One job: pick an Exercise to add.
Elements: 24 tappable (10 "Pick", Previous, Next, Close, filter, search, rows)
Fails: CON-02 (fourth picker design), MOD-04 / CON-03 ("Close" as centred text under the title, no X), BTN-03 (10 "Pick" buttons), "Page 1 of 169" pagination for a searchable list, TYP-06 (brown/green muscle dots)
Passes worth keeping: "My gym only" filter.

### F01 First run  (screenshots: before/F01-first-run.png, before/F03-first-run-progress.png, before/F04-first-run-sessions.png, before/F05-first-run-program.png, before/F06-first-run-live.png)
Moment: plan (first)
One job: choose a Program and start.
Fails: NAV-06 (Program choice on Home and on Program), CPY-04 ("Pick a plan": Plan is a reserved word meaning one Exercise's prescription), FDB-03 (empty sparklines and an empty heatmap teach nothing; Sessions empty has no action), CPY-03 (Progress empty: 5 lines of rules), BTN-01 (F05: two filled "Use this ..." primaries)
Passes worth keeping: a Program is preselected, so "Start Workout A" works in 1 tap; first live Set says "First time · start light".

### G01 Settings  (screenshots: before/G01-settings.png, before/G02-settings-2.png, before/G06-bar-plates.png, before/G07-sync-now.png)
Moment: none (setup)
One job: change preferences and manage data.
Fails: FDB-05 (after "Sync now", G07 is unchanged: no message), FDB-06 ("Not signed in" with no Sign in control), CON-02 (rows run edge to edge with a 4 px gutter; every other screen uses 16 px), A11Y-01 (weekday chips ~38x26 px), TYP-05 (7 red trash icons in Bar and plates), CPY-03 (two hint lines above disabled Reminder chips), NAV-05 (reachable only from Home and the Workout page)
Passes worth keeping: grouped sections, toggles for Track effort and Keep screen on, Export and Import visible (DRK-04 pass).

---

## 4. Verdicts

Severity order: Critical (structural first), then Major (structural first), then Minor.

#### DX-01 · Critical · Home (A01) / Workout page (A02)
- Type: Structural
- Checklist: NAV-06, NAV-07, LAY-01, LAY-02, LAY-03, NAV-04
- Evidence: before/A01-home.png — 21 tappable elements above the fold, 3 competing focal numbers, 4 blocks that each copy another tab (ring, 14 sparklines, 12-week heatmap, last-Session row); before/A02-home-tap-card.png — today's Exercises and weights are 1 tap deeper on a page with no tab bar.
- What's wrong: At the plan moment (before the gym) the trainee wants today's Workout: what Exercises, what weights, what changed. Home answers progress questions instead, and duplicates Progress and Sessions (NAV-06). The real plan screen, A02, is orphaned outside the Shell (NAV-04).
- Fix: Rename the Home tab to **Train** (same icon slot, label "Train") and make its content the A02 Workout page, inside the Shell:
1. Header: title "Workout B" (28 px) and one quiet meta line under it, "Thursday · 2 of 3 this week". Remove the ‹ › arrows beside the title. Previewing other Workouts moves to the Program tab.
2. Keep the change note ("Same as Monday, except curls move up to 15 kg. Note from Wed 7 Oct: ...").
3. Keep the Plan list (Exercise · Sets × weight, "was 14 kg").
4. Action bar: one filled button, "Start Workout B". The "23 sets · about 66 min" line stays above it.
Delete from the tab: the ring card ("2/3 this week", "Rest day", "On track", ‹ ›), the "Lifts · 12 weeks" sparkline block, the "Sessions · 12 weeks" heatmap, the last-Session row, the gear icon (Settings moves, DX-04) and the M–S week strip.
On a rest day, keep the same layout. The meta line reads "Rest day · next: Workout B, Friday" and the button reads "Start Workout B anyway" (outline, not filled).
- Acceptance check: At 390x844, launch shows "Workout B", its 7 Plans and exactly one filled button, with no scrolling and ≤ 9 tappable elements above the fold. The tab bar shows "Train | Sessions | Progress | Program". No sparkline, heatmap or ring exists outside Progress and Sessions.

#### DX-02 · Critical · Home, Progress, Sessions
- Type: Structural
- Checklist: NAV-06, VIZ-02, TYP-05
- Evidence: before/A01-home.png — "30 sessions in 12 weeks" heatmap; before/C01-progress.png — 6-week dot grid "15 sessions in 6 weeks" under the header "SINCE 23 JUL · 12 WEEKS"; before/D01-sessions.png — calendar "Last 6 weeks · 15 sessions"; before/A02-home-tap-card.png — a fourth, one-week strip.
- What's wrong: Four drawings of one fact, with three windows (1, 6, 12 weeks) and two totals (15, 30). The trainee cannot tell which is the truth, and the team maintains four designs. The Palette reserves the Workout A/B colours for the calendar, yet three of these copies use them.
- Fix: Keep **only** the Sessions calendar (unchanged: colours, letters, today outline). Delete the Home heatmap (DX-01), the Progress dot grid and its "15 sessions in 6 weeks" text, and the Workout-page week strip. On Progress, the headline block becomes the title "12 of 14 lifts are moving", the one explanatory sentence and a meta line "Since 23 Jul · 30 Sessions" in grey 14 px sentence case. On Train the meta line is "2 of 3 this week" (DX-01).
- Acceptance check: Searching all four tabs at 390x844, exactly one calendar or heatmap exists (Sessions). Every Session count on screen uses the same window as its label says.

#### DX-03 · Critical · Progress, Muscles, Program, lift page
- Type: Structural
- Checklist: NAV-06, CPY-04, LAY-01
- Evidence: before/C07-muscles.png — "Calves 8 sets/week · as planned", "Abs 3 sets/week · as planned"; before/E03-program-3.png — "Calves 8 · below 10", "Abs 3 · below 10"; before/E01-program.png — a third muscle view (Push 29 / Pull 21 / Legs 10 / Core 9 bar) and "NEEDS A DECISION: DB bench press = Stalled"; before/C01-progress.png — "DB bench press = Flat since 7 Aug"; Home sparkline labels say "flat".
- What's wrong: The same muscle gets two verdicts on two tabs, and the same lift gets two status words. A trainee told "as planned" and "below 10" for one muscle stops trusting both. Program's decision list repeats Progress's status list (NAV-06), so Program does two jobs (LAY-01).
- Fix:
1. **Muscles has one home: Progress -> Muscles.** On each row show done vs the Weekly set range, and add the plan tick only when plan ≠ done. Row copy: "Calves · 8 sets/week · below 10–20". Drop "as planned" and "plan N" when they equal done.
2. On Program, delete the "Weekly sets, planned" bar card and the "Muscles, planned per week" body-map card. Replace them with one row: "69 sets a week · Shoulders above range ›", linking to Progress -> Muscles with the Weekly view selected.
3. **One status vocabulary**, defined once in CONTEXT.md and used on every screen: Moving, Ready, Flat, Lowered. Rename "Stalled" to "Flat" on the lift page and everywhere else; "Flat since 7 Aug" is the canonical string.
4. Delete Program's "Needs a decision" section. On Progress, sort lifts whose status calls for action (Flat, Ready) to the top under a plain subheading "Needs a decision (2)". The Swap action stays on the lift page ("Swap for a variation ›", already in before/E13-program-decision-tap.png).
- Acceptance check: For every muscle the Muscles page and every other screen state the same range verdict. No user-facing string says "Stalled". The Program tab contains no muscle chart and no status list.

#### DX-04 · Critical · Program, Programs page, first run, Settings
- Type: Structural
- Checklist: NAV-05, NAV-06, NAV-09, BTN-04, CPY-04, BTN-01
- Evidence: before/E01-program.png — 4 Program controls in the first 150 px (segmented "Program | Exercises", "Edit", "...", "Switch program" select); before/E05-program-more.png — "..." opens Programs with Edit and Copy per Program, "New program" and "Start a deload week"; before/F01-first-run.png — "PICK A PLAN" radio card on Home; before/F05-first-run-program.png — 2 filled "Use this ..." buttons; Settings has only 2 entries (gear on A01 and A02).
- What's wrong: Switching Program has two UIs, editing has two entries, and the deload week (a weekly training decision) and Settings sit behind unlabelled icons (NAV-05: −20 % discoverability). First run asks the same question on two tabs with two controls, and calls a Program a "plan", the word CONTEXT.md reserves for one Exercise's prescription.
- Fix: Rebuild the Program tab top-down as:
1. Title: the Program name "A/B Split" (28 px). Meta: "3× a week · 2 workouts · 69 sets". Header right: text button "Edit". Delete the segmented control, the "..." and the "Switch program" select.
2. Workout A and Workout B as plain lists (DX-16).
3. The muscles row from DX-03.
4. A plain list group with chevrons: "Programs ›" (the E05 page: list of Programs, tap one to make it active, a trailing "Copy" text button, and "New program" at the bottom; remove its per-Program "Edit"), "Deload week ›" (the start/stop deload action with one line of what it does), "Exercises ›" (the E08 library), "Settings ›".
First run: Train shows "Choose a Program" as 2 tappable rows (name + "3× a week · 2 workouts"). Tapping one activates it and reveals Workout A with "Start Workout A". The Program tab's empty state is the same 2 rows (no filled buttons). Delete the "Pick a plan" radio card.
- Acceptance check: At 390x844 the Program tab has 1 header action ("Edit") and no "..." or select. Programs, Deload week, Exercises and Settings are each visible as a labelled row within 2 scrolls. On first run, choosing a Program then logging Set 1 takes 3 taps from Train. The word "plan" appears in no first-run string.

#### DX-05 · Critical · Live Session, Rest
- Type: Cosmetic (styling of the core loop)
- Checklist: BTN-07, LAY-03, H7, Fitts
- Evidence: before/B03-rest.png — "Skip rest" is a 199x64 outlined button; "Log set 2 · 70 × 7" is 151x64 unboxed plain text beside it. 17 tappable elements, none filled.
- What's wrong: During Rest the next thing a trainee does (after the set) is log it. The only control shaped like a button is "Skip rest", which starts no Set and logs nothing, so the habitual tap goes to the wrong control and logging costs 2 taps. This is the most frequent screen in the app.
- Fix: On Rest the Action bar holds one filled primary, "Log set 2 · 70 × 7", full width (358x64), the same as on the Set screen. Remove "Skip rest" from the Action bar. Make the 2:59 ring itself the skip control (it is already a button): tapping it ends Rest, and the caption under "of 3:00" reads "Tap to skip".
- Acceptance check: At 390x844 on Rest, exactly one filled button is visible and it logs the next Set. Log set -> rest -> Log set is 2 taps total with no intermediate tap.

#### DX-06 · Major · Shell on all sub-pages
- Type: Structural
- Checklist: NAV-04, CON-01, CON-03, H3
- Evidence: Tab bar missing on before/A02, C04, C07, C09, C11, D06, E05, E12, B14, G01. Present on before/D07-session-edit.png. Exits: ‹ (C04), "Done" top-right (B12, E05), "Done" filled bottom (D06), X (B11, B13), centred text "Close" (E12), none in the header (D07).
- What's wrong: The trainee cannot predict whether the tab bar will be there or how to leave. On the Session editor the only header is a title; Cancel/Save sit ~2,500 px down (dead end, H3).
- Fix: One rule, applied everywhere:
- **Pushed pages** (lift page, Muscles, Body, Programs, Exercises, Exercise info, Settings, Session detail): keep the tab bar. Header = ‹ back chevron top-left + centred title. No "Done".
- **Editors** (Program editor, Session editor, Log a past workout): full-screen modal without the tab bar. Header = "Cancel" top-left, title, "Save" top-right (bold), as E06 already does. Remove the bottom Cancel/Save row from D08.
- **Pickers and short tools** (exercise picker, Rest time): a sheet with a visible "Close" X top-right and Back support.
- **Live Session**: stays modal, as now.
- Acceptance check: Open each listed pushed page: the tab bar is visible and the only exit is a top-left ‹. Open the Session editor: Cancel and Save are visible at y < 56 without scrolling.

#### DX-07 · Major · Live Session, Exercise tools sheet
- Type: Structural
- Checklist: LAY-01, MOD-03, MOD-02, NAV-09, BTN-04
- Evidence: before/B10-exercise-tools.png — a 735 px sheet behind an icon-only "...": a 2-tab segmented control, 3 warm-up rows, "Add warm-ups", and 6 rows (Set type, Rest time, Swap exercise, Exercise info, What can I lift, Lift history). Rest time opens a second sheet (before/B16-rest-time.png); Swap, Info and History replace it with full pages (B11, B14, B12).
- What's wrong: The train moment needs 2 of these often (Swap, Set kind) and the rest rarely. All 8 sit behind one mystery icon in a sheet that acts as a page, with nested overlays (NN/g overlay overload). Lift history and rep maxes are progress features (NAV-09).
- Fix: Delete the tools sheet. Under the Exercise name on the Set screen, add one row of 3 text buttons, 44 px tall, at 14 px: "Swap", "Notes", "History".
- "Swap" opens the shared picker (DX-08).
- "Notes" opens a short sheet with the Exercise note.
- "History" pushes the lift page (with its Rep maxes section, DX-12).
- Set kind: tapping the current Set chip's corner label cycles Working -> Warm-up -> Drop -> Failure -> AMRAP, and the label shows the kind letter (W, D, F, A) as the Session editor already does.
- Rest time: tap the "of 3:00" caption on the Rest screen to open the Rest wheel. The ±15 s buttons stay.
- Warm-up ramp: the existing "W" chip, which opens its 3 rows inline under the chips.
- Exercise info: a link "How to do it" at the top of the lift page.
Remove "What can I lift" from the live Session.
- Acceptance check: The Set screen has no "..." button. Every former tools action is reachable by a labelled control. Opening any of them never puts two overlays on screen at once.

#### DX-08 · Major · Exercise pickers and Set-entry controls (app-wide)
- Type: Structural
- Checklist: CON-02, NAV-06, BTN-03, MOD-04
- Evidence: 4 pickers: before/B11-swap.png ("Alternatives to Deadlift", 6× "Do this instead", X); before/E14-program-swap.png ("Replace DB bench press in Workout A", same rows, different title); before/E12-add-exercise-picker.png ("Add exercise", centred text "Close", 10× "Pick", "Page 1 of 169" with Previous/Next); before/E08-exercises.png (search list, last Set inline). 3 Set-entry designs: before/B01-live-set.png (±64 px steppers + big value), before/D09-session-edit-set.png (wheel + ± in cards), before/E06-program-edit.png (filled fields).
- What's wrong: One job ("pick an Exercise") is built four ways, and the trainee re-learns it in each place. 169 pages of 10 is unusable for scanning. Repeated per-row CTAs ("Do this instead" ×6, "Pick" ×10) are noise: the row itself should be the target.
- Fix: One **Exercise picker** component, used by Swap (live), Replace (Program), Add exercise (Program editor and Session editor) and the Exercises library:
- Sheet header: title ("Swap Deadlift" / "Add to Workout A" / "Exercises"), X top-right.
- Search field, then "My gym only" filter chip.
- Section "Similar" (when swapping), then "All", as one continuously scrolling list. No pagination.
- Each row: name (16 px) + muscle (14 px grey, no coloured dot) + last Set if any ("62.5 × 8 · 14 Oct"). The whole row is the target. Delete all "Do this instead" and "Pick" buttons.
- Tapping a row does the action and closes the sheet; the Set screen then shows a snackbar "Swapped to Rack Pulls · Undo".
For Set entry, the Session editor reuses the live Set screen's Dial (value + 64 px ± + drag), in a sheet titled "Back squat · Set 3", Cancel/Save in the header.
- Acceptance check: The four entry points open visually identical pickers that differ only in title. No list in the app shows "Page x of y". The Session editor's Set sheet matches B01's Dial block in control layout.

#### DX-09 · Major · Live Session minimised (Home)
- Type: Structural
- Checklist: NAV-06, BTN-01, BTN-06
- Evidence: before/A05-home-during-session.png — 3 controls resume the same Session: top strip "Return", card button "Resume Workout B" (filled), Action bar "Resume" (filled). 2 filled primaries.
- What's wrong: Three ways to do one thing on one screen, with two different verbs, and two buttons competing as primary (Von Restorff).
- Fix: Keep only the strip, moved to sit directly above the tab bar on every tab (thumb zone), 56 px tall: "● Workout B · 00:02 · Rest 2:59" on the left, the text button "Resume" on the right. Delete the "A/B Split / Resume Workout B" card and the Action-bar "Resume". With DX-01 in place, the Train tab under the strip shows the live Workout's Plan list without a Start button.
- Acceptance check: With a Session minimised, every tab shows exactly one Resume control and no filled button.

#### DX-10 · Major · Body and Photos
- Type: Structural
- Checklist: NAV-06, LAY-01, LAY-07, BTN-07
- Evidence: before/C13-body-populated.png — first viewport: Date field, empty Bodyweight field, "Add measurements", Height field, "Save height" (text), "Add photo" (outline), "View photos" (text), filled "Save"; the chart starts at y 475 and the history at y 745 (before/C14-body-populated-2.png). Photos is reachable from 5 places: Progress row (C02), Body "Add photo", Body "View photos", Summary "Add progress photos" (B08), Session editor "Add photos" (D08).
- What's wrong: At the progress moment the trainee wants "is my weight trending down?", and the screen opens on an empty form with a filled Save. Photos is reachable five ways.
- Fix: Merge into one **Body** page (Progress -> Body ›):
1. Headline "84.1 kg · −2.3 kg since 25 Aug" and the Bodyweight/Waist chart first.
2. Action bar: one filled "Log bodyweight". It opens a short sheet with Date (default today), Bodyweight (kg), and an "Add waist" disclosure, plus Cancel/Save in the header.
3. Section "Photos": the latest front/side/back thumbnails in one row, with "See all ›" to the Photos grid and a text button "New check-in".
4. Section "History": the list rows. Each row is tappable and opens the same sheet with "Delete entry" (red text) at its bottom; deleting shows an Undo snackbar.
Height moves to Settings -> "Body" (it is a one-time setting). Delete the "Photos" row on Progress, "Add progress photos" on the Summary and "Add photos" in the Session editor.
- Acceptance check: At 390x844 the Body page shows the chart and latest weight without scrolling and exactly one filled button. Photos is reachable from exactly one place (Body).

#### DX-11 · Major · Sessions, Session detail, Session editor
- Type: Structural
- Checklist: NAV-06, BTN-04, BTN-05, BTN-06, MOD-05
- Evidence: before/D04-session-open-2.png — "Delete workout" (red, icon) and "Share" at the bottom of Session detail, filled "Done" bar, pencil icon-only edit (before/D06-calendar-tap.png); before/D08-session-edit-bottom.png — "Delete workout" red in the same row as "Cancel" and "Save"; before/D07-session-edit.png — 23 "Edit · Delete" pairs, 8 px apart; before/D01-sessions.png — bare "+" for "Log a past workout".
- What's wrong: Deleting a Session is offered twice, once beside Save. Per-Set Delete sits 8 px from Edit, ×23, in the destructive colour (BTN-05). The read-only detail ends in a filled "Done", the strongest style in the app, for an action that just goes back. "+" does not say "past".
- Fix:
- Session detail: header ‹ back (tab bar kept, DX-06), and a text button "Edit" top-right in place of the pencil. Delete the bottom "Done" bar and the "Delete workout" link. "Share" stays as a text button after the totals line.
- Session editor: each Set row becomes one tappable row ("62.5 × 8", chevron) that opens the shared Dial sheet (DX-08) with "Delete set" as red text at its bottom. Deleting a Set or Session happens immediately and shows the snackbar "Set deleted · Undo" / "Session deleted · Undo" for 8 s. Keep one "Delete Session" red text button at the very bottom of the editor, alone on its row, ≥ 24 px below the Note.
- Sessions header: replace "+" with the text button "Log past".
- Acceptance check: "Delete" appears once per Session (editor bottom) and never within 24 px of Save or Edit. Session detail has no filled button. Deleting a Set and tapping Undo restores it.

#### DX-12 · Major · Progress, lift page, What can I lift
- Type: Structural
- Checklist: LAY-07, MOD-03, NAV-06, LAY-05, BTN-07
- Evidence: before/C02-progress-2.png — Muscles, Body and Photos rows start ~1,500 px down, after 14 lift rows; before/C15-what-can-i-lift.png — a sheet with 10 heavy-bordered rows, rows 9–10 below the fold, the Reps field overflowing the viewport; also reached from before/B10-exercise-tools.png.
- What's wrong: The two progress destinations beyond lifts are only found by scrolling past every lift. Rep maxes are a reference table presented as a sheet of buttons, on two routes.
- Fix:
- Progress: under the headline, add a two-row group "Muscles · Shoulders above range ›" and "Body · 84.1 kg, −2.3 kg ›". Then the lift list (needs-a-decision first, DX-03). Delete the bottom Muscles/Body/Photos rows.
- Lift page: replace the "What can I lift ›" link and its sheet with a section "Rep maxes", after Records, as a plain 2-column list (1–10 reps × kg), no borders, from the best recent Set. Add a one-line caption "From 62.5 × 8 on 14 Oct". Drop the editable Weight/Reps fields. Remove the entry from the live Session (DX-07).
- Acceptance check: At 390x844 Progress shows the Muscles and Body rows without scrolling. No sheet titled "What can I lift" remains. The lift page's Rep maxes section has 0 bordered boxes.

#### DX-13 · Major · Sync and sign-in status
- Type: Structural
- Checklist: FDB-05, FDB-06, H1, NAV-09
- Evidence: before/A02-home-tap-card.png — "Not synced · Retry" appears only on the Workout page header; before/A06-retry-sync.png — after tapping Retry nothing changes; before/G07-sync-now.png — after "Sync now", still "Never synced", no message; before/G01-settings.png — "Not signed in" with no Sign in control.
- What's wrong: Sync status lives on a plan screen, is absent everywhere else, and fails silently. The trainee cannot tell whether a Session is safe. "Not signed in" names a problem without offering the action.
- Fix: One status line, in one place: the Sessions header, under the title, 14 px grey: "Saved on this phone · not synced" / "Synced 14:02" / "Sync failed · Try again". Tapping it opens Settings -> Data & sync. Delete "Not synced · Retry" from the Workout/Train header. In Settings, the first row of Data & sync is a button "Sign in to sync" when signed out. "Sync now" shows an inline result under itself within 400 ms: "Syncing…" then "Can't reach the server. Your Sessions are safe on this phone." or "Synced just now".
- Acceptance check: In dev mode (no /api), tapping "Sync now" shows the failure line within 1 s, and the Sessions header reads "Saved on this phone · not synced". No other screen shows sync status.

#### DX-14 · Major · Finish sheet, All view, Summary
- Type: Structural
- Checklist: MOD-05, BTN-05, NAV-06, MOD-04
- Evidence: before/B07-finish-confirm.png — 3 stacked buttons, red "Discard workout" 12 px under "Keep going", handle-only sheet; before/B05-all-view-scrolled.png — a second "Discard workout" 8 px from "Add note"; before/B08-summary.png — Summary of a short Session is ~70 % blank, with "Add progress photos" and "Next: Workout B".
- What's wrong: Finishing a Session is reversible, but it is guarded by a confirm, and the irreversible Discard sits next to the safe choice, reachable twice. The Summary is the Peak-end of the Session and is mostly blank.
- Fix:
- "Finish" in the header finishes immediately when all Sets are logged. When Sets remain, it opens a sheet with title "Finish with 22 sets not logged?", a filled "Finish Session", an outline "Keep going", and an X top-right. Discard is not in this sheet.
- "Discard Session" lives once: as red text at the bottom of the All view, ≥ 24 px below the last action, and it shows a snackbar "Session discarded · Undo" (8 s) instead of a confirm.
- Summary: lead with the comparison line used on Session detail ("1 of 1 lifts beat Monday" / "Short Session: 2 of 23 sets"), then the PR rows, then the lift-by-lift list. Delete "Add progress photos" (DX-10). "Next: Workout B · Friday" stays as the last line. Action bar: "Done".
- Acceptance check: Finishing a fully logged Session takes 1 tap. "Discard" exists in exactly one place and is never adjacent to "Keep going" or "Finish". Discard + Undo restores the Session.

#### DX-15 · Major · Colour (app-wide)
- Type: Cosmetic
- Checklist: TYP-06, TYP-05
- Evidence: before/E06-program-edit.png — green dot = legs (Back squat, Lunges), teal = push, plum = pull, brown = core; before/E12-add-exercise-picker.png and before/B14-exercise-info.png — the same tints on muscle chips. Green also = "Moving"/"up" (C01). Plum also = Workout B, teal also = Workout A (D01). Workout colours off the calendar: before/A01-home.png (A/B row badges, last-Session badge), before/C01-progress.png (mini calendar), before/A02-home-tap-card.png (week strip). Blue = today outline, selected Set chip, Rest ring and active tab.
- What's wrong: A plum dot next to "Assisted pull-ups" reads as "Workout B"; a green dot next to "Back squat" reads as "moving". The Palette says Workout colours are calendar-only and colour only means something (owner rule 4).
- Fix: Remove every Muscle-family dot and chip tint (editor, picker, Exercise info). Muscle names render in grey 14 px text. Restrict `--workout-a`/`--workout-b` to the Sessions calendar cells. Elsewhere, Workouts are identified by their name ("Workout A") with no badge. Keep green = up, orange = down, gold = PR, red = destructive, blue = live/now. Make the active tab ink (not blue) so blue keeps one meaning ("now": today, current Set, running Rest).
- Acceptance check: In a greyscale screenshot of every screen nothing is lost (TYP-07). `--workout-a`/`-b` are used only by the calendar component. No coloured dot precedes any Exercise name.

#### DX-16 · Major · Program tab layout
- Type: Cosmetic
- Checklist: LAY-04, LAY-05, TYP-02, BTN-03
- Evidence: before/E01-program.png / before/E02-program-2.png — Workouts as bordered cards holding 4-column tables (headers 12 px, rows 14 px, "Narrow-grip pull-down" wrapping to 2 lines); 2 outlined "Swap" CTAs; 4 boxes in the first viewport.
- What's wrong: Homogeneous Plans inside cards inside a page, at 12–14 px, is a spreadsheet on a phone. The tables repeat "kg" and "Rest" per column instead of reading as lifter shorthand.
- Fix: Each Workout becomes a section header ("Workout A · 23 sets · ~70 min", 16 px semibold) and a plain list without card or border, one row per Plan: name (16 px) on the left, "4 × 8–10 · 47.5 → 62.5 kg" (16 px, tabular numbers) on the right, rest omitted unless it differs from 1:30 ("· 3:00 rest" in grey). Tapping a row opens the lift page. Delete the column headers and both Swap buttons (DX-03).
- Acceptance check: The Program tab has 0 cards. No text on it is under 14 px. Each Plan is one line at 390 px wide.

#### DX-17 · Major · Program editor
- Type: Cosmetic
- Checklist: LAY-05, BTN-04, NAV-06, FRM-02, GES-01
- Evidence: before/E06-program-edit.png — 4 filled boxes per Plan (Sets, Reps, Rest, Now) ×14 = 56 boxes; ⠿ handle and "..." on each Plan; before/E11-editor-exercise-menu.png — the "..." expands an inline panel (AMRAP toggle, Bodyweight toggle, Weight step, Starting weight, Move up/Move down/Swap exercise, Remove); before/E10-editor-workout-menu.png — Workout "..." holds Move up/Move down/Remove.
- What's wrong: The editor shows every field of every Plan at once (26 tappable, 22 boxes above the fold), and reordering exists twice (drag handle and Move up/down).
- Fix: The editor lists each Workout as a section with Plan rows in the DX-16 format, plus the ⠿ handle on the left for reordering. Tapping a row pushes a **Plan editor** page: Sets (stepper), Reps (two steppers: min, max), Rest (stepper by 15 s), Weight step (select), Starting weight (stepper), "Last set AMRAP" toggle, "Bodyweight" toggle, "Swap exercise" row, and red "Remove from Workout" text at the bottom. Replace Move up/Move down with one text button "Reorder" in each Workout's header, which shows ↑/↓ buttons on every row (the visible twin of the drag handle, GES-01). The Workout header's "..." becomes two text buttons, "Rename" and "Remove".
- Acceptance check: The editor's first viewport has ≤ 8 boxes. Every Plan field is editable with a stepper or select (no free typing for Rest). One reorder mechanism plus its button twin.

#### DX-18 · Major · Touch targets
- Type: Cosmetic
- Checklist: A11Y-01
- Evidence: before/D01-sessions.png — calendar Session cells 40x32 px, 8 px apart; before/G01-settings.png — Reminder weekday chips ~38x26 px; before/B12-lift-history.png — chart points as 16x168 px tappable bars with 0 gap; before/A01-home.png — 14 sparkline buttons 46x44 px, 1 px apart (removed by DX-01).
- What's wrong: 32 px and 26 px targets are below 44 px and invite mis-taps with a sweaty thumb.
- Fix: Calendar cells: keep the visual 40x32 tile, extend the hit area to the full 48x48 grid cell. Reminder weekday chips: 44 px tall, full-width 7-column grid. Chart on the lift page: replace per-point buttons with a horizontal scrub (drag across the chart to read values) with a visible readout above the chart.
- Acceptance check: Every tappable element measured in the DOM is ≥ 44x44 px (chart scrub area excepted).

#### DX-19 · Major · Live Session header
- Type: Cosmetic
- Checklist: FDB-08, TYP-02, BTN-04
- Evidence: before/B01-live-set.png — progress "00:01 · 0/23 sets" at 12 px, grey; header toggle icon "All" (list icon) becomes "Now" (dumbbell icon) in before/B04-all-view.png.
- What's wrong: Sets done/total is the goal-gradient signal and the main Rest-planning cue, yet it is the smallest text on the screen and not readable at arm's length. The toggle changes icon and label, so the control changes meaning under the thumb.
- Fix: Header line 2 becomes "1 of 23 sets · 4 min" at 16 px ink, with a 2 px progress bar under the whole header (filled fraction = sets logged / total, ink colour). Replace the icon toggle with a two-segment control "Set | All" (44 px tall) so the current view is always visible.
- Acceptance check: At arm's length (screenshot scaled to 50 %) the Set count is legible. The view toggle shows both options at all times.

#### DX-20 · Minor · Eyebrow labels and ALL CAPS
- Type: Cosmetic
- Checklist: LAY-06, TYP-03
- Evidence: 12 px uppercase strings: "THU 15 OCT", "LIFTS · 12 WEEKS", "SESSIONS · 12 WEEKS", "REST DAY" (A01); "SINCE 23 JUL · 12 WEEKS", "EST. STRENGTH", "CHANGE" (C01); "THIS WEEK", "WEEK OF 28 SEP" (D02); "NEEDS A DECISION", "WORKOUTS" (E01, E06); "RECORDS", "SESSIONS" (C05); "LIFT BY LIFT", "VS WED 2 SEP" (D03); "NEXT · SET 2" (B03); "MY LIFTS" (E08); Settings group titles (G01). Plus a duplicate date: "Thu 15 Oct" top-right on Progress.
- What's wrong: Caps slow reading, and at 12 px grey they are both shouty and faint. Several repeat what the content already says.
- Fix: Sentence case for all section headers, 14 px semibold ink ("This week", "Week of 28 Sep", "Records", "Lift by lift vs Wed 2 Sep"). Delete the "Est. strength / Change" column headers on Progress (the unit and sign carry it), the date on Progress, and "Next · Set 2" (the card's values say it).
- Acceptance check: `text-transform: uppercase` is used nowhere in the app's CSS.

#### DX-21 · Minor · Empty states
- Type: Cosmetic
- Checklist: FDB-03, CPY-03
- Evidence: before/F04-first-run-sessions.png — "No finished workouts yet. Finish one and it appears here." with no action; before/F03-first-run-progress.png — 5 lines of rules and a "Start workout" button; before/F01-first-run.png — dashed empty sparklines and a blank heatmap.
- What's wrong: The Sessions empty state gives no next step; Progress empty explains the status system in a paragraph nobody reads.
- Fix: Sessions empty: "Your Sessions appear here." + text button "Log a past workout"; the calendar renders with today outlined so the frame is learned. Progress empty: "Your lifts appear here after your first Session." + outline button "Go to Train" (switches tab). Delete the four rule lines (the lift page explains statuses in context).
- Acceptance check: Each tab's empty state has ≤ 2 lines and exactly one action.

#### DX-22 · Minor · Copy and labels
- Type: Cosmetic
- Checklist: CPY-01, CPY-02, CPY-04, BTN-06
- Evidence: "Set 1: reps left" + 0/1/2/3+ chips (B03); "W 30–50 +" chip (B01); "Pick a plan" (F01); "Equipment: barbell · Mechanic: compound · Force: pull · Level: intermediate" (B14); "Workout A"/"Workout B" buttons in "Log a past workout" (D05); "Return" vs "Resume" (A05); "Discard workout" / "Delete workout" (CONTEXT.md: what you did is a Session).
- What's wrong: In-house phrasing and labels-as-values make the trainee read twice. "Delete workout" on a past Session uses the word for the plan, not for what was done.
- Fix: Effort label → "Reps left in the tank?" above the chips, 14 px. Warm-up chip → "Warm-up" with the range under it ("30–50 kg"), no "+". "Pick a plan" → "Choose a Program". Exercise info meta → one line "Barbell · compound · intermediate". Past-workout buttons → "Log Workout A", "Log Workout B". "Resume" everywhere. "Delete workout" → "Delete Session"; "Discard workout" → "Discard Session".
- Acceptance check: No screen string uses "plan" to mean Program, or "workout" to mean a past Session.

#### DX-23 · Minor · Settings layout
- Type: Cosmetic
- Checklist: CON-02, TYP-05, CPY-03, BTN-07
- Evidence: before/G01-settings.png — rows start at x 4 (every other screen at x 16); "Turn on notifications first" + "Add this app to your Home Screen…" above 7 disabled day chips; before/G06-bar-plates.png — 7 red trash icons; "Reset to defaults" as plain text; before/G02-settings-2.png — "How to set it up" underlined link next to an outlined "Set up Apple Health" button.
- What's wrong: The off-scale gutter makes Settings look like another app. Red repeated 7 times is no longer a signal. Disabled controls with two hint lines show something that cannot be used.
- Fix: 16 px gutter like every page. Reminders, when unavailable: one row "Reminders · Add to Home Screen to turn on ›" opening a short how-to; hide the disabled chips until available. Bar and plates: a pushed page; each plate row has a stepper for pairs (0 removes it), no trash icons; "Reset to defaults" at the bottom as text. Apple Health: one row "Apple Health ›" (setup + how-to on the pushed page).
- Acceptance check: Settings' first viewport has 0 disabled controls and 0 red icons, and its left edge aligns with every other page at 16 px.

#### DX-24 · Minor · Live Set screen spacing and Set chips
- Type: Cosmetic
- Checklist: LAY-05, BTN-07, Prägnanz
- Evidence: before/B01-live-set.png — an empty band ~130 px tall between the Set chips (bottom y 197) and the weight Dial (top y 331); the dashed Set chips 1–3 are not buttons (absent from the DOM's tappable list).
- What's wrong: The Dial sits lower than it needs to, and the band reads as a missing element. Dashed boxes that look tappable but are not are a false affordance.
- Fix: Close the gap so the weight Dial starts 24 px under the chips; use the freed space for the Swap/Notes/History row from DX-07. Make the Set chips tappable (jump to that Set), or render pending chips as plain grey text without a dashed border.
- Acceptance check: Vertical gaps on the Set screen are ≤ 32 px. Every bordered chip is tappable.

---

## 5. Top 5 (value for the trainee per unit of effort)

1. **DX-05**: make "Log set" the one filled button on Rest. One component change on the most-used screen.
2. **DX-01**: Home becomes Train (the A02 page in the Shell). Mostly deletion, and it fixes the first screen, a duplicate dashboard and an orphaned page at once.
3. **DX-02 + DX-03**: delete the extra calendars and muscle views, and adopt one status vocabulary. Deletion plus a string rename; it ends the contradictions.
4. **DX-09**: one Resume strip. Two deletions.
5. **DX-04**: Program tab rows for Programs, Deload week, Exercises and Settings, without the select, "..." and segmented control. Reorganises existing pages; no new screens.

---

## 6. What works (keep list)

- Launch -> first Set logged in 2 taps; "Log set 1 · 60 × 10" carries the values on the button.
- The Preset and "Last time 60 × 10 · Mon 12 Oct" under the Dial (recognition, not recall).
- 88 px Dial values and 64 px ± steppers on the live Set screen.
- Plate line "Per side: 20 on a 20 kg bar" and the warm-up ramp with per-side plates.
- Rest: the big countdown ring, ±15 s, and the next-Set card ("Add 5 per side -> 20 + 5 · PR at 9 reps").
- The Workout page's change note ("Same as Monday, except curls move up to 15 kg") and "was 14 kg".
- The colour-coded Sessions calendar with a letter in every cell and today outlined (passes TYP-07).
- Sessions history as a plain list grouped by week, with Deload marked.
- Progress headline "12 of 14 lifts are moving" plus one sentence of why: answer-first.
- One lift-page component reused from Progress, Exercises and the live Session.
- Lift page "Next time: 62.5 kg × 9" with its reason, and the shaded deload band on the chart.
- Gold used only for PRs.
- Session detail "5 of 7 lifts beat Friday. Four records. Push-ups dipped." with per-lift deltas; the post-finish Summary reuses it.
- Live Session as a modal over the Shell with a minimise, and the status strip "Workout B · 00:02 · Rest 2:59".
- Program editor with Cancel/Save in the header.
- Swap alternatives ranked by similarity, with search.
- Exercises library rows with the last Set and date inline.
- Session editor with a Deload toggle and Set-kind letters (W, D).
- Export, Import and "Import from Strong or Hevy" visible in Settings (no obstruction).
- No measured text contrast under 4.5:1 on the main screens.

---

### Footnotes (bugs, not verdicts)

- What can I lift sheet: the Reps field overflows the viewport (x 272 -> 516 px) at 390 wide (before/B13-what-can-i-lift.png).
- The Summary after a 2-Set Session shows "0 min" (before/B08-summary.png).
- Tapping the big weight value on the live Set screen did not open a keypad in headless Chromium (before/B17-weight-keypad.png). Not checked on a device.
- The original walk's A03/A04 shots duplicate A02. D06 was reshot by tapping a calendar cell, and B08/B09, D05 and E05 were reshot after the failed scenarios.
