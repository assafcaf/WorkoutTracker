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

// The documented set (E10, Court design language): exactly these forty-nine custom
// properties, and no more -- 10 colour + 8 family + 3 PR + 6 map + 16 scale + 6 others (the two
// fonts, the two motion tokens and the two safe areas). Written out by hand from the spec's
// token table. `--color-border`, `--color-on-accent` and `--shadow-card` are gone: cards
// separate by tint, not by a hairline.
const COLOUR_TOKENS: Record<string, string> = {
  '--color-bg': '#F5F1E8',
  '--color-surface': '#FFFFFF',
  '--color-raised': '#ECE6DA',
  '--color-text': '#24211D',
  '--color-muted': '#5F5A52',
  '--color-primary': '#1F4D3A',
  '--color-on-primary': '#F5F1E8',
  '--color-accent': '#9E5231',
  '--color-warn': '#8A5A12',
  '--color-danger': '#A33B32',
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
const MAP_TOKENS: Record<string, string> = {
  '--map-shade-0': '#ECE6DA',
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
  '--radius-sm': '12px',
  '--radius-lg': '20px',
  '--radius-pill': '999px',
  '--tap-min': '44px',
  '--text-xs': '12px',
  '--text-sm': '14px',
  '--text-md': '16px',
  '--text-lg': '20px',
  '--text-xl': '28px',
  '--text-display': '64px',
}

const MOTION_TOKENS: Record<string, string> = {
  '--motion-fast': '150ms',
  '--press-scale': '0.97',
}

// `--font-sans`, `--font-display`, `--safe-bottom` and `--safe-top` carry values that are not a
// plain literal, so they are named here and asserted on their own below.
const DOCUMENTED_TOKENS = [
  ...Object.keys(COLOUR_TOKENS),
  ...Object.keys(FAMILY_TOKENS),
  ...Object.keys(PR_TOKENS),
  ...Object.keys(MAP_TOKENS),
  ...Object.keys(SCALE_TOKENS),
  ...Object.keys(MOTION_TOKENS),
  '--font-sans',
  '--font-display',
  '--safe-bottom',
  '--safe-top',
].sort()

const REMOVED_TOKENS = ['--color-border', '--color-on-accent', '--shadow-card']

// The pairs [O2] iterates, from the spec's contrast table: every text colour on each of the
// three surfaces, the primary action's label on it, each family ink on its tint, and the PR ink
// on its tint. `--pr-ring` and the map shades are non-text fills and are excluded by name.
const SURFACES = ['--color-bg', '--color-surface', '--color-raised']
const TEXT_COLOURS = [
  '--color-text',
  '--color-muted',
  '--color-primary',
  '--color-accent',
  '--color-warn',
  '--color-danger',
]
const CONTRAST_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ...TEXT_COLOURS.flatMap((fg) => SURFACES.map((bg) => [fg, bg] as const)),
  ['--color-on-primary', '--color-primary'],
  ['--family-push-ink', '--family-push-tint'],
  ['--family-pull-ink', '--family-pull-tint'],
  ['--family-legs-ink', '--family-legs-tint'],
  ['--family-core-ink', '--family-core-tint'],
  ['--pr-ink', '--pr-tint'],
]

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
  expect(DOCUMENTED_TOKENS).toHaveLength(49)
  expect([...tokens().keys()].sort()).toEqual(DOCUMENTED_TOKENS)
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
  const { actual, expected } = compare(FAMILY_TOKENS)
  expect(actual).toEqual(expected)
})

test('O1 the personal-record tint, ink and ring tokens carry the documented values', () => {
  const { actual, expected } = compare(PR_TOKENS)
  expect(actual).toEqual(expected)
})

test('O1 the body-map shade and primary/secondary tokens carry the documented values', () => {
  const { actual, expected } = compare(MAP_TOKENS)
  expect(actual).toEqual(expected)
})

test('O1 the spacing, radius, tap and type scales carry the documented values', () => {
  const { actual, expected } = compare(SCALE_TOKENS)
  expect(actual).toEqual(expected)
})

test('O1 the motion tokens carry a 150ms fast duration and a 0.97 press scale', () => {
  const { actual, expected } = compare(MOTION_TOKENS)
  expect(actual).toEqual(expected)
})

test('O1 --font-sans is a system stack, so no web font has to reach the phone', () => {
  const fontSans = normalise(tokens().get('--font-sans'))

  expect(fontSans).toMatch(/system-ui|-apple-system/)
  expect(fontSans, '--font-sans must not load a font file').not.toMatch(/url\(/)
})

test('O1 --font-display names Barlow Semi-Condensed first, then the system stack', () => {
  // Quote style and spacing are not the decision; the families and their order are.
  const fontDisplay = normalise(tokens().get('--font-display'))
    .replace(/"/g, "'")
    .replace(/\s*,\s*/g, ', ')

  expect(fontDisplay).toBe(
    "'barlow semi-condensed', system-ui, -apple-system, 'segoe ui', roboto, sans-serif",
  )
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
  expect(CONTRAST_PAIRS, 'six text colours on three surfaces, on-primary, four families, PR').toHaveLength(24)
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
