// DX-18 (recheck): the controls the recheck measured under 44 px now reach the floor in their
// own box -- the Set | All segments, Swap / Notes / History, "My gym only" and the switches.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

const src = resolve(fileURLToPath(import.meta.url), '..', '..')
const css = (path: string): string => readFileSync(join(src, path), 'utf-8')

test('DX-18 a switch input is itself 44 x 44 px, its track drawn inside', () => {
  const box = declarationsFor(css('styles/components.css'), '.switch')
  expect(box.get('width')).toBe('44px')
  expect(box.get('height')).toBe('var(--tap-min)')
})

test('DX-18 the Set | All segments are 44 px tall inside a 50 px track', () => {
  expect(declarationsFor(css('ui/live/live.css'), '.live-view-switch .segmented').get('height')).toBe('50px')
  expect(declarationsFor(css('ui/live/live.css'), '.live-view-switch .segmented-option').get('min-height')).toBe('var(--tap-min)')
})

test('DX-18 Swap, Notes, History and "My gym only" are at least 44 px in both directions', () => {
  const tool = declarationsFor(css('ui/SetScreen.css'), '.set-tool')
  expect(tool.get('min-width')).toBe('var(--tap-min)')
  expect(tool.get('min-height')).toBe('var(--tap-min)')
  expect(declarationsFor(css('ui/ExercisePicker.css'), '.chip.picker-gym-chip').get('height')).toBe('var(--tap-min)')
})
