import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { ProgramPage } from './ProgramPage'
import type { Exercise, LibraryExercise, Program, Session } from '../types'

afterEach(cleanup)

// E22-T10 [O24]: tapping a region on the Program tab's three body maps opens the RegionPanel.

const NOW = 1_700_000_000_000

const squat: Exercise = {
  id: 'squat',
  name: 'Back squat',
  weightStep: 2.5,
  startWeight: 20,
  bodyweight: false,
  libraryId: 'Squat_Lib',
}
const curl: Exercise = {
  id: 'ham-curl',
  name: 'Ham curl',
  weightStep: 2.5,
  startWeight: 20,
  bodyweight: false,
  libraryId: 'Curl_Lib',
}
const libraryEntry = (id: string, primary: LibraryExercise['primaryMuscles']): LibraryExercise => ({
  id,
  name: id,
  force: null,
  level: 'beginner',
  mechanic: null,
  equipment: null,
  primaryMuscles: primary,
  secondaryMuscles: [],
  instructions: [],
  category: 'strength',
  images: [],
})
const catalog = new Map<string, Exercise>([
  [squat.id, squat],
  [curl.id, curl],
])
const library = new Map<string, LibraryExercise>([
  ['Squat_Lib', libraryEntry('Squat_Lib', ['quadriceps'])],
  ['Curl_Lib', libraryEntry('Curl_Lib', ['hamstrings'])],
])
const program = {
  id: 'p',
  name: 'P',
  units: 'kg',
  sessionsPerWeek: 1,
  workouts: [
    {
      id: 'w',
      name: 'W',
      exercises: [{ exerciseId: 'squat', sets: 4, repRange: [8, 10], restSeconds: 90 }],
    },
  ],
} as unknown as Program
const session: Session = {
  id: 's',
  programId: 'p',
  workoutId: 'w',
  startedAt: NOW - 1000,
  finishedAt: NOW - 500,
  entries: [
    { exerciseId: 'ham-curl', setIndex: 0, weightKg: 40, reps: 10, loggedAt: NOW - 500 },
    { exerciseId: 'ham-curl', setIndex: 1, weightKg: 40, reps: 10, loggedAt: NOW - 400 },
  ],
}

function setup(onBrowse = vi.fn()) {
  const { container } = render(
    <ProgramPage
      programs={[program]}
      activeProgramId="p"
      catalog={catalog}
      library={library}
      onChooseProgram={vi.fn()}
      sessions={[session]}
      now={NOW}
      onBrowse={onBrowse}
    />,
  )
  const maps = container.querySelectorAll('.body-map')
  return { maps, onBrowse }
}

function tap(map: Element, region: string) {
  return userEvent.click(map.querySelector(`[data-region="${region}"]`)!)
}

test('O24 tapping a region on the planned muscle map opens its panel with the planned Sets and Exercises', async () => {
  const { maps } = setup()
  expect(maps).toHaveLength(3)
  await tap(maps[0], 'quadriceps')
  const panel = screen.getByRole('dialog', { name: 'quadriceps' })
  expect(within(panel).getByText('4 sets', { selector: '.region-panel-count' })).toBeVisible()
  expect(within(panel).getByText('Back squat')).toBeVisible()
})

test("O24 tapping a region on This week's Planned map opens the planned panel", async () => {
  const { maps } = setup()
  await tap(maps[1], 'quadriceps')
  expect(within(screen.getByRole('dialog', { name: 'quadriceps' })).getByText('Back squat')).toBeVisible()
})

test("O24 tapping a region on the Done map opens this week's done Sets and Exercises", async () => {
  const { maps } = setup()
  await tap(maps[2], 'hamstring')
  const panel = screen.getByRole('dialog', { name: 'hamstring' })
  expect(within(panel).getByText('2 sets', { selector: '.region-panel-count' })).toBeVisible()
  expect(within(panel).getByText('Ham curl')).toBeVisible()
})

test('O24 Close dismisses the panel', async () => {
  const { maps } = setup()
  await tap(maps[0], 'quadriceps')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog', { name: 'quadriceps' })).toBeNull()
})

test("O24 Browse exercises hands the region's muscles to onBrowse", async () => {
  const { maps, onBrowse } = setup()
  await tap(maps[0], 'quadriceps')
  await userEvent.click(screen.getByRole('button', { name: 'Browse exercises' }))
  expect(onBrowse).toHaveBeenCalledWith(['quadriceps'])
})
