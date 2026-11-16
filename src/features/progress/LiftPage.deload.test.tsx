// E21-T10 [O22], v6 §6.1: the stall's deload, the two-step and the hold actions on the lift page,
// each the lift's one `liftStatus` action.
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

/** One finished Workout A Session of Back squat on 10 + `day` Oct: 4 × 10 at `kg`, every Set at `rir`. */
function squat(kg: number, rir: 0 | 1 | 2, day = 4): Session {
  const startedAt = new Date(2026, 9, 10 + day, 10, 0).getTime()
  return {
    id: `s${day}`,
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

/** Three earlier Sessions at 55 kg, so the status has its 4 Sessions. */
const before = [1, 2, 3].map((day) => ({ ...squat(55, 1, day), entries: squat(55, 1, day).entries.map((e) => ({ ...e, reps: 8 })) }))

it('O22 a stalled loaded lift reads the deload suggestion under its stall bracket', () => {
  // v6 (V6-04): with no deload inside the stall, DB bench press is offered one deload.
  view('db-bench-press', (sessionsJson as unknown as Session[]).filter((s) => !s.deload))
  expect(screen.getByText('= Stalled')).toBeVisible()
  expect(screen.getByText('Deload once: 12 kg × 10, then back to 13 kg.')).toBeVisible()
})

it('O22 a ready lift after an easy full bar reads the two-step text', () => {
  view('back-squat', [...before, squat(62.5, 2)])
  expect(screen.getByText('Next time: 67.5 kg.')).toBeVisible()
})

it('O22 a held lift reads the hold text', () => {
  view('back-squat', [...before, squat(60, 0)])
  expect(screen.getByText('= Hold')).toBeVisible()
  expect(screen.getByText('Next time: 60 kg again, with a rep to spare.')).toBeVisible()
})
