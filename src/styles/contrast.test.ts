// fix-layout [G1]: green/white text contrast, audited as data -- the same pattern
// src/styles/tokens.test.ts's O2 and src/styles/cssAudit.test.ts's O3/O6 already use
// (docs/decisions/0004-one-palette-one-shell-audited-as-data.md).
//
// Defect (operator, iPhone): "The color of green and white text can't be read" on body map
// shading, buttons, chips/filters and the tab bar/headers. This holds every CSS rule under
// src/ that paints a background or an SVG fill with a "green" token (--color-accent,
// --map-shade-1..3, --map-primary, --map-secondary -- --map-shade-0 is the near-black empty
// shade and is not green) to declaring its own text colour, at WCAG 2.1's 4.5:1 or better
// against that background, and never bare --color-text on a green background even when a
// particular pairing would happen to clear 4.5:1.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { expect, test } from 'vitest'
import { contrastRatio, readTokens } from '../test/cssAudit'

// src/styles/contrast.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const srcDir = join(repoRoot, 'src')
const tokensPath = join(srcDir, 'styles', 'tokens.css')

/** Every file under `dir` whose name matches, absolute and sorted. */
function filesUnder(dir: string, matches: RegExp): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...filesUnder(full, matches))
    else if (matches.test(entry.name)) found.push(full)
  }
  return found.sort()
}

/** An absolute path as a repo-relative, '/'-separated one, which is how failures read. */
function rel(absolute: string): string {
  return absolute.slice(repoRoot.length + 1).split(sep).join('/')
}

// The "green" tokens the fix-layout ticket names. --map-shade-0 (#23232B, near-black, the
// "nothing counted" empty shade) is deliberately excluded -- it is not green.
const GREEN_TOKENS = new Set([
  '--color-accent',
  '--map-shade-1',
  '--map-shade-2',
  '--map-shade-3',
  '--map-primary',
  '--map-secondary',
])

const PAINT_PROPS = new Set(['background', 'background-color', 'fill'])

type PaintedRule = { selector: string; token: string; color: string | undefined }

/**
 * Every rule in `css` that paints a background or an SVG fill with a token from
 * `GREEN_TOKENS`, alongside that same rule's own `color` declaration -- `undefined` when the
 * rule declares none at all, which is how a colour ends up inherited rather than chosen. Pure
 * (no filesystem access), so it can be hand-checked against a literal fixture below.
 */
function rulesPaintingGreen(css: string): PaintedRule[] {
  const found: PaintedRule[] = []
  postcss.parse(css).walkRules((rule) => {
    let token: string | undefined
    let color: string | undefined
    rule.each((node) => {
      if (node.type !== 'decl') return
      if (PAINT_PROPS.has(node.prop)) {
        const match = /var\(\s*(--[\w-]+)/.exec(node.value)
        if (match && GREEN_TOKENS.has(match[1])) token = match[1]
      }
      if (node.prop === 'color') color = node.value.trim()
    })
    if (token) found.push({ selector: rule.selector, token, color })
  })
  return found
}

/** Every green-painting rule across every stylesheet under `src/`, each tagged with its file. */
function greenBackgroundRules(): Array<PaintedRule & { file: string }> {
  const found: Array<PaintedRule & { file: string }> = []
  for (const path of filesUnder(srcDir, /\.css$/)) {
    const css = readFileSync(path, 'utf-8')
    for (const rule of rulesPaintingGreen(css)) found.push({ ...rule, file: rel(path) })
  }
  return found
}

/** `value` resolved to a hex colour through `tokens` when it is a `var(--…)` reference. */
function resolveColour(value: string | undefined, tokens: Map<string, string>): string | undefined {
  if (value === undefined) return undefined
  const match = /^var\(\s*(--[\w-]+)/.exec(value)
  return match ? tokens.get(match[1]) : value
}

test('G1 every CSS rule that paints a green background declares its own text colour at 4.5:1 or better, never bare --color-text', () => {
  const tokens = readTokens(readFileSync(tokensPath, 'utf-8'))
  const rules = greenBackgroundRules()

  expect(
    rules.length,
    'no stylesheet under src paints a green background at all, so this audit would pass vacuously',
  ).toBeGreaterThan(0)

  const offenders = rules
    .map((rule) => {
      const bg = tokens.get(rule.token)
      if (!bg) return `${rule.file} ${rule.selector}: ${rule.token} is not a declared token`
      if (rule.color === undefined) {
        return `${rule.file} ${rule.selector}: paints ${rule.token} with no colour declared of its own (inherits)`
      }
      if (rule.color === 'var(--color-text)') {
        return `${rule.file} ${rule.selector}: pairs --color-text with the green ${rule.token} -- use --color-on-accent`
      }
      const fg = resolveColour(rule.color, tokens)
      if (!fg) return `${rule.file} ${rule.selector}: colour "${rule.color}" resolves to no declared token`
      const ratio = contrastRatio(fg, bg)
      return ratio >= 4.5
        ? null
        : `${rule.file} ${rule.selector}: ${rule.color} on ${rule.token} is only ${ratio.toFixed(2)}:1`
    })
    .filter((offender): offender is string => offender !== null)

  expect(offenders, 'these rules pair a green background with unreadable or undeclared text').toEqual([])
})

// The helper [G1] measures with, against a hand-built literal fixture -- mirrors how
// src/styles/tokens.test.ts and src/styles/cssAudit.test.ts test their own local helpers,
// and does not pin live file content that the fix is expected to change.

test('G1 rulesPaintingGreen finds a rule painting a green token and reports its declared colour, or undefined when it declares none', () => {
  const css = [
    '.offender { background: var(--color-accent); border: 0; }',
    '.fixed { background: var(--color-accent); color: var(--color-on-accent); }',
    '.map-fill { fill: var(--map-shade-2); }',
    '.unrelated { background: var(--color-surface); color: var(--color-text); }',
  ].join('\n')

  const rules = rulesPaintingGreen(css)

  expect(rules.find((rule) => rule.selector === '.offender')).toEqual({
    selector: '.offender',
    token: '--color-accent',
    color: undefined,
  })
  expect(rules.find((rule) => rule.selector === '.fixed')).toEqual({
    selector: '.fixed',
    token: '--color-accent',
    color: 'var(--color-on-accent)',
  })
  expect(rules.find((rule) => rule.selector === '.map-fill')).toEqual({
    selector: '.map-fill',
    token: '--map-shade-2',
    color: undefined,
  })
  expect(rules.find((rule) => rule.selector === '.unrelated'), '.unrelated paints no green token').toBeUndefined()
})
