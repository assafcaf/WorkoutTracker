import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createServices } from '../../services'
import { db } from '../../storage/db'
import type { Exercise, Program, Session, SetEntry } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { LiftsScreen, LiftsView } from './LiftsScreen'

const NOW = new Date(2026, 9, 14, 12)
const day = (month: number, date: number): number => new Date(2026, month, date, 9).getTime()

const squat: Exercise = { id: 'back-squat', name: 'Back squat', weightStep: 2.5, startWeight: 40, bodyweight: false, libraryId: 'Barbell_Squat' }
const bench: Exercise = { id: 'db-bench', name: 'DB bench press', weightStep: 2, startWeight: 10, bodyweight: false, libraryId: 'DB_Bench' }
const pushUps: Exercise = { id: 'push-ups', name: 'Push-ups', weightStep: 5, startWeight: null, bodyweight: true, libraryId: 'Pushups' }
const EXERCISES = new Map([squat, bench, pushUps].map((exercise) => [exercise.id, exercise] as const))
const resolve = (id: string): Exercise | undefined => EXERCISES.get(id)

const program: Program = {
  id: 'p',
  name: 'P',
  units: 'kg',
  sessionsPerWeek: 3,
  workouts: [
    { id: 'a', name: 'Workout A', exercises: [
      { exerciseId: 'back-squat', sets: 2, repRange: [6, 8], restSeconds: 120 },
      { exerciseId: 'db-bench', sets: 2, repRange: [8, 10], restSeconds: 90 },
    ] },
    { id: 'b', name: 'Workout B', exercises: [{ exerciseId: 'push-ups', sets: 3, repRange: [10, 15], restSeconds: 90 }] },
  ],
}

function sets(exerciseId: string, weightKg: number | null, reps: number[]): SetEntry[] {
  return reps.map((count, setIndex) => ({ exerciseId, setIndex, weightKg, reps: count, loggedAt: setIndex }))
}

function session(id: string, workoutId: string, startedAt: number, entries: SetEntry[]): Session {
  return { id, programId: 'p', workoutId, startedAt, finishedAt: startedAt + 3600_000, entries }
}

const SESSIONS: Session[] = [
  session('s1', 'a', day(8, 21), [...sets('back-squat', 50, [10, 10]), ...sets('db-bench', 16, [8, 8])]),
  session('s2', 'a', day(8, 30), [...sets('back-squat', 55, [12, 9])]),
  session('s3', 'b', day(9, 12), sets('push-ups', null, [15, 14, 12])),
  session('s4', 'a', day(9, 13), [...sets('back-squat', 60, [8, 8])]),
]

const SEARCHABLE = [
  { libraryId: 'Barbell_Squat', name: 'Back squat', muscle: 'quadriceps' },
  { libraryId: 'Front_Squat', name: 'Front Squat', muscle: 'quadriceps' },
  { libraryId: 'DB_Bench', name: 'DB bench press', muscle: 'chest' },
]

function renderView(sessions = SESSIONS, onOpenExercise = vi.fn()) {
  render(
    <LiftsView sessions={sessions} programs={[program]} resolve={resolve} searchable={SEARCHABLE} onOpenExercise={onOpenExercise} now={NOW} />,
  )
  return { onOpenExercise }
}

describe('LiftsView', () => {
  test('the search field counts every exercise it can find', () => {
    renderView()
    expect(screen.getByRole('searchbox', { name: 'Search exercises' })).toHaveAttribute('placeholder', 'Search 3 exercises')
  })

  test('chips list the trainee\'s lifts in program order with the first one chosen', () => {
    renderView()
    const chips = within(screen.getByRole('group', { name: 'Your lifts' })).getAllByRole('button')
    expect(chips.map((chip) => chip.textContent)).toEqual(['Back squat', 'DB bench press', 'Push-ups'])
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Back squat' })).toBeInTheDocument()
  })

  test('the lift card shows the latest estimated 1RM and its change since the first session in range', () => {
    renderView()
    const card = screen.getByRole('region', { name: 'Back squat' })
    // 60 x 8 -> 76.0; 55 x 12 -> 77.0; 50 x 10 -> 66.7 (Epley). 1M from 14 Oct covers 14 Sep on.
    expect(within(card).getByText('76.0 kg')).toBeInTheDocument()
    expect(within(card).getByText('+9.3 kg since 21 Sep')).toBeInTheDocument()
    expect(within(card).getByText('Estimated 1RM')).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: 'Back squat estimated 1rm' })).toBeInTheDocument()
  })

  test('the chart marks the sessions that set a record', () => {
    renderView()
    const circles = [...screen.getByRole('img', { name: 'Back squat estimated 1rm' }).querySelectorAll('circle')]
    expect(circles.map((circle) => circle.classList.contains('line-chart-record'))).toEqual([true, true, false])
  })

  test('the range control narrows the chart to the window chosen', async () => {
    const user = userEvent.setup()
    renderView([
      session('old', 'a', day(5, 1), sets('back-squat', 40, [8])),
      ...SESSIONS,
    ])
    const chart = (): Element => screen.getByRole('img', { name: 'Back squat estimated 1rm' })
    expect(chart().querySelectorAll('circle')).toHaveLength(3)
    await user.click(screen.getByRole('radio', { name: '1Y' }))
    expect(chart().querySelectorAll('circle')).toHaveLength(4)
  })

  test('a lift not trained in the range says so instead of drawing an empty chart', async () => {
    renderView([session('old', 'a', day(5, 1), sets('back-squat', 40, [8]))])
    expect(screen.getByText('No Back squat sessions in the last month.')).toBeInTheDocument()
  })

  test('the Next row says what to lift next once the top of the range is hit', () => {
    renderView()
    expect(screen.getByText('Next: 62.5 kg')).toBeInTheDocument()
    expect(screen.getByText('top of range hit')).toBeInTheDocument()
  })

  test('the Next row says to stay at the weight, and how many reps were done, when short of the top', async () => {
    const user = userEvent.setup()
    renderView([...SESSIONS, session('s5', 'a', day(9, 14), sets('db-bench', 18, [9, 8]))])
    await user.click(screen.getByRole('button', { name: 'DB bench press' }))
    expect(screen.getByText('Next: stay at 18 kg')).toBeInTheDocument()
    expect(screen.getByText('17 of 20 reps')).toBeInTheDocument()
  })

  test('the records table lists heaviest set, best estimated 1RM and most reps in a set with dates', () => {
    renderView()
    const rows = within(screen.getByRole('table')).getAllByRole('row').map((row) => row.textContent)
    expect(rows).toEqual([
      'RecordBestDate',
      'Heaviest set60 kg × 813 Oct',
      'Best estimated 1RM77 kg30 Sep',
      'Most reps in a set55 kg × 1230 Sep',
    ])
  })

  test('choosing a bodyweight lift charts its reps and tabulates its own records', async () => {
    const user = userEvent.setup()
    renderView()
    await user.click(screen.getByRole('button', { name: 'Push-ups' }))
    expect(screen.getByText('41 reps')).toBeInTheDocument()
    expect(screen.getByText('Reps per session')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('15 reps')).toBeInTheDocument()
  })

  test('a lift that has not moved says no change rather than +0', () => {
    renderView([
      session('p1', 'b', day(9, 1), sets('push-ups', null, [12, 12])),
      session('p2', 'b', day(9, 8), sets('push-ups', null, [12, 12])),
    ])
    expect(screen.getByText('No change since 1 Oct')).toBeInTheDocument()
  })

  test('the bodyweight note names the newest session with bodyweight reps', () => {
    renderView()
    expect(screen.getByText('Workout B: 41 bodyweight reps', { selector: '.lifts-note' })).toBeInTheDocument()
  })

  test('the volume per session chart stays one tap away', () => {
    renderView()
    expect(screen.getByText('Volume per session', { selector: 'summary' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Volume per session' })).toBeInTheDocument()
  })

  test('searching lists matching exercises and opens the one tapped', async () => {
    const user = userEvent.setup()
    const { onOpenExercise } = renderView()
    await user.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'squat')
    const results = within(screen.getByRole('list', { name: 'Search results' })).getAllByRole('button')
    expect(results.map((result) => result.textContent)).toEqual(['Back squatquadriceps', 'Front Squatquadriceps'])
    expect(screen.queryByRole('group', { name: 'Your lifts' })).toBeNull()
    await user.click(results[1])
    expect(onOpenExercise).toHaveBeenCalledWith('Front_Squat')
  })

  test('a search with no match says so', async () => {
    const user = userEvent.setup()
    renderView()
    await user.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'zzz')
    expect(screen.getByText('No exercise matches "zzz".')).toBeInTheDocument()
  })

  test('with nothing logged it says what fills the tab', () => {
    renderView([])
    expect(screen.getByText(/No sets yet/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Your lifts' })).toBeNull()
  })
})

describe('LiftsScreen', () => {
  beforeEach(async () => {
    await db.open()
    await db.sessions.clear()
    await db.settings.clear()
  })

  test('loads the logged sessions through services and opens a searched exercise\'s detail', async () => {
    const services = createServices({ now: () => Date.now(), storageAvailable: true })
    const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
    await services.sessions.logSet(started.id, { exerciseId: 'back-squat', setIndex: 0, weightKg: 60, reps: 8, loggedAt: Date.now() })
    await services.sessions.finish(started.id)
    const user = userEvent.setup()

    render(
      <ServicesProvider services={services}>
        <LiftsScreen />
      </ServicesProvider>,
    )

    const chips = await screen.findByRole('group', { name: 'Your lifts' }, { timeout: 2000 })
    expect(within(chips).getAllByRole('button')).toHaveLength(1)
    await user.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'barbell squat')
    const results = within(screen.getByRole('list', { name: 'Search results' })).getAllByRole('button')
    await user.click(results[0])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument())
  })
})
