import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { db } from '../storage/db'
import { SetScreen, setCounterText } from './SetScreen'
import type { SetScreenProps } from './SetScreen'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

// `fake-indexeddb/auto` is installed globally in src/test/setup.ts, because Dexie binds the
// global `indexedDB` when db.ts is evaluated. Do not import it here.
//
// The screen writes through the real sessionStore into the fake database, so every test
// starts from an empty `sessions` table holding one session in progress to log into.
beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.sessions.put({
    id: SESSION_ID,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: BASE,
    finishedAt: null,
    entries: [],
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** A fixed wall-clock base, so every timestamp below is a literal derived by hand. */
const BASE = 1_700_000_000_000
const SESSION_ID = 'session-under-test'

// The real catalog, so the dials are driven by the weights the trainee actually lifts:
// back-squat steps by 2.5 kg from 50 kg; push-ups are bodyweight with no ladder at all.
const catalog = loadCatalog()
const backSquat = catalog.get('back-squat') as Exercise
const pushUps = catalog.get('push-ups') as Exercise

const squatPlan: ExercisePlan = {
  exerciseId: 'back-squat',
  sets: 4,
  repRange: [8, 10],
  restSeconds: 180,
}
const pushUpPlan: ExercisePlan = {
  exerciseId: 'push-ups',
  sets: 3,
  repRange: [10, 15],
  restSeconds: 90,
}

/** One back-squat set from the last finished session, as the caller hands it in. */
function historyEntry(setIndex: number, weightKg: number | null, reps: number): SetEntry {
  return { exerciseId: 'back-squat', setIndex, weightKg, reps, loggedAt: BASE }
}

function renderSetScreen(over: Partial<SetScreenProps> = {}) {
  const user = userEvent.setup()
  const onLogged = vi.fn()
  const onOpenInfo = vi.fn()
  const props: SetScreenProps = {
    exercise: backSquat,
    plan: squatPlan,
    setIndex: 1,
    sessionId: SESSION_ID,
    lastEntries: [],
    onLogged,
    onOpenInfo,
    ...over,
  }
  render(<SetScreen {...props} />)
  return { user, onLogged, onOpenInfo }
}

/** The weight readout, which is also the button that opens the weight keypad. */
function weightReadout(): HTMLElement {
  return screen.getByRole('button', { name: 'Weight' })
}

/** The reps readout, which is also the button that opens the reps keypad. */
function repsReadout(): HTMLElement {
  return screen.getByRole('button', { name: 'Reps' })
}

function logButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Log set' })
}

/** What a readout shows, whitespace-collapsed: "63", "BW", "1:20". */
function readoutValue(element: HTMLElement): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Taps a readout to open its keypad, taps `keys`, then commits with OK. */
async function enterOnKeypad(user: UserEvent, readout: HTMLElement, keys: string[]): Promise<void> {
  await user.click(readout)
  for (const key of keys) {
    await user.click(screen.getByRole('button', { name: key }))
  }
  await user.click(screen.getByRole('button', { name: 'OK' }))
}

async function storedEntries(): Promise<SetEntry[]> {
  const session = await db.sessions.get(SESSION_ID)
  return session?.entries ?? []
}

test('O9 a weight entered on the keypad is displayed as entered though it is off the ladder', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })
  expect(readoutValue(weightReadout())).toBe('60')

  await enterOnKeypad(user, weightReadout(), ['6', '3'])

  expect(readoutValue(weightReadout())).toBe('63')
})

test('O9 a weight entered on the keypad is logged as entered though it is off the ladder', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await enterOnKeypad(user, weightReadout(), ['6', '3'])
  await user.click(logButton())

  await waitFor(async () => {
    expect(await storedEntries()).toHaveLength(1)
  })
  const [entry] = await storedEntries()
  expect([entry.exerciseId, entry.setIndex, entry.weightKg, entry.reps]).toEqual([
    'back-squat',
    1,
    63,
    10,
  ])
})

test('O9 the keypad stays closed until the readout is tapped', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })
  expect(screen.queryByRole('button', { name: 'OK' })).toBeNull()

  await user.click(weightReadout())

  expect(screen.getByRole('button', { name: 'OK' })).toBeVisible()
})

test('O9 cancelling the keypad leaves the weight on the value it was showing', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await user.click(weightReadout())
  await user.click(screen.getByRole('button', { name: '6' }))
  await user.click(screen.getByRole('button', { name: '3' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(readoutValue(weightReadout())).toBe('60')
})

test('O9 the plus button moves the weight one rung up the ladder', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(readoutValue(weightReadout())).toBe('62.5')
})

test('O9 the minus button snaps an off-ladder weight down to the rung below it', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })
  await enterOnKeypad(user, weightReadout(), ['6', '3'])

  await user.click(screen.getByRole('button', { name: 'Decrease weight' }))

  // 63 kg sits between the 62.5 and 65 rungs: it snaps down to 62.5, then steps one down.
  expect(readoutValue(weightReadout())).toBe('60')
})

test('O9 the weight ladder is rendered as a column of rungs with the current one selected', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  // Structural only: jsdom has no layout and no scroll-snap physics, so the column is
  // asserted as markup here and its snapping is left to the device.
  const column = screen.getByRole('listbox', { name: 'Weight ladder' })
  const rungs = within(column).getAllByRole('option')

  // 50 kg to 500 kg inclusive in steps of 2.5 kg is 181 rungs.
  expect(rungs).toHaveLength(181)
  expect([readoutValue(rungs[0]), readoutValue(rungs[180])]).toEqual(['50', '500'])
  expect(readoutValue(within(column).getByRole('option', { selected: true }))).toBe('60')
})

test('O10 a bodyweight exercise reads BW rather than a weight of 0', () => {
  renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  expect(readoutValue(weightReadout())).toBe('BW')
})

test('O10 the plus button leaves a bodyweight exercise reading BW', async () => {
  const { user } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(readoutValue(weightReadout())).toBe('BW')
})

test('O10 logging a bodyweight set stores a null weight and its fractional reps', async () => {
  const { user } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  await enterOnKeypad(user, repsReadout(), ['9', '.', '5'])
  await user.click(logButton())

  await waitFor(async () => {
    expect(await storedEntries()).toHaveLength(1)
  })
  const [entry] = await storedEntries()
  expect([entry.exerciseId, entry.setIndex, entry.weightKg, entry.reps]).toEqual([
    'push-ups',
    1,
    null,
    9.5,
  ])
})

test('O12 one tap on the log button persists the set with a loggedAt timestamp', async () => {
  const { user } = renderSetScreen({ setIndex: 2, lastEntries: [historyEntry(2, 60, 10)] })
  const before = Date.now()

  await user.click(logButton())

  await waitFor(async () => {
    expect(await storedEntries()).toHaveLength(1)
  })
  const after = Date.now()
  const [entry] = await storedEntries()
  expect([entry.exerciseId, entry.setIndex, entry.weightKg, entry.reps]).toEqual([
    'back-squat',
    2,
    60,
    10,
  ])
  expect(entry.loggedAt).toBeGreaterThanOrEqual(before)
  expect(entry.loggedAt).toBeLessThanOrEqual(after)
})

test('O12 one tap on the log button opens set 3 preset, with no other interaction', async () => {
  const { user } = renderSetScreen({ setIndex: 2, lastEntries: [historyEntry(2, 60, 10)] })
  expect(screen.getByText('Set 2 of 4')).toBeVisible()

  await user.click(logButton())

  expect(await screen.findByText('Set 3 of 4')).toBeVisible()
  expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['60', '10'])
})

test('O12 set 3 opens on the values just logged for set 2', async () => {
  const { user } = renderSetScreen({ setIndex: 2, lastEntries: [historyEntry(2, 60, 10)] })

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  await user.click(logButton())

  expect(await screen.findByText('Set 3 of 4')).toBeVisible()
  expect(readoutValue(weightReadout())).toBe('62.5')
})

test('O12 onLogged hands the caller the stored session and the next set index', async () => {
  const { user, onLogged } = renderSetScreen({
    setIndex: 2,
    lastEntries: [historyEntry(2, 60, 10)],
  })

  await user.click(logButton())

  await waitFor(() => {
    expect(onLogged).toHaveBeenCalledTimes(1)
  })
  const [session, nextSetIndex] = onLogged.mock.calls[0] as [Session, number]
  expect(nextSetIndex).toBe(3)
  expect(session.id).toBe(SESSION_ID)
  expect(session.entries.map((stored) => stored.setIndex)).toEqual([2])
})

test('O12 an entry outside the accepted reps range shows its message inline', async () => {
  const { user } = renderSetScreen({ setIndex: 2, lastEntries: [historyEntry(2, 60, 10)] })

  await enterOnKeypad(user, repsReadout(), ['0'])
  await user.click(logButton())

  expect(await screen.findByText('Reps must be between 0.5 and 100.')).toBeVisible()
})

test('O12 an entry outside the accepted reps range writes nothing', async () => {
  const { user } = renderSetScreen({ setIndex: 2, lastEntries: [historyEntry(2, 60, 10)] })

  await enterOnKeypad(user, repsReadout(), ['0'])
  await user.click(logButton())

  await screen.findByText('Reps must be between 0.5 and 100.')
  expect(await storedEntries()).toEqual([])
  expect(screen.getByText('Set 2 of 4')).toBeVisible()
})

test('L14 tapping Exercise info tells the caller to open the on-screen exercise id', async () => {
  const { user, onOpenInfo } = renderSetScreen()

  await user.click(screen.getByRole('button', { name: 'Exercise info' }))

  expect(onOpenInfo).toHaveBeenCalledTimes(1)
  expect(onOpenInfo).toHaveBeenCalledWith('back-squat')
})

test('S6 tapping Alternatives tells the caller to open alternatives for the on-screen exercise id', async () => {
  const onOpenAlternatives = vi.fn()
  const { user } = renderSetScreen({ onOpenAlternatives })

  await user.click(screen.getByRole('button', { name: 'Alternatives' }))

  expect(onOpenAlternatives).toHaveBeenCalledTimes(1)
  expect(onOpenAlternatives).toHaveBeenCalledWith('back-squat')
})

test('O12 the rest timer reads 0:00 before any set is logged', () => {
  renderSetScreen({ setIndex: 2, lastEntries: [historyEntry(2, 60, 10)] })

  expect(readoutValue(screen.getByRole('timer'))).toBe('0:00')
})

test('O12 the rest timer formats the remaining rest as minutes and seconds', async () => {
  // Frozen, so the remaining rest is exactly 80 seconds rather than "80 minus however long
  // the click took", and the reading does not depend on how the screen rounds.
  vi.spyOn(Date, 'now').mockReturnValue(BASE)
  const { user } = renderSetScreen({
    setIndex: 2,
    plan: { ...squatPlan, restSeconds: 80 },
    lastEntries: [historyEntry(2, 60, 10)],
  })

  await user.click(logButton())

  await waitFor(() => {
    expect(readoutValue(screen.getByRole('timer'))).toBe('1:20')
  })
})

// --- E6-T1: the done state past the Plan ---------------------------------------------------
//
// Past the Plan the screen offers only "Add set"; an extra set opened by it offers only
// "Log set", and logging it returns the screen to the done state.

/** Back squat planned for 3 sets, so the set after the last planned one is set 4. */
const threeSetSquatPlan: ExercisePlan = { ...squatPlan, sets: 3 }

function addSetButton(): HTMLElement | null {
  return screen.queryByRole('button', { name: 'Add set' })
}

function logSetButton(): HTMLElement | null {
  return screen.queryByRole('button', { name: 'Log set' })
}

test('O1 a set screen opened at the set after a 3-set Plan, not as an extra, offers Add set and no Log set', () => {
  renderSetScreen({
    plan: threeSetSquatPlan,
    setIndex: 4,
    extra: false,
    onAddSet: vi.fn(),
    lastEntries: [historyEntry(3, 60, 10)],
  })

  expect(addSetButton()).not.toBeNull()
  expect(logSetButton()).toBeNull()
})

test('O2 a set screen opened as an extra set past a 3-set Plan offers Log set and no Add set', () => {
  renderSetScreen({
    plan: threeSetSquatPlan,
    setIndex: 4,
    extra: true,
    onAddSet: vi.fn(),
    lastEntries: [historyEntry(3, 60, 10)],
  })

  expect(logSetButton()).not.toBeNull()
  expect(addSetButton()).toBeNull()
})

test('O2 logging an extra set returns the set screen to the done state, offering Add set and no Log set', async () => {
  const { user } = renderSetScreen({
    plan: threeSetSquatPlan,
    setIndex: 4,
    extra: true,
    onAddSet: vi.fn(),
    lastEntries: [historyEntry(3, 60, 10)],
  })

  await user.click(logButton())

  await waitFor(async () => {
    expect(await storedEntries()).toHaveLength(1)
  })
  expect((await storedEntries())[0].setIndex).toBe(4)
  await waitFor(() => {
    expect(addSetButton()).not.toBeNull()
  })
  expect(logSetButton()).toBeNull()
})

test('O1 setCounterText reads Set 2 of 3 for a planned set that is not the last', () => {
  expect(setCounterText(2, 3, 1, false)).toBe('Set 2 of 3')
})

test('O1 setCounterText reads Set 3 of 3 for the last planned set', () => {
  expect(setCounterText(3, 3, 2, false)).toBe('Set 3 of 3')
})

test('O1 setCounterText reads All 3 sets logged when done with exactly the 3 planned sets logged', () => {
  expect(setCounterText(4, 3, 3, true)).toBe('All 3 sets logged')
})

test('O2 setCounterText reads Set 4 · extra for an extra set past a 3-set Plan', () => {
  expect(setCounterText(4, 3, 3, false)).toBe('Set 4 · extra')
})

test('O2 setCounterText reads 4 sets logged · 3 planned when done with one extra set logged', () => {
  expect(setCounterText(5, 3, 4, true)).toBe('4 sets logged · 3 planned')
})
