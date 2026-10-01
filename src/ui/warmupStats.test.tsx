import { cleanup, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ExerciseList } from './ExerciseList'
import { SessionSummary } from './SessionSummary'
import { Stats } from './Stats'
import type { Exercise, LibraryExercise, Program, Session, SetEntry } from '../types'

// E14 O7, at the screens: warm-up Sets logged heavier than the Exercise's record change nothing
// Stats, the exercise list or the Session summary shows. Fixtures are worked out by hand:
//
//   Bench press, working: 5 x 60 kg = 300 kg volume, heaviest set 60 kg.
//   Bench press, warm-ups: 10 x 100 kg each, heavier than the record.

const BASE = 1_700_000_000_000
const DAY = 24 * 60 * 60 * 1000

const bench: Exercise = {
  id: 'bench',
  name: 'Bench press',
  weightStep: 2.5,
  startWeight: 20,
  bodyweight: false,
  invertProgress: false,
  libraryId: 'Lib_Bench',
}
const resolve = (id: string): Exercise | undefined => (id === 'bench' ? bench : undefined)

const workout = { id: 'w', name: 'Push', exercises: [{ exerciseId: 'bench', sets: 3, repRange: [5, 8] as [number, number], restSeconds: 90 }] }
const program: Program = { id: 'p', name: 'P', units: 'kg', workouts: [workout], sessionsPerWeek: 3 }

function working(setIndex: number, at: number): SetEntry {
  return { exerciseId: 'bench', setIndex, weightKg: 60, reps: 5, loggedAt: at }
}
function warmup(setIndex: number, at: number): SetEntry {
  return { exerciseId: 'bench', setIndex, weightKg: 100, reps: 10, loggedAt: at, kind: 'warmup' }
}

function finished(entries: SetEntry[]): Session {
  return { id: 's1', programId: 'p', workoutId: 'w', startedAt: BASE, finishedAt: BASE + 3_600_000, entries }
}

const WORKING = [working(1, BASE + 10)]
const WARMED = [warmup(1, BASE + 5), warmup(2, BASE + 6), warmup(3, BASE + 7), warmup(4, BASE + 8), ...WORKING]

function renderStats(entries: SetEntry[]): HTMLElement {
  const { container } = render(<Stats sessions={[finished(entries)]} resolve={resolve} programs={[program]} />)
  return container
}

function statsFacts(container: HTMLElement) {
  const bar = container.querySelector('.bar-chart-bar')
  return {
    volume: bar?.getAttribute('data-value'),
    records: Array.from(container.querySelectorAll('.stats-record')).map((li) => li.textContent),
    progress: screen.queryByRole('progressbar')?.getAttribute('aria-valuenow') ?? null,
  }
}

test('O7 Stats shows the same volume, records and progression with warm-up Sets heavier than the record as without them', () => {
  const without = statsFacts(renderStats(WORKING))
  cleanup()
  const withWarmups = statsFacts(renderStats(WARMED))

  expect(without.volume).toBe('300')
  expect(without.records.join(' ')).toContain('60 kg')
  expect(withWarmups).toEqual(without)
})

test('O7 the exercise list shows the same volume against the baseline with warm-up Sets logged as without them', () => {
  const earlier = { ...finished([working(1, BASE), working(2, BASE + 1)]), id: 'earlier', startedAt: BASE - DAY, finishedAt: BASE - DAY }
  // Baseline 'last' = 2 x 5 x 60 = 600 kg. Today: 300 kg of working volume = 50%.
  const today: Session = { ...finished(WARMED), id: 'today', startedAt: BASE, finishedAt: null }

  render(
    <ExerciseList
      program={program}
      workout={workout}
      resolve={resolve}
      session={today}
      onOpenSet={vi.fn()}
      onFinish={vi.fn()}
      lastSwaps={{}}
      onUndoSwap={vi.fn()}
      onApplySwap={vi.fn()}
      lastEntries={new Map([['bench', earlier.entries]])}
      sessions={[earlier]}
      volumeBaseline={{ period: 'last' }}
    />,
  )

  expect(screen.getByText('Volume vs last workout: 50%')).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
})

const LIBRARY = new Map<string, LibraryExercise>([
  [
    'Lib_Bench',
    {
      id: 'Lib_Bench',
      name: 'Lib_Bench',
      force: null,
      level: 'beginner',
      mechanic: null,
      equipment: null,
      primaryMuscles: ['chest'],
      secondaryMuscles: [],
      instructions: [],
      category: 'strength',
      images: [],
    },
  ],
])

test('O7 the Session summary shows the same volume and body map with warm-up Sets logged as without them', () => {
  render(<SessionSummary session={finished(WARMED)} resolve={resolve} library={LIBRARY} onClose={vi.fn()} />)

  const dialog = screen.getByRole('dialog', { name: 'Session summary' })
  expect(within(dialog).getByText('300 kg')).toBeInTheDocument()
  const chest = [...dialog.querySelectorAll('[data-region="chest"]')]
  expect(chest.length).toBeGreaterThan(0)
  // One working set is band 1 on the session scale; five counted sets would be band 3.
  for (const shape of chest) expect(shape).toHaveAttribute('data-band', '1')
})
