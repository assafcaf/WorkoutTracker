import { render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ExerciseList } from '../../ui/ExerciseList'
import { UpNextRows } from '../../ui/live/UpNextRows'
import type { Exercise, Program, Session, SetEntry, Workout } from '../../types'

// O17: in a deload Session the exercise list's and the Up next rows' Presets show the
// deloaded weight; outside one, and on a Bodyweight Exercise, they are as before.
const squat: Exercise = { id: 'squat', name: 'Back squat', weightStep: 2.5, startWeight: 20, bodyweight: false, libraryId: 'a' }
const pushup: Exercise = { id: 'pushup', name: 'Push-ups', weightStep: 1, startWeight: null, bodyweight: true, libraryId: 'c' }
const byId = new Map([squat, pushup].map((exercise) => [exercise.id, exercise] as const))
const workout: Workout = {
  id: 'A',
  name: 'Workout A',
  exercises: [
    { exerciseId: 'squat', sets: 3, repRange: [8, 10], restSeconds: 180 },
    { exerciseId: 'pushup', sets: 3, repRange: [10, 15], restSeconds: 60 },
  ],
}
const program = { id: 'p', name: 'P', workouts: [workout] } as unknown as Program

const last = (setIndex: number): SetEntry => ({ exerciseId: 'squat', setIndex, weightKg: 80, reps: 8, loggedAt: 1 })
const lastEntries = new Map<string, SetEntry[]>([['squat', [last(1), last(2), last(3)]]])
const session: Session = {
  id: 's',
  programId: 'p',
  workoutId: 'A',
  startedAt: 1000,
  finishedAt: null,
  entries: [],
}

function renderList(deload: boolean | undefined) {
  render(
    <ExerciseList
      program={program}
      workout={workout}
      resolve={(id) => byId.get(id)}
      session={session}
      onOpenSet={vi.fn()}
      onFinish={vi.fn()}
      lastSwaps={{}}
      onUndoSwap={vi.fn()}
      onApplySwap={vi.fn()}
      lastEntries={lastEntries}
      sessions={[]}
      volumeBaseline={{ period: 'last' }}
      deload={deload}
    />,
  )
}

function renderRows(deload: boolean | undefined) {
  render(
    <UpNextRows
      workout={workout}
      session={session}
      resolve={(id) => byId.get(id)}
      lastEntries={lastEntries}
      sessions={[]}
      volumeBaseline={{ period: 'last' }}
      currentId="none"
      onOpen={vi.fn()}
      deload={deload}
    />,
  )
}

test('O17 in a deload Session the exercise list shows the planned Sets at the deloaded Preset', () => {
  renderList(true)
  expect(screen.getByRole('button', { name: 'Set 1 · 72.5 × 8' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Set 1 · 80 × 8' })).toBeNull()
})

test('O17 outside a deload Session the exercise list keeps last time\'s weight', () => {
  renderList(undefined)
  expect(screen.getByRole('button', { name: 'Set 1 · 80 × 8' })).toBeVisible()
})

test('O17 in a deload Session the Up next rows show the deloaded Preset, and a Bodyweight row is unchanged', () => {
  renderRows(true)
  const rows = within(screen.getByRole('list', { name: 'Rest of the workout' })).getAllByRole('button')
  expect(within(rows[0]).getByText('3 × 8–10 · 72.5 kg')).toBeVisible()
  expect(within(rows[1]).getByText('3 × 10–15 · BW')).toBeVisible()
})

test('O17 outside a deload Session the Up next rows show last time\'s weight', () => {
  renderRows(undefined)
  expect(screen.getByText('3 × 8–10 · 80 kg')).toBeVisible()
})
