# Market research: design language and UX of leading strength and fitness apps

Date: 2026-10-13. Scope: visual language, information architecture, screen structure, components and
interaction flows of 19 products. Goal: find out what "professional" looks like for a one-handed,
mid-set strength logger, and why the current light ivory, green, clay and pastel UI reads as amateur.

## Method and confidence

- **Measured** means taken from the product's own web CSS, fetched on 2026-10-13: hex values and
  `font-family` declarations on hevyapp.com, strong.app (its Webflow stylesheet), boostcamp.app,
  joinladder.com, future.co, strava.com, gentler.app, liftosaur.com, stronglifts.com,
  caliberstrong.com, ouraring.com and tonal.com. Marketing-site colours are the brand palette. They
  usually match the in-app accent, but they are not proof of in-app hex values.
- **Sourced** means a review, help-centre page or design write-up, cited inline.
- **Inferred** means taken from App Store screenshots and hands-on knowledge of the apps as of
  2025-26. It is marked *(inferred)*. Exact pixel sizes for apps whose design specs are not public
  are estimates for a 390-pt-wide iPhone.

No source publishes in-app design tokens for Strong, Hevy or Fitbod. ScreensDesign's flow captures
([Strong](https://screensdesign.com/showcase/strong-workout-tracker-gym-log),
[Hevy](https://screensdesign.com/showcase/hevy-workout-tracker-gym-log),
[StrongLifts](https://screensdesign.com/showcase/stronglifts-weight-lifting-log)) give timestamps
and behaviour, not tokens.

---

## Part 1 — Product-by-product

### 1. Strong (iOS/Android/Watch) — "the notebook, reinvented"

- **Positioning:** "Think less. Lift more." / "Workout. Notebook. Reinvented." Muscle & Fitness calls
  the UI "superclean" ([strong.app](https://www.strong.app/)). Its audience is serious lifters who
  want a fast log and no coaching.
- **Colour:** White background with an optional true-dark mode. One accent, iOS-style blue. The web
  CSS has `#0082F3`, `#35A7FF` and `#3898EC` on neutrals `#FAFAFA`, `#F3F3F3`, `#C8C8C8` and
  `#161616` (measured, `strong-6-0.webflow.shared.css`). Completed set rows get a pale green tint and
  a green ✓ (inferred). Set-type letters are the only other colour: W = warm-up (orange),
  D = drop (purple), F = failure (red) (inferred). Colour carries state, never decoration.
- **Type:** The app uses the iOS system font, SF Pro (inferred); the site uses Inter plus Merriweather
  for long copy (measured). Exercise names are about 17 pt semibold in the accent blue. Table header
  labels are small grey caps (about 12 pt). Numbers are about 16-17 pt, regular weight. There are no
  oversized hero numbers during logging. The hierarchy comes from weight and colour, not size.
- **IA / navigation:** Five-tab bottom bar: Profile, History, **Workout** (centre), Exercises,
  Measure ([Avante teardown](https://enterprise.avante.io/blog/2018/10/the-strong-exersice-tracker-app)
  describes "Start Workout" centred in the tab bar). The Workout tab holds "Start an Empty Workout",
  then a grid of template cards (title, exercise list preview, last-performed date) in folders that
  can be reordered by drag and drop ([ScreensDesign 05:59](https://screensdesign.com/showcase/strong-workout-tracker-gym-log)).
- **Active workout:** A full-height sheet that you swipe down to a mini-bar docked above the tab
  bar, so you can browse history mid-workout and come back (inferred, and a pattern copied by Hevy).
  Header row: a rest-timer button on the left, workout name and elapsed time, and a "Finish" button on
  the right.
- **Set table:** `SET | PREVIOUS | KG | REPS | ✓`.
  - SET is a small grey rounded label holding the number or the set-type letter.
  - PREVIOUS shows last time's "60 kg × 8" in grey. Tapping it copies the values into the row
    (inferred).
  - KG and REPS are light-grey filled rounded rectangles (radius about 6) with centred numbers.
  - ✓ is a grey rounded square that turns green when tapped.
  - Rows are about 40-44 pt tall with no dividers. Each exercise block ends in a full-width grey
    "+ Add Set" button.
  - Previous weight and reps auto-populate ([Avante](https://enterprise.avante.io/blog/2018/10/the-strong-exersice-tracker-app)).
- **Rest timer:** Starts automatically on ✓ and "appears prominently"
  ([ScreensDesign 02:36](https://screensdesign.com/showcase/strong-workout-tracker-gym-log)). It
  shows as a thin accent-blue countdown bar inline under the completed set, plus a modal ring timer
  with −10 s / +10 s / Skip (inferred). It ends with a chime and needs no dismissal, so "users can
  return to the workout without touching the phone" ([Avante](https://enterprise.avante.io/blog/2018/10/the-strong-exersice-tracker-app)).
  Reviews call Strong's timer and plate calculator "slightly more refined than Hevy's"
  ([hevy reviews roundup](https://repreturn.com/hevy-app-review/)).
- **PRs:** Medal or trophy badges next to record sets on the finish screen, plus a "Congratulations,
  workout #N" summary card listing PRs (inferred). The celebration is restrained: no confetti storm.
- **Onboarding:** Mandatory sign-up first, which ScreensDesign flags as friction (00:04). After that,
  small contextual modals appear as you meet features, with no long tutorial (00:28, 00:45).
- **Premium vs cheap:** Premium comes from strict one-accent discipline, iOS-native controls and
  perfectly aligned table columns. The cheapest touch is a Pro upsell tab that "reads like an
  advertisement" ([Avante](https://enterprise.avante.io/blog/2018/10/the-strong-exersice-tracker-app)).

### 2. Hevy — "Strong plus a social feed"

- **Positioning:** "The #1 workout tracker. Loved by 17+ million athletes"
  ([hevyapp.com](https://www.hevyapp.com/)). Mass market, social, free-first.
- **Colour:** Brand blue **`#1D83EA`** (17 uses on the site; variants `#267FE8` and `#1780EA`) on
  `#010101` / `#191A1B` blacks and `#9C9C9C` grey (measured). The app offers light and dark themes
  (dark is popular). It uses one accent blue for actions and links. Green marks completed sets. Red
  is reserved for swipe-to-delete
  ([track workouts](https://www.hevyapp.com/features/track-workouts/)).
- **Type:** The site uses Inter (measured), and the app uses the system font (inferred). The top of
  the logging screen has a three-stat strip (Duration, Volume, Sets): grey labels at about 12 pt over
  values at about 15-17 pt semibold (inferred).
- **IA:** Three tabs: Home (social feed), Workout, Profile (inferred, matching the help docs).
  Workout tab: "Start Empty Workout", then Routines in folders, each with a blue "Start Routine"
  button.
- **Logging screen:**
  - Each exercise block shows a circular exercise thumbnail and the name in blue, with a "⋯" menu.
  - Below that come a notes field and a blue "Rest Timer: 2min 0s" line. The timer sits "near the top
    of each movement, just below the custom note section"
    ([rest timer](https://www.hevyapp.com/features/workout-rest-timer/)).
  - Then the table: `SET | PREVIOUS | KG | REPS | ✓`, with an optional RPE column
    ([set types](https://www.hevyapp.com/features/workout-set-types/)).
  - Tapping the set number opens a set-type menu (Warm Up, Normal, Failure, Drop). Swiping left
    deletes. A "+ Add Set" button sits under each block and "+ Add Exercise" (blue) at the bottom
    ([track workouts](https://www.hevyapp.com/features/track-workouts/)).
  - Number entry uses the native keypad with a custom accessory bar (Plate **Calculator** and RPE).
  - Completing a set plays a "smooth checkmark animation"
    ([ScreensDesign 03:45](https://screensdesign.com/showcase/hevy-workout-tracker-gym-log)).
- **Rest timer:** Per exercise, auto-starts on ✓, adjustable from 5 s to 5 min, with ±15 s buttons
  and a notification at zero ([rest timer](https://www.hevyapp.com/features/workout-rest-timer/)).
  While it runs, a sticky bottom bar shows the countdown, −15/+15 and Skip, and a Live Activity puts
  it on the lock screen (inferred; the help centre links Live Activity without describing it).
- **PRs:** A **Live PR notification** banner appears mid-workout with its own sound and volume setting
  ([workout settings](https://www.hevyapp.com/features/workout-settings/)). The finish screen gives
  name, duration, photo and a shareable summary card with medals.
- **Finish:** "Finish" sits top-right. It leads to a form (title, duration, start time,
  photos/video, visibility) and then a save
  ([track workouts](https://www.hevyapp.com/features/track-workouts/)).
- **Imagery:** Looping 3D form models
  ([ScreensDesign 01:41](https://screensdesign.com/showcase/hevy-workout-tracker-gym-log)), line
  icons and real gym photos on the marketing site.
- **Premium vs cheap:** Premium comes from the same table discipline as Strong, a single blue and
  good dark mode. On the cheap side, ScreensDesign calls the logger "packed with information", and
  the social feed and paywall add visual noise.

### 3. Fitbod — "AI coach, dark and card-based"

- **Positioning:** "LESS PLANNING. MORE PROGRESS." in all-caps headlines ([fitbod.me](https://fitbod.me/)).
  It generates each day's workout from recovery data. Audience: intermediate gym-goers who don't want
  to plan.
- **Colour:** A near-black app canvas (inferred) with a warm red-pink brand accent; the site even uses
  `pink-star.svg` assets. Neutral `#313131` (measured). Muscle-recovery data uses a heat scale on a
  body diagram.
- **Type:** The site uses the `system-ui` stack (measured). In the app, all-caps or bold display
  headers sit over regular body text (inferred).
- **IA:** Tabs (inferred): Workout (today's generated session), Recovery (muscle body map, with each
  muscle 0-100 % recovered), Log/History, Exercises/Profile. The Recovery body heat-map is the
  signature screen. Reviewers call it "one visual element I really love"
  ([Yahoo Health](https://health.yahoo.com/wellness/fitness/online-fitness/articles/fitbod-app-review-good-beginners-193000972.html);
  [Fitbod blog](https://fitbod.me/blog/tracking-volume-intensity-and-recovery-with-fitbod/)).
- **Screen structure:** The workout is a list of exercise **cards** with a demo thumbnail, name and
  "3 sets · 10 reps · 60 kg". Tapping a card opens the exercise detail: set rows with reps and weight
  fields, "+Add Set", swipe-left delete
  ([Fitbod help](https://help.fitbod.me/hc/en-us/sections/1500000505721-Workout-Schedule-Logging)).
  An RIR prompt appears after the last set of an exercise or superset. The watch app is praised for
  supersets: "just hit 'done' and move on"
  ([TechRadar](https://www.techradar.com/health-fitness/fitbod-app-review)).
- **Premium vs cheap:** Premium comes from the dark canvas, demo video loops and a compelling body
  map. The cheap side is a heavy paywall, and a comparison table rates it "polished and detailed"
  but slower than minimal loggers ([gymgod](https://gymgod.app/blog/fitbod-review)).

### 4. JEFIT — "the legacy feature warehouse" (counter-example)

- **Colour:** A blue accent on white, with many secondary colours and ads in the free tier
  (inferred). The site exposes only `#8A8A8F` (an iOS secondary grey) inline (measured).
- **UX:** JEFIT announced a "revamped Workout Tab" and an exercise screen with a "cleaner layout, a
  slick timer" ([JEFIT blog](https://www.jefit.com/blog/upcoming-enhancements-revamped-workout-tab-and-improved-exercise-screens)).
  Users complain about "more and more pop up prompts before reaching the workout" and that each update
  makes things "less intuitive"
  ([App Store reviews](https://apps.apple.com/app/id449810000)). Logging uses ± steppers plus a
  "Log Set" button, an older pattern (inferred).
- **Lesson:** This is what accumulated features without a design system look like. It has many
  colours, inconsistent component styles, popups and ads, and it is the most-cited "dated" look in
  the category.

### 5. Boostcamp — "programs library, dark with a yellow accent"

- **Colour:** Brand **`#FCC100`** (amber-yellow, 27 uses), `#2A2A2A` charcoal, `#F5F5F5`, and a
  secondary `#00A6FF` (measured). The app is dark-first with the yellow used for primary buttons and
  the progress state (inferred).
- **Type:** The site uses Poppins (headings) and DM Sans/Public Sans (body) (measured): a
  geometric, friendly sans.
- **IA:** Programs (catalogue of famous programs: 5/3/1, nSuns, GZCLP, PPL), Workout (today's day
  in the active program), History, Profile. Its own framing: "a full tracker plus a programs library
  and a custom builder" ([boostcamp vs Strong](https://boostcamp.app/vs/strong)).
- **Logging:** Program-prescribed sets arrive pre-filled. Each row offers RPE/RIR, and there are
  supersets, drop sets, warm-up templates, a plate calculator, a rest timer and PRs, all free
  ([boostcamp best RPE](https://www.boostcamp.app/best/rpe-rir)).
- **Relevance:** This is the closest product to our Program → Days → Exercises model.

### 6. Ladder — "team coaching, dark plus electric yellow"

- **Colour:** `#0E0E0E` / `#1A1A1A` / `#2A2A2A` blacks, `#BCBCBC` grey, and an electric
  **`#E6FF00` / `#D2FF51`** volt accent (measured). **This is the look the owner already rejected.**
- **UX:** Coach-led video follow-along. You "hit play and follow a full video with in-ear coaching",
  the demo loops during the set, and you log weight and reps; there are intro and outro videos and team
  chat ([GGR](https://www.garagegymreviews.com/ladder-app-review)). One workout per day, so the home
  screen is just "today".
- **Lesson:** Full-bleed video and photography carry the premium feel. The neon is brand energy, not
  a logging aid.

### 7. Future — "personal coach, editorial black and white"

- **Colour:** Site `#FFFFFF` / `#010703` (near-black) / `#E7E7E7` / `#F5F6F6`, with one green
  **`#65D92B`** (measured). The app is dark during workouts, with full-bleed coach video (inferred).
- **UX:** A human coach writes the plan, the Apple Watch runs the session, and the phone shows
  messaging and the plan. Apple's HIG guidance applies: "large buttons that control the in-progress
  session appear on the leftmost screen", with only glanceable metrics
  ([Apple HIG Workouts](https://developer-mdn.apple.com/design/human-interface-guidelines/patterns/workouts)).
- **Lesson:** Grey-scale plus a single accent and large, confident type make an editorial
  premium look.

### 8. Apple Fitness / Apple Watch Workout — "system instrument"

- **Colour:** Pure black `#000000` canvas. The ring colours are an iconic triad of Move red-pink
  (about `#FA114F`), Exercise green (about `#A6FF00`-`#92E82A`) and Stand cyan (about `#00F0FF`)
  (inferred, widely documented). In the Workout app each metric type has its own colour: yellow for
  elapsed time, red for heart rate.
- **Type:** SF Pro / SF Compact **Rounded** for big numerals, and tabular figures so timers don't jitter.
  The hero number fills the screen width; the timer is the largest element (inferred). Apple's
  guidance: show "the workout data people are most likely to care about" and keep non-workout content
  out ([HIG](https://developer-mdn.apple.com/design/human-interface-guidelines/patterns/workouts)).
- **IA:** watchOS 26 gives each workout type its own page, with four corner buttons for start,
  metrics, goals and alerts. It adds Workout Buddy voice coaching and Liquid Glass translucency
  ([MacRumors](https://macrumors.com/roundup/watchos-26);
  [the5krunner](https://the5krunner.com/2025/06/10/wwdc-2025-a-new-design-fitness-buddies-and-mixed-reactions/)).
  A cautionary review complains that watchOS 10 put each ring on its own screen ("more scrolling")
  and moved End Workout, which broke muscle memory
  ([iMore](https://www.imore.com/health-fitness/apple-watch/watchos-10-is-great-but-its-ruined-the-apple-watch-fitness-app)).
- **Lesson:** Big numerals, tabular figures, black canvas and colour coding by meaning. Rings work
  because there are exactly three.

### 9. Whoop — "the data instrument"

- **Colour:** "Almost entirely black". The semantic colours are strictly green (recovery ≥ 67 %),
  yellow (middle) and red (< 33 %, strain). "Every hue carries meaning", with no arbitrary
  accents ([925 Studios breakdown](https://www.925studios.co/blog/whoop-design-breakdown)).
- **Type:** Oversized primary metrics. The recovery score is "roughly 72 pt equivalent", and the
  supporting text is small and secondary (same source). The typeface is not published.
- **IA:** The 2025 home screen is a single scroll with Sleep, Recovery and Strain dials, plus a
  separate Health tab ([WHOOP](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/)).
  It uses three tiers of disclosure: overview tiles with no charts, then a trends screen that answers
  one question, then the deep dive. Coaching is embedded in the score screens rather than in its own
  tab ([925 Studios](https://www.925studios.co/blog/whoop-design-breakdown)).
- **Lesson:** Restraint plus semantic colour plus huge numbers. This is the purest example of
  "premium through omission".

### 10. Strava — "one orange, maps and social"

- **Colour:** **`#FC5200`** orange (25 uses, effectively the only colour) on white with `#FAFAFA`
  (measured). Orange is used for the brand, primary buttons and the Record button; data stays
  neutral.
- **IA:** Home, Maps, **Record** (centre), Groups, You
  ([BikeRadar](https://bikeradar.com/news/strava-beta-test-layout)). The 2025 recording screen
  overlays key metrics on the map ([the5krunner](https://the5krunner.com/2025/07/16/strava-app-redesign/)).
- **Lesson:** One saturated brand colour on a white/grey system looks professional on a light
  background. Light mode is not the problem; colour count is.

### 11. Gymshark Training — "fashion-brand monochrome"

- **Colour:** Black and white with a grey scale, plus brand photography (inferred). Workouts are cards
  with athlete photos.
- **UX:** "Easy navigation", but it "lacks workout customization", and logging is basic: a
  "Sets & Reps: Tracked Mode" is still in Gymshark Labs
  ([Tom's Guide](https://tomsguide.com/wellness/fitness/gymshark-training-app-review-effective-workouts-for-free);
  [APKMirror 2.31.0](https://apkmirror.com/apk/gymshark-ltd/gymshark-training-fitness-app/gymshark-training-fitness-app-2-31-0-release)).
- **Lesson:** Monochrome plus photography equals "brand premium". It does nothing for logging.

### 12. Nike Training Club — "editorial athletic"

- **Type:** Nike's system uses Futura (condensed, ALL CAPS, "used sparingly for large-scale
  elements") with Helvetica Now for UI text
  ([Nike brand standards](https://gps.standards.nike.com/Brand/fonts-and-typography);
  [opendesigner](https://opendesigner.io/design-systems/nike)).
- **Colour:** Black and white only. Photography and video carry the colour (inferred).
- **UX:** Video-led guided workouts. Big all-caps titles over full-bleed photos, then the workout
  plays with a timer and a "next up" preview.
- **Lesson:** A condensed display face plus a neutral body face, with big, terse headlines on
  black and white. It is premium, but it depends on owning world-class photography.

### 13. Gentler Streak — "calm wellness, Apple Design Award"

- **Recognition:** 2024 Apple Design Award, Social Impact. Apple says it relies on "a subtle and
  consistently pleasing design language"
  ([Apple ADA 2024](https://developer.apple.com/design/awards/2024)). It was a 2023 Visuals finalist
  ([AppleInsider](https://appleinsider.com/articles/23/05/23/apple-showcases-finalists-for-2023-design-awards)).
- **Colour/type:** iOS grouped-background **`#F2F2F7`**, Inter (measured on site), and soft accents
  `#FA256D`, `#5200FF` and `#1E4E78` (measured). It has a mascot illustration (Yorhart) and the
  "Activity Path" band chart.
- **IA:** The redesign cut tabs from four to three. The home "Streak" page reorders by time of day
  (wellbeing first in the morning, activities later) and has customisable "For You" cards
  ([BGR](https://bgr.com/tech/gentler-streak-gets-a-major-redesign-focused-on-your-wellbeing/)).
- **Lesson:** Soft colour *can* win design awards. It does so through iOS-native structure,
  strict spacing and one illustration style, not a palette of pastels on a cream page.

### 14. Alpha Progression — "science-based, dark and dense"

- **UX:** It prescribes weight, reps and RIR for every set and adapts to "how hard your last sessions
  actually were" ([App Store](https://apps.apple.com/us/app/gym-workout-alpha-progression/id1462277793)).
  RIR is optional ([AP blog](https://alphaprogression.com/en/blog/alpha-progression-vs-hevy)). The
  interface "assumes you understand training science"
  ([findyouredge](https://www.findyouredge.app/news/best-progressive-overload-trackers-2026)).
- **Visual:** A dark default (inferred), a red/orange accent and dense set rows that show the target
  next to the actual value (inferred). The site exposes only `#F2F2F2` and Font Awesome (measured).
- **Lesson:** Showing a **target vs. actual** on each row is the strongest pattern for a
  program-driven logger like ours.

### 15. Liftosaur — "power-user, scriptable"

- **Colour/type:** Poppins (34 declarations), plus **Iosevka** monospace for Liftoscript code
  (measured). Deep purple `#28204B` and lavender `#A48BFA`, with `#45B3CB` teal (measured).
- **UX:** A text language defines programs ("exercise / sets×reps / weight / progression rule").
  There is a new experimental program editor
  ([Liftosaur overview](https://www.liftosaur.com/blog/posts/liftosaur-overview/);
  [editor post](https://liftosaur.com/blog/posts/new-experimental-program-editor)).
  The workout screen is being redesigned (community posts).
- **Lesson:** Monospace belongs in *code*, not in UI numbers; use tabular figures instead. The Jim
  app review found the same thing: "Rest timer and pace tracker used monospace. Fix: removed"
  ([traxon99/jim #317](https://github.com/traxon99/jim/issues/317)).

### 16. StrongLifts 5×5 — "one-tap circles"

- **Colour/type:** Brand red **`#D22E2E`** and Inter (measured).
- **UX:** The workout is "a simple checklist" with "large tap targets"
  ([ScreensDesign 03:33](https://screensdesign.com/showcase/stronglifts-weight-lifting-log)).
  Each set is a circle showing "5". One tap marks it complete, and each further tap decrements the
  rep count for a missed rep. Weight is preset by the program, so **one tap logs a set**. The rest
  timer starts automatically in a bottom bar, with a hint such as "easy → 1:30, hard → 3:00"
  (inferred). An older review called the look "early 2000s" yet "clean"
  ([dr-muscle](https://dr-muscle.com/stronglift-5x5-app-review/)).
- **Lesson:** This is the fastest logging pattern in the market, and it works because the program
  knows the target.

### 17. Caliber — "coach-backed, clean"

- **Type:** Benton Sans (measured on site).
- **UX:** Strength-balance score dashboard (for example "79 %") with a muscle-group heat map, a
  reps/weight logging screen, and a demo video for every exercise
  ([GGR](https://www.garagegymreviews.com/caliber-app-review)).
- **Lesson:** A body heat-map is now standard in this category (Fitbod, Caliber, Strong Pro), so our
  History heat-map is on-trend, if styled well.

### 18. Oura — "luxury calm"

- **Type:** **PP Editorial New** (a light serif display face, including Ultralight) plus
  **Akkurat LL** (a neutral grotesk) (measured).
- **Colour:** A dark navy/black app with soft gradients and a few semantic colours (inferred).
- **Lesson:** Premium calm comes from **a serif display face plus a grotesk body face, big light-weight
  numbers and lots of air**. This is the "light/soft but professional" path, and it is the
  opposite of pastel cards.

### 19. Tonal (and Peloton Strength) — "hardware-premium"

- **Type/colour:** **GT America** (measured). Black `#000000`, coral `#FF7373`, aubergine `#4E2B3E`,
  cream `#FEF1C7` and teal `#70EADD` (measured; mostly marketing).
- **UX:** Large on-device screen; the machine sets the weight, so "logging" is automatic. Strength
  scores and per-muscle charts. Peloton's strength classes are similar: dark, video-first, with a
  big rep counter (inferred).

---

## Part 2 — Design-language archetypes

| # | Archetype | Exemplars | Palette pattern | Type pattern | Density | Strengths | Risks | Fit for a one-handed mid-set logger |
|---|---|---|---|---|---|---|---|---|
| A | **iOS-native utilitarian** | Strong, Hevy (light), Gentler Streak, Strava | White / `#F2F2F7` grouped grey, **one** saturated accent (blue `#0A84FF`-ish, orange `#FC5200`), green for "done", red for destructive | System sans (SF Pro / Inter), 3-4 sizes, weight drives the hierarchy, tabular figures | Medium-high; tables and lists, few cards | Fast, familiar, accessible, ages well; "superclean" | Can look generic or "default" if spacing is sloppy | **Excellent.** The proven home of the set table. |
| B | **Dark athletic performance** | Ladder, Boostcamp, Fitbod, Hevy (dark), Peloton | Near-black `#0E0E0E`-`#1A1A1A`, one loud accent (volt `#E6FF00`, amber `#FCC100`, pink-red) | Bold or condensed display, often all caps, heavy weights | Medium; cards over photos/video | Energetic, gym-lighting friendly, accent pops | Aggressive, "gamer" feel; **already rejected by the owner** | Good legibility; the tone is wrong for this owner. |
| C | **Editorial / premium coach** | Nike Training Club, Future, Gymshark, Tonal | Black and white plus photography; at most one accent (`#65D92B`) | Condensed display face (Futura) or grotesk (GT America) in ALL CAPS, plus neutral body | Low; full-bleed media, big headlines | Brand-luxury, confident | Needs pro photography and video; weak for dense logging | Poor for the logger, good for the summary and marketing moments. |
| D | **Data instrument** | Whoop, Apple Watch Workout, Apple Fitness | Pure black, **semantic-only** colour (green/yellow/red; ring triad) | Huge rounded or tabular numerals (about 56-72 pt), tiny labels | Low at top, deep on drill-down | Glanceable at arm's length; colour = meaning | Cold; black-only can feel clinical | **Excellent for the rest timer, the current set and the summary.** |
| E | **Calm wellness / luxury soft** | Oura, Gentler Streak | Off-white or deep navy, muted accents, gradients used sparingly | Serif display (Editorial New) plus grotesk (Akkurat); light weights | Low, generous air | Sophisticated, soft without being childish | Can read as passive or low-energy; light weights hurt legibility mid-set | Fair; good for History and Stats, weak for mid-set input. |
| F | **Legacy feature warehouse** (anti-pattern) | JEFIT, older StrongLifts | Many accents, gradients, ads | Mixed weights, no scale | Cluttered | Feature-complete | Reads "dated / cheap" | Avoid. |

**Diagnosis for our app:** light ivory, green, clay and several pastel muscle colours is roughly
archetype E's softness without E's discipline: no serif/grotesk pairing, no restraint, colour used
decoratively. The closest professional option to the owner's taste (light, not aggressive) is
**A (iOS-native utilitarian) with D's numeral treatment**. That means a neutral white/cool-grey
canvas, one confident accent, semantic colour only, tabular hero numbers on the Set screen, and an
optional true-dark mode for the gym.

---

## Part 3 — Flow and IA patterns

### 3.1 Navigation models

| App | Tabs (bottom bar) | Count | Centre action | Home screen content | How you start a workout |
|---|---|---|---|---|---|
| Strong | Profile · History · **Workout** · Exercises · Measure | 5 | Workout tab | Templates grid + "Start Empty Workout" | Tap template card → preview sheet → "Start Workout" (2 taps) |
| Hevy | Home(feed) · Workout · Profile | 3 | — | Social feed | Workout tab → "Start Routine" on a routine (2 taps) |
| Fitbod | Workout · Recovery · Log · (Exercises/Profile) *(inferred)* | 4-5 | — | Today's generated workout | "Start Workout" pill at the bottom of today (1 tap) |
| Boostcamp | Programs · Workout · History · Profile *(inferred)* | 4 | — | Today's program day | Workout → "Start" (1-2 taps) |
| StrongLifts | Dashboard-first *(sourced)* | — | — | Next workout (A/B) with a "Start Workout" CTA | 1 tap |
| Strava | Home · Maps · **Record** · Groups · You | 5 | Record | Feed | 1 tap on Record + Start |
| Whoop | Home (single scroll) · Health · … | 3-4 | — | Recovery / Strain / Sleep dials | Automatic or "Start Activity" |
| Gentler Streak | 3 (reduced from 4) | 3 | — | Activity Path + time-of-day cards | — |
| Ladder / Future | Today · Team/Coach · Profile *(inferred)* | 3-4 | — | Today's single prescribed workout | Play (1 tap) |
| Apple Watch Workout | Vertical list of workout types | — | — | Workout types; corner buttons (watchOS 26) | 1 tap on the type |

Patterns:
1. **Program-driven apps put "today" on the home screen with one primary CTA** (Fitbod, StrongLifts,
   Ladder, Boostcamp). Template-driven loggers put a template grid on the Workout tab (Strong, Hevy).
   Our app is program-driven, so the home screen should be "Next: Day B — Squat, Bench, Row… [Start]".
2. **3-5 tabs, never more.** The trend is toward fewer: Gentler Streak went from 4 to 3, Hevy uses 3,
   and Whoop folded coaching into the score screens.
3. **The active workout is a modal layer, not a tab.** Strong and Hevy present it as a full-height
   sheet that collapses to a persistent mini-bar ("Push Day · 32:10") above the tab bar, so History
   or Exercises can be checked mid-session.
4. **Settings is not a tab** in most leaders. It lives under Profile, usually behind a gear icon.

### 3.2 The core loop: start → log set → rest → next set → finish

| Step | Strong | Hevy | Fitbod | StrongLifts | Alpha Progression | Apple Watch |
|---|---|---|---|---|---|---|
| Set pre-fill | Previous column plus pre-filled fields | Previous sets, weight and reps auto-added | AI-prescribed weight and reps | Program weight; circle shows target reps | Algorithm target per set | n/a |
| Log a set as prescribed | **1 tap** (✓) | **1 tap** (✓) | **1 tap** (✓ / done) | **1 tap** (circle) | **1-2 taps** (✓ then optional RIR) | n/a |
| Log a changed weight (e.g. 60 → 62.5) and reps (8 → 7) | ~6-8 taps: field, digits, next, digit, ✓ | ~6-8 (same, native keypad with toolbar) | ~4-6 (tap field, picker/keypad) | weight: settings; reps: 1-2 extra taps on circle | ~5-7 | n/a |
| Rest timer start | Auto on ✓ | Auto on ✓ (per-exercise default) | Auto | Auto | Auto | Manual |
| Rest timer UI | Inline blue bar under the set plus a ring modal; −10/+10/Skip *(inferred)* | Sticky bottom bar; −15/+15/Skip; lock-screen Live Activity | Countdown overlay *(inferred)* | Bottom bar with an advice string | Bottom bar *(inferred)* | Full-screen numerals |
| Does rest interrupt? | **No.** The table stays scrollable and editable; it chimes at zero, no dismissal needed | **No.** It is a bar; notification at zero | Partial | No | No | — |
| Next set | Next row is already visible | Same | Next row / auto-advance to next exercise card | Next circle | Next row | — |
| PR | Badge on set, plus a summary list | **Live PR banner** with its own sound, mid-set | Summary | Summary | Summary | Summary "rings closed" |
| Finish | Top-right "Finish", then a summary card | Top-right "Finish", then a save form (title, photo), then a share card | Bottom button, then a summary | Bottom, then a simple completion screen | Summary | Swipe right, then End |

Key flow findings:
- **1 tap per prescribed set is the market standard.** Anything that needs more than one tap to
  confirm a set done "as planned" is behind the leaders.
- **The rest timer must not block.** Leaders show it as a bar or inline strip, keep the table
  interactive, alert by sound, haptic or notification, and offer ±10-15 s and Skip. A modal timer
  that has to be dismissed is the outlier.
- **Mis-tap safety matters.** In the Jim app review, a double-tap on ✓ deleted the set just logged.
  The fix was that ✓ stays put, delete moves to a menu and Undo is offered. The brightest element on
  screen should be the **next** set's ✓ only, with completed rows tinted
  ([jim #317](https://github.com/traxon99/jim/issues/317)).
- **Keypads:** Strong and Hevy use a numeric keypad with an accessory row (Next, plate calculator,
  RPE). JEFIT uses ± steppers, the older pattern. StrongLifts avoids typing altogether. For our
  custom keypad: put Next/✓ inside the keypad, add a ±2.5 kg increment, and add "same as last".
- **Thumb zone:** Leaders put the primary actions at the bottom: "+ Add Set" under each block,
  "+ Add Exercise" at the bottom of the list, the rest bar at the bottom edge, and the Start pill at
  the bottom. "Finish" sits top-right in Strong and Hevy on purpose, out of thumb reach, to avoid
  ending a workout by accident. Jim moved "Discard workout" to the bottom of the list, away from Finish.
- **Gestures:** Swipe-left to delete a set (Hevy, Fitbod) and long-press or drag to reorder exercises
  (Hevy [ScreensDesign 04:20](https://screensdesign.com/showcase/hevy-workout-tracker-gym-log)).
  Strong lets you swipe the workout sheet down to minimise it. Apple Watch swipes right for controls.
- **Haptics and sound:** Hevy has separate volume settings for the check-set sound, timer and PR
  ([workout settings](https://www.hevyapp.com/features/workout-settings/)). A success haptic on ✓
  and a stronger pattern at rest end are standard on iOS (inferred).
- **Onboarding:** Utilitarian loggers use contextual tips, not tours (Strong). Coach and AI apps
  use quizzes and a plan preview, then a paywall (StrongLifts' 15 steps, then a hard paywall;
  Fitbod; Ladder). For a personal app, contextual one-time tips are enough.

### 3.3 Program editing
- **Strong/Hevy:** Templates and routines are edited with the same table component as logging. Folders
  are reordered by drag and drop
  ([ScreensDesign 05:59](https://screensdesign.com/showcase/strong-workout-tracker-gym-log)).
- **Boostcamp:** A program is weeks, then days, then exercises with prescribed sets/reps/RPE. A
  custom builder mirrors that tree.
- **Liftosaur:** Text/script editor plus a visual editor, for power users only.
- **Jim (benchmark fix):** "Routine detail became a read-only preview with a Start button; editing
  behind the pencil" ([jim #317](https://github.com/traxon99/jim/issues/317)). **Read-first, edit
  on request** is cleaner than always-editable forms.

### 3.4 Checking progress
- **Per-exercise detail** (Strong, Hevy, Fitbod): History, Charts (e1RM, best set, volume) and
  Records tabs inside the exercise screen, with one line chart in the accent colour, a light grid
  and no 3D.
- **Body heat-map** (Fitbod Recovery, Caliber, Strong): a single-hue intensity ramp on a neutral
  body silhouette. Never one colour per muscle.
- **Whoop model:** overview tiles, then one chart that answers one question, then the deep dive.
  "Each screen answers one question" ([925 Studios](https://www.925studios.co/blog/whoop-design-breakdown)).

---

## Part 4 — Concrete set-logging screen patterns

**Exercise block (Strong/Hevy consensus):**
```
[thumb] Bench Press (Barbell)              ⋯        ← 17pt semibold, accent colour
Rest 2:00 · Note…                                   ← 13pt grey / accent link
SET   PREVIOUS      KG      REPS     ✓              ← 11-12pt grey caps, letter-spaced
 W    40 × 10     [ 40 ]   [ 10 ]   [✓]            ← W in orange
 1    60 × 8      [ 60 ]   [  8 ]   [✓]  ← done: row tinted pale green, ✓ green filled
 2    60 × 8      [ 60 ]   [  8 ]   [ ]  ← next: ✓ outlined/brightest target
 3    60 × 7      [    ]   [    ]   [ ]
──────── 1:42 ───────────────────  (inline rest bar, accent)
[            + Add Set            ]                 ← full-width, grey fill, radius 8
```
- Rows are 40-48 pt tall. Input pills use a grey fill (`#F2F2F7`-ish in light, `#2C2C2E` in dark),
  radius 6-8, centred tabular numerals. Columns are fixed-width and aligned on every row.
- **Completed state:** a row tint plus a filled ✓, with no strike-through. **Next set:** the only
  high-contrast ✓.
- **Set-type** letters use a small, fixed colour code (W orange, D purple, F red). This is the only
  multi-colour exception.

**Rest timer patterns:**
1. Inline progress strip under the just-completed set (Strong).
2. A sticky bottom bar showing `1:42 · −15 · +15 · Skip` (Hevy, StrongLifts).
3. A full-screen ring with huge numerals (Strong modal, Apple Watch), optional and opened on tap.
4. A lock-screen or Dynamic Island Live Activity plus a notification at zero (Hevy).

**PR celebration patterns:**
- **Live:** a toast or banner with a trophy icon and "New PR · Bench 62.5 kg × 8", plus a distinct
  sound or haptic (Hevy).
- **Inline:** a small medal or trophy glyph next to the set row (Strong/Hevy summary).
- **Summary:** a card listing PRs with medal icons. Hevy and Strava add a shareable image.
- **Tone:** brief and confident, with no confetti storms, no emoji and no multi-colour fireworks.
  Apple's ring-close animation is the gold standard: one short, purposeful animation.

**Session summary (consensus):** title and date; a three-stat strip (Duration · Volume · Sets, or
PRs); the exercise list with best set per exercise; PR medals; Done/Share at the bottom.

---

## Part 5 — 15 most common professional signals

1. **One accent colour**, used only for primary actions and the active state (Strong blue `#0082F3`,
   Hevy `#1D83EA`, Strava `#FC5200`, StrongLifts `#D22E2E`).
2. **Colour = meaning.** Green means done or good, red means destructive or bad, and data colours
   are semantic (Whoop's "every hue carries meaning").
3. **A neutral canvas**: pure white/`#F2F2F7`, or near-black `#000`-`#1A1A1A`, with no tinted cream
   page.
4. **The system or one neutral sans** (SF Pro, Inter, Akkurat, GT America), with at most one display
   companion.
5. **Tabular, lining figures** on every number, so columns align and timers don't jitter.
6. **Oversized hero numbers** where glanceability matters (timer, current weight, recovery score
   ~56-72 pt) and small grey labels.
7. **Hierarchy through weight and greyscale**: primary text near-black, secondary at about 60 % grey,
   tertiary at about 30 %, with 3-4 type sizes per screen.
8. **Aligned tables** for sets. Fixed columns and left-aligned names; numbers centred or
   right-aligned.
9. **Consistent radii** (one family, e.g. 8/12/16) and a consistent 4/8-pt spacing grid.
10. **Line-only, consistent icon set** (SF Symbols-style) at one stroke weight.
11. **Few borders or shadows**: separation by grouped backgrounds and spacing, not boxes inside boxes.
12. **Primary actions in the thumb zone**, and dangerous ones (Finish/Discard) away from it.
13. **Non-blocking feedback**: inline rest bar, toast PRs, Undo instead of confirm dialogs.
14. **Real media for exercises** (looping demo video or 3D model, Hevy/Strong/Fitbod) or none, never
    clip-art.
15. **Restraint and progressive disclosure**: one question per screen; extra fields (RPE, notes) are
    hidden until enabled (Hevy RPE column, Jim's "+ Add note").

## Part 6 — 10 most common amateur tells

1. **Too many accent colours.** A colour per muscle group or category, with pastels everywhere
   (JEFIT-style). Our pastel muscle families are this tell.
2. **Tinted, low-contrast canvas** (ivory/cream) with pastel cards. Contrast is low and everything
   looks washed out and "kids' app".
3. **Decorative colour**: coloured card backgrounds that carry no meaning, or green and clay used
   for both brand and status.
4. **Weak type hierarchy**: everything the same size and weight, or too many sizes; bold used
   everywhere.
5. **Proportional or monospace digits** in tables and timers. Numbers jitter, or look like a
   terminal (Jim removed monospace).
6. **Inconsistent radii, borders and shadows**: pill buttons next to sharp cards next to
   12-px-radius inputs, plus heavy drop shadows.
7. **Emoji and clip-art** as icons or celebration; confetti overload.
8. **Centred everything**: centred headings, lists and paragraphs instead of a strong left edge.
9. **Boxes in boxes**: cards inside cards with borders, and wasted vertical space that pushes the
   set table below the fold.
10. **Blocking modals and confirm dialogs** mid-set, ambiguous brightest elements, and destructive
    actions next to primary ones (Jim's ✓ double-tap delete; Finish beside Cancel).

---

## Part 7 — Implications for our redesign (input for the design spec)

- **Archetype:** **A (iOS-native utilitarian) + D (data-instrument numerals)**, light by default
  with a real dark mode, because gyms are dim and sweaty, and Hevy/Fitbod users prefer dark.
- **Palette:** neutral white `#FFFFFF` / grouped `#F2F2F7`, ink `#111` / `#6B6B6B` / `#C7C7CC`,
  and **one** accent. The owner liked green, so a single deep, confident green (not pastel) can be
  that accent, with green no longer used for "done". A system green or teal tint can mark done.
  Red is reserved for destructive actions. Muscle groups get a **single-hue intensity ramp** on the
  body map, not pastel families.
- **Type:** the system stack (`-apple-system, "SF Pro", Inter`) with `font-variant-numeric:
  tabular-nums`. The Set screen hero weight × reps is about 56-64 px semibold; the rest timer is
  about 64-72 px. Use 3-4 text sizes per screen.
- **Set screen:** keep the keypad (better than the native one for one hand), but put ✓/Next in it and
  reach "as prescribed" in **1 tap**. Show a target vs. actual row (Alpha Progression), a
  non-blocking rest bar with ±15 s/Skip, and a PR toast with one haptic.
- **IA:** the home screen becomes "Today / Next day of program" with one Start CTA. The active
  workout is a collapsible layer. Use 4 tabs (Workout, Program, History, Exercises) with Settings
  under a gear icon.

## Sources

- Strong: https://www.strong.app/ · https://screensdesign.com/showcase/strong-workout-tracker-gym-log · https://enterprise.avante.io/blog/2018/10/the-strong-exersice-tracker-app · https://repreturn.com/strong-app-review/
- Hevy: https://www.hevyapp.com/ · https://www.hevyapp.com/features/track-workouts/ · https://www.hevyapp.com/features/workout-rest-timer/ · https://www.hevyapp.com/features/workout-set-types/ · https://www.hevyapp.com/features/workout-settings/ · https://screensdesign.com/showcase/hevy-workout-tracker-gym-log · https://repreturn.com/hevy-app-review/
- Fitbod: https://fitbod.me/ · https://help.fitbod.me/hc/en-us/sections/1500000505721-Workout-Schedule-Logging · https://www.techradar.com/health-fitness/fitbod-app-review · https://health.yahoo.com/wellness/fitness/online-fitness/articles/fitbod-app-review-good-beginners-193000972.html · https://gymgod.app/blog/fitbod-review
- JEFIT: https://www.jefit.com/blog/upcoming-enhancements-revamped-workout-tab-and-improved-exercise-screens · https://apps.apple.com/app/id449810000
- Boostcamp: https://www.boostcamp.app/ · https://boostcamp.app/vs/strong · https://www.boostcamp.app/best/rpe-rir · https://www.garagegymreviews.com/boostcamp-review
- Ladder: https://www.joinladder.com/ · https://www.garagegymreviews.com/ladder-app-review
- Future: https://www.future.co/
- Apple: https://developer-mdn.apple.com/design/human-interface-guidelines/patterns/workouts · https://macrumors.com/roundup/watchos-26 · https://the5krunner.com/2025/06/10/wwdc-2025-a-new-design-fitness-buddies-and-mixed-reactions/ · https://www.imore.com/health-fitness/apple-watch/watchos-10-is-great-but-its-ruined-the-apple-watch-fitness-app
- Whoop: https://www.925studios.co/blog/whoop-design-breakdown · https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/
- Strava: https://www.strava.com/ · https://bikeradar.com/news/strava-beta-test-layout · https://the5krunner.com/2025/07/16/strava-app-redesign/
- Gymshark: https://tomsguide.com/wellness/fitness/gymshark-training-app-review-effective-workouts-for-free
- Nike: https://gps.standards.nike.com/Brand/fonts-and-typography · https://opendesigner.io/design-systems/nike
- Gentler Streak: https://developer.apple.com/design/awards/2024 · https://bgr.com/tech/gentler-streak-gets-a-major-redesign-focused-on-your-wellbeing/ · https://www.gentler.app/
- Alpha Progression: https://apps.apple.com/us/app/gym-workout-alpha-progression/id1462277793 · https://alphaprogression.com/en/blog/alpha-progression-vs-hevy · https://www.findyouredge.app/news/best-progressive-overload-trackers-2026
- Liftosaur: https://liftosaur.com/ · https://www.liftosaur.com/blog/posts/liftosaur-overview/
- StrongLifts: https://stronglifts.com/ · https://screensdesign.com/showcase/stronglifts-weight-lifting-log · https://dr-muscle.com/stronglift-5x5-app-review/
- Caliber: https://caliberstrong.com/ · https://www.garagegymreviews.com/caliber-app-review
- Oura: https://ouraring.com/ · Tonal: https://www.tonal.com/
- Benchmark UI review vs Strong/Hevy: https://github.com/traxon99/jim/issues/317
