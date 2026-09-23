# Device checks: install, offline cold-launch, the styled shell, and offline/maps/tabs at E5's head (E2-T7, E3, E5-T21)

These checks cannot run in CI or an emulator. iOS is the only platform with the install,
offline cold-launch and safe-area behaviour this app depends on, so a person runs these steps
by hand on a real iPhone, in Safari, and records what actually happened. This document is that
script. It proves outcomes [O12] and [O13] from the `E2-T7` ticket — re-run here, at E3's styled
head, as [O19] and [O20], which `E3-T10` renumbered from those same two outcomes so they do not
collide with E3's own spec numbering. Continuing in the same sitting once the app is installed,
it also proves [O17] from `E3-T6`, and [O15], [O16] and [O18] from `E3-T9`. Re-run again at E5's
head in the same sitting, it also proves [L17] and [M17] from `E5-T21`. All eight outcomes below
are checked once, in one sitting, at the same installed build.

Follow the steps in order, exactly as written. Do not skip the "clear a previous install"
section on a re-run — skipping it is the single most common way to get a false result.

## Preconditions

- **Device:** an iPhone running iOS, using **Safari**. Safari is the only browser on iOS that
  can add a web app to the home screen — Chrome, Firefox and any other iOS browser are all
  Safari under the hood but do not expose "Add to Home Screen" for a PWA the same way, so this
  must be done in Safari itself, not any other browser icon.
- **URL:** `https://assafcaf.github.io/WorkoutTracker/`
- **Deployment must have completed first.** Before starting, load the URL once in Safari over a
  normal (non-airplane-mode) connection and confirm the app loads — a picker screen with a
  workout program on it, not a 404 or a GitHub Pages placeholder page. If it does not load, the
  deployment has not gone out yet or GitHub Pages is not serving it; stop here and report that
  this task is blocked on deployment. Do not attempt the install/offline steps against a URL
  that has never loaded successfully — the steps below all depend on there being a version
  of the app already reachable.

## Clearing a previous install (do this before every re-run)

If this is the very first run on this phone, skip to [O12]. Otherwise, a previous run has left
two things behind that must both be removed, or the re-run will not be clean:

1. **Delete the home-screen icon.** Long-press the app's icon on the home screen, tap
   "Remove App" (or the "-" badge, depending on iOS version), then confirm "Delete App".
   Expected result: the icon is gone from the home screen.

2. **Clear the site's data.** Deleting the icon in step 1 removes the shortcut only — it does
   **not** clear the site's IndexedDB database, service worker registration, or cache storage.
   This is the trap: without this step, a "fresh" re-install will silently show the *previous*
   run's logged sessions and a stale `lastExportedAt` badge, and you will not be able to tell
   whether [O13] actually started clean. Clear it explicitly:
   - Open the iOS **Settings** app.
   - Go to **Safari > Advanced > Website Data**.
   - Find `assafcaf.github.io` in the list (use the search box if the list is long).
   - Swipe left on it and tap **Delete**, or tap **Edit**, select it, and tap **Delete**.
   - Confirm the deletion when prompted.

   Expected result: `assafcaf.github.io` no longer appears in the Website Data list.

Only once both steps are done is the phone in a clean state to start [O12].

## Deploying and confirming the commit under test

`.github/workflows/deploy.yml` publishes `dist` to the URL above. It runs automatically on a
push to `main`, and can also be run by hand against any branch — including an unmerged epic
branch — via `workflow_dispatch`. Do this once, before [O12], so the whole sitting below runs
against a build you can actually name:

1. In the GitHub repository, open **Actions > Deploy to GitHub Pages > Run workflow**, and pick
   the branch (or tag/commit) you intend to check — the E3 epic branch's tip for this run.
2. Wait for the run to finish with a green check, then open its details and read the exact
   commit SHA the `actions/checkout` step resolved. Write that SHA down now — it is what goes
   in the result block's "Commit / merged sha checked against" field below. "The epic branch"
   is not precise enough once more commits land on it after this run.
3. Nothing in the built app shows a version string on screen, so the surest way to know you are
   not looking at a stale cached copy is to start from a clean slate: complete "Clearing a
   previous install" below (even on a first-ever run, this also clears any plain-Safari-tab
   cache of the URL from earlier browsing) before loading the URL for the first time in the
   Preconditions check.
4. If you re-run this whole document later against a newer commit, repeat steps 1-3 with the
   new SHA — do not assume a previously-deployed page has picked up new commits on its own.

## [O12] and [O19]: installs to the home screen and launches standalone

[O19] is [O12] verbatim, renumbered by `E3-T10` and re-pointed at E3's styled head instead of
E2's bare one — the same steps prove both, and the expected results below already describe the
styled head. Record them as separate rows in the result block below; they are the same run
checked once, kept distinct because they belong to two different tickets' records.

1. Open Safari and navigate to `https://assafcaf.github.io/WorkoutTracker/`.
   **Expected:** the app loads in a normal Safari tab, with the address bar and Safari's tab
   chrome visible, showing the program picker screen.

2. Tap the **Share** icon (the square with an arrow pointing up, in Safari's toolbar).
   **Expected:** the share sheet opens, listing actions including "Add to Home Screen".

3. Tap **Add to Home Screen**.
   **Expected:** a preview screen appears showing the icon that will be added and an editable
   name field. The name field reads **"Workout"** (not "WorkoutTracker", not the page's
   `<title>`, not a URL). The icon shown is the app's own icon — a designed icon graphic — not
   a screenshot or thumbnail of the current page.

4. Tap **Add** (top-right of the preview screen).
   **Expected:** the preview screen closes and an icon reading "Workout" appears on the home
   screen (you may be dropped onto the home screen, or need to swipe to the page it was added
   to).

5. Tap the new "Workout" icon on the home screen to launch it.
   **Expected:** the app opens **with no Safari chrome at all** — no address bar at the top, no
   tab-switcher button, no bottom toolbar with the share/back/forward/tabs icons. The full
   screen (aside from the iOS status bar) is the app's own content. This is what "standalone"
   display means; if any piece of Safari's UI is visible, this step fails (see "What failure
   looks like" below).

   The brief splash and the status bar area are the app's own near-black
   (`#0B0B0F`) background, not white and not E2's `#111827` — there is no light flash between
   the icon tap and the app appearing. What appears once it renders is the **Workout tab**: the
   program picker's dark `.workout-card` rows (or, if a session is already in progress, a
   "Resume ..." card above them), sitting above a three-tab bar fixed to the bottom of the
   screen (Workout, History, Settings). This is a styled shell behind a tab bar, not E1's bare
   unstyled picker — if what appears instead is a plain white or default-styled page with no tab
   bar, this step fails.

## [O13] and [O20]: cold-launches offline, and a logged set survives a restart

[O20] is [O13] verbatim, renumbered by `E3-T10` and re-pointed at E3's styled head. As with
[O12]/[O19] above, the same steps prove both; record them as separate rows in the result block.

**A cold start is not the same as returning to the home screen.** Pressing the home button or
swiping up briefly and letting go leaves the app suspended in memory — iOS can resume it
without re-running its startup code, which would not prove anything about offline cold-launch.
A cold start means the app's process is killed and iOS starts it fresh. Do this to force one:

- Swipe up from the very bottom of the screen and pause partway (opens the app switcher).
- Find the "Workout" app's card.
- Swipe that card upward, off the top of the screen, until it disappears.

That removes the app from the switcher entirely — the next launch is guaranteed cold.

Now run the check:

1. **Force a cold start** using the steps above (swipe the app card away in the switcher), so
   nothing is running or cached in memory. **Expected:** the app's card is gone from the app
   switcher.

2. **Enable Airplane Mode.** Open Control Center (swipe down from the top-right corner, or up
   from the bottom edge depending on iOS version) and tap the airplane icon.
   **Expected:** the status bar shows the airplane icon; Wi-Fi and cellular are both off.

3. **Cold-launch the app from the home-screen icon** — tap the "Workout" icon on the home
   screen (not from the app switcher, which does not exist right now since you swiped it away).
   **Expected:** the app opens standalone (no Safari chrome, dark `#0B0B0F` shell, as in
   [O12]/[O19]) and the **Workout tab** renders behind the three-tab bar: the active program's
   workouts listed as dark `.workout-card` rows, each with its exercises and a "Start ..."
   button — or, if a session from an earlier step is already in progress, a "Resume ..." card
   above the picker instead. Either is a correct offline render. This happens even though the
   phone has no network connection at all.

4. **Start a workout.** Tap the "Start ..." button under one of the listed workouts (it reads
   "Start" followed by that workout's name).
   **Expected:** the set-logging screen opens, showing a weight dial, a reps dial, a rest timer
   area and a "Log set" button.

5. **Log one set with specific values you write down.** Set the weight dial and reps dial to
   values of your choosing — write the exact numbers here before tapping the button, for
   example: **weight = ___ kg, reps = ___**. Then tap **Log set**.
   **Expected:** the screen advances (the rest timer starts, or the next set opens) with no
   error message. There is no network activity possible — Airplane Mode is still on — so this
   also proves the set was written to on-device storage rather than sent anywhere.

6. **Force another cold start** using the same steps as step 1 (app switcher, swipe the card
   away), while remaining in Airplane Mode.
   **Expected:** the app's card is gone from the switcher, same as step 1.

7. **Cold-launch the app again from the home-screen icon**, still offline, and navigate back to
   the same exercise/set you logged in step 5 (via the history list or by resuming the session).
   **Expected:** the set you logged in step 5 is present, with the **same weight and reps
   values you wrote down** — not defaults, not a different set's values, not missing.

## [O17]: the weight and reps dials still snap to a rung when dragged

Stay on the same installed app, still offline from [O13]/[O20] above, on the set screen you
already have open from step 4 of that section (or open any set screen fresh via a workout's
exercise list if you moved on).

1. Drag the weight dial's scrolling column with your finger and release it between two rungs,
   not squarely on one. **Expected:** the column keeps moving briefly on its own after you let
   go and comes to rest with exactly one rung centred and marked selected — it does not stop
   part-way between two rungs.
2. Do the same on the reps dial. **Expected:** same as step 1 — it settles on a rung, not
   between two.
3. With both dials settled from steps 1-2, note the two values shown, then tap **Log set**.
   **Expected:** the set that gets logged carries exactly the two rung values you noted — not an
   in-between value, and not the values the dials held before you dragged them.

## [O15]: the six screens are dark-on-dark, with the lime primary action

Stay on the same installed app from [O12]/[O13] above — you do not need to reinstall or go
back offline for this section. On each of the six screens below, check for all four of:

- **Dark-on-dark:** the page background and every card sit on a near-black field (no white or
  light-grey panel anywhere).
- **The lime primary action:** the screen's one primary button (where it has one) is the same
  lime-green accent colour, not the page's default blue/grey.
- **Cards on a near-black field:** any card or row sits visibly above the page background as a
  slightly lighter panel, not flush with it.
- **No browser-default serif:** every piece of text is in the system UI sans-serif font — no
  Times/Georgia-style serif anywhere (this shows up if a font failed to apply).

Open each of the following six screens in turn and take a screenshot of each one:

1. **Workout tab** — the tab bar's leftmost (dumbbell) icon. This is the program picker /
   resume-card screen.
2. **History tab** — the tab bar's middle (clock) icon. The list of past sessions.
3. **Settings tab** — the tab bar's rightmost (sliders) icon.
4. **Exercise list** — from the Workout tab, tap "Start ..." under a workout. This is the list
   of that workout's exercises, each showing a set-progress count.
5. **Set screen** — tap any exercise row in the exercise list. This is the two-dial screen
   (weight and reps) with the rest timer and "Log set" button.
6. **Keypad** — on the set screen, tap either dial's number readout (the weight or the reps
   value). This opens the on-screen number pad over the dial.

**Expected:** all four checks above hold on all six screens. Attach a screenshot of each of the
six screens to the run log, labelled with the screen name.

## [O16]: the tab bar and action bar clear the notch and the home indicator

Still on the same standalone install, with the six screens above in front of you:

1. On the Workout, History and Settings tabs, look at the bottom **tab bar**. **Expected:** the
   tab bar's own background extends down to the bottom edge of the screen, but the icons and
   labels inside it sit above the home indicator with visible clearance — nothing is drawn
   underneath or overlapped by the home indicator's on-screen bar.
2. On the exercise list and set screens, look at the bottom **action bar** (the sticky
   "Finish"/"Log set" button strip). **Expected:** same as the tab bar — the button itself sits
   fully above the home indicator, tappable with clearance, not crowded against or hidden by it.
3. On every screen, look at the top of the screen, including the header on the exercise list
   and set screen. **Expected:** no title, icon or button is cut off or drawn underneath the
   notch/status-bar area at the top.

**Expected overall:** on none of the six screens does the notch or the home indicator clip or
overlap any content or control.

## [O18]: nothing scrolls sideways, and everything is one-thumb reachable

On each of the six screens from [O15]:

1. Try to scroll the screen horizontally (a left-right swipe). **Expected:** nothing moves
   sideways — the screen does not pan, rubber-band, or reveal any content to the left or right
   of what was already visible. Vertical scrolling (where a screen is taller than the viewport,
   such as a long history list or exercise list) is expected and fine.
2. Holding the phone in one hand, try to reach every visible control — the tab bar icons, the
   dial step buttons, the keypad's digits, the action bar's button — with just your thumb.
   **Expected:** nothing requires a second hand or a stretch past a comfortable one-thumb reach
   at the phone's own width.

## [L17]: a catalog exercise's detail screen works offline, and "Watch video" opens the right destination for each provider

This section proves `E5-T21`'s [L17]. It re-uses the same installed app from the sections
above — see "Deploying and confirming the commit under test" for redeploying to E5's head first
if you have not already, and "Clearing a previous install" if this is a fresh sitting rather
than a continuation of the sections above. Do both flows below (offline detail screen, then
online "Watch video") back to back for each of the two exercises, so you only need to reach each
exercise's detail screen once.

**Exercise 1: Back squat (YouTube-sourced video).**

1. **Enable Airplane Mode**, same as in the [O13]/[O20] section above.
   **Expected:** the status bar shows the airplane icon; Wi-Fi and cellular are both off.
2. From the Exercises tab, open **Back squat**'s detail screen.
   **Expected:** the screen opens with no error and no blank area — the heading reads "Back
   squat", the profile fields (primary muscle, secondary muscles, equipment, mechanic, force,
   level) show text, the numbered instructions list shows its steps, and at least one photo
   renders as an image (not a "Photos need a connection" placeholder).
3. **Disable Airplane Mode** so the phone is back online.
   **Expected:** the status bar's airplane icon is gone; Wi-Fi or cellular shows connected.
4. On the same Back squat detail screen, tap **Watch video**.
   **Expected:** the video opens in the YouTube app (if installed) or as YouTube in Safari —
   the destination's address is `youtube.com/watch?v=R2dMsNhN3DE`, not the Muscle & Strength
   site.

**Exercise 2: Lunges (Vimeo-sourced video).**

5. **Enable Airplane Mode** again.
   **Expected:** the status bar shows the airplane icon; Wi-Fi and cellular are both off.
6. From the Exercises tab, open **Lunges**'s detail screen.
   **Expected:** same as step 2 — heading "Lunges", profile fields, instructions and at least
   one photo all render with no blank area and no "Photos need a connection" placeholder.
7. **Disable Airplane Mode.**
   **Expected:** same as step 3 — back online.
8. On the same Lunges detail screen, tap **Watch video**.
   **Expected:** unlike Back squat, this opens the Muscle & Strength exercise page in Safari, not
   a Vimeo player and not the YouTube app — Lunges' video is hosted on Vimeo, which is
   domain-locked to the M&S site, so landing on the M&S page is the correct, expected result
   here, not a failure.

## [M17]: the Program tab's maps are legible, the session summary map is thumb-tappable, and the five tabs fit without truncation

This section proves `E5-T21`'s [M17]. Stay on the same installed app from [L17] above (online,
airplane mode off).

1. Open the **Program tab** (second icon in the tab bar).
   **Expected:** the tab opens with no error. Each workout card shows its own small body map,
   and further down the page the "Weekly volume" and "This week" sections each show a body map.
   Every one of these maps is legible at a glance on the phone's own width: the body outline and
   its shaded regions are distinguishable from each other and from the page background, and no
   map's labels or shading are cut off, overlapping, or squeezed illegibly small.
2. Try tapping a shaded region on one of the Program tab's maps (any of the per-workout maps, or
   the "Weekly volume" / "This week" maps).
   **Expected:** nothing happens — no panel opens. This is a known, accepted gap, not a defect:
   only the session summary map (checked in the next steps) supports tapping a region. Do not
   report the Program tab's maps as a failure for not responding to a tap.
3. Open a session summary: either tap **Finish** at the end of an in-progress workout, or open
   the **History tab** and tap **Open session** on any past session row.
   **Expected:** the "Session summary" screen opens showing its own body map.
4. Holding the phone in one hand, tap a shaded region on the session summary map with your
   thumb.
   **Expected:** the tap registers and a panel opens beneath/over the map showing that region's
   name, its set count, and the contributing exercises. Try a second region.
   **Expected:** the panel updates to the newly tapped region.
5. Still holding the phone in one hand, check the bottom **tab bar** (visible on the Workout,
   Program, Exercises, History and Settings tabs — go back to any of those from the session
   summary via **Done** if the tab bar is not currently on screen).
   **Expected:** all five tab labels — **Workout, Program, Exercises, History, Settings** — are
   fully readable, none is cut off (no label truncated with an ellipsis or clipped at an edge),
   and no two labels or icons overlap each other, at the phone's own screen width.

## Judgement calls for the operator — not defects, just yours to decide

These three are known and deliberate; they are not things to report as failures:

- **Whether the lime accent (`#C6F84E`) is right at full brightness on an OLED screen in a dark
  gym.** If it reads as too bright or harsh in person, the fix is a one-line change to
  `--color-accent` in `tokens.css` — note your judgement in the run log either way.
- **The set screen shows the exercise's name twice** — once in the shell's header, once again
  in the set screen's own heading. This is deliberate (the set screen's accessible name is
  pinned by an earlier ticket), not a bug to flag.
- **The keypad's surface colour, its key grid's corner rounding, and its entry line's text
  size are each set on their own separate piece** (the group itself, the key grid, and the
  entry readout) rather than as one combined style. This is an intentional reading of the
  design's keypad clause, not something to flag as inconsistent if the keypad still reads as
  one cohesive control.

## Result block — paste this back into the run log, filled in

One sitting, one installed build, all six outcomes below plus E2's two, plus E5-T21's two.
[O19]/[O20] are [O12]/[O13] re-run at E3's styled head, recorded as their own rows because they
belong to a different ticket's record than E2's.

```
Device check: E2-T7 (O12, O13), E3 (O17, O15, O16, O18, O19, O20), E5-T21 (L17, M17)
Date:
Commit / merged sha checked against:
iOS version:
Device model:

[O12] (E2-T7) install + standalone launch: PASS / FAIL
  What actually happened:

[O13] (E2-T7) offline cold-launch + set survives restart: PASS / FAIL
  Weight logged:      kg
  Reps logged:
  What actually happened:

[O19] (E3-T10) install + standalone launch, at E3's styled head: PASS / FAIL
  What actually happened:

[O20] (E3-T10) offline cold-launch + set survives restart, at E3's styled head: PASS / FAIL
  Weight logged:      kg
  Reps logged:
  What actually happened:

[O17] (E3-T6) weight/reps dials snap to a rung when dragged; the snapped rung is what logs: PASS / FAIL
  What actually happened:

[O15] (E3-T9) six screens dark-on-dark with the lime primary action, no browser-default serif: PASS / FAIL
  Screenshots attached (6): Y / N
  What actually happened:

[O16] (E3-T9) tab bar and sticky action bar clear the notch and the home indicator: PASS / FAIL
  What actually happened:

[O18] (E3-T9) nothing scrolls sideways; every control is one-thumb reachable: PASS / FAIL
  What actually happened:

[L17] (E5-T21) catalog exercise detail works offline; Watch video opens the right destination per provider: PASS / FAIL
  Back squat (YouTube) -- offline detail screen (text+photos) rendered: Y / N
  Back squat (YouTube) -- Watch video destination:
  Lunges (Vimeo) -- offline detail screen (text+photos) rendered: Y / N
  Lunges (Vimeo) -- Watch video destination:
  What actually happened:

[M17] (E5-T21) Program tab maps legible; session summary map thumb-tappable; five tabs fit without truncation: PASS / FAIL
  What actually happened:

Notes:
```

## What failure looks like

Use this to tell *what* broke, not just that something did.

- **The app opens with Safari's address bar and/or toolbar visible ([O12] step 5 fails).**
  The manifest's `display` did not come back as `standalone`, or `start_url` did not resolve
  inside the app's scope, so iOS fell back to opening it as a bookmarked webpage instead of an
  installed app. This is a manifest/build problem, not a device problem — check
  `manifest.webmanifest` in the deployed build.

- **A blank or broken screen on the offline cold-launch ([O13] step 3 fails).**
  The service worker never installed and precached the app's files. The service worker's
  *first* successful registration has to happen on an **online** visit — a worker cannot
  install itself while the phone is already offline. If this happens, reconnect, load the app
  once online (let it fully finish loading), then retry from "Clearing a previous install"
  onward. If it still fails after a confirmed online load, the service worker registration or
  the precache list itself is the problem.

- **The logged set is gone after the second cold start ([O13] step 7 fails), but everything
  else in [O13] worked.** This points at IndexedDB being evicted by iOS between launches
  (Safari can purge site storage under memory/storage pressure, especially for a site with no
  recent user interaction) rather than a bug in how the set was logged — logging and the
  first read-back already worked in step 5. Note in the result block whether Website Data for
  `assafcaf.github.io` still exists in Settings > Safari > Advanced > Website Data after the
  failure: if it is gone, that confirms eviction; if it is still there but the set is missing,
  that is an app bug worth filing separately.

## E4-T9: the charts read in a gym ([O14], [O15])

This section proves [O14] and [O15] from ticket `E4-T9`. Its goal is that the charts and the
progression bar are judged where they will be read — on the phone, at arm's length, between
sets — which no jsdom test can do. It is its own sitting, against E4's head, so it has its own
deploy step and its own result block below. If the app is not yet installed on this phone, do
"Clearing a previous install" and [O12]'s install steps first, after the deploy step below.

Stats is reached through the **History** tab, then its **Stats** switch.

### Deploying and confirming the commit under test (E4-T9)

1. In the GitHub repository, open **Actions > Deploy to GitHub Pages > Run workflow**, and pick
   the branch `epic/E4-see-progress`.
2. Wait for the run to finish with a green check, then open its details and read the exact
   commit SHA the `actions/checkout` step resolved. Write that SHA down now — it is what goes
   in this section's result block's "Commit / merged sha checked against" field. "The epic
   branch" is not precise enough once more commits land on it after this run.
3. Launch the installed app from its home-screen icon, online, and let it fully load so the
   service worker picks up the new build; then force a cold start (as in [O13]) and launch it
   again. If in doubt that the new build is showing — for example, History has no **Stats**
   switch — do "Clearing a previous install" and reinstall as in [O12].
   **Expected:** the History tab shows a **Stats** switch.

### Making sure the phone has history for all three exercise kinds

[O14] needs logged history for a loaded exercise (`back-squat`), a bodyweight exercise
(`push-ups`) and an inverted, assisted exercise (`assisted-pull-ups`).

1. Open History, tap **Stats**, and pick each of the three exercises in turn.
   **Expected:** each shows a series chart with more than one point and at least one record.
2. If any of the three lacks history, import a backup that has it: **Settings → Import**, pick
   the backup file, and confirm. Write down which backup file was used (its file name and the
   date it was exported) for the result block.
   **Expected:** after the import, step 1 holds for all three exercises.

### [O14]: Stats is legible at arm's length for a loaded, a bodyweight and an inverted exercise

Hold the phone at arm's length, in the gym's own light (or the dimmest normal room light if you
are not in a gym). For each of the three exercises below, open History → **Stats** and pick it:

1. **`back-squat` (loaded).**
   **Expected:** the progression bar, the series chart and the records are all readable at arm's
   length without bringing the phone closer: the bar's fill and label, the chart's line/points
   and axis labels, and each record's value and date. Nothing is cut off or clipped at the
   phone's width, and nothing scrolls sideways. Take a screenshot.
2. **`push-ups` (bodyweight).**
   **Expected:** same as step 1 — progression bar, series chart and records all legible at arm's
   length, nothing clipped at the phone's width. Take a screenshot.
3. **`assisted-pull-ups` (inverted).**
   **Expected:** same as step 1, and in addition the chart reads as **rising** over time while
   the assistance weight **falls** — progress looks like going up, not down. Take a screenshot.

**Expected overall:** all three hold; attach the three screenshots to the run log, each labelled
with its exercise id.

### [O15]: the exercise list's progression bars read at a glance between sets

1. From the Workout tab, start a workout (or resume the one in progress), and log at least one
   set so a session is in progress.
   **Expected:** the session's exercise list is on screen, one row per exercise, each with its
   progression bar.
2. Glance at the list the way you would between sets — a second or two, phone at a normal
   holding distance, without zooming.
   **Expected:** each row's progression bar is readable at that glance: how full it is can be
   told apart from row to row.
3. Find a row whose progression bar is full. If none is full in this workout, note that in the
   result block and check whichever row is closest to full.
   **Expected:** that row's suggested next weight is legible right on the row, without opening
   the exercise.
4. Take a screenshot of the exercise list and attach it to the run log.

### Result block (E4-T9) — paste this back into the run log, filled in

```
Device check: E4-T9 (O14, O15)
Date:
Commit / merged sha checked against:
iOS version:
Device model:
Backup imported for history (file name + export date, or "none"):

[O14] (E4-T9) Stats legible at arm's length for back-squat, push-ups, assisted-pull-ups; inverted chart rises; nothing clips: PASS / FAIL
  Screenshots attached (3): Y / N
  What actually happened:

[O15] (E4-T9) exercise list progression bars readable at a glance; full bar's suggested next weight legible on the row: PASS / FAIL
  Screenshot attached (1): Y / N
  What actually happened:

Notes:
```
