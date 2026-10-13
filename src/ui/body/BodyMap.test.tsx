import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BodyMap } from './BodyMap'
import type { Region } from '../../domain/muscles'
import { declarationsFor } from '../../test/cssAudit'
import { declarationsMatching, paintOf } from '../../test/cssMatch'

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

// O14: every region polygon is outlined, so the light first steps of the clay ramp stay
// readable. --map-shade-0 equals --color-raised (E10-T1), so an untrained region's fill and the
// stroke drawn around it are two different tokens, not a fill-only shape lost against the page.

const here = dirname(fileURLToPath(import.meta.url))

test('O14 every region polygon is stroked with --color-muted', () => {
  const css = readFileSync(join(here, 'BodyMap.css'), 'utf-8')
  const declared = declarationsFor(css, '.body-map svg polygon')

  expect(declared.get('stroke'), 'every region polygon must be stroked with --color-muted').toBe(
    'var(--color-muted)',
  )
})

test('O14 an untrained region fills --map-shade-0, which equals --color-raised', () => {
  const counts = new Map<Region, number>()
  const { container } = render(<BodyMap counts={counts} scale="session" />)

  const elements = regionElements(container, 'chest')
  expect(elements.length, 'chest must be drawn at least once').toBeGreaterThan(0)
  // E17-T10 (O18): the "nothing counted" band is now --heat-0, the first step of the heat
  // ramp; the --map-* tokens are on their way out (E17-T12).
  for (const element of elements) {
    expect(paintOf(declarationsMatching(element))).toBe('var(--heat-0)')
  }
})

// O18 (E17-T10): every band paints the heat ramp, --heat-0 ... --heat-3; the exercise scale
// paints a primary muscle --heat-3 and a secondary --heat-2. Read through src/test/cssMatch.ts,
// so an inline style and a stylesheet rule keyed on data-band/data-shade both count.

function paintsOf(root: ParentNode, region: Region): string[] {
  const elements = regionElements(root, region)
  expect(elements.length, `${region} must be drawn at least once`).toBeGreaterThan(0)
  return elements.map((element) => paintOf(declarationsMatching(element)) ?? '(none)')
}

test('O18 a session count of 6 (band 3) paints --heat-3', () => {
  const { container } = render(<BodyMap counts={new Map<Region, number>([['quadriceps', 6]])} scale="session" />)

  for (const paint of paintsOf(container, 'quadriceps')) expect(paint).toBe('var(--heat-3)')
})

test('O18 a session count of 3 (band 2) paints --heat-2', () => {
  const { container } = render(<BodyMap counts={new Map<Region, number>([['chest', 3]])} scale="session" />)

  for (const paint of paintsOf(container, 'chest')) expect(paint).toBe('var(--heat-2)')
})

test('O18 a session count of 2 (band 1) paints --heat-1', () => {
  const { container } = render(<BodyMap counts={new Map<Region, number>([['biceps', 2]])} scale="session" />)

  for (const paint of paintsOf(container, 'biceps')) expect(paint).toBe('var(--heat-1)')
})

test('O18 a week count of 21 (band 3) paints --heat-3', () => {
  const { container } = render(<BodyMap counts={new Map<Region, number>([['hamstring', 21]])} scale="week" />)

  for (const paint of paintsOf(container, 'hamstring')) expect(paint).toBe('var(--heat-3)')
})

test('O18 the exercise scale paints a primary muscle (count 1) --heat-3', () => {
  const { container } = render(<BodyMap counts={new Map<Region, number>([['chest', 1]])} scale="exercise" />)

  for (const paint of paintsOf(container, 'chest')) expect(paint).toBe('var(--heat-3)')
})

test('O18 the exercise scale paints a secondary muscle (count 0.5) --heat-2', () => {
  const { container } = render(<BodyMap counts={new Map<Region, number>([['triceps', 0.5]])} scale="exercise" />)

  for (const paint of paintsOf(container, 'triceps')) expect(paint).toBe('var(--heat-2)')
})

test('O18 the exercise scale paints an untouched muscle --heat-0', () => {
  const { container } = render(<BodyMap counts={new Map<Region, number>([['chest', 1]])} scale="exercise" />)

  for (const paint of paintsOf(container, 'quadriceps')) expect(paint).toBe('var(--heat-0)')
})

test('O18 no shape on the map, filler shapes included, paints a --map-* or --family-* token', () => {
  for (const scale of ['session', 'week', 'exercise'] as const) {
    const { container, unmount } = render(
      <BodyMap counts={new Map<Region, number>([['chest', 6], ['biceps', 0.5]])} scale={scale} />,
    )
    const shapes = [...container.querySelectorAll('svg polygon')]
    expect(shapes.length).toBeGreaterThan(0)
    for (const shape of shapes) {
      const paint = paintOf(declarationsMatching(shape)) ?? ''
      expect(paint, `a ${scale}-scale shape paints ${paint}`).toMatch(/^var\(--heat-[0-3]\)$/)
    }
    unmount()
  }
})
