// UX review iteration 1 (docs/ux-expert/iterations/v1/report.md): the set loop's verdicts
// V1-02, V1-03, V1-04, V1-05, V1-07, V1-11 and V1-19, each test named after the outcome.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { contrastRatio, declarationsFor, readTokens } from '../test/cssAudit'
import { unfoldSteppers } from '../test/steppers'
import { loadCatalog } from '../data/catalog'
import { SetScreen } from './SetScreen'
import type { SetScreenProps } from './SetScreen'
import type { Exercise, ExercisePlan, PlateInventory, Session, SetEntry } from '../types'

vi.mock('./restSound', () => ({ unlockRestSound: vi.fn(), playRestOver: vi.fn(), playPrSound: vi.fn() }))

afterEach(() => {
  vi.restoreAllMocks()
})

const BASE = 1_700_000_000_000
const catalog = loadCatalog()
const backSquat = catalog.get('back-squat') as Exercise
const pushUps = catalog.get('push-ups') as Exercise
const squatPlan: ExercisePlan = { exerciseId: 'back-squat', sets: 4, repRange: [8, 10], restSeconds: 180 }
const pushUpPlan: ExercisePlan = { exerciseId: 'push-ups', sets: 3, repRange: [10, 15], restSeconds: 90 }
const plates: PlateInventory = {
  barKg: 20,
  plates: [
    { kg: 20, pairs: 4 },
    { kg: 10, pairs: 2 },
    { kg: 5, pairs: 2 },
    { kg: 2.5, pairs: 2 },
    { kg: 1.25, pairs: 2 },
  ],
}

function set(setIndex: number, weightKg: number | null, reps: number, loggedAt = BASE): SetEntry {
  return { exerciseId: 'back-squat', setIndex, weightKg, reps, loggedAt }
}

/** Last time's back squat on Workout A, as the review found it. */
const lastWorkoutA = [set(1, 47.5, 10), set(2, 57.5, 9), set(3, 62.5, 8), set(4, 62.5, 7)]

/** The screen under a parent that keeps today's Sets, the way WorkoutFeature passes `logged`. */
function renderLive(over: Partial<SetScreenProps> & { initial?: SetEntry[] } = {}) {
  const user = userEvent.setup()
  const { initial = [], ...props } = over
  const onLog = vi.fn()
  function Parent(): JSX.Element {
    const [logged, setLogged] = useState<SetEntry[]>(initial)
    return (
      <SetScreen
        exercise={backSquat}
        plan={squatPlan}
        setIndex={initial.length + 1}
        sessionId="s"
        sessionStartedAt={BASE}
        lastEntries={lastWorkoutA}
        logged={logged}
        onLog={async (id, entry): Promise<Session> => {
          onLog(id, entry)
          const entries = [...logged, entry]
          setLogged(entries)
          return { id, programId: 'p', workoutId: 'w', startedAt: BASE, finishedAt: null, entries }
        }}
        onLogged={vi.fn()}
        {...props}
      />
    )
  }
  render(<Parent />)
  return { user, onLog }
}

/** The cells after the logged ones, as "47.5×10". */
function upcomingCells(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.set-cells .set-cell .set-cell-value')).map(
    (cell) => (cell.textContent ?? '').trim(),
  )
}

function css(): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'SetScreen.css'), 'utf-8')
}

function tokens(): Map<string, string> {
  return readTokens(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../styles/tokens.css'), 'utf-8'),
  )
}

// --- V1-02 ----------------------------------------------------------------------------------

test('V1-02 at Workout start each Set cell shows its own position\'s Preset', () => {
  renderLive()
  expect(upcomingCells()).toEqual(['47.5×10', '57.5×9', '62.5×8', '62.5×7'])
})

test('V1-02 logging a Set at its Preset leaves every later cell as it was', async () => {
  const { user } = renderLive()
  const before = upcomingCells().slice(1)

  await user.click(screen.getByRole('button', { name: /^Log set 1/ }))

  expect(upcomingCells()).toEqual(before)
})

// --- V1-03 ----------------------------------------------------------------------------------

test('V1-03 during Rest the Log set bar shows under the Rest panel and logs in one tap', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 12_000)
  const { user, onLog } = renderLive({
    initial: [set(1, 47.5, 10, BASE)],
    restFrom: { entry: set(1, 47.5, 10, BASE), planRestSeconds: 180 },
  })

  // DX-05: the Rest ring is in the body and is Skip; the dock holds one filled Log set, the only
  // primary on the screen and the only Log set.
  const panel = document.querySelector('.set-screen .rest-panel') as HTMLElement
  const bar = screen.getByRole('button', { name: 'Log set 2 · 57.5 × 9' })
  expect(panel).not.toBeNull()
  expect(panel.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(bar.closest('.set-dock')).not.toBeNull()
  expect(bar).toHaveClass('btn-primary')
  expect(document.querySelectorAll('.set-dock button')).toHaveLength(1)
  expect(document.querySelectorAll('.btn-primary')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Skip rest' }).closest('.rest-ring')).not.toBeNull()
  expect(screen.getAllByRole('button', { name: /^Log set/ })).toHaveLength(1)

  await user.click(bar)

  expect(onLog).toHaveBeenCalledTimes(1)
  expect(onLog.mock.calls[0][1]).toMatchObject({ setIndex: 2, weightKg: 57.5, reps: 9 })
  // Logging ends the Rest it ran in: the countdown starts again from the new Set.
  expect(screen.getByRole('timer', { name: 'Rest remaining' }).textContent).toBe('3:00')
})

// --- V1-04 ----------------------------------------------------------------------------------

test('V1-04 the Dials\' readouts are named with their values and follow the Dial', async () => {
  const { user } = renderLive()
  expect(screen.getByRole('button', { name: 'Weight, 47.5 kg' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Reps, 10' })).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  await user.click(screen.getByRole('button', { name: 'Decrease reps' }))

  expect(screen.getByRole('button', { name: 'Weight, 50 kg' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Reps, 9' })).toBeVisible()
})

test('V1-04 a Bodyweight readout is named "Weight, BW"', () => {
  renderLive({ exercise: pushUps, plan: pushUpPlan, lastEntries: [] })
  expect(screen.getByRole('button', { name: 'Weight, BW' })).toBeInTheDocument()
})

test('V1-04 the Log set bar\'s name is its visible text', () => {
  renderLive()
  const bar = screen.getByRole('button', { name: 'Log set 1 · 47.5 × 10' })
  expect(bar.textContent).toBe('Log set 1 · 47.5 × 10')
  expect(bar.hasAttribute('aria-label')).toBe(false)
})

// --- V1-05 ----------------------------------------------------------------------------------

test('V1-05 a Preset carried from an earlier Set today says so, with last time\'s weight', () => {
  renderLive({
    lastEntries: [set(1, 60, 10), set(2, 70, 7), set(3, 70, 7)],
    initial: [set(1, 80, 10, BASE + 1)],
  })
  unfoldSteppers()
  expect(screen.getByRole('button', { name: 'Weight, 90 kg' })).toBeVisible()
  expect(screen.getByText('+20 kg: carried from set 1 (last 70)')).toBeVisible()
})

test('V1-05 a Preset that is last time\'s own weight carries no reason line', () => {
  renderLive({ initial: [set(1, 47.5, 10, BASE + 1)] })
  expect(screen.queryByText(/carried from set/)).toBeNull()
})

test('V1-05 the reason line goes once the trainee moves the weight Dial', async () => {
  const { user } = renderLive({
    lastEntries: [set(1, 60, 10), set(2, 70, 7), set(3, 70, 7)],
    initial: [set(1, 80, 10, BASE + 1)],
  })
  await user.click(screen.getByRole('button', { name: 'Decrease weight' }))
  expect(screen.queryByText(/carried from set/)).toBeNull()
})

// --- V1-07 ----------------------------------------------------------------------------------

test('V1-07 the Plate line shows under the weight Dial with no tap', () => {
  renderLive({ lastEntries: [set(1, 60, 10)], plates })
  const line = screen.getByText('Per side: 20')
  expect(line).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Weight, 60 kg' }).compareDocumentPosition(line) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})

test('V1-07 during Rest the Next line ends with the per-side plates', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 12_000)
  renderLive({
    lastEntries: [set(1, 60, 10), set(2, 60, 10)],
    plates,
    initial: [set(1, 60, 10, BASE)],
    restFrom: { entry: set(1, 60, 10, BASE), planRestSeconds: 180 },
  })
  // V2-02, v7: Rest's Next panel names the plates, as the change from the bar just lifted.
  const card = screen.getByRole('region', { name: 'Next set' })
  expect(within(card).getByText('Same plates: 20')).toBeVisible()
})

test('V1-07 DX-07 no tools sheet and no Plates control: the W cell holds the Warm-ups, Notes its sheet', async () => {
  const { user } = renderLive({ plates, onSaveExerciseNote: vi.fn(async () => undefined) })
  expect(screen.queryByRole('button', { name: 'Exercise tools' })).toBeNull()
  expect(screen.queryByRole('radio', { name: 'Plates' })).toBeNull()
  await user.click(screen.getByRole('button', { name: /^Warm-up: / }))
  expect(within(screen.getByRole('group', { name: 'Warm-ups' })).getByRole('button', { name: 'Add warm-ups' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Notes' }))
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
})

// --- V1-11 ----------------------------------------------------------------------------------

/** Three earlier Sessions resting 160 s between Sets, so the usual rest differs from the Plan's. */
const restful: Session[] = [1, 2, 3].map((n) => ({
  id: `r${n}`,
  programId: 'p',
  workoutId: 'w',
  startedAt: BASE - n * 86_400_000,
  finishedAt: BASE - n * 86_400_000 + 3_600_000,
  entries: [1, 2].map((setIndex) => set(setIndex, 60, 8, BASE - n * 86_400_000 + (setIndex - 1) * 160_000)),
}))

test('V1-11 the Rest panel shows the countdown, "of 3:00" and the Use offer, and no timeline', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 12_000)
  renderLive({
    initial: [set(1, 47.5, 10, BASE)],
    earlierSessions: restful,
    onUseRestForExercise: vi.fn(async () => undefined),
    restFrom: { entry: set(1, 47.5, 10, BASE), planRestSeconds: 180 },
  })
  const panel = document.querySelector('.rest-panel') as HTMLElement
  expect(panel.textContent).toContain('2:48')
  expect(panel.textContent).toContain('of 3:00')
  expect(panel.textContent).not.toContain('usually')
  expect(panel.querySelector('.rest-bar')).toBeNull()
  expect(panel.textContent).not.toContain('0:00')
  // V3-03: the usual rest's Use offer is in the rest Dial's sheet; the dock carries no decision.
  expect(screen.queryByRole('button', { name: 'Use 2:40 for Back squat' })).toBeNull()
  // DX-07: the ring's "of 3:00" opens it.
  fireEvent.click(screen.getByRole('button', { name: 'Rest time 3:00, change' }))
  expect(screen.getByRole('button', { name: 'Use 2:40 for Back squat' })).toBeVisible()
})

test('V1-11 the ±15 s buttons say what they change', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 12_000)
  renderLive({
    initial: [set(1, 47.5, 10, BASE)],
    restFrom: { entry: set(1, 47.5, 10, BASE), planRestSeconds: 180 },
  })
  expect(screen.getByRole('button', { name: 'Rest 15 seconds less' }).textContent).toBe('−15 s')
  expect(screen.getByRole('button', { name: 'Rest 15 seconds more' }).textContent).toBe('+15 s')
})

// --- V1-19 ----------------------------------------------------------------------------------

test('V1-19 DX-24 an upcoming Set cell has no border and its text is --color-muted, at least 3:1', () => {
  const future = declarationsFor(css(), '.set-cells .set-cell--future')
  expect(future.get('border-color')).toBe('transparent')
  expect(future.get('color')).toBe('var(--color-muted)')
  const t = tokens()
  expect(contrastRatio(t.get('--color-muted') as string, t.get('--color-surface') ?? '#FFFFFF')).toBeGreaterThanOrEqual(3)
})
