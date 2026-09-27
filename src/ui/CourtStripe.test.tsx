import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { CourtStripe } from './CourtStripe'
import { literalColours } from '../test/cssAudit'

// CourtStripe (E10-T5): the app's one green-over-clay stripe cue. Its own contract is proven
// here; where it is placed -- the Shell header, the session summary and the PR medallion, and
// nowhere else -- is proven in AppShell.test.tsx, SessionSummary.test.tsx and Stats.test.tsx.

const here = dirname(fileURLToPath(import.meta.url))

test('O13 CourtStripe renders one decorative, aria-hidden court-stripe span', () => {
  const { container } = render(<CourtStripe />)

  const stripes = container.querySelectorAll('.court-stripe')
  expect(stripes).toHaveLength(1)
  expect(stripes[0]).toHaveAttribute('aria-hidden', 'true')
  expect(stripes[0].tagName).toBe('SPAN')
})

test('O13 the court-stripe rule draws its bands via linear-gradient of --color-primary over --color-accent, with no literal colour', () => {
  const css = readFileSync(join(here, 'CourtStripe.css'), 'utf-8')

  expect(literalColours(css)).toEqual([])
  expect(css).toMatch(/linear-gradient/)
  expect(css).toMatch(/var\(\s*--color-primary\s*\)/)
  expect(css).toMatch(/var\(\s*--color-accent\s*\)/)
})

test('O13 the court-stripe rule draws each band 2px thick', () => {
  const css = readFileSync(join(here, 'CourtStripe.css'), 'utf-8')

  const twoPixelBands = css.match(/2px/g) ?? []
  expect(twoPixelBands.length).toBeGreaterThanOrEqual(2)
})

// --- O13: no other component renders a .court-stripe -----------------------------------------

/** Every `.tsx` file under `dir`, recursively, its own test files excluded. */
function everyComponentFile(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...everyComponentFile(path))
    } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      found.push(path)
    }
  }
  return found
}

test('O13 CourtStripe is used in exactly the Shell header, the session summary and the PR medallion', () => {
  const uiDir = here
  const usesCourtStripe = everyComponentFile(uiDir).filter((path) => {
    if (path === join(here, 'CourtStripe.tsx')) return false
    return /<CourtStripe\s*\/?>/.test(readFileSync(path, 'utf-8'))
  })

  expect(usesCourtStripe.sort()).toEqual(
    [join(here, 'AppShell.tsx'), join(here, 'SessionSummary.tsx'), join(here, 'Stats.tsx')].sort(),
  )
})
