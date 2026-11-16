# Competitor research: what each phase shows, and how it looks (2026-11)

**Question.** The gap in WorkoutTracker is not features. It is the visuals, the design language, and
the choice of *what to show in which phase of use*. How do the leading loggers handle that?

**Method.** I looked at the App Store screenshot galleries of Strong, Hevy, Fitbod, Apple Fitness,
Alpha Progression and Setgraph, rendering each at full size in the built-in browser. I read vendor help
pages and feature pages, plus third-party reviews. No sign-ins, no downloads. Store galleries show
marketing states, not every real screen. Where a claim rests on a screenshot I mark it **(seen)**. Where
I could find no public source, I say so and do not guess. Several third-party "reviews" are written by
competitors or carry affiliate links, and those are flagged. Boostcamp's App Store page returned HTTP 429
(rate limited), so it and Liftosaur are covered from their own sites only. Fitbod's blog and help
centre refuse automated fetches (403), so one Fitbod page was read in the browser.

Screens I captured for reference are in `shots/` (store screenshots rendered locally, not downloads).

Sources are numbered `[S#]` and listed at the end.

---

## 1. Strong

**Feel in one line:** a white spreadsheet with one blue accent and green "done" rows. It is the
reference for "stays out of the way".

| Phase | What is on screen, top to bottom |
|---|---|
| 1. Opening / today | A Start Workout tab: an empty-workout option, then template cards (folders, duplicate, drag to reorder) [S3]. The free tier caps you at 3 custom routines [S1][S2]. Reviewers say the first screen "could feel slightly empty for a new user" [S3]. |
| 2. At the bar | **(seen)** [S1] A bottom sheet with a grab handle. Top row: a small timer-icon button on the left and a green or blue **Finish** pill on the right. Then the workout title in bold (e.g. "Afternoon Workout"), the elapsed time, and a grey "Notes" line. Each exercise is a blue link-styled name with ⋯ and a link icon, and an optional yellow pinned note ("Watch back rounding"). Below that, a 5-column table: **Set · Previous · kg · Reps · ✓**. "Previous" is grey text ("100 kg × 3"). The kg and reps cells are light grey pills holding a placeholder copied from Previous. A completed row turns **pale green** with a filled green check. Then a "+ Add Set" pill. Reviewers count "three taps" per set and call the Previous value "the most important feature in any strength app" [S2]. A per-exercise header chip shows the volume ("384 kg"). Set tags: W (warm-up, orange), D (drop), F (failure) **(seen)**. |
| Plate / warm-up help | **(seen)** A "Warm-up Sets" modal: you enter the work set (70 kg), and a table shows Set / Formula / Warm-up ("Bar × 5", "50% × 3 → 35 kg × 3"), with an **Insert** action [S1]. The plate calculator is "maybe the best feature" in one user's words, though it supports only standard bars [S1]. |
| 3. Rest | **(seen)** A centred card titled "Rest Timer" with one line of explanation, a big thin **blue ring** around large digits **0:45**, the configured total (0:30) in grey below, and then **−30s · +30s · Skip** (Skip in solid blue) [S1]. The timer starts automatically on ✓ and can be set per exercise [S2]. Live Activity / Dynamic Island rest timer since 6.5.0 [S1]. |
| 4. PR in-workout | No public material describes a live PR banner in Strong. PRs live in the statistics and exercise pages [S1][S4]. |
| 5. After | No public source describes the finish screen, so I don't. Workout sharing is listed as a feature [S4]. |
| 6. History | A History tab that lists every session with sets, reps, weight and volume. Per-exercise history goes back to the first session ("where Strong earns its reputation") [S2]. Calendar and activity home-screen widgets arrived in 6.4.1 [S1]. |
| 7. Progress | **(seen)** A Profile tab: avatar, name, workout count ("126 workouts completed"), then cards. A "Workouts Per Week" lilac bar chart and a "Bench Press Chart" with a thin lilac line and hollow dot markers [S1]. The exercise detail is a modal with segmented tabs **About · History · Charts · Records** [S1]. Volume and 1RM progression charts exist, and the advanced ones carry a crown icon and sit behind the paywall [S1][S3]. |
| 8. Planning | Template editor with supersets, folders, duplicate and drag [S3]. A reviewer gives the routine builder 5/5 [S2]. |

**Design language.** iOS-system look: white surfaces, SF type, one blue accent for links and Finish,
green only for completed sets, grey placeholders **(seen)** [S1]. Dark mode and custom themes exist [S4].
The density is high but tabular. Strong markets itself as "designed to stay out of your way" [S4], and
the watch app is called "the cleanest Apple Watch interface we've tested" [S5].

**Praise / complaints.** Praise: simple and intuitive, watch logging without the phone, the plate
calculator [S1], and the auto rest timer [S2]. Complaints: the 3-routine free limit and the price
[S1][S2], a rigid exercise database [S1], occasional glitches [S1], and post-update bugs plus "abandoned"
sentiment in 2025 [S36]. Its UI is called "dated" by a competitor's Reddit round-up [S34], which is
competitor-authored.

---

## 2. Hevy

**Feel in one line:** Strong's table plus a social network and many stats. It uses a white or black
canvas with one saturated **blue**.

| Phase | What is on screen, top to bottom |
|---|---|
| 1. Opening / today | **(seen)** [S6] Two tabs matter. **Workout**: "Quick Start" with "+ Start Empty Workout", then "Routines" with **New Routine / Explore** buttons, then a collapsible "My Routines (6)". Each routine is a card: bold title, a grey one-line list of exercises, and a full-width **blue "Start Routine"** button. **Home** is a social feed: post header (avatar, name, "2 hours ago"), workout title with emoji, Time / Volume, an exercise list with thumbnails ("3 sets Bench Press (Barbell)"), likes and comments, then a "Suggested Athletes" carousel [S6][S14]. A "View Report" button for the monthly report also sits on Home [S13]. |
| 2. At the bar | **(seen)** [S6] Header "Log Workout" with a clock icon and a blue **Finish** button. A stat strip: **Duration 1h 15min · Volume 6 800 kg · Sets 18** (labels in small blue, values in black). Each exercise card has a thumbnail, a blue exercise name, ⋯, a free-text note ("Feeling strong today! Next session increase the weights…"), and a blue "⏱ Rest Timer: 1min 30s" link. Then rows **SET · PREVIOUS · KG · REPS · ✓**. Previous is grey ("40kg × 7"). A done row fills **light green** with a green check, then "+ Add Set". You can **tap a Previous value to copy it** into the row [S7], and the source of Previous is configurable (any session vs. same routine) [S7]. Set types: warm-up, drop, failure, supersets [S6]. Has RPE [S6]. |
| 3. Rest | A **bottom overlay bar** over the workout list while resting, plus a full timer modal with a circular dial, ± buttons and Start, and a stopwatch mode in a segmented control [S14]. Per-exercise default rest is shown inline as "Rest Timer: 1min 30s" **(seen)** [S6]. |
| 4. PR in-workout | When you tick a set that beats a best, "you're presented with a banner" [S8]. PR types: 1RM, heaviest weight, best set volume, most reps, best duration [S8]. A **medal appears on that set** and in the saved workout [S9]. There is a PR sound and volume setting [S14]. No PR fires on the first log of an exercise [S9]. |
| 5. After | A summary with Duration / Volume stats, a row of share options and Done. Then a "Save Workout" form: stats, notes, photo, **visibility (public/private)** and Save [S14]. Hevy auto-generates several shareable cards (PRs, volume, a muscle-distribution chart, consistency/streak, and a playful comparison: "You lifted a total of 13 264 kg… That's like lifting a truck!"), each in light, dark or transparent [S10]. Since 3.2.0 you can send the workout to ChatGPT or Claude from the finish screen [S6]. |
| 6. History | Profile shows recent workouts. A **Calendar** shows workout days as **blue circles** (tap to open), with year and multi-year views and a streak counted in **consecutive weeks** with at least one session [S11]. |
| 7. Progress | **(seen)** [S6] Per-exercise page: tabs **Summary · History · How to · Leaderboard**. A front-facing 3D anatomy figure with the primary muscles in red. The name, "Primary: Quadriceps", then a headline value "**80 kg** Jan 31" with an "All time ▾" range dropdown. A **blue stepped line with dots** on a faint grid. Under it, pill chips **Heaviest Weight** (filled blue) · One Rep Max · Best… [S6]. Range options: 3 months, year, all time, with history beyond 3 months behind Pro [S12]. Then Records, Set Records (best weight per rep count), and **Strength Level** (Beginner→Elite against peers) for squat, bench and deadlift [S12]. Statistics: a last-7-days body graph, set count per muscle group (weekly/monthly), muscle distribution as a **radar chart**, and a body map in blue [S11][S14]. A **Monthly report** in this order: overview numbers → a comparison graph vs previous months → records (tappable) → workout days → muscle distribution vs last month → sets per muscle → top exercises → share [S13]. Year in review in December [S11]. |
| 8. Planning | Routine builder, folders, an "Explore" library. Hevy Trainer program builder in Pro [S6]. Measurements: progress photos side by side and a body-weight line chart with chips (Bodyweight / Bodyfat % / Chest…) **(seen)** [S6]. |

**Design language.** **(seen)** [S6] Mostly white with black type, one saturated **blue** for every
action, link and chart, and green only for completed sets. The cards are flat with hairline separators,
and small exercise thumbnails use 3D illustration. A dark theme is available [S14]. "Liquid Glass"
navigation arrived in 3.1.x [S6]. Charts use one series, one colour, with pill chips to switch metric.

**Praise / complaints.** Praise: "great interface", easy, exercise videos, body-part volume analytics,
lifetime purchase [S6], "good graphics to track progress" [S37]. Complaints: Pro paywall on history
and analytics [S12][S34], volume quirks for bodyweight moves [S6], and PR types that confuse on
assisted exercises (help docs concede it) [S9]. The claim that Reddit lifters see social features as
"bloat" comes from a competitor [S34], so it is weak evidence.

---

## 3. Fitbod

**Feel in one line:** dark, cinematic, a coach that has already decided today's workout. It uses a
**crimson/pink** accent on near-black, with gold for records.

| Phase | What is on screen, top to bottom |
|---|---|
| 1. Opening / today | **(seen)** [S15] A **Workout tab that is already filled in**. "My Plan ›" crumb at the top, then a big italic title "**Push Day**" with "7 Exercises · 3 Muscles" and a crimson **Switch** pill. Filter chips: duration ("45m ▾") and gym profile ("Planet Fitness ▾"). Then the exercise cards: a photo thumbnail, a "FOCUS EXERCISE" eyebrow in pink, the name, and "4 Sets • 7 Reps • 100 lb". The workout is generated around the **freshest muscles** [S17]. A paywall sits between "workout created" and "workout started" [S16]. |
| Recovery map | **(seen)** [S15] A front-view body silhouette in dark grey with fatigued muscles in **pink-to-red** (quads, abs, chest highlighted). Two big numbers above: "**3** DAYS SINCE YOUR LAST WORKOUT" and "**5** FRESH MUSCLE GROUPS". Recovery is a 0–100% per muscle, it takes "up to 7 days" to recover fully, and it can be edited by hand [S17]. A reviewer said the map "explains the reasoning behind the day's workout" [S16]. |
| 2. At the bar | **(seen)** [S15] A full-screen exercise sheet: a hero photo of the lift, the name "Back Squat" and a "▶ How-To" button. A chip row: "**1:30 rest**", History, Replace, … Then set rows, each with a **hexagon status icon** (a check when done, otherwise the set number), a Reps field and a Weight field ("185" with "Bar + Plates" under it). The active row has white-outlined fields. Then "+ Add Set", **Log All Sets** (outline) and a pink primary action. The watch mirrors it: set dots, Reps / Pounds boxes, a pink "Log Set" [S15]. An exertion rating is asked after each exercise [S16]. Reviewers find it "clean but dense with information" [S16]. |
| 3. Rest | The rest duration appears as a chip ("1:30 rest") **(seen)** [S15]. I found no public description of the countdown UI. |
| 4. PR in-workout | **(seen)** [S15] A celebratory card: a **gold hexagon trophy** with a radial sunburst, "**New Strength Record!**" in white italic, then a dark card "DUMBBELL ROW · Estimated Strength", a giant **47.5** "lbs in 1 Rep", and a pink line chart (Jan–Dec) on a pink grid. Fitbod says milestones appear for new volume PRs or estimated 1RMs [S19]. |
| 5. After | Confetti on the summary, which a teardown calls "a bit generic" and not tied to the session's achievements. Then a **second paywall** framed as "90-day predictions" [S16]. |
| 6. History | A Log tab to review past workouts and results [S17]. Per exercise there is a Results tab with exact sets and records [S19]. A reviewer complains that you can't reach the rest of the app mid-workout, and that there is no single place for PRs [S15]. |
| 7. Progress | The headline metric is **"Estimated Strength"**. It was renamed from "Projected 1 Rep Max" **because users found it easier to understand** [S18]. Fitbod's copy sets expectations explicitly: "you should see an upwards trend", "dips sometimes happen", "No one's hitting personal records every time", and it names beginner gains and plateaus [S18]. There is a Muscle Strength score (0–100+, where 50 = the average Fitbod user) and an overall Strength Score averaging push / pull / legs [S19]. **(seen)** "Weekly Set Targets" [S15]: a gradient hexagon ring with **43%** in the centre and a date range, then rows **Push / Pull / Leg Muscles** with "15/30 Sets" and "15 to go". |
| 8. Planning | My Plan: goals, experience, the equipment inventory (very detailed, with checkboxes per item **(seen)**), gym profiles, and an exercise-variability setting (More Consistent / Balanced / More Variable) [S15][S16][S17]. Onboarding has 14 steps, which is "a point of friction" [S16]. |

**Design language.** **(seen)** [S15] A near-black background with photographic heroes, bold italic
condensed headings, one **crimson/pink** accent (plus a pink-red heat ramp on the body), gold only for
records, hexagon motif everywhere (set status, trophy, goal ring), big tabular numerals for the headline
number, and small grey labels in caps. It is premium and dramatic, but busy. Users ask for more
personalisation (themes, sounds) [S15].

**Praise / complaints.** "Took the guesswork out of making progress" (store headline quote) [S15]. Users
"never have to think about what exercises" [S15]. Complaints: the weights it guesses are "wildly off"
for Olympic lifting [S17], a long onboarding and two paywalls [S16], being locked in once a workout
starts, and no single PR view [S15].

---

## 4. Apple Fitness (iPhone) + Workout (Apple Watch)

**Feel in one line:** black canvas, neon ring colours, giant rounded numerals. It is about effort and
consistency, not sets.

| Phase | What is on screen |
|---|---|
| 1. Opening / today | **(seen)** [S20] Fitness on iPhone has the tabs **Summary · Fitness+ · Workout · Sharing**. The Workout tab is a vertical list of large dark cards, one per activity type: a lime outline icon, a name ("Outdoor Walk"), a lime **▶ play circle** top-right, and three small buttons (music / Workout Buddy / goal). On the watch in watchOS 26, each workout type has **four corner buttons** (Metrics & Views, Experiences/goal, Workout Buddy & Alerts, Media), and settings persist per workout type [S22]. Apple calls this the "biggest update to its layout and navigation since its introduction" [S21]. |
| 2. At the bar | The watch shows a few metrics per view (4 by default, a 5th can be added). The Digital Crown scrolls views, and a double-tap marks a segment [S23]. Fewer metrics means larger text [S39]. **Traditional Strength Training records time, HR and calories, not sets, reps or weight.** Per-rep and per-set logging is still only a rumour as of the latest reports [S27]. |
| 3. Rest | No rest concept for strength. Workout Buddy gives spoken updates and encouragement during the workout. It supports Traditional and Functional Strength [S21][S22]. |
| 4. Feedback | Workout Buddy speaks comparative stats ("That was your longest run of the last 28 days") and congratulates you [S21]. Awards are badge medals for personal records, streaks and milestones, including progress toward unearned ones [S20]. |
| 5. After | Strength workouts get no automatic load estimate. You rate **effort 1–10** with the Crown at the end or later [S24]. Summary data per workout (pace, route, etc.) appears in the Summary tab's Sessions card [S20]. |
| 6. History | **(seen)** [S20] Summary is a **2-column grid of dark tiles**: Activity Rings (three concentric red/green/cyan rings with "665/750 CAL", "72/30 MIN", "4/12 HRS"), Step Count with a mini bar chart, Step Distance, **Sessions** ("Outdoor Run 6.21 MI"), and **Awards** (a 3D medal "New Move Record"). The Summary tab is reorderable and can be personalised [S20][S26]. |
| 7. Progress | **Trends**: up/down arrows comparing the last 90 days with the last 365, with "encouraging message if your trends are up, or personalised coaching if trends are down" [S25][S26]. **Training Load**: a 7-day vs 28-day comparison with one-word verdicts ("Below", "Steady"), and a flag plus rest suggestion when the load is well above normal [S24]. |
| 8. Planning | Custom and goal-based workouts. Fitness+ "Plans": cards with a big gradient, "Stay Consistent", "3 DAYS • 40MIN / DAY", "Plan Preview" **(seen)** [S20]. |

**Design language.** **(seen)** [S20] Pure black, each metric has its own **semantic colour** (Move red,
Exercise lime/green, Stand cyan), and the numbers carry the colour, not the labels. Headline numbers are
in SF Pro Rounded at large sizes, with the units as small caps suffixes ("CAL", "MI"). Tiles have rounded
corners and no borders. A lime primary button. Copy is short and warm.

**Praise / complaints.** The Fitness app sits at **2.9★** on the US App Store [S20]. Users of the watch
want real set and rep logging, which Apple lacks [S27].

---

## 5. Secondary apps (brief)

- **Alpha Progression** — **(seen)** [S29] Dark navy UI with a blue accent. *At the bar:* columns
  **# · LB · REPS · 10RM ✓**. The **next set is a highlighted blue row with a target icon** ("220 × 8,
  209"), the recommendation. Below the table is a compact "Yesterday" mini-table of last session's sets.
  The listing promises a weight and rep target per set [S29]. *After:* a **gold star with a session
  score (71)**, then "66th workout · 0:55 hours · 9w streak", then each exercise with small **up/down
  arrows** showing whether it progressed, then muscles with % share and set counts. *Planning:*
  Push/Pull/Legs/Upper tabs and a front/back body thumbnail per day.
- **Setgraph** — **(seen)** [S30] Black with **neon green** (better) and amber/orange (values). *At the
  bar:* a custom bottom keypad with **plate-increment keys (+1, +2.5, +5, +10, +25, +45, +100)**, rep
  −/+, inline chips (Label, gym "Home", LB, Now) and a full-width green ✓. *Above it:* "**COMPARED TO
  PREVIOUS**" with four colour-coded deltas (Sets, Reps, Volume, lb/rep), each "▲ 280 (28%)". *Progress:*
  an orange **step chart** of the best set with "Last 2 Sessions / All", and a 1RM tab with a %-of-1RM
  table (80% → 180 lb highlighted). *Body:* a front/back figure, **red = just trained, green = rested**,
  with "1 hr, 12 min ago" per muscle.
- **Boostcamp** — a **PR badge appears on the set** when you tick it. A Records tab has a "Best
  Performance" table for every rep count 1–12. Charts for e1RM, volume and best set have daily, weekly or
  monthly granularity, and you can **reset the PR baseline** after a break [S31]. Program cards show
  creator, level, days/week, rating and users [S31].
- **Liftosaur** — programs are written as text ("Bicep Curl / 3x10 / 12"). Built-in linear, double and
  rep-sum progressions adjust the program after each workout. Analytics show weekly volume per muscle,
  **prescribed vs completed**. Users praise "simple and nice to look at" but also "UI could do with a
  polish", and they asked for dark mode [S32].
- **JEFIT** — 4-tap watch logging, "UI isn't the prettiest… function over form" [S5].
- **Gravitus** — social-first and fast. Its most consistent complaint is PR detection that "seems to
  have a mind of its own" [S33].

---

## 6. Synthesis: phase → what the best app shows → why it works

| Phase | Best in class | What it shows | Why it works |
|---|---|---|---|
| 1. Opening / today | **Fitbod** (with Strong/Hevy for owner-planned programs) | Today's workout already chosen: title, "N exercises · M muscles", the exercise list with set×rep×load, and one primary Start. Context in two numbers ("3 days since last workout", "5 fresh muscle groups") [S15]. | It answers "what do I do now?" before the user asks, with a one-tap path. The two numbers justify the choice without a chart. |
| 2. At the bar | **Strong / Hevy** table, **Alpha Progression** target row, **Setgraph** keypad | One row per set: Previous (grey) → today's kg/reps prefilled → ✓. The row turns green when done. The next set is highlighted as a target [S1][S6][S29]. Plate-increment keys for input [S30]. | Previous-in-row removes memory work. Prefill turns logging into "confirm" (3 taps) [S2]. The target row tells you what to beat. Plate keys match how you actually load a bar. |
| 3. Rest | **Strong** | Auto-start on ✓, a big ring with a countdown, the total under it, then −30 / +30 / Skip. Per-exercise default. Lock-screen Live Activity [S1][S2]. | One glance gives time left. Adjustments sit at thumb height. It survives the phone being locked. Best practice also shows *what's next* under the timer [S28]. Strong doesn't, which is a gap worth beating. |
| 4. PR moment | **Hevy** (banner + medal on the set) / **Boostcamp** (badge on the set) | A small banner at the moment of ✓ plus a persistent medal on that row [S8][S9][S31]. | It is contextual and attached to the set that earned it. Fitbod's full-screen trophy is more dramatic but heavier [S15]. |
| 5. After | **Alpha Progression** (per-exercise ↑/↓) + **Hevy** (records, then share) | Score/count/streak first, then each exercise marked progressed or not, then muscle split [S29]. Hevy: duration/volume → PRs → optional share cards [S10][S14]. | It answers "was that a good session?" per lift, not with generic confetti (which reviewers call "generic" [S16]). |
| 6. History | **Hevy** calendar + **Strong** list | Calendar dots (tap for the day), streak counted in weeks, a chronological list of sessions with sets [S11][S2]. | Weekly streaks forgive rest days. The calendar gives a consistency overview, and the list gives detail. |
| 7. Progress | **Fitbod** framing + **Hevy/Setgraph** per-lift page | One plain-language headline metric ("Estimated Strength", renamed for comprehension) [S18]. Per lift: a headline value + date, one line or step chart, metric chips, a range selector, then Set Records by rep count [S6][S12][S30]. Trends as ↑/↓ arrows with coaching copy [S25]. A one-word load verdict [S24]. | It leads with the verdict, then the evidence. Copy that sets expectations ("dips happen", plateaus) stops a flat line from reading as failure [S18]. |
| 8. Planning | **Liftosaur** (power) / **Fitbod** (constraints) / **Hevy** (cards) | Routine cards with title, exercise preview and Start [S6]. Prescribed vs completed per muscle [S32]. Weekly set targets as "15/30 sets, 15 to go" [S15]. | Planning is shown as progress toward targets, not as a form. |

## 7. The 10 patterns most worth borrowing (calm app, one serious lifter)

1. **Previous value inside the set row, prefilled into today's fields.** Logging becomes confirming, and
   a tap on Previous copies it [S2][S7].
2. **Highlight the next set as a target row** (load × reps to beat), with last session as a small
   secondary reference under the table, as Alpha Progression does [S29].
3. **Row state is the feedback:** a done set turns a soft tint with a filled check, and nothing else
   moves [S1][S6].
4. **Auto-starting rest with one big countdown, total underneath, −/+ and Skip at thumb height**, and a
   lock-screen presence [S1]. Add the **next set** under the timer (Strong lacks this) [S28].
5. **A PR attached to the set:** a small medal or badge on the row, and a one-line banner at most. No
   full-screen takeover mid-workout [S8][S9][S31].
6. **Post-workout = per-lift verdicts first** (↑ / = / ↓ against last time), then totals. Share stays
   optional and secondary [S29][S13].
7. **One plain-language headline metric per lift**, named for meaning ("Estimated Strength", not
   "Projected 1RM"), as headline number + date + one chart [S18][S6].
8. **Explanatory copy that sets expectations** for dips and plateaus, and up/down trend arrows with a
   one-line coaching sentence instead of more charts [S18][S25][S24].
9. **Semantic colour, one accent:** one action colour, one "better" colour, gold reserved for records.
   Colour sits on the numbers, not the chrome [S20][S30][S15].
10. **Consistency as weeks, not days** (a streak of weeks with at least one session), shown as a quiet
    calendar of dots you can tap into [S11].

Honourable mentions: plate-increment input keys [S30], a set-records table by rep count [S12][S31],
a PR baseline reset after a layoff [S31], and the warm-up ramp as insertable rows [S1].

## 8. Anti-patterns to avoid

- **A social feed as the home screen** for a single lifter. Hevy's Home is a feed with suggested athletes
  [S6], which is noise for someone who trains alone. (That Reddit lifters dislike it is competitor-sourced
  [S34], so treat it as weak.)
- **Generic celebration:** confetti not tied to what happened [S16], or object comparisons ("like lifting
  a truck") [S10] for a serious lifter.
- **Paywalls or upsells at the moment of intent:** between "workout created" and "started", and again
  after the summary [S16]. The same goes for crowned charts in the middle of stats [S3].
- **Peer-ranking labels** (Beginner→Elite against others) [S12]. They shift the frame away from "am I
  getting stronger than me".
- **Opaque composite scores** that need a help article to decode (Muscle Strength 0–100 where 50 = the
  average user) [S19], and session "scores" without an explanation [S29].
- **Too many chart types on one page** (radar plus body map plus bars plus heatmaps) [S14]. Prefer one
  chart with metric chips.
- **Modal lock-in during a workout:** being unable to look anything up until you end it [S15].
- **Unreliable PR detection** destroys trust in the feedback: Gravitus [S33], and Hevy's assisted-
  exercise PRs [S9].
- **Dense, cinematic dark UI** with photo heroes and many chips at the bar. Even its fans call it "dense
  with information" [S16].
- **Long onboarding before the first set** (14 steps) [S16].

---

## Sources

- [S1] Strong — App Store listing, screenshots, release notes, reviews: https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577
- [S2] RepReturn, Strong review (affiliate links): https://repreturn.com/strong-app-review/
- [S3] ScreensDesign, Strong teardown: https://screensdesign.com/showcase/strong-workout-tracker-gym-log
- [S4] Strong official site: https://www.strong.app/
- [S5] JEFIT blog, watch logging apps 2026 (competitor-authored): https://www.jefit.com/blog/best-apps-to-log-sets-and-reps-on-smartwatch-in-2026-top-7-tested
- [S6] Hevy — App Store listing, screenshots, release notes, reviews: https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350
- [S7] Hevy, track exercises (Previous column): https://www.hevyapp.com/features/track-exercises/
- [S8] Hevy, live PR: https://www.hevyapp.com/features/live-pr/
- [S9] Hevy help, PRs and set records: https://help.hevyapp.com/hc/en-us/articles/35649367857175
- [S10] Hevy, shareables: https://www.hevyapp.com/features/shareable/
- [S11] Hevy, gym progress / statistics / calendar: https://www.hevyapp.com/features/gym-progress/
- [S12] Hevy, exercise performance page: https://www.hevyapp.com/features/exercise-performance/
- [S13] Hevy, monthly report: https://www.hevyapp.com/features/monthly-report/
- [S14] ScreensDesign, Hevy screen catalogue: https://screensdesign.com/apps/hevy-workout-tracker-gym-log/?vs=212332
- [S15] Fitbod — App Store listing, screenshots, reviews: https://apps.apple.com/us/app/fitbod-gym-fitness-planner/id1041517543
- [S16] ScreensDesign, Fitbod teardown: https://screensdesign.com/showcase/fitbod-gym-fitness-planner
- [S17] Garage Gym Reviews, Fitbod review: https://www.garagegymreviews.com/fitbod-review
- [S18] Fitbod blog, Estimated Strength: https://fitbod.me/blog/estimated-strength/
- [S19] Fitbod help, strength metrics and scores (read from search-result extracts; page refuses fetch): https://help.fitbod.me/hc/en-us/articles/35065164178327-How-Fitbod-Tracks-Your-Strength-Gains-with-Real-Time-Metrics-and-Scores
- [S20] Apple Fitness — App Store listing, screenshots, rating: https://apps.apple.com/us/app/apple-fitness/id1208224953
- [S21] Apple Newsroom, watchOS 26: https://www.apple.com/ph/newsroom/2025/06/watchos-26-delivers-more-personalized-ways-to-stay-active-and-connected/
- [S22] MacStories, watchOS 26 preview: https://www.macstories.net/stories/watchos-26-the-macstories-public-beta-preview/
- [S23] Apple Support, monitor your workout: https://support.apple.com/guide/watch-ultra/monitor-your-workout-apd72879df4d/watchos
- [S24] iMore, Training Load and effort rating: https://www.imore.com/health-fitness/apple-watch/what-is-training-load-on-watchos-11-the-new-feature-coming-to-apple-watch-that-will-change-your-workouts-forever
- [S25] iPhone Life, Fitness Trends: https://iphonelife.com/content/understanding-fitness-trends-apple-fitness-challenges
- [S26] Wikipedia, Apple Fitness: https://en.wikipedia.org/wiki/Apple_Fitness
- [S27] TechRadar, Apple Watch strength-logging rumour: https://techradar.com/health-fitness/smartwatches/im-sick-of-my-apple-watchs-workout-app-lacking-this-key-fitness-feature-but-a-new-apple-watch-ultra-4-rumor-suggests-it-could-finally-catch-up-with-apps-like-smartgym
- [S28] ScreensDesign, rest timer UX patterns: https://screensdesign.com/articles/workout-app-rest-timer-controls-ux/
- [S29] Alpha Progression — App Store screenshots and listing: https://apps.apple.com/us/app/gym-workout-alpha-progression/id1462277793
- [S30] Setgraph — App Store screenshots and listing: https://apps.apple.com/us/app/setgraph-gym-workout-tracker/id1209781676
- [S31] Boostcamp, personal records: https://www.boostcamp.app/features/personal-records
- [S32] Liftosaur official site (incl. user quotes): https://www.liftosaur.com/
- [S33] Gravitus reviews (Product Hunt; via search extracts): https://www.producthunt.com/products/gravitus/reviews
- [S34] Setgraph blog, Reddit round-up (competitor-authored): https://setgraph.app/ai-blog/best-workout-tracker-app-reddit
- [S36] unitQ, Strong quality scorecard: https://unitq.com/unitq-scorecards/strongworkouttracker
- [S37] Garage Gym Reviews, Hevy: https://garagegymreviews.com/equipment/hevy
- [S39] Apple Support, customize workout views: https://support.apple.com/guide/watch/apd6b0679060/watchos
