import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Sparkline } from './Sparkline'

test('Sparkline joins the values and dots the latest one, higher values drawn higher', () => {
  const { container, getByRole } = render(<Sparkline values={[66.7, 70, 74.2]} label="Back squat e1RM" />)
  expect(getByRole('img', { name: 'Back squat e1RM' })).toBeTruthy()
  const points = container.querySelector('polyline')!.getAttribute('points')!.split(' ')
  expect(points).toHaveLength(3)
  const ys = points.map((point) => Number(point.split(',')[1]))
  expect(ys[0]).toBeGreaterThan(ys[2])
  const end = container.querySelector('circle')!
  expect(Number(end.getAttribute('cy'))).toBe(ys[2])
})

test('Sparkline with one value draws only the dot', () => {
  const { container } = render(<Sparkline values={[14.8]} label="DB bench press e1RM" />)
  expect(container.querySelector('polyline')).toBeNull()
  expect(container.querySelectorAll('circle')).toHaveLength(1)
})

test('v7 Sparkline is 72 x 26 by default, with no baseline, and its end dot wears the status tone', () => {
  const { container } = render(<Sparkline values={[60, 62.5, 65]} label="Deadlift" tone="up" />)
  const svg = container.querySelector('svg')!
  expect([svg.getAttribute('width'), svg.getAttribute('height')]).toEqual(['72', '26'])
  expect(container.querySelector('line')).toBeNull()
  expect(container.querySelector('circle')!.getAttribute('data-tone')).toBe('up')
})
