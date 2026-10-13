import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { WeightDial } from './WeightDial'
import type { Exercise } from '../types'

// The real catalog: back-squat's weightStep is 2.5 kg; push-ups is bodyweight (no ladder).
const catalog = loadCatalog()

function exerciseOf(id: string): Exercise {
  const exercise = catalog.get(id)
  if (!exercise) throw new Error(`fixture error: no exercise ${id} in the loaded catalog`)
  return exercise
}

const backSquat = exerciseOf('back-squat')
const pushUps = exerciseOf('push-ups')

/** The step control: a native select named for the weight step it currently reads. */
function stepControl(step: number): HTMLElement {
  return screen.getByRole('combobox', { name: `Step ${step} kg` })
}

// --- O1: the per-Exercise step control -----------------------------------------------------

test('O1 the step control is shown for a loaded Exercise given onStepChange, and withheld otherwise', () => {
  const { rerender } = render(
    <WeightDial exercise={backSquat} value={60} onChange={vi.fn()} onStepChange={vi.fn()} />,
  )
  expect(stepControl(2.5)).toBeInTheDocument()

  rerender(<WeightDial exercise={backSquat} value={60} onChange={vi.fn()} />)
  expect(screen.queryByRole('combobox', { name: /^Step/ })).toBeNull()

  rerender(<WeightDial exercise={pushUps} value={null} onChange={vi.fn()} onStepChange={vi.fn()} />)
  expect(screen.queryByRole('combobox', { name: /^Step/ })).toBeNull()
})

test('O1 the step control reads Step 2.5 kg for back-squat when onStepChange is given', () => {
  render(<WeightDial exercise={backSquat} value={60} onChange={vi.fn()} onStepChange={vi.fn()} />)

  expect(stepControl(2.5)).toBeInTheDocument()
})

test('O1 the step control offers 0.5, 1, 1.25, 2.5, 5, 10 as its options', () => {
  render(<WeightDial exercise={backSquat} value={60} onChange={vi.fn()} onStepChange={vi.fn()} />)

  const options = within(stepControl(2.5)).getAllByRole('option')
  expect(options.map((option) => option.textContent)).toEqual(['0.5', '1', '1.25', '2.5', '5', '10'])
})

test('O1 choosing 5 from the step options calls onStepChange with 5', async () => {
  const user = userEvent.setup()
  const onStepChange = vi.fn()
  render(<WeightDial exercise={backSquat} value={60} onChange={vi.fn()} onStepChange={onStepChange} />)

  await user.selectOptions(stepControl(2.5), '5')

  expect(onStepChange).toHaveBeenCalledWith(5)
})

// --- E16-T4 O7, O8: Weight and Load as one Dial ----------------------------------------------
//
// On a Bodyweight Exercise (its `bodyweight` flag) the Weight Dial's value is the signed Load in
// kg: 0 is plain bodyweight and reads "BW"; added weight reads "BW+10", assistance "BW−20" with a
// true minus sign (U+2212). Its Rungs are loadLadder(weightStep). push-ups has a 1 kg step.

/** push-ups, Bodyweight, with the weight step `step`. */
function bodyweightAt(step: number): Exercise {
  return { ...pushUps, weightStep: step }
}

function weightReadout(): HTMLElement {
  return screen.getByRole('button', { name: 'Weight' })
}

function readoutValue(element: HTMLElement): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function weightRungs(): string[] {
  return within(screen.getByRole('listbox', { name: 'Weight ladder' }))
    .getAllByRole('option')
    .map((option) => (option.textContent ?? '').trim())
}

test('O7 a Bodyweight Weight Dial reads BW at a Load of 0', () => {
  render(<WeightDial exercise={pushUps} value={0} onChange={vi.fn()} />)

  expect(readoutValue(weightReadout())).toBe('BW')
})

test('O7 a Bodyweight Weight Dial reads BW+10 at +10 and BW−20, with a true minus sign, at -20', () => {
  const { rerender } = render(<WeightDial exercise={pushUps} value={10} onChange={vi.fn()} />)
  expect(readoutValue(weightReadout())).toBe('BW+10')

  rerender(<WeightDial exercise={pushUps} value={-20} onChange={vi.fn()} />)
  expect(readoutValue(weightReadout())).toBe('BW−20')
})

test('O7 a Bodyweight Weight Dial shows 161 Rungs from BW−60 to BW+100 at a 1 kg step', () => {
  render(<WeightDial exercise={pushUps} value={0} onChange={vi.fn()} />)

  const shown = weightRungs()
  expect(shown).toHaveLength(161)
  expect(shown[0]).toBe('BW−60')
  expect(shown[40]).toBe('BW−20')
  expect(shown[60]).toBe('BW')
  expect(shown[70]).toBe('BW+10')
  expect(shown[160]).toBe('BW+100')
})

test('O7 Increase weight on a Bodyweight Weight Dial at BW steps one Rung up to +2.5', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial exercise={bodyweightAt(2.5)} value={0} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(onChange).toHaveBeenLastCalledWith(2.5)
})

test('O7 Decrease weight on a Bodyweight Weight Dial at BW steps one Rung down through zero to -2.5', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial exercise={bodyweightAt(2.5)} value={0} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Decrease weight' }))

  expect(onChange).toHaveBeenLastCalledWith(-2.5)
})

test('O7 Decrease weight on a Bodyweight Weight Dial at BW+10 steps to BW+9, not off the Ladder', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial exercise={pushUps} value={10} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Decrease weight' }))

  expect(onChange).toHaveBeenLastCalledWith(9)
})

test('O8 the Bodyweight Weight Dial keypad takes a signed value: − 2 7 OK answers -27', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial exercise={pushUps} value={0} onChange={onChange} />)

  await user.click(weightReadout())
  await user.click(screen.getByRole('button', { name: '−' }))
  await user.click(screen.getByRole('button', { name: '2' }))
  await user.click(screen.getByRole('button', { name: '7' }))
  await user.click(screen.getByRole('button', { name: 'OK' }))

  expect(onChange).toHaveBeenLastCalledWith(-27)
})

test('O8 the Bodyweight Weight Dial keypad takes a positive value without the sign: 1 5 OK answers 15', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial exercise={pushUps} value={0} onChange={onChange} />)

  await user.click(weightReadout())
  await user.click(screen.getByRole('button', { name: '1' }))
  await user.click(screen.getByRole('button', { name: '5' }))
  await user.click(screen.getByRole('button', { name: 'OK' }))

  expect(onChange).toHaveBeenLastCalledWith(15)
})

test('O8 a Bodyweight Weight Dial reads BW−27 at a Load of -27', () => {
  render(<WeightDial exercise={pushUps} value={-27} onChange={vi.fn()} />)

  expect(readoutValue(weightReadout())).toBe('BW−27')
})

// --- E14-T14 O17, carried from the deleted LoadDial.test.tsx: the Load is now the Weight Dial's
// value on a Bodyweight Exercise (E16-T4). Titles kept, bodies rewritten.

test('O17 the Load Dial is a group named Load', () => {
  render(<WeightDial exercise={pushUps} value={0} onChange={vi.fn()} />)

  // One Dial carries the Load now: the weight group, and no separate Load group.
  expect(screen.getByRole('group', { name: 'Weight' })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Load' })).toBeNull()
  expect(screen.getByRole('listbox', { name: 'Weight ladder' })).toBeInTheDocument()
})

test('O17 the Load Dial reads BW at 0', () => {
  render(<WeightDial exercise={pushUps} value={0} onChange={vi.fn()} />)

  expect(readoutValue(weightReadout())).toBe('BW')
})

test('O17 the Load Dial reads BW+10 at +10', () => {
  render(<WeightDial exercise={pushUps} value={10} onChange={vi.fn()} />)

  expect(readoutValue(weightReadout())).toBe('BW+10')
})

test('O17 the Load Dial reads BW−20, with a true minus sign, at -20', () => {
  render(<WeightDial exercise={pushUps} value={-20} onChange={vi.fn()} />)

  expect(readoutValue(weightReadout())).toBe('BW−20')
})

test('O17 a 1 kg step gives 161 Rungs from BW−60 to BW+100, with BW among them', () => {
  render(<WeightDial exercise={bodyweightAt(1)} value={0} onChange={vi.fn()} />)

  const shown = weightRungs()
  expect(shown).toHaveLength(161)
  expect(shown[0]).toBe('BW−60')
  expect(shown[60]).toBe('BW')
  expect(shown[70]).toBe('BW+10')
  expect(shown[160]).toBe('BW+100')
})

test("O17 a 2.5 kg step gives Rungs 2.5 kg apart: BW−2.5, BW, BW+2.5", () => {
  render(<WeightDial exercise={bodyweightAt(2.5)} value={0} onChange={vi.fn()} />)

  const shown = weightRungs()
  expect(shown).toHaveLength(65)
  expect(shown.slice(23, 26)).toEqual(['BW−2.5', 'BW', 'BW+2.5'])
})

test('O17 the Rung the Dial is on is the selected one', () => {
  render(<WeightDial exercise={pushUps} value={10} onChange={vi.fn()} />)

  const selected = within(screen.getByRole('listbox', { name: 'Weight ladder' })).getAllByRole(
    'option',
    { selected: true },
  )
  expect(selected.map((option) => option.textContent)).toEqual(['BW+10'])
})

test('O17 tapping the BW+10 Rung tells onChange 10', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial exercise={pushUps} value={0} onChange={onChange} />)

  await user.click(screen.getByRole('option', { name: 'BW+10' }))

  expect(onChange).toHaveBeenLastCalledWith(10)
})

test('O17 tapping the BW−20 Rung tells onChange -20', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial exercise={pushUps} value={0} onChange={onChange} />)

  await user.click(screen.getByRole('option', { name: 'BW−20' }))

  expect(onChange).toHaveBeenLastCalledWith(-20)
})

test('O17 Increase load from BW steps up one Rung of the weight step', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial exercise={bodyweightAt(2.5)} value={0} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(onChange).toHaveBeenLastCalledWith(2.5)
})

test('O17 Decrease load from BW steps down one Rung into assistance', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial exercise={bodyweightAt(2.5)} value={0} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Decrease weight' }))

  expect(onChange).toHaveBeenLastCalledWith(-2.5)
})

test('O17 Increase load at BW+100 stays at +100', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial exercise={pushUps} value={100} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(readoutValue(weightReadout())).toBe('BW+100')
  expect(onChange.mock.calls.every(([value]) => value === 100)).toBe(true)
})

test('O17 Decrease load at BW−60 stays at -60', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<WeightDial exercise={pushUps} value={-60} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Decrease weight' }))

  expect(readoutValue(weightReadout())).toBe('BW−60')
  expect(onChange.mock.calls.every(([value]) => value === -60)).toBe(true)
})
