// The token system, proven by reading the CSS as data.
//
// [O1] `src/styles/tokens.css` declares exactly the documented token set on `:root`, and every
// `var(--…)` under `src/**/*.css` names one of them.
// [O2] every documented foreground/background pair clears WCAG 2.1's 4.5:1 for text.
//
// The expectations here are the design system's documented values, written out by hand from
// the spec's token table — not read back from the file under test, which would make the audit
// agree with whatever the palette happened to become.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import {
  contrastRatio,
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

// The documented set: exactly these thirty-five custom properties, and no more. Later tasks
// use these names and add none.
const COLOUR_TOKENS: Record<string, string> = {
  '--color-bg': '#0B0B0F',
  '--color-surface': '#16161C',
  '--color-raised': '#1F1F27',
  '--color-border': '#2A2A33',
  '--color-text': '#FFFFFF',
  '--color-muted': '#8A8A94',
  '--color-accent': '#C6F84E',
  '--color-on-accent': '#0B0B0F',
  '--color-warn': '#FFB020',
  '--color-danger': '#FF6B6B',
}

// BodyMap's four-step shade ramp plus its exercise-scale primary/secondary pair (E5-T17, M5/M8/
// M10). Not part of CONTRAST_PAIRS: these are map fill colours, not a text/background pair.
const MAP_TOKENS: Record<string, string> = {
  '--map-shade-0': '#23232B',
  '--map-shade-1': '#3E4A22',
  '--map-shade-2': '#7C9A2E',
  '--map-shade-3': '#C6F84E',
  '--map-primary': '#C6F84E',
  '--map-secondary': '#6B8F3D',
}

const SCALE_TOKENS: Record<string, string> = {
  '--space-1': '4px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-5': '24px',
  '--space-6': '32px',
  '--radius-sm': '8px',
  '--radius-lg': '16px',
  '--radius-pill': '999px',
  '--tap-min': '44px',
  '--text-xs': '12px',
  '--text-sm': '14px',
  '--text-md': '16px',
  '--text-lg': '20px',
  '--text-xl': '28px',
  '--text-display': '56px',
}

// `--font-sans`, `--shadow-card`, `--safe-bottom` and `--safe-top` carry values that are not a
// plain literal, so they are named here and asserted on their own below.
//
// RULING (fix-popups, F3): `--safe-top` was added here to match the popup layer's overlay,
// which has to clear the top safe-area inset as well as the bottom one -- the tab bar is moving
// to the top of the screen in a later, separate fix task, but the popup covering the whole
// viewport needs both insets regardless of where the tab bar ends up. This makes the documented
// set thirty-six rather than thirty-five; the test name and count below are updated to match,
// and a new test mirroring the existing `--safe-bottom` one is added for it. This is an
// authorised rewrite of this file, not a weakening -- see the fix-popups ticket's addendum.
const DOCUMENTED_TOKENS = [
  ...Object.keys(COLOUR_TOKENS),
  ...Object.keys(MAP_TOKENS),
  ...Object.keys(SCALE_TOKENS),
  '--font-sans',
  '--shadow-card',
  '--safe-bottom',
  '--safe-top',
].sort()

// The pairs [O2] iterates, from the spec's contrast table. `--color-border`, `--color-raised`
// and `--shadow-card` are non-text tokens and are excluded by name: WCAG's 4.5:1 rule is about
// text, and a hairline that met it would not be a hairline.
const CONTRAST_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['--color-text', '--color-bg'],
  ['--color-text', '--color-surface'],
  ['--color-muted', '--color-bg'],
  ['--color-muted', '--color-surface'],
  ['--color-accent', '--color-bg'],
  ['--color-accent', '--color-surface'],
  ['--color-on-accent', '--color-accent'],
  ['--color-warn', '--color-bg'],
  ['--color-danger', '--color-bg'],
]

test('O1 tokens.css declares exactly the thirty-six documented tokens on :root', () => {
  expect([...tokens().keys()].sort()).toEqual(DOCUMENTED_TOKENS)
})

test('O1 the colour tokens carry the documented palette values', () => {
  const declared = tokens()
  const actual = Object.fromEntries(
    Object.keys(COLOUR_TOKENS).map((name) => [name, normalise(declared.get(name))]),
  )
  const expected = Object.fromEntries(
    Object.entries(COLOUR_TOKENS).map(([name, value]) => [name, normalise(value)]),
  )
  expect(actual).toEqual(expected)
})

test('O1 the body-map shade and primary/secondary tokens carry the documented values', () => {
  const declared = tokens()
  const actual = Object.fromEntries(
    Object.keys(MAP_TOKENS).map((name) => [name, normalise(declared.get(name))]),
  )
  const expected = Object.fromEntries(
    Object.entries(MAP_TOKENS).map(([name, value]) => [name, normalise(value)]),
  )
  expect(actual).toEqual(expected)
})

test('O1 the spacing, radius, tap and type scales carry the documented values', () => {
  const declared = tokens()
  const actual = Object.fromEntries(
    Object.keys(SCALE_TOKENS).map((name) => [name, normalise(declared.get(name))]),
  )
  const expected = Object.fromEntries(
    Object.entries(SCALE_TOKENS).map(([name, value]) => [name, normalise(value)]),
  )
  expect(actual).toEqual(expected)
})

test('O1 --font-sans is a system stack, so no web font has to reach the phone', () => {
  const css = readFileSync(tokensPath, 'utf-8')
  const fontSans = normalise(tokens().get('--font-sans'))

  expect(fontSans).toMatch(/system-ui|-apple-system/)
  expect(fontSans, '--font-sans must not load a font file').not.toMatch(/url\(/)
  expect(css, 'tokens.css must declare no @font-face').not.toMatch(/@font-face/)
})

test('O1 --shadow-card is an inset hairline expressed through --color-border', () => {
  const shadowCard = normalise(tokens().get('--shadow-card'))

  expect(shadowCard).toMatch(/\binset\b/)
  expect(shadowCard).toMatch(/var\(\s*--color-border/)
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

test('O2 every documented foreground/background pair clears 4.5:1', () => {
  const declared = tokens()
  const tooLow = CONTRAST_PAIRS.map(([foreground, background]) => {
    const fg = declared.get(foreground)
    const bg = declared.get(background)
    if (!fg || !bg) return `${foreground} on ${background}: not declared`
    const ratio = contrastRatio(fg, bg)
    return ratio >= 4.5 ? null : `${foreground} on ${background}: ${ratio.toFixed(2)}:1`
  }).filter((failure): failure is string => failure !== null)

  expect(tooLow, 'these pairs fall below WCAG 2.1 AA for text').toEqual([])
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
