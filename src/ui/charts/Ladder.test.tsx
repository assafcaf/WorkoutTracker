import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Ladder } from './Ladder'
import { nearestPointIndex } from './ladderView'
import type { LadderPoint, LadderView } from './ladderView'

// A hand-built view model: the chart depends on nothing beyond it. jsdom has no layout, so
// geometry is read from the attributes the chart writes, and the scrub stubs the svg's rect.

// jsdom has no PointerEvent, so fireEvent.pointerDown would drop clientX; stand one in.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventStub extends MouseEvent {
    pointerType: string
    constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventStub, configurable: true })
}

const DAY = 86_400_000
const T0 = Date.UTC(2026, 7, 1)

function point(id: string, day: number, lever: number, reps: number, extra: Partial<LadderPoint> = {}): LadderPoint {
  return {
    id,
    at: T0 + day * DAY,
    lever,
    reps,
    target: 10,
    deload: false,
    record: false,
    readout: {
      sessionId: `s-${id}`,
      title: `Day ${day}`,
      workingSets: [`${lever} kg × ${reps}`],
      record: null,
      e1rm: null,
      warmups: null,
      note: null,
    },
    ...extra,
  }
}

function view(overrides: Partial<LadderView> = {}): LadderView {
  const points = [
    point('a', 0, 50, 8),
    point('b', 10, 50, 10),
    point('c', 20, 55, 8, { record: true }),
    point('d', 30, 52.5, 6, { deload: true }),
    point('e', 70, 57.5, 9),
  ]
  return {
    from: T0,
    to: T0 + 80 * DAY,
    axisLabel: null,
    ticks: [
      { lever: 50, label: '50' },
      { lever: 55, label: '55' },
      { lever: 60, label: '60' },
    ],
    treads: [
      { lever: 50, from: T0, to: T0 + 10 * DAY, current: false },
      { lever: 55, from: T0 + 20 * DAY, to: T0 + 20 * DAY, current: false },
      { lever: 57.5, from: T0 + 70 * DAY, to: T0 + 70 * DAY, current: true },
    ],
    points,
    gaps: [{ from: T0 + 40 * DAY, to: T0 + 60 * DAY, label: 'No sessions' }],
    dates: [
      { at: T0, label: '1 Aug' },
      { at: T0 + 70 * DAY, label: '10 Oct' },
    ],
    ...overrides,
  }
}

function dots(container: Element): Element[] {
  return [...container.querySelectorAll('circle.ladder-dot')]
}

test('[O19] draws one dot per Session and a reps bar per Session', () => {
  const { container } = render(<Ladder view={view()} title="Back squat ladder" />)
  expect(dots(container)).toHaveLength(5)
  expect(container.querySelectorAll('rect.ladder-bar')).toHaveLength(5)
})

test('[O19] deload Sessions are hollow dots off the step line in a band labelled Deload', () => {
  const { container } = render(<Ladder view={view()} title="Back squat ladder" />)
  const hollow = container.querySelectorAll('circle.ladder-dot-deload')
  expect(hollow).toHaveLength(1)
  expect(container.querySelectorAll('.ladder-deload-band')).toHaveLength(1)
  expect(container.querySelector('svg')?.textContent).toContain('Deload')
  // The step line passes through the four non-deload Sessions only: 52.5 is never a vertex.
  const d = [...container.querySelectorAll('path.ladder-line')].map((p) => p.getAttribute('d')).join(' ')
  const deloadY = (hollow[0] as Element).getAttribute('cy')
  expect(d.includes(`V${deloadY}`)).toBe(false)
})

test('[O19] a gap breaks the line and carries its label', () => {
  const { container } = render(<Ladder view={view()} title="Back squat ladder" />)
  expect(container.querySelectorAll('path.ladder-line')).toHaveLength(2)
  expect(container.querySelector('svg')?.textContent).toContain('No sessions')
})

test('[O19] rep bars start at zero and each carries its target tick', () => {
  const { container } = render(<Ladder view={view()} title="Back squat ladder" />)
  const bars = [...container.querySelectorAll('rect.ladder-bar')]
  const bottoms = new Set(bars.map((bar) => Number(bar.getAttribute('y')) + Number(bar.getAttribute('height'))))
  expect(bottoms.size).toBe(1)
  const tall = bars.find((bar) => bar.getAttribute('data-reps') === '10') as Element
  const short = bars.find((bar) => bar.getAttribute('data-reps') === '6') as Element
  expect(Number(tall.getAttribute('height'))).toBeGreaterThan(Number(short.getAttribute('height')))
  expect(container.querySelectorAll('line.ladder-target')).toHaveLength(5)
})

test('[O19] the x axis is the calendar: a dot sits at its date, not its index', () => {
  const { container } = render(<Ladder view={view()} title="Back squat ladder" />)
  const cx = (id: number): number => Number(dots(container)[id].getAttribute('cx'))
  // Sessions 20 and 40 days apart (c to d is 10, d to e is 40).
  expect(cx(4) - cx(3)).toBeCloseTo((cx(3) - cx(2)) * 4, 5)
  expect(screen.getByText('1 Aug')).toBeTruthy()
})

test('[O19] an assisted ladder reads "assistance · less is better" with BW-n ticks, higher is higher', () => {
  const assisted = view({
    axisLabel: 'assistance · less is better',
    ticks: [
      { lever: -27, label: 'BW−27' },
      { lever: -19, label: 'BW−19' },
    ],
    points: [point('a', 0, -27, 8), point('b', 10, -19, 6)],
    gaps: [],
    treads: [],
  })
  const { container } = render(<Ladder view={assisted} title="Assisted pull-ups ladder" />)
  const text = container.querySelector('svg')?.textContent ?? ''
  expect(text).toContain('assistance · less is better')
  expect(text).toContain('BW−27')
  expect(text).toContain('BW−19')
  const [a, b] = dots(container)
  expect(Number(b.getAttribute('cy'))).toBeLessThan(Number(a.getAttribute('cy')))
})

function stubRect(container: Element): Element {
  const svg = container.querySelector('svg.ladder-svg') as Element
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 232, right: 320, bottom: 232, x: 0, y: 0, toJSON: () => ({}) })
  return svg
}

test('[O19] the arrow keys scrub to a Session and its readout lists sets, record, e1RM and warm-ups', () => {
  const rich = view()
  rich.points[4] = point('e', 70, 57.5, 9, {
    readout: {
      sessionId: 's-e',
      title: 'Wed 14 Oct · Workout A',
      workingSets: ['62.5 kg × 8', '60 kg × 10'],
      record: 'Heaviest weight +2.5 kg',
      e1rm: '79.2 kg',
      warmups: '20 × 10 · 37.5 × 5',
      note: null,
    },
  })
  const { container } = render(<Ladder view={rich} title="Back squat ladder" />)
  expect(screen.queryByLabelText('Session readout')).toBeNull()
  const group = screen.getByRole('group')
  fireEvent.keyDown(group, { key: 'ArrowLeft' })
  const readout = screen.getByLabelText('Session readout')
  expect(readout.textContent).toContain('62.5 kg × 8')
  expect(readout.textContent).toContain('Wed 14 Oct · Workout A')
  expect(readout.textContent).toContain('Heaviest weight +2.5 kg')
  expect(readout.textContent).toContain('(estimated)')
  expect(readout.textContent).toContain('not counted')
  expect(container.querySelectorAll('.ladder-dot-selected')).toHaveLength(1)
  fireEvent.keyDown(group, { key: 'ArrowLeft' })
  expect(screen.getByLabelText('Session readout').textContent).toContain('Day 30')
})

test('[O19] a readout with no e1RM and no warm-ups shows neither line', () => {
  render(<Ladder view={view()} title="Back squat ladder" />)
  fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' })
  const text = screen.getByLabelText('Session readout').textContent ?? ''
  expect(text).not.toContain('estimated')
  expect(text).not.toContain('not counted')
})

test('[O19] a pointer snaps to the nearest Session and the readout stays after release', () => {
  const { container } = render(<Ladder view={view()} title="Back squat ladder" />)
  const svg = stubRect(container)
  // x for day 11 of 80 across the plot (40 .. 296): nearest Session is day 10.
  const x = 40 + (11 / 80) * 256
  fireEvent.pointerDown(svg, { clientX: x, pointerType: 'touch' })
  expect(screen.getByLabelText('Session readout').textContent).toContain('Day 10')
  fireEvent.pointerUp(svg, { clientX: x })
  fireEvent.pointerLeave(svg)
  expect(screen.getByLabelText('Session readout').textContent).toContain('Day 10')
})

test('[O19] the readout opens its Session', () => {
  const open = vi.fn()
  render(<Ladder view={view()} title="Back squat ladder" onOpenSession={open} />)
  fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' })
  fireEvent.click(screen.getByRole('button', { name: /open session/i }))
  expect(open).toHaveBeenCalledWith('s-e')
})

test('[O19] the mini variant is 48 px and draws the treads only', () => {
  const { container } = render(<Ladder view={view()} title="Back squat" variant="mini" />)
  const svg = container.querySelector('svg') as Element
  expect(svg.getAttribute('height')).toBe('48')
  expect(svg.querySelector('path.ladder-line')).not.toBeNull()
  expect(svg.querySelector('text')).toBeNull()
  expect(svg.querySelector('rect')).toBeNull()
  expect(svg.querySelector('circle')).toBeNull()
  expect(screen.queryByRole('group')).toBeNull()
})

test('[O19] nearestPointIndex picks the closest Session, the earlier on a tie, -1 with none', () => {
  const points = view().points
  expect(nearestPointIndex(points, T0 + 14 * DAY)).toBe(1)
  expect(nearestPointIndex(points, T0 + 15 * DAY)).toBe(1)
  expect(nearestPointIndex([], T0)).toBe(-1)
})

test('[O19] no Sessions draws no svg', () => {
  const { container } = render(<Ladder view={view({ points: [], gaps: [], treads: [] })} title="x" />)
  expect(container.querySelector('svg')).toBeNull()
})
