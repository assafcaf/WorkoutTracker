---
name: workbox-navigateroute-swharness
description: Why a swHarness navigate-mode test against an unimplemented denylist throws instead of asserting cleanly
metadata:
  type: project
---

In this repo's `src/test/swHarness.ts` + `buildFixture.ts` pair (WorkoutTracker), a test that
drives the real generated `dist/sw.js` and requests a path meant to be excluded by
`navigateFallbackDenylist` (before that option exists in `vite.config.ts`) fails with a thrown
`TypeError: Failed to parse URL from index.html` deep inside workbox-precaching's
`createHandlerBoundToURL` (`new Request(url)` with a bare relative string), not a clean assertion
diff. This is still a legitimate red (vitest exit 1, a real test ran and failed for the right
reason — no denylist means the NavigationRoute always matches and always hits that bug) rather
than a collection error: root-path (`''`) navigations don't hit this line at all because they
match precacheAndRoute's own `PrecacheRoute` first, so only non-precached fallback paths (`/api/`,
`/cdn-cgi/`) reach it. Once the denylist is added, those requests stop matching `NavigationRoute`,
`sw.request()` returns `undefined`, and the assertion (`body` not containing the app shell) passes
cleanly. See [[weakened-base-path-assertions]].
