import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'
import postcss from 'postcss'
import { expect, test } from 'vitest'
import { LineChart } from './LineChart'
import type { Series, SeriesKind } from '../../domain/series'

// Hand-rolled fixtures -- LineChart depends on nothing beyond its own props. jsdom has no
// layout, so geometry is read from the attributes the chart writes, never from a bounding box.

function series(kind: SeriesKind, values: Array<[number, number]>, inverted = false): Series {
  return { kind, inverted, points: values.map(([at, value]) => ({ at, value })) }
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
  const { container } = render(
    <LineChart series={series('assistance', [[1, 30], [2, 20]], true)} title="Fixture chart" />,
  )

  expect(cyOf(container, '20')).toBeLessThan(cyOf(container, '30'))
})

test('O11 LineChart keeps data-value positive on an inverted series', () => {
  const { container } = render(
    <LineChart series={series('assistance', [[1, 30], [2, 20]], true)} title="Fixture chart" />,
  )

  expect(circles(container).map((c) => c.getAttribute('data-value'))).toEqual(['30', '20'])
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
  const { container } = render(
    <LineChart series={series('assistance', [[1, 30], [2, 20]], true)} title="Fixture chart" />,
  )

  expect(svgText(container)).toMatch(/kg assist/)
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
  const line = lineChartRules().find(
    (rule) => rule.decls.get('stroke') === 'var(--color-accent)' && rule.decls.has('stroke-width'),
  )
  expect(line, 'a rule stroking the line with var(--color-accent)').not.toBeUndefined()
  const decls = (line as Rule).decls
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
