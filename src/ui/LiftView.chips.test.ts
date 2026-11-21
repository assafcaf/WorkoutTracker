// The lift page's chosen chart chip ("Est. strength" / "Top set") is outlined in ink, never
// filled like the screen's primary button (recheck, BTN-01).
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

const css = readFileSync(join(resolve(fileURLToPath(import.meta.url), '..'), 'LiftView.css'), 'utf-8')

test('BTN-01 the chosen Est. strength chip is an ink outline, not a filled primary', () => {
  const chosen = declarationsFor(css, ".lift-chips .lift-chip[aria-checked='true']")
  expect(chosen.get('background')).toBe('transparent')
  expect(chosen.get('border')).toBe('2px solid var(--color-primary)')
  expect(chosen.get('color')).toBe('var(--color-primary)')
})
