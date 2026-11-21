import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { DEFAULT_PLATE_INVENTORY } from '../domain/plates'
import type { PlateInventory } from '../types'
import { PlateInventoryEditor } from './PlateInventoryEditor'
import { Settings } from './Settings'

const RACK: PlateInventory = {
  barKg: 20,
  plates: [
    { kg: 25, pairs: 4 },
    { kg: 2.5, pairs: 2 },
    { kg: 1.25, pairs: 1 },
  ],
}

function renderEditor(inventory: PlateInventory = RACK, error?: string | null) {
  const onChange = vi.fn()
  render(<PlateInventoryEditor inventory={inventory} onChange={onChange} error={error} />)
  return onChange
}

function stepped(label: string): string {
  return screen.getByRole('group', { name: label }).querySelector('output')?.textContent ?? ''
}

test('O7 DX-23 the editor shows the bar weight and one pairs stepper per plate, with no trash icons', () => {
  renderEditor()

  expect(stepped('Bar weight')).toBe('20 kg')
  expect(stepped('Pairs of 25 kg')).toBe('4')
  expect(stepped('Pairs of 2.5 kg')).toBe('2')
  expect(stepped('Pairs of 1.25 kg')).toBe('1')
  expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
  expect(document.querySelector('.btn-danger')).toBeNull()
})

test('O7 stepping the bar weight down reports the inventory with that bar and the same plates', async () => {
  const onChange = renderEditor()

  await userEvent.click(screen.getByRole('button', { name: 'Decrease Bar weight' }))

  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith({ barKg: 17.5, plates: RACK.plates })
})

test('O7 stepping one pair count reports that plate with the new count and leaves the others', async () => {
  const onChange = renderEditor()

  await userEvent.click(screen.getByRole('button', { name: 'Increase Pairs of 2.5 kg' }))

  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith({
    barKg: 20,
    plates: [
      { kg: 25, pairs: 4 },
      { kg: 2.5, pairs: 3 },
      { kg: 1.25, pairs: 1 },
    ],
  })
})

test('O7 DX-23 stepping a plate to 0 pairs removes it', async () => {
  const onChange = renderEditor()

  await userEvent.click(screen.getByRole('button', { name: 'Decrease Pairs of 1.25 kg' }))

  expect(onChange).toHaveBeenCalledWith({
    barKg: 20,
    plates: [
      { kg: 25, pairs: 4 },
      { kg: 2.5, pairs: 2 },
    ],
  })
})

test('O7 a plate at 20 pairs cannot step higher', () => {
  renderEditor({ barKg: 20, plates: [{ kg: 25, pairs: 20 }] })

  expect(screen.getByRole('button', { name: 'Increase Pairs of 25 kg' })).toBeDisabled()
})

test('O7 Add plate with a new weight reports the inventory with a plate of that weight added', async () => {
  const user = userEvent.setup()
  const onChange = renderEditor()

  fireEvent.change(screen.getByRole('spinbutton', { name: 'New plate weight (kg)' }), {
    target: { value: '7.5' },
  })
  await user.click(screen.getByRole('button', { name: 'Add plate' }))

  expect(onChange).toHaveBeenCalledTimes(1)
  const next = onChange.mock.calls[0][0] as PlateInventory
  expect(next.barKg).toBe(20)
  expect(next.plates.filter((plate) => plate.kg === 7.5)).toHaveLength(1)
  for (const plate of RACK.plates) expect(next.plates).toContainEqual(plate)
  expect(next.plates).toHaveLength(4)
})

test('O7 Reset to defaults reports DEFAULT_PLATE_INVENTORY', async () => {
  const user = userEvent.setup()
  const onChange = renderEditor()

  await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))

  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith(DEFAULT_PLATE_INVENTORY)
})

test('O7 a refused change shows its message inline as an alert', () => {
  renderEditor(RACK, 'Two plates cannot weigh the same.')

  expect(screen.getByRole('alert')).toHaveTextContent('Two plates cannot weigh the same.')
})

test('O7 without an error the editor shows no alert', () => {
  renderEditor(RACK, null)

  expect(screen.queryByRole('alert')).toBeNull()
})

// --- Settings placement ---------------------------------------------------------------------

function renderSettings(extra: Partial<React.ComponentProps<typeof Settings>>) {
  render(
    <Settings
      {...extra}
    />,
  )
}

test('O7 DX-23 Settings shows a Bar and plates row after Week starts on that pushes its page', async () => {
  renderSettings({ plateInventory: RACK, onPlateInventoryChange: vi.fn() })

  // V2-09: Bar and plates is the last row of the Workout group, after Week starts on.
  const row = within(screen.getByRole('group', { name: 'Workout' })).getByRole('button', { name: /^Bar and plates/ })
  const week = screen.getByRole('combobox', { name: 'Week starts on' })
  expect(week.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByRole('group', { name: 'Bar and plates' })).toBeNull()

  await userEvent.click(row)

  const page = screen.getByRole('dialog', { name: 'Bar and plates' })
  expect(within(page).getByRole('group', { name: 'Bar weight' })).toHaveTextContent('20 kg')
  // "Reset to defaults" is text at the bottom of the page.
  const reset = within(page).getByRole('button', { name: 'Reset to defaults' })
  expect(reset).toHaveClass('btn-quiet')
  await userEvent.click(within(page).getByRole('button', { name: 'Back' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('O7 Settings without an inventory does not render Bar and plates', () => {
  renderSettings({})

  expect(screen.queryByRole('group', { name: 'Bar and plates' })).toBeNull()
})

test('O7 Settings hands a changed pair count to onPlateInventoryChange and shows plateInventoryError', async () => {
  const onPlateInventoryChange = vi.fn()
  renderSettings({
    plateInventory: RACK,
    onPlateInventoryChange,
    plateInventoryError: 'Each plate size needs a whole number of pairs from 0 to 20.',
  })

  await userEvent.click(screen.getByRole('button', { name: /^Bar and plates/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Increase Pairs of 25 kg' }))

  expect(onPlateInventoryChange).toHaveBeenCalledWith({
    barKg: 20,
    plates: [
      { kg: 25, pairs: 5 },
      { kg: 2.5, pairs: 2 },
      { kg: 1.25, pairs: 1 },
    ],
  })
  expect(screen.getByRole('alert')).toHaveTextContent(/whole number of pairs/)
})
