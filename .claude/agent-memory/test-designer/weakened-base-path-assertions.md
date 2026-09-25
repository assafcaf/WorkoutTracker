---
name: weakened-base-path-assertions
description: When a config value becomes '/', "starts with BASE" assertions in build tests go vacuous — assert the resolved file exists instead
metadata:
  type: feedback
---

When a ticket changes a hard-coded base path constant to `/` (e.g. Vite's `base`, or a test
harness's own `BASE`), any existing assertion of the shape `ref.startsWith(BASE)` or
`url.startsWith('/') && !url.startsWith(BASE)` becomes trivially true for every root-relative
string once `BASE === '/'` — it can no longer fail no matter what the build does. Found in
WorkoutTracker's `src/pwa/manifest.test.ts` while updating for E7-T3 (root-relative Cloudflare
Worker serving, decision 0006).

**Why:** these tests exist to catch a build that forgets to prefix its own base path; with a root
base, "prefixed" and "not prefixed" look identical as raw strings, so the check has nothing left
to fail on it.

**How to apply:** when a ticket moves a base-path test to `/`, don't just swap the constant —
replace the string-prefix check with one that resolves the reference to an actual build-output
path (e.g. via the file's own `distPathOf` helper) and asserts membership in `app.files`. That
still fails if a stale prefix (like a leftover `/WorkoutTracker/`) leaks into the reference.
