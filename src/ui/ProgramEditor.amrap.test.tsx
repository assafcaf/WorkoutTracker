// E14-T5 (O13): the Program editor's "Last set AMRAP" checkbox on a Plan.
// Each Plan is an `<li>` holding its `Sets` input and its `Last set AMRAP` checkbox.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Mock } from 'vitest'
import { ProgramEditor } from './ProgramEditor'
import type { Exercise, Program } from '../types'

const exercises: Exercise[] = [
  {
    id: 'bench',
    name: 'Flat Bench',
    weightStep: 2.5,
    startWeight: 40,
    bodyweight: false,
    invertProgress: false,
    libraryId: 'bench',
  },
  {
    id: 'squat',
    name: 'Back Squat',
    weightStep: 2.5,
    startWeight: 60,
    bodyweight: false,
    invertProgress: false,
    libraryId: 'squat',
  },
]
const byId = new Map(exercises.map((e) => [e.id, e] as const))

function program(benchAmrap: boolean): Program {
  return {
    id: 'p',
    name: 'Split',
    units: 'kg',
    sessionsPerWeek: 1,
    workouts: [
      {
        id: 'wa',
        name: 'Upper',
        exercises: [
          {
            exerciseId: 'bench',
            sets: 4,
            repRange: [6, 8],
            restSeconds: 120,
            ...(benchAmrap ? { amrapLast: true } : {}),
          },
          { exerciseId: 'squat', sets: 3, repRange: [8, 10], restSeconds: 90 },
        ],
      },
    ],
  }
}

function renderEditor(initial: Program) {
  const onSave: Mock<(p: Program) => void> = vi.fn()
  const user = userEvent.setup()
  render(
    <ProgramEditor
      initial={initial}
      isNew={false}
      resolve={(id) => byId.get(id)}
      library={[]}
      gymEquipment={null}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  )
  return { onSave, user }
}

function planRow(name: string): HTMLElement {
  const row = screen.getByText(name).closest('li')
  if (row === null) throw new Error(`no Plan row for ${name}`)
  return row
}

function amrapBox(name: string): HTMLElement {
  return within(planRow(name)).getByRole('checkbox', { name: 'Last set AMRAP' })
}

test('O13: ticking Last set AMRAP on a Plan and saving stores amrapLast true on that Plan only', async () => {
  const { onSave, user } = renderEditor(program(false))
  await user.click(amrapBox('Flat Bench'))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const saved = onSave.mock.calls[0][0]
  expect(saved.workouts[0].exercises[0].amrapLast).toBe(true)
  expect('amrapLast' in saved.workouts[0].exercises[1]).toBe(false)
})

test('O13: a Plan never ticked is saved without an amrapLast field', async () => {
  const { onSave, user } = renderEditor(program(false))
  expect(amrapBox('Flat Bench')).not.toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const saved = onSave.mock.calls[0][0]
  expect('amrapLast' in saved.workouts[0].exercises[0]).toBe(false)
})

test('O13: a Plan stored with amrapLast true shows the box ticked and keeps it on save', async () => {
  const { onSave, user } = renderEditor(program(true))
  expect(amrapBox('Flat Bench')).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave.mock.calls[0][0].workouts[0].exercises[0].amrapLast).toBe(true)
})

test('O13: unticking Last set AMRAP removes the field rather than storing false', async () => {
  const { onSave, user } = renderEditor(program(true))
  await user.click(amrapBox('Flat Bench'))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const saved = onSave.mock.calls[0][0]
  expect('amrapLast' in saved.workouts[0].exercises[0]).toBe(false)
})
