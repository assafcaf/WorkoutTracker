// fix-layout [G2]: BodyMap's own sizing, audited as data -- the same pattern
// src/styles/overlay.test.ts already uses for a component-owned stylesheet, per
// docs/decisions/0004-one-palette-one-shell-audited-as-data.md.
//
// Defect (operator, iPhone): "The sizes of the images of the body parts are not proportional to
// the rest of the design." BodyMap.tsx (src/ui/body/BodyMap.tsx) draws a front and a back <svg>
// inside a `.body-map` div and, before this task, imports no stylesheet at all -- there is no
// src/ui/body/BodyMap.css on disk yet. This holds the new stylesheet to: the two views laid out
// side by side (never stacked), each view scaling by width with its aspect ratio kept, and the
// container capped to a proportion-sized max-width -- 280px on the detail screen, the session
// summary and the Program tab's weekly/"This week" maps, and a smaller 160px on each workout
// card (src/ui/ProgramPage.tsx's `.workout-card`, the only place BodyMap nests inside a smaller
// card rather than standing on its own screen or section).
//
// BodyMap's existing data-band/data-region/data-shade contract (src/ui/body/BodyMap.test.tsx)
// is untouched by this file: sizing is a CSS concern the fill/band logic does not care about.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

// src/styles/bodyMapLayout.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const srcDir = join(repoRoot, 'src')
const bodyMapCssPath = join(srcDir, 'ui', 'body', 'BodyMap.css')
const bodyMapTsxPath = join(srcDir, 'ui', 'body', 'BodyMap.tsx')

/** `selector`'s declarations from src/ui/body/BodyMap.css, or an empty map when the file does
 * not exist yet -- callers assert presence explicitly first, the way overlay.test.ts does. */
function bodyMapDeclarations(selector: string): Map<string, string> {
  if (!existsSync(bodyMapCssPath)) return new Map()
  return declarationsFor(readFileSync(bodyMapCssPath, 'utf-8'), selector)
}

test('G2 src/ui/body/BodyMap.css exists and is imported by BodyMap.tsx', () => {
  expect(existsSync(bodyMapCssPath), 'src/ui/body/BodyMap.css must exist').toBe(true)

  const source = readFileSync(bodyMapTsxPath, 'utf-8')
  expect(
    source,
    'BodyMap.tsx must import its own stylesheet, or no bundle ever reaches it (O6, src/styles/cssAudit.test.ts)',
  ).toMatch(/import\s+['"]\.\/BodyMap\.css['"]/)
})

test('G2 .body-map lays its front and back views out side by side, never stacked', () => {
  const declared = bodyMapDeclarations('.body-map')

  expect(declared.get('display'), '.body-map must declare display: flex').toBe('flex')
  expect(
    declared.get('flex-direction'),
    '.body-map must not stack its two views in a column',
  ).not.toBe('column')
})

test('G2 .body-map is capped to about 280px on the detail screen, the session summary and the Program tab maps', () => {
  const declared = bodyMapDeclarations('.body-map')

  expect(declared.get('max-width'), '.body-map must cap its width in proportion with the design').toBe('280px')
  expect(
    declared.get('width'),
    '.body-map must still be allowed to shrink narrower than its cap',
  ).toBe('100%')
})

test('G2 .body-map is capped smaller, about 160px, inside a workout card', () => {
  // src/ui/ProgramPage.tsx's renderWorkout wraps a per-workout BodyMap in <section
  // className="workout-card">, the only place a map sits inside a smaller card rather than on
  // its own screen or section.
  const declared = bodyMapDeclarations('.workout-card .body-map')

  expect(declared.get('max-width'), '.workout-card .body-map must be capped smaller than the 280px default').toBe(
    '160px',
  )
})

test("G2 each view's svg scales by width and keeps its aspect ratio", () => {
  const declared = bodyMapDeclarations('.body-map svg')

  expect(declared.get('width'), 'each view must scale by width').toBe('100%')
  expect(declared.get('height'), 'each view must keep its aspect ratio rather than a fixed height').toBe('auto')
})
