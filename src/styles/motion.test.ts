// Motion (E10-T8), proven by reading src/styles/base.css as data: a button shrinks on press,
// a logged set briefly glows in its muscle family's tint, and `prefers-reduced-motion: reduce`
// turns both off.
//
// [O18] `button:active` scales by `--press-scale`, `button` transitions over `--motion-fast`,
// `.set-logged[data-family='<f>']` animates its background to `--family-<f>-tint` for each of
// the four families, and a `prefers-reduced-motion: reduce` block sets `transition` and
// `animation` to `none`.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { expect, test } from 'vitest'

// src/styles/motion.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const basePath = join(repoRoot, 'src', 'styles', 'base.css')

function baseCss(): string {
  return readFileSync(basePath, 'utf-8')
}

/** Declarations merged across every rule listing `selector` that sits at the stylesheet's top
 * level -- not nested inside an `@media` (or any other) at-rule. Keeps the reduced-motion
 * block's own `button`/`*` overrides from shadowing the plain rule this reads, the way a single
 * merged-across-the-whole-file lookup would. */
function topLevelDeclarationsFor(css: string, selector: string): Map<string, string> {
  const declarations = new Map<string, string>()
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent?.type !== 'root') return
    const selectors = rule.selector.split(',').map((entry) => entry.trim())
    if (!selectors.includes(selector.trim())) return
    rule.walkDecls((decl) => {
      declarations.set(decl.prop.trim(), decl.value.trim())
    })
  })
  return declarations
}

/** Declarations for `selector` wherever it appears, top-level or nested -- used for the
 * `.set-logged[data-family='<f>']` rules, which are never reused inside the reduced-motion
 * block under a matching selector string. Tolerates either quote style around the attribute
 * value. */
function declarationsForAttrSelector(css: string, prefix: string, value: string): Map<string, string> {
  const declarations = new Map<string, string>()
  const pattern = new RegExp(`^${prefix}\\[data-family=(['"]?)${value}\\1\\]$`)
  postcss.parse(css).walkRules((rule) => {
    const selectors = rule.selector.split(',').map((entry) => entry.trim())
    if (!selectors.some((entry) => pattern.test(entry))) return
    rule.walkDecls((decl) => {
      declarations.set(decl.prop.trim(), decl.value.trim())
    })
  })
  return declarations
}

/** The declarations directly inside every `@media (prefers-reduced-motion: reduce)` block,
 * regardless of which selector(s) carry them -- merged, since the outcome only asks that
 * `transition` and `animation` land on `none` somewhere in the block, not which rule does it. */
function reducedMotionDeclarations(css: string): Map<string, string> {
  const declarations = new Map<string, string>()
  postcss.parse(css).walkAtRules('media', (atRule) => {
    if (!/prefers-reduced-motion:\s*reduce/.test(atRule.params)) return
    atRule.walkDecls((decl) => {
      declarations.set(decl.prop.trim(), decl.value.trim())
    })
  })
  return declarations
}

const ANIMATION_KEYWORDS = new Set([
  'none',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'linear',
  'step-start',
  'step-end',
  'infinite',
  'alternate',
  'alternate-reverse',
  'reverse',
  'normal',
  'forwards',
  'backwards',
  'both',
  'running',
  'paused',
  'initial',
  'inherit',
  'unset',
])

/** The keyframes name a rule's `animation` (or `animation-name`) declaration names, or
 * `undefined` if it declares neither. */
function animationNameOf(decls: Map<string, string>): string | undefined {
  const explicit = decls.get('animation-name')
  if (explicit) return explicit.trim()
  const shorthand = decls.get('animation')
  if (!shorthand) return undefined
  return shorthand
    .trim()
    .split(/\s+/)
    .find((token) => /^-?[a-zA-Z_][\w-]*$/.test(token) && !ANIMATION_KEYWORDS.has(token))
}

/** Every step's declarations of the `@keyframes` block named `name`, in source order. */
function keyframeSteps(css: string, name: string): Map<string, string>[] {
  const steps: Map<string, string>[] = []
  postcss.parse(css).walkAtRules(/^(-\w+-)?keyframes$/, (atRule) => {
    if (atRule.params.trim() !== name) return
    atRule.walkRules((step) => {
      const decls = new Map<string, string>()
      step.walkDecls((decl) => {
        decls.set(decl.prop.trim(), decl.value.trim())
      })
      steps.push(decls)
    })
  })
  return steps
}

test('O18 button:active scales by var(--press-scale)', () => {
  const decls = topLevelDeclarationsFor(baseCss(), 'button:active')

  expect(decls.get('transform'), 'button:active must declare a transform').toBeDefined()
  expect(decls.get('transform')).toMatch(/scale\(\s*var\(--press-scale\)\s*\)/)
})

test('O18 button transitions over var(--motion-fast)', () => {
  const decls = topLevelDeclarationsFor(baseCss(), 'button')

  expect(decls.get('transition'), 'button must declare a transition').toBeDefined()
  expect(decls.get('transition')).toContain('var(--motion-fast)')
})

for (const family of ['push', 'pull', 'legs', 'core'] as const) {
  test(`O18 .set-logged[data-family='${family}'] animates its background to var(--family-${family}-tint)`, () => {
    const css = baseCss()
    const decls = declarationsForAttrSelector(css, '\\.set-logged', family)

    const name = animationNameOf(decls)
    expect(name, `.set-logged[data-family='${family}'] must declare an animation`).toBeDefined()

    const steps = keyframeSteps(css, name ?? '')
    expect(steps.length, `no @keyframes named '${name}' declares any step`).toBeGreaterThan(0)

    const targetsTint = steps.some((step) => {
      const background = step.get('background') ?? step.get('background-color')
      return background === `var(--family-${family}-tint)`
    })
    expect(targetsTint, `no step of '${name}' sets its background to var(--family-${family}-tint)`).toBe(
      true,
    )
  })
}

test('O18 prefers-reduced-motion: reduce sets transition to none', () => {
  const decls = reducedMotionDeclarations(baseCss())

  expect(decls.get('transition')).toBe('none')
})

test('O18 prefers-reduced-motion: reduce sets animation to none', () => {
  const decls = reducedMotionDeclarations(baseCss())

  expect(decls.get('animation')).toBe('none')
})
