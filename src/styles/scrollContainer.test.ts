// E8-T1's audit: neither `html` nor `body` may become a scroll container, because
// `.action-bar`'s `position: sticky` would stick to whichever ancestor is the nearest scroll
// container instead of the viewport, and `Log set` would stop tracking the bottom of the
// screen. `overflow-x: clip` keeps the horizontal rubber-band guard without making either
// element a scroll container the way `hidden` would.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const basePath = join(repoRoot, 'src', 'styles', 'base.css')
const base = readFileSync(basePath, 'utf-8')

const SCROLL_CONTAINER_VALUES = new Set(['hidden', 'auto', 'scroll'])

for (const selector of ['html', 'body']) {
  test(`O1 ${selector} declares no overflow property that makes it a scroll container`, () => {
    const declarations = declarationsFor(base, selector)

    for (const prop of ['overflow', 'overflow-x', 'overflow-y']) {
      const value = declarations.get(prop)
      if (value === undefined) continue
      expect(
        SCROLL_CONTAINER_VALUES.has(value),
        `${selector} declares ${prop}: ${value}, which makes it a scroll container`,
      ).toBe(false)
    }
  })
}

test('O1 html guards horizontal overflow with overflow-x: clip, not hidden', () => {
  expect(declarationsFor(base, 'html').get('overflow-x')).toBe('clip')
})

test('O1 body guards horizontal overflow with overflow-x: clip, not hidden', () => {
  expect(declarationsFor(base, 'body').get('overflow-x')).toBe('clip')
})
