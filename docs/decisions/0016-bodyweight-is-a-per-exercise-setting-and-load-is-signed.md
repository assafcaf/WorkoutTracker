# 0016. Bodyweight is a per-Exercise setting, and on a Bodyweight Exercise a higher signed Load is better

Date: 2026-10-13 · Status: accepted · Tracker: E16

## Context
The trainee's notes from real Sessions: the Set screen made them scroll and tap more than the
lifting needed. Weight, Reps and Load sat in three stacked Dials; rest was small grey text;
after an increase the next Set's Preset fell back to last week's weight; assisted pull-ups read
+27 kg through an `invertProgress` special case in about 15 places; there was no way to see past
Sessions from the screen; and choosing an Alternative threw the trainee out of logging.

## Decision
- **Bodyweight is a per-Exercise setting.** The catalog or library gives the default
  (`bodyweight`, or `equipment === 'body only'`); the trainee's override is one synced setting,
  `bodyweightOverrides` (`Record<exerciseId, boolean>`, topic `preferences`). Setting the
  default removes the override. `bodyweightOf` / `applyBodyweight`
  (`src/domain/bodyweight.ts`) resolve it, and every Screen group resolves Exercises through
  `applyBodyweight`. A backup carries the key only when non-empty; `schemaVersion` stays 1.
- **`invertProgress` is gone.** Assisted work is a negative Load: on a Bodyweight Exercise
  records, progression and the Stats series judge the highest signed Load
  (`heaviest-load`, labelled `Least assistance` when negative; progression `add-load` one step;
  series kind `load`). Assisted pull-ups are Bodyweight with `startLoadKg: -27`.
- **One Dial for weight and Load, storage unchanged.** On a Bodyweight Exercise the Weight Dial
  reads and writes the signed `loadKg` with Rungs `ladderFor(exercise)` (`BW−20`, `BW`,
  `BW+10`); `LoadDial` is deleted. Sets still store `weightKg` and `loadKg` as before.
- **Old assisted-pull-up Sets are normalised on read** in the Session Repository
  (`normalizeLegacySet`: `weightKg: 27` → `loadKg: -27`), idempotent, without touching
  `updatedAt`, so sync pull and backup import are covered too.
- **Changing Bodyweight never rewrites Sets**; only the open Set's Preset translates
  (`presetFromSet`).
- **The Preset carries today's change from last time's shape** (`presetForSet`): last time's
  Set N shifted by today's anchor minus last time's at its position.
- **A swapped-in Exercise with no history opens on the planned Exercise's Preset**
  (`swapPreset`), snapped to its Rungs or `BW`.

## Alternatives rejected
- Catalog-only Bodyweight: still wrong for library "machine-assisted" Exercises.
- Keeping assisted as an inverted loaded Exercise shown with a minus sign: `+` would read
  backwards.
- A signed `weightKg` for every Set: migrations of Sessions, sync and backup for no visible gain.
- A Dexie upgrade for old Sets: misses old shapes arriving by sync or backup.
- Repeating the Set just logged as the Preset: breaks pyramids. "Never below today's": fights a
  bad day.
- An empty readout for a never-logged swap: always an extra step.

## Consequences
- One signed-Load rule replaces the inverted special cases; a new resolver of Exercises must go
  through `applyBodyweight`, or its screen shows the wrong mode.
- Reads of Sessions normalise every time; a normalised Set pushed back by sync is the intended
  convergence.
- Layout at 390 × 844 (Weight and Reps side by side, the rest clock) is covered only by
  CSS-as-data tests; jsdom can't measure it.

## Outcome
Built in E16 (14 tasks, plus two test-flake fixes), on `epic/E16-set-screen-from-the-gym`.
- Bodyweight setting, sync and backup (T1, T9); signed-Load records, progression and series
  (T2); legacy normalisation on read (T3, and `finishSession` returns the normalised Session,
  T14); single signed Weight Dial with `ladderFor` (T4); Weight and Reps side by side with
  `WeightStepControl` and `.set-dial-controls` (T11); the Bodyweight switch on the Set screen
  (T13); the `mm:ss` rest clock (T5); `presetForSet` / `presetFromSet` (T6); the History overlay
  (T7); the Alternatives overlay layout (T8); assisted pull-ups as Bodyweight and
  `invertProgress` removed (T10); choosing an Alternative keeps logging, with `swapPreset` (T12).
- Departures from the spec: `reduce-assistance` survived T2 unused and was removed in T10 with
  the `invertProgress` reads in `volume.ts` and `exerciseVolume.ts`, which the tickets had not
  listed. The session summary also needed `formatSet` for Load records (T14). The Exercises
  screen group resolves no Exercise, so its guard is in `architecture.test.ts` rather than a
  render test.
- Test flakes under full-suite load in `App.test.tsx` and `WorkoutFeature.test.tsx` (synchronous
  queries right after an async screen change) were fixed at the cause by awaiting the Set screen.
  The layout fit at 390 × 844 still needs a look on the phone.
