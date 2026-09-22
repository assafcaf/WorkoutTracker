import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Settings } from './Settings'
import type { Program } from '../types'

function program(id: string, name: string): Program {
  return { id, name, units: 'kg', workouts: [] }
}

const programs: Program[] = [
  program('assaf-ab-2026', 'Assaf A/B 2026'),
  program('full-body-starter', 'Full body starter'),
]

test('O18 Settings lists every program by name', () => {
  render(
    <Settings programs={programs} activeProgramId="assaf-ab-2026" onActiveProgramChange={vi.fn()} />,
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
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Export' }))

  expect(onExport).toHaveBeenCalledTimes(1)
})
