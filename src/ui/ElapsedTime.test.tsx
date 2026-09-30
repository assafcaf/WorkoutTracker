import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ElapsedTime } from './ElapsedTime'

const START = 1_700_000_000_000

// Fake timers fake Date.now too, so every reading below is exact no matter how loaded the
// host is. Unmount before restoring real timers, so the component's interval is cleared by
// the same clock that armed it.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(START)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function shownAt(elapsedMs: number): string | null {
  vi.setSystemTime(START + elapsedMs)
  render(<ElapsedTime startedAt={START} />)
  return screen.getByRole('timer', { name: 'Workout time' }).textContent
}

test('O12 ElapsedTime shows mm:ss under an hour', () => {
  expect(shownAt(0)).toBe('00:00')
})

test('O12 ElapsedTime shows 65 seconds as 01:05', () => {
  expect(shownAt(65_000)).toBe('01:05')
})

test('O12 ElapsedTime shows 59:59 just under an hour', () => {
  expect(shownAt(3_599_000)).toBe('59:59')
})

test('O12 ElapsedTime shows h:mm:ss from one hour on', () => {
  expect(shownAt(3_600_000)).toBe('1:00:00')
})

test('O12 ElapsedTime shows 1:01:01 at 3661 seconds', () => {
  expect(shownAt(3_661_000)).toBe('1:01:01')
})

test('O12 ElapsedTime updates each second', () => {
  render(<ElapsedTime startedAt={START} />)
  const timer = screen.getByRole('timer', { name: 'Workout time' })
  expect(timer.textContent).toBe('00:00')
  act(() => {
    vi.advanceTimersByTime(3000)
  })
  expect(timer.textContent).toBe('00:03')
})

test('O12 ElapsedTime derives from the clock, so a slept phone does not drift', () => {
  render(<ElapsedTime startedAt={START} />)
  const timer = screen.getByRole('timer', { name: 'Workout time' })
  // The phone sleeps for 599 s with no ticks at all (setSystemTime moves the clock and shifts
  // pending timers with it), then wakes and one tick lands exactly at 600 s. A tick counter
  // would read 00:01; a clock-derived display reads 10:00.
  act(() => {
    vi.setSystemTime(START + 599_000)
  })
  act(() => {
    vi.advanceTimersByTime(1000)
  })
  expect(timer.textContent).toBe('10:00')
})
