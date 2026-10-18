import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { unfoldSteppers } from '../test/steppers'
import { SetScreen } from './SetScreen'
import type { SetScreenProps } from './SetScreen'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

vi.mock('./restSound', () => ({ unlockRestSound: vi.fn(), playRestOver: vi.fn() }))

const BASE = 1_700_000_000_000
const catalog = loadCatalog()
const backSquat = catalog.get('back-squat') as Exercise
const pushUps = catalog.get('push-ups') as Exercise
const squatPlan: ExercisePlan = { exerciseId: 'back-squat', sets: 4, repRange: [8, 10], restSeconds: 180 }
const pushUpPlan: ExercisePlan = { exerciseId: 'push-ups', sets: 3, repRange: [10, 15], restSeconds: 90 }
const lastTime: SetEntry[] = [1, 2, 3, 4].map((setIndex) => ({
  exerciseId: 'back-squat',
  setIndex,
  weightKg: 80,
  reps: 8,
  loggedAt: BASE,
}))

function renderScreen(over: Partial<SetScreenProps>) {
  const user = userEvent.setup()
  const onLog = vi.fn(
    async (sessionId: string, entry: SetEntry): Promise<Session> => ({
      id: sessionId,
      programId: 'p',
      workoutId: 'w',
      startedAt: BASE,
      finishedAt: null,
      entries: [entry],
    }),
  )
  render(
    <SetScreen
      exercise={backSquat}
      plan={squatPlan}
      setIndex={1}
      sessionId="s"
      sessionStartedAt={BASE}
      lastEntries={lastTime}
      onLog={onLog}
      onLogged={vi.fn()}
      onOpenInfo={vi.fn()}
      {...over}
    />,
  )
  return { user, onLog }
}

const weight = (): string => {
  unfoldSteppers()
  return (screen.getByRole('button', { name: 'Weight' }).textContent ?? '').replace(/\s+/g, ' ').trim()
}

test('O17 a deload Session opens the first Set at 72.5 and says where it came from', () => {
  renderScreen({ deload: true })
  expect(weight()).toBe('72.5')
  expect(screen.getByText('Deload: 72.5 (from 80)')).toBeVisible()
})

test('O17 outside a deload Session the Set opens at last time\'s weight with no deload line', () => {
  renderScreen({})
  expect(weight()).toBe('80')
  expect(screen.queryByText(/^Deload:/)).toBeNull()
})

test('O17 a Bodyweight Exercise shows no deload line in a deload Session', () => {
  renderScreen({ exercise: pushUps, plan: pushUpPlan, lastEntries: [], deload: true })
  expect(screen.queryByText(/^Deload:/)).toBeNull()
})

test('O18 one tap on Log set stores 72.5 x 8 on the deload Preset', async () => {
  const { user, onLog } = renderScreen({ deload: true })
  await user.click(screen.getByRole('button', { name: 'Log set' }))
  expect(onLog).toHaveBeenCalledTimes(1)
  expect(onLog.mock.calls[0][1]).toMatchObject({ exerciseId: 'back-squat', weightKg: 72.5, reps: 8 })
})
