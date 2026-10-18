# Design principles: a professional, gym-proof training app

Research note for the 2026-10 redesign. Scope covers the visual system, information architecture,
interaction model and state design. Sources are cited inline. Where a source was only reachable
through a secondary summary, the text says so. All contrast ratios below were computed with the
WCAG 2.x relative-luminance formula.

---

## 0. Diagnosis: why the current look reads as "a child did it"

The owner's words, "colourful but mellow, professional and sporty; strong colours are out", are
reasonable. The current build reads as childish because it treats *mellow* as *pastel*.
Several cues that each signal "toy" are stacked together:

| Current cue | What the eye reads |
|---|---|
| Four pastel muscle-family colours used as fills across the UI | High colourfulness with low saturation and high lightness, the palette of nursery and toy packaging. Colour is doing decoration, not information. |
| 20 px radii and pills on most containers | Soft, inflated, "bubbly" shapes. Large radius combined with pastel fill is the visual grammar of children's apps and casual games. |
| Decorative double-stripe motif | Ornament with no function. It adds visual complexity, and complexity is the strongest first-impression penalty (see 1.0). |
| Gold medallion for PRs | A literal trophy metaphor. Skeuomorphic rewards read as gamified, the opposite of "serious tool". |
| Ivory + court green + clay + 4 pastels + gold | That is 8 hues. Professional systems run on 1 accent plus neutrals plus semantic colours. |

None of these cues is wrong alone. Stacked, they move the app away from the *prototype* of a
serious tool (Strong, Hevy, Apple Fitness, Garmin Connect, banking apps) and toward the
prototype of a kids' app.

---

## 1. The anatomy of "professional"

### 1.0 Why first impressions matter, and what drives them

- Aesthetic judgements of an interface form in **17–50 ms**. **Visual complexity (VC)** and
  **prototypicality (PT)** both shape them, and *low complexity plus high prototypicality* was
  rated most appealing. Tuch et al., IJHCS 70(11), 2012:
  <https://research.google/pubs/pub38315/>, <https://edoc.unibas.ch/21676>, plain summary at
  <https://research.google/blog/users-love-simple-and-familiar-designs-why-websites-need-to-make-a-great-first-impression/>.
- Reinecke et al. (CHI 2013) modelled perceived **colourfulness** and **complexity** from
  screenshots. Together with demographics they explain about half the variance in appeal after a
  500 ms view, and the first impression goes on to colour later judgements of usability and
  trust. Appeal peaks at *moderate* colourfulness, not maximal colourfulness:
  <https://kgajos.seas.harvard.edu/papers/reinecke13aesthetics.pdf>,
  <https://www.eecs.harvard.edu/~kgajos/papers/2013/reinecke13predicting.shtml>.

**Consequence.** "Professional" in practice means three things: few distinct visual elements,
moderate colourfulness, and layouts that look like the category's prototype. Every rule below
serves one of the three.

### 1.1 Checkable cues

Each cue lists **Rule**, **Why it works** and **Childish failure mode**.

1. **Type scale with a fixed ratio.**
   *Rule:* one modular scale, ratio 1.2–1.25 for UI text, with a separate display tier for hero
   numerals. Example: 12 / 14 / 16 / 20 / 24 / 32 and hero 56–72. No more than 6 text sizes per
   screen.
   *Why:* a constrained scale makes size differences look intentional, and the eye reads
   hierarchy from a few clear steps. Refactoring UI argues for constrained scales for type,
   spacing, colour and shadow (secondary summary:
   <https://dev.to/updivision/book-review-refactoring-ui-by-adam-wathan-steve-schoger-2f7m>).
   *Childish:* many near-identical sizes, or everything big and round. That is the "big friendly
   letters" look.

2. **Hierarchy from weight and colour, not size alone.**
   *Rule:* two weights for UI text, at most three (400/500/600, or 500/700). Secondary text gets a
   lighter neutral, not a smaller size. Labels sit in small caps or a muted colour; values stay
   dark and heavy.
   *Why:* Refactoring UI's core hierarchy advice is to de-emphasise secondary content with colour
   and weight so the primary content wins without shouting (same source).
   *Childish:* bold everywhere, or colour used for emphasis on every line.

3. **Tabular, lining numerals for every changing number.**
   *Rule:* `font-variant-numeric: tabular-nums lining-nums` on weights, reps, timers and tables.
   Digits align by column and do not jitter when a timer ticks.
   *Why:* Apple advises monospaced digits for changing values such as timers and counters
   (SwiftUI `.monospacedDigit()`; secondary HIG summary:
   <https://uxcel.com/lessons/system-typography-sf-font-963>). Google's Wear guidance gives the
   same reason for tabular figures:
   <https://developer.android.com/design/ui/wear/guides/styles/typography/apply>.
   *Childish:* proportional or old-style figures that dance during a countdown, or a "fun" display
   face for numbers.

4. **A neutral ramp of 9–10 steps, slightly tinted.**
   *Rule:* one grey ramp (50–900) with a faint hue cast (warm stone or cool slate, chroma under
   about 0.02 in OKLCH), and fixed roles for each step: page background, card, divider, control
   border, muted text, body text, ink. At least 85% of the pixels on any screen should come from
   this ramp.
   *Why:* Refactoring UI recommends designing in greyscale first and adding colour last, so that
   hierarchy comes from spacing, contrast and type (secondary summary:
   <https://smithery.ai/skills/wondelai/refactoring-ui>). A disciplined neutral field is what
   makes one accent look confident.
   *Childish:* a tinted background (ivory, mint) *plus* tinted cards *plus* tinted chips, which
   leaves no neutral ground anywhere.

5. **Accent count and saturation discipline.**
   *Rule:* **one** brand accent used for primary actions, the active state and focus. Semantic
   colours (success, warning, danger) are separate and appear only when they carry meaning. The
   *data* palette (muscle families, chart series) lives inside charts, the heat map and small
   tags, never as large fills. Large areas get low chroma. Saturation goes up as area goes down.
   *Why:* moderate colourfulness maximises appeal (Reinecke 2013), and a single accent makes the
   primary action findable in under a glance.
   *Childish:* many hues at equal visual weight, or pastels used as card backgrounds. **Pastel
   means high lightness with low chroma over a large area, which is the toy signal.** The fix is
   not stronger colour everywhere. It is *less* colour, placed precisely.

6. **A radius system tied to size.**
   *Rule:* small radii scaled to element size: 4–6 px for inputs, chips and table cells; 8–12 px
   for cards and sheets; full pills only for small toggles or status tags. A nested element's
   radius equals the outer radius minus the padding.
   *Why:* the radius sets the "voice". Small radii read as precise and instrument-like, large radii
   read as soft and friendly. Material's sheet spec uses "extra-large" corners only on the
   outermost sheet container
   (<https://gitea.com/784622644/material-components-android/src/branch/master/docs/components/BottomSheet.md>).
   *Childish:* 20 px corners on everything. Together with pastels this is the "bubble UI" of kids'
   apps, because every element turns into a soft blob and the layout loses its edges and grid.

7. **Elevation: borders *or* shadows, chosen once.**
   *Rule:* in light mode, separate cards from the page with a 1 px hairline (neutral-200) or a
   1-step background change, plus at most one soft shadow level for floating layers (sheets,
   toasts). In dark mode, show elevation by lightening the surface, not with shadows (Material
   dark theme: <https://m2.material.io/design/color/dark-theme>).
   *Childish:* thick coloured borders, drop shadows on flat cards, or outlines in the accent
   colour.

8. **A grid and shared alignment edges.**
   *Rule:* 4 px base unit, 16 px side margins (20 px on wide phones), a single left text edge per
   screen, and numbers right-aligned in columns.
   *Why:* shared edges cut perceived complexity, which is the strongest early factor in Tuch et
   al.
   *Childish:* centred everything, floating badges, elements that each pick their own inset.

9. **A spacing rhythm.**
   *Rule:* a spacing scale of 4, 8, 12, 16, 24, 32, 48. Spacing inside a group is smaller than
   spacing between groups (proximity). Start with too much white space and remove it (Refactoring
   UI, secondary summary above).
   *Childish:* uniform padding everywhere, so nothing groups, or decorative dividers doing the work
   spacing should do.

10. **One icon system.**
    *Rule:* one family (for example Lucide, Phosphor or Material Symbols), one stroke weight
    (1.5 or 2 px at 24 px), one corner style, set on a 24 px grid. Icons are monochrome in the text
    colour and coloured only when active.
    *Childish:* emoji, mixed filled and outline icons, multicolour illustrations inline.

11. **Density fitted to the task.**
    *Rule:* the *now* (in-workout) screens are sparse: one task and huge numerals. The *review*
    screens (history, stats, program editor) are dense: tables, small type, tight rows.
    Professional tools vary density by mode.
    *Childish:* the same chunky cards everywhere, so history looks like a toy and logging looks
    like a spreadsheet.

12. **Motion restraint.**
    *Rule:* 150–250 ms ease-out for state changes. Motion only explains a change (a sheet rises, a
    row inserts, the timer drains). Celebration motion is at most one event per session, for a PR.
    Respect `prefers-reduced-motion`. Apple's motion guidance: motion should follow people's
    gestures and expectations, and unexpected motion disorients
    (<https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json>).
    *Childish:* bouncy springs, confetti on every set, wobbling badges.

13. **Copy tone.**
    *Rule:* terse, a coach's voice, verbs on buttons ("Log set", "Start rest", "Finish workout"),
    units always shown, no exclamation marks, no emoji, sentence case.
    *Childish:* "Woohoo! 🎉 You crushed it!!"

14. **Decoration budget of zero.**
    *Rule:* every graphic element must encode data or affordance. The double-stripe motif fails this
    test, so remove it, or keep one stripe as a 2 px accent rule under the active exercise if a
    brand mark is wanted.
    *Why:* ornament adds complexity without adding meaning (Tuch et al.).

15. **Reward as typography, not as a trophy.**
    *Rule:* mark a PR with an accent-coloured "PR" tag, the delta ("+2.5 kg"), and a brief
    highlight on the row. If a medal glyph is kept, make it a monochrome line icon.
    *Childish:* the gold medallion. It belongs to children's sticker charts and casual games.

---

## 2. Context-of-use rules for the gym

### 2.1 Hero numeral size at 0.5–1 m

Legibility is a visual angle. Normal 20/20 letter acuity corresponds to about 5 arcmin, and
comfortable reading speed needs roughly 12–18 arcmin of x-height (Legge & Bigelow 2011:
<https://legge.dl8.umn.edu/sites/legge.psych.umn.edu/files/2020-08/Legge%20Bigelow%202011%20Does%20size%20matter%20for%20reading%3F%20A%20review%20of%20findings%20from%20vision%20science%20and%20typography.pdf>;
signage practice uses 15–20 arcmin: <https://azwebdev.extron.com/article/videowallfontsize>).
For a *glance* in poor conditions (sweat, motion, fatigue, glare), aim for **20–25 arcmin figure
height**.

- At 1 m, 25 arcmin ≈ 7.3 mm figure height. On a modern iPhone (about 6 CSS px per mm), that is
  about 44 CSS px of figure height. With digit height around 0.72 em, the font size comes out at
  **≥ 60 CSS px for the hero weight × reps and the rest timer**.
- At 0.5 m, half that is enough: **≥ 32 px** for secondary numbers (previous set, target).
- Use a semibold or bold weight with open counters. Avoid hairline or condensed-light numerals at
  hero size, because they lose contrast at distance.

### 2.2 Contrast targets

- WCAG AA is the floor: 4.5:1 for body text, 3:1 for large text, and 3:1 for UI boundaries and
  meaningful graphics (SC 1.4.3 and 1.4.11, <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum>,
  <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast>).
- **Gym target, which is stricter:** **≥ 7:1 for all numerals and primary labels** in the
  in-workout screens. Overhead fluorescent glare on a glossy screen washes contrast out
  multiplicatively, so AA-borderline greys disappear.
- Muted text stays ≥ 4.5:1. Never use a "disabled grey" for information.
- Check both themes. Apple's Accessibility Inspector uses the WCAG AA values (secondary summary:
  <https://www.designsystemscollective.com/a-designers-field-guide-to-wcag-ios-and-android-rules-31ba5d01d46a>).

### 2.3 Thumb zone and primary action placement

- People hold phones in several ways and switch grips often. One-handed thumb use is common but
  not universal. People prefer to read and touch near the **centre** of the screen, and the
  **edges and corners are slower and less accurate** (Hoober,
  <https://www.uxmatters.com/mt/archives/2013/11/design-for-fingers-and-thumbs-instead-of-touch.php>,
  <https://www.uxmatters.com/mt/archives/2017/07/design-for-fingers-touch-and-people-part-3.php>;
  book chapter "Touch Accuracy and the Center-Out Preference":
  <https://www.smashingmagazine.com/printed-books/touch-design-for-mobile-interfaces/>).
- **Rule:** the one primary action ("Log set" / "Done") is a full-width bar in the lower third,
  inset from the very bottom edge by the safe area plus 8–16 px. The keypad and steppers sit in the
  lower half. Destructive and rare actions go to the top bar or an overflow menu, never next to the
  primary action.

### 2.4 Tap sizes for sweaty fingers

- Platform minimums: Apple 44×44 pt; Android/Material 48×48 dp (about 9 mm) with 8 dp gaps
  (<https://support.google.com/accessibility/android/answer/7101858>); WCAG 2.2 AA 24×24 px
  (<https://kb.daisy.org/publishing/docs/wcag/target-size-minimum.html>).
- Hoober's position is to plan for imprecision and give the largest practical targets (UXmatters,
  2017).
- **Gym rule:** **≥ 56 px** for every in-workout control. **Keypad keys ≥ 64 px tall.** The
  primary action **≥ 56 px tall and full width.** **≥ 8 px gaps** between adjacent targets, so a
  wet thumb that lands off-centre does not hit the neighbour. No swipe-only actions mid-set,
  because wet skin drags.

### 2.5 How much to show mid-set

Show the current exercise name, set number out of total, the target (weight × reps), the previous
performance for this set, the input, and the primary action. That is all.

Warm-up ramp, plate math, notes, RPE and set kind are **one tap away**, never on the default
surface (see section 4). A good test: if the phone sits on a bench 1 m away, the user should be
able to read *what to lift next* without picking it up.

### 2.6 Dark vs light in the gym: both sides

**For light:**
- In bright ambient light, there is no significant reading-performance difference between
  polarities. Light mode wins at small sizes and for most people with normal vision (NN/g:
  <https://www.nngroup.com/articles/dark-mode/>).
- Light mode makes the screen reflect less of the user's own face and the ceiling lights.
- It matches the current "ivory" brand equity.

**For dark:**
- Many gyms are dim with spotlights, and a white screen there is a lamp in the eyes.
- Dark mode saves battery on OLED phones during 60–90 minute sessions.
- It is the category prototype for training tools (Apple Fitness, Garmin, Whoop), so it raises PT.
- At *large* sizes, which is the in-workout case, dark mode's small-text penalty largely disappears
  (NN/g above).

**Dark does not have to mean neon.** The rejected version failed because of a *saturated
fluorescent accent on pure black*. Saturated colours "vibrate" on dark surfaces, and Material
recommends desaturated tones on a dark grey (#121212) base with elevation shown by lighter
surfaces (<https://m2.material.io/design/color/dark-theme>,
<https://developer.android.com/design/ui/wear/guides/m2-5/styles/color>).

**Recommendation:** ship light as the default, design dark as a first-class twin with the same
tokens, and follow the system setting. Palette B below is a non-neon dark.

### 2.7 Haptics and sound

- Haptics should confirm, not decorate. Apple pairs haptics with visual and audio feedback, warns
  against overuse, and haptics must never be the only signal
  (<https://developer-mdn.apple.com/design/human-interface-guidelines/patterns/playing-haptics>).
- **PWA caveat:** `navigator.vibrate` is not exposed in iOS Safari, so feature-detect it and treat
  it as Android-only enhancement
  (<https://github.com/mdn/browser-compat-data/issues/29166>).
- **Sound** is the only cross-platform "eyes-off" cue for rest end. Use a short two-tone chime at
  0 s and an optional tick at 10 s. Make it user-toggleable, and allow it to play over music
  (Web Audio, mixed).
- Suggested pattern: light tick when a set is logged, double pulse at rest end, one longer pattern
  for a PR.

---

## 3. Resolving the taste tension

"Colourful but mellow, sporty, professional" is achievable. The rule that reconciles it:

> **Mellow comes from *area* and *restraint*, not from lightness.** Keep large areas neutral.
> Put a *confident, mid-to-deep* accent on small, meaningful elements. Let the colourful part
> live in **data** (charts, heat map, muscle tags), using muted-but-saturated tones in the
> L\* 45–60 band, not pastels in the L\* 85–92 band.

Pastels look childish because they are light *and* large. Neon looks aggressive because it is
saturated *and* luminous on black. The professional middle is **mid-lightness, moderate chroma,
small area**: think sports broadcast graphics, Swiss transit maps, Garmin and Strava.

The *sporty* part comes from typography (a confident grotesk or a slightly condensed numeral),
from tabular data, and from a single strong accent. It does not come from colour volume.

### Palette strategies (contrast ratios computed)

**A. "Court ink" (light, evolves the current brand).** A warm stone neutral and one deep court
green. Clay is kept only for PRs.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| neutral-50 | #FAFAF9 | page | — |
| neutral-100 | #F4F4F2 | card / alt row | — |
| neutral-200 | #E6E5E1 | hairline divider | decorative |
| neutral-300 | #D2D0CA | disabled fill | decorative |
| neutral-500 | #75726C | muted text, control borders | 4.59:1 on 50 |
| neutral-600 | #57544F | secondary text | 7.22:1 |
| neutral-700 | #3F3D39 | — | — |
| neutral-900 | #1A1917 | ink / numerals | 16.8:1 |
| accent-600 | #1F6B4A | primary button, active | white on it 6.44:1; as text 6.17:1 |
| pr-600 | #9A3F1C (clay) | PR tag text | 6.48:1 |
| data: blue | #2F6F8F | push / chart | 5.54:1 on white |
| data: green | #4E7D3A | legs | 4.86:1 |
| data: plum | #7A4E8C | pull | 6.37:1 |
| data: amber | #B5651D | core | 4.34:1 (≥3:1 for graphics; not for small text) |

**B. "Graphite court" (dark, the non-neon dark).** A dark grey base and a desaturated mint-green
accent.

| Token | Hex | Contrast |
|---|---|---|
| bg | #121413 | — |
| surface-1 | #1B1E1D | — |
| surface-2 | #24292A | — |
| text | #ECEFED | 15.98:1 on bg |
| muted | #A3ABA7 | 7.88:1 on bg, 7.15:1 on surface-1 |
| subtle | #7C8581 | 4.87:1 on bg |
| accent | #5FBF8A | 8.2:1 on bg; dark text #0F1A14 on it 7.9:1 |
| PR | #E8B04B (muted gold, text only) | 9.46:1 |
| data | #6FA8C7 / #8DB874 / #B392C4 / #D99A5B | 6.3–7.4:1 on surface-1 |

**C. "Navy & signal" (light, editorial-sporty).** Ink navy and one burnt-orange signal colour.
This reads as sports broadcast or federation branding.

| Token | Hex | Contrast |
|---|---|---|
| page | #F7F7F5 | — |
| ink | #14213D | 14.89:1 |
| secondary text | #5B6475 | 5.55:1 |
| signal accent | #C2410C | white on it 5.18:1; as text 4.83:1 |
| nav / header (optional) | #14213D with white text | 15.97:1 |

**D. "Clay & charcoal" (light, warm, closest to the "mellow" wish).** A charcoal ink, a sage
primary, and terracotta reserved for highlights.

| Token | Hex | Contrast |
|---|---|---|
| page | #F5F3EE | — |
| ink | #2B2F36 | 12.12:1 |
| muted | #5E6470 | 5.36:1 |
| primary (sage-deep) | #3E6B5A | white on it 6.08:1 |
| highlight (terracotta) | #B4532A | white on it 4.99:1; as text on page 4.50:1 (use at ≥ 18 px bold, or #9A3F1C for small text) |

**Recommendation:** A as the light default and B as its dark twin. Both keep the owner's
court-green equity while fixing area and lightness. The four muscle families move to the data
colours above, and their pastel tints are allowed only as ≤ 12% opacity backgrounds behind a
tag's text.

### Typeface pairings (all free and self-hostable)

1. **Inter Tight (UI) + Inter Display-style numerals (`tnum`, `ss01`).** This is the neutral
   professional default. Inter has true tabular figures and a large x-height, and the Tight cut
   gives a sporty, compact headline without condensing the body. Lowest risk, highest
   prototypicality.
2. **Archivo (UI and headings, using its width axis) + Archivo Semi/Extra Condensed for hero
   numerals.** A grotesk with athletic, poster-like condensed widths in one family, so the type
   stays coherent. It replaces Barlow Semi-Condensed with a sturdier, less "rounded-friendly"
   number shape. Sporty and editorial.
3. **IBM Plex Sans (UI) + IBM Plex Mono or JetBrains Mono (numerals and tables).** An instrument or
   lab-notebook feel: precise, technical, clearly "a tool". Mono numerals align perfectly in set
   tables. Best fit if the owner leans toward "serious logbook".

Alternatives: Geist + Geist Mono (very contemporary, similar to 3); Manrope (friendlier, more
geometric, so watch the childish drift); Oswald only for one-word display uses, never for UI.
Space Grotesk's quirky glyphs add personality but cut against "mellow".

Typography rule regardless of family: the body is 16 px with 1.35–1.45 line height, inside
Butterick's 120–145% guidance (<https://practicaltypography.com/>), and the body never uses a
condensed face.

---

## 4. Interaction architecture: IA, components, feedback and states

### 4.1 Two modes: "Now" and "Plan / Review"

A training app has two very different contexts, and the IA should make them two *modes*, not
two tabs of equal weight.

- **Now mode (in workout), which is task-centric.** A full-screen, focused flow: current exercise →
  log set → rest → next set or exercise → finish. The bottom tab bar is hidden. The only persistent
  chrome is a slim top bar (session timer, exercise index such as 3/6, overflow menu) and a
  "minimise" control. When minimised, a persistent **"Workout in progress" pill/mini-bar** above
  the tab bar returns to it in one tap (the pattern Strong and Hevy use, and the media-player
  mini-bar pattern).
- **Plan / Review mode (outside the workout), which is object-centric.** Tabs map to *objects*:
  **Today** (start the next workout), **History** (sessions), **Progress** (stats, charts, heat
  map), **Library** (exercises and programs). Keep it to 4 tabs maximum; settings go behind a
  profile icon.
- **Why:** mid-set the user has one job and little attention, so any navigation chrome is noise.
  Outside the workout they browse and compare, which is object-centric work. Matching IA to the
  task model raises PT (it looks like the category prototype) and cuts VC.

### 4.2 Progressive disclosure for mid-set

NN/g: show the primary options by default and defer secondary ones, so the interface is easier to
learn and less error-prone (<https://www.nngroup.com/articles/progressive-disclosure/>,
<https://www.nngroup.com/videos/progressive-disclosure/>).

| Tier | Content | Where |
|---|---|---|
| **Always** | exercise, set n/N, target, previous, weight × reps input, primary action | set card |
| **One tap** | plate breakdown, warm-up ramp, RPE/RIR, set kind, notes, swap exercise | a chip row under the input opens a **bottom sheet** |
| **On demand** | exercise history chart, technique notes, program edit | an overflow item or the exercise title opens a full screen |
| **Never mid-set** | stats dashboards, settings, account | — |

Smart defaults remove taps. Pre-fill weight × reps from the previous set or the program target,
so the most common action is **one tap: "Log set"**.

### 4.3 Components for set logging

- **Focused single-set card (recommended for Now mode).** One set at a time, huge numerals, the
  primary action in the thumb zone. A compact list of the exercise's sets (done ✓ / current / next)
  sits above it, so the user keeps context. This beats a full table mid-set because the table's
  small cells fail the 1 m glance and 56 px target rules.
- **Table (recommended for review and editing).** In History and in the editor, a set table
  (Set | Previous | kg | Reps | ✓) is the professional prototype: dense, scannable, aligned
  tabular numerals. Strong and Hevy also use it in-workout. If you keep a table in Now mode, make
  rows ≥ 56 px and make the current row expand into the focused card.
- **Steppers (−/+) for small adjustments.** Weight step = the smallest plate pair (for example
  ±2.5 kg), reps ±1. Ideal when the value is pre-filled and only nudged, which is the most common
  case. Long-press repeats.
- **Custom numeric keypad for entering new values.** Tapping the number opens it, with keys
  ≥ 64 px and decimal and backspace included. Never use the OS keyboard: it covers half the
  screen, has small keys, and mixes in letters. Combine it with steppers: tap a value to type,
  tap ± to nudge.
- **Bottom sheet vs full-screen overlay.** Use a **bottom sheet** for short, contextual,
  dismissible tasks that keep the set visible: plate math, warm-up ramp, RPE, set kind, a rest
  adjust. NN/g defines a bottom sheet as an overlay anchored to the bottom edge that shows extra
  details or actions (<https://www.nngroup.com/articles/bottom-sheet/>). Material distinguishes
  standard (persistent) from modal (scrimmed) sheets (<https://material.io/components/sheets-bottom>).
  Use a **full-screen overlay** for tasks with their own navigation or long content: exercise
  swap/search, the session summary, the program editor. Never stack sheets.
- **Rest timer** as a **standard (non-modal) sheet or banner** pinned at the bottom: a big
  countdown, ±15 s, Skip. The set list stays visible and editable behind it. A full-screen modal
  timer blocks fixing a mis-logged set.

### 4.4 Interaction feedback

- **Latency:** respond in ≤ 100 ms so it feels like direct manipulation, and keep flow under 1 s
  (Nielsen's three limits: <https://www.nngroup.com/articles/response-times-3-important-limits/>).
- **Optimistic updates:** write locally (IndexedDB) and update the UI immediately, then sync in
  the background. The user never waits on the network mid-set. Sync status is a quiet icon, not a
  spinner.
- **Undo instead of confirm:** delete set, discard exercise and swap all act immediately and show
  a 5–8 s snackbar with Undo, placed above the primary action and outside the thumb's path.
  Confirmation dialogs get clicked through by habit ("dialog fatigue"); keep them for truly
  irreversible, rare actions such as discarding a whole session. Secondary summaries of the
  consensus: <https://notes.andymatuschak.org/zXH4ASvHNz488hCNgrBjQJK>,
  <https://dev.to/137foundry/how-to-choose-between-confirmation-dialogs-undo-windows-and-soft-delete-patterns-1opj>.
- **Logged-set confirmation:** a row check animation (≤ 200 ms) plus haptic on Android, and the
  rest timer starts automatically. One action produces three cues.

### 4.5 State design

- **Empty:** every empty state names the situation, shows the next step and offers *one* primary
  CTA ("No workouts yet → Start today's session"). NN/g: empty states should show system status,
  help learning and give a direct path into the task
  (<https://www.nngroup.com/articles/empty-state-interface-design/>). Use no illustration, or one
  monochrome line glyph.
- **Loading:** local-first means there is almost none. Where remote data is needed (history sync),
  use skeleton rows in the neutral-100 tone. No spinners in Now mode.
- **Error:** inline, specific and recoverable ("Not synced. Saved on this phone. Retry"). Never
  block logging because of a sync error. Use the semantic danger colour only for the icon and text,
  not as a full red banner.
- **Offline:** a quiet badge. Everything in Now mode works offline.
- **PR:** a one-time, ≤ 1.2 s highlight on the row, an accent "PR" tag with the delta, a haptic
  pattern, and a mention in the session summary. No modal: it must not interrupt the next set.

### 4.6 Core-flow tap budgets

| Flow | Target taps |
|---|---|
| Open app → start today's workout | ≤ 2 |
| Log a set exactly as pre-filled | **1** |
| Log a set with a changed weight (stepper) | ≤ 3 |
| Log a set with typed weight and reps | ≤ 8 including digits |
| Skip or adjust rest | 1 |
| Undo the last set | 1 (snackbar) |
| See plate breakdown | 1 (and 1 to close) |
| Finish workout → summary | ≤ 2 |

---

## 5. Mock acceptance checklist

Apply each item to every mockup. Every answer should be **yes**. Items marked † apply to the
in-workout (Now) screens.

**Visual system**
1. Does at least ~85% of each screen use only the neutral ramp (no tinted cards, no pastel fills)?
2. Is there exactly **one** accent colour, used only for the primary action, the active state,
   focus and the PR tag?
3. Do muscle-family and data colours appear only in charts, the heat map and small tags, never as
   large backgrounds?
4. Does every screen use ≤ 6 text sizes from one scale and ≤ 3 weights?
5. Are all changing numbers set in tabular, lining figures (timers do not jitter, columns align)?
6. Are radii ≤ 12 px on cards and ≤ 6 px on inputs, chips and cells, with pills only on small
   tags and toggles?
7. Is there zero pure decoration: no stripes, medallions, confetti or emoji, so every graphic
   encodes data or affordance?
8. Does each screen share one left alignment edge, with numbers right-aligned in columns?
9. Is elevation shown one consistent way (hairline or tone in light mode, lighter surface in dark
   mode)?
10. Are all icons from one family with one stroke weight?
11. Is the copy terse, verb-led, sentence case, with no exclamation marks?

**Gym context**
12. † Is the hero weight × reps (and the rest countdown) ≥ 60 px, readable from 1 m on a bench?
13. † Do numerals and primary labels reach ≥ 7:1 contrast, and all other text ≥ 4.5:1, in both
    light and dark themes?
14. † Is every in-workout tap target ≥ 56 px (keypad keys ≥ 64 px), with ≥ 8 px gaps?
15. † Is the single primary action a full-width bar in the lower third, clear of the bottom edge?
16. † Are destructive or rare actions away from the thumb zone (top bar or overflow)?
17. † Does the default set view show only exercise, set n/N, target, previous, input and primary
    action, with everything else one tap away?
18. Does the dark theme use a dark-grey base and desaturated accents (no neon, no pure black
    behind saturated colour)?

**Interaction and IA**
19. † Is the tab bar hidden in Now mode, with a "workout in progress" bar to return to it from
    elsewhere?
20. Does each screen have exactly **one** visually primary action?
21. † Can a pre-filled set be logged in **1 tap**, and does the rest timer then start
    automatically?
22. Is starting today's workout ≤ 2 taps from launch?
23. Are delete, discard and swap handled with **Undo** (snackbar) rather than a confirm dialog,
    with confirms used only for irreversible session-level actions?
24. Are short contextual tasks (plates, warm-up, RPE) in bottom sheets and long or navigable tasks
    full screen, with no stacked sheets?
25. Are empty, error, offline and PR states designed: each with one next step, logging never
    blocked by sync, and the PR shown without a modal?
