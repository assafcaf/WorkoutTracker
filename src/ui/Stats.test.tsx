import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { Stats } from './Stats'
import type { Exercise, Program, Session, SetEntry } from '../types'

// Stats loads nothing itself: it is handed the finished sessions, newest first, the way
// `listSessions()` returns them. With none handed over, each of its two views must say what it
// needs instead of drawing an empty chart. The path to this screen through the History tab is
// proven in src/App.test.tsx.

const workoutA = { id: 'workout-a', name: 'Workout A', exercises: [] }

const assaf: Program = {
  id: 'assaf-ab-2026',
  name: 'Assaf A/B 2026',
  units: 'kg',
  workouts: [workoutA],
  sessionsPerWeek: 3,
}

/** Nothing is logged, so nothing is ever looked up; answering undefined mirrors an unknown id. */
function resolveNothing(_id: string): Exercise | undefined {
  return undefined
}

function renderEmptyStats(): void {
  render(<Stats sessions={[]} resolve={resolveNothing} programs={[assaf]} />)
}

function exerciseProgressSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Exercise progress' })
}

function volumeSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Volume' })
}

function textOf(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

test('O10 Stats renders exactly the Exercise progress and Volume sections, in that order', () => {
  renderEmptyStats()

  const labels = Array.from(document.body.querySelectorAll('section')).map((section) =>
    section.getAttribute('aria-label'),
  )
  expect(labels).toEqual(['Exercise progress', 'Volume'])
})

test('O10 with no sessions the Exercise progress section says a set has to be logged before an exercise can be chosen', () => {
  renderEmptyStats()

  const text = textOf(exerciseProgressSection())
  expect(text).toMatch(/\blog/i)
  expect(text).toMatch(/\bset\b/i)
  expect(text).toMatch(/\bexercise\b/i)
})

test('O10 with no sessions the Volume section says a session has to be finished before a bar can be drawn', () => {
  renderEmptyStats()

  const text = textOf(volumeSection())
  expect(text).toMatch(/\bsession\b/i)
  expect(text).toMatch(/\bfinish/i)
})

test('O10 with no sessions the Exercise progress section draws no chart', () => {
  renderEmptyStats()

  expect(exerciseProgressSection().querySelector('svg')).toBeNull()
})

test('O10 with no sessions the Volume section draws no chart', () => {
  renderEmptyStats()

  expect(volumeSection().querySelector('svg')).toBeNull()
})

// O13: one bar per session, in date order, labelled by workout ---------------------------------

const workoutB = { id: 'workout-b', name: 'Workout B', exercises: [] }

const twoWorkoutProgram: Program = {
  id: 'assaf-ab-2026',
  name: 'Assaf A/B 2026',
  units: 'kg',
  workouts: [workoutA, workoutB],
  sessionsPerWeek: 3,
}

const squat: Exercise = {
  id: 'back-squat',
  name: 'Back Squat',
  weightStep: 2.5,
  startWeight: 20,
  bodyweight: false,
  invertProgress: false,
  libraryId: 'back-squat',
}

const pushup: Exercise = {
  id: 'push-up',
  name: 'Push Up',
  weightStep: 0,
  startWeight: null,
  bodyweight: true,
  invertProgress: false,
  libraryId: 'push-up',
}

function resolveTwoWorkouts(id: string): Exercise | undefined {
  return { [squat.id]: squat, [pushup.id]: pushup }[id]
}

const earlierSession = {
  id: 'session-earlier',
  programId: 'assaf-ab-2026',
  workoutId: 'workout-a',
  startedAt: 100,
  finishedAt: 200,
  entries: [{ exerciseId: 'back-squat', setIndex: 0, weightKg: 60, reps: 5, loggedAt: 150 }],
}

const laterSession = {
  id: 'session-later',
  programId: 'assaf-ab-2026',
  workoutId: 'workout-b',
  startedAt: 300,
  finishedAt: 400,
  entries: [{ exerciseId: 'push-up', setIndex: 0, weightKg: null, reps: 20, loggedAt: 350 }],
}

function renderTwoSessionStats(): void {
  render(
    <Stats
      sessions={[laterSession, earlierSession]}
      resolve={resolveTwoWorkouts}
      programs={[twoWorkoutProgram]}
    />,
  )
}

test('O13 the Volume view draws one bar per session, in date order, labelled with its workout', () => {
  renderTwoSessionStats()

  const rects = volumeSection().querySelectorAll('rect')
  expect(rects.length).toBe(2)
  expect([...rects].map((rect) => rect.getAttribute('data-at'))).toEqual(['100', '300'])
  expect([...rects].map((rect) => rect.getAttribute('data-label'))).toEqual(['Workout A', 'Workout B'])
})

test('O13 a session with zero kg still gets a bar, and its bodyweightReps is shown next to the chart', () => {
  renderTwoSessionStats()

  const rects = volumeSection().querySelectorAll('rect')
  const pushDayRect = [...rects].find((rect) => rect.getAttribute('data-label') === 'Workout B')
  expect(pushDayRect).not.toBeUndefined()
  expect(pushDayRect).toHaveAttribute('data-value', '0')

  const text = textOf(volumeSection())
  expect(text).toMatch(/20/)
})

// O11: pick an exercise, and its progression bar, series chart and records show together ------

// Ids deliberately sort differently from names, so a picker sorted by id (or by first sighting)
// is caught: by name it is Back Squat, Bench Press, Dumbbell Press, Farmer Carry.
const o11Squat: Exercise = {
  id: 'squat',
  name: 'Back Squat',
  weightStep: 2.5,
  startWeight: 20,
  bodyweight: false,
  invertProgress: false,
  libraryId: 'back-squat',
}

const o11Bench: Exercise = {
  id: 'bench-press',
  name: 'Bench Press',
  weightStep: 2.5,
  startWeight: 20,
  bodyweight: false,
  invertProgress: false,
  libraryId: 'bench-press',
}

/** A library exercise swapped in for Bench Press mid-session; no program plans it. */
const o11DumbbellPress: Exercise = {
  id: 'db-press',
  name: 'Dumbbell Press',
  weightStep: 2,
  startWeight: 10,
  bodyweight: false,
  invertProgress: false,
  libraryId: 'dumbbell-bench-press',
}

/** Logged, but planned by no program and never swapped in for a plan. */
const o11FarmerCarry: Exercise = {
  id: 'a-carry',
  name: 'Farmer Carry',
  weightStep: 2,
  startWeight: 20,
  bodyweight: false,
  invertProgress: false,
  libraryId: 'farmers-walk',
}

/** `retired-lift` is logged but no longer resolves, so it is not offered. */
function resolveO11(id: string): Exercise | undefined {
  return {
    [o11Squat.id]: o11Squat,
    [o11Bench.id]: o11Bench,
    [o11DumbbellPress.id]: o11DumbbellPress,
    [o11FarmerCarry.id]: o11FarmerCarry,
  }[id]
}

const o11Program: Program = {
  id: 'assaf-ab-2026',
  name: 'Assaf A/B 2026',
  units: 'kg',
  workouts: [
    {
      id: 'workout-a',
      name: 'Workout A',
      exercises: [
        { exerciseId: 'squat', sets: 3, repRange: [5, 8], restSeconds: 120 },
        { exerciseId: 'bench-press', sets: 3, repRange: [5, 8], restSeconds: 120 },
      ],
    },
  ],
  sessionsPerWeek: 3,
}

/** A later program also plans Bench Press, differently: the first plan in `programs` wins. */
const o11OtherProgram: Program = {
  id: 'other-2026',
  name: 'Other 2026',
  units: 'kg',
  workouts: [
    {
      id: 'other-a',
      name: 'Other A',
      exercises: [{ exerciseId: 'bench-press', sets: 2, repRange: [3, 5], restSeconds: 90 }],
    },
  ],
  sessionsPerWeek: 2,
}

function set(exerciseId: string, setIndex: number, weightKg: number | null, reps: number): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt: 0 }
}

// Newest first, as listSessions() returns them.
const o11Newest: Session = {
  id: 'o11-s3',
  programId: 'assaf-ab-2026',
  workoutId: 'workout-a',
  startedAt: 500,
  finishedAt: 590,
  entries: [
    set('a-carry', 0, 40, 10),
    set('bench-press', 1, 60, 8),
    set('bench-press', 0, 60, 8),
    set('bench-press', 2, 60, 7),
    set('squat', 0, 100, 8),
    set('squat', 1, 100, 8),
    set('squat', 2, 100, 8),
  ],
}

const o11Swapped: Session = {
  id: 'o11-s2',
  programId: 'assaf-ab-2026',
  workoutId: 'workout-a',
  startedAt: 300,
  finishedAt: 390,
  swaps: { 'bench-press': 'db-press' },
  entries: [
    set('db-press', 0, 30, 8),
    set('db-press', 1, 30, 8),
    set('db-press', 2, 30, 8),
    set('squat', 0, 95, 8),
  ],
}

const o11Oldest: Session = {
  id: 'o11-s1',
  programId: 'assaf-ab-2026',
  workoutId: 'workout-a',
  startedAt: 100,
  finishedAt: 190,
  entries: [set('retired-lift', 0, 20, 5), set('bench-press', 0, 50, 6), set('squat', 0, 90, 8)],
}

function renderO11Stats(): void {
  render(
    <Stats
      sessions={[o11Newest, o11Swapped, o11Oldest]}
      resolve={resolveO11}
      programs={[o11Program, o11OtherProgram]}
    />,
  )
}

function exercisePicker(): HTMLElement {
  return within(exerciseProgressSection()).getByRole('combobox', { name: 'Exercise' })
}

async function chooseExercise(name: string): Promise<void> {
  const user = userEvent.setup()
  await user.selectOptions(exercisePicker(), name)
}

function progressionBar(): HTMLElement | null {
  return within(exerciseProgressSection()).queryByRole('progressbar')
}

function chartPoints(): Array<{ at: string | null; value: number }> {
  const svg = exerciseProgressSection().querySelector('svg')
  expect(svg, 'the exercise series chart').not.toBeNull()
  return [...(svg as SVGElement).querySelectorAll('circle')].map((circle) => ({
    at: circle.getAttribute('data-at'),
    value: Number(circle.getAttribute('data-value')),
  }))
}

function recordItem(label: string): HTMLElement | undefined {
  return within(exerciseProgressSection())
    .queryAllByRole('listitem')
    .find((item) => textOf(item).includes(label))
}

test('O11 the Exercise picker lists every logged exercise that resolves, sorted by name', () => {
  renderO11Stats()

  const options = within(exercisePicker()).getAllByRole('option').map((option) => textOf(option))
  expect(options).toEqual(['Back Squat', 'Bench Press', 'Dumbbell Press', 'Farmer Carry'])
})

test('O11 the first exercise by name is chosen on mount, and its progression bar and chart are shown', () => {
  renderO11Stats()

  const picked = within(exercisePicker())
    .getAllByRole('option')
    .find((option) => (option as HTMLOptionElement).selected)
  expect(picked && textOf(picked)).toBe('Back Squat')

  const bar = progressionBar()
  expect(bar).not.toBeNull()
  // Squat's newest session: three sets of 8 at 100 kg against a top of 8 -> 24 of 24.
  expect(bar).toHaveAttribute('aria-valuenow', '24')
  expect(bar).toHaveAttribute('aria-valuemax', '24')
  expect(chartPoints().map((point) => point.at)).toEqual(['100', '300', '500'])
})

test('O11 choosing an exercise that is not the default shows its progression bar, series chart and records together', async () => {
  renderO11Stats()

  await chooseExercise('Bench Press')

  // Progression from Bench's newest session (60x8, 60x8, 60x7) against the first program's
  // plan, top of range 8: 23 of 24. (The older session would read 6 of 8; the other program's
  // plan, top 5, would read 15 of 15.)
  const bar = progressionBar()
  expect(bar).not.toBeNull()
  expect(bar).toHaveAttribute('aria-valuenow', '23')
  expect(bar).toHaveAttribute('aria-valuemax', '24')

  // Series: best estimated 1RM per session holding Bench -- 50x6 -> 60 and 60x8 -> 76.
  const points = chartPoints()
  expect(points.map((point) => point.at)).toEqual(['100', '500'])
  expect(points[0].value).toBeCloseTo(60, 6)
  expect(points[1].value).toBeCloseTo(76, 6)

  // Records: Bench's, not Squat's (whose heaviest set is 100).
  const heaviest = recordItem('Heaviest set')
  expect(heaviest, 'the Heaviest set record').not.toBeUndefined()
  expect(textOf(heaviest as HTMLElement)).toMatch(/\b60\b/)
  expect(textOf(heaviest as HTMLElement)).not.toMatch(/\b100\b/)
  expect(recordItem('Best estimated 1RM')).not.toBeUndefined()
  const mostReps = recordItem('Most reps at the heaviest weight')
  expect(mostReps, 'the Most reps at the heaviest weight record').not.toBeUndefined()
  expect(textOf(mostReps as HTMLElement)).toMatch(/\b8\b/)
})

test('O11 a swapped-in exercise takes the plan it was swapped in for, so its bar and records are shown', async () => {
  renderO11Stats()

  await chooseExercise('Dumbbell Press')

  // Three sets of 8 at 30 kg against Bench's plan, top of range 8: 24 of 24.
  const bar = progressionBar()
  expect(bar).not.toBeNull()
  expect(bar).toHaveAttribute('aria-valuenow', '24')
  expect(bar).toHaveAttribute('aria-valuemax', '24')
  expect(chartPoints().map((point) => point.at)).toEqual(['300'])

  const heaviest = recordItem('Heaviest set')
  expect(heaviest, 'the Heaviest set record').not.toBeUndefined()
  expect(textOf(heaviest as HTMLElement)).toMatch(/\b30\b/)
})

test('O11 an exercise with no plan shows its series chart but no progression bar and no records', async () => {
  renderO11Stats()

  await chooseExercise('Farmer Carry')

  expect(chartPoints().map((point) => point.at)).toEqual(['500'])
  expect(progressionBar()).toBeNull()
  expect(recordItem('Heaviest set')).toBeUndefined()
  expect(within(exerciseProgressSection()).queryAllByRole('listitem')).toEqual([])
})
