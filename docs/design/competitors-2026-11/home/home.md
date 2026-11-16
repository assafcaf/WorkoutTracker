# Home: the landing dashboard (2026-11)

**Author:** Dana Reyes (design lead persona). **Brief:** the owner approved the Ledger & Instrument
proposal (`../study.md`, `../proposal/`) with one change: the app needs a landing page that is not one of
the four views. It should be a dashboard with pleasing visuals, little text and no crowding.

**Files:**
- `index.html`: self-contained, 390 × 844 per state. It loads the repo's own Geist from `src/assets/fonts`.
- `01-a-training-day.png`, `02-b-rest-day.png`, `03-c-after-a-break.png`, `04-d-after-a-workout.png`,
  `05-e-new-user.png`: one PNG per state, at device scale 2.
- `board.png`: all five states side by side.

**Data:** `scripts/render-states/stats-45.json`, read at each state's own clock (below).

## The answer in three sentences

Home is four blocks, and each one is a picture before it is a number:
1. **Today:** the week as a ring in the A/B colours, plus the one workout to do.
2. **Lifts:** 14 trend lines, each ending in one dot of meaning.
3. **Sessions:** twelve weeks of the A/B calendar.
4. **Last time:** one row.

Every block opens the tab that holds its detail. Start is the only ink bar. Home replaces Train in the
tab bar, so the tabs stay at four: **Home · Progress · Sessions · Program**. Train's list becomes the
workout page that Home's Today block opens.

## 1. The first three seconds

| State | Clock used | The lifter's one question | Home's one answer |
|---|---|---|---|
| (a) Training day | Fri 16 Oct, 07:40 | "What am I doing today?" | **Workout B. One thing changes (curls go up to 15 kg). Start.** |
| (b) Rest day | Thu 15 Oct, 18:05 | "Am I on track this week?" | **Yes: 2 of 3 done, Workout B on Friday.** |
| (c) Back after 3+ weeks | Mon 9 Nov, 07:40 (26 days off) | "Have I lost it, and where do I start?" | **Your lines are where you left them. Do Workout B, eased 10 % for one session.** |
| (d) Just finished, same day | Wed 14 Oct, 19:20 (A ended 18:55) | "Did today count?" | **Yes: the ring moved to 2 of 3, 5 of 7 lifts beat Friday, 4 records.** |
| (e) Brand-new user | First open, no Sessions, no Program | "How do I start?" | **Pick one of three plans. Your first workout is the next tap.** |

**Why the training day is Friday and the rest day is Thursday.** The brief's clock is Thu 15 Oct. But
`stats-45.json` is a Mon/Wed/Fri lifter: all 45 sessions fall on those three weekdays. So Thursday is
honestly a rest day for this person, and Friday is the training day. Both read the same data (Mon 12 Oct
B, Wed 14 Oct A, B due), so every number on (a) matches the proposal's Train screen. The rule that
tells a rest day from a training day is in §4.

## 2. The blocks

Home has at most four blocks, top to bottom, plus the docked bar. Gutter 20 px, blocks 22 to 26 px apart.
The Today block is the screen's one surface panel. The other blocks sit on paper.

### Block 1: Today (the surface panel)

- **What it shows:**
  - a 112 px **week ring** with one arc per planned session. Done arcs are filled in that session's
    workout colour (A teal, B plum). Today's due arc is a dashed `live` arc. Open arcs are `heat-0`.
    The centre reads `2/3` and, under it, "this week";
  - on the right, a 12 px label, a 28 px title and one or two 14 px lines.
- **What it says in each state:**

  | State | Label | Title | Lines |
  |---|---|---|---|
  | (a) | `TODAY` | Workout B | "7 lifts · about 66 min"; `↑ Curls up to 15 kg` in `up` |
  | (b) | `REST DAY` | On track | "Next: Workout B, Friday" |
  | (c) | `WELCOME BACK` | Workout B | "26 days off · loads eased 10 % for today" (no ↑ on a Break) |
  | (d) | `DONE TODAY` | Workout A | "71 min · 23 sets"; `↑ 5 of 7 lifts` and the gold `4 PR` tag |
  | (e) | `PICK A PLAN` | (no title) | three plan rows with a radio each; Full body starter is preselected |

  On a behind-pace week, say 1 of 3 by Saturday, the panel still says "On track" only when it is true.
  Otherwise it says "Next: Workout B" and nothing worse: no red, ever.
- **Where the data comes from:**
  - the ring: `weekStripOf(sessions, program, now, weekStartsOn)` gives `done`, `planned`, and the
    workout and tone of each day;
  - the title and its lines: `dueWorkout()` / `dueWorkoutCard()` and `workoutMinutes()`. The single
    "what changes" line is the first lift of the due workout whose `liftAdvice` is `ready` (this is the
    same fact that heads Train's sentence in the proposal);
  - on a Break: `liftStatus().kind === 'break'` with `daysOff`, and `isEased()`;
  - in (d): `sessionMoves()` for the up count against the last session of the same workout, and
    `sessionPrs(computeRecords(…), id)` for the count of real PRs (`isRealRecord`). A rep best never
    adds to the gold tag.
- **Where a tap goes:**
  - (a), (b), (c): the panel opens the **workout page**, which is today's Train screen pushed over
    Home (sets × kg, "Do Workout A instead", Start);
  - (d): it opens that session's summary (`{ tab: 'history', sessionId }`);
  - (e): the radio rows choose a plan.
- **Empty state:** (e). With no Program there is no ring, only the three bundled programs from
  `src/data/programs/` as rows.

### Block 2: Lifts (one strength-trend visual)

- **What it shows:**
  - 12 px `LIFTS · 12 WEEKS`, and on the right the verdict `↑ 12 of 14 moving ›` in `up`;
  - then two rows of seven 44 × 30 sparklines, Workout A's lifts after an `A` chip and Workout B's
    after a `B` chip, in programme order;
  - each line is grey (`#9FA0A6`). Its end dot is the lift's status colour: `up` green, `flat` ink-3,
    `down` rust;
  - no names, no numbers: the picture says "mostly going up", and Progress names the exceptions.
- **The states:**
  - (d): lifts that set a PR today end in a **gold ring** in place of the dot (squat, lunges, shoulder
    press, push-down). This is the only gold on Home apart from the PR tag;
  - (c): every end dot is grey and the right-hand text is "As you left them". A Break is not a verdict,
    and the lines themselves show the strength is still there.
- **Where the data comes from:**
  - the dots: `liftStatuses(program, sessions, resolve, now)`, which counts `moving` and `ready` as
    moving, `stalled`/`hold` as flat, and `lowered`/`slipping` as down;
  - the lines: `storyPoints(history)` on the lift's `measureOf()` measure (est. strength by
    `estimatedMax()`, the lever for bodyweight lifts), as a 3-session moving average so one off day
    does not zig-zag the line, over the same 12 weeks as Progress.
- **Where a tap goes:** the Progress tab. A tap on one line opens that lift's page (`{ tab: 'lift',
  exerciseId }`); at 44 px a sparkline cell clears the 44 px minimum.
- **Empty state:**
  - (e): one row of seven dashed placeholder lines and "Each lift draws its line after 4 sessions." That
    is the `too new` rule in `liftStatus`.
  - A lift with fewer than 4 sessions shows a dashed line in its slot until it has a verdict.

### Block 3: Sessions (consistency)

- **What it shows:**
  - a 12-week × 7-day grid of 14 px squares, one column per week and Monday on top (`weekStartsOn`).
    A session day is filled in its workout colour, an empty day is `heat-0`, today is a 2 px `live`
    outline, and future days are blank;
  - month labels under the grid;
  - to the right, the count at 44 px (`30`) with "sessions in 12 weeks".
- **Why this and not a streak:** for a three-a-week lifter the grid draws three coloured stripes, so
  the habit is the picture. Gaps (the week of 10 Aug, the single-session week of 14 Sep, the three
  weeks before 9 Nov) read as gaps without any shaming copy.
- **Where the data comes from:** `weeksOf(sessions, now, weekStartsOn)` (or `calendarWeeks()` from
  `sessionsView.ts`, the source the Sessions calendar uses), sliced to 12; each session gets its
  colour from `workoutToneAt()`.
- **Where a tap goes:** the Sessions tab, on its calendar. A tap on a coloured square opens that session.
- **Empty state:** (e) shows the full empty grid with today outlined, a grey `0` and "Every session
  lands here".

### Block 4: Last time (one ledger row)

- **What it shows:** a 56 px hairline row: the workout chip, "Wed 14 Oct · 71 min", then `↑ 5 of 7`
  and the gold `4 PR` tag, then `›`.
  - (c): "Wed 14 Oct · 26 days ago", with no verdict.
  - (d): the Today panel already is the last session, so this row becomes "Next: Workout B · Friday"
    and opens the workout page.
- **Where the data comes from:** the newest finished session, plus `sessionMoves()` and `sessionPrs()`.
- **Where a tap goes:** that session's summary.
- **Empty state:** the row is hidden.

### The dock

| State | Dock |
|---|---|
| (a) | the ink bar `Start Workout B` |
| (b) | the same bar as an **outline**: you can still train today, but nothing is asking you to |
| (c) | `Start Workout B`, which starts with the eased Presets |
| (d) | **no bar**: there is nothing to do |
| (e) | `Start Full body`, which sets the chosen Program active and starts its first workout |

**During a live session**, the minimised live strip stays pinned to the top of Home, as on every tab.
The Today panel becomes the existing **Resume** card (`ResumeCard`), and the dock reads `Resume`. The
live session flow itself is unchanged.

## 3. What I rejected, and why

| Candidate | Why not on Home |
|---|---|
| The muscle week (sets vs the weekly range, body map) | It is a planning question; it lives on Program and Progress → Muscles (study §1.8). On Home it is 14 numbers. |
| Volume KPI tiles (sessions / sets / kg vs last week) | Three numbers that need reading and comparing. The ring and the grid say "consistent" without arithmetic, and volume is the summary's totals line. |
| A streak counter or flame | It punishes the 3-week break that (c) exists to welcome back, and a three-a-week plan has rest days by design. Gaps in the grid are information enough. |
| Today's full exercise list | That is the workout page, one tap away. Home keeps only the one thing that changes. |
| One big est.-strength chart, or an average "strength index" | Across 14 lifts the average is +43 % since 20 Jul, driven by small dumbbell lifts (shoulder press +100 %). That is true and misleading. Fourteen small lines with status dots are honest and still read at a glance. |
| Decision cards (stalled, swap) | Those are actions; they go to Program's "Needs a decision" (study §1.7). Home is a glance, not a to-do list. |
| Records list | Gold appears only as the count of new PRs and the gold end rings in (d); the records themselves live on the lift page. |
| Bodyweight, Apple Health, sync status | Settings and Progress → Body. The cloud appears only on a sync failure, as words (study §1.1). |
| Greeting ("Good morning, Assaf") | Text with no information. The date label does the job. |
| Apple-style three concentric rings | There is one goal here (sessions per week). Three rings would invent two metrics to fill them. One ring segmented by session keeps the A/B colours. |
| Share | It belongs to the summary, as a text link. |

## 4. Rest day or training day

Home needs to know whether today is a training day, and the app does not store a schedule. The rule:

1. If the trainee set **Reminders** (`workoutReminders`), today is a training day when it is one of
   their weekdays.
2. Otherwise, a weekday is a usual day when the trainee trained on it in at least 2 of the last 4
   complete weeks (a new `usualDays(sessions, now, weekStartsOn)`). For `stats-45` that gives Mon, Wed
   and Fri.
3. If neither rule gives any days (a new or irregular trainee), every day is a training day.
4. In all cases:
   - a Session finished today means (d);
   - `daysSinceLastSession ≥ BREAK_DAYS` (21) means (c);
   - a week already at `planned` makes the rest of the week rest days.

A rest day never hides Start. It only drops the bar from ink to outline.

## 5. Navigation: the tab bar to ship

**Home · Progress · Sessions · Program**: Home replaces Train, first and selected on launch.

- **Why not a fifth tab:** Home and Train answer the same opening question ("what am I doing
  today?"). Two tabs for it split the answer and add a fifth thumb target for no new job.
- **Why the workout page needs no tab:** it is a detail of today. Its only exits are Start and Back,
  so it is a page pushed over Home, the same pattern as the Lift page (`{ tab: 'lift' }`).
- **Kept as is:**
  - Start stays one tap from launch (Home's dock);
  - "Do Workout A instead" moves to the workout page;
  - the live Session is still full screen with the tabs hidden, and its chevron still minimises it
    to the live strip on every tab, Home included;
  - the app still opens on the first tab (Home, which is today's `dashboard` landing) when no session
    is live.
- **Icon:** a house outline in the same 1.8-stroke family. The selected tab is `live`, as in the proposal.

## 6. Implementer spec

### Routes and shell

- `src/ui/AppShell.tsx`: `Tab` keeps `'dashboard'` as Home's id, so the stored landing and the tests
  that pin it keep their meaning. Only the label and icon change.
- `src/ui/TabBar.tsx`: the `TABS` entry becomes `{ id: 'dashboard', label: 'Home', icon: 'home' }`.
  Add `home` to `src/ui/icons.tsx`.
- `src/features/routes.ts`: add `| { tab: 'today' }`, the workout page pushed over Home, beside the
  existing `{ tab: 'lift'; exerciseId }`. `{ tab: 'workout' }` keeps meaning "the live session / start".
- `src/App.tsx`:
  - `shown.tab === 'dashboard'` renders `HomeScreen` in place of `DashboardScreen`;
  - a `todayOpen` flag, like `liftOpen`, pushes the existing `DashboardScreen` (Train) as the workout
    page, with a Back header;
  - `destinationOf` gains `today`.

### New feature: `src/features/home/`

| File | What it does |
|---|---|
| `HomeScreen.tsx` | Reads services through `useServiceData`, builds `HomeModel` with `homeModelOf(...)`, renders the four blocks and the dock |
| `homeModel.ts` | Pure. `homeModelOf({ program, sessions, resolve, now, weekStartsOn, reminders, live })` returns `{ state: 'training' \| 'rest' \| 'break' \| 'done' \| 'new' \| 'live', today, lifts, calendar, last, dock }`. It owns `usualDays()` and the state rule in §4, and reuses `weekStripOf`, `dueWorkoutCard`, `liftStatuses`, `storyPoints`, `weeksOf`, `sessionMoves`, `sessionPrs`. |
| `WeekRing.tsx` | An SVG ring of `planned` arcs (filled A/B, dashed live for due, heat-0 for open) with `done/planned` centred. Its accessible name is "2 of 3 sessions this week". |
| `LiftLines.tsx` | Rows of 44 × 30 sparklines, an A/B chip per workout, end dots by status, gold rings for today's PRs. Each line is a button named after its lift. Reuses `src/ui/charts/Sparkline.tsx`, which gains `endTone` and `size` props. |
| `SessionGrid.tsx` | The 12 × 7 grid and its count. It shares its colour logic with `src/ui/CalendarWeek.tsx` (`workoutToneAt` in `src/ui/workoutMark.ts`), so the A/B colours stay the calendar's. |
| `Home.css` | Uses tokens only: `--color-live`, `--color-up`, `--color-down`, `--color-pr*`, `--workout-a/b`, `--heat-0` (step 1 of the proposal's build plan). |
| `homeModel.test.ts` | Covers each state at the five clocks above on `stats-45` (2/3, 12 of 14, 30 sessions, 5 of 7, 4 PR, 26 days), the rest-day rule with and without Reminders, and that a rep best never counts toward the PR tag. |
| `HomeScreen.test.tsx` | Covers each block's tap target (Progress, Sessions, the summary, the workout page), the dock in each state, and the new-user plan pick → Start. |

**Order:** this lands after the proposal's steps 1–3 (palette roles, numerals, status marks), because
it uses their tokens and `StatusMark`/`PrTag`. It is independent of steps 4–12.

**Accessibility:**
- each block is one button with a full sentence as its name, for example "Lifts: 12 of 14 moving.
  Open Progress.";
- the grid is `role="img"` with "30 sessions in the last 12 weeks";
- colour is never the only signal: the ring has its `2/3`, the dots have the header count, and the PR
  ring has the `4 PR` tag.

## 7. Numbers used (stats-45.json)

- **Week of 12 Oct:** Mon B, Wed A, so **2 of 3** (`sessionsPerWeek` 3). Workout B is due (`dueWorkout`
  after A).
- **Twelve weeks to the week of 12 Oct:** **30** sessions, from 27 Jul B to 14 Oct A.
- **Twelve weeks to the week of 9 Nov:** **21**. The last session is Wed 14 Oct, **26 days** before 9 Nov,
  which is ≥ `BREAK_DAYS` 21.
- **12 of 14 moving:** as on the proposal's Progress screen. DB bench press is flat since 7 Aug, and
  narrow-grip pull-down is lowered.
- **Wed 14 Oct A against Fri 9 Oct A:**
  - **5 of 7 up:** squat 60 → 62.5, lunges 12 → 13, shoulder press 11.25 → 12.5, push-down 30 → 32.5,
    and DB bench 13 × 8 → 13 × 9 on set 2;
  - **lateral raises** the same;
  - **push-ups** down (top set 17 → 15).
- **4 PR:** the heaviest weight ever on squat (62.5), lunges (13), shoulder press (12.5) and push-down
  (32.5). DB bench's extra rep is a rep best, not counted.
- **Curls up to 15 kg:** the Ready advice, as on the proposal's Train screen.
- **Workout B:** 7 lifts, 23 sets, about 66 min (`workoutMinutes`).
- **Sparklines:** Epley est. strength per session since 20 Jul. Bodyweight lifts use their lever
  (assistance kg, added kg) and push-ups use top-set reps. Each is drawn as a 3-session moving average.
