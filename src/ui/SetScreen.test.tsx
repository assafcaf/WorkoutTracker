import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

/**
 * The rest readout (E13-T8): the button in the rest panel that holds the "Rest remaining" timer.
 * Its text is the rest alone: "1:20" while it runs, "+0:42 over" once it is over.
 */
function restReadout(): HTMLElement {
  const timer = screen.getByRole('timer', { name: 'Rest remaining' })
  const button = timer.closest('button')
  if (button === null) throw new Error('the rest readout is not a button')
  return button
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
  // E13-T8: rest that has just run out no longer reads a bare "0:00" -- it reads "+0:00 over".
  // The Session's latest Set (restFrom) was logged at BASE with squatPlan's 180 s rest, and "now"
  // is frozen exactly 180 s later, before anything is logged on this screen.
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 180_000)
  renderSetScreen({
    setIndex: 2,
    lastEntries: [historyEntry(2, 60, 10)],
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  expect(readoutValue(restReadout())).toBe('+0:00 over')
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
  // E13-T8: the caller now hands that Set in as `restFrom`; `lastEntries` no longer seeds rest.
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 2,
    plan: squatPlan,
    sessionStartedAt: BASE,
    lastEntries: [historyEntry(2, 60, 10)],
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
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
      restFrom={{ entry: pushUpEntry(1, 12, BASE), planRestSeconds: 90 }}
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
      restFrom={{ entry: pushUpEntry(1, 12, BASE), planRestSeconds: 90 }}
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

// --- E13-T6: the PR toast and the `PR` badge ----------------------------------------------------
//
// The earlier finished Session holds back-squat 80 x 8, so its records are heaviest set 80,
// best e1RM 80 x (1 + 8/30) = 101.33, and most reps at the heaviest weight 8 (at 80).
//   85 x 5  -> heaviest set 85 (new), e1RM 99.17 (no), reps at heaviest weight 5 at 85 (changed).
//   75 x 12 -> e1RM 75 x 1.4 = 105 (new); heaviest stays 80; reps at 80 stay 8.
//   70 x 5  -> e1RM 81.67: no record at all.

const earlierSession: Session = {
  id: 'earlier-session',
  programId: 'assaf-ab-2026',
  workoutId: 'workout-a',
  startedAt: BASE - 86_400_000,
  finishedAt: BASE - 86_000_000,
  entries: [
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 80, reps: 8, loggedAt: BASE - 86_400_000 },
  ],
}

function prBadges(): HTMLElement[] {
  return screen.queryAllByLabelText('Personal record')
}

/** The badges on the logged-set row whose button reads `name`. */
function badgesOnRow(name: string): HTMLElement[] {
  const row = loggedSetButton(name).closest('li') as HTMLElement
  return within(row).queryAllByLabelText('Personal record')
}

test('O14 logging a Set that sets one record shows a toast naming it and the Set', async () => {
  const { user } = renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 75, 12)],
  })

  await user.click(logButton())

  expect(await screen.findByText('New PR · Best estimated 1RM · 75 kg × 12')).toBeVisible()
})

test('O14 the toast joins every record label with a comma', async () => {
  const { user } = renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 85, 5)],
  })

  await user.click(logButton())

  expect(
    await screen.findByText(
      'New PR · Heaviest set, Most reps at the heaviest weight · 85 kg × 5',
    ),
  ).toBeVisible()
})

test('O14 logging a Set that sets no record shows no toast', async () => {
  const { user, onLog } = renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 70, 5)],
  })

  await user.click(logButton())
  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  await screen.findByText('Set 1 logged · 70 kg × 5')

  expect(screen.queryByText(/New PR/)).toBeNull()
})

test('O14 a first-ever Exercise Session (no earlier Sessions) shows no toast', async () => {
  const { user, onLog } = renderSetScreen({
    earlierSessions: [],
    lastEntries: [historyEntry(1, 85, 5)],
  })

  await user.click(logButton())
  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  await screen.findByText('Set 1 logged · 85 kg × 5')

  expect(screen.queryByText(/New PR/)).toBeNull()
})

test('O14 a record toast is not a modal', async () => {
  const { user } = renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 75, 12)],
  })

  await user.click(logButton())
  await screen.findByText(/New PR/)

  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('alertdialog')).toBeNull()
})

test('O14 the record toast goes away after 3 s', async () => {
  vi.useFakeTimers()
  renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 75, 12)],
  })

  await tapWithFakeTimers(logButton())
  expect(screen.getByText(/New PR/)).toBeVisible()

  await vi.advanceTimersByTimeAsync(3100)
  expect(screen.queryByText(/New PR/)).toBeNull()
})

test('O14 a logged Set that set a record carries a Personal record badge; one that did not does not', () => {
  renderWithLogged([loggedEntry(1, 85, 5), loggedEntry(2, 70, 5)], {
    earlierSessions: [earlierSession],
  })

  expect(badgesOnRow('85 × 5')).toHaveLength(1)
  expect(badgesOnRow('70 × 5')).toHaveLength(0)
  expect(screen.getAllByText('PR')).toHaveLength(1)
})

test('O14 no Set carries a badge without earlier Sessions', () => {
  renderWithLogged([loggedEntry(1, 85, 5)])

  expect(prBadges()).toHaveLength(0)
})

test('O14 editing a record Set down takes its badge off', async () => {
  const { user } = renderWithLogged([loggedEntry(1, 85, 5), loggedEntry(2, 70, 5)], {
    earlierSessions: [earlierSession],
  })
  expect(badgesOnRow('85 × 5')).toHaveLength(1)

  await user.click(loggedSetButton('85 × 5'))
  await enterOnKeypad(user, weightReadout(), ['7', '0'])
  await user.click(screen.getByRole('button', { name: 'Save set' }))

  await waitFor(() => expect(loggedSetNames()).toEqual(['70 × 5', '70 × 5']))
  expect(prBadges()).toHaveLength(0)
})

test('O14 deleting a record Set takes its badge with it', async () => {
  const { user } = renderWithLogged([loggedEntry(1, 85, 5), loggedEntry(2, 70, 5)], {
    earlierSessions: [earlierSession],
  })

  await user.click(loggedSetButton('85 × 5'))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))

  await waitFor(() => expect(loggedSetNames()).toEqual(['70 × 5']))
  expect(prBadges()).toHaveLength(0)
})

// --- E13-T8 O4: rest follows the Session, with -15 s, +15 s and Skip -------------------------
//
// The caller hands in the Session's latest Set as `restFrom`, with the Plan rest of the Exercise
// it belongs to. Adjusting the rest tells the caller the Set's new `restSeconds` through
// `onSetRest`; the caller stores it and hands the stored Set back as `restFrom`.

/**
 * The set screen under a parent that owns the Session's Sets the way WorkoutFeature does:
 * `restFrom` is always the latest of them by `loggedAt` (a push-ups Set rests 90 s, a back-squat
 * Set 180 s), and the log, delete and `onSetRest` doubles store what they are told.
 */
function renderWithSessionRest(initial: SetEntry[], over: Partial<SetScreenProps> = {}) {
  const user = userEvent.setup()
  const onSetRest = vi.fn()
  const baseLog = sessionLogSet()
  let current = initial

  function Parent(): JSX.Element {
    const [entries, setEntries] = useState<SetEntry[]>(initial)
    current = entries
    const latest = entries.reduce<SetEntry | null>(
      (found, entry) => (found === null || entry.loggedAt > found.loggedAt ? entry : found),
      null,
    )
    const squats = entries
      .filter((entry) => entry.exerciseId === 'back-squat')
      .sort((a, b) => a.setIndex - b.setIndex)
    return (
      <SetScreen
        exercise={backSquat}
        plan={squatPlan}
        setIndex={initial.filter((entry) => entry.exerciseId === 'back-squat').length + 1}
        sessionId={SESSION_ID}
        sessionStartedAt={BASE}
        lastEntries={[]}
        logged={squats}
        restFrom={
          latest === null
            ? null
            : { entry: latest, planRestSeconds: latest.exerciseId === 'push-ups' ? 90 : 180 }
        }
        onLog={async (id, entry) => {
          const session = await baseLog(id, entry)
          setEntries((before) => [...before, entry])
          return session
        }}
        onLogged={() => undefined}
        onSetRest={async (entry, restSeconds) => {
          onSetRest(entry, restSeconds)
          setEntries((before) =>
            before.map((stored) =>
              stored.exerciseId === entry.exerciseId && stored.setIndex === entry.setIndex
                ? { ...stored, restSeconds }
                : stored,
            ),
          )
        }}
        onDeleteSet={async (setIndex) => {
          const removed = current.find(
            (entry) => entry.exerciseId === 'back-squat' && entry.setIndex === setIndex,
          ) as SetEntry
          setEntries((before) => before.filter((entry) => entry !== removed))
          return removed
        }}
        {...over}
      />
    )
  }
  render(<Parent />)
  return { user, onSetRest }
}

/** A back-squat Set of this Session, logged at `loggedAt`. */
function squatEntry(setIndex: number, loggedAt: number): SetEntry {
  return { exerciseId: 'back-squat', setIndex, weightKg: 60, reps: 10, loggedAt }
}

function plus15(): HTMLElement {
  return screen.getByRole('button', { name: '+15 s' })
}

function minus15(): HTMLElement {
  return screen.getByRole('button', { name: /^[−-]15 s$/ })
}

function skip(): HTMLElement {
  return screen.getByRole('button', { name: 'Skip' })
}

test('O4 tapping +15 s with 1:20 of rest left makes the rest readout read 1:35', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])
  expect(readoutValue(restReadout())).toBe('1:20')

  await user.click(plus15())

  await waitFor(() => expect(readoutValue(restReadout())).toBe('1:35'))
})

test('O4 tapping +15 s tells onSetRest the Set with a rest of 195 s', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user, onSetRest } = renderWithSessionRest([squatEntry(1, BASE)])

  await user.click(plus15())

  await waitFor(() => expect(onSetRest).toHaveBeenCalledTimes(1))
  expect(onSetRest).toHaveBeenCalledWith(
    expect.objectContaining({ exerciseId: 'back-squat', setIndex: 1, loggedAt: BASE }),
    195,
  )
})

test('O4 tapping −15 s with 1:20 of rest left makes the rest readout read 1:05', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])

  await user.click(minus15())

  await waitFor(() => expect(readoutValue(restReadout())).toBe('1:05'))
})

test('O4 tapping −15 s tells onSetRest the Set with a rest of 165 s', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user, onSetRest } = renderWithSessionRest([squatEntry(1, BASE)])

  await user.click(minus15())

  await waitFor(() => expect(onSetRest).toHaveBeenCalledTimes(1))
  expect(onSetRest).toHaveBeenCalledWith(
    expect.objectContaining({ exerciseId: 'back-squat', setIndex: 1, loggedAt: BASE }),
    165,
  )
})

test('O4 tapping −15 s with 10 s of rest left ends the rest at +0:00 over, never below zero', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 170_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])
  expect(readoutValue(restReadout())).toBe('0:10')

  await user.click(minus15())

  await waitFor(() => expect(readoutValue(restReadout())).toBe('+0:00 over'))
})

test('O4 tapping −15 s with 10 s of rest left stores the 170 s already rested', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 170_000)
  const { user, onSetRest } = renderWithSessionRest([squatEntry(1, BASE)])

  await user.click(minus15())

  await waitFor(() => expect(onSetRest).toHaveBeenCalledTimes(1))
  expect(onSetRest.mock.calls[0][1]).toBe(170)
})

test('O4 tapping Skip makes the rest readout read +0:00 over', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])

  await user.click(skip())

  await waitFor(() => expect(readoutValue(restReadout())).toBe('+0:00 over'))
})

test('O4 tapping Skip tells onSetRest the Set with the 100 s already rested', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user, onSetRest } = renderWithSessionRest([squatEntry(1, BASE)])

  await user.click(skip())

  await waitFor(() => expect(onSetRest).toHaveBeenCalledTimes(1))
  expect(onSetRest).toHaveBeenCalledWith(
    expect.objectContaining({ exerciseId: 'back-squat', setIndex: 1, loggedAt: BASE }),
    100,
  )
})

test('O4 after Skip the rest readout counts up: 42 s later it reads +0:42 over', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE + 100_000)
  renderWithSessionRest([squatEntry(1, BASE)])
  await tapWithFakeTimers(skip())
  expect(readoutValue(restReadout())).toBe('+0:00 over')

  await vi.advanceTimersByTimeAsync(42_000)

  expect(readoutValue(restReadout())).toBe('+0:42 over')
})

test('O4 Skip ends the rest silently: playRestOver is never called', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  renderWithSessionRest([pushUpEntry(1, 12, BASE)])
  await vi.advanceTimersByTimeAsync(30_000)

  await tapWithFakeTimers(skip())
  await vi.advanceTimersByTimeAsync(200_000)

  expect(playRestOver).not.toHaveBeenCalled()
})

test('O4 after +15 s the beep fires once, at the adjusted zero rather than the Plan rest', async () => {
  // A push-ups Set at BASE rests 90 s; +15 s at 80 s in makes it 105 s.
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  renderWithSessionRest([pushUpEntry(1, 12, BASE)])
  await vi.advanceTimersByTimeAsync(80_000)
  await tapWithFakeTimers(plus15())

  await vi.advanceTimersByTimeAsync(20_000)
  expect(playRestOver).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(6_000)
  expect(playRestOver).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(10_000)
  expect(playRestOver).toHaveBeenCalledTimes(1)
})

test('O4 after −15 s the beep fires once, at the earlier adjusted zero', async () => {
  // A push-ups Set at BASE rests 90 s; −15 s at 10 s in makes it 75 s.
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  renderWithSessionRest([pushUpEntry(1, 12, BASE)])
  await vi.advanceTimersByTimeAsync(10_000)
  await tapWithFakeTimers(minus15())

  await vi.advanceTimersByTimeAsync(64_000)
  expect(playRestOver).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(2_000)
  expect(playRestOver).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(10_000)
  expect(playRestOver).toHaveBeenCalledTimes(1)
})

test("O4 a set screen opened on a Set whose rest was changed to 195 s shows that rest, not the Plan's", () => {
  // What a reload hands back: the stored Set carries restSeconds 195 against the Plan's 180.
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 2,
    restFrom: { entry: { ...historyEntry(1, 60, 10), restSeconds: 195 }, planRestSeconds: 180 },
  })

  expect(readoutValue(restReadout())).toBe('1:35')
})

test("O4 the rest follows the Session's latest Set of another Exercise, by that Exercise's Plan rest", () => {
  // Back squat on screen (Plan rest 180 s); the Session's latest Set is push-ups (90 s), 30 s ago.
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 30_000)
  renderSetScreen({
    setIndex: 1,
    restFrom: { entry: pushUpEntry(1, 12, BASE), planRestSeconds: 90 },
  })

  expect(readoutValue(restReadout())).toBe('1:00')
})

test('O4 with restFrom null no rest shows, even when lastEntries hold a Set of this Session', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({ setIndex: 2, lastEntries: [historyEntry(1, 60, 10)], restFrom: null })

  expect(screen.queryByRole('timer', { name: 'Rest remaining' })).toBeNull()
})

test('O4 after a log the rest follows the Set just logged, not the earlier restFrom', async () => {
  // restFrom is a push-ups Set 50 s ago (40 s of its 90 s left); the back-squat Set logged now
  // rests squatPlan's 180 s.
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderSetScreen({
    setIndex: 1,
    restFrom: { entry: pushUpEntry(1, 12, BASE + 50_000), planRestSeconds: 90 },
  })
  expect(readoutValue(restReadout())).toBe('0:40')

  await user.click(logButton())

  await waitFor(() => expect(readoutValue(restReadout())).toBe('3:00'))
})

test('O4 once rest is over, −15 s, +15 s and Skip are not offered', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 200_000)
  renderSetScreen({
    setIndex: 2,
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })
  expect(restReadout()).toBeVisible()

  expect(screen.queryByRole('button', { name: '+15 s' })).toBeNull()
  expect(screen.queryByRole('button', { name: /^[−-]15 s$/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
})

test('O4 while rest runs, −15 s, +15 s and Skip are offered', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 2,
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  expect(plus15()).toBeVisible()
  expect(minus15()).toBeVisible()
  expect(skip()).toBeVisible()
})

test('O4 a rest that ran out 20 s ago reads +0:20 over', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 200_000)
  renderSetScreen({
    setIndex: 2,
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  expect(readoutValue(restReadout())).toBe('+0:20 over')
})

test('O4 after the latest Set is deleted, rest follows the new latest Set', async () => {
  // Set 1 at BASE; set 2 is logged on screen 60 s later. Deleting set 2 at 100 s leaves set 1 as
  // the latest: 180 s from BASE, 1:20 left.
  let clock = BASE + 60_000
  vi.spyOn(Date, 'now').mockImplementation(() => clock)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])
  await user.click(logButton())
  await waitFor(() => expect(readoutValue(restReadout())).toBe('3:00'))
  clock = BASE + 100_000

  await user.click(await screen.findByRole('button', { name: '50 × 8' }))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))

  await waitFor(() => expect(readoutValue(restReadout())).toBe('1:20'))
})

// E13-T11: the Next Set line while rest is showing.
const NEXT_LINE = /^Next: set /

test('O9 while resting before a planned Set the screen shows Next: set 2 · 60 kg × 8–10', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 2,
    lastEntries: [historyEntry(1, 60, 10)],
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  expect(screen.getByText('Next: set 2 · 60 kg × 8–10')).toBeVisible()
})

test('O9 a Bodyweight Exercise reads Next: set 2 · BW × 10–15', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 30_000)
  renderSetScreen({
    exercise: pushUps,
    plan: pushUpPlan,
    setIndex: 2,
    lastEntries: [pushUpEntry(1, 12, BASE)],
    restFrom: { entry: pushUpEntry(1, 12, BASE), planRestSeconds: 90 },
  })

  expect(screen.getByText('Next: set 2 · BW × 10–15')).toBeVisible()
})

test('O9 without rest there is no Next line', () => {
  renderSetScreen({ setIndex: 2, lastEntries: [historyEntry(1, 60, 10)], restFrom: null })

  expect(screen.queryByText(NEXT_LINE)).toBeNull()
})

test('O9 on an extra Set past the plan there is no Next line', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 5,
    extra: true,
    lastEntries: [historyEntry(4, 60, 10)],
    restFrom: { entry: historyEntry(4, 60, 10), planRestSeconds: 180 },
  })

  expect(screen.queryByText(NEXT_LINE)).toBeNull()
})

test('O9 in the done state there is no Next line', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 5,
    lastEntries: [historyEntry(4, 60, 10)],
    restFrom: { entry: historyEntry(4, 60, 10), planRestSeconds: 180 },
  })

  expect(screen.queryByText(NEXT_LINE)).toBeNull()
})

// E13-T10: the Log set button carries the rest, and the logged cue.

test('O7 with 1:24 of rest left the Log set button reads "Rest 1:24" and is still named Log set', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 96_000)
  renderSetScreen({
    setIndex: 2,
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  expect(readoutValue(logButton())).toBe('Rest 1:24')
})

test('O7 once the rest is over 42 s ago the Log set button reads "Rest +0:42" and is still named Log set', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 222_000)
  renderSetScreen({
    setIndex: 2,
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  expect(readoutValue(logButton())).toBe('Rest +0:42')
})

test('O7 the rest on the Log set button counts down with the clock', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE + 96_000)
  renderSetScreen({
    setIndex: 2,
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })
  expect(readoutValue(logButton())).toBe('Rest 1:24')

  await vi.advanceTimersByTimeAsync(10_000)

  expect(readoutValue(logButton())).toBe('Rest 1:14')
})

test('O7 a Set that matches its Preset logs with one tap on the Log set button while it shows the rest', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 96_000)
  const { user, onLog } = renderSetScreen({
    setIndex: 2,
    lastEntries: [historyEntry(1, 60, 10)],
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })
  expect(readoutValue(logButton())).toBe('Rest 1:24')

  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect(onLog.mock.calls[0][1]).toEqual(
    expect.objectContaining({ exerciseId: 'back-squat', setIndex: 2, weightKg: 60, reps: 10 }),
  )
})

test('O8 tapping Log set shows "Logged ✓" with class log-set--confirmed, named Log set, and keeps the status text', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  renderWithSessionRest([])
  expect(readoutValue(logButton())).toBe('Log set')

  await tapWithFakeTimers(logButton())

  expect(readoutValue(logButton())).toBe('Logged ✓')
  expect(logButton()).toHaveClass('log-set--confirmed')
  expect(screen.getByText('Set 1 logged · 50 kg × 8')).toBeVisible()
})

test('O8 the confirmed state ends after 1.5 s: the button shows the rest again without the class', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  renderWithSessionRest([])
  await tapWithFakeTimers(logButton())
  await vi.advanceTimersByTimeAsync(1_400)
  expect(readoutValue(logButton())).toBe('Logged ✓')

  await vi.advanceTimersByTimeAsync(200)

  expect(logButton()).not.toHaveClass('log-set--confirmed')
  expect(readoutValue(logButton())).toMatch(/^Rest \d:\d\d$/)
  expect(screen.getByText('Set 1 logged · 50 kg × 8')).toBeVisible()
})

test('O8 the new row of the logged-set list carries just-logged for 1.5 s, and only that row', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  renderWithSessionRest([squatEntry(1, BASE - 60_000)])

  await tapWithFakeTimers(logButton())

  const rows = within(screen.getByRole('list', { name: 'Sets logged' })).getAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(rows[0]).not.toHaveClass('just-logged')
  expect(rows[1]).toHaveClass('just-logged')

  await vi.advanceTimersByTimeAsync(1_600)

  expect(rows[1]).not.toHaveClass('just-logged')
})

test('O8 tapping Log set inside the confirmed window still logs the next Set', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  const { onLog } = renderWithSessionRestLogging()

  await tapWithFakeTimers(logButton())
  await vi.advanceTimersByTimeAsync(500)
  expect(logButton()).toHaveClass('log-set--confirmed')
  await tapWithFakeTimers(logButton())

  expect(onLog).toHaveBeenCalledTimes(2)
  expect(onLog.mock.calls[1][1]).toEqual(expect.objectContaining({ setIndex: 2 }))
  expect(readoutValue(logButton())).toBe('Logged ✓')
  expect(screen.getByText('Set 2 logged · 50 kg × 8')).toBeVisible()
})

/** `renderWithSessionRest` with a spy on the log double, to count what is logged. */
function renderWithSessionRestLogging() {
  const onLog = vi.fn()
  const inner = sessionLogSet()
  renderWithSessionRest([], {
    onLog: async (id, entry) => {
      onLog(id, entry)
      return inner(id, entry)
    },
  })
  return { onLog }
}

// --- E13-T9: the rest Dial (O5) and "Use for this exercise" (O6) ------------------------------
//
// The rest Dial opens from the rest readout: a listbox named "Rest ladder" whose options are the
// 15 s Rungs "0:15" … "10:00", with Set rest and Cancel. A back-squat Set at BASE rests
// squatPlan's 180 s; the clock is frozen 100 s later (1:20 left) unless a test says otherwise.

/** Taps the rest readout and answers the rest Dial's Rung column. */
async function openRestDial(user: UserEvent): Promise<HTMLElement> {
  await user.click(restReadout())
  return screen.findByRole('listbox', { name: 'Rest ladder' })
}

/** Opens the rest Dial, picks the Rung `label` ("2:30") and taps Set rest. */
async function setRestOnDial(user: UserEvent, label: string): Promise<void> {
  const ladder = await openRestDial(user)
  await user.click(within(ladder).getByRole('option', { name: label }))
  await user.click(screen.getByRole('button', { name: 'Set rest' }))
}

function useRestOffer(name: string): HTMLElement | null {
  return screen.queryByRole('button', { name })
}

test('O5 tapping a running rest readout opens the rest Dial on the current length, 3:00', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])

  const ladder = await openRestDial(user)

  const selected = within(ladder).getAllByRole('option', { selected: true })
  expect(selected.map((option) => option.textContent)).toEqual(['3:00'])
})

test("O5 the rest Dial opens on the Set's own changed length, not the Plan's", async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([{ ...squatEntry(1, BASE), restSeconds: 120 }])

  const ladder = await openRestDial(user)

  const selected = within(ladder).getAllByRole('option', { selected: true })
  expect(selected.map((option) => option.textContent)).toEqual(['2:00'])
})

test('O5 the rest Dial has 40 Rungs, 15 s apart, from 0:15 to 10:00', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])

  const ladder = await openRestDial(user)

  const rungs = within(ladder)
    .getAllByRole('option')
    .map((option) => option.textContent)
  expect(rungs).toHaveLength(40)
  expect(rungs.slice(0, 3)).toEqual(['0:15', '0:30', '0:45'])
  expect(rungs.slice(-2)).toEqual(['9:45', '10:00'])
})

test('O5 the rest Dial offers Set rest and Cancel', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])

  await openRestDial(user)

  expect(screen.getByRole('button', { name: 'Set rest' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
})

test('O5 tapping a rest readout that is over opens the rest Dial too', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 200_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])
  expect(readoutValue(restReadout())).toBe('+0:20 over')

  const ladder = await openRestDial(user)

  const selected = within(ladder).getAllByRole('option', { selected: true })
  expect(selected.map((option) => option.textContent)).toEqual(['3:00'])
})

test('O5 Set rest 2:30 with 100 s gone restarts the rest from loggedAt: the readout reads 0:50', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])

  await setRestOnDial(user, '2:30')

  await waitFor(() => expect(readoutValue(restReadout())).toBe('0:50'))
})

test('O5 Set rest 2:30 tells onSetRest the Set with a rest of 150 s', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user, onSetRest } = renderWithSessionRest([squatEntry(1, BASE)])

  await setRestOnDial(user, '2:30')

  await waitFor(() => expect(onSetRest).toHaveBeenCalledTimes(1))
  expect(onSetRest).toHaveBeenCalledWith(
    expect.objectContaining({ exerciseId: 'back-squat', setIndex: 1, loggedAt: BASE }),
    150,
  )
})

test('O5 Set rest 1:30 with 100 s gone reads as over: +0:10 over', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])

  await setRestOnDial(user, '1:30')

  await waitFor(() => expect(readoutValue(restReadout())).toBe('+0:10 over'))
})

test('O5 Set rest 4:00 on a rest over by 0:20 runs it again: the readout reads 0:40', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 200_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])

  await setRestOnDial(user, '4:00')

  await waitFor(() => expect(readoutValue(restReadout())).toBe('0:40'))
})

test('O5 Set rest closes the rest Dial', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])

  await setRestOnDial(user, '2:30')

  await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Rest ladder' })).toBeNull())
})

test('O5 Cancel on the rest Dial closes it and changes nothing', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user, onSetRest } = renderWithSessionRest([squatEntry(1, BASE)])
  const ladder = await openRestDial(user)
  await user.click(within(ladder).getByRole('option', { name: '2:30' }))

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Rest ladder' })).toBeNull())
  expect(readoutValue(restReadout())).toBe('1:20')
  expect(onSetRest).not.toHaveBeenCalled()
})

test('O6 after Set rest 2:30 an inline Use 2:30 for Back squat shows', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)], {
    programName: 'A/B Split',
    onUseRestForExercise: vi.fn(async () => undefined),
  })

  await setRestOnDial(user, '2:30')

  expect(await screen.findByRole('button', { name: 'Use 2:30 for Back squat' })).toBeVisible()
})

test('O6 tapping Use 2:30 for Back squat tells onUseRestForExercise 150 s', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const onUseRestForExercise = vi.fn(async () => undefined)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)], {
    programName: 'A/B Split',
    onUseRestForExercise,
  })
  await setRestOnDial(user, '2:30')

  await user.click(await screen.findByRole('button', { name: 'Use 2:30 for Back squat' }))

  expect(onUseRestForExercise).toHaveBeenCalledTimes(1)
  expect(onUseRestForExercise).toHaveBeenCalledWith(150)
})

test('O6 once the Program is saved the line reads Saved to A/B Split in place of the offer', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)], {
    programName: 'A/B Split',
    onUseRestForExercise: vi.fn(async () => undefined),
  })
  await setRestOnDial(user, '2:30')

  await user.click(await screen.findByRole('button', { name: 'Use 2:30 for Back squat' }))

  expect(await screen.findByText('Saved to A/B Split')).toBeVisible()
  expect(useRestOffer('Use 2:30 for Back squat')).toBeNull()
})

test("O6 when onUseRestForExercise rejects, its message shows inline and no Saved to line", async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)], {
    programName: 'A/B Split',
    onUseRestForExercise: vi.fn(async () => {
      throw new Error('Could not save the Program')
    }),
  })
  await setRestOnDial(user, '2:30')

  await user.click(await screen.findByRole('button', { name: 'Use 2:30 for Back squat' }))

  expect(await screen.findByText('Could not save the Program')).toBeVisible()
  expect(screen.queryByText(/^Saved to/)).toBeNull()
})

test('O6 Cancel on the rest Dial offers no Use for this exercise', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)], {
    programName: 'A/B Split',
    onUseRestForExercise: vi.fn(async () => undefined),
  })
  const ladder = await openRestDial(user)
  await user.click(within(ladder).getByRole('option', { name: '2:30' }))

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Rest ladder' })).toBeNull())
  expect(screen.queryByRole('button', { name: /^Use .* for / })).toBeNull()
})

test('O6 +15 s after Set rest withdraws the Use offer: ±15 s never offers it', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)], {
    programName: 'A/B Split',
    onUseRestForExercise: vi.fn(async () => undefined),
  })
  await setRestOnDial(user, '2:30')
  await screen.findByRole('button', { name: 'Use 2:30 for Back squat' })

  await user.click(plus15())

  await waitFor(() => expect(readoutValue(restReadout())).toBe('1:05'))
  expect(screen.queryByRole('button', { name: /^Use .* for / })).toBeNull()
})

test('O6 Skip after Set rest withdraws the Use offer: Skip never offers it', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)], {
    programName: 'A/B Split',
    onUseRestForExercise: vi.fn(async () => undefined),
  })
  await setRestOnDial(user, '2:30')
  await screen.findByRole('button', { name: 'Use 2:30 for Back squat' })

  await user.click(skip())

  await waitFor(() => expect(readoutValue(restReadout())).toBe('+0:00 over'))
  expect(screen.queryByRole('button', { name: /^Use .* for / })).toBeNull()
})

// --- fix-rest-corner [F1]: the rest panel sits at the set screen's top-right corner ---------

test('F1 the rest panel is the first element of the set screen, before the links and the Dials', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  const screenEl = document.querySelector('.set-screen')
  const panel = document.querySelector('.rest-timer')
  expect(panel).not.toBeNull()
  expect(screenEl?.firstElementChild).toBe(panel)
  expect(panel?.textContent).toContain('1:20')
  expect(panel?.querySelector('.rest-controls')).not.toBeNull()
})

test('F1 the stylesheet places .rest-timer top-right with its content right-aligned', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'SetScreen.css'), 'utf-8')
  const rule = /(?:^|\})\s*\.rest-timer\s*\{([^}]*)\}/m.exec(css)
  expect(rule).not.toBeNull()
  const body = rule?.[1] ?? ''
  expect(body).toMatch(/position:\s*(absolute|fixed)/)
  expect(body).toMatch(/top:/)
  expect(body).toMatch(/right:/)
  expect(body).toMatch(/justify-content:\s*flex-end|text-align:\s*right/)
})

// --- E14-T8 O4: warm-ups don't use up the Plan's Sets; setIndex still numbers every Set -------

function warmupEntry(setIndex: number, weightKg: number, reps: number): SetEntry {
  return { ...loggedEntry(setIndex, weightKg, reps), kind: 'warmup' }
}

/** Today on a 3-Set back squat Plan: warm-ups 40×10 and 50×8, then one working Set 60×8. */
const twoWarmupsOneWorking: SetEntry[] = [
  warmupEntry(1, 40, 10),
  warmupEntry(2, 50, 8),
  loggedEntry(3, 60, 8),
]

test('O4 with 2 warm-ups and 1 working Set logged on a 3-Set Plan the counter reads Set 2 of 3', () => {
  renderWithLogged(twoWarmupsOneWorking, { plan: threeSetSquatPlan })

  expect(screen.getByText('Set 2 of 3')).toBeVisible()
})

test('O4 with 2 warm-ups and 1 working Set logged on a 3-Set Plan the screen offers Log set, not the done state', () => {
  renderWithLogged(twoWarmupsOneWorking, { plan: threeSetSquatPlan, onAddSet: vi.fn() })

  expect(logSetButton()).not.toBeNull()
  expect(addSetButton()).toBeNull()
})

test('O4 with 2 warm-ups and 3 working Sets logged on a 3-Set Plan the done state reads All 3 sets logged', () => {
  renderWithLogged(
    [...twoWarmupsOneWorking, loggedEntry(4, 62.5, 8), loggedEntry(5, 65, 6)],
    { plan: threeSetSquatPlan, onAddSet: vi.fn() },
  )

  expect(screen.getByText('All 3 sets logged')).toBeVisible()
  expect(logSetButton()).toBeNull()
})

test('O4 after 2 warm-ups and 1 working Set, logging 2 more working Sets reaches the done state', async () => {
  const { user } = renderWithLogged(twoWarmupsOneWorking, { plan: threeSetSquatPlan })

  await user.click(logButton())
  await waitFor(() => expect(screen.getByText('Set 3 of 3')).toBeVisible())
  await user.click(await screen.findByRole('button', { name: 'Log set' }))

  await waitFor(() => expect(screen.getByText('All 3 sets logged')).toBeVisible())
  expect(logSetButton()).toBeNull()
})

test('O4 the working Set logged after 2 warm-ups and 1 working Set takes setIndex 4', async () => {
  const { user } = renderWithLogged(twoWarmupsOneWorking, { plan: threeSetSquatPlan })

  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(1))
  expect((await storedEntries())[0].setIndex).toBe(4)
})

test('O4 deleting a warm-up leaves the counter on Set 2 of 3', async () => {
  const { user, onDeleteSet } = renderWithLogged(twoWarmupsOneWorking, { plan: threeSetSquatPlan })

  await user.click(screen.getByRole('button', { name: /50 × 8$/ }))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))

  await waitFor(() => expect(onDeleteSet).toHaveBeenCalledWith(2))
  await waitFor(() => expect(screen.getByText('Set 2 of 3')).toBeVisible())
  expect(logSetButton()).not.toBeNull()
})

test('O4 while resting after 2 warm-ups and 1 working Set on a 3-Set Plan the Next line shows', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderWithLogged(twoWarmupsOneWorking, {
    plan: threeSetSquatPlan,
    restFrom: { entry: loggedEntry(3, 60, 8), planRestSeconds: 180 },
  })

  expect(screen.getByText(NEXT_LINE)).toBeVisible()
})

// --- E14-T11 [O11]: the Exercise note above the Dials ---------------------------------------

test('O11 an Exercise note shows above the Dials', () => {
  renderSetScreen({
    exerciseNote: 'belt on, chalk',
    onSaveExerciseNote: vi.fn(async () => undefined),
  })

  const note = screen.getByText('belt on, chalk')
  expect(note).toBeVisible()
  expect(
    note.compareDocumentPosition(weightReadout()) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull()
})

test('O11 without a note an Add note link shows above the Dials', () => {
  renderSetScreen({ exerciseNote: null, onSaveExerciseNote: vi.fn(async () => undefined) })

  const add = screen.getByRole('button', { name: 'Add note' })
  expect(
    add.compareDocumentPosition(weightReadout()) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})

test('O11 tapping the note opens an editor holding it, limited to 500 characters', async () => {
  const { user } = renderSetScreen({
    exerciseNote: 'belt on',
    onSaveExerciseNote: vi.fn(async () => undefined),
  })

  await user.click(screen.getByText('belt on'))

  const editor = screen.getByLabelText('Note') as HTMLTextAreaElement
  expect(editor.value).toBe('belt on')
  expect(editor.maxLength).toBe(500)
  expect(screen.getByRole('button', { name: 'Save note' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
})

test('O11 Save note hands the edited text to onSaveExerciseNote and closes the editor', async () => {
  const onSave = vi.fn(async () => undefined)
  const { user } = renderSetScreen({ exerciseNote: 'belt on', onSaveExerciseNote: onSave })

  await user.click(screen.getByText('belt on'))
  await user.clear(screen.getByLabelText('Note'))
  await user.type(screen.getByLabelText('Note'), 'belt off')
  await user.click(screen.getByRole('button', { name: 'Save note' }))

  await waitFor(() => expect(onSave).toHaveBeenCalledWith('belt off'))
  await waitFor(() => expect(screen.queryByLabelText('Note')).toBeNull())
})

test('O11 Add note then Save note saves the typed text', async () => {
  const onSave = vi.fn(async () => undefined)
  const { user } = renderSetScreen({ exerciseNote: null, onSaveExerciseNote: onSave })

  await user.click(screen.getByRole('button', { name: 'Add note' }))
  await user.type(screen.getByLabelText('Note'), 'pin 4')
  await user.click(screen.getByRole('button', { name: 'Save note' }))

  await waitFor(() => expect(onSave).toHaveBeenCalledWith('pin 4'))
})

test('O11 Cancel leaves the note as it was and saves nothing', async () => {
  const onSave = vi.fn(async () => undefined)
  const { user } = renderSetScreen({ exerciseNote: 'belt on', onSaveExerciseNote: onSave })

  await user.click(screen.getByText('belt on'))
  await user.type(screen.getByLabelText('Note'), ' extra')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByLabelText('Note')).toBeNull()
  expect(screen.getByText('belt on')).toBeVisible()
  expect(onSave).not.toHaveBeenCalled()
})

test('O11 saving the note empty hands an empty string to onSaveExerciseNote', async () => {
  const onSave = vi.fn(async () => undefined)
  const { user } = renderSetScreen({ exerciseNote: 'belt on', onSaveExerciseNote: onSave })

  await user.click(screen.getByText('belt on'))
  await user.clear(screen.getByLabelText('Note'))
  await user.click(screen.getByRole('button', { name: 'Save note' }))

  await waitFor(() => expect(onSave).toHaveBeenCalledWith(''))
})
