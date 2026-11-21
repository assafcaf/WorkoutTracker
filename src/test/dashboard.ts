// Test helpers for starting a workout. DX-01: the app opens on Train, which offers the one
// Workout due ("Start Workout A", or "Start Workout B anyway" on a rest day) and nothing else:
// there are no arrows to step to another. A test that needs a Workout other than the first makes
// it due before rendering, with `makeDue`, the way a trainee gets there: by having done the one
// before it.
import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { db } from '../storage/db'
import type { Session, SetEntry } from '../types'

type User = ReturnType<typeof userEvent.setup>

const SETTLE = { timeout: 3000 }
const DAY = 86_400_000

/** The dock's start button, once Train has loaded its Program. */
export async function findStartButton(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: /^Start / }, SETTLE)
}

/** Train's start button for `workoutName` (filled, or "… anyway" on a rest day). */
export async function offerWorkout(_user: User, workoutName: string): Promise<HTMLElement> {
  const name = new RegExp(`^Start ${workoutName.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}( anyway)?$`)
  const offered = await findStartButton()
  if (!name.test(offered.textContent ?? '')) {
    throw new Error(`Train offers "${offered.textContent}", not ${workoutName}: make it due first (makeDue)`)
  }
  return screen.getByRole('button', { name })
}

/** Starts `workoutName` from Train's dock. */
export async function startFromDashboard(user: User, workoutName: string): Promise<void> {
  await user.click(await offerWorkout(user, workoutName))
}

/** The one Workout Train offers to start. */
export async function workoutOffered(): Promise<string> {
  return ((await findStartButton()).textContent ?? '').replace(/^Start /, '').replace(/ anyway$/, '')
}

/**
 * Stores a finished Session of `previousWorkoutId` on `programId`, two days before `now`, with
 * enough working Sets that it is not a short Session (V6-11) -- so the Workout after it in the
 * rotation is the one due. Its Sets are on an id no Program plans, so no lift's Preset moves.
 */
export async function makeDue(programId: string, previousWorkoutId: string, now = Date.now()): Promise<void> {
  const startedAt = now - 2 * DAY
  const entries: SetEntry[] = Array.from({ length: 40 }, (_, setIndex) => ({
    exerciseId: 'test-filler',
    setIndex,
    weightKg: null,
    reps: 1,
    loggedAt: startedAt + setIndex * 1000,
  }))
  const session: Session = {
    id: `seed-${programId}-${previousWorkoutId}`,
    programId,
    workoutId: previousWorkoutId,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    entries,
    updatedAt: startedAt + 3_600_000,
  }
  await db.sessions.put(session)
}

/** Makes Workout B of the A/B Split due (Workout A done two days ago). */
export function makeWorkoutBDue(now = Date.now()): Promise<void> {
  return makeDue('assaf-ab-2026', 'workout-a', now)
}
