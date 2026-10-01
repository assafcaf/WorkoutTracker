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

test('O7 the editor shows the bar weight and one pair count per plate', () => {
  renderEditor()

  expect(screen.getByRole('spinbutton', { name: 'Bar weight (kg)' })).toHaveValue(20)
  expect(screen.getByRole('spinbutton', { name: 'Pairs of 25 kg' })).toHaveValue(4)
  expect(screen.getByRole('spinbutton', { name: 'Pairs of 2.5 kg' })).toHaveValue(2)
  expect(screen.getByRole('spinbutton', { name: 'Pairs of 1.25 kg' })).toHaveValue(1)
})

test('O7 changing the bar weight reports the inventory with that bar and the same plates', () => {
  const onChange = renderEditor()

  fireEvent.change(screen.getByRole('spinbutton', { name: 'Bar weight (kg)' }), {
    target: { value: '15' },
  })

  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith({ barKg: 15, plates: RACK.plates })
})

test('O7 changing one pair count reports that plate with the new count and leaves the others', () => {
  const onChange = renderEditor()

  fireEvent.change(screen.getByRole('spinbutton', { name: 'Pairs of 2.5 kg' }), {
    target: { value: '6' },
  })

  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith({
    barKg: 20,
    plates: [
      { kg: 25, pairs: 4 },
      { kg: 2.5, pairs: 6 },
      { kg: 1.25, pairs: 1 },
    ],
  })
})

test('O7 Remove on a row reports the inventory without that plate', async () => {
  const user = userEvent.setup()
  const onChange = renderEditor()

  await user.click(screen.getByRole('button', { name: 'Remove 2.5 kg' }))

  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith({
    barKg: 20,
    plates: [
      { kg: 25, pairs: 4 },
      { kg: 1.25, pairs: 1 },
    ],
  })
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
      programs={[]}
      activeProgramId={null}
      onActiveProgramChange={vi.fn()}
      equipmentTypes={['barbell']}
      gymEquipment={null}
      onGymEquipmentChange={vi.fn()}
      {...extra}
    />,
  )
}

test('O7 Settings shows a Bar and plates group after My gym\'s equipment when it has an inventory', () => {
  renderSettings({ plateInventory: RACK, onPlateInventoryChange: vi.fn() })

  const barAndPlates = screen.getByRole('group', { name: 'Bar and plates' })
  const gym = screen.getByRole('group', { name: /gym.s equipment/i })
  expect(gym.compareDocumentPosition(barAndPlates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(barAndPlates).getByRole('spinbutton', { name: 'Bar weight (kg)' })).toHaveValue(20)
})

test('O7 Settings without an inventory does not render Bar and plates', () => {
  renderSettings({})

  expect(screen.queryByRole('group', { name: 'Bar and plates' })).toBeNull()
})

test('O7 Settings hands a changed pair count to onPlateInventoryChange and shows plateInventoryError', () => {
  const onPlateInventoryChange = vi.fn()
  renderSettings({
    plateInventory: RACK,
    onPlateInventoryChange,
    plateInventoryError: 'Each plate size needs a whole number of pairs from 0 to 20.',
  })

  fireEvent.change(screen.getByRole('spinbutton', { name: 'Pairs of 25 kg' }), {
    target: { value: '9' },
  })

  expect(onPlateInventoryChange).toHaveBeenCalledWith({
    barKg: 20,
    plates: [
      { kg: 25, pairs: 9 },
      { kg: 2.5, pairs: 2 },
      { kg: 1.25, pairs: 1 },
    ],
  })
  expect(screen.getByRole('alert')).toHaveTextContent(/whole number of pairs/)
})
