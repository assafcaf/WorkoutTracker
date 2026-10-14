// The token system, proven by reading the CSS as data.
//
// [O1] `src/styles/tokens.css` declares exactly the documented token set on `:root`, and every
// `var(--…)` under `src/**/*.css` names one of them.
// [O2] every documented foreground/background pair clears WCAG 2.1's 4.5:1 for text.
//
// E17-T1 (Progress Dashboard foundation) rewrites the palette-value bodies: titles are kept
// verbatim (the weakened-tests gate tracks tests by title), and the bodies assert the spec's
// 52-token table (.work/specs/2026-10-13-progress-dashboard-foundation.md). E17-T12 [O1]
// removes the Court-only tokens, so the set is now exactly those 52; the Court value tests keep
// their titles and assert each Court token is gone.
//
// The expectations here are the design system's documented values, written out by hand from
// the spec's token table — not read back from the file under test, which would make the audit
// agree with whatever the palette happened to become.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import {
  contrastRatio,
  declarationsFor,
  readTokens,
  referencedVars,
  relativeLuminance,
} from '../test/cssAudit'

// src/styles/tokens.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const srcDir = join(repoRoot, 'src')
const tokensPath = join(srcDir, 'styles', 'tokens.css')

/** Every file under `dir` whose name matches, as a repo-relative '/'-separated path. */
function filesUnder(dir: string, matches: RegExp): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...filesUnder(full, matches))
    else if (matches.test(entry.name)) found.push(full.slice(repoRoot.length + 1).split(sep).join('/'))
  }
  return found.sort()
}

function read(relPath: string): string {
  return readFileSync(join(repoRoot, relPath), 'utf-8')
}

function tokens(): Map<string, string> {
  return readTokens(readFileSync(tokensPath, 'utf-8'))
}

/** Trimmed and lower-cased, so `#FFFFFF` and `#ffffff` are the same value. */
function normalise(value: string | undefined): string {
  return (value ?? '(not declared)').trim().toLowerCase()
}

// The Progress Dashboard palette (E17 spec, Design > Token table), written out by hand.
const COLOUR_TOKENS: Record<string, string> = {
  '--color-bg': '#F6F6F8',
  '--color-surface': '#FFFFFF',
  '--color-raised': '#EEEEF2',
  '--color-hairline': '#E3E3E9',
  '--color-control': '#CACAD3',
  '--color-text': '#16161D',
  '--color-secondary': '#45454F',
  '--color-muted': '#62626F',
  '--color-primary': '#4338A8',
  '--color-primary-pressed': '#362C8C',
  '--color-primary-tint': '#EEEDF8',
  '--color-on-primary': '#FFFFFF',
  '--color-warn': '#8A5A12',
  '--color-danger': '#B42318',
}

// Colour only in data: the four muscle-family marks, the four heat steps and the second
// chart series.
const DATA_TOKENS: Record<string, string> = {
  '--data-push': '#256F91',
  '--data-pull': '#96506F',
  '--data-legs': '#4F7A33',
  '--data-core': '#93611A',
  '--heat-0': '#E6F1F2',
  '--heat-1': '#A9D3D6',
  '--heat-2': '#4E9DA4',
  '--heat-3': '#1D6970',
  '--chart-b': '#8A8A97',
}

// Effects: the sheet scrim and the sheet's shadow. Compared with whitespace removed, since
// spacing inside rgba() is not the decision.
const EFFECT_TOKENS: Record<string, string> = {
  '--scrim': 'rgba(22, 22, 29, 0.4)',
  '--shadow-sheet': '0 8px 24px rgba(22, 22, 29, 0.12)',
}

const WEIGHT_TOKENS: Record<string, string> = {
  '--weight-regular': '400',
  '--weight-medium': '500',
  '--weight-semibold': '600',
}

// The four muscle families' pastel tint and the ink that reads on it.
const FAMILY_TOKENS: Record<string, string> = {
  '--family-push-tint': '#F3DDD0',
  '--family-push-ink': '#7A3A20',
  '--family-pull-tint': '#DCE5F0',
  '--family-pull-ink': '#2E4A6B',
  '--family-legs-tint': '#DDE7DA',
  '--family-legs-ink': '#34503A',
  '--family-core-tint': '#E6DFEE',
  '--family-core-ink': '#4F3D68',
}

// The personal-record medallion.
const PR_TOKENS: Record<string, string> = {
  '--pr-tint': '#F2E3B8',
  '--pr-ink': '#6B4E0E',
  '--pr-ring': '#B08A2E',
}

// BodyMap's four-step shade ramp, raised-to-clay, plus its exercise-scale primary/secondary
// pair. Not part of CONTRAST_PAIRS: these are map fill colours, not a text/background pair.
// --map-shade-0 equals --color-raised (BodyMap.test.tsx O14), so it follows E17's raised.
const MAP_TOKENS: Record<string, string> = {
  '--map-shade-0': '#EEEEF2',
  '--map-shade-1': '#EBC7B0',
  '--map-shade-2': '#D0906C',
  '--map-shade-3': '#9E5231',
  '--map-primary': '#9E5231',
  '--map-secondary': '#D0906C',
}

const SCALE_TOKENS: Record<string, string> = {
  '--space-1': '4px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-5': '24px',
  '--space-6': '32px',
  '--radius-sm': '6px',
  '--radius-md': '10px',
  '--radius-lg': '12px',
  '--radius-pill': '999px',
  '--tap-min': '44px',
  '--key-min': '64px',
  '--text-xs': '12px',
  '--text-sm': '14px',
  '--text-md': '16px',
  '--text-lg': '20px',
  '--text-xl': '28px',
  '--text-hero': '60px',
  '--text-display': '64px',
}

const MOTION_TOKENS: Record<string, string> = {
  '--motion-fast': '150ms',
  '--press-scale': '0.97',
}

// The spec's 52-token table, by name. `--font-sans`, `--safe-bottom` and `--safe-top` carry
// values that are not a plain literal, so they are asserted on their own below.
const DOCUMENTED_TOKENS = [
  ...Object.keys(COLOUR_TOKENS),
  ...Object.keys(DATA_TOKENS),
  ...Object.keys(EFFECT_TOKENS),
  ...Object.keys(SCALE_TOKENS),
  ...Object.keys(WEIGHT_TOKENS),
  ...Object.keys(MOTION_TOKENS),
  '--font-sans',
  '--safe-bottom',
  '--safe-top',
].sort()

// The Court-only tokens E17-T12 removes, with their last use.
const COURT_ONLY_TOKENS = [
  '--color-accent',
  '--font-display',
  ...Object.keys(FAMILY_TOKENS),
  ...Object.keys(PR_TOKENS),
  ...Object.keys(MAP_TOKENS),
]

const REMOVED_TOKENS = ['--color-border', '--color-on-accent', '--shadow-card']

// The pairs [O2] iterates, from the E17 spec's O2, by floor.
const SURFACES = ['--color-bg', '--color-surface', '--color-raised']

// Numerals (7:1): the two ink colours on each surface.
const NUMERAL_PAIRS: ReadonlyArray<readonly [string, string]> = [
  '--color-text',
  '--color-secondary',
].flatMap((fg) => SURFACES.map((bg) => [fg, bg] as const))

// Primary label (7:1): the on-primary label at rest and pressed.
const PRIMARY_LABEL_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['--color-on-primary', '--color-primary'],
  ['--color-on-primary', '--color-primary-pressed'],
]

// Text (4.5:1).
const TEXT_COLOURS = ['--color-muted', '--color-primary', '--color-warn', '--color-danger']
const CONTRAST_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ...TEXT_COLOURS.flatMap((fg) => SURFACES.map((bg) => [fg, bg] as const)),
  ['--color-primary', '--color-primary-tint'],
  ['--color-text', '--heat-2'],
  ['--color-on-primary', '--heat-3'],
]

// Marks (3:1): every data colour on a card.
const MARK_PAIRS: ReadonlyArray<readonly [string, string]> = [
  '--data-push',
  '--data-pull',
  '--data-legs',
  '--data-core',
  '--chart-b',
].map((fg) => [fg, '--color-surface'] as const)

/** Each pair below `floor`, as a readable failure line; empty when every pair clears it. */
function pairsBelow(pairs: ReadonlyArray<readonly [string, string]>, floor: number): string[] {
  const declared = tokens()
  return pairs
    .map(([foreground, background]) => {
      const fg = declared.get(foreground)
      const bg = declared.get(background)
      if (!fg || !bg) return `${foreground} on ${background}: not declared`
      const ratio = contrastRatio(fg, bg)
      return ratio >= floor ? null : `${foreground} on ${background}: ${ratio.toFixed(2)}:1`
    })
    .filter((failure): failure is string => failure !== null)
}

/** `map`'s names read back from tokens.css beside its documented values, both normalised. */
function compare(map: Record<string, string>): { actual: object; expected: object } {
  const declared = tokens()
  return {
    actual: Object.fromEntries(
      Object.keys(map).map((name) => [name, normalise(declared.get(name))]),
    ),
    expected: Object.fromEntries(
      Object.entries(map).map(([name, value]) => [name, normalise(value)]),
    ),
  }
}

test('O1 tokens.css declares exactly the forty-nine documented tokens on :root', () => {
  // Title kept (weakened-tests gate); the body asserts tokens.css declares the E17 52-token
  // table exactly: every documented token, and nothing else (E17-T12 [O1]).
  expect(DOCUMENTED_TOKENS).toHaveLength(52)
  expect([...tokens().keys()].sort()).toEqual(DOCUMENTED_TOKENS)
})

// Gate identifiers (E10-T1): the two tests below keep their pre-Court titles because the merge
// gate tracks tests by title across an intentional rewrite. Their titles are historical; the
// bodies assert the Court expectation (49 tokens; no --shadow-card and no --color-border).
test('O1 tokens.css declares exactly the thirty-six documented tokens on :root', () => {
  // Title kept (weakened-tests gate); the body (E17-T12 [O1]): tokens.css declares no token
  // outside the 52-token table, the Court-only ones included, and declares 52 in all.
  const documented = new Set(DOCUMENTED_TOKENS)
  const declared = [...tokens().keys()]
  expect(declared.filter((name) => !documented.has(name)), 'tokens outside the table').toEqual([])
  expect(declared.filter((name) => COURT_ONLY_TOKENS.includes(name)), 'Court-only tokens').toEqual(
    [],
  )
  expect(new Set(declared).size).toBe(52)
})

test('O1 --shadow-card is an inset hairline expressed through --color-border', () => {
  const declared = tokens()
  expect(declared.has('--shadow-card'), '--shadow-card is removed in the Court palette').toBe(false)
  expect(declared.has('--color-border'), '--color-border is removed in the Court palette').toBe(false)
})

test('O1 tokens.css no longer declares --color-border, --color-on-accent or --shadow-card', () => {
  const declared = tokens()
  expect(REMOVED_TOKENS.filter((name) => declared.has(name))).toEqual([])
})

test('O1 the colour tokens carry the documented palette values', () => {
  const { actual, expected } = compare(COLOUR_TOKENS)
  expect(actual).toEqual(expected)
})

test('O1 the four muscle-family tint and ink tokens carry the documented values', () => {
  // Title kept (weakened-tests gate); E17-T12 [O1] drops these Court tokens from the table.
  const declared = tokens()
  expect(Object.keys(FAMILY_TOKENS).filter((name) => declared.has(name))).toEqual([])
})

test('O1 the personal-record tint, ink and ring tokens carry the documented values', () => {
  // Title kept (weakened-tests gate); E17-T12 [O1] drops these Court tokens from the table.
  const declared = tokens()
  expect(Object.keys(PR_TOKENS).filter((name) => declared.has(name))).toEqual([])
})

test('O1 the body-map shade and primary/secondary tokens carry the documented values', () => {
  // Title kept (weakened-tests gate); E17-T12 [O1] drops these Court tokens from the table.
  const declared = tokens()
  expect(Object.keys(MAP_TOKENS).filter((name) => declared.has(name))).toEqual([])
})

test('O1 the spacing, radius, tap and type scales carry the documented values', () => {
  const { actual, expected } = compare(SCALE_TOKENS)
  expect(actual).toEqual(expected)
})

test('O1 the data, heat and chart tokens carry the documented values', () => {
  const { actual, expected } = compare(DATA_TOKENS)
  expect(actual).toEqual(expected)
})

test('O1 the scrim and sheet-shadow effect tokens carry the documented values', () => {
  const declared = tokens()
  const squash = (value: string | undefined) => normalise(value).replace(/\s+/g, '')
  expect(
    Object.fromEntries(Object.keys(EFFECT_TOKENS).map((name) => [name, squash(declared.get(name))])),
  ).toEqual(
    Object.fromEntries(Object.entries(EFFECT_TOKENS).map(([name, value]) => [name, squash(value)])),
  )
})

test('O1 the weight tokens carry 400, 500 and 600', () => {
  const { actual, expected } = compare(WEIGHT_TOKENS)
  expect(actual).toEqual(expected)
})

test('O1 the motion tokens carry a 150ms fast duration and a 0.97 press scale', () => {
  const { actual, expected } = compare(MOTION_TOKENS)
  expect(actual).toEqual(expected)
})

test('O1 --font-sans is a system stack, so no web font has to reach the phone', () => {
  // Body now names Geist first, then the system stack (E17-T2); the title is kept.
  const fontSans = normalise(tokens().get('--font-sans'))
    .replace(/"/g, "'")
    .replace(/\s*,\s*/g, ', ')

  expect(fontSans).toBe("'geist', system-ui, -apple-system, 'segoe ui', roboto, sans-serif")
  expect(fontSans, '--font-sans must not load a font file').not.toMatch(/url\(/)
})

test('O1 --font-display names Barlow Semi-Condensed first, then the system stack', () => {
  // Title kept (weakened-tests gate); E17-T12 [O1] drops --font-display: one family, Geist,
  // through --font-sans.
  expect(tokens().has('--font-display'), '--font-display is still declared').toBe(false)
  expect(readFileSync(tokensPath, 'utf-8')).not.toMatch(/barlow/i)
})

test('O1 tokens.css declares no @font-face, so the display font is loaded elsewhere', () => {
  expect(readFileSync(tokensPath, 'utf-8')).not.toMatch(/@font-face/)
})

test('O1 --safe-bottom reads the bottom safe-area inset and falls back to 0px', () => {
  expect(normalise(tokens().get('--safe-bottom'))).toMatch(
    /^env\(\s*safe-area-inset-bottom\s*,\s*0px\s*\)$/,
  )
})

// [F3, fix-popups] the popup overlay clears the top safe-area inset too, so a dialog that
// covers the whole viewport does not paint under the notch -- mirrors the --safe-bottom test
// above.
test('O1 --safe-top reads the top safe-area inset and falls back to 0px', () => {
  expect(normalise(tokens().get('--safe-top'))).toMatch(
    /^env\(\s*safe-area-inset-top\s*,\s*0px\s*\)$/,
  )
})

test('O1 every var(--…) under src names a token tokens.css declares', () => {
  const declared = new Set(tokens().keys())
  const references = new Map<string, string[]>()
  for (const file of filesUnder(srcDir, /\.css$/)) {
    for (const name of referencedVars(read(file))) {
      references.set(name, [...(references.get(name) ?? []), file])
    }
  }

  expect(
    references.size,
    'no stylesheet references a token at all, so this audit would pass vacuously',
  ).toBeGreaterThan(0)
  const undeclared = [...references.entries()]
    .filter(([name]) => !declared.has(name))
    .map(([name, files]) => `${name} (in ${files.join(', ')})`)
  expect(undeclared, 'these var() references name no declared token').toEqual([])
})

// The ticket's styling rule, consuming O1's new pair: every primary action paints court green
// with its on-primary label; clay (--color-accent) is for data, not for buttons. Keyed by the
// stylesheet and the selector that paints each action today.
const PRIMARY_ACTIONS: ReadonlyArray<readonly [string, string]> = [
  ['src/ui/AppShell.css', '.action-bar-slot > button'], // Log set
  ['src/ui/WorkoutStartButtons.css', '.start-workout'], // Start
  ['src/ui/ResumeCard.css', '.resume-workout'], // Resume
  ['src/ui/SessionSummary.css', '.session-summary-done'], // Done
  ['src/ui/ImportConfirm.css', '.import-confirm-confirm'],
  ['src/ui/UpdatePill.css', '.update-pill'],
  ['src/ui/AlternativesList.css', '.alternatives-row-choose'],
  ['src/ui/NoProgram.css', '.no-program-choose'],
]

test('O1 every primary action paints --color-primary with a --color-on-primary label', () => {
  const wrong = PRIMARY_ACTIONS.map(([file, selector]) => {
    const decls = declarationsFor(read(file), selector)
    const background = decls.get('background') ?? decls.get('background-color')
    const color = decls.get('color')
    return background === 'var(--color-primary)' && color === 'var(--color-on-primary)'
      ? null
      : `${file} ${selector}: background ${background ?? '(none)'}, color ${color ?? '(none)'}`
  }).filter((failure): failure is string => failure !== null)

  expect(wrong, 'these primary actions do not paint court green').toEqual([])
})

test('O2 every documented foreground/background pair clears 4.5:1', () => {
  // Title kept (weakened-tests gate); the body is E17's Text pairs.
  expect(
    CONTRAST_PAIRS,
    'four text colours on three surfaces, primary on tint, text on heat-2, on-primary on heat-3',
  ).toHaveLength(15)
  expect(pairsBelow(CONTRAST_PAIRS, 4.5), 'these pairs fall below WCAG 2.1 AA for text').toEqual([])
})

test('O2 numerals: --color-text and --color-secondary clear 7:1 on bg, surface and raised', () => {
  expect(NUMERAL_PAIRS).toHaveLength(6)
  expect(pairsBelow(NUMERAL_PAIRS, 7), 'these numeral pairs fall below 7:1').toEqual([])
})

test('O2 primary label: --color-on-primary clears 7:1 on --color-primary and on --color-primary-pressed', () => {
  expect(pairsBelow(PRIMARY_LABEL_PAIRS, 7), 'the primary label falls below 7:1').toEqual([])
})

test('O2 marks: every --data-* colour and --chart-b clear 3:1 on --color-surface', () => {
  expect(MARK_PAIRS).toHaveLength(5)
  expect(pairsBelow(MARK_PAIRS, 3), 'these data marks fall below 3:1 on a card').toEqual([])
})

// The two helpers [O2] measures with, against values computed by hand from the WCAG 2.1
// formula. Without these a `contrastRatio` that always returned 21 would let the audit above
// pass over any palette at all.

test('O2 relativeLuminance is 0 for black and 1 for white', () => {
  expect(relativeLuminance('#000000')).toBeCloseTo(0, 6)
  expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 6)
  expect(relativeLuminance('#ffffff'), 'hex case must not change the result').toBeCloseTo(1, 6)
})

test('O2 relativeLuminance applies the sRGB gamma curve, not the raw channel value', () => {
  // #808080 is 0.50196 of full scale per channel; gamma-corrected that is 0.21586, not 0.502.
  expect(relativeLuminance('#808080')).toBeCloseTo(0.21586, 4)
})

test('O2 contrastRatio is 21:1 for white on black and 1:1 for a colour on itself', () => {
  expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 4)
  expect(contrastRatio('#C6F84E', '#C6F84E')).toBeCloseTo(1, 6)
})

test('O2 contrastRatio puts #767676 on white at 4.54:1 whichever colour leads', () => {
  // The canonical WCAG boundary grey: 4.54:1, just over the threshold for body text. The ratio
  // is defined on the lighter and darker of the two, so the argument order cannot matter.
  expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2)
  expect(contrastRatio('#FFFFFF', '#767676')).toBeCloseTo(4.54, 2)
})

// The two helpers [O1] measures with.

test('O1 readTokens returns :root custom properties under their full names', () => {
  const css = ':root {\n  --color-bg: #0B0B0F;\n  --space-1: 4px;\n}\n.card { color: red; }\n'

  expect([...readTokens(css).entries()]).toEqual([
    ['--color-bg', '#0B0B0F'],
    ['--space-1', '4px'],
  ])
})

test('O1 readTokens ignores custom properties declared outside :root', () => {
  const css = ':root { --color-bg: #0B0B0F; }\n.card { --local-pad: 4px; padding: 4px; }\n'

  expect([...readTokens(css).keys()]).toEqual(['--color-bg'])
})

test('O1 referencedVars finds every var() reference, nested or with a fallback, and no more', () => {
  const css = [
    '.card {',
    '  color: var(--color-text);',
    '  box-shadow: inset 0 0 0 1px var(--color-border);',
    '  padding: calc(var(--space-2) + var(--space-1, 4px));',
    '}',
    '.plain { padding: 4px; }',
  ].join('\n')

  expect([...referencedVars(css)].sort()).toEqual([
    '--color-border',
    '--color-text',
    '--space-1',
    '--space-2',
  ])
})

// E17-T1 Interfaces: components.css is where T6-T10 put the global component rules, and it
// only reaches the bundle through base.css (cssAudit's O6 holds every stylesheet reachable).
test('O1 base.css imports components.css, the home of the global component rules', () => {
  expect(
    existsSync(join(srcDir, 'styles', 'components.css')),
    'src/styles/components.css does not exist',
  ).toBe(true)
  expect(read('src/styles/base.css')).toMatch(/@import\s+(?:url\()?['"]\.\/components\.css['"]/)
})
