import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { RegionPanel } from './RegionPanel'

// E5-T20 [M9]: the panel a tapped region opens. Its contract, as these tests pin it:
// - a `role="dialog"` whose accessible name is the region id (e.g. "upper-back");
// - the region's count as the text "<count> sets", outside the contributors list;
// - one list item per contributor, holding its name and "<sets> sets";
// - "Browse exercises" calls `onBrowse` with every muscle `regionsFor` maps to the region;
// - "Close" calls `onClose`.

const UPPER_BACK_CONTRIBUTORS = [
  { exerciseId: 'assisted-pull-ups', name: 'Assisted pull-ups', sets: 3 },
  { exerciseId: 'deadlift', name: 'Deadlift', sets: 2 },
  { exerciseId: 'face-pull', name: 'Face pull', sets: 0.5 },
]

function renderUpperBack(onBrowse = vi.fn(), onClose = vi.fn()) {
  render(
    <RegionPanel
      region="upper-back"
      count={5.5}
      contributors={UPPER_BACK_CONTRIBUTORS}
      onBrowse={onBrowse}
      onClose={onClose}
    />,
  )
  return { onBrowse, onClose }
}

test('M9 RegionPanel shows the tapped region’s set count', () => {
  renderUpperBack()

  const panel = screen.getByRole('dialog', { name: 'upper-back' })
  expect(within(panel).getByText('5.5 sets')).toBeVisible()
})

test('M9 RegionPanel lists each contributing exercise with its own set count', () => {
  renderUpperBack()

  const panel = screen.getByRole('dialog', { name: 'upper-back' })
  const items = within(panel).getAllByRole('listitem')
  expect(items).toHaveLength(3)
  expect(within(items[0]).getByText('Assisted pull-ups')).toBeVisible()
  expect(within(items[0]).getByText('3 sets')).toBeVisible()
  expect(within(items[1]).getByText('Deadlift')).toBeVisible()
  expect(within(items[1]).getByText('2 sets')).toBeVisible()
  expect(within(items[2]).getByText('Face pull')).toBeVisible()
  expect(within(items[2]).getByText('0.5 sets')).toBeVisible()
})

test('M9 RegionPanel for a region nothing counted shows 0 sets and no contributors', () => {
  render(
    <RegionPanel region="chest" count={0} contributors={[]} onBrowse={vi.fn()} onClose={vi.fn()} />,
  )

  const panel = screen.getByRole('dialog', { name: 'chest' })
  expect(within(panel).getByText('0 sets')).toBeVisible()
  expect(within(panel).queryAllByRole('listitem')).toHaveLength(0)
  // Browsing still makes sense for an untrained muscle -- that is what the bridge is for.
  expect(within(panel).getByRole('button', { name: 'Browse exercises' })).toBeVisible()
})

test('M9 Browse exercises on upper-back browses lats or middle back', async () => {
  const user = userEvent.setup()
  const { onBrowse } = renderUpperBack()

  await user.click(screen.getByRole('button', { name: 'Browse exercises' }))

  expect(onBrowse).toHaveBeenCalledTimes(1)
  const muscles = [...onBrowse.mock.calls[0][0]].sort()
  expect(muscles).toEqual(['lats', 'middle back'])
})

test('M9 Browse exercises on a one-muscle region browses exactly that muscle', async () => {
  const user = userEvent.setup()
  const onBrowse = vi.fn()
  render(
    <RegionPanel
      region="quadriceps"
      count={3}
      contributors={[{ exerciseId: 'back-squat', name: 'Back squat', sets: 3 }]}
      onBrowse={onBrowse}
      onClose={vi.fn()}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Browse exercises' }))

  expect(onBrowse).toHaveBeenCalledTimes(1)
  expect(onBrowse.mock.calls[0][0]).toEqual(['quadriceps'])
})

test('M9 Close on the region panel calls onClose and does not browse', async () => {
  const user = userEvent.setup()
  const { onBrowse, onClose } = renderUpperBack()

  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onBrowse).not.toHaveBeenCalled()
})
