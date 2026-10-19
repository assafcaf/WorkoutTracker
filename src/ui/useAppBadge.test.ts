import { renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useAppBadge } from './useAppBadge'

// E24-T10 O28: the app icon badge for a whole Session.

type Badging = { setAppBadge?: unknown; clearAppBadge?: unknown }

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Badging, 'setAppBadge')
  Reflect.deleteProperty(navigator as unknown as Badging, 'clearAppBadge')
})

function stubBadging() {
  const setAppBadge = vi.fn().mockResolvedValue(undefined)
  const clearAppBadge = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'setAppBadge', { value: setAppBadge, configurable: true })
  Object.defineProperty(navigator, 'clearAppBadge', { value: clearAppBadge, configurable: true })
  return { setAppBadge, clearAppBadge }
}

test('O28 a Session in progress sets the badge to 1, and finishing clears it', () => {
  const { setAppBadge, clearAppBadge } = stubBadging()
  const { rerender } = renderHook(({ active }) => useAppBadge(active), { initialProps: { active: true } })
  expect(setAppBadge).toHaveBeenCalledWith(1)
  expect(clearAppBadge).not.toHaveBeenCalled()

  rerender({ active: false })
  expect(clearAppBadge).toHaveBeenCalledTimes(1)
})

test('O28 no Session calls nothing', () => {
  const { setAppBadge, clearAppBadge } = stubBadging()
  renderHook(() => useAppBadge(false))
  expect(setAppBadge).not.toHaveBeenCalled()
  expect(clearAppBadge).not.toHaveBeenCalled()
})

test('O28 with no Badging API nothing is called and nothing throws', () => {
  const { rerender } = renderHook(({ active }) => useAppBadge(active), { initialProps: { active: true } })
  expect(() => rerender({ active: false })).not.toThrow()
})

test('O28 a rejected badge call does not surface', async () => {
  const { setAppBadge } = stubBadging()
  setAppBadge.mockRejectedValue(new Error('denied'))
  expect(() => renderHook(() => useAppBadge(true))).not.toThrow()
  await Promise.resolve()
})
