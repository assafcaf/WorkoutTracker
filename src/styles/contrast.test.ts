// fix-layout [G1]: coloured-fill text contrast, audited as data -- the same pattern
// src/styles/tokens.test.ts's O2 and src/styles/cssAudit.test.ts's O3/O6 already use
// (docs/decisions/0004-one-palette-one-shell-audited-as-data.md).
//
// E10-T2 [O3] widens this audit past the old dark theme's green tokens to every coloured
// token the Court palette (decision 0009) declares: --color-primary, --color-accent, the four
// --family-*-tint tokens, --pr-tint, and --map-shade-1..3, --map-primary and --map-secondary
// (--map-shade-0 is the near-black/near-ivory "nothing counted" shade and carries no hue of its
// own). This holds every CSS rule under src/ that paints a background or an SVG fill with one
// of those tokens to declaring its own text colour, at WCAG 2.1's 4.5:1 or better against that
// background.
//
// E17-T1 [O3] (Progress Dashboard foundation) generalises G1 with the same helper: the coloured
// tokens are now --color-primary, --color-primary-pressed, --color-danger, --heat-2 and
// --heat-3, and every stylesheet under src/ is held to it. G1's titles are kept verbatim (the
// weakened-tests gate tracks tests by title); their bodies assert the new set.
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

// Every coloured token E17's [O3] names: the fills a label sits directly on.
const GREEN_TOKENS = new Set([
  '--color-primary',
  '--color-primary-pressed',
  '--color-danger',
  '--heat-2',
  '--heat-3',
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

type FiledRule = PaintedRule & { file: string }

/**
 * Each rule whose own `color` is missing, unresolvable or under 4.5:1 against the coloured
 * token it paints, as a readable failure line. Pure, so it is checked against literals below.
 */
function colourOffenders(rules: FiledRule[], tokens: Map<string, string>): string[] {
  return rules
    .map((rule) => {
      const bg = tokens.get(rule.token)
      if (!bg) return `${rule.file} ${rule.selector}: ${rule.token} is not a declared token`
      if (rule.color === undefined) {
        return `${rule.file} ${rule.selector}: paints ${rule.token} with no colour declared of its own (inherits)`
      }
      const fg = resolveColour(rule.color, tokens)
      if (!fg) return `${rule.file} ${rule.selector}: colour "${rule.color}" resolves to no declared token`
      const ratio = contrastRatio(fg, bg)
      // Bare --color-text is not special-cased: on Court's palette (decision 0009) it simply
      // fails this same ratio check against every coloured token, so no separate rule is needed.
      return ratio >= 4.5
        ? null
        : `${rule.file} ${rule.selector}: ${rule.color} on ${rule.token} is only ${ratio.toFixed(2)}:1`
    })
    .filter((offender): offender is string => offender !== null)
}

test('G1 every CSS rule that paints a green background declares its own text colour at 4.5:1 or better, never bare --color-text', () => {
  const tokens = readTokens(readFileSync(tokensPath, 'utf-8'))
  const rules = greenBackgroundRules()

  expect(
    rules.length,
    'no stylesheet under src paints a coloured background at all, so this audit would pass vacuously',
  ).toBeGreaterThan(0)

  expect(
    colourOffenders(rules, tokens),
    'these rules pair a coloured background with unreadable or undeclared text',
  ).toEqual([])
})


// The helper [G1] measures with, against a hand-built literal fixture -- mirrors how
// src/styles/tokens.test.ts and src/styles/cssAudit.test.ts test their own local helpers,
// and does not pin live file content that the fix is expected to change.

test('G1 rulesPaintingGreen finds a rule painting a green token and reports its declared colour, or undefined when it declares none', () => {
  const css = [
    '.offender { background: var(--color-danger); border: 0; }',
    '.fixed { background: var(--color-primary-pressed); color: var(--color-on-primary); }',
    '.heat-fill { fill: var(--heat-3); }',
    '.heat-cell { background-color: var(--heat-2); color: var(--color-text); }',
    '.court { background: var(--color-accent); }',
    '.unrelated { background: var(--color-surface); color: var(--color-text); }',
  ].join('\n')

  const rules = rulesPaintingGreen(css)

  expect(rules).toEqual([
    { selector: '.offender', token: '--color-danger', color: undefined },
    { selector: '.fixed', token: '--color-primary-pressed', color: 'var(--color-on-primary)' },
    { selector: '.heat-fill', token: '--heat-3', color: undefined },
    { selector: '.heat-cell', token: '--heat-2', color: 'var(--color-text)' },
  ])
})

test('O3 every coloured token the audit measures is declared in tokens.css, so a rule painting it can be measured', () => {
  // A rule painting an undeclared token would be reported, but only once a rule paints it; the
  // five coloured tokens must resolve before T6-T10 start painting with them.
  const tokens = readTokens(readFileSync(tokensPath, 'utf-8'))
  expect([...GREEN_TOKENS].filter((name) => !/^#[0-9a-f]{6}$/i.test(tokens.get(name) ?? ''))).toEqual([])
})

test('O3 colourOffenders reports a missing, an unresolvable and a too-faint label, and passes a legible one', () => {
  // Hand-checked: white on #4338A8 is about 8.3:1; white on #4E9DA4 is about 3.2:1.
  const tokens = new Map([
    ['--color-primary', '#4338A8'],
    ['--heat-2', '#4E9DA4'],
    ['--color-on-primary', '#FFFFFF'],
  ])
  const rule = (selector: string, token: string, color: string | undefined): FiledRule => ({
    file: 'src/x.css',
    selector,
    token,
    color,
  })

  const offenders = colourOffenders(
    [
      rule('.ok', '--color-primary', 'var(--color-on-primary)'),
      rule('.inherits', '--color-primary', undefined),
      rule('.unknown', '--color-primary', 'var(--no-such-token)'),
      rule('.faint', '--heat-2', 'var(--color-on-primary)'),
    ],
    tokens,
  )

  expect(offenders).toHaveLength(3)
  expect(offenders[0]).toMatch(/^src\/x\.css \.inherits: .*no colour declared/)
  expect(offenders[1]).toMatch(/^src\/x\.css \.unknown: .*resolves to no declared token/)
  expect(offenders[2]).toMatch(/^src\/x\.css \.faint: var\(--color-on-primary\) on --heat-2 is only 3\.\d\d:1$/)
})
