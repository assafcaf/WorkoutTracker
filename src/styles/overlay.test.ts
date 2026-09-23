// [F3] the popup layer's CSS, audited as data the way docs/decisions/0004 already audits every
// other stylesheet: `src/styles/overlay.css` is the one shared definition site for the
// `.overlay-panel` class the four popups (ExerciseDetail, the App-level Alternatives overlay,
// SessionSummary, RegionPanel) all carry on their own root, instead of each repeating its own
// copy of position/inset/scroll/z-index/safe-area rules.
//
// The tab bar is moving from the bottom to the top of the screen in a later, separate fix task,
// so nothing here assumes where it sits: the z-index check only compares the two numbers
// `declarationsFor` reads off `.overlay-panel` and `.tab-bar`, and the inset check only proves
// the overlay covers the whole viewport, not that it sits "below" or "above" the tab bar in any
// visual sense.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

// src/styles/overlay.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const srcDir = join(repoRoot, 'src')
const overlayPath = join(srcDir, 'styles', 'overlay.css')
const tabBarPath = join(srcDir, 'ui', 'TabBar.css')

const OVERLAY_SELECTOR = '.overlay-panel'

/**
 * `.overlay-panel`'s own declarations from `src/styles/overlay.css`, or an empty map when the
 * file does not exist yet -- callers assert presence explicitly first, so a stylesheet that has
 * not been written yet fails on a named assertion rather than a thrown fs error.
 */
function overlayDeclarations(): Map<string, string> {
  if (!existsSync(overlayPath)) return new Map()
  return declarationsFor(readFileSync(overlayPath, 'utf-8'), OVERLAY_SELECTOR)
}

test('F3 src/styles/overlay.css exists and declares the shared .overlay-panel class', () => {
  expect(
    existsSync(overlayPath),
    'src/styles/overlay.css must exist as the one shared overlay stylesheet',
  ).toBe(true)
  expect(
    overlayDeclarations().size,
    '.overlay-panel must be declared in src/styles/overlay.css',
  ).toBeGreaterThan(0)
})

test('F3 .overlay-panel is position: fixed and covers the whole viewport (inset: 0, or all four sides at 0)', () => {
  const declared = overlayDeclarations()
  expect(declared.get('position'), '.overlay-panel must declare position: fixed').toBe('fixed')

  const inset = declared.get('inset')
  if (inset !== undefined) {
    expect(inset.replace(/\s+/g, ' ').trim()).toMatch(/^0(px)?$/)
  } else {
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(
        declared.get(side),
        `.overlay-panel must declare ${side}: 0 when it declares no shorthand inset`,
      ).toMatch(/^0(px)?$/)
    }
  }
})

test('F3 .overlay-panel scrolls its own content rather than the page underneath', () => {
  expect(overlayDeclarations().get('overflow-y')).toBe('auto')
})

test('F3 .overlay-panel and .tab-bar each declare a numeric z-index, and the overlay’s is higher', () => {
  const overlayZ = overlayDeclarations().get('z-index')
  expect(overlayZ, '.overlay-panel must declare a numeric z-index').toBeDefined()
  expect(Number.isNaN(Number(overlayZ)), `.overlay-panel z-index "${overlayZ}" is not numeric`).toBe(
    false,
  )

  const tabBarZ = declarationsFor(readFileSync(tabBarPath, 'utf-8'), '.tab-bar').get('z-index')
  expect(tabBarZ, '.tab-bar must declare a numeric z-index so the overlay can be read above it').toBeDefined()
  expect(Number.isNaN(Number(tabBarZ)), `.tab-bar z-index "${tabBarZ}" is not numeric`).toBe(false)

  expect(Number(overlayZ)).toBeGreaterThan(Number(tabBarZ))
})

test('F3 .overlay-panel respects both the top and bottom safe-area insets', () => {
  const declared = overlayDeclarations()
  const values = [...declared.values()].join(' ')
  expect(values, '.overlay-panel must clear --safe-top somewhere in its declarations').toMatch(
    /var\(\s*--safe-top\s*\)/,
  )
  expect(values, '.overlay-panel must clear --safe-bottom somewhere in its declarations').toMatch(
    /var\(\s*--safe-bottom\s*\)/,
  )
})

// --- one shared stylesheet, not four copies -------------------------------------------------

const DUPLICATE_CHECK: Array<[string, string]> = [
  ['src/ui/ExerciseDetail.css', '.exercise-detail'],
  ['src/ui/SessionSummary.css', '.session-summary'],
  ['src/ui/RegionPanel.css', '.region-panel'],
]

test('F3 the popup components do not each redeclare position: fixed on their own root -- .overlay-panel carries it once', () => {
  const offenders = DUPLICATE_CHECK.filter(([path, selector]) => {
    const css = readFileSync(join(repoRoot, path), 'utf-8')
    return declarationsFor(css, selector).get('position') === 'fixed'
  }).map(([path]) => path)

  expect(
    offenders,
    'these stylesheets should get position: fixed from the shared .overlay-panel class instead of declaring their own copy',
  ).toEqual([])
})
