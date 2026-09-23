// E5-T18 (M13): the Program tab -- the active program's name, a card per workout listing each
// exercise with sets x rep range and rest plus a small body map of that workout's sets, and a
// program switcher that changes the active program.
//
// The O1/O2 tests below are carried over from src/ui/ProgramPicker.test.tsx (E1-T2), whose
// workout-card list, exercise-line format and "Other programs (N)" disclosure move here per the
// spec ("ProgramPicker's list and switching move here") -- moved, not deleted. The exercise-line
// assertions gain rest (M13: "sets x rep range and rest"), which is the one place their content
// had to change; see this task's NOTES for the exact names that could not stay byte-identical.
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import assafJson from '../data/programs/assaf-ab-2026.json'
import starterJson from '../data/programs/full-body-starter.json'
import exercisesJson from '../data/exercises.json'
import { ProgramPage } from './ProgramPage'
import type { Exercise, LibraryExercise, Program } from '../types'

// The page is fed the shipped data files directly, so these tests stay independent of
// catalog.ts while still asserting what the trainee actually sees on the real program.
const assaf = assafJson as unknown as Program
const starter = starterJson as unknown as Program
const seeded = exercisesJson as Exercise[]

function catalogWithout(missing: string[] = []): Map<string, Exercise> {
  return new Map(
    seeded.filter((e) => !missing.includes(e.id)).map((e) => [e.id, e] as const),
  )
}

function renderProgramPage(
  catalog: Map<string, Exercise> = catalogWithout(),
  library: Map<string, LibraryExercise> = new Map(),
) {
  const onChooseProgram = vi.fn()
  render(
    <ProgramPage
      programs={[assaf, starter]}
      activeProgramId="assaf-ab-2026"
      catalog={catalog}
      library={library}
      onChooseProgram={onChooseProgram}
    />,
  )
  return { onChooseProgram }
}

function precedes(first: Element, second: Element): boolean {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  )
}

function lines(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole('listitem')
    .map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim())
}

// --- carried over from ProgramPicker.test.tsx's O1/O2 --------------------------------------

test('O1 the active program leads with Workout A then Workout B, above the other programs', () => {
  renderProgramPage()

  const program = screen.getByRole('heading', { name: 'Assaf A/B 2026' })
  const workoutA = screen.getByRole('heading', { name: 'Workout A' })
  const workoutB = screen.getByRole('heading', { name: 'Workout B' })
  const others = screen.getByRole('button', { name: 'Other programs (1)' })

  expect([
    precedes(program, workoutA),
    precedes(workoutA, workoutB),
    precedes(workoutB, others),
  ]).toEqual([true, true, true])
})

test('O1 Workout A names its seven exercises with rep target, set count and rest', () => {
  renderProgramPage()

  const [listA] = screen.getAllByRole('list')
  expect(lines(listA)).toEqual([
    'Back squat 8-10 x 4, rest 180s',
    'Lunges 10-12 x 3, rest 90s',
    'DB bench press 8-10 x 4, rest 90s',
    'Push-ups 10-15 x 3, rest 90s',
    'Machine shoulder press 8-10 x 3, rest 90s',
    'Lateral raises 10-15 x 3, rest 90s',
    'Cable push-down 10-12 x 3, rest 90s',
  ])
})

test('O1 Workout B names its seven exercises with rep target, set count and rest', () => {
  renderProgramPage()

  const listB = screen.getAllByRole('list')[1]
  expect(lines(listB)).toEqual([
    'Deadlift 8-10 x 3, rest 180s',
    'Assisted pull-ups 5-8 x 4, rest 90s',
    'Narrow-grip pull-down 10-12 x 3, rest 90s',
    'Machine row 8-10 x 4, rest 90s',
    'Face pull 10-15 x 3, rest 90s',
    'Hyper-extension 10-15 x 3, rest 90s',
    'Seated biceps curls 10-12 x 3, rest 90s',
  ])
})

test('O1 the one remaining program sits collapsed under "Other programs (1)"', () => {
  renderProgramPage()

  const others = screen.getByRole('button', { name: 'Other programs (1)' })
  expect(others).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('Full body starter')).toBeNull()
})

test('O1 opening the other programs disclosure reveals the remaining program', async () => {
  const user = userEvent.setup()
  renderProgramPage()

  await user.click(screen.getByRole('button', { name: 'Other programs (1)' }))

  expect(screen.getByText('Full body starter')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Other programs (1)' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
})

test('O2 a plan referencing an id absent from the catalog fails naming the program and the id', () => {
  let thrown: unknown
  try {
    renderProgramPage(catalogWithout(['deadlift']))
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(Error)
  expect((thrown as Error).message).toContain('assaf-ab-2026')
  expect((thrown as Error).message).toContain('deadlift')
})

test('O2 no picker renders when a plan references an id absent from the catalog', () => {
  // Positive control first: the same programs with a complete catalog do render a page, so
  // the emptiness asserted below is caused by the dangling id and nothing else.
  renderProgramPage()
  expect(screen.getByRole('heading', { name: 'Workout A' })).toBeVisible()
  cleanup()

  try {
    renderProgramPage(catalogWithout(['deadlift']))
  } catch {
    // the hard error itself is asserted by the test above; here only the DOM matters
  }

  expect(screen.queryByRole('heading', { name: 'Workout A' })).toBeNull()
  expect(screen.queryByText('Back squat 8-10 x 4, rest 180s')).toBeNull()
})

// --- M13: a per-workout body map, wired for real (not mocked) through prescribedWeekly ------
// (src/domain/programVolume.ts), toRegionCounts and regionsFor (src/domain/muscles.ts), and
// band (src/domain/band.ts) -- the same real BodyMap consumed elsewhere (src/ui/body/BodyMap.tsx).
//
// A one-exercise, one-workout, sessionsPerWeek: 1 program keeps the expected band hand-
// checkable: prescribedWeekly's weight is sessionsPerWeek / workouts.length = 1/1 = 1, so 6
// sets of a primary-only exercise weigh 6 -- band.ts's docstring bands a session count of 6+ as
// 3, and muscles.ts's MUSCLE_REGIONS maps quadriceps to the quadriceps region 1:1.

test('M13 a workout card draws a body map banding its own exercises, wired to real prescribedWeekly/toRegionCounts/BodyMap', () => {
  const soloProgram: Program = {
    id: 'solo',
    name: 'Solo program',
    units: 'kg',
    sessionsPerWeek: 1,
    workouts: [
      {
        id: 'solo-workout',
        name: 'Solo workout',
        exercises: [{ exerciseId: 'solo-exercise', sets: 6, repRange: [8, 10], restSeconds: 90 }],
      },
    ],
  }
  const catalog = new Map<string, Exercise>([
    [
      'solo-exercise',
      {
        id: 'solo-exercise',
        name: 'Solo exercise',
        weightStep: 2.5,
        startWeight: 20,
        bodyweight: false,
        invertProgress: false,
        libraryId: 'Solo_Lib',
      },
    ],
  ])
  const library = new Map<string, LibraryExercise>([
    [
      'Solo_Lib',
      {
        id: 'Solo_Lib',
        name: 'Solo lib',
        force: null,
        level: 'beginner',
        mechanic: null,
        equipment: null,
        primaryMuscles: ['quadriceps'],
        secondaryMuscles: [],
        instructions: [],
        category: 'strength',
        images: [],
      },
    ],
  ])

  const { container } = render(
    <ProgramPage
      programs={[soloProgram]}
      activeProgramId="solo"
      catalog={catalog}
      library={library}
      onChooseProgram={vi.fn()}
    />,
  )

  const quadriceps = [...container.querySelectorAll('[data-region="quadriceps"]')]
  expect(quadriceps.length, 'quadriceps must be drawn at least once').toBeGreaterThan(0)
  for (const element of quadriceps) {
    expect(element).toHaveAttribute('data-band', '3')
  }
})

// --- M13: the program switcher, reusing Settings' "Active program" radio-group pattern ------

test('M13 the program switcher marks the active program checked and calls onChooseProgram when another is chosen', async () => {
  const user = userEvent.setup()
  const { onChooseProgram } = renderProgramPage()

  expect(screen.getByRole('radio', { name: 'Assaf A/B 2026' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Full body starter' })).not.toBeChecked()

  await user.click(screen.getByRole('radio', { name: 'Full body starter' }))

  expect(onChooseProgram).toHaveBeenCalledWith('full-body-starter')
})
