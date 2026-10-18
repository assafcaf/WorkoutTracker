import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { BarChart } from './BarChart'
import { LineChart } from './LineChart'
import type { Series } from '../../domain/series'

const DAY = 86_400_000
const bars = [
  { at: 1_700_000_000_000, label: 'Push', value: 9840, sessionId: 's1', detail: '5 exercises' },
  { at: 1_700_000_000_000 + DAY, label: 'Pull', value: 8000, sessionId: 's2', detail: '4 exercises' },
]

function rects(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('rect.bar-chart-bar'))
}

test('O12 tapping a bar with a Session id shows its readout and marks it selected', () => {
  const { container } = render(<BarChart bars={bars} title="Volume" unit="kg" />)
  expect(screen.queryByLabelText('Chart readout')).toBeNull()
  fireEvent.click(rects(container)[0])
  const readout = screen.getByLabelText('Chart readout')
  expect(readout).toHaveTextContent('Push')
  expect(readout).toHaveTextContent('9,840 kg')
  expect(readout).toHaveTextContent('5 exercises')
  expect(rects(container)[0]).toHaveAttribute('aria-pressed', 'true')
  expect(rects(container)[1]).toHaveAttribute('aria-pressed', 'false')
})

test('O12 Open session hands over the Session id, and tapping the selected bar again closes it', () => {
  const onOpen = vi.fn()
  const { container } = render(<BarChart bars={bars} title="Volume" onOpenSession={onOpen} />)
  fireEvent.click(rects(container)[1])
  fireEvent.click(screen.getByRole('button', { name: /Open session/ }))
  expect(onOpen).toHaveBeenCalledWith('s2')
  fireEvent.click(rects(container)[1])
  expect(screen.queryByLabelText('Chart readout')).toBeNull()
})

test('O12 a bar takes Enter and arrow keys', () => {
  const { container } = render(<BarChart bars={bars} title="Volume" />)
  const first = rects(container)[0] as SVGElement
  first.focus()
  fireEvent.keyDown(first, { key: 'ArrowRight' })
  expect(document.activeElement).toBe(rects(container)[1])
  fireEvent.keyDown(rects(container)[1], { key: 'Enter' })
  expect(screen.getByLabelText('Chart readout')).toHaveTextContent('Pull')
})

test('O12 a BarChart given no Session ids draws as today, with no buttons', () => {
  const { container } = render(<BarChart bars={[{ at: 1, label: 'A', value: 10 }]} title="Volume" />)
  fireEvent.click(rects(container)[0])
  expect(screen.queryByLabelText('Chart readout')).toBeNull()
  expect(rects(container)[0]).not.toHaveAttribute('role')
})

const series = {
  kind: 'load',
  points: [
    { at: 1_700_000_000_000, value: 80 },
    { at: 1_700_000_000_000 + DAY, value: 81.5 },
  ],
} as unknown as Series

test('O13 tapping a selectable LineChart point shows date and value with the unit, Open session only with a Session', () => {
  const onOpen = vi.fn()
  const { container } = render(
    <LineChart
      series={series}
      title="Bodyweight"
      selectable
      unit="kg"
      sessionIds={{ [series.points[1].at]: 'sx' }}
      onOpenSession={onOpen}
    />,
  )
  const points = container.querySelectorAll('circle.line-chart-point')
  fireEvent.click(points[0])
  expect(screen.getByLabelText('Chart readout')).toHaveTextContent('80 kg')
  expect(screen.queryByRole('button', { name: /Open session/ })).toBeNull()
  fireEvent.click(points[1])
  expect(screen.getByLabelText('Chart readout')).toHaveTextContent('81.5 kg')
  fireEvent.click(screen.getByRole('button', { name: /Open session/ }))
  expect(onOpen).toHaveBeenCalledWith('sx')
})

test('O13 a LineChart without selectable draws as today', () => {
  const { container } = render(<LineChart series={series} title="Bodyweight" />)
  fireEvent.click(container.querySelectorAll('circle.line-chart-point')[0])
  expect(screen.queryByLabelText('Chart readout')).toBeNull()
})
