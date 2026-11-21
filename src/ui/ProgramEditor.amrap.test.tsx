// E14-T5 (O13): the Program editor's "Last set AMRAP" switch on a Plan, on its Plan editor page
// (DX-17), pushed by a tap on the Plan's row.
import { render, screen } from '@testing-library/react'
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
    libraryId: 'bench',
  },
  {
    id: 'squat',
    name: 'Back Squat',
    weightStep: 2.5,
    startWeight: 60,
    bodyweight: false,
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

/** A Plan's Last set AMRAP switch, on its Plan editor -- pushed first by a tap on its row. */
async function amrapBox(user: ReturnType<typeof userEvent.setup>, name: string): Promise<HTMLElement> {
  const row = screen.queryByRole('button', { name: new RegExp(`^${name}, `) })
  if (row !== null) await user.click(row)
  return screen.getByRole('switch', { name: 'Last set AMRAP' })
}

/** Back to the list, then Save. */
async function save(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const back = screen.queryByRole('button', { name: 'Back' })
  if (back !== null) await user.click(back)
  await user.click(screen.getByRole('button', { name: 'Save' }))
}

test('O13: ticking Last set AMRAP on a Plan and saving stores amrapLast true on that Plan only', async () => {
  const { onSave, user } = renderEditor(program(false))
  await user.click(await amrapBox(user, 'Flat Bench'))
  await save(user)
  const saved = onSave.mock.calls[0][0]
  expect(saved.workouts[0].exercises[0].amrapLast).toBe(true)
  expect('amrapLast' in saved.workouts[0].exercises[1]).toBe(false)
})

test('O13: a Plan never ticked is saved without an amrapLast field', async () => {
  const { onSave, user } = renderEditor(program(false))
  expect(await amrapBox(user, 'Flat Bench')).not.toBeChecked()
  await save(user)
  const saved = onSave.mock.calls[0][0]
  expect('amrapLast' in saved.workouts[0].exercises[0]).toBe(false)
})

test('O13: a Plan stored with amrapLast true shows the box ticked and keeps it on save', async () => {
  const { onSave, user } = renderEditor(program(true))
  expect(await amrapBox(user, 'Flat Bench')).toBeChecked()
  await save(user)
  expect(onSave.mock.calls[0][0].workouts[0].exercises[0].amrapLast).toBe(true)
})

test('O13: unticking Last set AMRAP removes the field rather than storing false', async () => {
  const { onSave, user } = renderEditor(program(true))
  await user.click(await amrapBox(user, 'Flat Bench'))
  await save(user)
  const saved = onSave.mock.calls[0][0]
  expect('amrapLast' in saved.workouts[0].exercises[0]).toBe(false)
})
