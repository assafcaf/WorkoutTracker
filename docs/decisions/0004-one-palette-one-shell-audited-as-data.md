# 0004. The app has one palette, one shell, and stylesheets audited as data

Date: 2026-09-23 · Status: superseded by 0009 (palette, dark-only, fonts, motion; the shell and the audits stand) · Tracker: E3 — Style it

## Context
0002 chose a local-first PWA and 0003 made it installable and offline-capable. Neither gave it a
look. At E3's start there was not one `.css` file in the repository, nothing imported a
stylesheet, and the phone rendered the browser's default serif on white. The markup already
carried the class names a stylesheet would hook — `set-screen`, `dial-readout`, `exercise-row`,
`keypad-keys`, `history-list` — written by E1 and never used.

Navigation was a `view` state with bare `Back`, `Settings` and `History` buttons stacked above
the program picker, which is not how a workout app on a phone behaves.

The target is iOS Safari, installed to the home screen, used in a gym. Two facts shape the
answer. Most of what "looks right" means there cannot be checked on this Windows host at all —
safe-area insets resolve to `0px` in jsdom and desktop Chrome, and scroll-snap physics has no
headless equivalent. And a design that drifts is worse than no design, because nobody notices
until the screens disagree with each other.

## Decision
- **One definition site for the palette.** `src/styles/tokens.css` declares exactly 29 custom
  properties on `:root` and no more. Every other stylesheet reaches them through `var(--…)`;
  no literal colour — no hex, `rgb(`, `hsl(` or named colour — appears anywhere else.
- **The stylesheets are audited as data, not by eye.** `src/test/cssAudit.ts` parses CSS with
  postcss and exports `readTokens`, `referencedVars`, `literalColours`, `declarationsFor`,
  `relativeLuminance` and `contrastRatio`. Tests read the CSS and assert against it: the token
  set is exactly the documented one, every `var(--…)` names a token that exists, no stylesheet
  but `tokens.css` holds a literal colour, every `.css` under `src/` is reachable from a
  `.ts`/`.tsx` import, and every documented interactive selector declares
  `min-height: var(--tap-min)`.
- **Contrast is computed, not asserted.** The WCAG 2.1 ratios are derived from `tokens.css` at
  test time for nine documented foreground/background pairs, so changing a token changes the
  test's subject rather than leaving a stale number behind.
- **One shell owns the chrome.** `AppShell` renders the header (title, optional back control,
  trailing slot), `<main>`, an optional sticky action bar, and an optional tab bar. Screens are
  its children. A three-tab `<nav aria-label="Main">` replaces the free-standing navigation
  buttons; in-session screens pass no `tab` and get no tab bar.
- **The manifest's colours come from the palette**, tied by a test that reads both rather than
  by parsing CSS inside the Vite config.
- **Safe-area clearance comes from `--safe-bottom`** (`env(safe-area-inset-bottom, 0px)`) with
  `viewport-fit=cover`, and is proven only on the device, because nothing else can see it.
- **No light theme, no `prefers-color-scheme` block, no motion, no web fonts, no icon
  library.** The three tab glyphs are inline SVGs written in this repository.

## Alternatives rejected
- **Screenshot-baseline testing**: baselines rendered on this Windows host would not match the
  Linux runner in `.github/workflows/deploy.yml`, so they would fail for the wrong reason.
- **A CSS framework or icon dependency**: the markup already carried its own class names, and a
  framework would have replaced a vocabulary E1 had already chosen.
- **Parsing `tokens.css` inside `vite.config.ts`** to derive the manifest colours: the test is
  what enforces the tie, so build-time parsing would be machinery restating a guarded fact.
- **Hand-rolled regex CSS parsing**: postcss was already installed as a Vite transitive
  dependency; pinning it explicitly made the audit's parser a stable contract.

## Consequences
Restyling is a one-file change, and drift is a test failure rather than a discovery. The audits
constrain every future stylesheet: it must be imported by some module, and it may not name a
colour. Both are cheap to satisfy and loud when violated.

Two things to watch. `declarationsFor` matches a selector **by exact string** after splitting the
selector list, so `.foo:hover` does not count toward the tap-target floor — a declaration must
sit on the bare selector. And `[O6]` counts a stylesheet as imported when it is reachable
transitively through CSS `@import`, which is what lets `tokens.css` qualify via `base.css`; a
one-hop reading would have failed the token file against its own outcome.

## Outcome
Built across ten tasks on `epic/E3-style-it`, merged at `37bba61`. 298 tests pass (up from 231 at
the baseline), `tsc --noEmit` and `eslint` clean.

Every host-testable outcome has a passing test: [O1] [O2] [O3] [O6] (T1), [O5] (T2), [O7] [O8]
[O9] (T3), [O10] [O11] (T4), [O12] (T5), [O13] [O14] (T7), [O4] (T8). Six outcomes are on the
`iphone` resource and remain unproven until the operator's device session at this head: [O17]
(T6), [O15] [O16] [O18] (T9), [O19] [O20] (T10). T6, T9 and T10 are therefore merged but not
done.

Where it departed from the decision above, and why:

- **`AppShell` gained a portal.** The plan had `App` pass `action={…Log set…}` to the shell, but
  `SetScreen` owns the log handler, the validation state and the condition gating `Add set`, and
  eight tests render `SetScreen` bare with no shell. `AppShell` now creates a portal host before
  its first render and publishes it through `ActionBarHostContext` (`src/ui/actionBarSlot.ts`);
  `SetScreen` portals its controls there when the context is present and renders them inline when
  it is not. An earlier attempt where the descendant claimed the bar in an effect broke four
  tests: the buttons rendered in `<main>` and moved a commit later, so clicks landed on a detached
  node.
- **`App.tsx` has a `tabFor` helper beside `TAB_OF`.** `tab={TAB_OF[view]}` does not type-check
  against `tab?: Tab`, because `null` is not `undefined`. `TAB_OF` itself is unchanged.
- **`BackupBadge` now renders on the Settings screen as well as the picker.** T7's ticket said it
  "keeps rendering in full on the Settings screen"; it never had — it rendered only on the picker,
  back to its original E2 commit. A tab marker pointing at Settings that led to a screen with no
  badge would be incoherent, so it was added there and left on the picker.
- **The Settings tab's accessible name is pinned to exactly `Settings`.** The backup-due marker is
  a sibling `<span role="status" aria-label="A backup is due">` with `aria-label="Settings"` on the
  button, because `App.test.tsx`'s `openSettings` helper and seven E2 tests match that name
  exactly and a badge inside the button would have appended its text to all of them.
- **Two tickets had been overtaken by earlier tasks in their own epic.** T5 was told to move the
  storage banner inside the shell's `<main>`; T3's `AppShell` already put every child there. T9
  was told to add safe-area clearance to `.tab-bar` and `.action-bar`; T3 and T7 had already
  landed it. Both tasks correctly did nothing rather than edit files to justify their file lists.
- **The device-check document covers the whole session, not each task's slice.** T9 added steps
  for its outcomes but left the shared result block alone and said so; nobody then owned result
  rows for [O15] [O16] [O18] or [O17], and [O17] had no steps written anywhere. T10 wrote the
  full six-outcome block and the missing [O17] section.
- **Three judgements are deferred to the device session** rather than guessed: whether `#C6F84E`
  is right at full brightness on OLED in a dark gym (a one-line change in `tokens.css`, which is
  what the single-definition-site rule bought); that the set screen shows the exercise name twice,
  once in the shell header and once in `SetScreen`'s own `<h2>`, because T4's ticket pinned that
  component's accessible names; and whether the keypad's three token clauses name three selectors
  or three properties on one rule.
- **One full-suite run failed 1/290 immediately after T1 merged and never recurred**, green on the
  two runs after it and every run since. It coincided with `npm ci` and parallel agent worktrees
  installing; the failing test name was not captured before it went green. Not attributed, not
  reverted, recorded — the same shape as the flake 0003 records for E2.
