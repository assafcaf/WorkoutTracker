import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { Toast } from './Toast'

afterEach(() => {
  vi.useRealTimers()
})

test('O14 a Toast shows its message in a status region', () => {
  render(<Toast message="New PR · Heaviest set · 85 kg × 5" onDismiss={() => undefined} />)

  expect(screen.getByRole('status')).toHaveTextContent('New PR · Heaviest set · 85 kg × 5')
})

test('O14 a Toast asks to be dismissed at 3 s, not before, and only once', () => {
  vi.useFakeTimers()
  const onDismiss = vi.fn()
  render(<Toast message="New PR" onDismiss={onDismiss} />)

  act(() => {
    vi.advanceTimersByTime(2999)
  })
  expect(onDismiss).not.toHaveBeenCalled()

  act(() => {
    vi.advanceTimersByTime(1)
  })
  expect(onDismiss).toHaveBeenCalledTimes(1)

  act(() => {
    vi.advanceTimersByTime(10_000)
  })
  expect(onDismiss).toHaveBeenCalledTimes(1)
})

test('O14 a Toast removed before 3 s never calls onDismiss', () => {
  vi.useFakeTimers()
  const onDismiss = vi.fn()
  const { unmount } = render(<Toast message="New PR" onDismiss={onDismiss} />)

  unmount()
  act(() => {
    vi.advanceTimersByTime(10_000)
  })

  expect(onDismiss).not.toHaveBeenCalled()
})
