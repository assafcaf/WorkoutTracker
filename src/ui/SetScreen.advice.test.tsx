// V6-01 (UX iteration 6, wave 3): the advice reaches the bar. When the lift's status offers a load
// other than the Preset, the Set screen says so in one quiet line with a "Use 15 kg" control that
// puts it on the Dials; the Sets after it carry it on (decision 0020). V6-05: a Break's eased
// Preset says why it is lighter.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { unfoldSteppers } from '../test/steppers'
import { SetScreen } from './SetScreen'
import type { SetScreenProps } from './SetScreen'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

vi.mock('./restSound', () => ({ unlockRestSound: vi.fn(), playRestOver: vi.fn(), playPrSound: vi.fn() }))

const BASE = 1_700_000_000_000
const catalog = loadCatalog()
const biceps = catalog.get('seated-biceps-curls') as Exercise
const squat = catalog.get('back-squat') as Exercise
const curlPlan: ExercisePlan = { exerciseId: 'seated-biceps-curls', sets: 3, repRange: [10, 12], restSeconds: 90 }
const squatPlan: ExercisePlan = { exerciseId: 'back-squat', sets: 3, repRange: [8, 10], restSeconds: 180 }
const curls = (weights: number[], reps = 12): SetEntry[] =>
  weights.map((weightKg, at) => ({ exerciseId: 'seated-biceps-curls', setIndex: at + 1, weightKg, reps, loggedAt: BASE - 1 }))
const READY = { kind: 'up' as const, lever: 15, text: 'Ready for 15 kg', use: 'Use 15 kg' }

function renderScreen(over: Partial<SetScreenProps>) {
  const user = userEvent.setup()
  let session: Session = { id: 's', programId: 'p', workoutId: 'w', startedAt: BASE, finishedAt: null, entries: [] }
  const onLog = vi.fn(async (_id: string, entry: SetEntry): Promise<Session> => {
    session = { ...session, entries: [...session.entries, entry] }
    return session
  })
  const props: SetScreenProps = {
    exercise: biceps,
    plan: curlPlan,
    setIndex: 1,
    sessionId: 's',
    sessionStartedAt: BASE,
    lastEntries: curls([14, 14, 14]),
    lastTime: curls([14, 14, 14]),
    logged: [],
    onLog,
    onLogged: vi.fn(),
    onOpenInfo: vi.fn(),
    ...over,
  }
  const view = render(<SetScreen {...props} />)
  return { user, onLog, view, props }
}

const weight = (): string => {
  unfoldSteppers()
  return (screen.getByRole('button', { name: /^Weight, / }).textContent ?? '').replace(/\s+/g, ' ').trim()
}

test('V6-01 a Ready lift opens at its Preset with one line offering the next load', () => {
  renderScreen({ advice: READY })
  expect(weight()).toBe('14')
  expect(screen.getByText('Ready for 15 kg')).toBeVisible()
  const use = screen.getByRole('button', { name: 'Use 15 kg' })
  expect(use.className).toContain('set-advice-use')
})

test('V6-01 Use 15 kg puts 15 on the Dials and the Log bar, and the line goes', async () => {
  const { user } = renderScreen({ advice: READY })
  await user.click(screen.getByRole('button', { name: 'Use 15 kg' }))
  expect(weight()).toBe('15')
  expect(screen.getByRole('button', { name: /^Log set 1 · 15 × 12/ })).toBeTruthy()
  expect(screen.queryByText('Ready for 15 kg')).toBeNull()
})

test('V6-01 the Sets after a used Set carry the new load on (decision 0020)', async () => {
  const { user } = renderScreen({ advice: READY })
  await user.click(screen.getByRole('button', { name: 'Use 15 kg' }))
  // The planned cells after the open one preset from it.
  const cells = document.querySelectorAll('.set-cells .set-cell')
  expect([...cells].map((cell) => cell.textContent?.replace(/\s+/g, ''))).toEqual(['115×12', '215×12', '315×12'])
})

test('V6-01 no line when the advice is the Preset already, or there is none', () => {
  renderScreen({ advice: null })
  expect(screen.queryByRole('button', { name: /^Use / })).toBeNull()
})

test('V6-01 a ramp shifts each Set by the step: Set 1 of 50 → 60 is offered at 52.5', () => {
  const ramp: SetEntry[] = [50, 55, 60].map((weightKg, at) => ({
    exerciseId: 'back-squat',
    setIndex: at + 1,
    weightKg,
    reps: 10,
    loggedAt: BASE - 1,
  }))
  renderScreen({
    exercise: squat,
    plan: squatPlan,
    lastEntries: ramp,
    lastTime: ramp,
    advice: { kind: 'up', lever: 62.5, text: 'Ready for 62.5 kg', use: 'Use 62.5 kg' },
  })
  expect(screen.getByText('Ready for 62.5 kg')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Use 52.5 kg' })).toBeTruthy()
})

test('V6-05 a Break eases the Preset and says why, with nothing to tap', () => {
  renderScreen({ deload: true, advice: { kind: 'eased', lever: 13, text: 'Eased after 34 days off', use: null } })
  expect(weight()).toBe('13')
  expect(screen.getByText('Eased after 34 days off: 13 (from 14)')).toBeVisible()
  expect(screen.queryByText(/^Deload:/)).toBeNull()
  expect(screen.queryByRole('button', { name: /^Use / })).toBeNull()
})

// V7R-01: the step up Home and the workout page promise is the Preset itself (`liftPlan`), so the
// Set screen opens on it and offers the way back instead.
const APPLIED = { kind: 'up' as const, lever: 15, text: 'Up from 14 kg', use: 'Back to 14 kg', from: 14 }

test('V7R-01 an applied step up opens at 15 at the bottom of the range, with Back to 14 kg', () => {
  renderScreen({ advice: APPLIED })
  expect(weight()).toBe('15')
  expect(screen.getByRole('button', { name: /^Log set 1 · 15 × 10/ })).toBeTruthy()
  expect(screen.getByText('Up from 14 kg')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Back to 14 kg' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Use / })).toBeNull()
  const cells = document.querySelectorAll('.set-cells .set-cell')
  expect([...cells].map((cell) => cell.textContent?.replace(/\s+/g, ''))).toEqual(['115×10', '215×10', '315×10'])
})

test('V7R-01 Back to 14 kg puts last time 14 x 12 back on the Dials', async () => {
  const { user } = renderScreen({ advice: APPLIED })
  await user.click(screen.getByRole('button', { name: 'Back to 14 kg' }))
  expect(weight()).toBe('14')
  expect(screen.getByRole('button', { name: /^Log set 1 · 14 × 12/ })).toBeTruthy()
})
