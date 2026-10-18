import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SessionSummary } from './SessionSummary'
import type { BodyLog, Exercise, LibraryExercise, Session } from '../types'

// E22-T11 O16: the summary's volume counts Bodyweight Sets at the Session's bodyweight and its
// note names it. Pull-up BW+10 x 8 at 80 kg = 720 kg; Bench 50 kg x 10 = 500 kg.

const STARTED = new Date(2026, 9, 12, 10).getTime()

const library = new Map<string, LibraryExercise>()

const CATALOG = new Map<string, Exercise>([
  ['pullup', { id: 'pullup', name: 'Pull-up', weightStep: 2.5, startWeight: 0, bodyweight: true, libraryId: 'L1' }],
  ['bench', { id: 'bench', name: 'Bench press', weightStep: 2.5, startWeight: 20, bodyweight: false, libraryId: 'L2' }],
])
const resolve = (id: string): Exercise | undefined => CATALOG.get(id)

const SESSION: Session = {
  id: 's1',
  programId: 'p',
  workoutId: 'w',
  startedAt: STARTED,
  finishedAt: STARTED + 3_600_000,
  entries: [
    { exerciseId: 'bench', setIndex: 1, weightKg: 50, reps: 10, loggedAt: STARTED + 1 },
    { exerciseId: 'pullup', setIndex: 1, weightKg: null, loadKg: 10, reps: 8, loggedAt: STARTED + 2 },
  ],
}

function volumeText(log?: BodyLog): string {
  render(<SessionSummary session={SESSION} resolve={resolve} library={library} onClose={vi.fn()} bodyLog={log} />)
  return screen.getByRole('dialog', { name: 'Session summary' }).querySelector('[data-kpi="volume"]')?.textContent ?? ''
}

test('O16 a bodyweight on or before the Session counts Bodyweight Sets and the note names it', () => {
  const text = volumeText([{ day: '2026-10-01', weightKg: 80 }])
  expect(text).toContain('1,220 kg')
  expect(text).toContain('· bodyweight 80 kg (1 Oct)')
  expect(text).not.toContain('bodyweight reps')
})

test('O16 with no bodyweight on or before the Session the note and figure are as before', () => {
  const text = volumeText([{ day: '2026-10-20', weightKg: 80 }])
  expect(text).toContain('500 kg')
  expect(text).toContain('· 8 bodyweight reps')
})
