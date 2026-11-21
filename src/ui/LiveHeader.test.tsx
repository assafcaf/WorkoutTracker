import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { LiveHeader } from './LiveHeader'

function meta(): string {
  return (document.querySelector('.live-header-meta')?.textContent ?? '').replace(/\s+/g, ' ')
}

test('V2-11 DX-19 after a PR the header line 2 reads "3 of 23 sets · n min" and names no PR', () => {
  render(
    <LiveHeader
      workoutName="Workout B"
      startedAt={Date.now() - 4 * 60_000}
      onMinimise={vi.fn()}
      onFinish={vi.fn()}
      sets={{ done: 3, planned: 23 }}
      prs={1}
    />,
  )

  // v7 (study §1.5): no PR count in the live header; the PR is on its Set's cell.
  expect(meta()).toBe('3 of 23 sets · 4 min')
  expect(meta()).not.toContain('PR')
  expect(document.querySelector('.live-header-prs')).toBeNull()
})

test('DX-19 a 2 px bar under the header fills to the Sets logged', () => {
  render(
    <LiveHeader
      workoutName="Workout B"
      startedAt={Date.now()}
      onMinimise={vi.fn()}
      onFinish={vi.fn()}
      sets={{ done: 1, planned: 4 }}
    />,
  )

  const bar = screen.getByRole('progressbar', { name: 'Sets logged' })
  expect(bar).toHaveAttribute('aria-valuenow', '1')
  expect(bar).toHaveAttribute('aria-valuemax', '4')
  expect((bar.firstElementChild as HTMLElement).style.width).toBe('25%')
})

test('DX-14 with every Set logged, Finish finishes at once', () => {
  const onFinish = vi.fn()
  render(
    <LiveHeader
      workoutName="Workout B"
      startedAt={Date.now()}
      onMinimise={vi.fn()}
      onFinish={onFinish}
      sets={{ done: 23, planned: 23 }}
      setsLeft={0}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
  expect(onFinish).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('DX-14 with Sets left, Finish asks once: Finish Session, Keep going and a close X, and no Discard', () => {
  const onFinish = vi.fn()
  const onDiscard = vi.fn()
  render(
    <LiveHeader
      workoutName="Workout B"
      startedAt={Date.now()}
      onMinimise={vi.fn()}
      onFinish={onFinish}
      onDiscard={onDiscard}
      sets={{ done: 1, planned: 23 }}
      setsLeft={22}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
  const sheet = screen.getByRole('dialog')
  expect(within(sheet).getByRole('heading', { name: 'Finish with 22 sets not logged?' })).toBeTruthy()
  expect(within(sheet).getByRole('button', { name: 'Finish Session' })).toHaveClass('btn-primary')
  expect(within(sheet).getByRole('button', { name: 'Keep going' })).toHaveClass('btn-secondary')
  expect(within(sheet).getByRole('button', { name: 'Close' })).toBeTruthy()
  expect(within(sheet).queryByRole('button', { name: /Discard/ })).toBeNull()

  fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
  fireEvent.click(screen.getByRole('button', { name: 'Finish Session' }))
  expect(onFinish).toHaveBeenCalledTimes(1)
  expect(onDiscard).not.toHaveBeenCalled()
})

test('V6 V5-15 when the title line does not fit (large text), the minutes go and the set count stays', () => {
  const widths = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('live-header-meta') ? 189 : 0
  })
  const clients = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('live-header-meta') ? 162 : 0
  })
  render(
    <LiveHeader
      workoutName="Workout B"
      startedAt={Date.now() - 65_000}
      onMinimise={vi.fn()}
      onFinish={vi.fn()}
      sets={{ done: 1, planned: 23 }}
    />,
  )

  expect(meta()).toBe('1 of 23 sets')
  expect(document.querySelector('.live-header-meta [role="timer"]')).toBeNull()
  widths.mockRestore()
  clients.mockRestore()
})

test('V6 V5-15 when the title line fits, it keeps the minutes after the set count', () => {
  render(
    <LiveHeader
      workoutName="Workout B"
      startedAt={Date.now() - 65_000}
      onMinimise={vi.fn()}
      onFinish={vi.fn()}
      sets={{ done: 1, planned: 23 }}
    />,
  )

  expect(meta()).toBe('1 of 23 sets · 1 min')
})
