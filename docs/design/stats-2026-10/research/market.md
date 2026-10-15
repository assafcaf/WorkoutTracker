# Market research: how the best products show training statistics

Date: 2026-10-15. Scope: **which** stats strength and "data done well" products show, **how** they
chart them, **where** the stats live, and **interaction** (ranges, scrubbing, comparison, filters,
empty states, PR moments). This extends `docs/design/redesign-2026-10/research/market.md` (the UI
scan of 19 apps). That file covers colour, type and logging. This one covers stats only and does not
repeat its visual findings.

---

## 1. Method and confidence

Every claim carries one of three tags.

- **Sourced**: from a product's own help centre, feature page or store listing, or from a review or
  forum, cited inline. Vendor pages describe what the vendor says it ships. They are good for "what
  exists and where" and weak for "how well it works".
- **Measured**: counted or checked here. Only a few claims qualify, such as counting which products
  offer a metric in the catalogue (section 3).
- **Inferred**: from hands-on knowledge of the apps as of 2025-26 and store screenshots, with no
  public page to cite. Marked *(inferred)*. Treat these as likely, not certain.

**Limits of this scan.**
- **Reddit could not be reached.** Both the search tool and the fetcher refuse `reddit.com`. Lifter
  opinion comes instead from the Garmin, intervals.icu and Fast Talk forums, App Store reviews,
  review aggregators, and coaching sites. Section 7 marks how strong each complaint source is.
- **Thin primary sources.** Strong's help centre would not list its articles (404s), and the
  Starting Strength forum returned 403. Strong's chart details therefore rest on a forum quote, a
  store listing, a ScreensDesign capture and inference.
- **Unreliable review copy.** Some review pages contradict themselves. repreturn.com's Strong review
  gives three different prices, and several "Rp Hypertrophy App" pages are syndicated copies. Claims
  from them are flagged as low confidence or left out.
- **JuggernautAI and RP Hypertrophy** publish little about their stats screens. Their entries are
  short and mostly about what they do *instead* of charts.

**Products covered (22):** Strong, Hevy, Fitbod, Boostcamp, Liftosaur, StrongLifts, Alpha
Progression, RP Hypertrophy, JuggernautAI, Gravitus, Setgraph, Caliber, MacroFactor Workouts,
Symmetric Strength, Whoop, Oura, Strava, intervals.icu, TrainingPeaks, Garmin Connect, Apple
Fitness, plus the coaching and spreadsheet community as a "product".

---

## 2. Product by product

### Strength loggers

#### 2.1 Strong: "the per-exercise chart notebook"
- **Stats:** Each exercise has e1RM, best set and total volume over time
  (**sourced**, user on the [Starting Strength forum](https://startingstrength.com/resources/forum/general-programming/73861-graph-visulaization-sets-2.html)
  as quoted in search results; the store listing names "Volume and 1RM Progression" graphs,
  [App Store](https://apps.apple.com/vn/app/id464254577)). Each exercise also has a Records view:
  best e1RM, max weight and max volume, plus a rep-records table giving the best weight at each rep
  count *(inferred)*. The Profile tab has a "workouts per week" bar widget, and the PRO tier adds
  more widgets, such as body-part split and measurements *(inferred)*.
- **Charts:** One line per chart in the accent blue, dot markers and a light grid *(inferred; matches
  the prior scan, section 3.4)*.
- **Where:** Exercise detail opens on one tap and holds instructions, records and charts
  (**sourced**, [ScreensDesign 00:51](https://screensdesign.com/showcase/strong-workout-tracker-gym-log)).
  It is split into tabs: About, History, Charts, Records *(inferred)*.
- **Interaction:** Tap or drag on the line to read a point *(inferred)*.
- **Paywall:** "Advanced charts and analytics carry a crown icon and trigger the paywall"
  (**sourced**, ScreensDesign 01:07).
- **Steal:** the four-way split inside one exercise: what it is, what I did, how it trends, what my
  bests are.
- **Avoid:** crown icons on charts the user can see but cannot open. Teasing locked data reads as an
  advert. The earlier scan flagged Strong's Pro tab for the same reason.

#### 2.2 Hevy: "the broadest free stats, with a time-window paywall"
- **Stats** (all **sourced**, [Hevy gym-progress](https://www.hevyapp.com/features/gym-progress/)):
  - **Profile → Statistics:** a last-7-days body graph; set count per muscle group (weekly, monthly
    or yearly); muscle distribution as a chart (30 days, 3 months, a year or all time) and as a body
    diagram (sets per muscle for the current calendar week, with arrows to step through weeks); and
    "main exercises", the most-logged lifts.
  - **Per exercise:** a Summary with heaviest weight, projected or true 1RM, best set volume, best
    session volume and most reps; Set Records (max weight per rep count); Strength Level (Beginner
    to Elite against age, weight and sex, for barbell squat, bench and deadlift only); and History.
  - **Calendar:** blue workout days, year and multi-year views, and an **active streak counted in
    consecutive weeks** with at least one session.
  - **Monthly Report, in this order:** summary numbers, a top graph compared with previous months,
    the month's records (each opens its workout), workout days, muscle distribution against last
    month, set count per trained muscle, top exercises, share
    (**sourced**, [Hevy monthly report](https://www.hevyapp.com/features/monthly-report/)).
  - **Year in Review** in December
    (**sourced**, [Hevy gym-progress](https://www.hevyapp.com/features/gym-progress/)).
- **Charts:** Per-exercise metric chips switch one line chart *(inferred: "tap different metrics")*.
  Muscle volume is shown as bars, a body diagram in the brand blue and a distribution chart.
  Comparison periods come from a dropdown
  (**sourced**, [Hevy training chart](https://www.hevyapp.com/features/training-chart/)).
- **Interaction:** a range picker (3 months, 1 year, all time); week stepping with arrows on the
  body view; a **live PR notification** as a set is marked done; records on the summary
  (**sourced**, [Hevy exercise performance](https://www.hevyapp.com/features/exercise-performance/)).
- **Paywall:** Free users get every metric, but graphs reach back only **3 months**. A year and all
  time are Pro (about $2.99 a month) (**sourced**, the FAQ on the gym-progress page). Aggregated
  reviews name Pro gating of core progress data as the top complaint
  (**sourced, low confidence**, [marlvel.ai](https://marlvel.ai/apps/com-hevyapp-hevy/vs)).
- **Steal:** the **monthly report as a narrative page**. Its order (totals → trend → PRs → days →
  muscles → exercises) is a good template for a "what happened" summary. Also the **week-based
  streak**, which is honest for a lifter who trains 2-3 times a week.
- **Avoid:** the sprawl. Statistics, Exercises, Measures, Calendar, Monthly Report and Year in Review
  are six entry points for overlapping data *(inferred)*.

#### 2.3 Fitbod: "scores and a recovery body"
- **Stats** (**sourced**, [Fitbod Insights](https://fitbod.me/blog/fitbod-insights-feature/),
  [Fitbod volume and intensity](https://fitbod.me/blog/best-app-for-tracking-weightlifting-volume-intensity-frequency/)):
  - A **Strength Score**: one number drawn from key lifts and volume, which "stabilizes over time".
  - **Benchmark e1RM charts** for squat, deadlift, bench and OHP.
  - **mStrength**, a per-muscle strength measure.
  - A **recovery heat map** (0-100 % per muscle). Tapping a muscle lists the workouts that fatigued
    it.
  - A **Targets tab** with progress bars toward weekly working-set targets, by Push/Pull/Legs or by
    muscle ("quads 6 of 14").
  - A **Workout Report** with totals (workouts, weight, calories, duration) against the prior
    period, for a week, month, 6 months or a year. It is pushed weekly on Mondays and monthly on
    Tuesdays.
- **Steal:** **weekly set targets as fill bars** ("6 of 14"). It is the most actionable volume view
  found: it says what to do this week, not only what happened. Also the muscle tap-through that
  shows *why* a muscle reads as it does.
- **Avoid:** opaque composite scores. Fitbod does not publish how the Strength Score or recovery is
  computed (**sourced**, as noted in the same pages' lack of method). A lifter cannot act on a number
  they cannot decompose.

#### 2.4 Boostcamp: "records free, scores and heat map Pro"
- **Free:** automatic PRs (max weight per rep range, max volume per session, max reps at a weight,
  lifetime bests); an **e1RM curve**; a **weekly Sunday report**; a year-end Wrapped; RPE/RIR stored
  per set "to see fatigue trends across a block"
  (**sourced**, [Boostcamp features](https://www.boostcamp.app/features)). The workout report
  highlights new records
  (**sourced**, [Boostcamp blog](https://www.boostcamp.app/blogs/boostcamp-workout-app-november-features-updates)).
- **Pro:** a Strength Score (0-100 from IPF DOTS across squat, bench, deadlift, OHP and rows); a
  **per-muscle volume heat map** over 7, 30 or 90 days or a year; "advanced exercise analytics"
  (**sourced**, same page).
- **Steal:** **PR types beyond max weight**: rep PRs at a weight, and volume PRs. Lifters on a fixed
  program set these far more often than weight PRs.
- **Avoid:** a Strength Score built on DOTS (a powerlifting total normalised for bodyweight). It
  means little to someone whose program has no deadlift test.

#### 2.5 Liftosaur: "weekly sets per muscle, against a range"
- **Stats:** The web program builder has a **Weekly Stats** panel: sets per week per muscle group,
  coloured by whether each count falls in the recommended range, split into strength and hypertrophy
  sets, with a hover that shows which exercises contribute. It also shows sets grouped by Upper,
  Lower, Push, Pull and Legs, and a graph of each exercise's weekly volume and intensity
  undulation (**sourced**, the public Liftosaur program pages in the search results,
  e.g. [liftosaur.com/p/e7a6b638](https://www.liftosaur.com/p/e7a6b638)). The app's Graphs screen
  lets the user **choose which graphs to show**, covering exercises, bodyweight, volume per muscle
  group and measurements
  (**sourced**, [GitHub README](https://github.com/astashov/liftosaur)).
- **Steal:** **"is this in range?" colouring on a set count**, plus a hover or tap that shows the
  contributors. It is a plan-time view too: it judges the *program* before any training happens.
- **Avoid:** user-assembled graph pages. They put the design work on the user *(inferred)*.

#### 2.6 StrongLifts 5×5: "one graph per program lift, plus a total"
- **Stats:** A **Progress tab** lists the program's exercises, alphabetical unless bookmarked to the
  top. Each opens its own graph, with an **e1RM toggle**. There is a body-weight graph and a
  **Total** (squat + bench + deadlift). Graphs show only exercises in the current program; history is
  kept and returns if the lift comes back
  (**sourced**, [StrongLifts graphs](https://support.stronglifts.com/article/89-graphs)).
- **e1RM rules:** estimated from weight, reps and RPE. It shows **"NA" above 12 reps**, and a fully
  completed 5×5 is assumed to be **RPE 8** (**sourced**, same page and the StrongLifts e1RM article in
  the search results).
- **Steal:** the **program-scoped exercise list** (only lifts you actually do), the pin-to-top
  bookmark, and an e1RM that **refuses to estimate from high-rep sets**. That honesty applies
  directly to our 15-rep accessories.
- **Avoid:** nothing major. The screen is thin: no muscle view and no session-level view.

#### 2.7 Alpha Progression: "stats exist to drive the next set"
- **Stats:** charts for weight, strength rating and volume; records, streaks and achievements; CSV
  export (**sourced**, [AP vs Hevy](https://alphaprogression.com/en/blog/alpha-progression-vs-hevy)).
  An Analysis tab has **customisable charts and timeframes**. "Graphical analytics" are Pro
  (**sourced**, store release notes in the search results). Since v4.9 the user can choose whether
  the logger, the history and the records show **1RM or volume** as the headline metric
  (**sourced**, same).
- **Steal:** **one user-chosen headline metric used everywhere**: logger, history and records agree.
- **Avoid:** customisable charts as the main answer. They imply nobody decided what matters
  *(inferred)*.

#### 2.8 RP Hypertrophy: "feedback, not charts"
- **Stats:** Pump, soreness and workload ratings per muscle drive week-to-week set changes inside a
  mesocycle. MEV/MAV/MRV volume landmarks are "the core mechanic, not a separate view"
  (**sourced, low confidence**, [Boostcamp vs RP](https://www.boostcamp.app/vs/rp-hypertrophy),
  a competitor page). No confirmed description of its progress charts was found.
- **Steal:** volume framed as **"where am I against my landmarks this week"**, not as a historical
  chart.
- **Avoid:** making stats depend on subjective inputs the user must give every session. Our app
  makes effort optional (decision 0014).

#### 2.9 JuggernautAI: "a readiness check, then an adjusted day"
- **Stats:** A daily readiness check rates motivation, sleep, calories and soreness or fatigue from
  1 to 5, plus soreness by muscle. The app adjusts loads from it and from RPE/RIR. For example, it
  dropped a third set after an RPE 10 second set. The dashboard shows how far along the program you
  are and an overview of the week. It "initially feels somewhat overwhelming"
  (**sourced**, [Garage Gym Reviews](https://garagegymreviews.com/juggernautai-review)). An e1RM and
  fatigue dashboard is claimed only by a comparison page
  (**sourced, low confidence**, [FitnessVolt](https://fitnessvolt.com/rpe-training/comparisons/rpe-calculator-vs-juggernautai/)).
- **Steal:** **"where am I in the program"** as the top of the dashboard: week N of M, this week's
  sessions.
- **Avoid:** a dense first-run dashboard.

#### 2.10 Gravitus: "exertion score and overload breakdown"
- **Stats:** charts and graphs; muscle engagement; an **exertion score** for workout intensity;
  exercise progression info. Pro adds unlimited graph history, muscle engagement detail, **real-time
  analytics during the workout** and a **per-workout progressive-overload breakdown**
  (**sourced**, [App Store](https://apps.apple.com/us/app/gravitus-gym-workout-tracker/id965383840)).
- **Complaints:** stats that were once free were moved behind the paywall, and the PR tracker is
  inconsistent: "Sometimes it shows personal records, but usually it doesn't" (**sourced**, same
  listing's reviews).
- **Steal:** **"overload breakdown per workout"**: for each exercise, did today beat last time, and
  on which lever (load, reps or sets).
- **Avoid:** unreliable PR detection. One miss destroys trust in every record.

#### 2.11 Setgraph: "the log is the graph"
- **Stats:** per-exercise analytics comparing sessions by reps, weight per rep, volume and sets;
  "dynamic graphs"; a **choice of 1RM formula** (Epley, Brzycki, Lander, O'Connor or an average); a
  %1RM table; filters on set history by weight or rep range; **green arrows flagging improvements**
  against the pre-filled previous values; a consistency calendar
  (**sourced**, [Setgraph article](https://setgraph.app/articles/setgraph-the-best-workout-tracker-app-for-strength-training-and-progressive-overload),
  [Setgraph 1RM](https://setgraph.app/features/1rm)).
- **Steal:** **inline improvement arrows** on history rows. Each row shows its delta, so the trend
  is readable without a chart. Also filtering history by rep range, so only like-for-like sets are
  compared.
- **Avoid:** a formula picker. Choosing is not a decision the user should make. We fix Epley.

#### 2.12 Caliber: "strength score and balance"
- **Stats:** A Strength Score relative to your potential for age and sex, in five tiers from
  beginner to elite. **Strength Balance** flags over- and under-developed muscle groups. Both are
  paid (Caliber Plus) (**sourced**, [Tom's Guide](https://tomsguide.com/news/forget-chatgpt-this-workout-app-lets-you-text-your-personal-trainer-247),
  [App Store](https://apps.apple.com/NG/app/id1482405410)).
- **Steal:** framing balance as **"which areas are behind"**, not as a full body map.
- **Avoid:** population-normed tiers for a solo lifter on a set program. They answer "how do I
  compare with strangers", not "am I progressing".

#### 2.13 MacroFactor Workouts: "the best-structured dashboard found"
- **Stats** (**sourced**, [MF dashboard](https://help.macrofactorapp.com/en/articles/275-getting-to-know-your-workouts-dashboard),
  [MF exercise performance](https://help.macrofactorapp.com/en/articles/344-viewing-exercise-performance-over-time)),
  as one customisable scroll:
  - **Weekly Workouts:** rings for muscle groups, sets and exercises against this cycle's targets,
    with a toggle for the previous cycle. Swiping shows **Recent Records** (volume, reps, e1RM).
  - **Insights & Analytics:** a Workouts widget charting sets and volume from one week to all
    history, split by external load, bodyweight or mixed, with the top volume contributors.
  - **Habits:** a calendar with streaks.
  - **Muscle Groups:** one tile per muscle with sets or volume for the period.
  - **Exercises:** one tile per exercise with recent load and a **sparkline of the last several
    workouts**.
  - The user can reorder or hide sections.
  - **Per-exercise metrics:** e1RM, **3RM and 10RM estimates**, total volume, best set volume,
    heaviest weight, total reps, best set reps and total sets, each with a time range.
- **Steal:**
  - **Exercise tiles with a sparkline**: the whole program's trend at a glance, one tap to drill in.
  - **Separating load types**: external, bodyweight and mixed are never summed together. That
    matches our exercise kinds.
  - **3RM and 10RM estimates**: an e1RM translated into the rep range the lifter actually trains.
- **Avoid:** three stacked ring sets for "targets". Rings are for daily habits, and they compress
  poorly *(inferred)*.

#### 2.14 Symmetric Strength (a web and Android analyser)
- **Stats:** Each lift is scored from untrained to world-class, adjusted for sex, age and
  bodyweight. It reports strong and weak points and how proportionate the lifts are, with a
  **colour-coded body figure** of strength per muscle group
  (**sourced**, [store listing](https://www.bluestacks.com/campaign/com.hansler.android.symmetricstrength/en)).
  Typical ratios: bench about 63 % of squat and deadlift about 118 % for men, with ±5 % counted as
  balanced (**sourced**, [FitnessVolt strength symmetry](https://fitnessvolt.com/rpe-training/strength-symmetry)).
- **Steal:** balance as **ratios between your own lifts**. It needs no population data.
- **Avoid:** it assumes the big three, and our program has no barbell squat or deadlift test.

### "Data done well" products

#### 2.15 Whoop: "one question per screen, trends on demand"
- **Stats:** Sleep, Strain and Recovery, with weekly, monthly and 6-month trend views. Strength
  Activity Time has a trend view (Feb 2026) and a weekly goal
  (**sourced**, [Whoop trend views](https://whoop.com/thelocker/track-progress-with-new-trend-views),
  [Whoop 2026](https://www.whoop.com/ae/en/thelocker/2026-whats-new/)). Strength Trainer measures
  muscular load, cardio load, **tonnage** and intensity from logged sets
  (**sourced**, [Whoop press](https://www.whoop.com/us/en/press-center/whoop-introduces-strength-trainer-becomes-first-wearable-to-measure-muscular/)).
  A Monthly Performance Assessment plots the strain against recovery balance over 6 months and
  **labels the periods** as overreaching or restorative
  (**sourced**, [Whoop monthly assessment](https://ww2.whoop.com/thelocker/monthly-performance-assessment/)).
- **IA:** The phone shows a brief weekly snapshot. The web app has ranges up to 6 months and a filter
  by red, yellow or green days
  (**sourced**, [Whoop web trends](https://ww2.whoop.com/thelocker/whoop-web-app-training-data-trends/)).
  Three tiers of disclosure: tiles, then a one-question trend, then the deep dive (prior scan).
- **Steal:** **labelled periods**: the chart says what the stretch *was*, not only what the numbers
  were. Also the weekly snapshot by default, with long ranges one step deeper.
- **Avoid:** an opaque proprietary score as the headline.

#### 2.16 Oura: "your own baseline is the axis"
- **Stats:** Readiness and its contributors on 0-100 with named bands (85+ Optimal, 70-84 Good,
  60-69 Fair, below 60 "Pay attention"). Contributors are judged **against your own averages**. The
  app needs **up to two weeks to learn them**, and "long-term" means two months. Trends offer day,
  week, month and year, with three featured trends on top
  (**sourced**, [Oura support](https://support.ouraring.com/hc/en-us/articles/360057791533)).
  Temperature is shown as **deviation from baseline** (**sourced, secondary**).
- **Steal:**
  - **Baseline-relative display** ("+3 % vs your 4-week normal"). Our `VolumeVsBaseline` already
    leans this way.
  - An **explicit learning period**: "needs two weeks of data" is an honest empty state.
  - **Featured trends** chosen by the app above the full list.
- **Avoid:** Neither the scores nor the full list are a problem here. The risk is copying Oura's
  passive tone. Lifters want "what to do".

#### 2.17 Strava (with intervals.icu and TrainingPeaks): "compare ranges, model load"
- **Strava:** A Progress chart at the top of You → Progress shows distance, time, elevation or count,
  with **Compare Date Range** against history, from one week to one year
  (**sourced**, [Strava Progress Summary](https://support.strava.com/hc/en-us/articles/28437860016141-Progress-Summary-Chart)).
  Weekly Relative Effort compares the current week with a **range shaded from the 3-week average**,
  with 12 weeks on mobile. Fitness & Freshness is web-only and subscriber-only
  (**sourced**, [the5krunner](https://the5krunner.com/2025/11/17/strava-relative-effort-guide-tss-2025),
  [road.cc](https://www.road.cc/content/feature/how-use-strava-make-you-fitter-286073)).
- **intervals.icu:** a power curve compared across seasons, plus a Compare tab for periods and
  athletes. Users asked for **season-to-date matching**, because comparing with a whole prior season
  is unfair: it includes later, fitter weeks
  (**sourced**, [intervals.icu forum](https://forum.intervals.icu/t/season-match-like-function/428),
  [Power Curve](https://www.intervals.icu/features/power-curve/)). A bug report shows interpolated
  lines drawn *above* the all-time best where data was missing
  (**sourced**, [forum](https://forum.intervals.icu/t/bug-all-time-best-power-looks-lower-than-current-season/35932)).
- **TrainingPeaks PMC:** CTL, ATL and TSB as fitness, fatigue and form. Coaches criticise it:
  "CTL measures load absorbed, not fitness gained"; a rising CTL can hide falling performance; and
  "between −15 and +5 your body knows more than the chart does"
  (**sourced**, [Fast Talk forum](https://forums.fasttalklabs.com/t/fast-talk-episode178-the-good-the-bad-and-the-ugly-of-chronic-training-load-ctl/3942),
  [Roadman](https://roadmancycling.com/blog/cycling-ctl-atl-tsb-explained-guide)).
- **Steal:**
  - **A shaded "your normal" band** behind this week's bar.
  - **Like-for-like period comparison**: the same weeks of the last block, not the whole last
    block.
  - **Never interpolate** across missing data.
- **Avoid:** load models presented as fitness. Tonnage is *load*. Calling it progress repeats the
  CTL mistake.

#### 2.18 Garmin Connect: "the counter-example"
- **Stats:** a muscle map for Strength activities logged on the watch
  (**sourced**, [Gizmologi](https://gizmologi.id/gadget/wearable/muscle-map-garmin-strength/)).
  Per-set views by muscle exist only on the web, behind a hidden click
  (**sourced**, [the5krunner](https://the5krunner.com/2024/06/23/new-garmin-connect-feature-heading-for-the-app-or-is-it-a-hidden-feature)).
- **Complaints:** no total-weight-over-time per routine; no strength trend graphs or heat maps; no
  PR alerts; "Your strength training has been the same for years"
  (**sourced**, [Garmin forum](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-ios/382451/why-is-strength-training-still-so-bad/1822804)).
- **Lesson:** this is the minimum strength users expect: **per-exercise trend, PR alerts, a trend
  over weeks**. Recording data without showing it angers them.

#### 2.19 Apple Fitness: "trend arrows with a long baseline"
- **Stats:** **Trends** compare the **90-day average with the 365-day average** and show an up or
  down arrow per metric. Up means "maintaining or improving". A down arrow comes with **coaching on
  how to turn it around**. Trends need **180 days** of data before they start. Tapping an arrow
  opens a graph and the daily averages for a typical week
  (**sourced**, [Apple support](https://apple.co/36ggRsf)). Awards cover PRs, streaks and milestones
  (**sourced**, [Apple Watch activity](https://support.apple.com/108359)).
- **Steal:**
  - **The arrow-per-metric summary**: a list of lifts, each with ↑, → or ↓, is the fastest answer to
    "am I progressing, and where".
  - **Pairing a down arrow with advice.** Ours would be suggestion only.
  - **Stating the data requirement.**
- **Avoid:** 180 days is far too long a warm-up for a lifter. We need a useful state from about the
  third session.

### Community and power users

#### 2.20 Coaching and RPE community (in place of Reddit)
- **e1RM is the main long-term signal, and dips around program changes are normal.** Watch average
  RPE and the count of RPE 9+ sets. "A rising e1RM at the same RPE is the clearest signal of real
  strength progress". Change the program if RPE sits at 9+ or e1RM flattens or falls
  (**sourced**, [Progressive Rehab & Strength](https://www.progressiverehabandstrength.com/articles/calculating-and-tracking-rpe-e1rm-for-barbell-strength-training),
  the [RPE calculator site](https://rpetraining.com/strength) quoted in the search results).
- **Hevy's own plateau guide:** call it a plateau only after a **consistent stall of 3-4 weeks**,
  and rule out sleep, nutrition and stress first
  (**sourced**, [Hevy gym-plateau](https://www.hevyapp.com/gym-plateau/)). Single-session alerts
  produce false positives.
- **Counting volume:** a 2026 meta-analysis compared ways of counting indirect sets. The
  **fractional method (direct = 1, indirect = 0.5)** best predicted growth and strength. Benefits
  diminish with more sets (about 11 fractional sets per session for hypertrophy)
  (**sourced, secondary**, [train.fitness](https://train.fitness/personal-trainer-blogs/not-all-sets-are-created-equal/amp)
  and [SportRxiv preprint](https://sportrxiv.org/index.php/server/preprint/download/537/1148/1071)).
- **Spreadsheet trackers** (the classic r/fitness and r/weightroom answer) show a per-lift e1RM or
  top-set line, weekly sets per muscle in a pivot, and conditional-formatting heat cells. Their
  strength is that **the table is the chart**: every number is visible and comparable *(inferred)*.

#### 2.21 Volume-landmark tools (arvo.guru and RP's tables)
- **Stats:** per-muscle weekly set landmarks, e.g. chest MEV 10, MAV 14-18, MRV 22
  (**sourced**, [arvo.guru](https://arvo.guru/resources/volume-landmarks),
  [RP](https://rpstrength.com/training-volume-landmarks-muscle-growth/)). The sources disagree on
  exact numbers.
- **Lesson:** landmark bands are popular. But the numbers are soft, so a band should be shown as
  **context**, not as a pass or fail.

---

## 3. Metric catalogue

Value is judged for **a solo lifter on a fixed A/B program of 14 exercises with ramped sets,
including bodyweight and assisted lifts**. **Measured** = counted from section 2.

| Metric | Offered by | Question it answers | Value for us | Why |
|---|---|---|---|---|
| e1RM trend per exercise | Strong, Hevy, Fitbod, Boostcamp, StrongLifts, MacroFactor, Setgraph | Am I getting stronger on this lift? | **High** | It normalises ramped sets into one number. It must skip high-rep sets: StrongLifts shows NA above 12, and our accessories run at 15. |
| Top-set / heaviest-weight trend | Strong, Hevy, MacroFactor | Is the bar getting heavier? | **High** | It matches our working-weight rule (0006), and the lifter reads it without maths. |
| Rep PR at a given weight ("8 → 10 at 60 kg") | Boostcamp, Hevy (set records), Strong | Did I beat last time at the same load? | **High** | On a fixed program this is the most frequent kind of progress. |
| Rep-records table (best weight per rep count) | Hevy, Strong | What is my best at 5, 8 or 10 reps? | Med | Useful reference. It is sparse when rep ranges are fixed. |
| Weight PR / e1RM PR | All loggers | Is this a lifetime best? | **High** | The celebration moment. It must be reliable (Gravitus complaint). |
| Volume PR (best session or best set volume) | Hevy, Boostcamp, MacroFactor | Did I do more total work? | Low-med | A set added for the "add a set" suggestion sets one easily, so it is cheap. |
| Session-to-session delta per exercise (↑ = ↓) | Setgraph, Gravitus (Pro), Fitbod summary | Did today beat last time, and on what? | **High** | The fastest and most actionable answer. It needs no chart. |
| Progression status vs target ("2 more reps to go up") | Alpha Progression, StrongLifts (implicit), our app | What should I do next session? | **High** | Our differentiator (0006). It is the "what to do next" half of the goal. |
| Tonnage (volume load, kg) per session or week | Hevy, Fitbod, Strong, Whoop, MacroFactor | How much work did I do? | Med | It mixes kinds: bodyweight and assisted add no kg. MacroFactor splits load types for that reason. It measures load, not progress (the CTL critique). |
| Hard sets per muscle per week | Hevy, Fitbod (targets), Liftosaur, MacroFactor, RP, Boostcamp (Pro) | Is each muscle getting enough? | Med-high | The best evidence-based volume metric. On a fixed program it is nearly constant, so it matters when sessions are missed or the program changes. |
| Fractional sets (indirect = 0.5) | Science sources only, none of the apps confirmed | Same, more accurately | Med | A cheap upgrade if muscle mapping already has primary and secondary. |
| Sets vs landmark band (MEV/MAV/MRV) | Liftosaur, RP, Fitbod targets | Am I under or over? | Med | Good context. The thresholds are disputed, so show a band, not a verdict. |
| Muscle distribution / balance | Hevy, Caliber, Symmetric Strength, Boostcamp | Am I neglecting an area? | Low-med | The program fixes the distribution. It matters only after swaps or skipped days. |
| Body-map heat (sets or recency) | Hevy, Fitbod, Boostcamp, Garmin, MacroFactor tiles | Which muscles did I hit? | Low-med | Glanceable and liked. Little decision value on a fixed split. It belongs in the summary. |
| Recovery % per muscle | Fitbod | What can I train today? | Low | Our program decides the day. Unexplained percentages also invite distrust. |
| Strength Score / composite score | Fitbod, Boostcamp, Caliber, Alpha Progression ("strength rating") | Overall, am I stronger? | Low | Opaque and population-normed. One number hides which lift moved. |
| Strength level vs population | Hevy (big 3), Caliber, Symmetric Strength | How do I rank? | Low | Our program has no barbell squat or deadlift test, and the question is not "am I progressing". |
| Lift ratios (own lifts against each other) | Symmetric Strength | Is one lift lagging? | Low | Needs comparable compound lifts. Possible later. |
| 3RM / 10RM estimates | MacroFactor | What can I do at my training reps? | Med | It translates e1RM into the 8-12 range where our accessories live. |
| Consistency: sessions per week, week streak | Hevy (week streak), MacroFactor habits, Apple awards, Setgraph calendar | Am I showing up? | **High** | Adherence is the first driver of progress. A week-based streak fits an A/B program. |
| Calendar heat map | Hevy, Setgraph, MacroFactor | When did I train? | Med | Good for "how regular am I". It duplicates History. |
| Program position (week N, sessions this week) | JuggernautAI, MacroFactor cycle rings | Where am I in the plan? | Med | Cheap context. Our program has no mesocycle length, so it is just "this week: A ✓ B ·". |
| RPE / RIR trend, avg RPE, count of RPE 9+ | Boostcamp (stored), Fitbod (RiR), coaching sources | Is the same work getting easier, or am I grinding? | Med (High when logged) | "Rising e1RM at the same RPE" is the best progress signal. Effort is optional for us (0014), so it is sparse. |
| e1RM at constant RPE / effort-adjusted | Coaching sources, StrongLifts (RPE 8 assumption) | Real strength or just a good day? | Low (data) | Needs consistent effort logging. |
| Plateau / stall flag | Third-party apps (Progressive, BulkForged), Hevy guide | Is a lift stuck? | **High** | It directly answers "what to do next". Use a 3-4 week rule, never a single session. |
| Readiness / fatigue (subjective or HRV) | JuggernautAI, Whoop, Oura | Should I push today? | Low | Needs inputs we do not collect. Out of scope. |
| Load model (CTL/ATL/TSB, strain vs recovery) | TrainingPeaks, Strava, Whoop | Am I overreaching? | Low | Endurance-native and criticised even there. |
| Duration, sets and exercises per session | Hevy, Fitbod, Strong | How big was the session? | Low-med | Summary furniture. Rest time is stored (0013), so session density is possible. |
| Bodyweight / measurements trend | Hevy, StrongLifts, MacroFactor, Liftosaur | Is my body changing? | Med | Roadmap R7 ("Body"). It needs a home, not the headline. |
| Monthly / yearly recap | Hevy, Boostcamp, Strava | What did this month amount to? | Med | A narrative wrapper over the metrics above. It earns motivation and is cheap to build. |

**Measured counts from section 2:** e1RM trend 7 products; weekly sets per muscle 6; composite
strength score 4; body-map heat 5; week-based or calendar consistency 4; recaps 3 (Hevy, Boostcamp,
Strava); session-delta arrows 3.

---

## 4. Chart-form patterns

| Form | What it carries | Who does it well | Notes for us |
|---|---|---|---|
| **Single-series line with dots** (e1RM or top set over sessions) | One lift's trend | Strong *(inferred)*, Hevy, StrongLifts | The universal per-exercise chart. Mark PR points. Never interpolate over gaps (intervals.icu bug). For assisted lifts the axis is reversed (0006). |
| **Metric chips over one chart** | Switch e1RM / weight / volume / reps | Hevy *(inferred)*, MacroFactor | Better than a stack of charts. One chart at a time, a clear default (e1RM or top set). |
| **Sparkline rows / tiles** | Every lift's last N sessions at once | MacroFactor exercise tiles | The best overview for 14 fixed lifts. Pair each with a value and a delta. |
| **Arrow/delta list** | ↑, →, ↓ per metric against a baseline | Apple Trends, Setgraph arrows | Fastest "where am I progressing". The arrow comes from a stated window (Apple: 90 against 365 days). |
| **Weekly bars against a shaded "normal" band** | This week's volume against your range | Strava Relative Effort, Oura baselines | Avoids empty "bigger is better" bars. Our `VolumeVsBaseline` belongs here. |
| **Fill bars to a target** | Sets done against the weekly target per muscle | Fitbod Targets, MacroFactor rings, Liftosaur colouring | Forward-looking. Bars compress better than rings. |
| **Body-map heat** | Sets or recency per muscle | Hevy (blue), Fitbod, Boostcamp | One-hue ramp only (prior scan). Tap a muscle to list its contributors (Fitbod, Liftosaur hover). Low decision value. |
| **Calendar heat map / dot calendar** | Training days, streaks | Hevy, Setgraph, MacroFactor Habits | Week rows suit a 2-3 sessions-a-week lifter. |
| **PR feed / records list** | Recent and lifetime bests | Hevy monthly report, MacroFactor Recent Records, Boostcamp | Each PR opens its session. Show PR *type* (weight, reps at weight, e1RM). |
| **Rep-records table** | Best weight per rep count | Hevy, Strong | "The table is the chart". Also the accessible fallback for charts without tooltips (our 0006). |
| **Score dial / ring** | One composite number | Fitbod, Whoop, Oura, Caliber | Only for a transparent number. Avoid for strength. |
| **Labelled-period band chart** | Stretches named "overreaching" / "restorative" | Whoop monthly assessment | Adaptable: shade blocks as "building", "stalled" or "deload" on an e1RM line. |
| **Period comparison overlay** | This range against last range | Strava Compare Date Range, intervals.icu seasons | Needs like-for-like windows (season-to-date). The overlay needs different line styles, not two hues. |
| **Recap page (narrative scroll)** | Totals → trend → PRs → days → muscles → top lifts | Hevy Monthly Report, Boostcamp Wrapped | A good template for a month or block summary. |

No product found uses dual axes for strength stats. Each chart holds one measure. That matches our
constraint.

---

## 5. IA archetypes for stats

1. **Per-exercise detail (the "exercise page")**: About / History / Charts / Records under one lift.
   *Strong, Hevy, MacroFactor, StrongLifts, Setgraph.* This is the universal deep layer, and every
   other archetype drills into it. Its risk is that it is the *only* layer. The user then has to open
   14 pages to learn "where am I progressing" (that is Strong's model).
2. **Stats tab / profile statistics (the "analytics drawer")**: a separate place with muscle charts,
   distribution, calendar and top exercises. *Hevy (Profile → Statistics), Alpha Progression
   (Analysis tab), Liftosaur (Graphs).* Comprehensive but browsy. The user must know what to look
   for.
3. **Home as dashboard (summary-first)**: progress lives on the screen you open to train: weekly
   targets, recent records, exercise sparklines. *MacroFactor Workouts, Fitbod (Targets, Body),
   JuggernautAI, Whoop, Oura.* It answers "am I on track" with zero navigation. The risk is crowding
   the "start workout" path.
4. **Session summary as the stats moment**: PRs, deltas and the muscles hit, shown right after
   finishing. *Hevy, Strong, Boostcamp, Fitbod Workout Report.* Highest attention, smallest scope (one
   session).
5. **Periodic recap / narrative report**: a weekly or monthly page in a fixed order, sometimes pushed.
   *Hevy Monthly Report, Boostcamp Sunday report, Fitbod weekly/monthly push, Strava Progress, Whoop
   Monthly Assessment.* It answers "what did this period amount to" and supplies the story. It is
   lagging by design.
6. **Insight cards / coaching**: interpreted statements with a suggested action ("Bench is down over
   90 days, here's how to turn it around"). *Apple Trends coaching, Whoop, Oura featured trends,
   the plateau detectors.* Closest to the operator's goal ("know what to do next"). The risk is
   trust: every card must expand into the data behind it.

**Observed best structure** (inferred synthesis): **summary-first overview (3 or 6) → per-lift rows
with a sparkline and delta → per-exercise detail (1)**, with the session summary (4) and periodic
recap (5) as time-boxed views of the same metrics. Whoop's "tiles → one-question trend → deep dive"
is the same three tiers.

---

## 6. Interaction patterns, and empty or sparse data

**Ranges**
- Typical presets are **1 month, 3 months, 1 year and all time** (Hevy, Whoop web: 1 week to 6
  months; Oura: day, week, month, year; Fitbod reports: week, month, 6 months, year). Sourced in
  section 2.
- The **phone default is short** (Whoop: weekly snapshot; Hevy body view: current week), and long
  ranges sit one level deeper.
- **Stepping by week with arrows** (Hevy body view) suits weekly volume better than a range picker.

**Reading values**
- Drag or tap a line to read a point *(inferred for Strong and Hevy)*.
- Our app chose **no pointer tooltips**, with the records list as the table view (0006). The market
  shows no product where tooltips carry essential information. The values that matter (current,
  best, delta) are always printed as text beside the chart *(inferred, consistent across Hevy
  Summary and MacroFactor tiles)*.

**Comparison**
- Strava's Compare Date Range, intervals.icu seasons, Hevy's month-over-month muscle distribution,
  and Fitbod's "against prior period" deltas.
- The lesson from intervals.icu is to compare **like-for-like windows**.

**Filters**
- Setgraph filters history by weight or rep range.
- Hevy picks muscles.
- Whoop filters by day colour.
- For us, the only filter that matters is probably **exercise kind** (loaded / bodyweight /
  assisted). It should be built in, as MacroFactor separates load types, rather than shown as a
  control.

**Drill-down**
- Tapping a PR opens its session (Hevy monthly report).
- Tapping a muscle lists its contributing workouts (Fitbod Body) or exercises (Liftosaur hover).
- Tapping an exercise tile opens its metrics (MacroFactor).
- Every aggregate should open the rows behind it.

**PR celebrations**
- **Live:** Hevy's mid-set PR notification with sound (prior scan).
- **Summary:** medals on sets, plus a records section.
- **Recap:** the month's PRs, tappable.
- **Apple:** awards for PRs and streaks.
- Restraint reads as more premium than confetti (prior scan).
- **Reliability matters more than spectacle** (Gravitus complaint).

**Empty and sparse data**
- **State the requirement.** Oura: "up to two weeks to learn your averages". Apple: "180 days to
  start trends". Our 0006 empty state already says about a month.
- **Refuse bad estimates.** StrongLifts shows "NA" for e1RM above 12 reps.
- **Hide what is not relevant.** StrongLifts graphs only current-program lifts and keeps the history.
- **Show progress from session 2.** A session-to-session delta (Setgraph arrows) works with two data
  points, long before a trend line means anything. *(Inferred synthesis: no product names this
  explicitly, but every logger pre-fills last time, which is the same comparison.)*
- **Do not draw fake continuity.** Use no interpolation across gaps (intervals.icu), and mark
  missed weeks as gaps, not zeros.
- **Plateau needs time.** Use a 3-4 week stall rule before saying "stuck" (Hevy guide).

---

## 7. What users complain about

| Complaint | Source and strength |
|---|---|
| **Core progress data behind a paywall**, including history limited to 3 months | Hevy: the vendor's own FAQ confirms the limit; aggregated reviews name it the top complaint (**sourced, low confidence**, [marlvel.ai](https://marlvel.ai/apps/com-hevyapp-hevy/vs)). Gravitus: "features once free are now paywalled" (**sourced**, [App Store review](https://apps.apple.com/us/app/gravitus-gym-workout-tracker/id965383840)). Strong: crown-locked charts ([ScreensDesign](https://screensdesign.com/showcase/strong-workout-tracker-gym-log)). |
| **Data recorded but not shown**: no trend over time, no totals per routine, no PR alerts | Garmin users: "Your strength training has been the same for years" (**sourced**, [Garmin forum](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-ios/382451/why-is-strength-training-still-so-bad/1822804)). |
| **Unreliable PR detection** | Gravitus: "Sometimes it shows personal records, but usually it doesn't" (**sourced**, App Store review). |
| **Analytics show numbers but don't interpret them** | A Strong review contrasts it with Whoop (**sourced, low confidence**, [repreturn](https://repreturn.com/strong-app-review/)). "Advanced analytics" is the top feature request for Hevy (**sourced, low confidence**, marlvel.ai). |
| **Overwhelming dashboards** | JuggernautAI: "a lot going on" at first (**sourced**, [Garage Gym Reviews](https://garagegymreviews.com/juggernautai-review)). Fitbod: one review calls it "Overwhelming, Inaccurate, and Not Worth the Money" (**sourced**, [Trustpilot](https://www.trustpilot.com/review/fitbod.me?page=2)). |
| **Opaque scores and models** | Fitbod publishes no method for its Strength Score or recovery (**sourced** by absence on its pages). TrainingPeaks CTL read as fitness when it is load (**sourced**, [Fast Talk](https://forums.fasttalklabs.com/t/fast-talk-episode178-the-good-the-bad-and-the-ugly-of-chronic-training-load-ctl/3942)). |
| **Unfair or misleading comparisons** | intervals.icu: season against a whole prior season; interpolation drawn above the all-time best (**sourced**, forum threads). |
| **Inconsistent volume counting** (unilateral doubling, dumbbell pairs, bodyweight) | App listings differ: Everlift counts both hands, HeavySet can double unilateral volume (**sourced**, [Everlift](https://apps.apple.com/app/id6760033237) / HeavySet listings in the search results). This erodes trust in tonnage. |
| **Readability of dark data UIs** | JuggernautAI: "blue-on-black design can be tough to read" (**sourced**, Garage Gym Reviews). |

---

## 8. Implications for our app

1. **Lead with a per-lift progress list, not a chart.** Show 14 rows. Each has the lift, its current
   e1RM or top set, a 6-8 session sparkline and a ↑ / → / ↓ against a stated window (MacroFactor
   tiles plus Apple Trends arrows). That alone answers "am I progressing, and where" in seconds.
2. **Put "what to do next" beside the trend.** Show the 0006 progression status ("2 reps to +2.5 kg")
   and a **stall flag only after 3-4 weeks flat** (Hevy guide). That is the insight-card archetype,
   kept suggestion-only and expandable to its data.
3. **Make the session-to-session delta the first stat anyone sees.** It works from session 2. Give
   it per exercise and per lever (load, reps, sets), as Setgraph arrows and the Gravitus overload
   breakdown do. This is also the empty-state strategy: no "come back in a month" wall.
4. **Treat PRs as a typed, trustworthy feed.** Types: weight, reps at weight, e1RM. Each opens its
   session. Exclude warm-ups (a frame invariant). Reliability matters more than confetti.
5. **e1RM must be honest.** Do not estimate above about 12 reps (StrongLifts NA). For 15-rep
   accessories, chart top-set weight × reps or a 10RM-style figure instead. Consider MacroFactor's
   "estimate at your training reps" in place of a 1RM that the lifter never tests.
6. **Show volume as weekly hard sets per muscle against a shaded "your normal" band.** Do not use
   raw tonnage bars. Tonnage is load, not progress (the CTL critique), and it cannot add bodyweight
   or assisted sets. Fractional sets (indirect = 0.5) are a cheap accuracy upgrade. Show landmark
   bands as context only.
7. **Make the body map a summary garnish, not a destination.** It has low decision value on a fixed
   A/B split. Keep it in the session summary or weekly recap, single hue, tap to list the
   contributing exercises.
8. **Count consistency in weeks.** A week-based streak (Hevy) and "this week: A ✓ B ·" (program
   position, JuggernautAI and MacroFactor) suit a 2-3 sessions-a-week lifter better than daily rings.
9. **Use three tiers, one question each** (Whoop, MacroFactor): overview (rows plus the week), then
   per-exercise detail (one chart with metric chips, records table, history), then the raw sessions.
   Every aggregate drills into the rows behind it.
10. **Ranges: short by default, long one step deeper.** Use presets (1 month, 3 months, 1 year, all)
    on the detail page, week arrows for the weekly views, and like-for-like comparisons ("this block
    against the last block at the same week") rather than whole-period overlays. Never interpolate
    across gaps.
11. **Add a monthly recap as the narrative layer.** Use Hevy's order: totals → trend → PRs → days →
    muscles → top lifts. It costs little because it reuses the same metrics, and it supplies the
    motivation that composite scores try to buy.
12. **Leave out composite strength scores, population tiers, recovery percentages and load
    models.** They are opaque, need inputs we do not have, or answer "how do I compare with
    strangers" instead of "am I progressing". Nothing is paywalled here, so the full history is
    simply always there. That is a quiet advantage over Hevy's 3-month limit.

---

## Sources

- Strong: https://screensdesign.com/showcase/strong-workout-tracker-gym-log · https://apps.apple.com/vn/app/id464254577 · https://startingstrength.com/resources/forum/general-programming/73861-graph-visulaization-sets-2.html (via search snippet) · https://repreturn.com/strong-app-review/ (low confidence)
- Hevy: https://www.hevyapp.com/features/gym-progress/ · https://www.hevyapp.com/features/monthly-report/ · https://www.hevyapp.com/features/exercise-performance/ · https://www.hevyapp.com/features/training-chart/ · https://www.hevyapp.com/features/sets-per-muscle-group-per-week/ · https://www.hevyapp.com/gym-plateau/ · https://marlvel.ai/apps/com-hevyapp-hevy/vs (low confidence)
- Fitbod: https://fitbod.me/blog/fitbod-insights-feature/ · https://fitbod.me/blog/best-app-for-tracking-weightlifting-volume-intensity-frequency/ · https://www.trustpilot.com/review/fitbod.me?page=2
- Boostcamp: https://www.boostcamp.app/features · https://www.boostcamp.app/blogs/boostcamp-workout-app-november-features-updates · https://www.boostcamp.app/vs/rp-hypertrophy
- Liftosaur: https://www.liftosaur.com/p/e7a6b638 · https://github.com/astashov/liftosaur · https://www.liftosaur.com/blog/posts/liftosaur-overview/
- StrongLifts: https://support.stronglifts.com/article/89-graphs · https://support.stronglifts.com/article/138-understanding-your-estimated-1-rep-max-e1rm
- Alpha Progression: https://alphaprogression.com/en/blog/alpha-progression-vs-hevy · https://apps.apple.com/app/id1462277793
- RP / volume landmarks: https://rpstrength.com/training-volume-landmarks-muscle-growth/ · https://arvo.guru/resources/volume-landmarks
- JuggernautAI: https://garagegymreviews.com/juggernautai-review · https://fitnessvolt.com/rpe-training/comparisons/rpe-calculator-vs-juggernautai/
- Gravitus: https://apps.apple.com/us/app/gravitus-gym-workout-tracker/id965383840
- Setgraph: https://setgraph.app/articles/setgraph-the-best-workout-tracker-app-for-strength-training-and-progressive-overload · https://setgraph.app/features/1rm
- Caliber: https://tomsguide.com/news/forget-chatgpt-this-workout-app-lets-you-text-your-personal-trainer-247 · https://apps.apple.com/NG/app/id1482405410
- MacroFactor: https://help.macrofactorapp.com/en/articles/275-getting-to-know-your-workouts-dashboard · https://help.macrofactorapp.com/en/articles/344-viewing-exercise-performance-over-time
- Symmetric Strength: https://www.bluestacks.com/campaign/com.hansler.android.symmetricstrength/en · https://fitnessvolt.com/rpe-training/strength-symmetry
- Whoop: https://whoop.com/thelocker/track-progress-with-new-trend-views · https://ww2.whoop.com/thelocker/monthly-performance-assessment/ · https://ww2.whoop.com/thelocker/whoop-web-app-training-data-trends/ · https://www.whoop.com/us/en/press-center/whoop-introduces-strength-trainer-becomes-first-wearable-to-measure-muscular/ · https://www.whoop.com/ae/en/thelocker/2026-whats-new/
- Oura: https://support.ouraring.com/hc/en-us/articles/360057791533
- Strava / intervals.icu / TrainingPeaks: https://support.strava.com/hc/en-us/articles/28437860016141-Progress-Summary-Chart · https://the5krunner.com/2025/11/17/strava-relative-effort-guide-tss-2025 · https://www.road.cc/content/feature/how-use-strava-make-you-fitter-286073 · https://www.intervals.icu/features/power-curve/ · https://forum.intervals.icu/t/season-match-like-function/428 · https://forum.intervals.icu/t/bug-all-time-best-power-looks-lower-than-current-season/35932 · https://forums.fasttalklabs.com/t/fast-talk-episode178-the-good-the-bad-and-the-ugly-of-chronic-training-load-ctl/3942 · https://roadmancycling.com/blog/cycling-ctl-atl-tsb-explained-guide
- Garmin: https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-ios/382451/why-is-strength-training-still-so-bad/1822804 · https://gizmologi.id/gadget/wearable/muscle-map-garmin-strength/ · https://the5krunner.com/2024/06/23/new-garmin-connect-feature-heading-for-the-app-or-is-it-a-hidden-feature
- Apple: https://apple.co/36ggRsf · https://support.apple.com/108359
- Training science / community: https://www.progressiverehabandstrength.com/articles/calculating-and-tracking-rpe-e1rm-for-barbell-strength-training · https://rpetraining.com/strength · https://train.fitness/personal-trainer-blogs/not-all-sets-are-created-equal/amp · https://sportrxiv.org/index.php/server/preprint/download/537/1148/1071 · https://apps.apple.com/app/id6760033237
