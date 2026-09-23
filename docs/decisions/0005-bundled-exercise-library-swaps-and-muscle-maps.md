# 0005. Bundle the free-exercise-db library, link M&S videos only on a certain match, and count muscles from it

Date: 2026-09-23 · Status: accepted · Tracker: E5

## Context
Exercise info was one outbound link per catalog exercise, four of them only search pages. A
swapped-in machine had nowhere honest to be logged, and nothing showed which muscles a workout,
a week or the program trains.

## Decision
- Bundle free-exercise-db (876 entries, Unlicense) at pinned commit `a859101d…` unmodified in
  `src/data/library/exercises.json`. The catalog keeps its own ids and gains a `libraryId`; the
  library is a separate chunk, precached with the 14 catalog exercises' photos. Other photos load
  from the pinned GitHub commit and are runtime-cached.
- Videos come only from Muscle & Strength, harvested once in a real browser into
  `scripts/data/ms-pages.json`. A video is attached only on a unique normalised-name match or an
  explicit override in `video-overrides.json`: a wrong video is worse than none.
- Any id resolves through `resolveExercise`, so a swap records the done exercise under its own id
  and `Session.swaps` keeps planned → done.
- Muscles are counted as 1 per set for a primary and 0.5 for each secondary, banded per session
  and per week, and drawn with polygons copied from react-body-highlighter 2.0.5 (MIT).

## Alternatives rejected
- Merging library fields into `exercises.json`: duplicates 14 of 876 and forks from upstream.
- Fuzzy video matching: silent wrong videos.
- Precaching every photo: about 120 MB.

## Consequences
The app works offline for the trainee's own lifts and can suggest honest substitutes. Video
coverage is thin (81 of 876) and grows only through the overrides file. The tab bar now needs
five tabs at 375 px.

## Outcome
Built on `epic/E5-exercise-library` (21 tasks plus two device-check fixes; draft PR against
`main`). Departures from the spec:
- **Vimeo.** Most M&S videos are Vimeo, locked to M&S's domain. `Video` became
  `{ provider, id, source }`. "Watch video" opens YouTube for YouTube videos and the M&S page for
  Vimeo ones. Of the 14 catalog exercises, 10 have a video; machine shoulder press, cable
  push-down, assisted pull-ups and face pull have no matching M&S page. L5 was changed to that.
- **History** gained a per-exercise breakdown per session (S11 needed one; no task had it).
- **Program switcher** is an always-visible radio list, not the earlier disclosure.
- **Device check** found details rendering below the page instead of as a popup, and white text
  on green. All detail, alternatives, summary and region views are now `role="dialog"`
  full-screen popups; the Exercises list shows 10 at a time with "Show more"; a CSS audit
  requires 4.5:1 contrast for text on any green; body maps are capped in width.
- **Tab bar moved to the top**, clearing `--safe-top`, at the operator's request. This departs
  from 0004's bottom-anchored shell; 0004's `--safe-bottom` still applies to action bars.
- Region taps work on session maps; the Program tab's maps are not tappable yet.
