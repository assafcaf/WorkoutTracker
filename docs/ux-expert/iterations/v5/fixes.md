# UX review iteration 5: fixes and after-evidence

Checked against this worktree's Vite dev server with `scripts/ux-review/shoot.mjs` (headless Edge), data
`scripts/render-states/stats-45.json`, 390 × 844 unless stated. Before shots in `shots/` were taken on the
unchanged iteration-4 code; after shots reuse the file name in `after/`; side-by-side composites in `compare/`.
The expert's whole-app walk-through shots are in `walk/` (see `report.md`).

| Item | What changed | Evidence |
|---|---|---|
| Rest chips on small phones (v4 carry) | Short-screen layout tightened; hand-over block puts chips before the Sets line. Chips 356–400 vs bar at 407 at 320 × 568 (was 408–452). | `compare/11`, `12`, `20`, `21` |
| V1-20 dials at 195 × 422 / 200 % | Header wraps at ≤ 280 px; 44 px steppers; focusing a Dial under the bar scrolls it clear. | `compare/13`–`16` |
| V1-17 swap Undo on Now | "Swapped from Deadlift · Undo" snackbar for 5 s on Now; Undo reopens the planned Exercise. | `compare/18`, `after/19` |
| V1-16 Step and Bodyweight | Removed from the in-workout sheet; now in Program › Edit › row ⋯ ("Bodyweight exercise", "Weight step"), same stored settings. | `compare/17`, `32`, `34`, `after/35`–`38` |
| V1-28 Program editor fields | Two-line rows; every target ≥ 44 px; inputs named per row ("Back squat Sets"). | `compare/31`, `33` |
| V1-31 lift chart labels | Ladder split into weight and reps SVGs with the caption between; labels placed by measured size. (The expert still found "No A sDeload" on Back squat: V5-09.) | `compare/40`–`44` |
| One comparison sentence | `exerciseComparison` feeds both the Rest done line and the summary's Lift by lift. | `compare/45` |
| Sessions "n PRs" | Plain muted text instead of an accent pill. | `compare/43` |
| Calendar tap-through (owner ask) | Days with a workout are buttons ("Workout B, Mon 12 Oct") opening that workout; two on a day → chooser. | `compare/50`, `51` |
| Delete a workout (owner ask) | "Delete workout" on a past workout's summary, with "Workout deleted · Undo". | `compare/52`, `53`, `after/54` |
| Abandon a workout (owner ask) | Finish sheet offers "Discard workout"; "Nothing logged yet" when empty; with Sets logged it asks again as "Discard N logged sets". | `LiveHeader.test.tsx` |
| Lift history graph (owner ask) | Lift history leads with an estimated-max-per-session trend (weight and reps combined; assisted = least assistance), latest best set, tappable points; log below, last 4 + "Show all". | `compare/60`–`62`, `after/63`–`66` |

## Carried to iteration 6

See `report.md` §6: Discard Undo, swap prescription (V5-02), the Progress rebuild (status rules, one Lift page,
dashboard), PR definition, copy pass, chart collision, calendar cell size, Program editor load/rest fields.
