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

test('O1 the active program leads with its name, then Workout A, then Workout B', () => {
  renderProgramPage()

  const program = screen.getByRole('heading', { name: 'A/B Split' })
  const workoutA = screen.getByRole('heading', { name: 'Workout A' })
  const workoutB = screen.getByRole('heading', { name: 'Workout B' })

  expect([precedes(program, workoutA), precedes(workoutA, workoutB)]).toEqual([true, true])
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

  // Scoped to the workout card (not the whole page): E5-T19 adds a week-scale prescribed body
  // map to the same page, whose quadriceps band differs from this per-workout, session-scale
  // one, so a page-wide query would be over-broad. There is exactly one workout card here.
  const workoutCard = container.querySelector('.workout-card')
  if (!workoutCard) throw new Error('expected a .workout-card element')
  const quadriceps = [...workoutCard.querySelectorAll('[data-region="quadriceps"]')]
  expect(quadriceps.length, 'quadriceps must be drawn at least once').toBeGreaterThan(0)
  for (const element of quadriceps) {
    expect(element).toHaveAttribute('data-band', '3')
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
  invertProgress: false,
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
      invertProgress: false,
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
  invertProgress: false,
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

  const cards = [...container.querySelectorAll('.workout-card')]
  expect(cards.length, 'the active program must render at least one workout card').toBeGreaterThan(0)
  for (const card of cards) {
    expect(card.querySelectorAll('.body-map-legend[data-scale="session"]')).toHaveLength(1)
  }
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
