import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BarChart } from './BarChart'
import type { BarChartBar } from './BarChart'

// Hand-rolled fixtures -- BarChart has no dependency beyond its own props.
function bar(overrides: Partial<BarChartBar> & { at: number }): BarChartBar {
  return { label: 'Fixture', value: 0, ...overrides }
}

test('O13 BarChart draws one rect per bar, in the order given', () => {
  const bars = [bar({ at: 1, label: 'A', value: 10 }), bar({ at: 2, label: 'B', value: 20 })]
  const { container } = render(<BarChart bars={bars} title="Fixture chart" />)

  const rects = container.querySelectorAll('rect')
  expect(rects.length).toBe(2)
  expect(rects[0]).toHaveAttribute('data-label', 'A')
  expect(rects[1]).toHaveAttribute('data-label', 'B')
})

test('O13 BarChart names its svg with role img by title', () => {
  render(<BarChart bars={[bar({ at: 1, label: 'A', value: 10 })]} title="Fixture chart" />)

  expect(screen.getByRole('img', { name: 'Fixture chart' })).toBeInTheDocument()
})

test('O13 BarChart carries data-at, data-label and data-value on each rect matching its bar', () => {
  const bars = [bar({ at: 42, label: 'Push Day', value: 300 })]
  const { container } = render(<BarChart bars={bars} title="Fixture chart" />)

  const rect = container.querySelector('rect') as Element
  expect(rect).toHaveAttribute('data-at', '42')
  expect(rect).toHaveAttribute('data-label', 'Push Day')
  expect(rect).toHaveAttribute('data-value', '300')
})

test('O13 BarChart with no bars renders no svg', () => {
  const { container } = render(<BarChart bars={[]} title="Fixture chart" />)

  expect(container.querySelector('svg')).toBeNull()
})
