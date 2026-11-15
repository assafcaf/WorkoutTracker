import { render } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { LiveHeader } from './LiveHeader'

function meta(): string {
  return (document.querySelector('.live-header-meta')?.textContent ?? '').replace(/\s+/g, ' ')
}

test('V2-11 after a PR the header sub-line ends · 1 PR', () => {
  render(
    <LiveHeader
      workoutName="Workout B"
      startedAt={Date.now()}
      onMinimise={vi.fn()}
      onFinish={vi.fn()}
      sets={{ done: 3, planned: 23 }}
      prs={1}
    />,
  )

  expect(meta()).toMatch(/· 3\/23 sets · 1 PR$/)
})

test('V2-11 with no PR yet the header sub-line names no PR', () => {
  render(
    <LiveHeader
      workoutName="Workout B"
      startedAt={Date.now()}
      onMinimise={vi.fn()}
      onFinish={vi.fn()}
      sets={{ done: 3, planned: 23 }}
      prs={0}
    />,
  )

  expect(meta()).toMatch(/· 3\/23 sets$/)
  expect(meta()).not.toContain('PR')
})

test('V5 with nothing logged, Finish says so and offers Discard workout', async () => {
  const { fireEvent, screen } = await import('@testing-library/react')
  const onDiscard = vi.fn()
  const onFinish = vi.fn()
  render(
    <LiveHeader
      workoutName="Workout B"
      startedAt={Date.now()}
      onMinimise={vi.fn()}
      onFinish={onFinish}
      onDiscard={onDiscard}
      sets={{ done: 0, planned: 23 }}
      setsLeft={23}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
  expect(screen.getByText('Nothing logged yet')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Discard workout' }))
  expect(onDiscard).toHaveBeenCalledTimes(1)
  expect(onFinish).not.toHaveBeenCalled()
})

test('V5 with sets logged, the Finish sheet keeps Finish workout and adds Discard workout', async () => {
  const { fireEvent, screen } = await import('@testing-library/react')
  render(
    <LiveHeader
      workoutName="Workout B"
      startedAt={Date.now()}
      onMinimise={vi.fn()}
      onFinish={vi.fn()}
      onDiscard={vi.fn()}
      sets={{ done: 3, planned: 23 }}
      setsLeft={20}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
  expect(screen.getByRole('button', { name: 'Finish workout' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Discard workout' })).toBeTruthy()
})

test('V5-01 with sets logged, Discard asks again naming the sets before it discards', async () => {
  const { fireEvent, screen } = await import('@testing-library/react')
  const onDiscard = vi.fn()
  render(
    <LiveHeader
      workoutName="Workout B"
      startedAt={Date.now()}
      onMinimise={vi.fn()}
      onFinish={vi.fn()}
      onDiscard={onDiscard}
      sets={{ done: 2, planned: 23 }}
      setsLeft={21}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
  fireEvent.click(screen.getByRole('button', { name: 'Discard workout' }))
  expect(onDiscard).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Discard 2 logged sets' }))
  expect(onDiscard).toHaveBeenCalledTimes(1)
})
