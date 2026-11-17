# Feature-gap research: connectivity, calculators, progress photos (2026-11-17)

The owner asked: are we missing features other apps have? Connectivity, a calculator, and maybe
a photo so the app can track the body's transformation.

**Short answer.**
- **Progress photos** are the one real gap. Hevy, Strong, JEFIT and MacroFactor all have them,
  and dedicated photo apps show how to do them well: a ghost of the last photo to match the
  pose, a slider to compare, and photos kept on the device.
- **Connectivity** is mostly closed, or closed off by iOS. One cheap gap is left: bringing the
  smart scale's bodyweight *in* from Apple Health through a Shortcut. We already send workouts
  *out* that way.
- **Calculators** are mostly built in already (plate line, warm-up ramp, Est. strength). The gap
  is a small "what can I lift" sheet: 1RM from any set, and a %1RM or rep-max table rounded to
  your plates. Setgraph and Boostcamp have one.

This builds on `docs/roadmap/feature-research.md` (2026-09-27), which ruled several things out
on platform grounds, and on `research.md` in this folder (the design study, sources S1–S39).

**Method and caveats.**
- Sources were web searches and page reads on 2026-11-17. I looked at no screenshots in this
  pass, so every claim is **[read]**. Where a claim comes from `research.md`'s screenshot study,
  it is marked **[shot, S#]**.
- Many pages are vendor marketing or written by competitors (GainFrame, JEFIT, Setgraph and
  Boostcamp blogs). Such claims are marked *(vendor)*.
- Reddit was not read directly.

---

## 1. What we have (inventory, from the repo)

| Area | What exists | Where |
|---|---|---|
| Logging | Weight and reps Dials with a keypad. Presets from last time. Set kinds (warm-up, drop, failure, AMRAP). Optional Effort (RIR 0–3+). Exercise and Session notes. Edit and delete sets | `src/ui/SetScreen.tsx`, `src/domain/setKind.ts`, decision 0014 |
| Rest | Per-set rest, a dial, a sound, wake lock, and a **Rest push** from the Worker when the phone is locked | `src/ui/RestDial.tsx`, `src/ui/restSound.ts`, `src/worker/restAlarm.ts`, decision 0023 |
| Reminders and badge | Weekday and time push reminders, and an app-icon badge while a Session runs | `src/ui/NotificationSettings.tsx`, `src/ui/useAppBadge.ts` |
| At the rack | Plate line from your own Plate inventory, a Warm-up ramp, warm-up rest | `src/domain/plates.ts`, `src/domain/warmup.ts`, decision 0015 |
| Progression | Next-weight step that reads Effort, planned Deload weeks, stall rules | `src/domain/progression.ts`, `effortStep.ts`, `deload.ts`, decision 0020 |
| Stats | Verdicts, Ladders, Est. strength (Epley), PRs (heavier or better e1RM), weekly sets per muscle against 10–20, body heat map, Last week card, calendar | `src/domain/stats/*`, `src/domain/series.ts`, decisions 0017 and 0024 |
| Body | A body log with bodyweight plus waist, chest, arms and thighs, one entry a day, charted. Bodyweight counts in volume | `src/domain/bodyLog.ts`, `src/features/progress/BodyPage.tsx`, decision 0021 |
| Exercises | An 876-exercise library with photos, video links and muscle maps. Custom Exercises. Swaps and alternatives | `src/ui/ExerciseDetail.tsx`, decisions 0005 and 0018 |
| Programs | User Programs (create, copy, edit), AMRAP-last, rep ranges, rest | `src/ui/ProgramEditor.tsx`, decision 0010 |
| Data | JSON backup and restore, CSV export of sets, Strong and Hevy CSV import (appends), D1 sync behind Access | `src/services/transfer.ts`, `src/domain/csv.ts`, `src/domain/importers/*`, decisions 0022 and 0007 |
| Connectivity | Apple Health **write** through the "Workout Tracker to Health" Shortcut (`shortcuts://run-shortcut`). A summary shared as text with `navigator.share` | `src/ui/healthShortcut.ts`, `src/ui/SessionSummary.tsx:219` |
| Not present | Progress photos, supersets and circuits, timed or cardio sets, a 1RM or %1RM calculator outside the Lift page, a strength score (DOTS) or ratio to bodyweight, lb units in the UI (only the importers convert), `navigator.storage.persist()` (no call in `src/`) | grep of `src/` |

The roadmap already **ruled out**, on iOS-PWA grounds: widgets, Live Activities, a Watch app,
Web Bluetooth heart-rate straps, direct HealthKit reads, and vibration. It ruled out as unwanted:
a social feed, streaks and badges, and nutrition (`docs/roadmap/feature-research.md`, "Ruled out").
Progress photos were an explicit **non-goal of R7** (`docs/roadmap/roadmap.md`, R7). They were
never ruled out.

---

## 2. What competitors offer

### 2.1 Connectivity

**Apple Health and Health Connect.**
- Hevy writes the finished workout's type, duration and active energy to Apple Health and
  Health Connect. The set detail stays in Hevy. [read]
  https://help.hevyapp.com/hc/en-us/sections/36957443687831-Apple-Health
- Boostcamp syncs bodyweight with Apple Health **both ways** and saves workouts there. *(vendor)*
  [read] https://www.boostcamp.app/features
- Strong syncs bodyweight, body fat and workouts with Apple Health. The direction is not stated
  (third-party). [read] https://macmyths.com/apps/strong/
- Liftosaur's Apple Health and Health Connect sync is free (third-party review). [read]
  https://www.sensai.fit/blog/liftosaur-review

**Watch apps.**
- Strong: "a fully-featured Apple Watch app". [read] https://apps.apple.com/app/strong/id464254577
- Hevy's Watch app has heart rate, routines, set types and complications. Reviews report sync
  errors. [read] https://apps.apple.com/app/id1458862350
- Fitbod's Watch app is praised, but reviews say logged sets can disappear. [read]
  https://www.techradar.com/health-fitness/fitbod-app-review ,
  https://help.fitbod.me/hc/en-us/sections/1500000534381-Troubleshooting-for-iOS-and-Android
- JEFIT's Watch app: a reviewer calls it "basically useless" because of connection errors. [read]
  https://apps.apple.com/us/app/id449810000
- **Pattern:** Watch apps are table-stakes natively and a frequent source of complaints. We
  can't build one (PWA).

**Garmin.**
- Hevy: "not possible yet", with no API access. [read]
  https://help.hevyapp.com/hc/en-us/articles/35361029194647
- Users route around it: Hevy → Apple Health → Breakaway → Garmin. [read]
  https://forum.intervals.icu/t/integration-with-hevy/114887

**Strava.**
- In May 2026, Strava relaunched strength training: a workout log, muscle maps and 14 partners
  (Hevy, Fitbod, Garmin and others). How partners upload was not stated. [read]
  https://the5krunner.com/2026/05/21/strava-strength-training/ ,
  https://www.whoop.com/us/en/press-center/strava-overhauls-strength-experience-with-expanded-partner-ecosystem-new-workout-log-and-muscle-maps/

**Live Activity.**
- Hevy's lock-screen widget shows the rest timer (±15 s and skip), the current set and last
  time's set, and can complete a set. It is in the free tier. [read]
  https://www.hevyapp.com/features/live-activity/ ,
  https://help.hevyapp.com/hc/en-us/articles/35649846517399
- Setgraph has a rest timer on the Lock Screen and in the Dynamic Island. [read]
  https://apps.apple.com/us/app/setgraph-gym-workout-tracker/id1209781676

**Public API.**
- Hevy has a REST API for Pro subscribers (`api.hevyapp.com/v1`). It covers workouts, routines
  and a change feed, and the community has built MCP servers on it. [read]
  https://docs.serval.com/sections/integrations/hevy , https://apis.io/providers/hevy/ ,
  https://glama.ai/mcp/servers/@chrisdoc/hevy-mcp
- Liftosaur offers a REST API and an MCP server in Premium (one review). [read]
  https://www.sensai.fit/blog/liftosaur-review

**Coach sharing.** Hevy shares progress photos with "your coach" through Hevy Coach. [read]
https://help.hevyapp.com/hc/en-us/articles/35385479603479

**Smart scales (Withings, Renpho)** reach lifting apps through Apple Health.
- An Apple Shortcut can read the latest Body Mass with *Find Health Samples* (limit 1, sorted by
  date) and pass the value on. [read]
  https://matthewcassinelli.com/actions/find-health-samples/ ,
  https://dev.to/yukihirokimura/i-automated-my-weight-logging-into-notion-and-gave-myself-a-new-daily-chore-2coa
- One user found the scale's data reached Health only after opening the Withings app (same
  source).

### 2.2 Calculators and tools

| Tool | Who has it | Notes |
|---|---|---|
| Plate calculator | Strong (Pro), Alpha Progression (Pro), Liftosaur, Setgraph ("Smart Plates"), Boostcamp (10 free uses, then Pro), Stronglifts | Alpha shows the nearest loadable weight below [read] https://alphaprogression.com/en/glossary/plate-calculator ; Boostcamp's cap [read] https://www.boostcamp.app/features ; Liftosaur uses equipment-aware rounding [read] https://www.liftosaur.com/blog/posts/liftosaur-overview/ ; Strong [read] https://apps.apple.com/app/strong/id464254577 |
| Warm-up calculator | Strong (Pro), Alpha (Pro, adapts to experience and the plates available), Stronglifts | [read] https://alphaprogression.com/en/blog/alpha-progression-guide , https://stronglifts.com/app/ |
| 1RM estimator, %1RM or rep-max (XRM) table | Setgraph (Epley or Brzycki, your choice; an XRM table; a "Set 1RM" button after a top single), Boostcamp (free 1RM calculator), StrengthLog | [read] https://setgraph.app/features/1rm , https://www.boostcamp.app/free-workout-app , https://help.strengthlog.com/help-article/calculators/ |
| RPE and RIR | Alpha (RIR tracker, partly Pro), Boostcamp roundup | [read] https://alphaprogression.com/en/blog/reps-in-reserve , https://www.boostcamp.app/best/rpe-rir |
| Strength score and standards | Fitbod "Strength Score" and estimated strength [shot, S18/S19]. No other confirmations found | `research.md` S18, S19 |
| BMI and body fat | JEFIT auto-calculates BMI. Body fat is typed in everywhere (Hevy, JEFIT); no app estimates it from photos except the AI photo apps | [read] https://apps.apple.com/us/app/id449810000 , https://gainframe.app/blog/hevy-app-review/ *(competitor)* |
| Interval timer | JEFIT (swipe to set intervals; reviews say the timer freezes) | [read] https://apps.apple.com/us/app/id449810000 |
| Rest timer variants | Hevy and Setgraph: ±15 s and skip from the lock screen | see 2.1 |

### 2.3 Body transformation and progress photos

**Lifting apps.**
- **Hevy.**
  - Profile → Measures → + → Add Picture, taken with the camera or from the library. One
    photo per day, with optional bodyweight, body fat and 14 circumferences.
  - Tap two photos to compare them side by side. **No slider.** Share makes an image.
  - Deleting a photo keeps the measurements.
  - Photos are private even on a public profile.
  - Hevy suggests one set of photos every 4–5 weeks, because weekly change is too subtle to see.
    [read] https://www.hevyapp.com/features/progress-photos/ ,
    https://help.hevyapp.com/hc/en-us/articles/34462134138775
  - The free tier gets only weight and waist (competitor review). Multi-angle check-ins need a
    workaround (one angle a day). [read] https://gainframe.app/blog/hevy-app-review/
- **MacroFactor.**
  - Body Metrics entries hold **front, side and back** slots for one day, and up to 21
    measurements, including waist-to-height and waist-to-hip.
  - A gallery switches angles within a day and shows that day's metrics on the photo.
  - A Before/After view puts two dates side by side and makes a shareable image.
  - It doesn't say whether photos feed its weight trend. [read] https://macrofactor.com/?p=4697
- **Strong** lists "progress pictures" and measurements (Pro for measurements). [read]
  https://apps.apple.com/app/strong/id464254577 , https://www.sensai.fit/blog/strong-app-review-2026
- **JEFIT** lets you take a photo after a workout, compare photos, and upload one from the Wear
  OS summary. [read] https://apps.apple.com/us/app/id449810000

**Dedicated photo apps** set the bar for capture and comparison.
- **PhotoJourney.**
  - Capture: "Ghost Mode" alignment, a thirds grid, body templates and a countdown timer.
  - Compare: side by side, swipe-to-reveal, and a zoom saved per journey.
  - Export: HD timelapse and GIF.
  - Reminders and streaks.
  - **No servers**: photos stay on the device and are backed up to your own iCloud.
  - Complaints: the price ($35 a year), and photos lost when "in app only" storage met iCloud
    settings. [read] https://apps.apple.com/us/app/id6499454966
- **Recaptr** auto-aligns each new photo to the last for a steady timelapse. Photos are
  on-device unless Pro cloud backup is on. [read, search summary]
  https://play.google.com/store/apps/details?id=com.recaptr.app
- Fitness Trackr, Progressly, SideLens, Dayloop and Formlapse all have a ghost overlay plus a
  slider. PicProgress has several angles per check-in and position presets. [read, search
  summaries] https://mwm.ai/apps/fitness-trackr-progress/6755519347 ,
  https://appgoblin.info/apps/6789591055 , https://apps.apple.com/us/app/id6759226438 ,
  https://www.producthunt.com/products/picprogress-progress-photos
- Capture advice: same light, same time of day, same distance and pose. [read]
  https://gainframe.app/blog/5-tips-better-progress-photos/ *(competitor)*

**Privacy is the loudest risk.**
- Fitify left about 138,000 progress photos in an open Google Cloud bucket. [read]
  https://www.mactech.com/2025/07/16/cybernews-claims-ios-fitify-app-has-a-massive-data-leak
- A Move With Us glitch reportedly showed users each other's before-and-after photos. [read]
  https://gizmodo.com/rachel-dillon-move-with-us-app-before-after-gym-pics-1849511529
- Several apps now market "no accounts, no servers" as the feature. [read]
  https://mwm.ai/apps/photoprogress/6764219988 , https://liftlog-web.github.io/liftlog-privacy
- **Pattern:** the best apps do three things: (1) a ghost overlay at capture, (2) a slider or
  side-by-side tied to that day's weight and measurements, (3) local-first storage. Lifting
  apps do (2) weakly and (1) rarely. Dedicated apps do all three but don't know your lifts.
  **Nobody puts a photo next to "Est. strength +8 %, waist −3 cm, bodyweight −2 kg".**

### 2.4 Other commonly expected features

- **Supersets and circuits.** Hevy groups any number of exercises and scrolls through them
  ("smart superset scrolling"). [read] https://www.hevyapp.com/features/what-are-supersets/ ,
  https://www.hevyapp.com/features/workout-settings/
- **Gym selfie in the workout.** Hevy attaches media to workout posts. [read]
  https://www.hevyapp.com/features/gym-selfie-footage/
- **Social feed and discovery.** Hevy. [read] https://www.hevyapp.com/features/discovery-feed/
- **Monthly report** (Hevy [shot, S13]) and **shareable cards** (Hevy [shot, S10]).
- **AI-generated workouts.** Fitbod's algorithm [shot, S16].

---

## 3. The iOS PWA constraints that matter here

- **Camera.**
  - `<input type="file" accept="image/*" capture="environment|user">` opens the native camera
    and hands back a file. [read]
    https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture
  - The native camera can't show our ghost overlay.
  - `getUserMedia` *can* render a live preview under a ghost, but in **installed (standalone)
    PWAs** it has a long bug history: it fails, freezes on iOS 17.5.1, stops when the route
    changes, and re-prompts for permission on every route change. A comment from May 2025 still
    sees it on iOS 18.1.1. [read] https://bugs.webkit.org/show_bug.cgi?id=185448 ,
    https://bugs.webkit.org/show_bug.cgi?id=275527 , https://bugs.webkit.org/show_bug.cgi?id=215884 ,
    https://discussions.apple.com/thread/256081579
  - **Design consequence:** use a live ghost through `getUserMedia` when it works, keep the
    stream on one route (no navigation while the camera is open), and always fall back to
    `capture` plus a ghost **after** the shot (drag or pinch the new photo to line up with the
    old one).
- **Storage.**
  - Home Screen web apps get the same quotas as Safari: up to 60 % of the disk per origin for a
    browser. Data is "best-effort" and can be evicted, least recently used first.
    `navigator.storage.persist()` asks for protection, and WebKit's heuristics favour Home
    Screen apps. [read] https://webkit.org/blog/14403/updates-to-storage-policy/
  - The app never calls `persist()` today (grep of `src/`). That has to change before photos,
    which can't be rebuilt from the log.
- **Server.**
  - A D1 row or BLOB holds at most 2 MB, and the Free-plan database at most 500 MB. [read]
    https://developers.cloudflare.com/d1/platform/limits/ So photos can't go in D1.
  - R2's free tier: 10 GB-month, 1 M writes and 10 M reads a month, free egress. [read]
    https://developers.cloudflare.com/r2/pricing/ At about 300 KB per compressed photo and 3
    angles every 2 weeks, a year is about 23 MB. That is far inside the free tier.
- **Still impossible** (unchanged from the roadmap): HealthKit reads, a Watch app, widgets,
  Live Activities, and Bluetooth heart-rate straps. Apple Shortcuts is the only bridge to
  Health, in both directions.

---

## 4. Gap table

Value is for one serious lifter on an A/B program. Effort is S (days), M (about a week) or L
(weeks) in this stack. Clutter is the risk of crowding the calm UI.

| # | Feature | Competitors (and how well) | We have it? | Value | Effort | Clutter |
|---|---|---|---|---|---|---|
| 1 | Progress photos (capture, gallery) | Hevy (1 a day, no slider), MacroFactor (front, side, back), Strong, JEFIT; photo apps much better | **No** (R7 non-goal, `roadmap.md`) | **High** | M | Low (lives on the Body page) |
| 2 | Ghost overlay or pose guide at capture | PhotoJourney, Fitness Trackr, Progressly, SideLens, Dayloop; lifting apps rarely | No | High (it is what makes photos comparable) | M (getUserMedia flaky → after-shot fallback) | Low |
| 3 | Compare two dates (slider or side by side) with that day's metrics | MacroFactor (side by side + metrics), Hevy (side by side), photo apps (slider) | No | High | S–M | Low |
| 4 | Photo privacy: on-device by default, encrypted backup | PhotoJourney (no servers), LiftLog; Fitify leak as the counter-example | n/a (the app keeps the log in IndexedDB, `src/storage/db.ts`) | High | M (R2 + Web Crypto, if sync) | None |
| 5 | Bodyweight **in** from Apple Health (smart scale) | Boostcamp (two-way), Strong, JEFIT | **Partly**: manual entry only (`BodyPage.tsx`); Health is write-only (`healthShortcut.ts`) | High | S (a second Shortcut + URL fragment handler) | None |
| 6 | Workouts **out** to Apple Health | Hevy, Strong, Boostcamp, Liftosaur | **Yes**, through a Shortcut (`src/ui/healthShortcut.ts`, decision 0023/E25) | — | — | — |
| 7 | 1RM from any weight × reps, %1RM / rep-max table | Setgraph (Epley/Brzycki, XRM table), Boostcamp, StrengthLog | **Partly**: Est. strength per lift (`src/domain/series.ts` Epley); no ad-hoc calculator or % table | Med–High | S | Low if one sheet |
| 8 | Plate calculator | Strong, Alpha, Liftosaur, Setgraph, Boostcamp (mostly paid) | **Yes** (`src/domain/plates.ts`, inventory-aware) | — | — | — |
| 9 | Warm-up calculator | Strong, Alpha, Stronglifts | **Yes** (`src/domain/warmup.ts`) | — | — | — |
| 10 | RIR/RPE logging | Alpha, Boostcamp, Hevy | **Yes**, optional Effort chips (decision 0014) | — | — | — |
| 11 | Relative strength (×bodyweight), DOTS/Wilks, strength standards | Fitbod Strength Score [shot S18/S19]; few others | No (body log + e1RM exist, unused together) | Med | S | Low (one line on Lift page) |
| 12 | Rest timer on lock screen (Live Activity) | Hevy, Setgraph | **Partly**: Rest push when locked (decision 0023); Live Activity impossible | — | impossible | — |
| 13 | Apple Watch / Wear OS app | Strong, Hevy, Fitbod, JEFIT (all with sync complaints) | No — impossible in a PWA | Med | impossible | — |
| 14 | Garmin / Strava | Strava partners: Hevy, Fitbod (May 2026); Garmin direct: none of them | No | Low (Health already reaches them via Breakaway/Health) | M–L (Strava OAuth, API terms unverified) | Low |
| 15 | Supersets / circuits | Hevy (any size, smart scrolling), Strong, JEFIT | No (parked R10) | Low–Med (A/B program doesn't use them) | M | Med |
| 16 | Timed sets, interval/EMOM timer, cardio | JEFIT interval timer (buggy), Hevy duration timers | No (parked R10) | Low | M | Med |
| 17 | Shareable image of a session / comparison | Hevy shareables [shot S10], MacroFactor before/after image | **Partly**: summary shared as text (`SessionSummary.tsx:219`) | Low–Med | S (canvas → `navigator.share` files) | Low |
| 18 | Monthly / yearly report | Hevy monthly report [shot S13] | **Partly**: Last week card (`stats/weekCard.ts`) | Low–Med | S | Med |
| 19 | Public API / MCP | Hevy (Pro), Liftosaur (Premium) | **Partly**: Worker `/api/*` exists behind Access; not documented for outside use | Low (one user; CSV/JSON export exists) | S–M (service token) | None |
| 20 | Coach/trainer sharing | Hevy Coach (incl. photos) | No | Low (single trainee) | L | Med |
| 21 | More body measurements (hips, calves, forearms, neck), ratios | Hevy 14, MacroFactor 21 incl. waist-to-height | **Partly**: weight + waist/chest/arms/thighs (`bodyLog.ts`) | Low–Med | S | Low if behind "Add measurements" |
| 22 | Body-fat estimate (Navy tape method) / BMI | JEFIT BMI; others typed in | No (R7 non-goal) | Low | S | Low |
| 23 | lb units | All major apps | No (kg only; importers convert, `importers/units.ts`) | Low (owner lifts in kg) | M (dials, ladders, plates) | None |
| 24 | Social feed, streaks, badges, AI workout generator | Hevy feed, Fitbod AI | No — ruled out (`feature-research.md`) | Low | — | High |

---

## 5. Recommendation: top 5 to build

The app's phases are plan → train → progress → come back. Its tabs are Home · Progress ·
Sessions · Program.

### 1. Progress photos with a ghost overlay (Progress → Body)

The owner's ask, and the only High-value gap. It ties the "transformation" story to data the
app already has.

- **Where.** On Progress → Body, a "Photos" strip sits above the bodyweight chart: the latest
  check-in's front, side and back thumbnails and its date. Its button reads "Take check-in
  photos". There is no new tab. **Come back:** the existing Reminder system gets an optional
  "Photo check-in every 2 or 4 weeks, same time", off by default. Hevy's own advice is 4–5
  weeks.
- **Capture flow.**
  1. Pick an angle: Front, Side or Back (MacroFactor's three slots, against Hevy's
     one-a-day limit).
  2. If `getUserMedia` works in standalone mode, open a full-screen live preview with the last
     photo of that angle as a **ghost** (about 35 % opacity, with an edge-only toggle). Add a
     body-outline guide on the first check-in, a 5 s / 10 s countdown for a mirror-free tripod
     shot, and a reminder line: "Same light, same distance, relaxed".
  3. **Fallback**, and the default if the live camera fails once: `<input capture="user">`
     opens the native camera. Then an **align screen** lays the new photo under the ghost, and
     the trainee pinches and drags to match. The transform is saved; the pixels are not altered.
  4. Downscale to about 1600 px on the long edge and save as JPEG at about 0.8 (roughly
     300 KB). Strip EXIF, because a canvas re-encode drops GPS.
  5. Attach the photos to that day's **body log entry**, so weight and waist sit next to the
     photo. Offer "Log today's weight too?" when the entry has no weight.
- **Compare view.** Tap a check-in, then "Compare with…", which defaults to the oldest.
  - The default is a **slider** (drag to reveal) at the saved alignment. Toggles switch to side
    by side and between angles.
  - Under the photos, one delta line from data we already have, for example:
    "Δ 12 weeks · bodyweight −2.1 kg · waist −3 cm · Est. strength: squat +8 %, bench +5 %".
    This is the differentiator no competitor has.
  - Later, optionally: a timelapse of one angle, made on the device with `<canvas>` frames
    exported as a GIF or WebM.
- **Storage and privacy.**
  - **Local only by default.** Blobs go in a new IndexedDB table, `photos`, in the existing
    Dexie DB (`src/storage/db.ts`), with metadata `{id, day, angle, transform, w, h}`.
  - Call `navigator.storage.persist()` the first time a photo is saved, and show a warning when
    it isn't granted.
  - The JSON backup gets an option, "include photos", as a zip or a separate file.
  - **Optional sync**, off by default, with its own switch: encrypt on the device with Web
    Crypto AES-GCM using a key that never leaves the phone (shown once as a recovery code, or
    kept in the backup), then upload to **R2**, not D1, because of the 2 MB row limit. The
    Worker stores only ciphertext, behind Access.
  - Never share a photo except by an explicit tap. Show nothing on Home, and no thumbnails in
    notifications.
  - Optionally blur thumbnails until tapped (a "gym-safe" setting).
- **iOS PWA constraints** (section 3): the camera is flaky in standalone mode, so the
  after-shot alignment is the fallback; the camera stream must stay on one route; storage can be
  evicted without `persist()`; photos can't be rebuilt from the log, so the backup must offer
  them.
- **Needs a decision record:** "Progress photos are local-first blobs, outside the synced
  settings". The body log stays one synced setting (decision 0021/R7) and carries only photo ids.

### 2. Smart-scale bodyweight from Apple Health (Settings → Apple Health; lands on Progress → Body)

- **Why.** Withings and Renpho users already have their weight in Health. Typing it again is
  why body logs go stale. Boostcamp and Strong read it; we can't read HealthKit directly.
- **How.**
  1. A second documented Shortcut, "Health to Workout Tracker": *Find Health Samples* (Body
     Mass, latest, limit 1) → *Get Details* (Value, Date) → *Open URL*
     `https://<app>/#/body?bw=82.4&day=2026-11-17`.
  2. Use the **fragment**, not a query string, so the value never reaches the server or the
     logs.
  3. The app validates it with `validateBodyEntry` and asks once: "Add 82.4 kg for 17 Nov?"
  4. Optional: a personal Shortcuts automation ("when I open the Withings app", or 07:00 daily).
- **Effort.** S. It reuses the `healthShortcut.ts` step-list pattern and `HealthSetup.tsx`.
- **Clutter.** None. It only shows in setup.

### 3. "What can I lift" calculator sheet (train: Set screen; progress: Lift page)

- **Why.** The rack tools exist, but there is no quick way to answer "I did 90 × 6, so what's
  my 3-rep weight?" or "what is 80 % for my 5/3/1 friend?". Setgraph's XRM table is the model.
- **What.** One Sheet (`src/ui/Sheet.tsx`):
  - Weight × reps in, filled from the Dial or the best recent set.
  - Out: Est. 1RM (Epley, the same function as `series.ts`, so the numbers agree) and a table
    of 1–12 RM and 50–95 %. Every row is **rounded to a loadable weight** with the Plate
    inventory, and shows a plate line on tap.
  - An optional RIR column turns "8 reps @ 2 RIR" into a 10RM-equivalent.
- **Where.** A quiet "Calculator" link on the Lift page header and in the Set screen's overflow.
  Nothing on Home.
- **Effort.** S. It is pure domain code (`src/domain/rmTable.ts`) plus one sheet.

### 4. Relative strength next to bodyweight (Progress → Lift page and Body)

- **Why.** The transformation story is "lighter and stronger", and we hold both series. A cut
  that keeps Est. strength while losing 4 kg is progress the current verdicts can't see.
- **What.**
  - On the Lift page: "Est. strength 1.45 × bodyweight", using the body log entry at or before
    each Session (decision 0021 already looks it up).
  - On Body: an optional DOTS total for squat, bench and deadlift when all three are in the
    program.
  - Keep it to one line, with no standards leaderboard.
- **Effort.** S. **Clutter:** low, if it stays in the Lift header and is hidden when there is
  no bodyweight.

### 5. Share as image (end of a Session; the photo compare view)

- **Why.** The summary is shared as text today. A clean card, and the photo comparison when the
  trainee chooses, is the most common "connectivity" lifters actually use: send it to a friend
  or a coach. It costs no accounts and no feed.
- **What.** Render to `<canvas>`: Workout name, date, duration, top sets, PRs, and the muscle
  map, in the app's palette. Then call `navigator.share({ files: [png] })`, falling back to a
  download. For photos it is opt-in on every share, and nothing is ever automatic.
- **Effort.** S.

### Not recommended now

- **Supersets** stay first in line in R10 if the program changes.
- **Strava** waits until its strength API terms for indie apps are verified.
- **Watch, Live Activity, widgets and HealthKit reads** are impossible.
- **Social feed, streaks and AI workouts** were ruled out.
- **lb units** don't match the owner, who lifts in kg.
