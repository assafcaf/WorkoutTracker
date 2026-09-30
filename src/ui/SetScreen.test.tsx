import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { SetScreen, loggedText, setCounterText } from './SetScreen'
import type { SetScreenProps } from './SetScreen'
import { playRestOver, unlockRestSound } from './restSound'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

// E8-T5's beep: the set screen tells the rest sound module, which this file replaces with a
// spy so no test here touches a real AudioContext (jsdom has none anyway).
vi.mock('./restSound', () => ({
  unlockRestSound: vi.fn(),
  playRestOver: vi.fn(),
}))

// Since E11-T10 the screen persists nothing itself: every Set goes through the caller's `onLog`.
// Each test hands it a double of the Session service's logSet -- one Session in progress,
// held in memory, that stores an entry the way sessionStore does (same exercise and set index
// replaced, otherwise appended) and answers the Session as stored. Nothing is put in the
// database, so a screen still writing through `src/storage` finds no Session and fails.
beforeEach(() => {
  sessionUnderTest = {
    id: SESSION_ID,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: BASE,
    finishedAt: null,
    entries: [],
  }
  vi.mocked(unlockRestSound).mockClear()
  vi.mocked(playRestOver).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** A fixed wall-clock base, so every timestamp below is a literal derived by hand. */
const BASE = 1_700_000_000_000
const SESSION_ID = 'session-under-test'

/** The one Session in progress the `onLog` double logs into; reset before every test. */
let sessionUnderTest: Session

/** A double of `services.sessions.logSet`: stores `entry` on the Session and answers it. */
function sessionLogSet() {
  return vi.fn(async (sessionId: string, entry: SetEntry): Promise<Session> => {
    if (sessionId !== sessionUnderTest.id) throw new Error(`no session ${sessionId} is stored`)
    const kept = sessionUnderTest.entries.filter(
      (stored) => !(stored.exerciseId === entry.exerciseId && stored.setIndex === entry.setIndex),
    )
    sessionUnderTest = { ...sessionUnderTest, entries: [...kept, entry] }
    return sessionUnderTest
  })
}

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
  const onLog = sessionLogSet()
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
    onLog,
    onLogged,
    onOpenInfo,
    ...over,
  }
  const { unmount } = render(<SetScreen {...props} />)
  return { user, onLog, onLogged, onOpenInfo, unmount }
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

/** The entries the `onLog` double has stored on the Session in progress so far. */
async function storedEntries(): Promise<SetEntry[]> {
  return sessionUnderTest.entries
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

  // 2.5 kg to 500 kg inclusive in steps of 2.5 kg is 200 rungs.
  expect(rungs).toHaveLength(200)
  expect([readoutValue(rungs[0]), readoutValue(rungs[199])]).toEqual(['2.5', '500'])
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

// --- O3: the Dials say what they are -------------------------------------------------------

test('O3 the weight dial is a group named Weight (kg) with that text visible above it', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  const group = screen.getByRole('group', { name: 'Weight (kg)' })
  expect(within(group).getByText('Weight (kg)')).toBeVisible()
})

test('O3 the reps dial is a group named Reps with that text visible above it', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  const group = screen.getByRole('group', { name: 'Reps' })
  expect(within(group).getByText('Reps')).toBeVisible()
})

test('O3 a Bodyweight Exercise names the weight group Weight rather than Weight (kg)', () => {
  renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  expect(screen.getByRole('group', { name: 'Weight' })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Weight (kg)' })).toBeNull()
})

// --- O4: an exact weight or rep count from a visible button --------------------------------

test('O4 typing a weight on the Type weight keypad logs it as an off-ladder weight', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await user.click(screen.getByRole('button', { name: 'Type weight' }))
  await user.click(screen.getByRole('button', { name: '6' }))
  await user.click(screen.getByRole('button', { name: '3' }))
  await user.click(screen.getByRole('button', { name: 'OK' }))
  await user.click(logButton())

  await waitFor(async () => {
    expect(await storedEntries()).toHaveLength(1)
  })
  const [entry] = await storedEntries()
  expect(entry.weightKg).toBe(63)
})

test('O4 the Type reps button opens the reps keypad the same way the readout does', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })
  expect(screen.queryByRole('button', { name: 'OK' })).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Type reps' }))

  expect(screen.getByRole('button', { name: 'OK' })).toBeVisible()
})

test('O4 a Bodyweight Exercise has no Type weight button', () => {
  renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  expect(screen.queryByRole('button', { name: 'Type weight' })).toBeNull()
})

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

// --- E8-T5's O1: playRestOver fires once, exactly when the rest period this Session's Set
// started actually runs out --------------------------------------------------------------

/** A push-ups Set logged at `loggedAt`, matching pushUpPlan's exerciseId. */
function pushUpEntry(setIndex: number, reps: number, loggedAt: number): SetEntry {
  return { exerciseId: 'push-ups', setIndex, weightKg: null, reps, loggedAt }
}

test('O1 playRestOver is called exactly once when the clock passes the Plan rest after a Set is logged, not before and not again on later ticks', async () => {
  // Fake timers from the very start: the rest-tick effect's setInterval must be created under
  // the same clock the test then advances, or the fake clock never reaches it (a real-timer
  // interval is not adopted by a later vi.useFakeTimers() call). "A Set just logged" is this
  // Session's own history -- pushUpEntry at BASE, matching sessionStartedAt -- rather than an
  // actual button click, so no fake-indexeddb write has to complete under the fake clock either.
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  render(
    <SetScreen
      exercise={pushUps}
      plan={pushUpPlan}
      setIndex={2}
      sessionId={SESSION_ID}
      sessionStartedAt={BASE}
      lastEntries={[pushUpEntry(1, 12, BASE)]}
      onLog={sessionLogSet()}
      onLogged={vi.fn()}
    />,
  )
  expect(playRestOver).not.toHaveBeenCalled()

  // pushUpPlan.restSeconds is 90; 89 s in, rest is not yet over.
  await vi.advanceTimersByTimeAsync(89_000)
  expect(playRestOver).not.toHaveBeenCalled()

  // Past 90 s, the next tick sees rest.isOver turn true for the first time this mount.
  await vi.advanceTimersByTimeAsync(1_500)
  expect(playRestOver).toHaveBeenCalledTimes(1)

  // Later ticks, still on the same rest period, must not call it again.
  await vi.advanceTimersByTimeAsync(10_000)
  expect(playRestOver).toHaveBeenCalledTimes(1)
})

test('O1 playRestOver is not called when a set screen opens with this Session rest already over', async () => {
  vi.useFakeTimers()
  // pushUpPlan.restSeconds is 90; the last Set of this Session was logged at BASE, and "now" is
  // frozen 100 s later -- rest is already over the moment the screen opens, so it must never
  // have "turned true" during this mount's own ticks.
  vi.setSystemTime(BASE + 100_000)
  render(
    <SetScreen
      exercise={pushUps}
      plan={pushUpPlan}
      setIndex={2}
      sessionId={SESSION_ID}
      sessionStartedAt={BASE}
      lastEntries={[pushUpEntry(1, 12, BASE)]}
      onLog={sessionLogSet()}
      onLogged={vi.fn()}
    />,
  )

  await vi.advanceTimersByTimeAsync(2_000)

  expect(playRestOver).not.toHaveBeenCalled()
})

// --- E8-T8 O1: the weight step control, per Exercise ----------------------------------------

/** The step control: a native select named for the weight step it currently reads. */
function stepControl(step: number): HTMLElement {
  return screen.getByRole('combobox', { name: `Step ${step} kg` })
}

test('O1 back-squats set screen shows a Step 2.5 kg control by default', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  expect(stepControl(2.5)).toBeInTheDocument()
})

test('O1 choosing 5 from the step options updates the control to read Step 5 kg', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await user.selectOptions(stepControl(2.5), '5')

  expect(stepControl(5)).toBeInTheDocument()
})

test('O1 choosing 5 from the step options moves Increase weight from 60 to 65', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await user.selectOptions(stepControl(2.5), '5')
  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(readoutValue(weightReadout())).toBe('65')
})

test('O1 choosing 5 from the step options rebuilds the Ladder with rungs 5, 10, 15', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await user.selectOptions(stepControl(2.5), '5')

  const column = screen.getByRole('listbox', { name: 'Weight ladder' })
  const rungs = within(column).getAllByRole('option')
  expect(rungs.slice(0, 3).map((rung) => readoutValue(rung))).toEqual(['5', '10', '15'])
})

test('O1 choosing 5 from the step options tells the caller onWeightStepChange with 5', async () => {
  const onWeightStepChange = vi.fn()
  const { user } = renderSetScreen({
    lastEntries: [historyEntry(1, 60, 10)],
    onWeightStepChange,
  })

  await user.selectOptions(stepControl(2.5), '5')

  expect(onWeightStepChange).toHaveBeenCalledWith(5)
})

test('O1 a weightStep prop of 5 opens the control already reading Step 5 kg', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], weightStep: 5 })

  expect(stepControl(5)).toBeInTheDocument()
})

// --- O19: the logged confirmation carries the family it glows in (E10-T8) -------------------

test('O19 the logged confirmation carries data-family for the family prop, and none when it is undefined', async () => {
  // With a family: the resolved MuscleFamily App.tsx hands in for the Exercise on screen.
  const { user, unmount } = renderSetScreen({ family: 'legs', setIndex: 2, lastEntries: [] })

  await user.click(logButton())

  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toBe('Set 2 logged · 50 kg × 8')
  })
  expect(screen.getByRole('status')).toHaveAttribute('data-family', 'legs')

  // Without one: an Exercise with no library link, so App.tsx has nothing to resolve.
  unmount()
  const { user: user2 } = renderSetScreen({ family: undefined, setIndex: 2, lastEntries: [] })

  await user2.click(logButton())

  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toBe('Set 2 logged · 50 kg × 8')
  })
  expect(screen.getByRole('status')).not.toHaveAttribute('data-family')
})

// --- E11-T10 O9: the screen logs through its caller's onLog, not through storage ------------

test('O9 one tap on Log set hands onLog the session id and the Set on the dials', async () => {
  const { user, onLog } = renderSetScreen({ setIndex: 2, lastEntries: [historyEntry(2, 60, 10)] })

  await user.click(logButton())

  await waitFor(() => {
    expect(onLog).toHaveBeenCalledTimes(1)
  })
  const [sessionId, entry] = onLog.mock.calls[0] as [string, SetEntry]
  expect(sessionId).toBe(SESSION_ID)
  expect([entry.exerciseId, entry.setIndex, entry.weightKg, entry.reps]).toEqual([
    'back-squat',
    2,
    60,
    10,
  ])
})

test('O9 an onLog that rejects shows its message inline and leaves the same set open', async () => {
  const onLog = vi.fn(async (): Promise<Session> => {
    throw new Error('the set could not be saved')
  })
  const { user, onLogged } = renderSetScreen({
    setIndex: 2,
    lastEntries: [historyEntry(2, 60, 10)],
    onLog,
  })

  await user.click(logButton())

  expect(await screen.findByRole('alert')).toHaveTextContent('the set could not be saved')
  expect(screen.getByText('Set 2 of 4')).toBeVisible()
  expect(onLogged).not.toHaveBeenCalled()
})

test('O10 lastTime shows the last finished session as one "Last time" line', () => {
  renderSetScreen({
    lastTime: [historyEntry(1, 80, 8), historyEntry(2, 80, 8), historyEntry(3, 80, 7)],
  })

  expect(screen.getByText('Last time: 80×8 · 80×8 · 80×7')).toBeVisible()
})

test('O10 a bodyweight set in lastTime reads BW×8', () => {
  renderSetScreen({
    exercise: pushUps,
    plan: pushUpPlan,
    lastTime: [{ exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 8, loggedAt: BASE }],
  })

  expect(screen.getByText('Last time: BW×8')).toBeVisible()
})

test('O10 with no lastTime there is no Last time line', () => {
  renderSetScreen({ lastTime: [] })

  expect(screen.queryByText(/Last time/)).toBeNull()
})

test('O10 sets logged today never change the Last time line', async () => {
  const { user } = renderSetScreen({ lastTime: [historyEntry(1, 80, 8)] })

  await user.click(logButton())
  await screen.findByText('Set 2 of 4')

  expect(screen.getByText('Last time: 80×8')).toBeVisible()
})

test('O11 a preset set is logged by one tap on Log set', async () => {
  const { user, onLog } = renderSetScreen({
    lastEntries: [historyEntry(1, 80, 8)],
    lastTime: [historyEntry(1, 80, 8)],
  })

  await user.click(logButton())

  expect(onLog).toHaveBeenCalledTimes(1)
})

// --- E12-T3: this Session's Sets on the set screen: edit, delete, Undo -------------------------

/**
 * The set screen under a parent that owns the Session's Sets the way WorkoutFeature does: the
 * `logged` prop follows what the edit, delete, restore and log doubles store. Deleting renumbers
 * the later Sets down by one, as the service does (E12-T2).
 */
function renderWithLogged(
  initial: SetEntry[],
  over: Partial<SetScreenProps> = {},
  fakeTimers = false,
) {
  // Under fake timers userEvent hangs; those tests tap with `tapWithFakeTimers` instead.
  const user = userEvent.setup()
  void fakeTimers
  const onEditSet = vi.fn()
  const onDeleteSet = vi.fn()
  const onRestoreSet = vi.fn()
  const baseLog = sessionLogSet()
  let current = initial

  function Parent(): JSX.Element {
    const [logged, setLogged] = useState<SetEntry[]>(initial)
    current = logged
    const sort = (entries: SetEntry[]) => [...entries].sort((a, b) => a.setIndex - b.setIndex)
    return (
      <SetScreen
        exercise={backSquat}
        plan={squatPlan}
        setIndex={initial.length + 1}
        sessionId={SESSION_ID}
        sessionStartedAt={BASE}
        lastEntries={initial}
        logged={logged}
        onLog={async (id, entry) => {
          const session = await baseLog(id, entry)
          setLogged((before) => sort([...before, entry]))
          return session
        }}
        onLogged={() => undefined}
        onEditSet={async (setIndex, values) => {
          onEditSet(setIndex, values)
          setLogged((before) =>
            before.map((entry) => (entry.setIndex === setIndex ? { ...entry, ...values } : entry)),
          )
        }}
        onDeleteSet={async (setIndex) => {
          onDeleteSet(setIndex)
          const removed = current.find((entry) => entry.setIndex === setIndex) as SetEntry
          setLogged((before) =>
            before
              .filter((entry) => entry.setIndex !== setIndex)
              .map((entry) =>
                entry.setIndex > setIndex ? { ...entry, setIndex: entry.setIndex - 1 } : entry,
              ),
          )
          return removed
        }}
        onRestoreSet={async (entry) => {
          onRestoreSet(entry)
          setLogged((before) =>
            sort([
              ...before.map((kept) =>
                kept.setIndex >= entry.setIndex ? { ...kept, setIndex: kept.setIndex + 1 } : kept,
              ),
              entry,
            ]),
          )
        }}
        {...over}
      />
    )
  }
  const { unmount } = render(<Parent />)
  return { user, onEditSet, onDeleteSet, onRestoreSet, unmount }
}

function loggedEntry(
  setIndex: number,
  weightKg: number | null,
  reps: number,
  exerciseId = 'back-squat',
): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt: BASE + setIndex }
}

/** The tappable logged Sets, in the order the screen lists them: "80 × 8", "BW × 8". */
function loggedSetNames(): string[] {
  return screen
    .queryAllByRole('button', { name: /^(\d+(\.\d+)?|BW) × \d+$/ })
    .map((button) => (button.textContent ?? '').replace(/\s+/g, ' ').trim())
}

/** A tap under fake timers, where userEvent hangs: fires the click and flushes the promises. */
async function tapWithFakeTimers(element: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(element)
  })
}

function loggedSetButton(name: string): HTMLElement {
  return screen.getByRole('button', { name })
}

test("O7 this Session's Sets are listed in setIndex order as weight × reps", () => {
  renderWithLogged([loggedEntry(2, 90, 6), loggedEntry(1, 80, 8)])

  expect(loggedSetNames()).toEqual(['80 × 8', '90 × 6'])
})

test('O7 a Bodyweight Set is listed as BW × reps', () => {
  renderWithLogged([loggedEntry(1, null, 8, 'push-ups')], {
    exercise: pushUps,
    plan: pushUpPlan,
  })

  expect(loggedSetNames()).toEqual(['BW × 8'])
})

test('O7 once the only logged Set is deleted no list shows', async () => {
  const { user } = renderWithLogged([loggedEntry(1, 80, 8)])
  expect(loggedSetNames()).toEqual(['80 × 8'])

  await user.click(loggedSetButton('80 × 8'))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))

  await waitFor(() => expect(screen.getByText('Set 1 of 4')).toBeVisible())
  expect(loggedSetNames()).toEqual([])
  expect(screen.queryByRole('list', { name: /logged/i })).toBeNull()
})

test('O8 tapping a logged Set shows its values on the Dials with Save set, Delete set and Cancel', async () => {
  const { user } = renderWithLogged([loggedEntry(1, 80, 8), loggedEntry(2, 90, 6)])

  await user.click(loggedSetButton('90 × 6'))

  expect(readoutValue(weightReadout())).toBe('90')
  expect(readoutValue(repsReadout())).toBe('6')
  expect(screen.getByRole('button', { name: 'Save set' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Delete set' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Log set' })).toBeNull()
})

test('O8 Save set stores the new values, updates the list and returns to the next Set to log', async () => {
  const { user, onEditSet } = renderWithLogged([loggedEntry(1, 80, 8), loggedEntry(2, 82.5, 6)])

  await user.click(loggedSetButton('80 × 8'))
  await enterOnKeypad(user, repsReadout(), ['9'])
  await user.click(screen.getByRole('button', { name: 'Save set' }))

  await waitFor(() => expect(loggedSetNames()).toEqual(['80 × 9', '82.5 × 6']))
  expect(onEditSet).toHaveBeenCalledTimes(1)
  expect(onEditSet).toHaveBeenCalledWith(1, { weightKg: 80, reps: 9 })
  expect(screen.getByText('Set 3 of 4')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Log set' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Save set' })).toBeNull()
})

test('O8 Cancel changes nothing and returns to the next Set to log', async () => {
  const { user, onEditSet, onDeleteSet } = renderWithLogged([
    loggedEntry(1, 80, 8),
    loggedEntry(2, 82.5, 6),
  ])

  await user.click(loggedSetButton('80 × 8'))
  await enterOnKeypad(user, repsReadout(), ['9'])
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(onEditSet).not.toHaveBeenCalled()
  expect(onDeleteSet).not.toHaveBeenCalled()
  expect(loggedSetNames()).toEqual(['80 × 8', '82.5 × 6'])
  expect(screen.getByText('Set 3 of 4')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Log set' })).toBeVisible()
})

test('O9 Delete set removes the Set from the list, drops the counter and shows Undo', async () => {
  const { user, onDeleteSet } = renderWithLogged([loggedEntry(1, 80, 8), loggedEntry(2, 90, 6)])
  expect(screen.getByText('Set 3 of 4')).toBeVisible()

  await user.click(loggedSetButton('90 × 6'))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))

  await waitFor(() => expect(loggedSetNames()).toEqual(['80 × 8']))
  expect(onDeleteSet).toHaveBeenCalledWith(2)
  expect(screen.getByText('Set 2 of 4')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible()
})

test('O9 Delete set on a finished Exercise brings Log set back', async () => {
  const { user } = renderWithLogged([
    loggedEntry(1, 80, 8),
    loggedEntry(2, 80, 8),
    loggedEntry(3, 80, 8),
    loggedEntry(4, 80, 7),
  ])
  expect(screen.getByText('All 4 sets logged')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Log set' })).toBeNull()

  await user.click(loggedSetButton('80 × 7'))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))

  expect(await screen.findByRole('button', { name: 'Log set' })).toBeVisible()
  expect(screen.getByText('Set 4 of 4')).toBeVisible()
})

test('O9 tapping Undo restores the deleted Set exactly and hides Undo', async () => {
  const removed = loggedEntry(2, 90, 6)
  const { user, onRestoreSet } = renderWithLogged([loggedEntry(1, 80, 8), removed])

  await user.click(loggedSetButton('90 × 6'))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))
  await user.click(await screen.findByRole('button', { name: 'Undo' }))

  expect(onRestoreSet).toHaveBeenCalledTimes(1)
  expect(onRestoreSet).toHaveBeenCalledWith(removed)
  await waitFor(() => expect(loggedSetNames()).toEqual(['80 × 8', '90 × 6']))
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  expect(screen.getByText('Set 3 of 4')).toBeVisible()
})

test('O9 Undo is still there at 4.9 s and gone at 5 s, and the deletion stands', async () => {
  vi.useFakeTimers()
  const { onRestoreSet } = renderWithLogged(
    [loggedEntry(1, 80, 8), loggedEntry(2, 90, 6)],
    {},
    true,
  )

  await tapWithFakeTimers(loggedSetButton('90 × 6'))
  await tapWithFakeTimers(screen.getByRole('button', { name: 'Delete set' }))
  expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible()

  await vi.advanceTimersByTimeAsync(4900)
  expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible()

  await vi.advanceTimersByTimeAsync(100)
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  expect(onRestoreSet).not.toHaveBeenCalled()
  expect(loggedSetNames()).toEqual(['80 × 8'])
})

test('O9 Undo disappears when the next Set is logged', async () => {
  const { user, onRestoreSet } = renderWithLogged([loggedEntry(1, 80, 8), loggedEntry(2, 90, 6)])

  await user.click(loggedSetButton('90 × 6'))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))
  await screen.findByRole('button', { name: 'Undo' })
  await user.click(logButton())

  await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull())
  expect(onRestoreSet).not.toHaveBeenCalled()
})

test('O9 leaving the screen clears the Undo timer without restoring or erroring', async () => {
  vi.useFakeTimers()
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const { onRestoreSet, unmount } = renderWithLogged(
    [loggedEntry(1, 80, 8), loggedEntry(2, 90, 6)],
    {},
    true,
  )

  await tapWithFakeTimers(loggedSetButton('90 × 6'))
  await tapWithFakeTimers(screen.getByRole('button', { name: 'Delete set' }))
  expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible()
  unmount()
  await vi.advanceTimersByTimeAsync(10_000)

  expect(onRestoreSet).not.toHaveBeenCalled()
  expect(errors).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
