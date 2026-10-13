import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LiveStrip, type LiveStatus } from './LiveStrip'

const NOW = Date.UTC(2026, 9, 13, 9, 0, 0)

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

function status(overrides: Partial<LiveStatus> = {}): LiveStatus {
  return {
    workoutName: 'Workout A',
    startedAt: NOW - (14 * 60 + 13) * 1000,
    restEndsAt: null,
    next: 'Back squat · set 3',
    ...overrides,
  }
}

test('LiveStrip names the workout and its elapsed time', () => {
  const { container } = render(<LiveStrip status={status()} onReturn={vi.fn()} />)

  expect(container.querySelector('.live-strip-text')).toHaveTextContent('Workout A · 14:13')
  expect(screen.getByRole('timer', { name: 'Workout time' })).toHaveTextContent('14:13')
})

test('LiveStrip counts the rest down while one runs', () => {
  const { container } = render(<LiveStrip status={status({ restEndsAt: NOW + 177_000 })} onReturn={vi.fn()} />)

  expect(container.querySelector('.live-strip-text')).toHaveTextContent('Workout A · 14:13 · Rest 2:57')

  act(() => {
    vi.advanceTimersByTime(2000)
  })
  expect(container.querySelector('.live-strip-text')).toHaveTextContent('Rest 2:55')
})

test('LiveStrip shows the set due next once no rest runs', () => {
  const { container } = render(<LiveStrip status={status({ restEndsAt: NOW - 1000 })} onReturn={vi.fn()} />)

  expect(container.querySelector('.live-strip-text')).toHaveTextContent('Workout A · 14:13 · Back squat · set 3')
  expect(container.querySelector('.live-strip-text')).not.toHaveTextContent('Rest')
})

test('LiveStrip shows the name and time alone once every planned set is in', () => {
  const { container } = render(<LiveStrip status={status({ next: null })} onReturn={vi.fn()} />)

  expect(container.querySelector('.live-strip-text')?.textContent).toBe('Workout A · 14:13')
})

test('LiveStrip returns to the session from its Return button, once per press', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const onReturn = vi.fn()
  render(<LiveStrip status={status()} onReturn={onReturn} />)

  const button = screen.getByRole('button', { name: 'Return to Workout A' })
  expect(button).toHaveTextContent('Return')
  await user.click(button)

  expect(onReturn).toHaveBeenCalledTimes(1)
})

test('LiveStrip returns to the session from a tap anywhere on it', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const onReturn = vi.fn()
  const { container } = render(<LiveStrip status={status()} onReturn={onReturn} />)

  await user.click(container.querySelector('.live-strip-text') as HTMLElement)

  expect(onReturn).toHaveBeenCalledTimes(1)
})
