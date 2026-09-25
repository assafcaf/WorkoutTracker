import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BodyMap } from './BodyMap'
import type { Region } from '../../domain/muscles'

/** Every SVG shape carrying `data-region="<region>"` within `root` (front and back combined,
 * or scoped to one view). */
function regionElements(root: ParentNode, region: Region): Element[] {
  return [...root.querySelectorAll(`[data-region="${region}"]`)]
}

// M8: front and back views, and each region's fill banded by its count -------------------------

test('M8 BodyMap draws a front view and a back view', () => {
  const { container } = render(<BodyMap counts={new Map()} scale="session" />)

  expect(container.querySelector('[data-view="front"]')).not.toBeNull()
  expect(container.querySelector('[data-view="back"]')).not.toBeNull()
})

test('M8 a region with a session count of 6 renders band 3 on every shape drawing it', () => {
  const counts = new Map<Region, number>([['quadriceps', 6]])
  const { container } = render(<BodyMap counts={counts} scale="session" />)

  const elements = regionElements(container, 'quadriceps')
  expect(elements.length, 'quadriceps must be drawn at least once').toBeGreaterThan(0)
  for (const element of elements) {
    expect(element).toHaveAttribute('data-band', '3')
  }
})

test('M8 a region with a session count of 2 renders band 1 on every shape drawing it', () => {
  const counts = new Map<Region, number>([['biceps', 2]])
  const { container } = render(<BodyMap counts={counts} scale="session" />)

  const elements = regionElements(container, 'biceps')
  expect(elements.length, 'biceps must be drawn at least once').toBeGreaterThan(0)
  for (const element of elements) {
    expect(element).toHaveAttribute('data-band', '1')
  }
})

test('M8 a region with nothing counted renders the empty band-0 token', () => {
  const counts = new Map<Region, number>([['quadriceps', 6]])
  const { container } = render(<BodyMap counts={counts} scale="session" />)

  const elements = regionElements(container, 'chest')
  expect(elements.length, 'chest must be drawn at least once').toBeGreaterThan(0)
  for (const element of elements) {
    expect(element).toHaveAttribute('data-band', '0')
  }
})

test('M8 a region drawn on both the front and back view (triceps) bands the same on each view', () => {
  const counts = new Map<Region, number>([['triceps', 6]])
  const { container } = render(<BodyMap counts={counts} scale="session" />)
  const front = container.querySelector('[data-view="front"]') as Element
  const back = container.querySelector('[data-view="back"]') as Element

  const frontTriceps = regionElements(front, 'triceps')
  const backTriceps = regionElements(back, 'triceps')
  expect(frontTriceps.length, 'triceps must be drawn on the front view').toBeGreaterThan(0)
  expect(backTriceps.length, 'triceps must be drawn on the back view').toBeGreaterThan(0)
  for (const element of [...frontTriceps, ...backTriceps]) {
    expect(element).toHaveAttribute('data-band', '3')
  }
})

test('M8 a region with a week count of 21 renders band 3 on the week scale', () => {
  const counts = new Map<Region, number>([['hamstring', 21]])
  const { container } = render(<BodyMap counts={counts} scale="week" />)

  const elements = regionElements(container, 'hamstring')
  expect(elements.length, 'hamstring must be drawn at least once').toBeGreaterThan(0)
  for (const element of elements) {
    expect(element).toHaveAttribute('data-band', '3')
  }
})

// O23: each view's <svg> is an accessible image naming its view (front/back) and scale, so a
// screen reader gets a label for each map. Format hand-decided for this task: "<view> view,
// <scale> scale" (e.g. "front view, session scale") -- the exact string an implementer must
// match, not one this test derives from BodyMap's own props.

test('O23 the front view is role="img" labelled "front view, session scale"', () => {
  render(<BodyMap counts={new Map()} scale="session" />)

  const front = screen.getByRole('img', { name: 'front view, session scale' })
  expect(front).toHaveAttribute('data-view', 'front')
})

test('O23 the back view is role="img" labelled "back view, session scale"', () => {
  render(<BodyMap counts={new Map()} scale="session" />)

  const back = screen.getByRole('img', { name: 'back view, session scale' })
  expect(back).toHaveAttribute('data-view', 'back')
})

test('O23 the week scale labels each view with "week scale", not "session scale"', () => {
  render(<BodyMap counts={new Map()} scale="week" />)

  expect(screen.getByRole('img', { name: 'front view, week scale' })).toHaveAttribute(
    'data-view',
    'front',
  )
  expect(screen.getByRole('img', { name: 'back view, week scale' })).toHaveAttribute(
    'data-view',
    'back',
  )
})
