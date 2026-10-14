import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BarChart } from './BarChart'
import { referencedVars } from '../../test/cssAudit'
import { declarationsMatching, paintOf } from '../../test/cssMatch'
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

// O19 (E17-T10): bars paint --color-secondary, a second series' bars (`series: 'b'`, rendered
// `data-series="b"`) paint --chart-b; gridlines (`.bar-chart-grid`) are --color-hairline; an
// x-axis (`[data-axis="x"]`) labels each bar's date and a y-axis (`[data-axis="y"]`) labels
// values, at --text-xs in --color-muted. Fixture dates are local noon, so "13 Oct" holds in any
// time zone and is contained in both `formatDay`'s "Tue 13 Oct" and a shorter label.

const OCT_13 = new Date(2026, 9, 13, 12).getTime()
const OCT_20 = new Date(2026, 9, 20, 12).getTime()

function datedChart(): Element {
  const { container } = render(
    <BarChart
      bars={[bar({ at: OCT_13, label: 'Push Day', value: 100 }), bar({ at: OCT_20, label: 'Pull Day', value: 300 })]}
      title="Fixture chart"
    />,
  )
  return container
}

function axisLabels(container: Element, axis: 'x' | 'y'): Element[] {
  const group = container.querySelector(`svg [data-axis="${axis}"]`)
  expect(group, `the chart must draw a [data-axis="${axis}"] axis`).not.toBeNull()
  return [...(group as Element).querySelectorAll('text')]
}

test('O19 BarChart bars paint --color-secondary', () => {
  const rects = [...datedChart().querySelectorAll('rect.bar-chart-bar')]
  expect(rects.length).toBe(2)

  for (const rect of rects) expect(paintOf(declarationsMatching(rect))).toBe('var(--color-secondary)')
})

test('O19 BarChart bars of the second series paint --chart-b', () => {
  const { container } = render(
    <BarChart bars={[bar({ at: OCT_13, value: 100 }), bar({ at: OCT_20, value: 50, series: 'b' })]} title="Fixture chart" />,
  )
  const rects = [...container.querySelectorAll('rect.bar-chart-bar')]
  expect(rects.length).toBe(2)

  expect(rects[1]).toHaveAttribute('data-series', 'b')
  expect(paintOf(declarationsMatching(rects[1]))).toBe('var(--chart-b)')
  expect(paintOf(declarationsMatching(rects[0]))).toBe('var(--color-secondary)')
})

test('O19 BarChart draws gridlines stroked --color-hairline', () => {
  const grid = [...datedChart().querySelectorAll('svg .bar-chart-grid')]
  expect(grid.length).toBeGreaterThan(0)

  for (const line of grid) expect(declarationsMatching(line).get('stroke')).toBe('var(--color-hairline)')
})

test('O19 BarChart draws an x-axis labelling the bars with their dates', () => {
  const text = axisLabels(datedChart(), 'x').map((label) => label.textContent ?? '')

  expect(text.some((label) => label.includes('13 Oct')), `x labels: ${text.join(' | ')}`).toBe(true)
  expect(text.some((label) => label.includes('20 Oct')), `x labels: ${text.join(' | ')}`).toBe(true)
})

test('O19 BarChart draws a y-axis labelling values from 0 up to the tallest bar', () => {
  const values = axisLabels(datedChart(), 'y').map((label) => Number((label.textContent ?? '').trim().replace(/,/g, '')))

  expect(values.every((value) => Number.isFinite(value)), `y labels: ${values.join(' | ')}`).toBe(true)
  expect(values).toContain(0)
  expect(Math.max(...values)).toBeGreaterThanOrEqual(300)
})

test('O19 BarChart axis labels are --text-xs in --color-muted', () => {
  const container = datedChart()
  const labels = [...axisLabels(container, 'x'), ...axisLabels(container, 'y')]
  expect(labels.length).toBeGreaterThan(0)

  for (const label of labels) {
    const decls = declarationsMatching(label)
    expect(decls.get('font-size'), `"${label.textContent}" font-size`).toBe('var(--text-xs)')
    expect(decls.get('fill'), `"${label.textContent}" fill`).toBe('var(--color-muted)')
  }
})

test('O19 BarChart.css references no --color-accent token', () => {
  const cssPath = join(resolve(fileURLToPath(import.meta.url), '..'), 'BarChart.css')

  expect([...referencedVars(readFileSync(cssPath, 'utf-8'))]).not.toContain('--color-accent')
})

// S6a: the last bar carries its own value, thousands separated, and the y-axis reads the same
// way, three clean steps from 0 (0, 5,000, 10,000 for a 9,840 kg session).
test('S6a BarChart labels the last bar with its value and the y-axis with thousands separators', () => {
  const { container } = render(
    <BarChart
      bars={[bar({ at: OCT_13, value: 8920 }), bar({ at: OCT_20, value: 9840 })]}
      title="Volume per session, kg"
    />,
  )

  expect(container.querySelector('.bar-chart-value-label')?.textContent).toBe('9,840')
  expect(axisLabels(container, 'y').map((label) => label.textContent)).toEqual(['0', '5,000', '10,000'])
})
