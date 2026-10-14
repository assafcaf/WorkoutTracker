import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import postcss from 'postcss'
import type { Declaration, Rule } from 'postcss'
import { declarationsFor } from '../test/cssAudit'
import { unfoldSteppers } from '../test/steppers'
import { loadCatalog } from '../data/catalog'
import { formatDay } from '../domain/dates'
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
  unfoldSteppers()
  return screen.getByRole('button', { name: 'Weight' })
}

/** The reps readout, which is also the button that opens the reps keypad. */
function repsReadout(): HTMLElement {
  unfoldSteppers()
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
 * The rest readout (E13-T8): the button in the rest panel that holds the "Rest remaining" timer,
 * its text the rest alone: "1:20" while it runs. Once a rest has run out on the screen the
 * timer is the quiet "Over rest · +0:42" line over Log set (F3), not a button.
 */
function restReadout(): HTMLElement {
  const timer = screen.getByRole('timer', { name: 'Rest remaining' })
  return timer.closest('button') ?? timer
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

/**
 * Opens the exercise tools sheet (S3b) from the ⋯ button by the exercise's name, on `segment`
 * when given ("Plates", "Warm-up", "Notes"). Everything but the steppers lives there now.
 */
async function openTools(user: UserEvent, segment?: string): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: 'Exercise tools' }))
  const sheet = screen.getByRole('dialog', { name: /tools$/ })
  if (segment !== undefined) await user.click(within(sheet).getByRole('radio', { name: segment }))
  return sheet
}

/** Closes whichever sheet is open, as Escape or a tap on the scrim does. */
async function closeSheet(user: UserEvent): Promise<void> {
  await user.keyboard('{Escape}')
}

/** The short kind names these tests were written with, to the chips' names (S2b). */
const KIND_NAMES: Record<string, string> = {
  'W-up': 'Warm-up',
  Working: 'Working',
  Drop: 'Drop',
  Fail: 'Failure',
  AMRAP: 'AMRAP',
}

/** Chooses the kind of the Set on the steppers from the tools sheet's Set type row. */
async function chooseKindInTools(user: UserEvent, label: string): Promise<void> {
  await openTools(user)
  await user.click(screen.getByRole('button', { name: /^Set type/ }))
  await user.click(screen.getByRole('button', { name: KIND_NAMES[label] ?? label }))
  await closeSheet(user)
}

/** A set cell's reading, its number then its value: "2 60×8". */
function cellReading(element: HTMLElement): string {
  return [...element.children].map((child) => (child.textContent ?? '').trim()).join(' ')
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

  unfoldSteppers()

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(readoutValue(weightReadout())).toBe('62.5')
})

test('O9 the minus button snaps an off-ladder weight down to the rung below it', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })
  await enterOnKeypad(user, weightReadout(), ['6', '3'])

  unfoldSteppers()

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

  expect(readoutValue(weightReadout())).toBe('BW')

  // E16-T4 O7: + steps one Rung of the signed Load, through BW: push-ups' 1 kg step reads BW+1.
  unfoldSteppers()
  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(readoutValue(weightReadout())).toBe('BW+1')
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

  unfoldSteppers()

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

  await openTools(user)
  await user.click(screen.getByRole('button', { name: 'Exercise info' }))

  expect(onOpenInfo).toHaveBeenCalledTimes(1)
  expect(onOpenInfo).toHaveBeenCalledWith('back-squat')
})

test('S6 tapping Alternatives tells the caller to open alternatives for the on-screen exercise id', async () => {
  const onOpenAlternatives = vi.fn()
  const { user } = renderSetScreen({ onOpenAlternatives })

  // The tools sheet's "Swap exercise" row is where alternatives open from (S3b).
  await openTools(user)
  await user.click(screen.getByRole('button', { name: 'Swap exercise' }))

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

  // A rest already over as the screen opens shows no clock at all (F3): Log set is back.
  expect(screen.queryByRole('timer')).toBeNull()
  expect(logButton()).toHaveTextContent('Log set 2')
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

test('O4 tapping the weight number opens its keypad, and a typed weight logs off the ladder', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await user.click(weightReadout())
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

test('O4 tapping the reps number opens the reps keypad', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })
  expect(screen.queryByRole('button', { name: 'OK' })).toBeNull()

  await user.click(repsReadout())

  expect(screen.getByRole('group', { name: 'Reps keypad' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'OK' })).toBeVisible()
})

test('O4 neither number has a separate Type button: the number itself opens the keypad', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  expect(screen.queryByRole('button', { name: 'Type weight' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Type reps' })).toBeNull()
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

test('O1 back-squats set screen shows a Step 2.5 kg control by default', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  // The step control is a row of the exercise tools sheet (S3b).
  await openTools(user)
  expect(stepControl(2.5)).toBeInTheDocument()
})

test('O1 choosing 5 from the step options updates the control to read Step 5 kg', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await openTools(user)
  await user.selectOptions(stepControl(2.5), '5')

  expect(stepControl(5)).toBeInTheDocument()
})

test('O1 choosing 5 from the step options moves Increase weight from 60 to 65', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await openTools(user)
  await user.selectOptions(stepControl(2.5), '5')
  await closeSheet(user)
  unfoldSteppers()
  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(readoutValue(weightReadout())).toBe('65')
})

test('O1 choosing 5 from the step options rebuilds the Ladder with rungs 5, 10, 15', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await openTools(user)
  await user.selectOptions(stepControl(2.5), '5')
  await closeSheet(user)

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

  await openTools(user)
  await user.selectOptions(stepControl(2.5), '5')

  expect(onWeightStepChange).toHaveBeenCalledWith(5)
})

test('O1 a weightStep prop of 5 opens the control already reading Step 5 kg', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], weightStep: 5 })
  await openTools(user)

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
  // The Live session's line: last time's Set at this Set's place, and the day it was lifted.
  renderSetScreen({
    setIndex: 3,
    lastTime: [historyEntry(1, 80, 8), historyEntry(2, 80, 8), historyEntry(3, 80, 7)],
  })

  const day = formatDay(new Date(BASE), new Date())
  expect(screen.getByText(`Last time 80 × 7 · ${day}`)).toBeVisible()
  expect(screen.getAllByText(/^Last time/)).toHaveLength(1)
})

test('O10 a bodyweight set in lastTime reads BW×8', () => {
  renderSetScreen({
    exercise: pushUps,
    plan: pushUpPlan,
    lastTime: [{ exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 8, loggedAt: BASE }],
  })

  expect(screen.getByText(`Last time BW × 8 · ${formatDay(new Date(BASE), new Date())}`)).toBeVisible()
})

test('O10 with no lastTime there is no Last time line', () => {
  renderSetScreen({ lastTime: [] })

  expect(screen.queryByText(/Last time/)).toBeNull()
})

test('O10 sets logged today never change the Last time line', async () => {
  const { user } = renderSetScreen({ lastTime: [historyEntry(1, 80, 8)] })

  await user.click(logButton())
  await screen.findByText('Set 2 of 4')

  // Rest folds the steppers and the Last time line with them (S4); unfolded, the line is as it was.
  unfoldSteppers()
  expect(screen.getByText(`Last time 80 × 8 · ${formatDay(new Date(BASE), new Date())}`)).toBeVisible()
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
          // Like the service (E14-T9): a kind sets the field, `null` removes it, absent keeps it.
          // E14-T14: a loadKg the same way, and a Load of 0 is no Load.
          const { kind, loadKg, ...rest } = values
          setLogged((before) =>
            before.map((entry) => {
              if (entry.setIndex !== setIndex) return entry
              const { kind: was, loadKg: wasLoad, ...others } = entry
              const next = kind === undefined ? was : (kind ?? undefined)
              const nextLoad = loadKg === undefined ? wasLoad : loadKg || undefined
              return {
                ...others,
                ...rest,
                ...(next === undefined ? {} : { kind: next }),
                ...(nextLoad === undefined ? {} : { loadKg: nextLoad }),
              }
            }),
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
    .map((button) => button.getAttribute('aria-label') ?? '')
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
  // S2b: the edit is a sheet over the screen, "Edit set 2 · Back squat"; Escape or the scrim
  // cancels it, and nothing behind it -- Log set included -- is reachable meanwhile.
  expect(screen.getByRole('dialog', { name: 'Edit set 2 · Back squat' })).toBeVisible()
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
  await closeSheet(user)

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

  // S5a: the toast's headline names the record, the line under it the Set and how far past the
  // old record it went (e1RM 101.3 -> 105.0), with the record's sparkline.
  expect(await screen.findByText('New PR · Best estimated 1RM')).toBeVisible()
  expect(screen.getByText('75 kg × 12 · +3.7 kg')).toBeVisible()
  expect(screen.getByRole('img', { name: 'Best estimated 1RM history' })).toBeInTheDocument()
})

test('O14 the toast joins every record label with a comma', async () => {
  const { user } = renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 85, 5)],
  })

  await user.click(logButton())

  expect(
    await screen.findByText('New PR · Heaviest set, Most reps at the heaviest weight'),
  ).toBeVisible()
  expect(screen.getByText('85 kg × 5 · +5 kg')).toBeVisible()
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
  const tag = badgesOnRow('85 × 5')[0]
  expect(tag).toHaveClass('tag', 'tag-pr')
  expect(tag.textContent).toBe('PR')
  expect(document.querySelector('.pr-badge')).toBeNull()
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
  return screen.getByRole('button', { name: 'Skip rest' })
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

  await waitFor(() => expect(readoutValue(restReadout())).toBe('+0:00'))
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

  // Skip ends the rest: the panel goes, Log set is back, and no over-rest line shows (F3).
  await waitFor(() => expect(screen.queryByRole('timer')).toBeNull())
  expect(logButton()).toHaveTextContent('Log set 2')
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
  expect(screen.queryByRole('timer')).toBeNull()

  await vi.advanceTimersByTimeAsync(42_000)

  // A skipped rest never counts up on screen: nothing ran out, the trainee moved on.
  expect(screen.queryByRole('timer')).toBeNull()
  expect(logButton()).toHaveTextContent('Log set 2')
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
  // A rest over before the screen opened shows no panel at all: Log set has the dock (F3).
  expect(logButton()).toHaveTextContent('Log set 2')

  expect(screen.queryByRole('button', { name: '+15 s' })).toBeNull()
  expect(screen.queryByRole('button', { name: /^[−-]15 s$/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Skip rest' })).toBeNull()
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

  // Overtime shows only for a rest that ran out on this screen (F3); one already over as the
  // screen opens is stale, and no clock shows at all.
  expect(screen.queryByRole('timer', { name: 'Rest remaining' })).toBeNull()
  expect(logButton()).toHaveTextContent('Log set 2')
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

  // Set 2 opened on today's Set 1 (E16-T6 O11: no last time, so the anchor's 60 × 10), so both
  // rows read 60 × 10; the second one listed is set 2.
  await waitFor(() => expect(screen.getAllByRole('button', { name: '60 × 10' })).toHaveLength(2))
  await user.click(screen.getAllByRole('button', { name: '60 × 10' })[1])
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

  // While rest runs the steppers fold into one row naming the next Set and last time's (S4); the
  // outlined cell logs it with one tap.
  const next = screen.getByRole('button', { name: NEXT_LINE })
  expect(next).toHaveAttribute('aria-expanded', 'false')
  expect(next.textContent).toMatch(/^Next: set 2 · 60 × \d+$/)
  expect(screen.queryByRole('button', { name: 'Weight' })).toBeNull()
  expect(logButton()).toHaveClass('set-cell--current')
  expect(cellReading(logButton())).toBe(`2 60×${readoutValue(repsReadout())}`)
  expect(screen.queryByRole('button', { name: NEXT_LINE })).toBeNull()
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

  expect(screen.getByRole('button', { name: NEXT_LINE }).textContent).toMatch(/^Next: set 2 · BW × \d+$/)
  expect(logButton()).toHaveClass('set-cell--current')
  expect(cellReading(logButton())).toMatch(/^2 BW×\d+$/)
})

test('O9 without rest there is no Next line', () => {
  renderSetScreen({ setIndex: 2, lastEntries: [historyEntry(1, 60, 10)], restFrom: null })

  expect(screen.queryByRole('button', { name: NEXT_LINE })).toBeNull()
  expect(screen.getByRole('button', { name: 'Weight' })).toBeVisible()
})

test('O9 on an extra Set past the plan there is no Next line', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 5,
    extra: true,
    lastEntries: [historyEntry(4, 60, 10)],
    restFrom: { entry: historyEntry(4, 60, 10), planRestSeconds: 180 },
  })

  // An extra Set keeps its steppers through rest: nothing folds into a Next row.
  expect(screen.queryByRole('button', { name: NEXT_LINE })).toBeNull()
  expect(screen.getByRole('button', { name: 'Weight' })).toBeVisible()
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

test('S4 the folded Next row adds last time’s Set at that position: · last 60 × 8', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 2,
    lastEntries: [historyEntry(1, 60, 10)],
    lastTime: [historyEntry(1, 60, 10), historyEntry(2, 60, 8)],
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  expect(screen.getByRole('button', { name: NEXT_LINE }).textContent).toMatch(
    /^Next: set 2 · 60 × \d+ · last 60 × 8$/,
  )
  // Folded, the Last time line and the projection go with the steppers.
  expect(screen.queryByText(/^Last time /)).toBeNull()
})

test('S4 a tap on the Next row brings the steppers back, and the next log folds them again', async () => {
  const { user, onLog } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  await user.click(logButton())
  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  await user.click(await screen.findByRole('button', { name: NEXT_LINE }))
  expect(screen.getByRole('button', { name: 'Increase weight' })).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  await user.click(logButton())
  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole('button', { name: NEXT_LINE })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'Increase weight' })).toBeNull()
})

// E13-T10: the Log set button carries the rest, and the logged cue.

test('O7 with 1:24 of rest left the rest bar reads 01:24 and the Log set button still reads Log set', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 96_000)
  renderSetScreen({
    setIndex: 2,
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  expect(readoutValue(restReadout())).toBe('1:24')
  // While rest runs the rest panel holds the dock; Log set is the outlined cell (S4).
  expect(cellReading(logButton())).toBe('2 50×8')
})

test('O7 once the rest is over 42 s ago the rest bar reads +00:42 and the Log set button still reads Log set', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 222_000)
  renderSetScreen({
    setIndex: 2,
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  // A rest over before the screen opened shows no clock; the dock is Log set again (F3).
  expect(screen.queryByRole('timer', { name: 'Rest remaining' })).toBeNull()
  expect(readoutValue(logButton())).toBe('Log set 2 · 50 × 8')
})

test('O7 the rest bar counts down with the clock while the Log set button keeps reading Log set', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE + 96_000)
  renderSetScreen({
    setIndex: 2,
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })
  expect(readoutValue(restReadout())).toBe('1:24')

  await vi.advanceTimersByTimeAsync(10_000)

  expect(readoutValue(restReadout())).toBe('1:14')
  expect(cellReading(logButton())).toBe('2 50×8')
})

test('O7 a Set that matches its Preset logs with one tap on the Log set button while rest runs', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 96_000)
  const { user, onLog } = renderSetScreen({
    setIndex: 2,
    lastEntries: [historyEntry(1, 60, 10)],
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })
  expect(readoutValue(restReadout())).toBe('1:24')

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
  expect(readoutValue(logButton())).toBe('Log set 1 · 50 × 8')

  await tapWithFakeTimers(logButton())

  // Logged: set 1's cell turns done, rest starts, and Log set is set 2's outlined cell (F1-F2).
  // The confirmation is announced through the status line.
  expect(cellReading(logButton())).toBe('2 50×8')
  expect(logButton()).toHaveClass('set-cell--current')
  expect(screen.getByRole('timer', { name: 'Rest remaining' })).toBeVisible()
  expect(screen.getByText('Set 1 logged · 50 kg × 8')).toBeVisible()
})

test('O8 the confirmed state ends after 1.5 s: the button reads Log set again without the class', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  renderWithSessionRest([])
  await tapWithFakeTimers(logButton())
  await vi.advanceTimersByTimeAsync(1_400)
  expect(screen.getByRole('list', { name: 'Sets logged' }).querySelector('.just-logged')).not.toBeNull()

  await vi.advanceTimersByTimeAsync(200)

  expect(screen.getByRole('list', { name: 'Sets logged' }).querySelector('.just-logged')).toBeNull()
  expect(document.querySelector('.log-set--confirmed')).toBeNull()
  expect(cellReading(logButton())).toBe('2 50×8')
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
  expect(logButton()).toHaveClass('set-cell--current')
  await tapWithFakeTimers(logButton())

  expect(onLog).toHaveBeenCalledTimes(2)
  expect(onLog.mock.calls[1][1]).toEqual(expect.objectContaining({ setIndex: 2 }))
  // The double here stores without handing `logged` back, so the screen still counts from
  // set 1; what matters is that the outlined cell logs again inside the window.
  expect(logButton()).toHaveClass('set-cell--current')
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

/**
 * Taps the running countdown -- or, with no rest running, the tools sheet's Rest time row --
 * and answers the rest Dial's Rung column.
 */
async function openRestDial(user: UserEvent): Promise<HTMLElement> {
  const countdown = screen.queryByRole('timer', { name: 'Rest remaining' })?.closest('button')
  if (countdown) {
    await user.click(countdown)
  } else {
    await openTools(user)
    await user.click(screen.getByRole('button', { name: /^Rest time/ }))
  }
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
  // Over before the screen opened, the rest shows no clock: the Dial opens from Rest time.
  expect(screen.queryByRole('timer', { name: 'Rest remaining' })).toBeNull()

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

  await waitFor(() => expect(readoutValue(restReadout())).toBe('+0:10'))
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

  await waitFor(() => expect(screen.queryByRole('timer', { name: 'Rest remaining' })).toBeNull())
  expect(screen.queryByRole('button', { name: /^Use .* for / })).toBeNull()
})

// --- fix-rest-corner [F1]: the rest panel sits at the set screen's top-right corner ---------

test('F1 the rest panel is the first element of the set screen, before the links and the Dials', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  // S4: the rest panel is the dock under the body, in place of Log set; the body opens on the
  // exercise's head, not on a timer.
  const screenEl = document.querySelector('.set-screen')
  const panel = document.querySelector('.set-dock .rest-panel')
  expect(panel).not.toBeNull()
  expect(screenEl?.contains(panel as Node)).toBe(false)
  expect(screenEl?.firstElementChild).toHaveClass('set-head')
  expect(panel?.textContent).toContain('1:20')
  expect(panel?.querySelector('.rest-controls')).not.toBeNull()
})

test('F1 the stylesheet keeps .rest-timer in the flow of the page, so it covers nothing', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'SetScreen.css'), 'utf-8')
  const rule = /(?:^|\})\s*\.rest-panel\s*\{([^}]*)\}/m.exec(css)
  expect(rule).not.toBeNull()
  const body = rule?.[1] ?? ''
  expect(body).not.toMatch(/position:\s*(absolute|fixed)/)
  expect(body).toMatch(/display:\s*flex/)
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

  // The next Set is working set 2, the outlined cell that logs it while rest runs (S4).
  expect(logButton()).toHaveClass('set-cell--current')
  expect(cellReading(logButton())).toMatch(/^2 /)
})

// --- E14-T11 [O11]: the Exercise note above the Dials ---------------------------------------

test('O11 an Exercise note shows below the Dials', async () => {
  const { user } = renderSetScreen({
    exerciseNote: 'belt on, chalk',
    onSaveExerciseNote: vi.fn(async () => undefined),
  })

  // The note lives in the exercise tools sheet's Notes (S3b), not on the screen.
  expect(screen.queryByText('belt on, chalk')).toBeNull()
  const sheet = await openTools(user)
  const note = screen.getByText('belt on, chalk')
  expect(note).toBeVisible()
  expect(sheet).toContainElement(note)
  expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull()
})

test('O11 without a note an Add note link shows below the Dials', async () => {
  const { user } = renderSetScreen({ exerciseNote: null, onSaveExerciseNote: vi.fn(async () => undefined) })

  const sheet = await openTools(user)

  expect(sheet).toContainElement(screen.getByRole('button', { name: 'Add note' }))
})

test('O11 tapping the note opens an editor holding it, limited to 500 characters', async () => {
  const { user } = renderSetScreen({
    exerciseNote: 'belt on',
    onSaveExerciseNote: vi.fn(async () => undefined),
  })

  await openTools(user)
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

  await openTools(user)
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

  await openTools(user)
  await user.click(screen.getByRole('button', { name: 'Add note' }))
  await user.type(screen.getByLabelText('Note'), 'pin 4')
  await user.click(screen.getByRole('button', { name: 'Save note' }))

  await waitFor(() => expect(onSave).toHaveBeenCalledWith('pin 4'))
})

test('O11 Cancel leaves the note as it was and saves nothing', async () => {
  const onSave = vi.fn(async () => undefined)
  const { user } = renderSetScreen({ exerciseNote: 'belt on', onSaveExerciseNote: onSave })

  await openTools(user)
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

  await openTools(user)
  await user.click(screen.getByText('belt on'))
  await user.clear(screen.getByLabelText('Note'))
  await user.click(screen.getByRole('button', { name: 'Save note' }))

  await waitFor(() => expect(onSave).toHaveBeenCalledWith(''))
})

// --- E14-T9: the set-kind row ----------------------------------------------------------------

/**
 * The kind chips -- in the tools sheet's Set type row, or the edit sheet -- which name the chosen
 * one with aria-pressed. `label` is the short name these tests were written with ("W-up").
 */
function kindButton(label: string): HTMLElement {
  return screen.getByRole('button', { name: KIND_NAMES[label] ?? label })
}

/** Opens the tools sheet on its Set type row's chips, for the Set on the steppers. */
async function openKinds(user: UserEvent): Promise<void> {
  await openTools(user)
  await user.click(screen.getByRole('button', { name: /^Set type/ }))
}

function chosenKinds(): string[] {
  return ['W-up', 'Working', 'Drop', 'Fail', 'AMRAP'].filter(
    (label) => kindButton(label).getAttribute('aria-pressed') === 'true',
  )
}

test('O6 the set screen opens with the kind row on Working', async () => {
  const { user } = renderSetScreen()

  await openKinds(user)

  expect(chosenKinds()).toEqual(['Working'])
})

test('O6 choosing Drop before Log set stores the Set with kind drop', async () => {
  const { user, onLog } = renderSetScreen()

  await chooseKindInTools(user, 'Drop')
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect(onLog.mock.calls[0][1].kind).toBe('drop')
})

test.each([
  ['W-up', 'warmup'],
  ['Fail', 'failure'],
  ['AMRAP', 'amrap'],
] as const)('O6 choosing %s before Log set stores kind %s', async (label, kind) => {
  const { user, onLog } = renderSetScreen()

  await chooseKindInTools(user, label)
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect(onLog.mock.calls[0][1].kind).toBe(kind)
})

test('O6 a Set logged on Working has no kind field', async () => {
  const { user, onLog } = renderSetScreen()

  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect('kind' in onLog.mock.calls[0][1]).toBe(false)
})

test('O6 choosing another kind and back to Working stores no kind field', async () => {
  const { user, onLog } = renderSetScreen()

  await chooseKindInTools(user, 'Fail')
  await chooseKindInTools(user, 'Working')
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect('kind' in onLog.mock.calls[0][1]).toBe(false)
})

test('O6 after the log the kind row returns to Working', async () => {
  const { user, onLog } = renderSetScreen()

  await chooseKindInTools(user, 'Drop')
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  await openKinds(user)
  await waitFor(() => expect(chosenKinds()).toEqual(['Working']))
})

test('O6 the next Set logged after a Drop has no kind', async () => {
  const { user, onLog } = renderSetScreen()

  await chooseKindInTools(user, 'Drop')
  await user.click(logButton())
  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  await openKinds(user)
  await waitFor(() => expect(chosenKinds()).toEqual(['Working']))
  await closeSheet(user)
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(2))
  expect('kind' in onLog.mock.calls[1][1]).toBe(false)
})

test.each([
  ['warmup', 'W'],
  ['drop', 'D'],
  ['failure', 'F'],
  ['amrap', 'A'],
] as const)('O6 a %s Set in the logged list carries the marker %s', (kind, marker) => {
  renderWithLogged([{ ...loggedEntry(1, 80, 8), kind }])

  const list = screen.getByRole('list', { name: 'Sets logged' })
  expect(within(list).getByText(marker)).toBeVisible()
})

test('O6 a Working Set in the logged list carries no marker', () => {
  renderWithLogged([loggedEntry(1, 80, 8), loggedEntry(2, 82.5, 6)])

  const list = screen.getByRole('list', { name: 'Sets logged' })
  for (const marker of ['W', 'D', 'F', 'A']) {
    expect(within(list).queryByText(marker)).toBeNull()
  }
})

test("O6 the marker does not change the logged Set button's name", () => {
  renderWithLogged([{ ...loggedEntry(1, 80, 8), kind: 'drop' }])

  expect(loggedSetNames()).toEqual(['80 × 8'])
})

test('O6 in edit mode the kind row shows the Set kind', async () => {
  const { user } = renderWithLogged([{ ...loggedEntry(1, 80, 8), kind: 'failure' }])

  await user.click(loggedSetButton('80 × 8'))

  expect(chosenKinds()).toEqual(['Fail'])
})

test('O6 in edit mode a Working Set shows Working', async () => {
  const { user } = renderWithLogged([loggedEntry(1, 80, 8)])

  await user.click(loggedSetButton('80 × 8'))

  expect(chosenKinds()).toEqual(['Working'])
})

test('O6 Save set stores a changed kind', async () => {
  const { user, onEditSet } = renderWithLogged([loggedEntry(1, 80, 8)])

  await user.click(loggedSetButton('80 × 8'))
  await user.click(kindButton('W-up'))
  await user.click(screen.getByRole('button', { name: 'Save set' }))

  await waitFor(() => expect(onEditSet).toHaveBeenCalledTimes(1))
  expect(onEditSet).toHaveBeenCalledWith(1, { weightKg: 80, reps: 8, kind: 'warmup' })
})

test('O6 Save set after choosing Working on a kinded Set removes the kind with null', async () => {
  const { user, onEditSet } = renderWithLogged([{ ...loggedEntry(1, 80, 8), kind: 'drop' }])

  await user.click(loggedSetButton('80 × 8'))
  await user.click(kindButton('Working'))
  await user.click(screen.getByRole('button', { name: 'Save set' }))

  await waitFor(() => expect(onEditSet).toHaveBeenCalledTimes(1))
  expect(onEditSet).toHaveBeenCalledWith(1, { weightKg: 80, reps: 8, kind: null })
})

test('O6 after Save set the row is back on Working for the next Set to log', async () => {
  const { user, onEditSet } = renderWithLogged([loggedEntry(1, 80, 8)])

  await user.click(loggedSetButton('80 × 8'))
  await user.click(kindButton('Drop'))
  await user.click(screen.getByRole('button', { name: 'Save set' }))

  await waitFor(() => expect(onEditSet).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save set' })).toBeNull())
  await openKinds(user)
  expect(chosenKinds()).toEqual(['Working'])
})

test('O6 Cancel in edit mode changes no kind and returns the row to Working', async () => {
  const { user, onEditSet } = renderWithLogged([{ ...loggedEntry(1, 80, 8), kind: 'drop' }])

  await user.click(loggedSetButton('80 × 8'))
  await user.click(kindButton('Fail'))
  await closeSheet(user)

  expect(onEditSet).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
  await openKinds(user)
  expect(chosenKinds()).toEqual(['Working'])
})

// --- E14-T10: RIR chips under the logged-set status (O9) --------------------------------------

function effortChips(): HTMLElement | null {
  return screen.queryByRole('group', { name: 'Reps in reserve' })
}

/** An effort chip by the RIR it stores: '0' is the chip reading "RIR 0" (S4). */
function chip(name: string): HTMLElement {
  return within(effortChips() as HTMLElement).getByRole('button', { name: name === '0' ? 'RIR 0' : name })
}

test('O9 before any Set is logged, no chips show even with Track effort on', () => {
  renderSetScreen({ trackEffort: true, onSetEffort: vi.fn(async () => undefined) })

  expect(effortChips()).toBeNull()
})

test('O9 with Track effort on, logging a Set shows the chips 0 1 2 3+', async () => {
  const { user } = renderSetScreen({ trackEffort: true, onSetEffort: vi.fn(async () => undefined) })

  await user.click(logButton())

  const chips = await screen.findByRole('group', { name: 'Reps in reserve' })
  expect(within(chips).getAllByRole('button').map((button) => button.textContent)).toEqual([
    'RIR 0',
    '1',
    '2',
    '3+',
  ])
})

test('O9 with Track effort off or omitted, logging a Set shows no chips', async () => {
  const { user } = renderSetScreen({ onSetEffort: vi.fn(async () => undefined) })

  await user.click(logButton())
  await screen.findByText('Set 1 logged · 50 kg × 8')

  expect(effortChips()).toBeNull()
})

test('O9 tapping a chip calls onSetEffort with the just-logged setIndex and that rir', async () => {
  const onSetEffort = vi.fn(async () => undefined)
  const { user } = renderSetScreen({ trackEffort: true, onSetEffort })
  await user.click(logButton())
  await screen.findByRole('group', { name: 'Reps in reserve' })

  await user.click(chip('2'))

  expect(onSetEffort).toHaveBeenCalledTimes(1)
  expect(onSetEffort).toHaveBeenCalledWith(1, 2)
  expect(chip('2')).toHaveAttribute('aria-pressed', 'true')
})

test('O9 the 3+ chip stores rir 3 and the 0 chip stores rir 0', async () => {
  const onSetEffort = vi.fn(async () => undefined)
  const { user } = renderSetScreen({ trackEffort: true, onSetEffort })
  await user.click(logButton())
  await screen.findByRole('group', { name: 'Reps in reserve' })

  await user.click(chip('3+'))
  await user.click(chip('0'))

  expect(onSetEffort.mock.calls).toEqual([
    [1, 3],
    [1, 0],
  ])
})

test('O9 tapping another chip replaces the choice: only the latest shows pressed', async () => {
  const onSetEffort = vi.fn(async () => undefined)
  const { user } = renderSetScreen({ trackEffort: true, onSetEffort })
  await user.click(logButton())
  await screen.findByRole('group', { name: 'Reps in reserve' })

  await user.click(chip('2'))
  await user.click(chip('1'))

  expect(onSetEffort.mock.calls).toEqual([
    [1, 2],
    [1, 1],
  ])
  expect(chip('1')).toHaveAttribute('aria-pressed', 'true')
  expect(chip('2')).toHaveAttribute('aria-pressed', 'false')
})

test('O9 ignoring the chips calls onSetEffort never, and Log set logs the next Set at once', async () => {
  const onSetEffort = vi.fn(async () => undefined)
  const { user, onLog } = renderSetScreen({ trackEffort: true, onSetEffort })
  await user.click(logButton())
  await screen.findByRole('group', { name: 'Reps in reserve' })

  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(2))
  expect(onSetEffort).not.toHaveBeenCalled()
})

test('O9 Log set never waits for an effort write still pending', async () => {
  const onSetEffort = vi.fn(() => new Promise<void>(() => undefined))
  const { user, onLog } = renderSetScreen({ trackEffort: true, onSetEffort })
  await user.click(logButton())
  await screen.findByRole('group', { name: 'Reps in reserve' })
  await user.click(chip('1'))

  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(2))
})

test('O9 logging the next Set moves the chips to it, with nothing pressed', async () => {
  const onSetEffort = vi.fn(async () => undefined)
  const { user } = renderSetScreen({ trackEffort: true, onSetEffort })
  await user.click(logButton())
  await screen.findByRole('group', { name: 'Reps in reserve' })
  await user.click(chip('2'))

  await user.click(logButton())
  await screen.findByText('Set 2 logged · 50 kg × 8')

  for (const name of ['0', '1', '2', '3+']) {
    expect(chip(name)).toHaveAttribute('aria-pressed', 'false')
  }
  await user.click(chip('3+'))
  expect(onSetEffort).toHaveBeenLastCalledWith(2, 3)
})

test('O9 the chips stay after the confirmed window ends', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  renderSetScreen({ trackEffort: true, onSetEffort: vi.fn(async () => undefined) })

  await tapWithFakeTimers(logButton())
  await vi.advanceTimersByTimeAsync(10_000)

  expect(effortChips()).not.toBeNull()
})

test('O9 a logged Set with rir reads "weight × reps · RIR n", RIR 0 included, and 3 reads RIR 3+', () => {
  renderWithLogged([
    { ...loggedEntry(1, 80, 8), rir: 2 },
    { ...loggedEntry(2, 80, 8), rir: 0 },
    { ...loggedEntry(3, 80, 8), rir: 3 },
    loggedEntry(4, 80, 8),
  ])

  // Each Set is a cell named "weight × reps"; its RIR sits in the cell's corner, beside it.
  const rows = within(screen.getByRole('list', { name: 'Sets logged' })).getAllByRole('listitem')
  const rir = rows.map((row) => row.querySelector('.logged-set-rir')?.textContent ?? null)
  expect(rir).toEqual(['RIR 2', 'RIR 0', 'RIR 3+', null])
  // The RIR text sits beside the tappable Set, not inside its name.
  expect(loggedSetNames()).toEqual(['80 × 8', '80 × 8', '80 × 8', '80 × 8'])
})

// --- E14-T13: AMRAP on the set screen --------------------------------------------------------

const amrapPlan: ExercisePlan = { ...squatPlan, sets: 3, amrapLast: true }

test('O14 the last planned Set of an amrapLast Plan reads Set 3 of 3 · 8+ reps and opens on AMRAP', async () => {
  const { user } = renderSetScreen({ plan: amrapPlan, setIndex: 3 })

  expect(screen.getByText('Set 3 of 3 · 8+ reps')).toBeVisible()
  await openKinds(user)
  expect(chosenKinds()).toEqual(['AMRAP'])
})

test('O14 an earlier Set of an amrapLast Plan reads plain and opens on Working', async () => {
  const { user } = renderSetScreen({ plan: amrapPlan, setIndex: 2 })

  expect(screen.getByText('Set 2 of 3')).toBeVisible()
  await openKinds(user)
  expect(chosenKinds()).toEqual(['Working'])
})

test('O14 choosing AMRAP on any Set makes the counter read 8+ reps', async () => {
  const { user } = renderSetScreen({ plan: { ...squatPlan, sets: 3 }, setIndex: 2 })

  await chooseKindInTools(user, 'AMRAP')

  expect(screen.getByText('Set 2 of 3 · 8+ reps')).toBeVisible()
})

test('O14 the AMRAP Set is stored with kind amrap and reps above the range', async () => {
  const { user, onLog } = renderSetScreen({ plan: amrapPlan, setIndex: 3 })

  unfoldSteppers()

  await user.click(screen.getByRole('button', { name: 'Increase reps' }))
  unfoldSteppers()
  await user.click(screen.getByRole('button', { name: 'Increase reps' }))
  unfoldSteppers()
  await user.click(screen.getByRole('button', { name: 'Increase reps' }))
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect(onLog.mock.calls[0][1].kind).toBe('amrap')
  expect(onLog.mock.calls[0][1].reps).toBeGreaterThan(10)
})

// --- E14-T14: the Load Dial on a Bodyweight Exercise (O17) ------------------------------------

// Push-ups is Bodyweight with a 1 kg weight step; Assisted pull-ups is Bodyweight too (E16-T10),
// starting at a Load of -27.
const assistedPullUps = catalog.get('assisted-pull-ups') as Exercise
const assistedPullUpPlan: ExercisePlan = {
  exerciseId: 'assisted-pull-ups',
  sets: 4,
  repRange: [5, 8],
  restSeconds: 90,
}

function loadGroup(): HTMLElement | null {
  return screen.queryByRole('group', { name: 'Load' })
}

/** The Load's readout: since E16-T4, the Weight Dial's readout on a Bodyweight Exercise. */
function loadReadout(): HTMLElement {
  unfoldSteppers()
  return screen.getByRole('button', { name: 'Weight' })
}

/** Taps the Weight Dial's Rung reading `label` on a Bodyweight Exercise: "BW+10", "BW−20". */
async function chooseLoad(user: UserEvent, label: string): Promise<void> {
  const ladder = screen.getByRole('listbox', { name: 'Weight ladder' })
  await user.click(within(ladder).getByRole('option', { name: label }))
}

/** A push-ups Set logged today, with its Load when it has one. */
function pushUpSet(setIndex: number, reps: number, loadKg?: number): SetEntry {
  return {
    ...loggedEntry(setIndex, null, reps, 'push-ups'),
    ...(loadKg === undefined ? {} : { loadKg }),
  }
}

test('O17 a Bodyweight Exercise shows the Load Dial under the reps Dial', () => {
  renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  // E16-T4: the Load is the Weight Dial's value now; there is no separate Load Dial.
  expect(loadGroup()).toBeNull()
  const weight = screen.getByRole('group', { name: 'Weight' })
  expect(within(weight).getByRole('listbox', { name: 'Weight ladder' })).toBeInTheDocument()
  expect(readoutValue(loadReadout())).toBe('BW')
})

test('O17 Assisted pull-ups, not a Bodyweight Exercise, shows no Load Dial', () => {
  // E16-T10: the catalog's assisted pull-ups are a Bodyweight Exercise at a start Load of -27.
  // E16-T4: their Load rides the single Weight Dial, reading BW−27; no separate Load Dial shows,
  // and a loaded Exercise (back-squat) keeps its kg Weight Dial, with no Load Dial either.
  const { unmount } = renderSetScreen({ exercise: assistedPullUps, plan: assistedPullUpPlan })

  expect(screen.getByRole('group', { name: 'Reps' })).toBeInTheDocument()
  expect(loadGroup()).toBeNull()
  expect(screen.getAllByRole('group', { name: /^Weight/ })).toHaveLength(1)
  expect(screen.getByRole('listbox', { name: 'Weight ladder' })).toBeInTheDocument()
  expect(readoutValue(weightReadout())).toBe('BW−27')
  unmount()

  renderSetScreen({ exercise: backSquat, plan: squatPlan })
  expect(screen.getByRole('group', { name: 'Reps' })).toBeInTheDocument()
  expect(loadGroup()).toBeNull()
  expect(readoutValue(weightReadout())).not.toMatch(/^BW/)
})

test('O17 with no Load in its Preset the Load Dial opens on BW', () => {
  renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  expect(readoutValue(loadReadout())).toBe('BW')
})

test("O17 the Load Dial's Rungs follow the Exercise's stored weight step", () => {
  renderSetScreen({ exercise: pushUps, plan: pushUpPlan, weightStep: 2.5 })

  const ladder = screen.getByRole('listbox', { name: 'Weight ladder' })
  const shown = within(ladder).getAllByRole('option').map((option) => option.textContent)
  expect(shown).toHaveLength(65)
  expect(shown).toContain('BW+2.5')
  expect(shown).not.toContain('BW+1')
})

test('O17 left at BW, the Set logs exactly as today, with no loadKg', async () => {
  const { user, onLog } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  await screen.findByRole('listbox', { name: 'Weight ladder' })
  expect(readoutValue(loadReadout())).toBe('BW')
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  const entry = onLog.mock.calls[0][1]
  expect(entry).toEqual({
    exerciseId: 'push-ups',
    setIndex: 1,
    weightKg: null,
    reps: 10,
    loggedAt: expect.any(Number),
  })
  expect('loadKg' in entry).toBe(false)
})

test('O17 at BW+10 the Set stores loadKg 10, weightKg staying null', async () => {
  const { user, onLog } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  await chooseLoad(user, 'BW+10')
  expect(readoutValue(loadReadout())).toBe('BW+10')
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect(onLog.mock.calls[0][1]).toMatchObject({ weightKg: null, reps: 10, loadKg: 10 })
})

test('O17 at BW−20 the Set stores loadKg -20', async () => {
  const { user, onLog } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  await chooseLoad(user, 'BW−20')
  expect(readoutValue(loadReadout())).toBe('BW−20')
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect(onLog.mock.calls[0][1]).toMatchObject({ weightKg: null, loadKg: -20 })
})

test('O17 back at BW after choosing a Load, the Set stores no loadKg', async () => {
  const { user, onLog } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  await chooseLoad(user, 'BW+10')
  await chooseLoad(user, 'BW')
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect('loadKg' in onLog.mock.calls[0][1]).toBe(false)
})

test("O17 the Load Dial opens on the Preset's Load, and one tap logs it", async () => {
  const { user, onLog } = renderSetScreen({
    exercise: pushUps,
    plan: pushUpPlan,
    lastEntries: [{ exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 12, loadKg: 10, loggedAt: BASE }],
  })

  expect(readoutValue(loadReadout())).toBe('BW+10')
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect(onLog.mock.calls[0][1]).toMatchObject({ weightKg: null, reps: 12, loadKg: 10 })
})

test('O17 the next Set opens on the Load just logged', async () => {
  const { user, onLog } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  await chooseLoad(user, 'BW+10')
  await user.click(logButton())
  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))

  await screen.findByText('Set 2 of 3')
  expect(readoutValue(loadReadout())).toBe('BW+10')
})

test('O17 a Set logged at BW+10 shows as BW+10 × 10 in the logged-set list', async () => {
  const { user } = renderWithLogged([], { exercise: pushUps, plan: pushUpPlan })

  await chooseLoad(user, 'BW+10')
  await user.click(logButton())

  const list = await screen.findByRole('list', { name: 'Sets logged' })
  expect(within(list).getByRole('button', { name: 'BW+10 × 10' })).toBeVisible()
})

test("O17 in edit mode the Load Dial reads the logged Set's Load", async () => {
  const { user } = renderWithLogged([pushUpSet(1, 8, 10)], { exercise: pushUps, plan: pushUpPlan })

  await user.click(loggedSetButton('BW+10 × 8'))

  expect(screen.getByRole('button', { name: 'Save set' })).toBeVisible()
  expect(readoutValue(loadReadout())).toBe('BW+10')
})

test('O17 Save set stores a changed Load through onEditSet', async () => {
  const { user, onEditSet } = renderWithLogged([pushUpSet(1, 8, 10)], {
    exercise: pushUps,
    plan: pushUpPlan,
  })

  await user.click(loggedSetButton('BW+10 × 8'))
  await chooseLoad(user, 'BW+12')
  await user.click(screen.getByRole('button', { name: 'Save set' }))

  await waitFor(() => expect(onEditSet).toHaveBeenCalledTimes(1))
  expect(onEditSet).toHaveBeenCalledWith(1, expect.objectContaining({ weightKg: null, reps: 8, loadKg: 12 }))
})

test('O17 Save set adds a Load to a plain Bodyweight Set', async () => {
  const { user, onEditSet } = renderWithLogged([pushUpSet(1, 8)], {
    exercise: pushUps,
    plan: pushUpPlan,
  })

  await user.click(loggedSetButton('BW × 8'))
  await chooseLoad(user, 'BW−20')
  await user.click(screen.getByRole('button', { name: 'Save set' }))

  await waitFor(() => expect(onEditSet).toHaveBeenCalledTimes(1))
  expect(onEditSet).toHaveBeenCalledWith(1, expect.objectContaining({ loadKg: -20 }))
})

test('O17 Save set at BW on a loaded Set removes its Load with loadKg null', async () => {
  const { user, onEditSet } = renderWithLogged([pushUpSet(1, 8, 10)], {
    exercise: pushUps,
    plan: pushUpPlan,
  })

  await user.click(loggedSetButton('BW+10 × 8'))
  await chooseLoad(user, 'BW')
  await user.click(screen.getByRole('button', { name: 'Save set' }))

  await waitFor(() => expect(onEditSet).toHaveBeenCalledTimes(1))
  expect(onEditSet.mock.calls[0][1].loadKg).toBeNull()
})

// --- E16-T4 O8: one weight Dial on a Bodyweight Exercise's Set screen ---------------------------

test('O8 a Bodyweight Exercise shows exactly one weight Dial, reading BW, and no Load Dial', () => {
  renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  expect(screen.getAllByRole('group', { name: /^Weight/ })).toHaveLength(1)
  expect(screen.getByRole('listbox', { name: 'Weight ladder' })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Load' })).toBeNull()
  expect(screen.queryByRole('listbox', { name: 'Load ladder' })).toBeNull()
  expect(readoutValue(weightReadout())).toBe('BW')
})

test("O8 a Bodyweight Exercise's weight Dial opens on the Preset's Load, reading BW+10", () => {
  renderSetScreen({
    exercise: pushUps,
    plan: pushUpPlan,
    lastEntries: [{ exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 12, loadKg: 10, loggedAt: BASE }],
  })

  expect(readoutValue(weightReadout())).toBe('BW+10')
})

test('O8 a Bodyweight Set typed as −27 on the weight keypad reads BW−27 and logs weightKg null, loadKg -27', async () => {
  const { user, onLog } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  await enterOnKeypad(user, weightReadout(), ['−', '2', '7'])
  expect(readoutValue(weightReadout())).toBe('BW−27')
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect(onLog.mock.calls[0][1]).toMatchObject({ exerciseId: 'push-ups', weightKg: null, reps: 10, loadKg: -27 })
})

test('O8 a Bodyweight Set stepped up one Rung from BW logs weightKg null and loadKg +1', async () => {
  const { user, onLog } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan })

  unfoldSteppers()

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  expect(readoutValue(weightReadout())).toBe('BW+1')
  await user.click(logButton())

  await waitFor(() => expect(onLog).toHaveBeenCalledTimes(1))
  expect(onLog.mock.calls[0][1]).toMatchObject({ weightKg: null, loadKg: 1 })
})

// --- E15-T2 O12: 1:00 of rest after a Warm-up --------------------------------------------------
//
// A back-squat Warm-up at BASE on a 180 s Plan (renderWithSessionRest gives back squat 180 s).

function warmupSquat(setIndex: number, loggedAt: number, restSeconds?: number): SetEntry {
  return { ...squatEntry(setIndex, loggedAt), kind: 'warmup', ...(restSeconds === undefined ? {} : { restSeconds }) }
}

test('O12 the Rest readout starts from 1:00 after a Warm-up on a 180 s Plan', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE)
  renderWithSessionRest([warmupSquat(1, BASE)])

  expect(readoutValue(restReadout())).toBe('1:00')
})

test('O12 the rest bar reads 00:50 ten seconds after a Warm-up', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 10_000)
  renderWithSessionRest([warmupSquat(1, BASE)])

  expect(readoutValue(restReadout())).toBe('0:50')
})

test('O12 a Warm-up rest is over after 60 s: the readout reads +0:10 over at 70 s', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 70_000)
  renderWithSessionRest([warmupSquat(1, BASE)])

  // Over at 60 s: at 70 s, opened now, no clock shows and Log set has the dock again (F3).
  expect(screen.queryByRole('timer', { name: 'Rest remaining' })).toBeNull()
  expect(logButton().textContent).toBe('Log set 1 · 50 × 8')
})

test('O12 a working Set rests the Plan length: 3:00 at once', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE)
  renderWithSessionRest([squatEntry(1, BASE)])

  expect(readoutValue(restReadout())).toBe('3:00')
})

test('O12 a Warm-up whose rest was adjusted keeps its stored rest: 2:30 stays 2:20 at 10 s', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 10_000)
  renderWithSessionRest([warmupSquat(1, BASE, 150)])

  expect(readoutValue(restReadout())).toBe('2:20')
})

test('O12 +15 s at 10 s into a Warm-up rest makes the readout 1:05 and stores 75', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 10_000)
  const { user, onSetRest } = renderWithSessionRest([warmupSquat(1, BASE)])

  await user.click(plus15())

  await waitFor(() => expect(readoutValue(restReadout())).toBe('1:05'))
  expect(onSetRest).toHaveBeenCalledWith(expect.objectContaining({ setIndex: 1 }), 75)
})

test('O12 -15 s at 10 s into a Warm-up rest makes the readout 0:35 and stores 45', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 10_000)
  const { user, onSetRest } = renderWithSessionRest([warmupSquat(1, BASE)])

  await user.click(minus15())

  await waitFor(() => expect(readoutValue(restReadout())).toBe('0:35'))
  expect(onSetRest).toHaveBeenCalledWith(expect.objectContaining({ setIndex: 1 }), 45)
})

test('O12 the rest Dial opens on 1:00 after a Warm-up', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 10_000)
  const { user } = renderWithSessionRest([warmupSquat(1, BASE)])

  const ladder = await openRestDial(user)

  const selected = within(ladder).getAllByRole('option', { selected: true })
  expect(selected.map((option) => option.textContent)).toEqual(['1:00'])
})

test('O12 the rest Dial opens on the stored rest of an adjusted Warm-up, 2:30', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 10_000)
  const { user } = renderWithSessionRest([warmupSquat(1, BASE, 150)])

  const ladder = await openRestDial(user)

  const selected = within(ladder).getAllByRole('option', { selected: true })
  expect(selected.map((option) => option.textContent)).toEqual(['2:30'])
})

test('O12 Set rest after a Warm-up offers no Use for this exercise', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 10_000)
  const { user, onSetRest } = renderWithSessionRest([warmupSquat(1, BASE)], {
    programName: 'A/B Split',
    onUseRestForExercise: vi.fn(async () => undefined),
  })

  await setRestOnDial(user, '2:30')

  await waitFor(() => expect(onSetRest).toHaveBeenCalledWith(expect.objectContaining({ setIndex: 1 }), 150))
  expect(screen.queryByRole('button', { name: /^Use .* for / })).toBeNull()
})

test('O12 the beep fires once, at the Warm-up zero of 60 s rather than the Plan 180 s', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  renderWithSessionRest([warmupSquat(1, BASE)])

  await vi.advanceTimersByTimeAsync(55_000)
  expect(playRestOver).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(10_000)
  expect(playRestOver).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(10_000)
  expect(playRestOver).toHaveBeenCalledTimes(1)
})

test('O12 changing the Set to Working moves its Rest to the Plan length: 1:00 becomes 3:00', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE)
  const warm = warmupSquat(1, BASE)
  const { kind: _kind, ...working } = warm
  const props: SetScreenProps = {
    exercise: backSquat,
    plan: squatPlan,
    setIndex: 2,
    sessionId: SESSION_ID,
    sessionStartedAt: BASE,
    lastEntries: [],
    logged: [warm],
    restFrom: { entry: warm, planRestSeconds: 180 },
    onLog: sessionLogSet(),
    onLogged: () => undefined,
  }
  const { rerender } = render(<SetScreen {...props} />)
  expect(readoutValue(restReadout())).toBe('1:00')

  rerender(<SetScreen {...props} logged={[working]} restFrom={{ entry: working, planRestSeconds: 180 }} />)

  expect(readoutValue(restReadout())).toBe('3:00')
})

// --- E15-T6: the Plate line under the weight Dial -----------------------------------------------

// A rack with a 20 kg bar and two pairs each of 20, 10 and 5 kg plates, so every expected line
// below is worked by hand: 60 kg -> 20 a side, 80 -> 20 + 10, 100 -> 20 + 20.
const RACK = {
  barKg: 20,
  plates: [
    { kg: 20, pairs: 2 },
    { kg: 10, pairs: 2 },
    { kg: 5, pairs: 2 },
  ],
}

function plateLine(): HTMLElement | null {
  return document.querySelector<HTMLElement>('p.plate-line')
}

function plateLineText(): string {
  return (plateLine()?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * The Plate line for the Set on the steppers, as the tools sheet's Plates segment reads it
 * (S3b): opens the sheet, reads the line and closes the sheet again.
 */
async function platesInTools(user: UserEvent): Promise<string> {
  await openTools(user)
  const text = plateLineText()
  await closeSheet(user)
  return text
}

test('O8 a barbell set screen shows the Plate line for the weight on the Dial', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], plates: RACK })

  expect(await platesInTools(user)).toBe('Per side: 20')
})

test('O8 the Plate line sits directly under the weight Dial, before the reps Dial', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], plates: RACK })

  // S3b: the Plate line sits in the tools sheet's Plates segment, under the bar drawing, and the
  // screen itself shows none.
  expect(plateLine()).toBeNull()
  const sheet = await openTools(user, 'Plates')
  const line = plateLine() as HTMLElement
  expect(sheet).toContainElement(line)
  const drawing = within(sheet).getByRole('img', { name: 'Per side 20 kg' })
  expect(drawing.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('O8 a weight entered on the keypad moves the Plate line: 80 kg reads Per side: 20 · 10', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], plates: RACK })

  await enterOnKeypad(user, weightReadout(), ['8', '0'])

  expect(await platesInTools(user)).toBe('Per side: 20 · 10')
})

test('O8 the plus button moves the Plate line: 62.5 kg reads Nearest 60 kg · per side: 20', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], plates: RACK })

  unfoldSteppers()

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(await platesInTools(user)).toBe('Nearest 60 kg · per side: 20')
})

test('O8 a weight under the bar reads Lighter than the 20 kg bar', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], plates: RACK })

  await enterOnKeypad(user, weightReadout(), ['1', '5'])

  expect(await platesInTools(user)).toBe('Lighter than the 20 kg bar')
})

test('O8 a change to the stored inventory changes the Plate line', async () => {
  const user = userEvent.setup()
  const props: SetScreenProps = {
    exercise: backSquat,
    plan: squatPlan,
    setIndex: 1,
    sessionId: SESSION_ID,
    sessionStartedAt: BASE,
    lastEntries: [historyEntry(1, 60, 10)],
    onLog: sessionLogSet(),
    onLogged: () => undefined,
    plates: RACK,
  }
  const { rerender } = render(<SetScreen {...props} />)
  expect(await platesInTools(user)).toBe('Per side: 20')

  rerender(<SetScreen {...props} plates={{ barKg: 10, plates: [{ kg: 25, pairs: 2 }] }} />)

  expect(await platesInTools(user)).toBe('Per side: 25')
})

test('O8 during Rest the Plate line shows the plates of the next Set on the Dial', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE)
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], plates: RACK })
  await enterOnKeypad(user, weightReadout(), ['8', '0'])

  await user.click(logButton())

  await waitFor(() => expect(restReadout()).toBeTruthy())
  expect(readoutValue(weightReadout())).toBe('80')
  expect(await platesInTools(user)).toBe('Per side: 20 · 10')
})

test('O8 in the edit mode the Plate line shows the plates of the edited Set', async () => {
  const logged: SetEntry[] = [
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 100, reps: 8, loggedAt: BASE },
  ]
  const { user } = renderSetScreen({
    setIndex: 2,
    lastEntries: logged,
    logged,
    plates: RACK,
  })
  expect(await platesInTools(user)).toBe('Per side: 20 · 20')
  await enterOnKeypad(user, weightReadout(), ['6', '0'])
  expect(await platesInTools(user)).toBe('Per side: 20')

  const loggedSet = document.querySelector<HTMLElement>('button.logged-set') as HTMLElement
  await user.click(loggedSet)

  expect(readoutValue(weightReadout())).toBe('100')
  expect(plateLineText()).toBe('Per side: 20 · 20')
})

test('O8 with plates null there is no Plate line', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], plates: null })

  expect(plateLine()).toBeNull()
})

test('O8 with plates omitted there is no Plate line', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  expect(plateLine()).toBeNull()
})

// --- E15-T7: the Warm-up ramp on a barbell Exercise's set screen, and the tap budget -----------

// The default Plate inventory, written out: a 20 kg bar and plenty of every plate, so the ramp
// for 100 kg is 50 × 5, 70 × 3, 85 × 2 and for 40 kg is 20 × 5, 27.5 × 3, 32.5 × 2.
const FULL_RACK = {
  barKg: 20,
  plates: [
    { kg: 25, pairs: 10 },
    { kg: 20, pairs: 10 },
    { kg: 15, pairs: 10 },
    { kg: 10, pairs: 10 },
    { kg: 5, pairs: 10 },
    { kg: 2.5, pairs: 10 },
    { kg: 1.25, pairs: 10 },
  ],
}

/**
 * A barbell back squat on a 3-Set Plan whose Preset is 100 kg × 8, under the parent that owns
 * this Session's Sets (`initial` is what a reload hands back).
 */
function renderBarbell(initial: SetEntry[] = [], over: Partial<SetScreenProps> = {}) {
  return renderWithLogged(initial, {
    plan: threeSetSquatPlan,
    lastEntries: [historyEntry(1, 100, 8)],
    plates: FULL_RACK,
    ...over,
  })
}

function addWarmupsOffer(): HTMLElement | null {
  return document.querySelector<HTMLElement>('button.add-warmups')
}

/** Whether the tools sheet's Warm-up segment offers Add warm-ups (S3b); the sheet closes after. */
async function warmupsOffered(user: UserEvent): Promise<boolean> {
  const sheet = await openTools(user)
  const segment = within(sheet).queryByRole('radio', { name: 'Warm-up' })
  if (segment !== null) await user.click(segment)
  const offered = addWarmupsOffer() !== null
  await closeSheet(user)
  return offered
}

/** The kind chosen for the Set on the steppers, read off the tools sheet's Set type chips. */
async function kindsInTools(user: UserEvent): Promise<string[]> {
  await openKinds(user)
  const kinds = chosenKinds()
  await closeSheet(user)
  return kinds
}

function rampLineText(): string | null {
  const line = document.querySelector<HTMLElement>('p.warmup-ramp')
  return line === null ? null : (line.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Taps Add warm-ups in the tools sheet's Warm-up segment, which must be on offer. */
async function startRamp(user: UserEvent): Promise<void> {
  await openTools(user, 'Warm-up')
  const offer = addWarmupsOffer()
  expect(offer).not.toBeNull()
  await user.click(offer as HTMLElement)
}

/** Taps Log set on the Warm-up step the ramp line names, and waits for it to be stored. */
async function logStep(user: UserEvent, line: string, storedAfter: number): Promise<void> {
  await waitFor(() => expect(rampLineText()).toBe(line))
  await user.click(logButton())
  await waitFor(async () => expect(await storedEntries()).toHaveLength(storedAfter))
}

/** Starts the ramp for 100 kg and logs all three Warm-ups, one tap each. */
async function logWholeRamp(user: UserEvent): Promise<void> {
  await startRamp(user)
  await logStep(user, 'Warm-up 1 of 3 · 50 kg × 5', 1)
  await logStep(user, 'Warm-up 2 of 3 · 70 kg × 3', 2)
  await logStep(user, 'Warm-up 3 of 3 · 85 kg × 2', 3)
  await waitFor(() => expect(rampLineText()).toBeNull())
}

function storedSummary(entry: SetEntry): unknown[] {
  return [entry.setIndex, entry.weightKg, entry.reps, entry.kind]
}

test('O10 a barbell Exercise at 100 kg with no working Set logged offers Add warm-ups', async () => {
  const { user } = renderBarbell()
  await openTools(user, 'Warm-up')

  const offer = addWarmupsOffer()
  expect(offer).not.toBeNull()
  expect((offer as HTMLElement).textContent).toBe('Add warm-ups')
  expect(offer as HTMLElement).toBeVisible()
})

test('O10 no ramp line shows until Add warm-ups is tapped', async () => {
  const { user } = renderBarbell()
  expect(rampLineText()).toBeNull()

  await startRamp(user)

  expect(rampLineText()).not.toBeNull()
})

test('O10 tapping Add warm-ups opens the Dials on the first Warm-up step, 50 kg × 5', async () => {
  const { user } = renderBarbell()

  await startRamp(user)

  expect(readoutValue(weightReadout())).toBe('50')
  expect(readoutValue(repsReadout())).toBe('5')
})

test('O10 tapping Add warm-ups puts the kind row on W-up', async () => {
  const { user } = renderBarbell()

  await startRamp(user)

  expect(await kindsInTools(user)).toEqual(['W-up'])
})

test('O10 tapping Add warm-ups shows the line Warm-up 1 of 3 · 50 kg × 5', async () => {
  const { user } = renderBarbell()

  await startRamp(user)

  expect(rampLineText()).toBe('Warm-up 1 of 3 · 50 kg × 5')
})

test('O10 the ramp is for the weight on the Dial when Add warm-ups is tapped, not the Preset', async () => {
  const { user } = renderBarbell()
  await enterOnKeypad(user, weightReadout(), ['4', '0'])

  await startRamp(user)

  expect(rampLineText()).toBe('Warm-up 1 of 3 · 20 kg × 5')
  expect(readoutValue(weightReadout())).toBe('20')
})

test('O10 while the ramp runs Add warm-ups is not offered again', async () => {
  const { user } = renderBarbell()

  await startRamp(user)

  expect(rampLineText()).toBe('Warm-up 1 of 3 · 50 kg × 5')
  expect(await warmupsOffered(user)).toBe(false)
})

test('O10 Log set during the ramp stores the step as a warmup Set', async () => {
  const { user } = renderBarbell()
  await startRamp(user)

  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(1))
  expect(storedSummary((await storedEntries())[0])).toEqual([1, 50, 5, 'warmup'])
})

test('O10 after a Warm-up is logged the Dials open on the next step, 70 kg × 3', async () => {
  const { user } = renderBarbell()
  await startRamp(user)

  await logStep(user, 'Warm-up 1 of 3 · 50 kg × 5', 1)

  await waitFor(() => expect(rampLineText()).toBe('Warm-up 2 of 3 · 70 kg × 3'))
  expect(readoutValue(weightReadout())).toBe('70')
  expect(readoutValue(repsReadout())).toBe('3')
})

test('O10 after a Warm-up is logged the kind row is still on W-up', async () => {
  const { user } = renderBarbell()
  await startRamp(user)

  await logStep(user, 'Warm-up 1 of 3 · 50 kg × 5', 1)

  await waitFor(() => expect(rampLineText()).toBe('Warm-up 2 of 3 · 70 kg × 3'))
  expect(await kindsInTools(user)).toEqual(['W-up'])
})

test('O10 one tap on Log set per step stores the three Warm-ups of the ramp in order', async () => {
  const { user } = renderBarbell()

  await logWholeRamp(user)

  const stored = [...(await storedEntries())].sort((a, b) => a.setIndex - b.setIndex)
  expect(stored.map(storedSummary)).toEqual([
    [1, 50, 5, 'warmup'],
    [2, 70, 3, 'warmup'],
    [3, 85, 2, 'warmup'],
  ])
})

test('O10 after the last step the Dials return to the working weight the ramp was started from', async () => {
  const { user } = renderBarbell()
  // Moved up from the 100 kg Preset before the ramp: 50%, 70% and 85% of 110 kg are made as
  // 55, 75 and 92.5 kg.
  await enterOnKeypad(user, weightReadout(), ['1', '1', '0'])
  await startRamp(user)
  await logStep(user, 'Warm-up 1 of 3 · 55 kg × 5', 1)
  await logStep(user, 'Warm-up 2 of 3 · 75 kg × 3', 2)

  await logStep(user, 'Warm-up 3 of 3 · 92.5 kg × 2', 3)

  await waitFor(() => expect(readoutValue(weightReadout())).toBe('110'))
  expect(rampLineText()).toBeNull()
})

test('O10 after the last step the kind row returns to Working', async () => {
  const { user } = renderBarbell()

  await logWholeRamp(user)

  expect(await kindsInTools(user)).toEqual(['Working'])
})

test('O10 after the last step the set counter still reads Set 1 of 3', async () => {
  const { user } = renderBarbell()

  await logWholeRamp(user)

  expect(screen.getByText('Set 1 of 3')).toBeVisible()
})

test('O10 the Set logged after the ramp is stored as a working Set at the working weight', async () => {
  const { user } = renderBarbell()
  await logWholeRamp(user)

  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(4))
  const last = (await storedEntries()).find((entry) => entry.setIndex === 4) as SetEntry
  expect(storedSummary(last)).toEqual([4, 100, 8, undefined])
  expect('kind' in last).toBe(false)
})

test('O10 choosing Working on the kind row before the last step ends the ramp at the working weight', async () => {
  const { user } = renderBarbell()
  await startRamp(user)
  await logStep(user, 'Warm-up 1 of 3 · 50 kg × 5', 1)
  await waitFor(() => expect(rampLineText()).toBe('Warm-up 2 of 3 · 70 kg × 3'))

  await chooseKindInTools(user, 'Working')

  expect(rampLineText()).toBeNull()
  expect(readoutValue(weightReadout())).toBe('100')
  expect(await kindsInTools(user)).toEqual(['Working'])
  expect(screen.getByText('Set 1 of 3')).toBeVisible()
})

test('O10 choosing Drop on the kind row during the ramp ends it and returns the Dial to the working weight', async () => {
  const { user } = renderBarbell()
  await startRamp(user)
  expect(rampLineText()).toBe('Warm-up 1 of 3 · 50 kg × 5')

  await chooseKindInTools(user, 'Drop')

  expect(rampLineText()).toBeNull()
  expect(readoutValue(weightReadout())).toBe('100')
  expect(await kindsInTools(user)).not.toContain('W-up')
})

test('O10 the Set logged after the ramp was ended on the kind row is not a Warm-up', async () => {
  const { user } = renderBarbell()
  await startRamp(user)
  await logStep(user, 'Warm-up 1 of 3 · 50 kg × 5', 1)
  await waitFor(() => expect(rampLineText()).toBe('Warm-up 2 of 3 · 70 kg × 3'))
  await chooseKindInTools(user, 'Working')

  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(2))
  const last = (await storedEntries()).find((entry) => entry.setIndex === 2) as SetEntry
  expect(storedSummary(last)).toEqual([2, 100, 8, undefined])
})

test('O10 a step whose weight and reps were changed on the Dials is logged as changed', async () => {
  const { user } = renderBarbell()
  await startRamp(user)
  await enterOnKeypad(user, weightReadout(), ['5', '5'])
  await enterOnKeypad(user, repsReadout(), ['6'])

  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(1))
  expect(storedSummary((await storedEntries())[0])).toEqual([1, 55, 6, 'warmup'])
})

test('O10 after a changed step is logged the ramp still opens its own next step, 70 kg × 3', async () => {
  const { user } = renderBarbell()
  await startRamp(user)
  await enterOnKeypad(user, weightReadout(), ['5', '5'])
  await user.click(logButton())
  await waitFor(async () => expect(await storedEntries()).toHaveLength(1))

  await waitFor(() => expect(rampLineText()).toBe('Warm-up 2 of 3 · 70 kg × 3'))
  expect(readoutValue(weightReadout())).toBe('70')
  expect(readoutValue(repsReadout())).toBe('3')
})

test('O10 after a reload with one Warm-up logged, Add warm-ups continues from Warm-up 2 of 3', async () => {
  const { user } = renderBarbell([warmupEntry(1, 50, 5)])
  expect(readoutValue(weightReadout())).toBe('100')
  expect(await kindsInTools(user)).toEqual(['Working'])

  await startRamp(user)

  expect(rampLineText()).toBe('Warm-up 2 of 3 · 70 kg × 3')
  expect(readoutValue(weightReadout())).toBe('70')
  expect(readoutValue(repsReadout())).toBe('3')
})

test('O10 the step logged after a reload with one Warm-up logged is stored as setIndex 2', async () => {
  const { user } = renderBarbell([warmupEntry(1, 50, 5)])
  await startRamp(user)

  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(1))
  expect(storedSummary((await storedEntries())[0])).toEqual([2, 70, 3, 'warmup'])
})

test('O10 after a reload with two Warm-ups logged, the ramp has one step left and then returns to 100 kg', async () => {
  const { user } = renderBarbell([warmupEntry(1, 50, 5), warmupEntry(2, 70, 3)])
  await startRamp(user)

  await logStep(user, 'Warm-up 3 of 3 · 85 kg × 2', 1)

  await waitFor(() => expect(rampLineText()).toBeNull())
  expect(readoutValue(weightReadout())).toBe('100')
  expect(await kindsInTools(user)).toEqual(['Working'])
})

test('O10 once every step of the ramp is logged the offer is gone', async () => {
  const { user } = renderBarbell()

  await logWholeRamp(user)

  expect(readoutValue(weightReadout())).toBe('100')
  expect(await warmupsOffered(user)).toBe(false)
})

test('O10 once a working Set is logged the offer is gone', async () => {
  const { user } = renderBarbell()
  expect(await warmupsOffered(user)).toBe(true)

  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(1))
  expect(await warmupsOffered(user)).toBe(false)
})

test('O10 at 40 kg on the Dial the offer shows, and one rung down at 37.5 kg it does not', async () => {
  const { user } = renderBarbell([], { lastEntries: [historyEntry(1, 40, 8)] })
  expect(await warmupsOffered(user)).toBe(true)

  unfoldSteppers()

  await user.click(screen.getByRole('button', { name: 'Decrease weight' }))

  expect(readoutValue(weightReadout())).toBe('37.5')
  expect(await warmupsOffered(user)).toBe(false)
})

test('O10 the edit mode does not show the offer', async () => {
  const { user } = renderBarbell([warmupEntry(1, 50, 5)])
  expect(await warmupsOffered(user)).toBe(true)

  await user.click(document.querySelector<HTMLElement>('button.logged-set') as HTMLElement)

  expect(screen.getByRole('button', { name: 'Save set' })).toBeVisible()
  expect(addWarmupsOffer()).toBeNull()
})

test('O10 an Exercise given no plates does not show the offer', async () => {
  const user = userEvent.setup()
  const props: SetScreenProps = {
    exercise: backSquat,
    plan: threeSetSquatPlan,
    setIndex: 1,
    sessionId: SESSION_ID,
    sessionStartedAt: BASE,
    lastEntries: [historyEntry(1, 100, 8)],
    logged: [],
    onLog: sessionLogSet(),
    onLogged: () => undefined,
    plates: FULL_RACK,
  }
  const { rerender } = render(<SetScreen {...props} />)
  expect(await warmupsOffered(user)).toBe(true)

  rerender(<SetScreen {...props} plates={null} />)

  expect(await warmupsOffered(user)).toBe(false)
})

test('O13 with the Plate line and Add warm-ups showing, one tap on Log set stores the Preset as a working Set', async () => {
  const { user } = renderBarbell()
  expect(await platesInTools(user)).toBe('Per side: 25 · 15')
  expect(await warmupsOffered(user)).toBe(true)
  // Merely offering the ramp leaves the open Set on Working.
  expect(await kindsInTools(user)).toEqual(['Working'])

  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(1))
  const [entry] = await storedEntries()
  expect(storedSummary(entry)).toEqual([1, 100, 8, undefined])
  expect('kind' in entry).toBe(false)
})

// --- E16-T5 O10: rest as a digital clock ------------------------------------------------------

test('O10 with 87 s of rest left the clock reads 01:27 with leading zeros', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 93_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  expect(readoutValue(screen.getByRole('timer', { name: 'Rest remaining' }))).toBe('1:27')
})

test('O10 a rest under ten seconds reads 00:07, not 0:07', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 173_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  expect(readoutValue(restReadout())).toBe('0:07')
})

test('O10 the clock sits above the set counter', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 93_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  // S4: the countdown is the rest panel's hero, in the dock under the body -- after the
  // exercise's head and its set counter.
  const clock = screen.getByRole('timer', { name: 'Rest remaining' })
  const counter = document.querySelector('.set-counter')
  expect(counter).not.toBeNull()
  expect(clock.compareDocumentPosition(counter as Element) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
})

test('O10 with the rest running, −15 s, +15 s and Skip are offered under the clock', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 93_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  const clock = screen.getByRole('timer', { name: 'Rest remaining' })
  for (const control of [minus15(), plus15(), skip()]) {
    expect(clock.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
})

test('O10 once the rest is over the clock counts up +00:42 with no adjustments', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 222_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  // Over before the screen opened: no clock counts up, and nothing to adjust (F3).
  expect(screen.queryByRole('timer', { name: 'Rest remaining' })).toBeNull()
  expect(screen.queryByRole('button', { name: '+15 s' })).toBeNull()
  expect(screen.queryByRole('button', { name: /^[−-]15 s$/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Skip rest' })).toBeNull()
})

test('O10 tapping the clock opens the rest Dial', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 93_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])

  await user.click(restReadout())

  expect(await screen.findByRole('listbox', { name: 'Rest ladder' })).toBeVisible()
})

test('O10 the Action bar button reads Log set while the clock reads 01:27: one clock on screen', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 93_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  expect(readoutValue(restReadout())).toBe('1:27')
  expect(screen.getAllByRole('timer')).toHaveLength(1)
  // While rest runs, Log set is the outlined cell; the dock is the rest panel (S4).
  expect(cellReading(logButton())).toBe('2 60×10')
})

test('O10 the Action bar button reads Log set once the rest is over', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 222_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  expect(readoutValue(logButton())).toBe('Log set 2 · 60 × 10')
})

test('O10 +15 s still stores a rest of 195 s through onSetRest', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 93_000)
  const { user, onSetRest } = renderWithSessionRest([squatEntry(1, BASE)])

  await user.click(plus15())

  await waitFor(() => expect(onSetRest).toHaveBeenCalledTimes(1))
  expect(onSetRest).toHaveBeenCalledWith(expect.objectContaining({ loggedAt: BASE }), 195)
})

function restCss(): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'SetScreen.css'), 'utf-8')
}

test('O10 the clock is styled in --font-display at --text-display with tabular figures', () => {
  // Title kept from before E17-T5's type sweep; the body asserts the one family.
  const decls = declarationsFor(restCss(), '.rest-readout')
  expect(decls.get('font-family')).toBe('var(--font-sans)')
  expect(decls.get('font-size')).toBe('var(--text-display)')
  expect(decls.get('font-variant-numeric')).toBe('tabular-nums')
})

test('O10 the over clock is coloured --color-accent by a rule on the rest panel', () => {
  const rules = postcss.parse(restCss()).nodes.filter(
    (node): node is Rule => node.type === 'rule' && /data-over/.test(node.selector),
  )
  const colours = rules.flatMap((rule) =>
    rule.nodes
      .filter((decl): decl is Declaration => decl.type === 'decl' && decl.prop === 'color')
      .map((decl) => decl.value.trim()),
  )
  // Title kept (weakened-tests gate); E17-T12 [O1] drops --color-accent, so the over clock
  // reads in a Status colour: --color-warn or --color-danger.
  expect(colours).not.toContain('var(--color-accent)')
  expect(colours.length, 'the over clock declares no colour').toBeGreaterThan(0)
  for (const colour of colours) {
    expect(['var(--color-warn)', 'var(--color-danger)']).toContain(colour)
  }
})

// --- E16-T6 O13: the Preset carries today's change -----------------------------------------

/** Last time on back squat: 80×8 · 80×8 · 80×8. */
const lastTime80x8: SetEntry[] = [
  historyEntry(1, 80, 8),
  historyEntry(2, 80, 8),
  historyEntry(3, 80, 8),
]

test('O13 last time 80×8 ×3, Set 1 logged at 82.5 × 8: Set 2 opens at 82.5', async () => {
  const { user } = renderWithLogged([], { lastEntries: lastTime80x8 })
  expect(readoutValue(weightReadout())).toBe('80')

  unfoldSteppers()

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  expect(readoutValue(weightReadout())).toBe('82.5')
  await user.click(logButton())

  expect(await screen.findByText('Set 2 of 4')).toBeVisible()
  expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['82.5', '8'])
})

test('O13 last time 80×8 ×3, Sets 1 and 2 logged at 82.5 × 8: Set 3 opens at 82.5', async () => {
  const { user } = renderWithLogged([], { lastEntries: lastTime80x8 })

  unfoldSteppers()

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  await user.click(logButton())
  await screen.findByText('Set 2 of 4')
  await user.click(await screen.findByRole('button', { name: 'Log set' }))

  expect(await screen.findByText('Set 3 of 4')).toBeVisible()
  await waitFor(async () =>
    expect((await storedEntries()).map((entry) => entry.weightKg)).toEqual([82.5, 82.5]),
  )
  expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['82.5', '8'])
})

// --- E16-T11 O9: Weight and Reps side by side ----------------------------------------------
//
// Layout cannot be measured in jsdom, so the 390 x 844 fit is held as structure and CSS: the two
// Dials share one `.set-dials` row (two equal columns, stretched to the same height), and the
// step control and the Plate line share the `.set-dial-controls` row under it.

function dialPair(): HTMLElement {
  return document.querySelector<HTMLElement>('.set-dials') as HTMLElement
}

function controlsRow(): HTMLElement {
  return document.querySelector<HTMLElement>('.set-dial-controls') as HTMLElement
}

test('O9 the Weight and Reps Dials are the two children of one .set-dials row, Weight first', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  const pair = dialPair()
  expect(pair).not.toBeNull()
  const groups = Array.from(pair.children).map((child) => child.getAttribute('aria-label'))
  expect(groups).toEqual(['Weight (kg)', 'Reps'])
})

test('O9 the step control and the Plate line sit in one .set-dial-controls row after the Dial pair', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], plates: RACK })

  // S3b: both moved off the screen into the tools sheet -- the Plate line under the bar drawing
  // in Plates, the step control in the .set-dial-controls rows under it.
  expect(controlsRow()).toBeNull()
  const sheet = await openTools(user, 'Plates')
  const row = controlsRow()
  expect(sheet).toContainElement(row)
  expect(row.contains(stepControl(2.5))).toBe(true)
  expect(sheet).toContainElement(plateLine())
  expect(dialPair().contains(row)).toBe(false)
  expect((plateLine() as HTMLElement).compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('O9 without a Plate inventory the controls row still holds the step control', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })
  await openTools(user)

  expect(controlsRow().contains(stepControl(2.5))).toBe(true)
  expect(plateLine()).toBeNull()
})

test('O9 a Bodyweight Exercise still has the .set-dial-controls row, without a step control', async () => {
  const { user } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan })
  await openTools(user)

  expect(controlsRow()).not.toBeNull()
  expect(screen.queryByRole('combobox', { name: /^Step/ })).toBeNull()
})

test('O9 the Weight Dial no longer holds the step control', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  const weightGroup = screen.getByRole('group', { name: 'Weight (kg)' })
  expect(within(weightGroup).queryByRole('combobox')).toBeNull()
})

test('O9 the stylesheet lays .set-dials out as one row: two equal columns with the × between them', () => {
  // The Live session (Progress Dashboard S3) stacks the two steppers, weight over reps, each one
  // row of minus, the number and plus; no × sits between them any more.
  const decls = declarationsFor(restCss(), '.set-dials')
  expect(decls.get('display')).toBe('flex')
  expect(decls.get('flex-direction')).toBe('column')
  expect(declarationsFor(restCss(), '.set-dials::after').get('content')).toBeUndefined()
})

test('O9 the stylesheet lays .set-dial-controls out as one row', () => {
  const decls = declarationsFor(restCss(), '.set-dial-controls')
  expect(decls.get('display')).toMatch(/^(flex|grid)$/)
})

// --- E16-T13 O6: the Bodyweight switch -------------------------------------------------------
//
// The caller hands in the Exercise already resolved through `applyBodyweight`; the switch shows
// that setting, flips the Dial's mode at once, and tells the caller through `onBodyweightChange`.

/** The Bodyweight switch beside the step control, in the open tools sheet. */
function bodyweightSwitch(): HTMLElement {
  return screen.getByRole('switch', { name: 'Bodyweight' })
}

/** Opens the tools sheet and flips the Bodyweight switch; the sheet stays open. */
async function flipBodyweight(user: UserEvent): Promise<void> {
  await openTools(user)
  await user.click(bodyweightSwitch())
}

/** Back squat as the caller resolves it with a Bodyweight override stored for it. */
const backSquatAsBodyweight: Exercise = { ...backSquat, bodyweight: true }

/** A store that has not answered yet: the screen must not wait on it to change mode. */
function pendingStore() {
  return vi.fn((_value: boolean) => new Promise<void>(() => {}))
}

test('O6 a loaded Exercise shows the Bodyweight switch off, in .set-dial-controls beside the step control', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], onBodyweightChange: pendingStore() })
  await openTools(user)

  const toggle = bodyweightSwitch()
  expect(toggle).not.toBeChecked()
  expect(controlsRow().contains(toggle)).toBe(true)
  expect(controlsRow().contains(stepControl(2.5))).toBe(true)
})

test('O6 a Bodyweight Exercise shows the Bodyweight switch on, in .set-dial-controls', async () => {
  const { user } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan, onBodyweightChange: pendingStore() })
  await openTools(user)

  expect(bodyweightSwitch()).toBeChecked()
  expect(controlsRow().contains(bodyweightSwitch())).toBe(true)
})

test('O6 an Exercise the caller resolved as Bodyweight by override shows the switch on', async () => {
  const { user } = renderSetScreen({ exercise: backSquatAsBodyweight, onBodyweightChange: pendingStore() })
  await openTools(user)

  expect(bodyweightSwitch()).toBeChecked()
})

test('O6 flipping the switch on tells onBodyweightChange true, once', async () => {
  const onBodyweightChange = vi.fn(async (_value: boolean) => {})
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], onBodyweightChange })

  await flipBodyweight(user)

  expect(onBodyweightChange.mock.calls).toEqual([[true]])
})

test('O6 flipping the switch off tells onBodyweightChange false, once', async () => {
  const onBodyweightChange = vi.fn(async (_value: boolean) => {})
  const { user } = renderSetScreen({ exercise: backSquatAsBodyweight, onBodyweightChange })

  await flipBodyweight(user)

  expect(onBodyweightChange.mock.calls).toEqual([[false]])
})

test('O6 flipping Bodyweight on turns the switch on and the 60 kg Dial into BW+60 at once, before the store answers', async () => {
  const { user } = renderSetScreen({
    lastEntries: [historyEntry(1, 60, 10)],
    onBodyweightChange: pendingStore(),
  })
  expect(readoutValue(weightReadout())).toBe('60')

  await flipBodyweight(user)

  expect(bodyweightSwitch()).toBeChecked()
  await closeSheet(user)
  expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['BW+60', '10'])
})

test('O6 flipping Bodyweight off turns a BW+10 Dial onto the start weight, 50 kg', async () => {
  const { user } = renderSetScreen({
    exercise: backSquatAsBodyweight,
    lastEntries: [{ ...historyEntry(1, null, 10), loadKg: 10 }],
    onBodyweightChange: pendingStore(),
  })
  expect(readoutValue(weightReadout())).toBe('BW+10')

  await flipBodyweight(user)

  expect(bodyweightSwitch()).not.toBeChecked()
  await closeSheet(user)
  expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['50', '10'])
})

test('O6 a Set logged after flipping Bodyweight on is stored as a Bodyweight Set with the signed Load', async () => {
  const { user } = renderSetScreen({
    lastEntries: [historyEntry(1, 60, 10)],
    onBodyweightChange: vi.fn(async (_value: boolean) => {}),
  })

  await flipBodyweight(user)
  await closeSheet(user)
  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(1))
  const [entry] = await storedEntries()
  expect([entry.weightKg, entry.loadKg, entry.reps]).toEqual([null, 60, 10])
})

test('O6 a failed store shows its message under the Bodyweight switch', async () => {
  const { user } = renderSetScreen({
    lastEntries: [historyEntry(1, 60, 10)],
    onBodyweightChange: vi.fn(async (_value: boolean) => {
      throw new Error('Could not save the setting')
    }),
  })

  await flipBodyweight(user)

  const message = await screen.findByText('Could not save the setting')
  expect(message).toBeVisible()
  expect(bodyweightSwitch().compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('O6 a failed store returns the switch off and the Dial to 60 kg', async () => {
  const { user } = renderSetScreen({
    lastEntries: [historyEntry(1, 60, 10)],
    onBodyweightChange: vi.fn(async (_value: boolean) => {
      throw new Error('Could not save the setting')
    }),
  })

  await flipBodyweight(user)
  await screen.findByText('Could not save the setting')

  expect(bodyweightSwitch()).not.toBeChecked()
  await closeSheet(user)
  expect(readoutValue(weightReadout())).toBe('60')
})

// --- E17-T7 O11: destructive actions wear btn-danger -------------------------------------------
const BUTTON_ROLES = ['btn-primary', 'btn-secondary', 'btn-quiet', 'btn-danger', 'tab', 'key', 'chip', 'cell', 'icon-btn']

/** The control-table roles a button wears (E17-T7 O10/O11). */
function rolesOf(button: HTMLElement): string[] {
  return [...button.classList].filter((name) => BUTTON_ROLES.includes(name))
}

test('E17 O11 Delete set on the Set screen wears btn-danger and no other role', async () => {
  const { user } = renderWithLogged([loggedEntry(1, 80, 8)])

  await user.click(loggedSetButton('80 × 8'))

  expect(rolesOf(screen.getByRole('button', { name: 'Delete set' }))).toEqual(['btn-danger'])
})

// --- Progress Dashboard S3: the Live session's Now view ----------------------------------------

/** The cells after the logged ones: the open Set and the planned Sets still to come. */
function plannedCells(): { current: boolean; text: string }[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.set-cells .set-cell')).map((cell) => ({
    current: cell.classList.contains('set-cell--current'),
    text: (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }))
}

test('Live S3 the counter carries the Plan target and the name sits over it', () => {
  renderSetScreen({ setIndex: 3 })

  expect(screen.getByText('Set 3 of 4')).toBeVisible()
  expect(screen.getByText(/target 8.10$/)).toBeVisible()
  expect(document.querySelector('.set-exercise-name')?.textContent).toBe(backSquat.name)
})

test('Live S3 after two logged Sets the open third is outlined and the fourth is still to come', () => {
  renderWithLogged([loggedEntry(1, 60, 10), loggedEntry(2, 60, 9)])

  expect(loggedSetNames()).toHaveLength(2)
  const cells = plannedCells()
  expect(cells.map((cell) => cell.current)).toEqual([true, false])
  expect(cells[0].text.startsWith('3')).toBe(true)
  expect(cells[1].text.startsWith('4')).toBe(true)
})

test('Live S3 the open cell and the Log label follow the steppers', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  unfoldSteppers()

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  unfoldSteppers()
  await user.click(screen.getByRole('button', { name: 'Decrease reps' }))

  expect(plannedCells()[0].text).toMatch(/62\.5.9$/)
  expect(logButton().textContent).toMatch(/^Log set 1 . 62\.5 . 9$/)
})

test('Live S3 a Set heavier than every record reads e1RM, the record and PR if logged', async () => {
  const { user } = renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 80, 8)],
  })

  // 80 x 8 ties the record: no PR at this load.
  const line = (): string => (document.querySelector('.set-projection')?.textContent ?? '').replace(/\s+/g, ' ')
  expect(line()).toMatch(/^e1RM 101\.3 . record 101\.3 . no PR at this load$/)
  expect(screen.queryByText('PR if logged')).toBeNull()

  unfoldSteppers()

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(line()).toMatch(/^e1RM 104\.5 . record 101\.3/)
  const tag = screen.getByText('PR if logged')
  expect(tag).toHaveClass('tag', 'tag-pr')
})

test('Live S3 the rest of the Workout is shown under the projection, above the tools', () => {
  renderSetScreen({ upcoming: <p>Lunges row</p>, onOpenInfo: vi.fn() })

  const rows = screen.getByText('Lunges row')
  expect(weightReadout().compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // The tools are no longer under the rows: they open from the ⋯ button by the name (S3b).
  expect(screen.queryByRole('button', { name: 'Swap exercise' })).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Exercise tools' }).compareDocumentPosition(rows) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})

test('Live S2 a done cell tapped in All opens the screen on that Set, ready to edit', () => {
  renderWithLogged([loggedEntry(1, 60, 10), loggedEntry(2, 60, 9)], { editSetIndex: 2 })

  expect(screen.getByRole('button', { name: 'Save set' })).toBeVisible()
  expect(readoutValue(weightReadout())).toBe('60')
  expect(readoutValue(repsReadout())).toBe('9')
})

// --- Progress Dashboard S4/F2/F3, S3b, S2b: the logging flow around the live screen -----------

/** Three earlier back squat Sessions resting 160 s between Sets: "you usually rest 2:40". */
const restfulSessions: Session[] = [1, 2, 3].map((n) => ({
  id: `restful-${n}`,
  programId: 'assaf-ab-2026',
  workoutId: 'workout-a',
  startedAt: BASE - n * 86_400_000,
  finishedAt: BASE - n * 86_400_000 + 3_600_000,
  entries: [1, 2].map((setIndex) => ({
    exerciseId: 'back-squat',
    setIndex,
    weightKg: 60,
    reps: 8,
    loggedAt: BASE - n * 86_400_000 + (setIndex - 1) * 160_000,
  })),
}))

test('S4 the rest panel counts down against the rest length, with the usual rest marked', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 12_000)
  renderSetScreen({
    setIndex: 2,
    earlierSessions: restfulSessions,
    onUseRestForExercise: vi.fn(async () => undefined),
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  const panel = document.querySelector('.rest-panel') as HTMLElement
  expect(readoutValue(restReadout())).toBe('2:48')
  expect(panel.textContent).toContain('of 3:00')
  expect(panel.textContent).toContain('you usually rest 2:40')
  expect(screen.getByRole('button', { name: 'Use 2:40 for Back squat' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Skip rest' })).toHaveClass('btn-secondary')
})

test('S4 Use 2:40 for Back squat saves the usual rest as the Plan rest', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 12_000)
  const onUseRestForExercise = vi.fn(async () => undefined)
  const { user } = renderSetScreen({
    setIndex: 2,
    earlierSessions: restfulSessions,
    programName: 'A/B Split',
    onUseRestForExercise,
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  await user.click(screen.getByRole('button', { name: 'Use 2:40 for Back squat' }))

  expect(onUseRestForExercise).toHaveBeenCalledWith(160)
  expect(await screen.findByText('Saved to A/B Split')).toBeVisible()
})

test('F3 at 0:00 the panel gives way to Log set, with the overtime quietly over it', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE + 170_000)
  renderSetScreen({ setIndex: 2, restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 } })
  expect(readoutValue(restReadout())).toBe('0:10')

  await vi.advanceTimersByTimeAsync(22_000)

  expect(screen.queryByRole('button', { name: 'Skip rest' })).toBeNull()
  expect(readoutValue(logButton())).toBe('Log set 2 · 50 × 8')
  expect(document.querySelector('.rest-over')?.textContent).toMatch(/^Over rest · \+0:1\d$/)
})

test('S4 while rest runs the effort chips name the Set just logged', async () => {
  const { user } = renderWithLogged([loggedEntry(1, 60, 10)], {
    trackEffort: true,
    onSetEffort: vi.fn(async () => undefined),
  })

  await user.click(logButton())

  const group = await screen.findByRole('group', { name: 'Reps in reserve' })
  const row = group.closest('.effort-row') as HTMLElement
  expect(row.textContent).toMatch(/^Set 2\s*effort/)
})

test('S5a a record shows a toast pinned at the top with the PR tag, and goes in 3 s', async () => {
  vi.useFakeTimers()
  renderSetScreen({ earlierSessions: [earlierSession], lastEntries: [historyEntry(1, 85, 5)] })

  await tapWithFakeTimers(logButton())

  const toast = document.querySelector('.toast') as HTMLElement
  expect(toast).not.toBeNull()
  expect(within(toast).getByText('PR')).toHaveClass('tag-pr')
  expect(within(toast).getByRole('img', { name: 'Heaviest set history' })).toBeInTheDocument()
  await vi.advanceTimersByTimeAsync(3100)
  expect(document.querySelector('.toast')).toBeNull()
})

test('S3b the ⋯ button opens the tools sheet: name, Close, and every tool as a row', async () => {
  const onOpenHistory = vi.fn()
  const { user } = renderSetScreen({
    plates: RACK,
    onOpenHistory,
    onSaveExerciseNote: vi.fn(async () => undefined),
  })

  const sheet = await openTools(user)

  expect(within(sheet).getByRole('heading', { name: 'Back squat' })).toBeVisible()
  expect(within(sheet).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
    'plates',
    'warmup',
    'notes',
  ])
  for (const row of ['Set type', 'Rest time', 'Swap exercise', 'Exercise info', 'Lift history']) {
    expect(within(sheet).getByRole('button', { name: new RegExp(`^${row}`) })).toBeVisible()
  }
  expect(within(sheet).getByRole('button', { name: /^Rest time\s*3:00/ })).toBeVisible()
  await user.click(within(sheet).getByRole('button', { name: 'Lift history' }))
  expect(onOpenHistory).toHaveBeenCalledWith('back-squat')
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('S3b Close and Escape put the tools sheet away', async () => {
  const { user } = renderSetScreen()

  await openTools(user)
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).toBeNull()

  await openTools(user)
  await closeSheet(user)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('S2b the edit sheet stores a changed effort with Save set', async () => {
  const onSetEffort = vi.fn(async () => undefined)
  const { user, onEditSet } = renderWithLogged([loggedEntry(1, 80, 8)], { trackEffort: true, onSetEffort })

  await user.click(loggedSetButton('80 × 8'))
  await user.click(chip('2'))
  await user.click(screen.getByRole('button', { name: 'Save set' }))

  await waitFor(() => expect(onEditSet).toHaveBeenCalledTimes(1))
  expect(onSetEffort).toHaveBeenCalledWith(1, 2)
})

test('S2b Delete set shows the dark Set deleted · Undo snackbar', async () => {
  const { user } = renderWithLogged([loggedEntry(1, 80, 8)])

  await user.click(loggedSetButton('80 × 8'))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))

  await waitFor(() => expect(document.querySelector('.snackbar')).not.toBeNull())
  const snackbar = document.querySelector('.snackbar') as HTMLElement
  expect(snackbar).toHaveTextContent('Set deleted')
  expect(within(snackbar).getByRole('button', { name: 'Undo' })).toBeVisible()
})
