import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { db } from '../storage/db'
import { SetScreen, loggedText } from './SetScreen'
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
    // BASE, not 0: `historyEntry`'s fixed `loggedAt` of BASE must count as logged in this
    // session by default, so the pre-existing rest-timer tests below -- written before
    // `sessionStartedAt` existed -- keep meaning what they always meant.
    sessionStartedAt: BASE,
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

// --- O5: the log-confirmation message ------------------------------------------------------

test('O5 loggedText names the weight and reps for a loaded Exercise', () => {
  expect(loggedText(2, 50, 8)).toBe('Set 2 logged · 50 kg × 8')
})

test('O5 loggedText names only the reps for a Bodyweight Exercise', () => {
  expect(loggedText(2, null, 12)).toBe('Set 2 logged · 12 reps')
})

test('O5 the log-confirmation message is empty before any Set is logged on this screen', () => {
  renderSetScreen()

  expect(screen.getByRole('status').textContent).toBe('')
})

test('O5 logging Set 2 of a loaded Exercise at 50 kg x 8 announces it in the confirmation message', async () => {
  // No lastEntries: back-squat's own preset opens set 2 exactly on 50 kg x 8 (its start weight
  // and squatPlan's low rep, proven independently by App.test.tsx's O5 "nothing logged
  // anywhere" case), so logging it with no other interaction logs exactly that.
  const { user } = renderSetScreen({ setIndex: 2, lastEntries: [] })

  await user.click(logButton())

  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toBe('Set 2 logged · 50 kg × 8')
  })
})

test('O5 logging Set 2 of a loaded Exercise still renders the rest timer alongside the confirmation message', async () => {
  const { user } = renderSetScreen({ setIndex: 2, lastEntries: [] })

  await user.click(logButton())

  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toBe('Set 2 logged · 50 kg × 8')
  })
  expect(screen.getByRole('timer')).toBeVisible()
})

test('O5 logging Set 2 of a Bodyweight Exercise at 12 reps announces it in the confirmation message', async () => {
  const { user } = renderSetScreen({
    exercise: pushUps,
    plan: pushUpPlan,
    setIndex: 2,
    lastEntries: [],
  })

  await enterOnKeypad(user, repsReadout(), ['1', '2'])
  await user.click(logButton())

  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toBe('Set 2 logged · 12 reps')
  })
})

// --- O6: no rest timer before any Set is logged in this Session -----------------------------

test('O6 no rest timer renders when this Exercise has no Set logged in this Session', () => {
  renderSetScreen({ setIndex: 1, lastEntries: [] })

  expect(screen.queryByRole('timer')).toBeNull()
  expect(document.querySelector('.rest-timer')).toBeNull()
})

test('O6 no rest timer renders when the only lastEntries for this Exercise predate this Session', () => {
  // historyEntry's loggedAt is BASE; a sessionStartedAt after it means the entry is from an
  // earlier, already-finished session, not one logged in this one.
  renderSetScreen({
    setIndex: 2,
    sessionStartedAt: BASE + 1,
    lastEntries: [historyEntry(2, 60, 10)],
  })

  expect(screen.queryByRole('timer')).toBeNull()
  expect(document.querySelector('.rest-timer')).toBeNull()
})

// --- O7: the rest timer on opening reflects the real last Set of this Session --------------

test('O7 opening back-squat whose latest Set in this Session was logged 100 s ago shows 1:20 remaining', () => {
  // back-squat's plan here carries a 180 s rest (squatPlan); the last Set in this session was
  // logged at BASE, and "now" is frozen 100 s later, so 80 s of the 180 s remain -- "1:20".
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 2,
    plan: squatPlan,
    sessionStartedAt: BASE,
    lastEntries: [historyEntry(2, 60, 10)],
  })

  expect(readoutValue(screen.getByRole('timer'))).toBe('1:20')
})
