import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'
import postcss from 'postcss'
import { expect, test } from 'vitest'
import { LineChart } from './LineChart'
import type { Series, SeriesKind } from '../../domain/series'
import { referencedVars } from '../../test/cssAudit'
import { declarationsMatching } from '../../test/cssMatch'

// Hand-rolled fixtures -- LineChart depends on nothing beyond its own props. jsdom has no
// layout, so geometry is read from the attributes the chart writes, never from a bounding box.

function series(kind: SeriesKind, values: Array<[number, number]>): Series {
  return { kind, points: values.map(([at, value]) => ({ at, value })) }
}

function circles(container: Element): Element[] {
  return [...container.querySelectorAll('svg circle')]
}

function cyOf(container: Element, value: string): number {
  const circle = circles(container).find((c) => c.getAttribute('data-value') === value)
  expect(circle, `a circle with data-value ${value}`).not.toBeUndefined()
  return Number((circle as Element).getAttribute('cy'))
}

function svgText(container: Element): string {
  return ((container.querySelector('svg') as Element).textContent ?? '').replace(/\s+/g, ' ')
}

test('O11 LineChart names its one svg with role img by title', () => {
  render(<LineChart series={series('e1rm', [[1, 60], [2, 66]])} title="Bench Press estimated 1RM" />)

  expect(screen.getByRole('img', { name: 'Bench Press estimated 1RM' })).toBeInTheDocument()
  expect(document.body.querySelectorAll('svg').length).toBe(1)
})

test('O11 LineChart draws one circle per point, in order, carrying data-at and data-value', () => {
  const { container } = render(
    <LineChart series={series('e1rm', [[100, 60], [300, 66], [500, 76]])} title="Fixture chart" />,
  )

  const found = circles(container)
  expect(found.map((c) => c.getAttribute('data-at'))).toEqual(['100', '300', '500'])
  expect(found.map((c) => c.getAttribute('data-value'))).toEqual(['60', '66', '76'])
})

test('O11 LineChart joins two or more points with exactly one polyline', () => {
  const { container } = render(
    <LineChart series={series('reps', [[1, 20], [2, 24], [3, 22]])} title="Fixture chart" />,
  )

  expect(container.querySelectorAll('svg polyline').length).toBe(1)
})

test('O11 LineChart with a single point draws its circle and no line', () => {
  const { container } = render(<LineChart series={series('reps', [[7, 20]])} title="Fixture chart" />)

  expect(circles(container).length).toBe(1)
  expect(circles(container)[0]).toHaveAttribute('data-value', '20')
  expect(container.querySelector('polyline')).toBeNull()
})

test('O11 LineChart with no points renders no svg', () => {
  const { container } = render(<LineChart series={series('e1rm', [])} title="Fixture chart" />)

  expect(container.querySelector('svg')).toBeNull()
})

test('O11 LineChart draws a larger value higher on a normal series', () => {
  const { container } = render(
    <LineChart series={series('e1rm', [[1, 60], [2, 80]])} title="Fixture chart" />,
  )

  // SVG y grows downward: higher on screen is a smaller cy.
  expect(cyOf(container, '80')).toBeLessThan(cyOf(container, '60'))
})

test('O11 LineChart reverses the value axis on an inverted series, drawing the smallest value highest', () => {
  // No inverted series any more: a load series of signed Loads draws the higher Load (-20,
  // less assistance) above the lower one (-30).
  const { container } = render(
    <LineChart series={series('load', [[1, -30], [2, -20]])} title="Fixture chart" />,
  )

  expect(cyOf(container, '-20')).toBeLessThan(cyOf(container, '-30'))
})

test('O11 LineChart keeps data-value positive on an inverted series', () => {
  // No inverted series any more: data-value carries the signed Load as given.
  const { container } = render(
    <LineChart series={series('load', [[1, -30], [2, -20]])} title="Fixture chart" />,
  )

  expect(circles(container).map((c) => c.getAttribute('data-value'))).toEqual(['-30', '-20'])
})

test('O11 LineChart labels an e1rm series in kg', () => {
  const { container } = render(
    <LineChart series={series('e1rm', [[1, 60], [2, 80]])} title="Fixture chart" />,
  )

  const text = svgText(container)
  expect(text).toMatch(/\bkg\b/)
  expect(text).not.toMatch(/kg assist/)
})

test('O11 LineChart labels a reps series in reps', () => {
  const { container } = render(
    <LineChart series={series('reps', [[1, 20], [2, 24]])} title="Fixture chart" />,
  )

  const text = svgText(container)
  expect(text).toMatch(/\breps\b/)
  expect(text).not.toMatch(/\bkg\b/)
})

test('O11 LineChart labels an assistance series in kg assist', () => {
  // No assistance series any more: a load series, assisted or not, is labelled in kg.
  const { container } = render(
    <LineChart series={series('load', [[1, -30], [2, -20]])} title="Fixture chart" />,
  )

  const text = svgText(container)
  expect(text).toMatch(/\bkg\b/)
  expect(text).not.toMatch(/kg assist/)
})

test('O11 LineChart point markers are at least 8px across', () => {
  const { container } = render(
    <LineChart series={series('e1rm', [[1, 60], [2, 80]])} title="Fixture chart" />,
  )

  for (const circle of circles(container)) {
    expect(Number(circle.getAttribute('r'))).toBeGreaterThanOrEqual(4)
  }
})

// The line itself, audited as data from its own stylesheet, the way src/styles/*.test.ts audit
// component stylesheets (docs/decisions/0004-one-palette-one-shell-audited-as-data.md).

const chartsDir = resolve(fileURLToPath(import.meta.url), '..')
const cssPath = join(chartsDir, 'LineChart.css')
const tsxPath = join(chartsDir, 'LineChart.tsx')

type Rule = { selector: string; decls: Map<string, string> }

function lineChartRules(): Rule[] {
  if (!existsSync(cssPath)) return []
  const rules: Rule[] = []
  postcss.parse(readFileSync(cssPath, 'utf-8')).walkRules((rule) => {
    const decls = new Map<string, string>()
    rule.each((node) => {
      if (node.type === 'decl') decls.set(node.prop, node.value.trim())
    })
    rules.push({ selector: rule.selector, decls })
  })
  return rules
}

test('O11 LineChart.css exists and is imported by LineChart.tsx', () => {
  expect(existsSync(cssPath), 'src/ui/charts/LineChart.css must exist').toBe(true)
  expect(readFileSync(tsxPath, 'utf-8')).toMatch(/import\s+['"]\.\/LineChart\.css['"]/)
})

test('O11 LineChart strokes its line 2px in the accent colour with round joins and caps', () => {
  // E17-T10 (O19): the series line is now 2 px --color-primary; --color-accent is retired.
  const { container } = render(
    <LineChart series={series('e1rm', [[1, 60], [2, 80]])} title="Fixture chart" />,
  )
  const polyline = container.querySelector('svg polyline')
  expect(polyline, 'two points are joined by a polyline').not.toBeNull()
  const decls = declarationsMatching(polyline as Element)
  expect(decls.get('stroke')).toBe('var(--color-primary)')
  expect(decls.get('stroke-width')).toMatch(/^2(px)?$/)
  expect(decls.get('stroke-linejoin')).toBe('round')
  expect(decls.get('stroke-linecap')).toBe('round')
})

test('O11 LineChart draws no dashed stroke anywhere', () => {
  const rules = lineChartRules()
  expect(rules.length).toBeGreaterThan(0)
  for (const rule of rules) {
    expect(rule.decls.has('stroke-dasharray'), `${rule.selector} is dashed`).toBe(false)
  }
})

// O19 (E17-T10): quiet charts with real axes. Gridlines are --color-hairline; an x-axis
// (`[data-axis="x"]`) labels the points' dates and a y-axis (`[data-axis="y"]`) labels values,
// every axis label at --text-xs in --color-muted. Fixture dates are local noon, so the day does
// not move with the host's time zone; "13 Oct" is what both `formatDay` ("Tue 13 Oct") and any
// shorter day-month label contain.

const OCT_13 = new Date(2026, 9, 13, 12).getTime()
const OCT_20 = new Date(2026, 9, 20, 12).getTime()

function axisLabels(container: Element, axis: 'x' | 'y'): Element[] {
  const group = container.querySelector(`svg [data-axis="${axis}"]`)
  expect(group, `the chart must draw a [data-axis="${axis}"] axis`).not.toBeNull()
  return [...(group as Element).querySelectorAll('text')]
}

function datedChart(): Element {
  const { container } = render(
    <LineChart series={series('e1rm', [[OCT_13, 60], [OCT_20, 80]])} title="Fixture chart" />,
  )
  return container
}

test('O19 LineChart draws an x-axis labelling the points with their dates', () => {
  const text = axisLabels(datedChart(), 'x').map((label) => label.textContent ?? '')

  expect(text.some((label) => label.includes('13 Oct')), `x labels: ${text.join(' | ')}`).toBe(true)
  expect(text.some((label) => label.includes('20 Oct')), `x labels: ${text.join(' | ')}`).toBe(true)
})

test('O19 LineChart draws a y-axis labelling values that span the series', () => {
  const text = axisLabels(datedChart(), 'y').map((label) => (label.textContent ?? '').trim())

  expect(text).toContain('60')
  expect(text).toContain('80')
})

test('O19 LineChart axis labels are --text-xs in --color-muted', () => {
  const container = datedChart()
  const labels = [...axisLabels(container, 'x'), ...axisLabels(container, 'y')]
  expect(labels.length).toBeGreaterThan(0)

  for (const label of labels) {
    const decls = declarationsMatching(label)
    expect(decls.get('font-size'), `"${label.textContent}" font-size`).toBe('var(--text-xs)')
    expect(decls.get('fill'), `"${label.textContent}" fill`).toBe('var(--color-muted)')
  }
})

test('O19 LineChart gridlines are stroked --color-hairline', () => {
  const grid = [...datedChart().querySelectorAll('svg .line-chart-grid')]
  expect(grid.length).toBeGreaterThan(0)

  for (const line of grid) expect(declarationsMatching(line).get('stroke')).toBe('var(--color-hairline)')
})

test('O19 LineChart.css references no --color-accent token', () => {
  expect([...referencedVars(readFileSync(cssPath, 'utf-8'))]).not.toContain('--color-accent')
})
