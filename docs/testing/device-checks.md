# Device checks: install, offline cold-launch, and the styled shell (E2-T7, E3)

These checks cannot run in CI or an emulator. iOS is the only platform with the install,
offline cold-launch and safe-area behaviour this app depends on, so a person runs these steps
by hand on a real iPhone, in Safari, and records what actually happened. This document is that
script. It proves outcomes [O12] and [O13] from the `E2-T7` ticket, and — continuing in the
same sitting once the app is installed — [O15], [O16] and [O18] from the `E3-T9` ticket.

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

## [O12]: installs to the home screen and launches standalone

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

## [O13]: cold-launches offline, and a logged set survives a restart

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
   **Expected:** the app opens standalone (no Safari chrome, as in [O12]) and the program picker
   screen renders with a program and its workouts listed, even though the phone has no network
   connection at all.

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

```
Device check: E2-T7 (O12, O13)
Date:
Commit / merged sha checked against:
iOS version:
Device model:

[O12] install + standalone launch: PASS / FAIL
  What actually happened:

[O13] offline cold-launch + set survives restart: PASS / FAIL
  Weight logged:      kg
  Reps logged:
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
