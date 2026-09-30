import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { LoadDial } from './LoadDial'

// E14-T14 O17: the Load Dial a Bodyweight Exercise's set screen shows under the reps Dial. Its
// value is the signed Load in kg: 0 is plain bodyweight and reads "BW"; added weight reads
// "BW+10", assistance "BW−20" with a true minus sign (U+2212).

/** The readout, which names the Load the Dial is on. */
function loadReadout(): HTMLElement {
  return screen.getByRole('button', { name: 'Load' })
}

function readoutValue(element: HTMLElement): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function rungs(): string[] {
  return within(screen.getByRole('listbox', { name: 'Load ladder' }))
    .getAllByRole('option')
    .map((option) => (option.textContent ?? '').trim())
}

test('O17 the Load Dial is a group named Load', () => {
  render(<LoadDial step={1} value={0} onChange={vi.fn()} />)

  expect(screen.getByRole('group', { name: 'Load' })).toBeInTheDocument()
})

test('O17 the Load Dial reads BW at 0', () => {
  render(<LoadDial step={1} value={0} onChange={vi.fn()} />)

  expect(readoutValue(loadReadout())).toBe('BW')
})

test('O17 the Load Dial reads BW+10 at +10', () => {
  render(<LoadDial step={1} value={10} onChange={vi.fn()} />)

  expect(readoutValue(loadReadout())).toBe('BW+10')
})

test('O17 the Load Dial reads BW−20, with a true minus sign, at -20', () => {
  render(<LoadDial step={1} value={-20} onChange={vi.fn()} />)

  expect(readoutValue(loadReadout())).toBe('BW−20')
})

test('O17 a 1 kg step gives 161 Rungs from BW−60 to BW+100, with BW among them', () => {
  render(<LoadDial step={1} value={0} onChange={vi.fn()} />)

  const shown = rungs()
  expect(shown).toHaveLength(161)
  expect(shown[0]).toBe('BW−60')
  expect(shown[60]).toBe('BW')
  expect(shown[70]).toBe('BW+10')
  expect(shown[160]).toBe('BW+100')
})

test("O17 a 2.5 kg step gives Rungs 2.5 kg apart: BW−2.5, BW, BW+2.5", () => {
  render(<LoadDial step={2.5} value={0} onChange={vi.fn()} />)

  const shown = rungs()
  expect(shown).toHaveLength(65)
  expect(shown.slice(23, 26)).toEqual(['BW−2.5', 'BW', 'BW+2.5'])
})

test('O17 the Rung the Dial is on is the selected one', () => {
  render(<LoadDial step={1} value={10} onChange={vi.fn()} />)

  const selected = within(screen.getByRole('listbox', { name: 'Load ladder' })).getAllByRole(
    'option',
    { selected: true },
  )
  expect(selected.map((option) => option.textContent)).toEqual(['BW+10'])
})

test('O17 tapping the BW+10 Rung tells onChange 10', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<LoadDial step={1} value={0} onChange={onChange} />)

  await user.click(screen.getByRole('option', { name: 'BW+10' }))

  expect(onChange).toHaveBeenLastCalledWith(10)
})

test('O17 tapping the BW−20 Rung tells onChange -20', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<LoadDial step={1} value={0} onChange={onChange} />)

  await user.click(screen.getByRole('option', { name: 'BW−20' }))

  expect(onChange).toHaveBeenLastCalledWith(-20)
})

test('O17 Increase load from BW steps up one Rung of the weight step', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<LoadDial step={2.5} value={0} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Increase load' }))

  expect(onChange).toHaveBeenLastCalledWith(2.5)
})

test('O17 Decrease load from BW steps down one Rung into assistance', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<LoadDial step={2.5} value={0} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Decrease load' }))

  expect(onChange).toHaveBeenLastCalledWith(-2.5)
})

test('O17 Increase load at BW+100 stays at +100', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<LoadDial step={1} value={100} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Increase load' }))

  expect(screen.getByRole('group', { name: 'Load' })).toBeInTheDocument()
  expect(onChange.mock.calls.every(([value]) => value === 100)).toBe(true)
})

test('O17 Decrease load at BW−60 stays at -60', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<LoadDial step={1} value={-60} onChange={onChange} />)

  await user.click(screen.getByRole('button', { name: 'Decrease load' }))

  expect(screen.getByRole('group', { name: 'Load' })).toBeInTheDocument()
  expect(onChange.mock.calls.every(([value]) => value === -60)).toBe(true)
})
