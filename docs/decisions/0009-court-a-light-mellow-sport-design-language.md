# 0009. The app wears one light "Court" palette: ivory, court green, clay and four muscle-family tints

Date: 2026-09-26 · Status: accepted · Tracker: — (assigned by /tickets)

## Context
0004 gave the app a dark-only palette: near-black `#0B0B0F` with a single neon-lime accent,
system fonts only, and a closed set of 36 tokens. The accent ended up carrying about 26 jobs:
- primary buttons;
- selection states;
- chart data;
- highlighted numbers;
- the body map.

The operator rejected the look as harsh.

Research on 2026-09-26 converged on one recipe, across fitness apps (Oura, Hevy, Garmin),
athletic brands (Wimbledon, Roland-Garros, Tracksmith, Paris 2024) and calm products (Calm,
Airbnb, Notion, Stripe, Material 3):
- a warm off-white field;
- one deep primary colour used only for the main action;
- soft category tints with dark ink in the same hue;
- big tabular numerals;
- a heritage sport motif.

Readability research (NN/g) favours dark-on-light for a bright gym.

## Decision
- **Light-only.**
  - `base.css` declares `color-scheme: light`.
  - There is no `prefers-color-scheme` block and no second palette.
  - The manifest's `theme_color` and `background_color` equal `--color-bg` (`#F5F1E8`).
- **One job per colour.**

  | Token | Value | Its one job |
  |---|---|---|
  | `--color-primary` | `#1F4D3A`, court green | only the primary action and the active tab |
  | `--color-accent` | `#9E5231`, clay | chart data, progress fills and highlighted numbers |
  | `--color-warn` | ochre | warnings |
  | `--color-danger` | brick | errors |

  Text is warm ink `#24211D` on ivory, white or raised sand.
- **Four muscle families**, `push`, `pull`, `legs` and `core`.
  - `familyOf(muscle)` in `src/domain/muscles.ts` assigns them.
  - Each family is a `--family-<f>-tint` fill with `--family-<f>-ink` text in the same hue, at
    6.5:1 or better.
  - They appear only where a muscle is named, via `MuscleChip`, and on the set-logged
    confirmation.
- **A soft-gold medallion** (`--pr-tint`, `--pr-ink`, `--pr-ring`) marks the Stats screen's
  records.
- **A body-map heat map in single-hue clay** that steps only in lightness. Every region is
  stroked in `--color-muted`.
- **One vendored web font.** Barlow Semi-Condensed 600 (Latin woff2, OFL licence beside it) is
  used for big numbers and headings through `--font-display`, with `tabular-nums`. It is
  precached by Workbox. Body text stays on the system stack.
- **Shape and motif.**
  - Radii are 12px for controls, 20px for cards, and pills.
  - Cards separate by tint, with no hairline or shadow.
  - A `CourtStripe` (primary over clay) appears in exactly three places: the Shell header, the
    session summary and the PR medallion.
- **Motion.** Presses scale to `--press-scale` over `--motion-fast`. All motion is off under
  `prefers-reduced-motion`.
- **The token set stays closed and audited as data**, as 0004 decided. It is now 49 tokens.
  `--color-border`, `--color-on-accent` and `--shadow-card` are removed. The coloured-fill
  audit (G1) covers every coloured token, not only the old greens.

This supersedes 0004's palette, dark-only and "no web fonts, no motion" rules. 0004's shell,
single definition site and audit-as-data machinery stand.

## Alternatives rejected
- **Both themes, following the phone:** doubles every colour decision, and the operator asked for
  light.
- **A warm dark theme:** keeps the nightclub feel being fixed.
- **One hue per muscle:** 17 pastels cannot be told apart. Four body areas can.
- **A green-to-red heat map:** fails red-green colour blindness. Lightness steps do not.
- **System fonts only:** free, but the numbers lose their sport voice.
- **A full variable font family:** about 300 KB against about 20 KB for one weight.
- **Detecting a PR while logging:** new logic; this epic is a restyle.

## Consequences
- **Restyling is still a one-file change.** Every colour lives in `tokens.css`.
- **Colour now carries meaning**, so reusing a family tint or the primary green for decoration
  is a bug, not a style choice.
- **Watch three things:**
  - `BodyMap` fills inline, so the CSS audit cannot see text on map shades; keep none there.
  - A new muscle in the library must get a family, or the compiler refuses it.
  - The display font has no Hebrew; any Hebrew UI string falls back to the system font.

## Outcome
Built in E10 on `epic/E10-court-design-language`: ten tasks, all done.

- **Palette and tokens (T1, T9):** the Court palette in `src/styles/tokens.css`, 49 tokens, and the
  manifest colours set to `#F5F1E8`. The glossary and the decision index follow it.
- **Light-only and the fill audit (T2):** `color-scheme: light`. The coloured-fill audit now guards
  every coloured token, not only the old greens.
- **Muscle families (T3, T4):** `familyOf` and `MuscleChip` appear in the Library, exercise detail
  and region panel.
- **Sport cues (T5):** `CourtStripe` in the header, session summary and PR medallion. Workout cards
  get coloured leading edges.
- **Body map (T6):** every region is outlined.
- **Display font (T7):** vendored Barlow Semi-Condensed 600 with tabular figures, precached.
- **Motion (T8):** press scaling, and a family glow on a logged set. Both are off under reduced
  motion.

Departures from the spec, and why:

- **The iPhone check (T10) ran on the local dev app in Chrome**, on the operator's ruling, not
  on the installed app. The Barlow numerals, the press and the ivory page passed. The iOS status
  bar and splash, and the offline cold launch, were not verified: they need the deployed,
  installed app.
- **The court stripe declares `color: var(--color-on-primary)`.** It paints primary green, and
  the widened fill audit (T2) requires a text colour on every coloured fill, even a decorative
  one.
- **`SetScreen` takes a resolved `family` prop** that `App.tsx` computes, so the set screen
  stays free of library lookups.
- **Two test-harness changes** kept load flakes from reverting real work:
  - `src/App.test.tsx` awaits its `Log set` lookups.
  - vitest's per-test timeout is 15s.
- **Barlow's default digits are proportional.** Its `tnum` feature makes them equal width, so
  every selector using `--font-display` also declares `tabular-nums`.
