// E5-T18 (M13): the Program tab -- the active program's name, a card per workout listing each
// exercise with sets x rep range and rest plus a small body map of that workout's sets, and a
// program switcher that changes the active program.
//
// The O1/O2 tests below are carried over from src/ui/ProgramPicker.test.tsx (E1-T2), whose
// workout-card list and exercise-line format move here per the spec ("ProgramPicker's list and
// switching move here") -- moved, not deleted. The exercise-line assertions gain rest (M13:
// "sets x rep range and rest"). ProgramPicker's "Other programs (N)" disclosure does not move:
// by operator ruling (E5-T18 attempt 2) the Program tab's switcher is an always-visible radio
// list of every program, the active one checked -- the same shape as Settings' "Active program"
// group -- so the O1 tests that were about the disclosure are rewritten against that switcher.
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import assafJson from '../data/programs/assaf-ab-2026.json'
import starterJson from '../data/programs/full-body-starter.json'
import exercisesJson from '../data/exercises.json'
import libraryJson from '../data/library/exercises.json'
import { ProgramPage } from './ProgramPage'
import type { Exercise, LibraryExercise, Muscle, Program, Session } from '../types'

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
      programsOpen
    />,
  )
  return { onChooseProgram }
}

function precedes(first: Element, second: Element): boolean {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  )
}

/** A workout card's exercise table, one `Exercise | Sets × reps | Rest | kg` line per row. */
function lines(card: HTMLElement): string[] {
  return within(card)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
        .join(' | '),
    )
}

/** The workout card headed `name`. */
function workoutCard(name: string): HTMLElement {
  const card = screen.getByRole('heading', { name }).closest('.workout-card')
  if (!card) throw new Error(`no workout card headed ${name}`)
  return card as HTMLElement
}

// --- carried over from ProgramPicker.test.tsx's O1/O2 --------------------------------------

test('O1 the active program leads with its name, then Workout A, then Workout B', () => {
  renderProgramPage()

  const program = screen.getByRole('heading', { name: 'A/B Split' })
  const workoutA = screen.getByRole('heading', { name: 'Workout A' })
  const workoutB = screen.getByRole('heading', { name: 'Workout B' })

  expect([precedes(program, workoutA), precedes(workoutA, workoutB)]).toEqual([true, true])
})

test('O1 Workout A names its seven exercises with rep target, set count and rest', () => {
  renderProgramPage()

  // S7a's table: name, sets × reps, rest as m:ss, and the load the next session opens on --
  // with no Session logged, each Exercise's own start weight (src/data/exercises.json).
  expect(lines(workoutCard('Workout A'))).toEqual([
    'Back squat | 4 × 8–10 | 3:00 | 50',
    'Lunges | 3 × 10–12 | 1:30 | 7',
    'DB bench press | 4 × 8–10 | 1:30 | 10',
    'Push-ups | 3 × 10–15 | 1:30 | BW',
    'Machine shoulder press | 3 × 8–10 | 1:30 | 5',
    'Lateral raises | 3 × 10–15 | 1:30 | 3',
    'Cable push-down | 3 × 10–12 | 1:30 | 17.5',
  ])
})

test('O1 Workout B names its seven exercises with rep target, set count and rest', () => {
  renderProgramPage()

  // An assisted Bodyweight lift reads its signed start Load (BW−27), a plain one BW.
  expect(lines(workoutCard('Workout B'))).toEqual([
    'Deadlift | 3 × 8–10 | 3:00 | 55',
    'Assisted pull-ups | 4 × 5–8 | 1:30 | BW−27',
    'Narrow-grip pull-down | 3 × 10–12 | 1:30 | 41.25',
    'Machine row | 4 × 8–10 | 1:30 | 50',
    'Face pull | 3 × 10–15 | 1:30 | 15',
    'Hyper-extension | 3 × 10–15 | 1:30 | BW',
    'Seated biceps curls | 3 × 10–12 | 1:30 | 8',
  ])
})

test('O1 the program switcher offers every loaded program as a choice, with no disclosure to open', () => {
  renderProgramPage()

  expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
    'assaf-ab-2026',
    'full-body-starter',
  ])
  expect(screen.getByRole('radio', { name: 'A/B Split' })).toBeVisible()
  expect(screen.getByRole('radio', { name: 'Full body starter' })).toBeVisible()
  expect(screen.queryByRole('button', { name: /Other programs/ })).toBeNull()
})

test('O1 the remaining program is only a switcher choice: none of its workouts are laid out', () => {
  renderProgramPage()

  // Hand-checked against src/data/programs/full-body-starter.json: its one workout is "Full body".
  expect(screen.getByRole('radio', { name: 'Full body starter' })).not.toBeChecked()
  expect(screen.queryByRole('heading', { name: 'Full body starter' })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Full body' })).toBeNull()
})

test('O1 with the other program active, the page leads with it and its radio is the checked one', () => {
  render(
    <ProgramPage
      programs={[assaf, starter]}
      activeProgramId="full-body-starter"
      catalog={catalogWithout()}
      library={new Map()}
      onChooseProgram={vi.fn()}
      programsOpen
    />,
  )

  expect(screen.getByRole('heading', { name: 'Full body starter' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Full body' })).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Workout A' })).toBeNull()
  expect(screen.getByRole('radio', { name: 'Full body starter' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'A/B Split' })).not.toBeChecked()
})

test('O1 choosing the already-active program does not call onChooseProgram', async () => {
  const user = userEvent.setup()
  const { onChooseProgram } = renderProgramPage()

  await user.click(screen.getByRole('radio', { name: 'A/B Split' }))

  expect(onChooseProgram).not.toHaveBeenCalled()
  expect(screen.getByRole('radio', { name: 'A/B Split' })).toBeChecked()
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
  expect(screen.queryByText('Back squat')).toBeNull()
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

  // Progress Dashboard S7a: the workout card is a table, each exercise marked by its muscle
  // family's dot (quadriceps -> legs, through the real library entry), and the card holds no
  // body map of its own -- the muscle map is drawn once, for the week, below the workouts.
  const workoutCard = container.querySelector('.workout-card')
  if (!workoutCard) throw new Error('expected a .workout-card element')
  const row = within(workoutCard as HTMLElement).getByRole('row', { name: /Solo exercise/ })
  expect(row.querySelector('.muscle-dot')).toHaveAttribute('data-family', 'legs')
  expect(workoutCard.querySelector('.body-map')).toBeNull()
  const weekQuadriceps = [...container.querySelectorAll('.program-page-weekly [data-region="quadriceps"]')]
  expect(weekQuadriceps.length, 'quadriceps must be drawn on the weekly map').toBeGreaterThan(0)
  for (const element of weekQuadriceps) {
    expect(element).not.toHaveAttribute('data-band', '0')
  }
})

// --- M13: the program switcher, reusing Settings' "Active program" radio-group pattern ------

test('M13 the program switcher marks the active program checked and calls onChooseProgram when another is chosen', async () => {
  const user = userEvent.setup()
  const { onChooseProgram } = renderProgramPage()

  expect(screen.getByRole('radio', { name: 'A/B Split' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Full body starter' })).not.toBeChecked()

  await user.click(screen.getByRole('radio', { name: 'Full body starter' }))

  expect(onChooseProgram).toHaveBeenCalledWith('full-body-starter')
})

// --- E5-T19 (M14/M15): a prescribed weekly body map, its gap list, and "This week"'s ---------
// prescribed-vs-done comparison, wired for real through prescribedWeekly/programGaps
// (src/domain/programVolume.ts), weekSets/toRegionCounts (src/domain/muscles.ts) and the same
// real BodyMap consumed elsewhere. Fixtures are hand-checked, not derived from the code under
// test:
//
// - `soloQuadProgram` prescribes only quadriceps, at 15 sets/week (sessionsPerWeek 1, one
//   workout, one exercise at 15 sets -- prescribedWeekly's weight is 1/1). band.ts bands 15 as
//   2 at week scale (10-20) but 3 at session scale (6+), so a band-2 quadriceps region can only
//   come from a week-scale map -- proving M14's map is banded at week scale, not reused from a
//   workout card.
// - `allMusclesProgram` prescribes exactly 1 set/week of each of `TRACKED_MUSCLES`'
//   (src/domain/programVolume.ts) 12 muscles, so `programGaps` has nothing to report (M14's
//   "no gaps" case) and every tracked region is banded non-zero by every prescribed-derived map
//   on the page (M15's "no sets" case: a zero band on a tracked region can then only come from
//   the done map).

const quadExercise: Exercise = {
  id: 'quad-exercise',
  name: 'Quad exercise',
  weightStep: 2.5,
  startWeight: 20,
  bodyweight: false,
  libraryId: 'Quad_Lib',
}

const quadLibrary: LibraryExercise = {
  id: 'Quad_Lib',
  name: 'Quad lib',
  force: null,
  level: 'beginner',
  mechanic: null,
  equipment: null,
  primaryMuscles: ['quadriceps'],
  secondaryMuscles: [],
  instructions: [],
  category: 'strength',
  images: [],
}

const soloQuadProgram: Program = {
  id: 'quad-solo',
  name: 'Quad solo',
  units: 'kg',
  sessionsPerWeek: 1,
  workouts: [
    {
      id: 'quad-workout',
      name: 'Quad workout',
      exercises: [{ exerciseId: 'quad-exercise', sets: 15, repRange: [8, 10], restSeconds: 90 }],
    },
  ],
}

const soloQuadCatalog = new Map<string, Exercise>([[quadExercise.id, quadExercise]])
const soloQuadLibrary = new Map<string, LibraryExercise>([[quadLibrary.id, quadLibrary]])

// TRACKED_MUSCLES (src/domain/programVolume.ts), transcribed by hand -- not imported, so this
// fixture stays independent of the code under test.
const TRACKED_MUSCLES_FOR_TEST: Muscle[] = [
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'chest',
  'lats',
  'middle back',
  'shoulders',
  'biceps',
  'triceps',
  'abdominals',
  'lower back',
]

function muscleExerciseId(muscle: Muscle): string {
  return `ex-${muscle.replace(/\s+/g, '-')}`
}

function muscleLibraryId(muscle: Muscle): string {
  return `Lib_${muscle.replace(/\s+/g, '_')}`
}

const allMusclesProgram: Program = {
  id: 'all-muscles',
  name: 'All muscles',
  units: 'kg',
  sessionsPerWeek: 1,
  workouts: [
    {
      id: 'all-muscles-workout',
      name: 'All muscles workout',
      // Quadriceps carries 15 sets/week (band 2 at week scale, band 3 at session scale) so the
      // "no gaps" test below can still prove the prescribed weekly map is drawn at week scale;
      // every other muscle carries 1, just enough to keep programGaps empty.
      exercises: TRACKED_MUSCLES_FOR_TEST.map((muscle) => ({
        exerciseId: muscleExerciseId(muscle),
        sets: muscle === 'quadriceps' ? 15 : 1,
        repRange: [8, 10] as [number, number],
        restSeconds: 90,
      })),
    },
  ],
}

const allMusclesCatalog = new Map<string, Exercise>(
  TRACKED_MUSCLES_FOR_TEST.map((muscle) => [
    muscleExerciseId(muscle),
    {
      id: muscleExerciseId(muscle),
      name: `${muscle} exercise`,
      weightStep: 2.5,
      startWeight: 20,
      bodyweight: false,
      libraryId: muscleLibraryId(muscle),
    } as Exercise,
  ]),
)

const allMusclesLibrary = new Map<string, LibraryExercise>(
  TRACKED_MUSCLES_FOR_TEST.map((muscle) => [
    muscleLibraryId(muscle),
    {
      id: muscleLibraryId(muscle),
      name: `${muscle} lib`,
      force: null,
      level: 'beginner',
      mechanic: null,
      equipment: null,
      primaryMuscles: [muscle],
      secondaryMuscles: [],
      instructions: [],
      category: 'strength',
      images: [],
    } as LibraryExercise,
  ]),
)

test('M14 the Program tab draws the prescribed weekly body map at week scale, not the per-workout session scale', () => {
  const { container } = render(
    <ProgramPage
      programs={[soloQuadProgram]}
      activeProgramId="quad-solo"
      catalog={soloQuadCatalog}
      library={soloQuadLibrary}
      onChooseProgram={vi.fn()}
    />,
  )

  // 15 quadriceps sets/week bands 2 at week scale (10-20) but 3 at session scale (6+) -- so a
  // band-2 quadriceps region can only be the prescribed weekly map, not a workout card.
  const weekBandedQuads = container.querySelectorAll('[data-region="quadriceps"][data-band="2"]')
  expect(
    weekBandedQuads.length,
    'a week-scale body map must band the prescribed 15 quadriceps sets/week as band 2',
  ).toBeGreaterThan(0)
})

test('M14 the Program tab lists every muscle absent from the prescribed program as "No direct <muscle> work"', () => {
  render(
    <ProgramPage
      programs={[soloQuadProgram]}
      activeProgramId="quad-solo"
      catalog={soloQuadCatalog}
      library={soloQuadLibrary}
      onChooseProgram={vi.fn()}
    />,
  )

  const gapMuscles = TRACKED_MUSCLES_FOR_TEST.filter((muscle) => muscle !== 'quadriceps')
  for (const muscle of gapMuscles) {
    expect(screen.getByText(`No direct ${muscle} work`)).toBeVisible()
  }
  expect(screen.queryByText('No direct quadriceps work')).toBeNull()
})

test('M14 with every tracked muscle prescribed, the Program tab lists no gaps', () => {
  const { container } = render(
    <ProgramPage
      programs={[allMusclesProgram]}
      activeProgramId="all-muscles"
      catalog={allMusclesCatalog}
      library={allMusclesLibrary}
      onChooseProgram={vi.fn()}
    />,
  )

  // Positive control: the prescribed weekly map (asserted the same way as the test above) must
  // still be drawn here, so the absence of gap text below is caused by every muscle actually
  // being prescribed and not by the whole feature being unrendered.
  const weekBandedQuads = container.querySelectorAll('[data-region="quadriceps"][data-band="2"]')
  expect(
    weekBandedQuads.length,
    'a week-scale body map must band the prescribed 15 quadriceps sets/week as band 2',
  ).toBeGreaterThan(0)

  expect(screen.queryByText(/No direct .+ work/)).toBeNull()
})

// --- M15: "This week"'s prescribed-vs-done comparison, at week scale ------------------------

const NOW = 1_700_000_000_000

const hamstringExercise: Exercise = {
  id: 'ham-exercise',
  name: 'Ham exercise',
  weightStep: 2.5,
  startWeight: 20,
  bodyweight: false,
  libraryId: 'Ham_Lib',
}

const hamstringLibrary: LibraryExercise = {
  id: 'Ham_Lib',
  name: 'Ham lib',
  force: null,
  level: 'beginner',
  mechanic: null,
  equipment: null,
  primaryMuscles: ['hamstrings'],
  secondaryMuscles: [],
  instructions: [],
  category: 'strength',
  images: [],
}

// One hamstring set logged just before NOW -- inside the 7-day window -- for an exercise the
// program never prescribes, so the done side's hamstring band can only come from this set.
const weekSession: Session = {
  id: 'week-session',
  programId: 'quad-solo',
  workoutId: 'quad-workout',
  startedAt: NOW - 1000,
  finishedAt: NOW - 500,
  entries: [{ exerciseId: 'ham-exercise', setIndex: 0, weightKg: 40, reps: 10, loggedAt: NOW - 500 }],
}

test('M15 "This week" shows the prescribed and done maps side by side at week scale', () => {
  const catalog = new Map<string, Exercise>([
    [quadExercise.id, quadExercise],
    [hamstringExercise.id, hamstringExercise],
  ])
  const library = new Map<string, LibraryExercise>([
    [quadLibrary.id, quadLibrary],
    [hamstringLibrary.id, hamstringLibrary],
  ])
  const resolve = (id: string) => catalog.get(id)

  const { container } = render(
    <ProgramPage
      programs={[soloQuadProgram]}
      activeProgramId="quad-solo"
      catalog={catalog}
      library={library}
      onChooseProgram={vi.fn()}
      sessions={[weekSession]}
      now={NOW}
      resolve={resolve}
    />,
  )

  expect(screen.getByRole('heading', { name: 'This week' })).toBeVisible()

  // Prescribed side: 15 quadriceps sets/week bands 2 at week scale.
  const prescribedQuads = container.querySelectorAll('[data-region="quadriceps"][data-band="2"]')
  expect(
    prescribedQuads.length,
    'the prescribed side must band quadriceps at week scale (15 sets/week -> band 2)',
  ).toBeGreaterThan(0)

  // Done side: 1 hamstring set logged this week bands 1 at week scale -- and the program never
  // prescribes hamstrings, so this band can only come from real weekSets data.
  const doneHamstring = container.querySelectorAll('[data-region="hamstring"][data-band="1"]')
  expect(
    doneHamstring.length,
    'the done side must reflect the hamstring set logged this week (1 set -> band 1)',
  ).toBeGreaterThan(0)

  // Done side: no quadriceps set was logged this week, so the done map's quadriceps band is 0
  // even though the prescribed side (checked above) is non-zero for the same region.
  const doneQuads = container.querySelectorAll('[data-region="quadriceps"][data-band="0"]')
  expect(
    doneQuads.length,
    'the done side must show quadriceps unband, since none were done this week',
  ).toBeGreaterThan(0)
})

test('M15 with no sets in the last 7 days, "This week" reads "No sets logged in the last 7 days" and its done map is empty', () => {
  const { container } = render(
    <ProgramPage
      programs={[allMusclesProgram]}
      activeProgramId="all-muscles"
      catalog={allMusclesCatalog}
      library={allMusclesLibrary}
      onChooseProgram={vi.fn()}
    />,
  )

  expect(screen.getByText('No sets logged in the last 7 days')).toBeVisible()

  // allMusclesProgram prescribes every tracked muscle, so every prescribed-derived map (the
  // workout card and the prescribed week map) bands quadriceps and triceps non-zero -- a
  // zero band on either can only come from an empty done map.
  const doneQuads = container.querySelectorAll('[data-region="quadriceps"][data-band="0"]')
  expect(
    doneQuads.length,
    'the done map must show quadriceps unband: it is prescribed but nothing was logged',
  ).toBeGreaterThan(0)

  const doneTriceps = container.querySelectorAll('[data-region="triceps"][data-band="0"]')
  expect(
    doneTriceps.length,
    'the done map must show triceps unband: it is prescribed but nothing was logged',
  ).toBeGreaterThan(0)
})

// --- E18-T17 (O28, R-K): "This week" is the calendar week, Monday 00:00 local, not 7 days -----
test('O28 "This week" done map counts the calendar week (R-K), not the last 7 days', () => {
  // Wednesday 14 Oct 2026, noon local. Sunday 11 Oct is 3 days back: inside a rolling 7 days,
  // but in the previous calendar week.
  const wednesday = new Date(2026, 9, 14, 12).getTime()
  const sunday = new Date(2026, 9, 11, 10).getTime()
  const sundaySession: Session = {
    id: 'sunday-session',
    programId: 'quad-solo',
    workoutId: 'quad-workout',
    startedAt: sunday,
    finishedAt: sunday + 1000,
    entries: [{ exerciseId: 'ham-exercise', setIndex: 0, weightKg: 40, reps: 10, loggedAt: sunday }],
  }
  const { container } = render(
    <ProgramPage
      programs={[allMusclesProgram]}
      activeProgramId="all-muscles"
      catalog={new Map([...allMusclesCatalog, [hamstringExercise.id, hamstringExercise]])}
      library={new Map([...allMusclesLibrary, [hamstringLibrary.id, hamstringLibrary]])}
      onChooseProgram={vi.fn()}
      sessions={[sundaySession]}
      now={wednesday}
    />,
  )

  expect(screen.getByText('No sets logged in the last 7 days')).toBeVisible()
  // Done map empty: the prescribed side bands every tracked region, so a zero can only be done's.
  expect(container.querySelectorAll('[data-region="quadriceps"][data-band="0"]').length).toBeGreaterThan(0)
})

// --- O22: "This week"'s two maps are captioned Planned/Done, each wrapped in a <figure> --------

test('O22 "This week" wraps its prescribed map in a figure captioned "Planned"', () => {
  const { container } = render(
    <ProgramPage
      programs={[assaf, starter]}
      activeProgramId="assaf-ab-2026"
      catalog={catalogWithout()}
      library={new Map()}
      onChooseProgram={vi.fn()}
    />,
  )

  const thisWeek = container.querySelector('.program-page-thisweek')
  if (!thisWeek) throw new Error('expected a .program-page-thisweek section')
  const figures = within(thisWeek as HTMLElement).getAllByRole('figure')
  expect(figures).toHaveLength(2)
  expect(within(figures[0]).getByText('Planned')).toBeVisible()
})

test('O22 "This week" wraps its done map in a figure captioned "Done"', () => {
  const { container } = render(
    <ProgramPage
      programs={[assaf, starter]}
      activeProgramId="assaf-ab-2026"
      catalog={catalogWithout()}
      library={new Map()}
      onChooseProgram={vi.fn()}
    />,
  )

  const thisWeek = container.querySelector('.program-page-thisweek')
  if (!thisWeek) throw new Error('expected a .program-page-thisweek section')
  const figures = within(thisWeek as HTMLElement).getAllByRole('figure')
  expect(figures).toHaveLength(2)
  expect(within(figures[1]).getByText('Done')).toBeVisible()
})

// --- O23: one BodyMapLegend per section that renders body maps, not one per map ---------------

test('O23 each workout card shows exactly one session-scale body-map legend', () => {
  const { container } = render(
    <ProgramPage
      programs={[assaf, starter]}
      activeProgramId="assaf-ab-2026"
      catalog={catalogWithout()}
      library={new Map()}
      onChooseProgram={vi.fn()}
    />,
  )

  // Progress Dashboard S7a: a workout card no longer draws a session-scale map, so it carries
  // no legend; each of its exercises carries its family's dot instead, named by the one family
  // legend in "Weekly sets, planned".
  const cards = [...container.querySelectorAll('.workout-card')]
  expect(cards.length, 'the active program must render at least one workout card').toBeGreaterThan(0)
  for (const card of cards) {
    expect(card.querySelectorAll('.body-map-legend')).toHaveLength(0)
    const rows = card.querySelectorAll('tbody tr')
    expect(card.querySelectorAll('tbody tr .muscle-dot')).toHaveLength(rows.length)
  }
  expect(container.querySelectorAll('.program-page-legend')).toHaveLength(1)
})

test('O23 "Weekly volume" shows exactly one week-scale body-map legend', () => {
  const { container } = render(
    <ProgramPage
      programs={[assaf, starter]}
      activeProgramId="assaf-ab-2026"
      catalog={catalogWithout()}
      library={new Map()}
      onChooseProgram={vi.fn()}
    />,
  )

  const weekly = container.querySelector('.program-page-weekly')
  if (!weekly) throw new Error('expected a .program-page-weekly section')
  expect(weekly.querySelectorAll('.body-map-legend[data-scale="week"]')).toHaveLength(1)
})

test('O23 "This week" shows exactly one week-scale body-map legend for its Planned/Done pair, not one per map', () => {
  const { container } = render(
    <ProgramPage
      programs={[assaf, starter]}
      activeProgramId="assaf-ab-2026"
      catalog={catalogWithout()}
      library={new Map()}
      onChooseProgram={vi.fn()}
    />,
  )

  const thisWeek = container.querySelector('.program-page-thisweek')
  if (!thisWeek) throw new Error('expected a .program-page-thisweek section')
  expect(thisWeek.querySelectorAll('.body-map-legend[data-scale="week"]')).toHaveLength(1)
})

// --- E9-T3 (O8): Program tab actions -- New program, Edit, Copy, Delete/Reset to original, ---
// each with inline confirmation (no browser dialog). `userProgramIds`/`bundledProgramIds`
// are independent of the rendered `programs` list, so a program's row is looked up by
// `data-program-id` (same convention as BodyMap's `data-region`/`data-band`) rather than by
// DOM order, which membership in the two sets does not otherwise affect.
//
// The three programs below carry no workouts, so `assertPlansAreInCatalog`, `prescribedWeekly`
// and `weekSets` all no-op on them (nothing to validate or count) -- keeping these tests
// independent of the catalog/library fixtures the earlier tests in this file use.

const userOnlyProgram: Program = {
  id: 'user-only',
  name: 'User only program',
  units: 'kg',
  sessionsPerWeek: 1,
  workouts: [],
}

const bundledAndUserProgram: Program = {
  id: 'bundled-and-user',
  name: 'Bundled and user program',
  units: 'kg',
  sessionsPerWeek: 1,
  workouts: [],
}

const bundledOnlyProgram: Program = {
  id: 'bundled-only',
  name: 'Bundled only program',
  units: 'kg',
  sessionsPerWeek: 1,
  workouts: [],
}

function renderActionsPage(overrides: Partial<import('./ProgramPage').ProgramPageProps> = {}) {
  const onNewProgram = vi.fn()
  const onEditProgram = vi.fn()
  const onCopyProgram = vi.fn()
  const onDeleteProgram = vi.fn()
  const onResetProgram = vi.fn()
  const { container } = render(
    <ProgramPage
      programs={[userOnlyProgram, bundledAndUserProgram, bundledOnlyProgram]}
      activeProgramId="user-only"
      catalog={new Map()}
      library={new Map()}
      onChooseProgram={vi.fn()}
      userProgramIds={new Set(['user-only', 'bundled-and-user'])}
      bundledProgramIds={new Set(['bundled-and-user', 'bundled-only'])}
      onNewProgram={onNewProgram}
      onEditProgram={onEditProgram}
      onCopyProgram={onCopyProgram}
      onDeleteProgram={onDeleteProgram}
      onResetProgram={onResetProgram}
      programsOpen
      {...overrides}
    />,
  )
  return { container, onNewProgram, onEditProgram, onCopyProgram, onDeleteProgram, onResetProgram }
}

function programRow(container: HTMLElement, id: string): HTMLElement {
  const row = container.querySelector(`[data-program-id="${id}"]`)
  if (!row) throw new Error(`expected a row for program ${id}`)
  return row as HTMLElement
}

test('O8 the Program tab offers a New program control that calls onNewProgram', async () => {
  const user = userEvent.setup()
  const { onNewProgram } = renderActionsPage()

  await user.click(screen.getByRole('button', { name: 'New program' }))

  expect(onNewProgram).toHaveBeenCalledTimes(1)
})

test('O8 each Program offers Edit, which calls onEditProgram with its id', async () => {
  const user = userEvent.setup()
  const { container, onEditProgram } = renderActionsPage()

  const row = programRow(container, 'bundled-and-user')
  await user.click(within(row).getByRole('button', { name: 'Edit' }))

  expect(onEditProgram).toHaveBeenCalledWith('bundled-and-user')
})

test('O8 each Program offers Copy, which calls onCopyProgram with its id', async () => {
  const user = userEvent.setup()
  const { container, onCopyProgram } = renderActionsPage()

  const row = programRow(container, 'bundled-only')
  await user.click(within(row).getByRole('button', { name: 'Copy' }))

  expect(onCopyProgram).toHaveBeenCalledWith('bundled-only')
})

test('O8 a Program in userProgramIds and not bundledProgramIds offers Delete but not Reset to original', () => {
  const { container } = renderActionsPage()

  const row = programRow(container, 'user-only')
  expect(within(row).getByRole('button', { name: 'Delete' })).toBeVisible()
  expect(within(row).queryByRole('button', { name: 'Reset to original' })).toBeNull()
})

test('O8 a Program in both userProgramIds and bundledProgramIds offers Reset to original but not Delete', () => {
  const { container } = renderActionsPage()

  const row = programRow(container, 'bundled-and-user')
  expect(within(row).getByRole('button', { name: 'Reset to original' })).toBeVisible()
  expect(within(row).queryByRole('button', { name: 'Delete' })).toBeNull()
})

test('O8 a Program only in bundledProgramIds offers neither Delete nor Reset to original', () => {
  const { container } = renderActionsPage()

  const row = programRow(container, 'bundled-only')
  expect(within(row).queryByRole('button', { name: 'Delete' })).toBeNull()
  expect(within(row).queryByRole('button', { name: 'Reset to original' })).toBeNull()
})

test('O8 clicking Delete reveals a Confirm button and does not call onDeleteProgram until Confirm is clicked', async () => {
  const user = userEvent.setup()
  const { container, onDeleteProgram } = renderActionsPage()

  const row = programRow(container, 'user-only')
  expect(within(row).queryByRole('button', { name: 'Confirm' })).toBeNull()

  await user.click(within(row).getByRole('button', { name: 'Delete' }))
  expect(onDeleteProgram).not.toHaveBeenCalled()
  const confirm = within(row).getByRole('button', { name: 'Confirm' })

  await user.click(confirm)
  expect(onDeleteProgram).toHaveBeenCalledWith('user-only')
})

test('O8 clicking Reset to original reveals a Confirm button and does not call onResetProgram until Confirm is clicked', async () => {
  const user = userEvent.setup()
  const { container, onResetProgram } = renderActionsPage()

  const row = programRow(container, 'bundled-and-user')
  expect(within(row).queryByRole('button', { name: 'Confirm' })).toBeNull()

  await user.click(within(row).getByRole('button', { name: 'Reset to original' }))
  expect(onResetProgram).not.toHaveBeenCalled()
  const confirm = within(row).getByRole('button', { name: 'Confirm' })

  await user.click(confirm)
  expect(onResetProgram).toHaveBeenCalledWith('bundled-and-user')
})

test('O8 the Program tab shows programMessage when set', () => {
  renderActionsPage({ programMessage: 'Could not delete the active program' })

  expect(screen.getByText('Could not delete the active program')).toBeVisible()
})

// --- fix-actions-placement: the Active program list (with New program) moves up under the ----
// page heading, above the active Program's Workout cards and muscle maps, and each Program's
// actions live on its own radio card instead of a separate list at the bottom.

test('fix-actions-placement the Active program list precedes the first Workout card in DOM order', () => {
  const { container } = renderActionsPage({
    programs: [assaf, starter],
    activeProgramId: 'assaf-ab-2026',
    catalog: catalogWithout(),
  })

  const activeProgramList = container.querySelector('.settings-group')
  if (!activeProgramList) throw new Error('expected a .settings-group Active program fieldset')
  const workoutA = screen.getByRole('heading', { name: 'Workout A' })

  expect(precedes(activeProgramList, workoutA)).toBe(true)
})

test('fix-actions-placement New program precedes the first Workout card in DOM order', () => {
  renderActionsPage({
    programs: [assaf, starter],
    activeProgramId: 'assaf-ab-2026',
    catalog: catalogWithout(),
  })

  const newProgram = screen.getByRole('button', { name: 'New program' })
  const workoutA = screen.getByRole('heading', { name: 'Workout A' })

  expect(precedes(newProgram, workoutA)).toBe(true)
})

test('fix-actions-placement no separate actions list remains at the bottom', () => {
  const { container } = renderActionsPage()

  expect(container.querySelector('.program-page-actions')).toBeNull()
})

test("fix-actions-placement each Program's radio card carries its own action buttons, not a separate row", () => {
  const { container } = renderActionsPage()

  const row = programRow(container, 'bundled-and-user')
  expect(within(row).getByRole('radio')).toBeInTheDocument()
  expect(within(row).getByRole('button', { name: 'Edit' })).toBeVisible()
  expect(within(row).getByRole('button', { name: 'Copy' })).toBeVisible()
  expect(within(row).getByRole('button', { name: 'Reset to original' })).toBeVisible()
})

test("fix-actions-placement a user-only Program's radio card carries Delete, not Reset to original", () => {
  const { container } = renderActionsPage()

  const row = programRow(container, 'user-only')
  expect(within(row).getByRole('radio')).toBeInTheDocument()
  expect(within(row).getByRole('button', { name: 'Delete' })).toBeVisible()
  expect(within(row).queryByRole('button', { name: 'Reset to original' })).toBeNull()
})

// --- E17-T7 O11: destructive actions wear btn-danger -------------------------------------------
const BUTTON_ROLES = ['btn-primary', 'btn-secondary', 'btn-quiet', 'btn-danger', 'tab', 'key', 'chip', 'cell', 'icon-btn']

/** The control-table roles a button wears (E17-T7 O10/O11). */
function rolesOf(button: HTMLElement): string[] {
  return [...button.classList].filter((name) => BUTTON_ROLES.includes(name))
}

test('E17 O11 Delete program wears btn-danger and no other role', () => {
  const { container } = renderActionsPage()

  const row = programRow(container, 'user-only')
  expect(rolesOf(within(row).getByRole('button', { name: 'Delete' }))).toEqual(['btn-danger'])
})

// --- Progress Dashboard S7a: the head, weekly sets by family, the workout tables and the ------
// Programs panel behind the head's overflow.

const realLibrary = new Map(
  (libraryJson as unknown as LibraryExercise[]).map((entry) => [entry.id, entry] as const),
)

function renderAssaf(overrides: Partial<import('./ProgramPage').ProgramPageProps> = {}) {
  const onEditProgram = vi.fn()
  const onProgramsOpenChange = vi.fn()
  const result = render(
    <ProgramPage
      programs={[assaf, starter]}
      activeProgramId="assaf-ab-2026"
      catalog={catalogWithout()}
      library={realLibrary}
      onChooseProgram={vi.fn()}
      onEditProgram={onEditProgram}
      onProgramsOpenChange={onProgramsOpenChange}
      {...overrides}
    />,
  )
  return { ...result, onEditProgram, onProgramsOpenChange }
}

test('S7a the head names the active program and its size: sessions a week, workouts and exercises', () => {
  renderAssaf()

  expect(screen.getByRole('heading', { name: 'A/B Split' })).toBeVisible()
  expect(screen.getByText('3× per week · 2 workouts · 14 exercises')).toBeVisible()
})

test('S7a Weekly sets, planned totals the week and splits it by muscle family, the counts adding up to the total', () => {
  // Hand-checked against src/data/library/exercises.json's first primary muscles, weighted
  // 3 sessions / 2 workouts = 1.5: push 19 sets (28.5), pull 14 (21), legs 7 (10.5), core 6 (9).
  // 28.5 and 10.5 round to 29 and 10, so the legend still adds up to 69.
  const { container } = renderAssaf()

  const card = container.querySelector('.program-page-volume') as HTMLElement
  expect(within(card).getByRole('heading', { name: 'Weekly sets, planned' })).toBeVisible()
  expect(within(card).getByText('69 sets')).toBeVisible()
  const legend = [...card.querySelectorAll('.program-page-legend-item')].map((item) =>
    (item.textContent ?? '').replace(/\s+/g, ' ').trim(),
  )
  expect(legend).toEqual(['Push29', 'Pull21', 'Legs10', 'Core9'])
  expect(within(card).getByRole('img')).toHaveAccessibleName('Push 29, Pull 21, Legs 10, Core 9 sets a week')
  const segments = [...card.querySelectorAll('.program-page-volume-segment')]
  expect(segments.map((segment) => segment.getAttribute('data-family'))).toEqual(['push', 'pull', 'legs', 'core'])
})

test("S7a each workout card's head reads its sets and estimated minutes", () => {
  renderAssaf()

  // workoutEstimate: 23 sets x 40 s plus every rest but the last -- A 3260 s, B 3170 s.
  expect(within(workoutCard('Workout A')).getByText('23 sets · ~54 min')).toBeVisible()
  expect(within(workoutCard('Workout B')).getByText('23 sets · ~53 min')).toBeVisible()
})

test("S7a each exercise row carries its muscle family's dot", () => {
  renderAssaf()

  const families = within(workoutCard('Workout B'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('.muscle-dot')?.getAttribute('data-family'))
  expect(families).toEqual(['core', 'pull', 'pull', 'pull', 'push', 'core', 'pull'])
})

test('S7a the kg column reads the load the next session opens on, a step up after a filled rep range', () => {
  const full: Session = {
    id: 'full-squat',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: NOW - 5000,
    finishedAt: NOW - 1000,
    entries: [1, 2, 3, 4].map((setIndex) => ({
      exerciseId: 'back-squat',
      setIndex,
      weightKg: 60,
      reps: 10,
      loggedAt: NOW - 5000 + setIndex,
    })),
  }
  renderAssaf({ sessions: [full], now: NOW })

  expect(lines(workoutCard('Workout A'))[0]).toBe('Back squat | 4 × 8–10 | 3:00 | 62.5')
})

test('S7a Edit in the head opens the editor on the active program', async () => {
  const user = userEvent.setup()
  const { onEditProgram } = renderAssaf()

  await user.click(screen.getByRole('button', { name: 'Edit A/B Split' }))

  expect(onEditProgram).toHaveBeenCalledWith('assaf-ab-2026')
})

test('S7a the Programs panel is closed at first: no program radios until the overflow opens it, Done closes it', async () => {
  const user = userEvent.setup()
  const { onProgramsOpenChange } = renderAssaf()

  expect(screen.queryByRole('radio')).toBeNull()
  expect(screen.queryByRole('button', { name: 'New program' })).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Programs' }))

  const panel = screen.getByRole('dialog', { name: 'Programs' })
  expect(within(panel).getByRole('radio', { name: 'A/B Split' })).toBeChecked()
  expect(within(panel).getByRole('button', { name: 'New program' })).toBeVisible()
  expect(onProgramsOpenChange).toHaveBeenLastCalledWith(true)

  await user.click(within(panel).getByRole('button', { name: 'Done' }))

  expect(screen.queryByRole('dialog', { name: 'Programs' })).toBeNull()
  expect(onProgramsOpenChange).toHaveBeenLastCalledWith(false)
})

test('S7a with the caller holding programsOpen, the panel follows it', () => {
  const { rerender } = render(
    <ProgramPage
      programs={[assaf, starter]}
      activeProgramId="assaf-ab-2026"
      catalog={catalogWithout()}
      library={new Map()}
      onChooseProgram={vi.fn()}
      programsOpen
    />,
  )
  expect(screen.getByRole('dialog', { name: 'Programs' })).toBeVisible()

  rerender(
    <ProgramPage
      programs={[assaf, starter]}
      activeProgramId="assaf-ab-2026"
      catalog={catalogWithout()}
      library={new Map()}
      onChooseProgram={vi.fn()}
      programsOpen={false}
    />,
  )
  expect(screen.queryByRole('dialog', { name: 'Programs' })).toBeNull()
})

test('S7a a message set while the panel is closed shows on the page itself', () => {
  renderAssaf({ programMessage: 'Finish the workout in progress first' })

  expect(screen.getByRole('status')).toHaveTextContent('Finish the workout in progress first')
})

test('S7a a hidden workout of the active program gets no card', () => {
  const withRetired: Program = {
    ...assaf,
    workouts: [...assaf.workouts, { ...assaf.workouts[0], id: 'retired', name: 'Retired', hidden: true }],
  }
  renderAssaf({ programs: [withRetired, starter] })

  expect(screen.queryByRole('heading', { name: 'Retired' })).toBeNull()
  expect(screen.getByText('3× per week · 2 workouts · 14 exercises')).toBeVisible()
})
