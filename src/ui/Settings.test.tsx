import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Settings } from './Settings'
import type { Program } from '../types'

function program(id: string, name: string): Program {
  return { id, name, units: 'kg', workouts: [], sessionsPerWeek: 3 }
}

const programs: Program[] = [
  program('assaf-ab-2026', 'Assaf A/B 2026'),
  program('full-body-starter', 'Full body starter'),
]

// The E5-T16 gym-equipment props every render below now needs (`equipmentTypes`,
// `gymEquipment`, `onGymEquipmentChange`), so the pre-existing O18/O7 tests above keep
// compiling and passing unchanged -- none of them assert on "My gym's equipment".
const equipmentTypes = ['barbell', 'dumbbell', 'machine']

test('O18 Settings lists every program by name', () => {
  render(
    <Settings
      programs={programs}
      activeProgramId="assaf-ab-2026"
      onActiveProgramChange={vi.fn()}
      equipmentTypes={equipmentTypes}
      gymEquipment={null}
      onGymEquipmentChange={vi.fn()}
    />,
  )

  expect(screen.getByRole('radio', { name: 'Assaf A/B 2026' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Full body starter' })).toBeInTheDocument()
})

test('O18 Settings marks the active program as selected and the rest as not selected', () => {
  render(
    <Settings
      programs={programs}
      activeProgramId="full-body-starter"
      onActiveProgramChange={vi.fn()}
      equipmentTypes={equipmentTypes}
      gymEquipment={null}
      onGymEquipmentChange={vi.fn()}
    />,
  )

  expect(screen.getByRole('radio', { name: 'Full body starter' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Assaf A/B 2026' })).not.toBeChecked()
})

test('O18 choosing a different program calls onActiveProgramChange with its id', async () => {
  const user = userEvent.setup()
  const onActiveProgramChange = vi.fn()
  render(
    <Settings
      programs={programs}
      activeProgramId="assaf-ab-2026"
      onActiveProgramChange={onActiveProgramChange}
      equipmentTypes={equipmentTypes}
      gymEquipment={null}
      onGymEquipmentChange={vi.fn()}
    />,
  )

  await user.click(screen.getByRole('radio', { name: 'Full body starter' }))

  expect(onActiveProgramChange).toHaveBeenCalledWith('full-body-starter')
})

test('O18 choosing the already active program does not call onActiveProgramChange', async () => {
  const user = userEvent.setup()
  const onActiveProgramChange = vi.fn()
  render(
    <Settings
      programs={programs}
      activeProgramId="assaf-ab-2026"
      onActiveProgramChange={onActiveProgramChange}
      equipmentTypes={equipmentTypes}
      gymEquipment={null}
      onGymEquipmentChange={vi.fn()}
    />,
  )

  await user.click(screen.getByRole('radio', { name: 'Assaf A/B 2026' }))

  expect(onActiveProgramChange).not.toHaveBeenCalled()
})

test('O7 using the Export control calls onExport', async () => {
  const user = userEvent.setup()
  const onExport = vi.fn()
  render(
    <Settings
      programs={programs}
      activeProgramId="assaf-ab-2026"
      onActiveProgramChange={vi.fn()}
      onExport={onExport}
      equipmentTypes={equipmentTypes}
      gymEquipment={null}
      onGymEquipmentChange={vi.fn()}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Export' }))

  expect(onExport).toHaveBeenCalledTimes(1)
})

// --- E2-T8: the control a backup file is chosen with --------------------------------------
//
// `SettingsProps` has declared `onImportFile` since E2-T4, but no control has ever rendered
// for it, so a backup can be exported and never read back. These tests drive the choosing of
// a file the way the trainee does: an `<input type="file">` whose accessible name is
// "Import backup", changed by picking a file.
//
// jsdom implements `Blob` and `File` but not `Blob.prototype.text`, which every browser this
// app runs in has -- `src/storage/backup.ts` installs the same feature-detected polyfill for
// the runtimes that lack it. Settings is rendered here without that module, so the missing
// capability is stood in for rather than being left to decide how the file gets read.
if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error ?? new Error('failed to read blob'))
      reader.readAsText(this)
    })
  }
}

/** The file control a backup is chosen with. */
function importControl(): HTMLInputElement {
  return screen.getByLabelText(/import backup/i) as HTMLInputElement
}

/** A backup file's text, written out by hand so no code under test produced it. */
const BACKUP_TEXT =
  '{"schemaVersion":1,"exportedAt":1700000000000,"sessions":[],' +
  '"settings":{"activeProgramId":"assaf-ab-2026","lastExportedAt":null}}'

test('O15 choosing a backup file hands its text to onImportFile', async () => {
  const user = userEvent.setup()
  const onImportFile = vi.fn()
  render(
    <Settings
      programs={programs}
      activeProgramId="assaf-ab-2026"
      onActiveProgramChange={vi.fn()}
      onImportFile={onImportFile}
      equipmentTypes={equipmentTypes}
      gymEquipment={null}
      onGymEquipmentChange={vi.fn()}
    />,
  )

  await user.upload(
    importControl(),
    new File([BACKUP_TEXT], 'workout-backup-2026-09-22.json', { type: 'application/json' }),
  )

  await waitFor(() => {
    expect(onImportFile).toHaveBeenCalledWith(BACKUP_TEXT)
  })
  expect(onImportFile).toHaveBeenCalledTimes(1)
})

test('O15 dismissing the file picker without choosing a file does not call onImportFile', async () => {
  const onImportFile = vi.fn()
  render(
    <Settings
      programs={programs}
      activeProgramId="assaf-ab-2026"
      onActiveProgramChange={vi.fn()}
      onImportFile={onImportFile}
      equipmentTypes={equipmentTypes}
      gymEquipment={null}
      onGymEquipmentChange={vi.fn()}
    />,
  )

  fireEvent.change(importControl(), { target: { files: [] } })

  // A read of the chosen file is asynchronous, so give one that should not have started the
  // chance to finish before concluding it never did.
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
  expect(onImportFile).not.toHaveBeenCalled()
})

// --- E5-T16: "My gym's equipment" -----------------------------------------------------------
//
// `equipmentTypes` is handed in already computed (per the ticket, the library scan that
// excludes `body only` is App's job -- see the S14/S15 integration tests in App.test.tsx);
// Settings only renders the list it is given and reports the next list to save.

test('S14 Settings lists every given equipment type in "My gym\'s equipment", all ticked when nothing is saved', () => {
  render(
    <Settings
      programs={programs}
      activeProgramId="assaf-ab-2026"
      onActiveProgramChange={vi.fn()}
      equipmentTypes={equipmentTypes}
      gymEquipment={null}
      onGymEquipmentChange={vi.fn()}
    />,
  )

  for (const equipment of equipmentTypes) {
    expect(screen.getByRole('checkbox', { name: equipment })).toBeChecked()
  }
})

test('S14 Settings ticks only the equipment types in a saved gym equipment list', () => {
  render(
    <Settings
      programs={programs}
      activeProgramId="assaf-ab-2026"
      onActiveProgramChange={vi.fn()}
      equipmentTypes={equipmentTypes}
      gymEquipment={['barbell']}
      onGymEquipmentChange={vi.fn()}
    />,
  )

  expect(screen.getByRole('checkbox', { name: 'barbell' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'dumbbell' })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'machine' })).not.toBeChecked()
})

test('S14 unticking machine calls onGymEquipmentChange with every other equipment type still in the list', async () => {
  const user = userEvent.setup()
  const onGymEquipmentChange = vi.fn()
  render(
    <Settings
      programs={programs}
      activeProgramId="assaf-ab-2026"
      onActiveProgramChange={vi.fn()}
      equipmentTypes={equipmentTypes}
      gymEquipment={null}
      onGymEquipmentChange={onGymEquipmentChange}
    />,
  )

  await user.click(screen.getByRole('checkbox', { name: 'machine' }))

  expect(onGymEquipmentChange).toHaveBeenCalledWith(['barbell', 'dumbbell'])
})

test('S14 re-ticking a previously unticked equipment type adds it back to the saved list', async () => {
  const user = userEvent.setup()
  const onGymEquipmentChange = vi.fn()
  render(
    <Settings
      programs={programs}
      activeProgramId="assaf-ab-2026"
      onActiveProgramChange={vi.fn()}
      equipmentTypes={equipmentTypes}
      gymEquipment={['barbell']}
      onGymEquipmentChange={onGymEquipmentChange}
    />,
  )

  await user.click(screen.getByRole('checkbox', { name: 'dumbbell' }))

  expect(onGymEquipmentChange).toHaveBeenCalledWith(['barbell', 'dumbbell'])
})
