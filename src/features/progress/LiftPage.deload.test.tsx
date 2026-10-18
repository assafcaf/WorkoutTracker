// E21-T10 [O22]: the stall's deload suggestion and the two-step and hold texts on the lift page.
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { Session } from '../../types'
import { LiftPageView } from './LiftPage'

process.env.TZ = 'Asia/Jerusalem'

const catalog = loadCatalog()
const resolve = (id: string) => catalog.get(id)
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')
const NOW = new Date(2026, 9, 15, 18, 5).getTime()

function view(exerciseId: string, sessions: Session[]) {
  return render(
    <LiftPageView exerciseId={exerciseId} sessions={sessions} program={program} resolve={resolve} now={NOW} />,
  )
}

/** One finished Workout A Session of Back squat: 4 x 10 at `kg`, every Set at `rir`. */
function squat(kg: number, rir: 0 | 2): Session {
  const startedAt = new Date(2026, 9, 14, 10, 0).getTime()
  return {
    id: 's1',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: startedAt + 3_000_000,
    updatedAt: startedAt + 3_000_000,
    entries: [1, 2, 3, 4].map((setIndex) => ({
      exerciseId: 'back-squat',
      setIndex,
      weightKg: kg,
      reps: 10,
      rir,
      loggedAt: startedAt + setIndex * 60_000,
    })),
  } as Session
}

it('O22 a stalled loaded lift reads the deload suggestion under its stall bracket', () => {
  view('db-bench-press', sessionsJson as unknown as Session[])
  expect(screen.getByText('■ Stalled')).toBeVisible()
  expect(screen.getByText(/^Try a deload: .+ for one session$/)).toBeVisible()
})

it('O22 a ready lift after an easy full bar reads the two-step text', () => {
  view('back-squat', [squat(62.5, 2)])
  expect(screen.getByText('Try 67.5 kg next · 2 steps')).toBeVisible()
})

it('O22 a held lift reads the hold text', () => {
  view('back-squat', [squat(60, 0)])
  expect(screen.getByText('Stay at 60 kg: every set at RIR 0')).toBeVisible()
})
