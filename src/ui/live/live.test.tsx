import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { LiveSessionBar } from './LiveSessionBar'
import { UpNextRows } from './UpNextRows'
import type { Exercise, Session, SetEntry, Workout } from '../../types'

test('V1-10 given the bar under the live header, when it renders, then it holds only the Now | All switch, no volume line or bar', () => {
  render(<LiveSessionBar view="now" onViewChange={vi.fn()} />)

  expect(screen.queryByText(/Volume|at this point/)).toBeNull()
  expect(screen.queryByRole('img')).toBeNull()
})

test('DX-19 the view switch is a two-segment control "Set | All" that always shows both, the current one checked', async () => {
  const user = userEvent.setup()
  const onViewChange = vi.fn()
  render(<LiveSessionBar view="now" onViewChange={onViewChange} />)

  const group = screen.getByRole('radiogroup', { name: 'View' })
  expect(within(group).getByRole('radio', { name: 'Set' })).toBeChecked()
  expect(within(group).getByRole('radio', { name: 'All' })).not.toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'All' }))
  expect(onViewChange).toHaveBeenCalledWith('all')
})

test('DX-19 on All the control still names both views, and Set goes back to the Set', async () => {
  const user = userEvent.setup()
  const onViewChange = vi.fn()
  render(<LiveSessionBar view="all" onViewChange={onViewChange} />)

  expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'Set' }))
  expect(onViewChange).toHaveBeenCalledWith('now')
})

const squat: Exercise = { id: 'squat', name: 'Back squat', weightStep: 2.5, startWeight: 20, bodyweight: false, libraryId: 'a' }
const lunge: Exercise = { id: 'lunge', name: 'Lunges', weightStep: 2, startWeight: 8, bodyweight: false, libraryId: 'b' }
const pushup: Exercise = { id: 'pushup', name: 'Push-ups', weightStep: 1, startWeight: null, bodyweight: true, libraryId: 'c' }
const byId = new Map([squat, lunge, pushup].map((exercise) => [exercise.id, exercise] as const))
const workout: Workout = {
  id: 'A',
  name: 'Workout A',
  exercises: [
    { exerciseId: 'squat', sets: 4, repRange: [8, 10], restSeconds: 180 },
    { exerciseId: 'lunge', sets: 3, repRange: [10, 12], restSeconds: 90 },
    { exerciseId: 'pushup', sets: 3, repRange: [10, 15], restSeconds: 60 },
  ],
}
const entry = (exerciseId: string, setIndex: number, weightKg: number | null, reps: number): SetEntry => ({
  exerciseId,
  setIndex,
  weightKg,
  reps,
  loggedAt: 1000 + setIndex,
})
const session: Session = {
  id: 's',
  programId: 'p',
  workoutId: 'A',
  startedAt: 1000,
  finishedAt: null,
  entries: [entry('squat', 1, 60, 10), entry('lunge', 1, 8, 12)],
}

function renderRows(onOpen = vi.fn()) {
  render(
    <UpNextRows
      workout={workout}
      session={session}
      resolve={(id) => byId.get(id)}
      lastEntries={new Map([['lunge', [entry('lunge', 1, 8, 12), entry('lunge', 2, 8, 12)]]])}
      sessions={[]}
      volumeBaseline={{ period: 'last' }}
      currentId="squat"
      onOpen={onOpen}
    />,
  )
  return onOpen
}

test('Live the rest of the Workout is one row per other Exercise: name, plan and load, a dot per Set', () => {
  renderRows()

  const rows = within(screen.getByRole('list', { name: 'Rest of the workout' })).getAllByRole('button')
  expect(rows).toHaveLength(2)
  expect(within(rows[0]).getByText('Lunges')).toBeVisible()
  expect(within(rows[0]).getByText('3 × 10–12 · 8 kg')).toBeVisible()
  expect(within(rows[0]).getByLabelText('1 of 3 sets logged').querySelectorAll('.upnext-dot--done')).toHaveLength(1)
  expect(within(rows[1]).getByText('3 × 10–15 · BW')).toBeVisible()
  expect(within(rows[1]).getByText('bodyweight')).toBeVisible()
})

test('Live tapping a row opens that Exercise at its next Set', async () => {
  const user = userEvent.setup()
  const onOpen = renderRows()

  await user.click(screen.getByRole('button', { name: /^Lunges/ }))

  expect(onOpen).toHaveBeenCalledWith('lunge', 2)
})
