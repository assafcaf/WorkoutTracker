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
