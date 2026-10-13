import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { RepsDial } from './RepsDial'
import { SCRUB_NOTCH_PX } from './useScrub'
import { WeightDial } from './WeightDial'
import type { Exercise } from '../types'

// The Set screen's scrub Dial: the number alone, dragged up or down to change it, tapped to
// type it. The real catalog: back-squat steps 2.5 kg; push-ups is Bodyweight (signed Load).
const catalog = loadCatalog()

function exerciseOf(id: string): Exercise {
  const exercise = catalog.get(id)
  if (!exercise) throw new Error(`fixture error: no exercise ${id} in the loaded catalog`)
  return exercise
}

const backSquat = exerciseOf('back-squat')
const pushUps = exerciseOf('push-ups')

// jsdom has no PointerEvent, so fireEvent.pointer* would build a bare Event with no clientY.
// A MouseEvent carries clientY; the pointerId is all a PointerEvent adds that the Dial reads.
beforeAll(() => {
  if (typeof window.PointerEvent === 'function') return
  class PointerEventShim extends MouseEvent {
    readonly pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
    }
  }
  window.PointerEvent = PointerEventShim as unknown as typeof PointerEvent
})

function ScrubWeight(props: { exercise: Exercise; start: number }): JSX.Element {
  const [value, setValue] = useState<number | null>(props.start)
  return <WeightDial variant="scrub" exercise={props.exercise} value={value} onChange={setValue} />
}

function ScrubReps(props: { start: number }): JSX.Element {
  const [value, setValue] = useState(props.start)
  return <RepsDial variant="scrub" value={value} onChange={setValue} />
}

/** Drags the number under `readout` by `travel` px: positive is up, the way to more. */
function drag(readout: HTMLElement, travel: number): void {
  const body = readout.parentElement as HTMLElement
  fireEvent.pointerDown(body, { clientY: 400, pointerId: 1 })
  fireEvent.pointerMove(body, { clientY: 400 - travel / 2, pointerId: 1 })
  fireEvent.pointerMove(body, { clientY: 400 - travel, pointerId: 1 })
  fireEvent.pointerUp(body, { clientY: 400 - travel, pointerId: 1 })
  fireEvent.click(readout)
}

function weight(): HTMLElement {
  return screen.getByRole('button', { name: 'Weight' })
}

function reps(): HTMLElement {
  return screen.getByRole('button', { name: 'Reps' })
}

test('dragging the weight up three notches adds three steps: 60 reads 67.5', () => {
  render(<ScrubWeight exercise={backSquat} start={60} />)

  drag(weight(), SCRUB_NOTCH_PX * 3 + 2)

  expect(weight().textContent).toBe('67.5')
})

test('dragging the reps down two notches takes two reps off: 10 reads 8', () => {
  render(<ScrubReps start={10} />)

  drag(reps(), -(SCRUB_NOTCH_PX * 2 + 2))

  expect(reps().textContent).toBe('8')
})

test('dragging a Bodyweight Exercise steps its signed Load through BW', () => {
  render(<ScrubWeight exercise={pushUps} start={0} />)

  drag(weight(), -(SCRUB_NOTCH_PX + 2))

  expect(weight().textContent).toMatch(/^BW−\d/)
})

test('releasing a drag does not open the keypad; a tap on the number does', async () => {
  const user = userEvent.setup()
  render(<ScrubWeight exercise={backSquat} start={60} />)

  drag(weight(), SCRUB_NOTCH_PX + 2)
  expect(screen.queryByRole('group', { name: 'Weight keypad' })).toBeNull()

  await user.click(weight())
  expect(screen.getByRole('group', { name: 'Weight keypad' })).toBeVisible()
})

test('a movement under the tap slop is a tap: it opens the keypad and leaves the value', () => {
  render(<ScrubWeight exercise={backSquat} start={60} />)

  drag(weight(), 3)

  expect(weight().textContent).toBe('60')
  expect(screen.getByRole('group', { name: 'Weight keypad' })).toBeVisible()
})

test('the values a step either side show faintly, hidden from a screen reader', () => {
  const { container } = render(<ScrubWeight exercise={backSquat} start={60} />)

  const ghosts = [...container.querySelectorAll('.dial-ghost')]
  expect(ghosts.map((ghost) => ghost.textContent)).toEqual(['62.5', '57.5'])
  for (const ghost of ghosts) expect(ghost).toHaveAttribute('aria-hidden', 'true')
})

test('minus and plus stay reachable by role in the scrub variant, for a screen reader and the keyboard', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial variant="scrub" exercise={backSquat} value={60} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(onChange).toHaveBeenCalledWith(62.5)
})

test('the column variant is unchanged: no ghosts and no dial--scrub class', () => {
  const { container } = render(<WeightDial exercise={backSquat} value={60} onChange={vi.fn()} />)

  expect(container.querySelector('.dial-ghost')).toBeNull()
  expect(container.querySelector('.dial--scrub')).toBeNull()
})
