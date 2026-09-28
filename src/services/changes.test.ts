import { expect, test, vi } from 'vitest'
import { createChangeBus } from './changes'

// O8: a ChangeBus subscriber hears its own topic once per emit, not other topics, and stops
// hearing it once unsubscribed.

test('O8 a subscriber is called exactly once when its topic is emitted once', () => {
  const bus = createChangeBus()
  const fn = vi.fn()

  bus.subscribe('sessions', fn)
  bus.emit('sessions')

  expect(fn).toHaveBeenCalledTimes(1)
})

test('O8 a subscriber to one topic is not called when a different topic is emitted', () => {
  const bus = createChangeBus()
  const fn = vi.fn()

  bus.subscribe('programs', fn)
  bus.emit('sessions')
  bus.emit('preferences')

  expect(fn).not.toHaveBeenCalled()
})

test('O8 a subscriber is not called again after its returned unsubscribe runs', () => {
  const bus = createChangeBus()
  const fn = vi.fn()

  const unsubscribe = bus.subscribe('sessions', fn)
  unsubscribe()
  bus.emit('sessions')

  expect(fn).not.toHaveBeenCalled()
})
