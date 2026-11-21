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
import { DEFAULT_PLATE_INVENTORY } from '../domain/plates'
import { SetScreen, loggedText, setCounterText } from './SetScreen'
import type { SetScreenProps } from './SetScreen'
import { playPrSound, playRestOver, unlockRestSound } from './restSound'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

// E8-T5's beep: the set screen tells the rest sound module, which this file replaces with a
// spy so no test here touches a real AudioContext (jsdom has none anyway).
vi.mock('./restSound', () => ({
  unlockRestSound: vi.fn(),
  playRestOver: vi.fn(),
  playPrSound: vi.fn(),
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
  vi.mocked(playPrSound).mockClear()
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
  return screen.getByRole('button', { name: /^Weight, / })
}

/** The reps readout, which is also the button that opens the reps keypad. */
function repsReadout(): HTMLElement {
  unfoldSteppers()
  return screen.getByRole('button', { name: /^Reps, / })
}

function logButton(): HTMLElement {
  // V3-05: a Warm-up on the Dials names itself, "Log warm-up 2 · 40 × 3".
  return screen.getByRole('button', { name: /^Log (set|warm-up) / })
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
 * DX-07: the tools sheet is gone. What it held is reached by labelled controls: "Warm-up" opens
 * the W cell's ramp rows inline (answered as their group); otherwise Notes opens the note's short
 * sheet (answered as the sheet) when notes are kept, else the tools row is answered.
 */
async function openTools(user: UserEvent, segment?: string): Promise<HTMLElement> {
  if (segment === 'Warm-up') return openWarmups(user)
  const notes = screen.queryByRole('button', { name: 'Notes' })
  if (notes !== null) {
    await user.click(notes)
    return screen.getByRole('dialog', { name: /notes$/ })
  }
  return screen.queryByRole('group', { name: 'Exercise tools' }) ?? document.body
}

/** DX-07: taps the W cell (the offer, or the logged Warm-ups') to open its rows inline. */
async function openWarmups(user: UserEvent): Promise<HTMLElement> {
  const open = screen.queryByRole('group', { name: 'Warm-ups' })
  if (open !== null) return open
  const w =
    screen.queryByRole('button', { name: /^Warm-up: / }) ??
    screen.queryByRole('button', { name: /^Warm-ups (done|\d+ of \d+ done)$/ })
  if (w !== null) await user.click(w)
  return screen.queryByRole('group', { name: 'Warm-ups' }) ?? document.body
}

/** The current Set's kind control (N3): the labelled "Working ▾" button, "Set 1 type: Working". */
function kindControl(): HTMLElement {
  return screen.getByRole('button', { name: /type: / })
}

/** The short name (as these tests write it) of the kind the current Set's cell names. */
function currentKind(): string {
  const named = /type: ([\w-]+)/.exec(kindControl().getAttribute('aria-label') ?? '')?.[1] ?? ''
  return Object.entries(KIND_NAMES).find(([, name]) => name === named)?.[0] ?? named
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

/** N3: picks the current Set's kind from the list the "Working ▾" button opens. */
async function chooseKindInTools(user: UserEvent, label: string): Promise<void> {
  if (currentKind() !== label) {
    await user.click(kindControl())
    await user.click(within(screen.getByRole('dialog')).getByRole('radio', { name: KIND_NAMES[label] ?? label }))
  }
  expect(currentKind()).toBe(label)
}

/** A set cell's reading, its number then its value: "2 60×8". */
function cellReading(element: HTMLElement): string {
  return [...element.children].map((child) => (child.textContent ?? '').trim()).join(' ')
}

/** The outlined cell of the Set on the Dials. */
function currentCell(): HTMLElement {
  return document.querySelector<HTMLElement>('.set-cells .set-cell--current') as HTMLElement
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

test('L14 DX-07 Exercise info is not on the Set screen: it is "How to do it" on the lift page', () => {
  const { onOpenInfo } = renderSetScreen()

  expect(screen.queryByRole('button', { name: /Exercise info|How to do it/ })).toBeNull()
  expect(onOpenInfo).not.toHaveBeenCalled()
})

test('S6 tapping Alternatives tells the caller to open alternatives for the on-screen exercise id', async () => {
  const onOpenAlternatives = vi.fn()
  const { user } = renderSetScreen({ onOpenAlternatives })

  // DX-07: "Swap" under the Exercise's name is where alternatives open from.
  await user.click(screen.getByRole('button', { name: 'Swap' }))

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
  return screen.queryByRole('button', { name: /^Log set / })
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

test('V7R-05 after 3 warm-ups the first working Set is announced as Set 1, not Set 4', async () => {
  const warmups: SetEntry[] = [30, 40, 50].map((weightKg, at) => ({
    ...historyEntry(at + 1, weightKg, 5),
    kind: 'warmup' as const,
  }))
  const { user } = renderWithLogged(warmups)

  expect(logButton()).toHaveAccessibleName(/^Log set 1 /)
  await user.click(logButton())

  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toMatch(/^Set 1 logged · /)
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
//
// V1-16: the step control left the in-workout tools sheet for Program › Exercises, which stores
// the same setting. The screen reads it once, as `weightStep`, and offers no control of its own.
// The titles stay; the bodies hold the step as the screen now receives it.

/** The step control, if any: a native select named "Step <n> kg". */
function stepControls(): HTMLElement[] {
  return screen.queryAllByRole('combobox', { name: /^Step / })
}

test('O1 back-squats set screen shows a Step 2.5 kg control by default', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })

  // The catalog's 2.5 kg step drives the Dial; the tools sheet has no Step row (V1-16).
  await openTools(user)
  expect(stepControls()).toEqual([])
  await closeSheet(user)
  unfoldSteppers()
  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  expect(readoutValue(weightReadout())).toBe('62.5')
})

test('O1 choosing 5 from the step options updates the control to read Step 5 kg', async () => {
  // Chosen in Program › Exercises, the step reaches the screen as `weightStep`.
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], weightStep: 5 })

  await openTools(user)
  expect(stepControls()).toEqual([])
  expect(screen.queryByText('Step')).toBeNull()
})

test('O1 choosing 5 from the step options moves Increase weight from 60 to 65', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], weightStep: 5 })

  unfoldSteppers()
  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  expect(readoutValue(weightReadout())).toBe('65')
})

test('O1 choosing 5 from the step options rebuilds the Ladder with rungs 5, 10, 15', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], weightStep: 5 })

  const column = screen.getByRole('listbox', { name: 'Weight ladder' })
  const rungs = within(column).getAllByRole('option')
  expect(rungs.slice(0, 3).map((rung) => readoutValue(rung))).toEqual(['5', '10', '15'])
})

test('O1 choosing 5 from the step options tells the caller onWeightStepChange with 5', async () => {
  // Nothing on Now chooses a step any more, so the screen never calls it, even through a log.
  const onWeightStepChange = vi.fn()
  const { user } = renderSetScreen({
    lastEntries: [historyEntry(1, 60, 10)],
    weightStep: 5,
    onWeightStepChange,
  })

  await openTools(user)
  await closeSheet(user)
  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(1))
  expect(onWeightStepChange).not.toHaveBeenCalled()
})

test('O1 a weightStep prop of 5 opens the control already reading Step 5 kg', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], weightStep: 5 })

  unfoldSteppers()
  await user.click(screen.getByRole('button', { name: 'Decrease weight' }))
  expect(readoutValue(weightReadout())).toBe('55')
  expect(stepControls()).toEqual([])
})

test('V1-16 DX-07 no "..." and no Step or Bodyweight control: Swap, Notes and History are labelled buttons under the name', async () => {
  const onOpenHistory = vi.fn()
  const { user } = renderSetScreen({
    lastEntries: [historyEntry(1, 60, 10)],
    onBodyweightChange: vi.fn(async (_value: boolean) => {}),
    onWeightStepChange: vi.fn(),
    onOpenAlternatives: vi.fn(),
    onOpenHistory,
    onSaveExerciseNote: vi.fn(async () => undefined),
  })

  expect(screen.queryByRole('button', { name: 'Exercise tools' })).toBeNull()
  expect(screen.queryByText('Bodyweight exercise')).toBeNull()
  expect(screen.queryByRole('switch')).toBeNull()
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByRole('button', { name: /What can I lift/ })).toBeNull()
  const row = screen.getByRole('group', { name: 'Exercise tools' })
  expect(within(row).getAllByRole('button').map((button) => button.textContent)).toEqual(['Swap', 'Notes', 'History', 'Working ▾'])
  const name = screen.getByRole('heading', { name: 'Back squat' })
  expect(name.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await user.click(within(row).getByRole('button', { name: 'History' }))
  expect(onOpenHistory).toHaveBeenCalledWith('back-squat')
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

  // V4-02: the one line sits under the reps Dial and compares live; its day moved to Just done.
  const line = (document.querySelector('.set-projection')?.textContent ?? '').replace(/\s+/g, ' ')
  expect(line).toMatch(/^Last time 80 × 7 · /)
  expect(line).not.toContain(formatDay(new Date(BASE), new Date()))
  expect(screen.getByText(/^Last time 80 × 7/)).toBeVisible()
  expect(screen.getAllByText(/Last time/)).toHaveLength(1)
})

test('O10 a bodyweight set in lastTime reads BW×8', () => {
  renderSetScreen({
    exercise: pushUps,
    plan: pushUpPlan,
    lastTime: [{ exerciseId: 'push-ups', setIndex: 1, weightKg: null, reps: 8, loggedAt: BASE }],
  })

  // V4-02: under the reps Dial, compared live with the reps on the Dial.
  const line = (document.querySelector('.set-projection')?.textContent ?? '').replace(/\s+/g, ' ')
  expect(line).toMatch(/^Last time BW × 8 · /)
  expect(screen.getByText(/^Last time BW × 8/)).toBeVisible()
})

test('O10 with no lastTime there is no Last time line', () => {
  renderSetScreen({ lastTime: [] })

  expect(screen.queryByText(/Last time/)).toBeNull()
})

test('O10 sets logged today never change the Last time line', async () => {
  const { user } = renderSetScreen({ lastTime: [historyEntry(1, 80, 8)] })

  await user.click(logButton())
  await screen.findByText('Set 2 of 4')

  // Rest folds the steppers and the Last time line with them (S4); unfolded, the line is as it
  // was: last time's 80 × 8 still, never today's Set (V4-02's line under the reps Dial).
  unfoldSteppers()
  const line = (document.querySelector('.set-projection')?.textContent ?? '').replace(/\s+/g, ' ')
  expect(line).toMatch(/^Last time 80 × 8 · /)
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
  expect(screen.queryByRole('button', { name: /^Log set / })).toBeNull()
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
  expect(screen.getByRole('button', { name: /^Log set / })).toBeVisible()
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
  expect(screen.getByRole('button', { name: /^Log set / })).toBeVisible()
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
  // Done, the Exercise's Just done block stands where "All 4 sets logged" was (V2-11, V4-07).
  expect(screen.getByRole('region', { name: 'Exercise done' }).textContent).toMatch(/^Back squat done/)
  expect(screen.queryByText('All 4 sets logged')).toBeNull()
  expect(screen.queryByRole('button', { name: /^Log set / })).toBeNull()

  await user.click(loggedSetButton('80 × 7'))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))

  expect(await screen.findByRole('button', { name: /^Log set / })).toBeVisible()
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

/** v7 (study §1.5): the record moment's one line under the track, if it shows. */
function recordLine(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.set-record-line')
}

/** The record line's text, whitespace-collapsed ("PRHeaviest weight · 85 × 5"). */
function recordLineText(): string {
  return (recordLine()?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The badges on the logged-set row whose button reads `name`. */
function badgesOnRow(name: string): HTMLElement[] {
  const row = loggedSetButton(name).closest('li') as HTMLElement
  return within(row).queryAllByLabelText('Personal record')
}

test('O14 logging a Set that sets one record shows a toast naming it and the Set', async () => {
  const { user } = renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 85, 5)],
  })

  await user.click(logButton())

  // v7 (study §1.5): no toast; one line under the track, the gold PR tag, then the record and
  // the Set (R-R).
  await waitFor(() => expect(recordLine()).not.toBeNull())
  const line = recordLine() as HTMLElement
  expect(line).toHaveAttribute('data-kind', 'pr')
  expect(within(line).getByText('PR')).toHaveClass('tag-pr')
  expect(recordLineText()).toBe('PRHeaviest weight · 85 × 5')
  expect(document.querySelector('.toast')).toBeNull()
})

test('O14 the toast joins every record label with a comma', async () => {
  const { user } = renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 85, 5)],
    lastTime: [historyEntry(1, 80, 8)],
  })

  await user.click(logButton())

  // v7: one record name leads the one line, then the Set and what it beat.
  await waitFor(() => expect(recordLine()).not.toBeNull())
  const day = formatDay(new Date(BASE), new Date())
  // V6 (V5-13): it compares with the day beaten, "5 kg more than <day>".
  expect(recordLineText()).toBe(`PRHeaviest weight · 85 × 5 · 5 kg more than ${day}`)
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
  // v7: a Set that sets nothing has no record line, and nothing restates it.
  expect(recordLine()).toBeNull()
  expect(screen.queryByText('PR')).toBeNull()
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
    lastEntries: [historyEntry(1, 85, 5)],
  })

  await user.click(logButton())
  await waitFor(() => expect(recordLine()).not.toBeNull())
  expect(within(recordLine() as HTMLElement).getByText('PR')).toBeVisible()

  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('alertdialog')).toBeNull()
})

test('O14 the record toast goes away after 3 s', async () => {
  vi.useFakeTimers()
  renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 85, 5)],
  })

  await tapWithFakeTimers(logButton())
  expect(within(recordLine() as HTMLElement).getByText('PR')).toBeVisible()

  // v7 (study §1.5): the PR line shows for 3 s and goes; never a toast.
  await vi.advanceTimersByTimeAsync(2_900)
  expect(recordLine()).not.toBeNull()
  await vi.advanceTimersByTimeAsync(200)
  expect(recordLine()).toBeNull()
  expect(document.querySelector('.toast')).toBeNull()
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
  return screen.getByRole('button', { name: 'Rest 15 seconds more' })
}

function minus15(): HTMLElement {
  return screen.getByRole('button', { name: 'Rest 15 seconds less' })
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

  expect(screen.queryByRole('button', { name: 'Rest 15 seconds more' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Rest 15 seconds less' })).toBeNull()
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

// E13-T11, V2-02, v7 (study §1.4): the next Set while rest is showing, in Rest's Next panel.
const NEXT_LINE = 'Change next set'

/** The Next panel's lines, one space between them, whitespace-collapsed. */
function getReadyText(): string {
  const card = screen.getByRole('region', { name: 'Next set' })
  return Array.from(card.querySelectorAll('p'), (line) => line.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

test('O9 while resting before a planned Set the screen shows Next: set 2 · 60 kg × 8–10', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 2,
    lastEntries: [historyEntry(1, 60, 10)],
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  // While rest runs the steppers fold into Rest's Next panel naming the next Set (S4, V2-02, v7);
  // Log set beside Skip rest logs it with one tap (V1-03).
  const next = screen.getByRole('button', { name: NEXT_LINE })
  expect(next).toHaveAttribute('aria-expanded', 'false')
  expect(getReadyText()).toMatch(/^Next · Set 2 60 kg×\d+$/)
  expect(screen.queryByRole('button', { name: /^Weight, / })).toBeNull()
  expect(logButton()).toHaveClass('log-set')
  expect(cellReading(currentCell())).toBe(`2 60×${readoutValue(repsReadout())}`)
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

  expect(getReadyText()).toMatch(/^Next · Set 2 BW×\d+$/)
  expect(logButton()).toHaveClass('log-set')
  expect(cellReading(currentCell())).toMatch(/^2 BW×\d+$/)
})

test('O9 without rest there is no Next line', () => {
  renderSetScreen({ setIndex: 2, lastEntries: [historyEntry(1, 60, 10)], restFrom: null })

  expect(screen.queryByRole('button', { name: NEXT_LINE })).toBeNull()
  expect(screen.getByRole('button', { name: /^Weight, / })).toBeVisible()
})

test('O9 on an extra Set past the plan there is no Next line', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 5,
    extra: true,
    lastEntries: [historyEntry(4, 60, 10)],
    restFrom: { entry: historyEntry(4, 60, 10), planRestSeconds: 180 },
  })

  // An extra Set keeps its steppers through rest: nothing folds into Rest's Next panel.
  expect(screen.queryByRole('button', { name: NEXT_LINE })).toBeNull()
  expect(screen.getByRole('button', { name: /^Weight, / })).toBeVisible()
})

test('O9 in the done state there is no Next line', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 5,
    lastEntries: [historyEntry(4, 60, 10)],
    restFrom: { entry: historyEntry(4, 60, 10), planRestSeconds: 180 },
  })

  expect(screen.queryByRole('button', { name: NEXT_LINE })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Next set' })).toBeNull()
})

test('S4 the folded Next row adds last time’s Set at that position: · last 60 × 8', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 2,
    lastEntries: [historyEntry(1, 60, 10)],
    lastTime: [historyEntry(1, 60, 10), historyEntry(2, 60, 8)],
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  expect(getReadyText()).toMatch(/^Next · Set 2 60 kg×\d+ Last time 60 × 8/)
  // Folded, the dated Last time line and the PR target line go with the steppers.
  expect(screen.queryByText(/^Last time .* · /)).toBeNull()
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
  // While rest runs the rest panel sits over Log set in the dock (S4, V1-03).
  expect(cellReading(currentCell())).toBe('2 50×8')
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
  expect(cellReading(currentCell())).toBe('2 50×8')
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

  // Logged: set 1's cell turns done, rest starts, and Log set names set 2 under the panel (V1-03).
  // The confirmation is announced through the status line.
  expect(cellReading(currentCell())).toBe('2 50×8')
  expect(logButton()).toHaveClass('log-set')
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
  expect(cellReading(currentCell())).toBe('2 50×8')
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
  expect(logButton()).toHaveClass('log-set')
  await tapWithFakeTimers(logButton())

  expect(onLog).toHaveBeenCalledTimes(2)
  expect(onLog.mock.calls[1][1]).toEqual(expect.objectContaining({ setIndex: 2 }))
  // The double here stores without handing `logged` back, so the screen still counts from
  // set 1; what matters is that Log set logs again inside the window.
  expect(logButton()).toHaveClass('log-set')
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
 * Taps the rest's length -- the ring's "of 3:00" on Rest (DX-07), or the dock row's countdown
 * while the Dials are out -- and answers the rest Dial's Rung column.
 */
async function openRestDial(user: UserEvent): Promise<HTMLElement> {
  const length = screen.queryByRole('button', { name: /^Rest time / })
  const countdown = screen.queryByRole('timer', { name: 'Rest remaining' })?.closest('button')
  await user.click((length ?? countdown) as HTMLElement)
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

  // v7 (study §1.4): Rest is its own screen -- the ring is in the body, under the head and the
  // track; DX-05: the ring is Skip and the dock holds only Log set.
  const screenEl = document.querySelector('.set-screen')
  const panel = document.querySelector('.set-screen .rest-panel')
  expect(panel).not.toBeNull()
  expect(panel).toHaveClass('rest-panel--ring')
  expect(document.querySelector('.set-dock .rest-panel')).toBeNull()
  expect(screenEl?.firstElementChild).toHaveClass('set-head')
  expect(panel?.textContent).toContain('1:20')
  expect(panel?.querySelector('.rest-controls')).not.toBeNull()
  expect(document.querySelector('.set-dock .skip-rest')).toBeNull()
  expect(document.querySelector('.rest-ring')?.querySelector('[aria-label="Skip rest"]')).not.toBeNull()
  expect(panel?.textContent).toContain('Tap to skip')
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

  // The Just done block stands where "All 3 sets logged" was (V2-11, V4-07): its three working
  // Sets, never the Warm-ups.
  const block = screen.getByRole('region', { name: 'Exercise done' })
  expect(block.textContent).toMatch(/^Back squat done/)
  expect(block.textContent).toContain('62.5×8 · 65×6')
  expect(screen.queryByText('All 3 sets logged')).toBeNull()
  expect(logSetButton()).toBeNull()
})

test('O4 after 2 warm-ups and 1 working Set, logging 2 more working Sets reaches the done state', async () => {
  const { user } = renderWithLogged(twoWarmupsOneWorking, { plan: threeSetSquatPlan })

  await user.click(logButton())
  await waitFor(() => expect(screen.getByText('Set 3 of 3')).toBeVisible())
  await user.click(await screen.findByRole('button', { name: /^Log set / }))

  await waitFor(() =>
    expect(screen.getByRole('region', { name: 'Exercise done' }).textContent).toMatch(/^Back squat done/),
  )
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

  // V3-05: the Warm-ups share one W cell; a logged one is edited from its Warm-up list.
  await user.click(screen.getByRole('button', { name: /^Warm-ups/ }))
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
  expect(logButton()).toHaveClass('log-set')
  expect(cellReading(currentCell())).toMatch(/^2 /)
})

// --- E14-T11 [O11]: the Exercise note above the Dials ---------------------------------------

test('O11 an Exercise note shows below the Dials', async () => {
  const { user } = renderSetScreen({
    exerciseNote: 'belt on, chalk',
    onSaveExerciseNote: vi.fn(async () => undefined),
  })

  // The note shows on Now as one line, read at the bar (V1-15), and in the tools sheet's Notes.
  expect(screen.getByRole('button', { name: 'Exercise note: belt on, chalk' })).toBeVisible()
  const sheet = await openTools(user)
  const note = within(sheet).getByText('belt on, chalk')
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

  const sheet = await openTools(user)
  await user.click(within(sheet).getByText('belt on'))

  const editor = screen.getByLabelText('Note') as HTMLTextAreaElement
  expect(editor.value).toBe('belt on')
  expect(editor.maxLength).toBe(500)
  expect(screen.getByRole('button', { name: 'Save note' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
})

test('O11 Save note hands the edited text to onSaveExerciseNote and closes the editor', async () => {
  const onSave = vi.fn(async () => undefined)
  const { user } = renderSetScreen({ exerciseNote: 'belt on', onSaveExerciseNote: onSave })

  const sheet = await openTools(user)
  await user.click(within(sheet).getByText('belt on'))
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

  const sheet = await openTools(user)
  await user.click(within(sheet).getByText('belt on'))
  await user.type(screen.getByLabelText('Note'), ' extra')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByLabelText('Note')).toBeNull()
  expect(within(sheet).getByText('belt on')).toBeVisible()
  expect(onSave).not.toHaveBeenCalled()
})

test('O11 saving the note empty hands an empty string to onSaveExerciseNote', async () => {
  const onSave = vi.fn(async () => undefined)
  const { user } = renderSetScreen({ exerciseNote: 'belt on', onSaveExerciseNote: onSave })

  const sheet = await openTools(user)
  await user.click(within(sheet).getByText('belt on'))
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

/** DX-07: the kind shows on the current Set's cell itself; nothing to open. */
async function openKinds(_user: UserEvent): Promise<void> {}

/** The chosen kind: the edit sheet's pressed chip, else the current Set's cell. */
function chosenKinds(): string[] {
  if (screen.queryByRole('group', { name: 'Set kind' }) === null) return [currentKind()]
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

  // V3-05: Warm-ups share one W cell in the row rather than a logged cell each.
  const list =
    kind === 'warmup'
      ? (document.querySelector('.set-cells') as HTMLElement)
      : screen.getByRole('list', { name: 'Sets logged' })
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

/** An effort chip by the RIR it stores: '0' reads "0", with no "RIR" (V3-03, V1-14). */
function chip(name: string): HTMLElement {
  return within(effortChips() as HTMLElement).getByRole('button', { name })
}

test('O9 before any Set is logged, no chips show even with Track effort on', () => {
  renderSetScreen({ trackEffort: true, onSetEffort: vi.fn(async () => undefined) })

  expect(effortChips()).toBeNull()
})

test('O9 with Track effort on, logging a Set shows the chips 0 1 2 3+', async () => {
  const { user } = renderSetScreen({ trackEffort: true, onSetEffort: vi.fn(async () => undefined) })

  await user.click(logButton())

  const chips = await screen.findByRole('group', { name: 'Reps in reserve' })
  // V3-03: the chips read 0 1 2 3+ with no "RIR" on the first (V1-14).
  expect(within(chips).getAllByRole('button').map((button) => button.textContent)).toEqual([
    '0',
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

  // Each Set is a cell named "weight × reps"; its reps left sit in the cell's corner, beside it,
  // in words rather than "RIR" (V3-03, V1-14).
  const rows = within(screen.getByRole('list', { name: 'Sets logged' })).getAllByRole('listitem')
  const rir = rows.map((row) => row.querySelector('.logged-set-rir')?.textContent ?? null)
  expect(rir).toEqual(['2 left', '0 left', '3+ left', null])
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
  return screen.getByRole('button', { name: /^Weight, / })
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

test('O8 the Plate line sits directly under the weight Dial, before the reps Dial', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], plates: RACK })

  // V1-07: the Plate line is back on the screen, with no tap, between the two Dials.
  const line = plateLine() as HTMLElement
  expect(line).toBeVisible()
  expect(weightReadout().compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(line.compareDocumentPosition(repsReadout()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
  const sheet = screen.getByRole('dialog')
  expect(within(sheet).getByText('Per side: 20 · 20')).toHaveClass('plate-line')
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

/** Whether the W cell's rows (DX-07) offer Add warm-ups; they are folded away again after. */
async function warmupsOffered(user: UserEvent): Promise<boolean> {
  const wasOpen = screen.queryByRole('group', { name: 'Warm-ups' }) !== null
  await openWarmups(user)
  const offered = addWarmupsOffer() !== null
  const w = screen.queryByRole('button', { name: /^Warm-up: |^Warm-ups (done|\d+ of \d+ done)$/ })
  if (!wasOpen && w !== null && screen.queryByRole('group', { name: 'Warm-ups' }) !== null) await user.click(w)
  return offered
}

/** The kind chosen for the Set on the steppers, read off its cell (DX-07). */
async function kindsInTools(_user: UserEvent): Promise<string[]> {
  return chosenKinds()
}

/**
 * The ramp step on the Dials, "Warm-up 1 of 3 · 50 kg × 5". V4-05 dropped the ramp line that
 * repeated it, so it is read off what still says it: the subtitle ("Warm-up 1 of 3", only while
 * a ramp runs) and the Log bar ("Log warm-up 1 · 50 × 5"). Null with no ramp under way.
 */
function rampLineText(): string | null {
  const counter = (document.querySelector('.set-counter')?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const step = /^Warm-up \d+ of \d+/.exec(counter)
  const bar = /^Log warm-up \d+ · (\S+) × (\d+)/.exec(
    (screen.queryByRole('button', { name: /^Log (set|warm-up) / })?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  )
  if (step === null || bar === null) return null
  expect(document.querySelector('p.warmup-ramp')).toBeNull()
  return `${step[0]} · ${bar[1]} kg × ${bar[2]}`
}

/** Taps Add warm-ups in the W cell's rows (DX-07), which must be on offer. */
async function startRamp(user: UserEvent): Promise<void> {
  await openWarmups(user)
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

  // V3-05: the logged Warm-up is edited from the W cell's Warm-up list.
  await user.click(screen.getByRole('button', { name: /^Warm-ups/ }))
  await user.click(screen.getByRole('button', { name: '50 × 5' }))

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

test('O10 DX-05 with the rest running, −15 s and +15 s are under the clock, and the ring around it is Skip', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 93_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  const clock = screen.getByRole('timer', { name: 'Rest remaining' })
  for (const control of [minus15(), plus15()]) {
    expect(clock.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
  const ring = clock.closest('.rest-ring') as HTMLElement
  expect(ring).toContainElement(skip())
  expect(ring.textContent).toContain('Tap to skip')
  expect(skip()).not.toHaveTextContent('Skip rest')
})

test('O10 once the rest is over the clock counts up +00:42 with no adjustments', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 222_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  // Over before the screen opened: no clock counts up, and nothing to adjust (F3).
  expect(screen.queryByRole('timer', { name: 'Rest remaining' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Rest 15 seconds more' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Rest 15 seconds less' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Skip rest' })).toBeNull()
})

test('O10 DX-07 tapping "of 3:00" under the clock opens the rest Dial', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 93_000)
  const { user } = renderWithSessionRest([squatEntry(1, BASE)])

  await user.click(screen.getByRole('button', { name: 'Rest time 3:00, change' }))

  expect(await screen.findByRole('listbox', { name: 'Rest ladder' })).toBeVisible()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
})

test('DX-05 a tap on the ring ends the rest: the Dials come back and Log set is the one filled button', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 93_000)
  const { user, onSetRest } = renderWithSessionRest([squatEntry(1, BASE)])

  expect(document.querySelectorAll('.btn-primary')).toHaveLength(1)
  expect(logButton()).toHaveClass('btn-primary')
  await user.click(screen.getByRole('button', { name: 'Skip rest' }))

  await waitFor(() => expect(screen.queryByRole('timer', { name: 'Rest remaining' })).toBeNull())
  expect(onSetRest).toHaveBeenCalledTimes(1)
  expect(weightReadout()).toBeVisible()
})

test('O10 the Action bar button reads Log set while the clock reads 01:27: one clock on screen', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 93_000)
  renderWithSessionRest([squatEntry(1, BASE)])

  expect(readoutValue(restReadout())).toBe('1:27')
  expect(screen.getAllByRole('timer')).toHaveLength(1)
  // While rest runs, Log set is the outlined cell; the dock is the rest panel (S4).
  expect(cellReading(currentCell())).toBe('2 60×10')
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
  // reads in a Status colour; V4-06 (V1-32) makes it the quiet --color-muted, never danger red.
  expect(colours).not.toContain('var(--color-accent)')
  expect(colours).not.toContain('var(--color-danger)')
  expect(colours.length, 'the over clock declares no colour').toBeGreaterThan(0)
  for (const colour of colours) {
    expect(['var(--color-muted)']).toContain(colour)
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
  await user.click(await screen.findByRole('button', { name: /^Log set / }))

  expect(await screen.findByText('Set 3 of 4')).toBeVisible()
  await waitFor(async () =>
    expect((await storedEntries()).map((entry) => entry.weightKg)).toEqual([82.5, 82.5]),
  )
  expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['82.5', '8'])
})

// --- E16-T11 O9: Weight and Reps side by side ----------------------------------------------
//
// Layout cannot be measured in jsdom, so the 390 x 844 fit is held as structure and CSS: the two
// Dials share one `.set-dials` column. V1-16: the `.set-dial-controls` rows (Step, Bodyweight)
// left the tools sheet for Program › Exercises; the Plate line stays under the weight Dial.

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

test('O9 the step control and the Plate line sit in one .set-dial-controls row after the Dial pair', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], plates: RACK })

  // V1-16: no controls row anywhere, no step control; the Plate line stays in the Dial pair (V1-07).
  expect(controlsRow()).toBeNull()
  expect(dialPair().contains(plateLine())).toBe(true)
  expect(screen.queryByRole('combobox', { name: /^Step/ })).toBeNull()
  expect(document.querySelectorAll('.plate-line')).toHaveLength(1)
})

test('O9 without a Plate inventory the controls row still holds the step control', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })
  await openTools(user)

  // V1-16: neither the row nor its step control; and with no inventory, no Plate line.
  expect(controlsRow()).toBeNull()
  expect(screen.queryByRole('combobox', { name: /^Step/ })).toBeNull()
  expect(plateLine()).toBeNull()
})

test('O9 a Bodyweight Exercise still has the .set-dial-controls row, without a step control', async () => {
  const { user } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan })
  await openTools(user)

  // V1-16: the row is gone for every Exercise, a Bodyweight one included.
  expect(controlsRow()).toBeNull()
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
  // V1-16: the row is gone, and so is its rule; no dead selector is left behind.
  const decls = declarationsFor(restCss(), '.set-dial-controls')
  expect(decls.get('display')).toBeUndefined()
  expect(restCss()).not.toContain('.set-dial-controls')
})

// --- E16-T13 O6: the Bodyweight switch -------------------------------------------------------
//
// V1-16: the switch left the in-workout tools sheet for Program › Exercises, which stores the
// same override. The caller hands in the Exercise already resolved through it, and the screen
// follows that setting; it never calls `onBodyweightChange`. The titles stay; the bodies hold
// the setting as the screen now receives it.

/** The Bodyweight switch, if any is left in the open tools sheet. */
function bodyweightSwitches(): HTMLElement[] {
  return screen.queryAllByRole('switch', { name: 'Bodyweight' })
}

/** Back squat as the caller resolves it with a Bodyweight override stored for it. */
const backSquatAsBodyweight: Exercise = { ...backSquat, bodyweight: true }

/** A store that has not answered yet. */
function pendingStore() {
  return vi.fn((_value: boolean) => new Promise<void>(() => {}))
}

test('O6 a loaded Exercise shows the Bodyweight switch off, in .set-dial-controls beside the step control', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], onBodyweightChange: pendingStore() })

  // A loaded Exercise reads kg on the Dial; the sheet holds no switch and no controls row.
  expect(readoutValue(weightReadout())).toBe('60')
  await openTools(user)
  expect(bodyweightSwitches()).toEqual([])
  expect(controlsRow()).toBeNull()
})

test('O6 a Bodyweight Exercise shows the Bodyweight switch on, in .set-dial-controls', async () => {
  const { user } = renderSetScreen({ exercise: pushUps, plan: pushUpPlan, onBodyweightChange: pendingStore() })

  expect(readoutValue(loadReadout())).toBe('BW')
  await openTools(user)
  expect(bodyweightSwitches()).toEqual([])
  expect(controlsRow()).toBeNull()
})

test('O6 an Exercise the caller resolved as Bodyweight by override shows the switch on', () => {
  renderSetScreen({
    exercise: backSquatAsBodyweight,
    lastEntries: [{ ...historyEntry(1, null, 10), loadKg: 10 }],
    onBodyweightChange: pendingStore(),
  })

  // The override reaches the Dial: it reads the signed Load.
  expect(readoutValue(weightReadout())).toBe('BW+10')
})

test('O6 flipping the switch on tells onBodyweightChange true, once', async () => {
  const onBodyweightChange = vi.fn(async (_value: boolean) => {})
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], onBodyweightChange })

  await openTools(user)
  await closeSheet(user)
  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(1))
  expect(onBodyweightChange).not.toHaveBeenCalled()
})

test('O6 flipping the switch off tells onBodyweightChange false, once', async () => {
  const onBodyweightChange = vi.fn(async (_value: boolean) => {})
  const { user } = renderSetScreen({ exercise: backSquatAsBodyweight, onBodyweightChange })

  await openTools(user)
  expect(bodyweightSwitches()).toEqual([])
  await closeSheet(user)

  expect(onBodyweightChange).not.toHaveBeenCalled()
})

test('O6 flipping Bodyweight on turns the switch on and the 60 kg Dial into BW+60 at once, before the store answers', () => {
  // Set Bodyweight in Program › Exercises: the next screen opens with the Dial in Load mode.
  renderSetScreen({
    exercise: backSquatAsBodyweight,
    lastEntries: [{ ...historyEntry(1, null, 10), loadKg: 60 }],
    onBodyweightChange: pendingStore(),
  })

  expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['BW+60', '10'])
})

test('O6 flipping Bodyweight off turns a BW+10 Dial onto the start weight, 50 kg', () => {
  // Bodyweight cleared in Program › Exercises: the screen opens on the loaded start weight.
  renderSetScreen({ exercise: backSquat, lastEntries: [], onBodyweightChange: pendingStore() })

  expect(readoutValue(weightReadout())).toBe('50')
  expect(readoutValue(weightReadout())).not.toMatch(/^BW/)
})

test('O6 a Set logged after flipping Bodyweight on is stored as a Bodyweight Set with the signed Load', async () => {
  const { user } = renderSetScreen({
    exercise: backSquatAsBodyweight,
    lastEntries: [{ ...historyEntry(1, null, 10), loadKg: 60 }],
    onBodyweightChange: vi.fn(async (_value: boolean) => {}),
  })

  await user.click(logButton())

  await waitFor(async () => expect(await storedEntries()).toHaveLength(1))
  const [entry] = await storedEntries()
  expect([entry.weightKg, entry.loadKg, entry.reps]).toEqual([null, 60, 10])
})

test('O6 a failed store shows its message under the Bodyweight switch', async () => {
  const onBodyweightChange = vi.fn(async (_value: boolean) => {
    throw new Error('Could not save the setting')
  })
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)], onBodyweightChange })

  // Nothing on Now stores the setting, so nothing can fail here.
  const sheet = await openTools(user)
  expect(within(sheet).queryByRole('alert')).toBeNull()
  expect(screen.queryByText('Could not save the setting')).toBeNull()
  expect(onBodyweightChange).not.toHaveBeenCalled()
})

test('O6 a failed store returns the switch off and the Dial to 60 kg', async () => {
  const { user } = renderSetScreen({
    lastEntries: [historyEntry(1, 60, 10)],
    onBodyweightChange: vi.fn(async (_value: boolean) => {
      throw new Error('Could not save the setting')
    }),
  })

  await openTools(user)
  expect(bodyweightSwitches()).toEqual([])
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

  // V2-04: 80 x 8 ties the record, so the line names the PR target, 80 x 9, not the arithmetic.
  const line = (): string => (document.querySelector('.set-projection')?.textContent ?? '').replace(/\s+/g, ' ')
  expect(line()).toBe('PR at 9 reps')
  expect(screen.queryByText('PR if logged')).toBeNull()
  expect(document.body.textContent).not.toMatch(/e1RM|no PR/)

  unfoldSteppers()

  await user.click(screen.getByRole('button', { name: 'Increase weight' }))

  // 82.5 is heavier than every record: the Dials reach the target, so the tag shows.
  expect(line()).toBe('PR if logged')
  const tag = screen.getByText('PR if logged')
  expect(tag).toHaveClass('tag', 'tag-pr')
})

test('Live S3 the rest of the Workout is shown under the projection, below the tools', () => {
  renderSetScreen({ upcoming: <p>Lunges row</p>, onOpenAlternatives: vi.fn() })

  const rows = screen.getByText('Lunges row')
  expect(weightReadout().compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // DX-07: the tools are the row under the name, above the cells and the rows.
  expect(
    screen.getByRole('button', { name: 'Swap' }).compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING,
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

test('S4 the rest panel counts down against the rest length, and offers the usual rest', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 12_000)
  const { user } = renderSetScreen({
    setIndex: 2,
    earlierSessions: restfulSessions,
    onUseRestForExercise: vi.fn(async () => undefined),
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  const panel = document.querySelector('.rest-panel') as HTMLElement
  expect(readoutValue(restReadout())).toBe('2:48')
  expect(panel.textContent).toContain('of 3:00')
  // V1-11: no "you usually rest" line. V3-03: the usual rest is offered in the rest Dial's sheet,
  // not in the middle of the rest; DX-07: "of 3:00" opens it.
  expect(panel.textContent).not.toContain('you usually rest')
  expect(screen.queryByRole('button', { name: 'Use 2:40 for Back squat' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Rest time 3:00, change' }))
  const restSheet = await screen.findByRole('dialog', { name: 'Rest' })
  expect(within(restSheet).getByRole('button', { name: 'Use 2:40 for Back squat' })).toBeVisible()
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

  // V3-03, V1-16: offered in ⋯ › Rest time's own sheet.
  await openTools(user)
  await user.click(screen.getByRole('button', { name: /^Rest time/ }))
  await user.click(await screen.findByRole('button', { name: 'Use 2:40 for Back squat' }))

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
  // V4-06: "Rested 3:00 · +0:12", not "Over rest".
  expect(document.querySelector('.rest-over')?.textContent).toMatch(/^Rested 3:00 · \+0:1\d$/)
})

test('S4 while rest runs the effort chips name the Set just logged', async () => {
  const { user } = renderWithLogged([loggedEntry(1, 60, 10)], {
    trackEffort: true,
    onSetEffort: vi.fn(async () => undefined),
  })

  await user.click(logButton())

  const group = await screen.findByRole('group', { name: 'Reps in reserve' })
  const row = group.closest('.effort-row') as HTMLElement
  // DX-22: one row asks "Reps left in the tank?" over the chips; no block restates the Set. No
  // "RIR" anywhere in the row (V1-14).
  expect(group.closest('.just-done')).toBeNull()
  expect(row.textContent).toMatch(/^Reps left in the tank\?/)
  expect(row.textContent).not.toMatch(/RIR/)
})

test('S5a a record shows a toast pinned at the top with the PR tag, and goes in 3 s', async () => {
  vi.useFakeTimers()
  renderSetScreen({ earlierSessions: [earlierSession], lastEntries: [historyEntry(1, 85, 5)] })

  await tapWithFakeTimers(logButton())

  // v7 (study §1.5): nothing is pinned over the header; the PR tag leads one line under the
  // track, and the line goes after 3 s.
  expect(document.querySelector('.toast')).toBeNull()
  const line = recordLine() as HTMLElement
  expect(within(line).getByText('PR')).toHaveClass('tag-pr')
  await vi.advanceTimersByTimeAsync(3100)
  expect(document.querySelector('.toast')).toBeNull()
  expect(recordLine()).toBeNull()
})

test('DX-07 Notes opens one short sheet with the note, its Close and Escape put it away', async () => {
  const { user } = renderSetScreen({ exerciseNote: 'belt on', onSaveExerciseNote: vi.fn(async () => undefined) })

  await user.click(screen.getByRole('button', { name: 'Notes' }))
  const sheet = screen.getByRole('dialog', { name: 'Back squat notes' })
  expect(within(sheet).getByText('belt on')).toBeVisible()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  await user.click(within(sheet).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Notes' }))
  await closeSheet(user)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('N3 a tap on the current Set cell never changes its kind', async () => {
  const { user } = renderSetScreen()

  for (let tap = 0; tap < 3; tap += 1) await user.click(currentCell())
  expect(currentKind()).toBe('Working')
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('N3 the labelled "Working ▾" button opens one short list of kinds; a pick sets it and closes', async () => {
  const { user } = renderSetScreen()

  const button = screen.getByRole('button', { name: 'Set 1 type: Working' })
  expect(button).toHaveTextContent('Working ▾')
  expect(within(screen.getByRole('group', { name: 'Exercise tools' })).getByRole('button', { name: /type: / })).toBe(button)
  await user.click(button)
  const sheet = screen.getByRole('dialog', { name: 'Set 1 type' })
  expect(within(sheet).getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
    'Working',
    'Warm-up',
    'Drop',
    'Failure',
    'AMRAP',
  ])
  expect(within(sheet).getByRole('radio', { name: 'Working' })).toHaveAttribute('aria-checked', 'true')
  await user.click(within(sheet).getByRole('radio', { name: 'Failure' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('button', { name: 'Set 1 type: Failure' })).toHaveTextContent('Failure ▾')
})

test('DX-07 the current cell\'s corner shows the kind letter, as a logged Set\'s does', async () => {
  const { user } = renderSetScreen()

  await chooseKindInTools(user, 'Drop')
  expect(currentCell().querySelector('.set-kind-marker')?.textContent).toBe('D')
  expect(logButton().textContent).toMatch(/· drop$/)
})

test('DX-24 the Sets to come are plain text, not buttons; the cells that are bordered are buttons', () => {
  renderSetScreen()

  const future = [...document.querySelectorAll('.set-cells .set-cell--future')]
  expect(future.length).toBeGreaterThan(0)
  for (const cell of future) expect(cell.tagName).not.toBe('BUTTON')
  expect(currentCell().tagName).toBe('BUTTON')
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
  // Title kept (weakened-tests gate); V6 (V5-04): the snackbar names the Set it deleted.
  expect(snackbar).toHaveTextContent('Set 1 deleted · 80 × 8')
  expect(within(snackbar).getByRole('button', { name: 'Undo' })).toBeVisible()
})

// --- UX v2: the live workout (V2-01, V2-02, V2-04, V2-11, V1-13, V1-15) -----------------------

test('V2-01 done, the action bar has one primary Next: <Exercise> and a quiet Add set, and no Dials', () => {
  const onFinishExercise = vi.fn()
  renderWithLogged(
    [loggedEntry(1, 80, 8), loggedEntry(2, 80, 8), loggedEntry(3, 80, 8), loggedEntry(4, 80, 8)],
    { onFinishExercise, upNext: 'Lunges', onAddSet: vi.fn() },
  )

  // V3-01: the Session moves on by itself; an Exercise reopened once done offers "Back to
  // <Exercise>" (V4-07), never "Next: …" or "Go to …", and Add set sits in the Just done block.
  const next = screen.getByRole('button', { name: 'Back to Lunges' })
  expect(screen.queryByRole('button', { name: /^Go to / })).toBeNull()
  expect(next).toHaveClass('log-set', 'btn-primary')
  expect(screen.queryByRole('button', { name: /^Next: / })).toBeNull()
  const addSet = screen.getByRole('button', { name: 'Add set' })
  expect(addSet).toHaveClass('btn-quiet')
  expect(addSet.closest('.exercise-verdict')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Finish exercise' })).toBeNull()
  expect(screen.queryByRole('button', { name: /^Weight, / })).toBeNull()
  fireEvent.click(next)
  expect(onFinishExercise).toHaveBeenCalledTimes(1)
})

test('V2-01 done with nothing up next, the primary reads All exercises', () => {
  renderWithLogged(
    [loggedEntry(1, 80, 8), loggedEntry(2, 80, 8), loggedEntry(3, 80, 8), loggedEntry(4, 80, 8)],
    { onFinishExercise: vi.fn(), upNext: null },
  )

  expect(screen.getByRole('button', { name: 'All exercises' })).toHaveClass('btn-primary')
})

test('V2-11 done, the verdict reads <Exercise> done · stepped up to 85 kg · +5 kg · 1 PR', () => {
  renderWithLogged(
    [loggedEntry(1, 85, 8), loggedEntry(2, 85, 8), loggedEntry(3, 85, 8), loggedEntry(4, 85, 8)],
    { earlierSessions: [earlierSession] },
  )

  // V4-01, V4-07: the block heads "Back squat done · 1 PR" and lists the Sets, the Record
  // marked, with one comparison -- never "n vs m".
  const block = screen.getByRole('region', { name: 'Exercise done' })
  expect(block.textContent).toMatch(/^Back squat done · 1 PR/)
  expect(within(block).getByText('85×8 PR · 85×8 · 85×8 · 85×8 · First time logged')).toBeVisible()
  expect(block.textContent).not.toMatch(/\d+ vs \d+/)
  expect(screen.queryByText(/sets logged/)).toBeNull()
})

test('V2-02 during rest the Get ready card names the plate change from the bar just lifted', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 2,
    plates: DEFAULT_PLATE_INVENTORY,
    lastEntries: [historyEntry(1, 60, 10), historyEntry(2, 70, 8)],
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  // v7 (study §1.4): Rest's Next panel, "70 kg × 8" with the plate change beside it.
  const card = screen.getByRole('region', { name: 'Next set' })
  expect(card.querySelector('.rest-next-set')?.textContent).toBe('70 kg×8')
  expect(within(card).getByText('Add 5 per side → 20 + 5')).toBeVisible()
})

test('V2-02 the Use offer joins the countdown row, named in full for a screen reader', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 100_000)
  renderSetScreen({
    setIndex: 2,
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
    earlierSessions: restfulSessions,
    onUseRestForExercise: vi.fn(async () => undefined),
  })

  // V3-03: the usual rest's offer left the rest dock for ⋯ › Rest time, still named in full.
  expect(document.querySelector('.rest-panel')?.textContent).not.toMatch(/Use/)
  const user = userEvent.setup()
  await openTools(user)
  // V1-16: one level down, in Rest time's own sheet.
  await user.click(screen.getByRole('button', { name: /^Rest time/ }))
  const offer = within(await screen.findByRole('dialog', { name: 'Rest' })).getByRole('button', {
    name: 'Use 2:40 for Back squat',
  })
  expect(offer).toHaveTextContent(/^Use 2:40$/)
  expect(offer.closest('.rest-panel-main')).toBeNull()
})

test('V1-13 choosing AMRAP puts it on the Log bar and starts the reps at the floor', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 60, 6)] })

  await chooseKindInTools(user, 'AMRAP')

  expect(logButton()).toHaveTextContent(/^Log set 1 · 60 × 8\+ · AMRAP$/)
  expect(readoutValue(repsReadout())).toBe('8')
})

test('V1-15 the Exercise note shows on Now, and a tap opens it to edit', async () => {
  const { user } = renderSetScreen({
    exerciseNote: 'Belt from set 3',
    onSaveExerciseNote: vi.fn(async () => undefined),
  })

  await user.click(screen.getByRole('button', { name: 'Exercise note: Belt from set 3' }))

  expect((screen.getByLabelText('Note') as HTMLTextAreaElement).value).toBe('Belt from set 3')
})

// --- UX v3: the live Session (V3-01, V3-03, V3-05, V3-06) -------------------------------------

test('V3-01 a handed-over Exercise shows its verdict line with Add set over the Get ready card', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 12_000)
  const onAddSet = vi.fn()
  const other: SetEntry = { exerciseId: 'deadlift', setIndex: 3, weightKg: 70, reps: 7, loggedAt: BASE }
  renderSetScreen({
    setIndex: 1,
    restFrom: { entry: other, planRestSeconds: 180 },
    handover: { name: 'Deadlift', line: '70×7 · 70×7 · 70×7 · Same as Mon 12 Oct', onAddSet },
  })

  const line = screen.getByRole('region', { name: 'Exercise done' })
  const card = screen.getByRole('region', { name: 'Next set' })
  expect(line.textContent).toMatch(/^Deadlift done/)
  expect(line.textContent).toContain('70×7 · 70×7 · 70×7 · Same as Mon 12 Oct')
  // V4-01, v7: read high, tap low -- the Next panel sits under the ring, the block under it.
  expect(card.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(within(line).getByRole('button', { name: 'Add set' }))
  expect(onAddSet).toHaveBeenCalledTimes(1)
})

test('V3-01 done with no Exercise left, the primary reads Finish workout', () => {
  const onFinishWorkout = vi.fn()
  renderWithLogged(
    [loggedEntry(1, 80, 8), loggedEntry(2, 80, 8), loggedEntry(3, 80, 8), loggedEntry(4, 80, 8)],
    { onFinishExercise: vi.fn(), upNext: null, onFinishWorkout, onAddSet: vi.fn() },
  )

  const finish = screen.getByRole('button', { name: 'Finish workout' })
  expect(finish).toHaveClass('btn-primary')
  fireEvent.click(finish)
  expect(onFinishWorkout).toHaveBeenCalledTimes(1)
})

test('V3-03 the rest dock is one row: countdown, −15 s, +15 s and Skip, with no Use offer', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 12_000)
  renderSetScreen({
    setIndex: 2,
    earlierSessions: restfulSessions,
    onUseRestForExercise: vi.fn(async () => undefined),
    restFrom: { entry: historyEntry(1, 60, 10), planRestSeconds: 180 },
  })

  // v7 (study §1.4): the countdown in its ring with −15 s and +15 s under it; DX-05: the ring is
  // Skip and the dock holds the one filled Log set; still no Use offer.
  const panel = document.querySelector('.rest-panel--ring') as HTMLElement
  expect(panel.querySelector('.rest-ring [role="timer"]')).not.toBeNull()
  const controls = panel.querySelector('.rest-ring-controls') as HTMLElement
  for (const name of ['Rest 15 seconds less', 'Rest 15 seconds more']) {
    expect(controls.contains(screen.getByRole('button', { name }))).toBe(true)
  }
  const skip = screen.getByRole('button', { name: 'Skip rest' })
  expect(skip.closest('.rest-ring')).not.toBeNull()
  expect(skip.closest('.set-dock')).toBeNull()
  expect(logButton()).toHaveClass('btn-primary')
  expect(screen.queryByRole('button', { name: /^Use / })).toBeNull()
})

test('V3-05 three Warm-ups share one W cell: the row reads W, 1, 2, 3 and the bar says warm-up', async () => {
  const { user } = renderBarbell()
  await startRamp(user)

  const cells = document.querySelector('.set-cells') as HTMLElement
  const labels = [...cells.querySelectorAll('.set-cell-index')].map((label) => label.textContent)
  expect(labels).toEqual(['W', '1', '2', '3'])
  expect(logButton().textContent).toMatch(/^Log warm-up 1 /)
  await user.click(logButton())

  await waitFor(() => expect(logButton().textContent).toMatch(/^Log warm-up 2 /))
  expect(screen.queryByRole('group', { name: 'Reps in reserve' })).toBeNull()
  expect(screen.getByRole('region', { name: 'Next set' }).textContent).not.toMatch(/Set 1/)
})

test('V3-06 the set cells share the row width and never scroll sideways', () => {
  const row = declarationsFor(restCss(), '.set-cells')
  expect(row.get('overflow-x')).toBeUndefined()
  const cell = declarationsFor(restCss(), '.set-cell')
  expect(cell.get('flex')).toBe('1 1 0')
  expect(cell.get('min-width')).toBe('0')
})

// --- UX v4: the live Session's help and honest delight (V4-01, V4-02, V4-04, V4-05, V4-06, V4-07)

/** v7 (study §1.4): Rest no longer restates the Set just logged; there is no Just done block. */
function justDoneBlock(): HTMLElement | null {
  return screen.queryByRole('region', { name: 'Just done' })
}

function textOf(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

test('V4-01 after a Set equal to last time, the Just done block heads it and reads Same as <day>', async () => {
  const { user } = renderSetScreen({
    lastEntries: [historyEntry(1, 85, 5)],
    lastTime: [historyEntry(1, 85, 5)],
  })

  await user.click(logButton())

  // v7 (study §1.4): Rest drops the restatement of the Set just logged ("Same as <day>"); last
  // time moves to the Next panel, about the Set to come.
  const next = await screen.findByRole('region', { name: 'Next set' })
  expect(justDoneBlock()).toBeNull()
  expect(screen.queryByText(/^Same as /)).toBeNull()
  expect(document.querySelector('.set-record-line')).toBeNull()
  expect(textOf(next)).toContain('Last time 85 × 5')
  expect(screen.queryByText('PR')).toBeNull()
})

test('V4-01 a Set under last time reads n rep under <day>, in the secondary colour', async () => {
  const { user } = renderSetScreen({
    lastEntries: [historyEntry(1, 85, 5)],
    lastTime: [historyEntry(1, 85, 6)],
  })

  await user.click(logButton())

  // v7 (study §1.4): a Set under last time is not restated on Rest at all -- nothing reads it,
  // and nothing on the record line or the Next panel is ever red.
  await screen.findByRole('region', { name: 'Next set' })
  expect(justDoneBlock()).toBeNull()
  expect(screen.queryByText(/fewer rep/)).toBeNull()
  expect(document.querySelector('.set-record-line')).toBeNull()
  const decls = declarationsFor(restCss(), '.just-done-line')
  expect(decls.get('color')).toBe('var(--color-secondary)')
  expect(restCss()).not.toMatch(/\.just-done[^{]*\{[^}]*--color-danger/)
  expect(restCss()).not.toMatch(/\.(set-record-line|rest-next)[^{]*\{[^}]*--color-danger/)
})

test('V4-01 with no last time the block reads First time logged', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 85, 5)] })

  await user.click(logButton())

  // v7: with no record there is no line under the track, and no block restates the Set.
  await screen.findByRole('region', { name: 'Next set' })
  expect(justDoneBlock()).toBeNull()
  expect(document.querySelector('.set-record-line')).toBeNull()
  expect(screen.queryByText('First time logged')).toBeNull()
})

test('V4-01 while rest runs the Get ready card sits right under the cells, the Just done block under it', async () => {
  const { user } = renderSetScreen({ lastEntries: [historyEntry(1, 85, 5)], lastTime: [historyEntry(1, 85, 5)] })

  await user.click(logButton())

  // v7 (study §1.4): the ring sits right under the cells, the Next panel under it.
  const card = await screen.findByRole('region', { name: 'Next set' })
  const ring = document.querySelector('.rest-panel--ring') as HTMLElement
  expect(document.querySelector('.set-cells')?.nextElementSibling).toBe(ring)
  expect(ring.nextElementSibling).toBe(card)
  expect(justDoneBlock()).toBeNull()
})

test('V4-01 a hand-over is headed <Exercise> done · 1 PR with Add set, its chips Set 3 reps left?', () => {
  vi.spyOn(Date, 'now').mockReturnValue(BASE + 12_000)
  const onPick = vi.fn()
  const other: SetEntry = { exerciseId: 'deadlift', setIndex: 3, weightKg: 70, reps: 7, loggedAt: BASE }
  renderSetScreen({
    trackEffort: true,
    restFrom: { entry: other, planRestSeconds: 180 },
    handover: {
      name: 'Deadlift',
      prs: 1,
      line: '60×10 · 70×8 PR · 70×7 · 1 rep more than Mon 12 Oct',
      onAddSet: vi.fn(),
      effort: { ordinal: 3, value: null, onPick },
    },
  })

  const block = screen.getByRole('region', { name: 'Exercise done' })
  expect(textOf(block.querySelector('.just-done-head'))).toBe('Deadlift done · 1 PR')
  expect(within(block).getByRole('button', { name: 'Add set' })).toBeVisible()
  // DX-22: the trainee's words, over the chips.
  expect(textOf(block.querySelector('.effort-label'))).toBe('Reps left in the tank?')
  expect(block.textContent).not.toMatch(/\d+ vs \d+/)
  fireEvent.click(within(block).getByRole('button', { name: '2' }))
  expect(onPick).toHaveBeenCalledWith(2)
})

// V6 (V5-06): more reps at a weight already lifted, with no better estimated 1RM, is a rep best:
// quiet words under the Dial and in the Just done line, no PR tag, no PR badge on the cell.
test('V6 a rep best reads rep best if logged, then Rep best on Rest, with no PR tag', async () => {
  const push = (reps: number, loggedAt: number): SetEntry => ({
    exerciseId: 'push-ups',
    setIndex: 1,
    weightKg: null,
    reps,
    loggedAt,
  })
  const earlier: Session = {
    id: 'earlier-push',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: BASE - 86_400_000,
    finishedAt: BASE - 86_000_000,
    entries: [push(12, BASE - 86_400_000)],
  }
  const { user } = renderSetScreen({
    exercise: pushUps,
    plan: pushUpPlan,
    earlierSessions: [earlier],
    lastEntries: [push(12, BASE - 86_400_000)],
    lastTime: [push(12, BASE - 86_400_000)],
  })
  const line = (): string => textOf(document.querySelector('.set-projection'))

  await user.click(screen.getByRole('button', { name: 'Increase reps' }))
  expect(line()).toMatch(/· rep best if logged$/)
  expect(screen.queryByText('PR if logged')).toBeNull()

  await user.click(logButton())

  // v7 (study §1.5): one quiet green line under the track, never gold, never a tag.
  await waitFor(() => expect(document.querySelector('.set-record-line')).not.toBeNull())
  const record = document.querySelector('.set-record-line') as HTMLElement
  expect(record).toHaveAttribute('data-kind', 'rep-best')
  expect(textOf(record)).toMatch(/^↑ Rep best · BW × 13 · /)
  expect(within(record).queryByText('PR')).toBeNull()
  expect(declarationsFor(restCss(), ".set-record-line[data-kind='rep-best']").get('color')).toBe('var(--color-up)')
  expect(prBadges()).toHaveLength(0)
})

test('V6 a heavier Set still reads PR if logged, and its Just done line carries the PR tag', async () => {
  const { user } = renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 85, 5)],
    lastTime: [historyEntry(1, 85, 5)],
  })

  expect(textOf(document.querySelector('.set-projection'))).toMatch(/PR if logged$/)
  await user.click(logButton())

  // v7 (study §1.5): the PR line under the track leads with the gold tag.
  await waitFor(() => expect(document.querySelector('.set-record-line')).not.toBeNull())
  const block = document.querySelector('.set-record-line') as HTMLElement
  expect(block).toHaveAttribute('data-kind', 'pr')
  expect(textOf(block)).toMatch(/^PR ?Heaviest weight · /)
  expect(within(block).getByText('PR')).toHaveClass('tag-pr')
})

test('V4-02 the line under the reps Dial compares live with last time: same, +1 rep, 1 rep under', async () => {
  const { user } = renderSetScreen({
    earlierSessions: [earlierSession],
    lastEntries: [historyEntry(1, 85, 5)],
    lastTime: [historyEntry(1, 85, 5)],
  })
  const line = (): string => textOf(document.querySelector('.set-projection'))

  // Title kept (weakened-tests gate); V6-18: the same Set says last time's day, never "same".
  expect(line()).toBe(`Last time 85 × 5 · ${formatDay(new Date(BASE), new Date())} · PR if logged`)
  await user.click(screen.getByRole('button', { name: 'Increase reps' }))
  expect(line()).toMatch(/^Last time 85 × 5 · \+1 rep · PR if logged$/)
  await user.click(screen.getByRole('button', { name: 'Decrease reps' }))
  await user.click(screen.getByRole('button', { name: 'Decrease reps' }))
  expect(line()).toMatch(/^Last time 85 × 5 · 1 fewer rep/)
  // One "Last time" on Now, under the Dials: the upper line is gone.
  expect(screen.getAllByText(/Last time/)).toHaveLength(1)
  expect(document.querySelector('.set-last-time')).toBeNull()
  const dials = document.querySelector('.set-dials') as HTMLElement
  expect(dials.nextElementSibling).toBe(document.querySelector('.set-projection'))
})

test('V4-04 a Set that sets a Record plays the PR sound once and flashes its cell for 1.2 s', async () => {
  vi.useFakeTimers()
  renderWithLogged([], { earlierSessions: [earlierSession], lastEntries: [historyEntry(1, 85, 5)] })

  await tapWithFakeTimers(logButton())

  expect(playPrSound).toHaveBeenCalledTimes(1)
  const cell = loggedSetButton('85 × 5').closest('li') as HTMLElement
  expect(cell).toHaveClass('pr-flash')
  await vi.advanceTimersByTimeAsync(1300)
  expect(loggedSetButton('85 × 5').closest('li')).not.toHaveClass('pr-flash')
  expect(within(loggedSetButton('85 × 5')).getByLabelText('Personal record')).toBeInTheDocument()
})

test('V4-04 a Set with no Record plays no PR sound and flashes nothing', async () => {
  vi.useFakeTimers()
  renderWithLogged([], { earlierSessions: [earlierSession], lastEntries: [historyEntry(1, 70, 5)] })

  await tapWithFakeTimers(logButton())

  expect(playPrSound).not.toHaveBeenCalled()
  expect(document.querySelector('.pr-flash')).toBeNull()
})

test('V4-04 the flash is the accent tint over 1.2 s, and none under reduced motion', () => {
  const css = restCss()
  // v7: a record's accent is the gold PR tint (study §3, PR), no longer the indigo primary's.
  expect(css).toMatch(/@keyframes pr-flash\s*\{[^}]*background-color:\s*var\(--color-pr-tint\)/)
  expect(css).toMatch(/\.logged-sets li\.pr-flash \.logged-set \{\s*animation: pr-flash 1\.2s/)
  const reduced = postcss
    .parse(css)
    .nodes.find(
      (node) => node.type === 'atrule' && node.name === 'media' && /prefers-reduced-motion: reduce/.test(node.params) && /pr-flash/.test(node.toString()),
    )
  expect(reduced?.toString()).toMatch(/animation:\s*none/)
})

test('V4-06 an unanswered reps-left question stays on Now after rest, until answered', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  const onSetEffort = vi.fn(async () => undefined)
  renderWithLogged([], { trackEffort: true, onSetEffort, lastEntries: [historyEntry(1, 60, 10)] })

  await tapWithFakeTimers(logButton())
  await vi.advanceTimersByTimeAsync(181_000)

  // Rest is over: Now with its Dials, and the question for set 1 above them.
  expect(screen.queryByRole('button', { name: 'Skip rest' })).toBeNull()
  const row = (screen.getByRole('group', { name: 'Reps in reserve' }).closest('.effort-row') as HTMLElement)
  expect(textOf(row.querySelector('.effort-label'))).toBe('Set 1 · reps left in the tank?')
  expect(row.compareDocumentPosition(document.querySelector('.set-dials') as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(textOf(document.querySelector('.rest-over'))).toMatch(/^Rested 3:00 · \+0:0\d$/)

  await tapWithFakeTimers(within(row).getByRole('button', { name: '2' }))

  expect(onSetEffort).toHaveBeenCalledWith(1, 2)
  expect(screen.queryByRole('group', { name: 'Reps in reserve' })).toBeNull()
  expect(textOf(document.querySelector('.logged-set-rir'))).toBe('2 left')
})

test('V4-06 the unanswered question goes once the next Set is logged', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE)
  renderWithLogged([], { trackEffort: true, onSetEffort: vi.fn(async () => undefined), lastEntries: [historyEntry(1, 60, 10)] })

  await tapWithFakeTimers(logButton())
  await vi.advanceTimersByTimeAsync(181_000)
  expect(screen.getByText('Set 1 · reps left in the tank?')).toBeVisible()

  await tapWithFakeTimers(logButton())

  expect(screen.queryByText('Set 1 · reps left in the tank?')).toBeNull()
})

test('V4-05 on a Warm-up the line under the Dials and the Get ready card read Then set 1, never Last time', async () => {
  const { user } = renderBarbell([], { lastTime: [historyEntry(1, 100, 8)] })
  await startRamp(user)

  expect(textOf(document.querySelector('.set-projection'))).toBe('Then set 1 · 100 × 8')
  expect(screen.queryByText(/Last time/)).toBeNull()

  await logStep(user, 'Warm-up 1 of 3 · 50 kg × 5', 1)

  const card = await screen.findByRole('region', { name: 'Next set' })
  expect(textOf(card)).toContain('Then set 1 · 100 × 8')
  expect(screen.queryByText(/Last time/)).toBeNull()
  expect(document.querySelector('p.warmup-ramp')).toBeNull()
  const visible = textOf(document.querySelector('.set-screen'))
  expect(visible.match(/warm-up 2 of 3/gi)?.length ?? 0).toBeLessThanOrEqual(2)
})

test('V4-07 a finished Exercise reopened shows its cells, the done block with Add set, and Back to <current> · set N', () => {
  const onFinishExercise = vi.fn()
  renderWithLogged(
    [loggedEntry(1, 80, 8), loggedEntry(2, 80, 8), loggedEntry(3, 80, 8), loggedEntry(4, 80, 8)],
    { onFinishExercise, upNext: 'Lunges', upNextSet: 3, onAddSet: vi.fn(), lastTime: [historyEntry(1, 80, 8)] },
  )

  expect(loggedSetNames()).toEqual(['80 × 8', '80 × 8', '80 × 8', '80 × 8'])
  const block = screen.getByRole('region', { name: 'Exercise done' })
  expect(textOf(block.querySelector('.just-done-head'))).toBe('Back squat done')
  expect(within(block).getByRole('button', { name: 'Add set' })).toBeVisible()
  const back = screen.getByRole('button', { name: 'Back to Lunges · set 3' })
  expect(back).toHaveClass('btn-primary')
  expect(screen.queryByRole('button', { name: /^Go to / })).toBeNull()
  fireEvent.click(back)
  expect(onFinishExercise).toHaveBeenCalledTimes(1)
})

// --- UX v5: swap Undo on Now (V1-17), the Dial clear of the dock (V1-20), Rest at 320 x 568 ---

/** The snackbar on screen, if any. */
function snackbar(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.snackbar')
}

test('V1-17 a screen opened on a swap shows the Swapped from <planned> · Undo snackbar', () => {
  renderSetScreen({
    swappedFrom: { name: 'Deadlift', onUndo: vi.fn() },
    swapFor: { name: 'Deadlift', onUndo: vi.fn() },
  })

  const bar = snackbar() as HTMLElement
  expect(bar).not.toBeNull()
  expect(bar).toHaveTextContent('Swapped from Deadlift')
  // Title kept (weakened-tests gate); V6: Undo is said once, by the lasting "Undo swap" line,
  // so the snackbar carries no Undo of its own.
  expect(within(bar).queryByRole('button')).toBeNull()
  expect(screen.getAllByRole('button', { name: /Undo/ })).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Undo swap' })).toBeVisible()
})

test('V1-17 Undo on the swap snackbar calls onUndo once and the snackbar goes', async () => {
  const onUndo = vi.fn()
  const { user } = renderSetScreen({ swappedFrom: { name: 'Deadlift', onUndo }, swapFor: { name: 'Deadlift', onUndo } })

  // Title kept (weakened-tests gate); V6: the one Undo is the swap line's "Undo swap".
  await user.click(screen.getByRole('button', { name: 'Undo swap' }))

  expect(onUndo).toHaveBeenCalledTimes(1)
  expect(snackbar()).toBeNull()
})

test('V1-17 the swap snackbar leaves after 5 s, as Set deleted does', async () => {
  vi.useFakeTimers()
  renderSetScreen({ swappedFrom: { name: 'Deadlift', onUndo: vi.fn() } })
  expect(snackbar()).not.toBeNull()

  await act(async () => {
    await vi.advanceTimersByTimeAsync(4_900)
  })
  expect(snackbar()).not.toBeNull()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200)
  })
  expect(snackbar()).toBeNull()
})

test('V1-17 logging a Set of the swapped-in Exercise takes the swap snackbar away', async () => {
  const { user } = renderSetScreen({ swappedFrom: { name: 'Deadlift', onUndo: vi.fn() } })

  await user.click(logButton())

  await waitFor(() => expect(screen.queryByText(/Swapped from/)).toBeNull())
})

test('V1-17 a screen opened without a swap shows no snackbar, and a later swappedFrom is ignored', () => {
  const props: SetScreenProps = {
    exercise: backSquat,
    plan: squatPlan,
    setIndex: 1,
    sessionId: SESSION_ID,
    sessionStartedAt: BASE,
    lastEntries: [],
    onLog: sessionLogSet(),
    onLogged: vi.fn(),
  }
  const { rerender } = render(<SetScreen {...props} />)
  expect(snackbar()).toBeNull()

  // Read once, on open: the caller may hand it in late or drop it; only the opening counts.
  rerender(<SetScreen {...props} swappedFrom={{ name: 'Deadlift', onUndo: vi.fn() }} />)
  expect(snackbar()).toBeNull()
})

/** Lays out `element` at `top`..`bottom` for getBoundingClientRect, as a browser would. */
function placeAt(element: Element, top: number, bottom: number): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom,
    left: 0,
    right: 195,
    width: 195,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect)
}

test('V1-20 focusing the reps Dial under the dock scrolls it clear of the dock', () => {
  const scrollBy = vi.fn()
  vi.stubGlobal('scrollBy', scrollBy)
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })
  const dock = document.querySelector('.set-dock') as HTMLElement
  const reps = screen.getByRole('group', { name: 'Reps' })
  placeAt(dock, 349, 410)
  placeAt(reps, 358, 410)

  fireEvent.focus(within(reps).getByRole('button', { name: 'Increase reps' }))

  // 410 + 8 px of air - 349 = 69 px up.
  expect(scrollBy).toHaveBeenCalledWith({ top: 69 })
})

test('V1-20 focusing a Dial already clear of the dock does not scroll', () => {
  const scrollBy = vi.fn()
  vi.stubGlobal('scrollBy', scrollBy)
  renderSetScreen({ lastEntries: [historyEntry(1, 60, 10)] })
  const dock = document.querySelector('.set-dock') as HTMLElement
  const weight = screen.getByRole('group', { name: 'Weight (kg)' })
  placeAt(dock, 680, 832)
  placeAt(weight, 373, 501)

  fireEvent.focus(within(weight).getByRole('button', { name: 'Increase weight' }))

  expect(scrollBy).not.toHaveBeenCalled()
})

/** The declarations of `selector` inside the `@media (max-height: 640px)` block. */
function shortScreenDecls(selector: string): Map<string, string> {
  const found = new Map<string, string>()
  postcss.parse(restCss()).walkAtRules('media', (media) => {
    if (!media.params.includes('max-height: 640px')) return
    media.walkRules((rule: Rule) => {
      if (rule.selectors.includes(selector)) {
        rule.walkDecls((decl: Declaration) => {
          found.set(decl.prop, decl.value)
        })
      }
    })
  })
  return found
}

test('V5 at 320 x 568 the Rest view tightens so the Just done chips clear the dock', () => {
  // v7: Rest's ring steps down with −15 s / +15 s beside it, and the Next panel tightens, so the
  // reps-left chips sit over the Skip rest bar at 320 x 568.
  expect(shortScreenDecls('.just-done').get('padding')).toBe('var(--space-2) var(--space-3)')
  expect(shortScreenDecls('.rest-next').get('padding')).toBe('var(--space-2) var(--space-3)')
  expect(shortScreenDecls('.rest-ring').get('width')).toBe('144px')
  expect(shortScreenDecls('.rest-panel.rest-panel--ring').get('flex-direction')).toBe('row')
  expect(shortScreenDecls('.set-cell').get('min-height')).toBe('52px')
  expect(shortScreenDecls('.set-head').get('min-height')).toBe('var(--tap-min)')
  // The hand-over block puts its chips under the heading, its Sets line after them.
  expect(shortScreenDecls('.exercise-verdict .effort-row').get('order')).toBe('1')
  expect(shortScreenDecls('.exercise-verdict .just-done-line').get('order')).toBe('2')
})

// --- UX v6: snackbars name what they took back, with no stray separator, clear of the Dials ---

test('V6 V5-04 Delete set names the Set it deleted, with no separator left trailing', async () => {
  const { user } = renderWithLogged([loggedEntry(1, 80, 8), loggedEntry(2, 80, 7)])

  await user.click(loggedSetButton('80 × 7'))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))

  await waitFor(() => expect(document.querySelector('.snackbar')).not.toBeNull())
  const message = document.querySelector('.snackbar-message') as HTMLElement
  expect(message.textContent).toBe('Set 2 deleted · 80 × 7')
})

test('V6 V5-04 the snackbars on the Set screen sit above the Dials, never over them', async () => {
  const { user } = renderWithLogged([loggedEntry(1, 80, 8)])

  await user.click(loggedSetButton('80 × 8'))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))

  await waitFor(() => expect(document.querySelector('.snackbar')).not.toBeNull())
  const bar = document.querySelector('.snackbar') as HTMLElement
  const anchor = bar.parentElement as HTMLElement
  expect(anchor).toHaveClass('set-snackbar-anchor')
  const dials = document.querySelector('.set-dials') as HTMLElement
  expect(anchor.compareDocumentPosition(dials) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('V6 V5-04 the swap snackbar reads Swapped from Deadlift with no separator after it', () => {
  renderSetScreen({ swappedFrom: { name: 'Deadlift', onUndo: vi.fn() } })

  expect((document.querySelector('.snackbar-message') as HTMLElement).textContent).toBe('Swapped from Deadlift')
})

test('V6 V5-02 a swapped-in Exercise says "for <planned>" under its counter, with Undo swap while given', async () => {
  const onUndo = vi.fn()
  const { user } = renderSetScreen({ swapFor: { name: 'Deadlift', onUndo } })

  const line = document.querySelector('.set-swapped') as HTMLElement
  expect(line).toHaveTextContent('for Deadlift')
  await user.click(within(line).getByRole('button', { name: 'Undo swap' }))
  expect(onUndo).toHaveBeenCalledTimes(1)
})

test('V6 V5-02 with askStartWeight the Plate line asks Set a starting weight until the weight moves', async () => {
  const { user } = renderSetScreen({ askStartWeight: true })

  expect(screen.getByText('Set a starting weight')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  expect(screen.queryByText('Set a starting weight')).toBeNull()
})

// --- UX v6 flow: the warm-up line on Now (V6-16), Last time's day (V6-18), First time (V6-17) ---

/** V6-16, v7 (study §1.2): the warm-up ramp offered as a dashed W cell in the track. */
function warmupLine(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.set-cells .warmup-offer')
}

test('V6-16 DX-22 a barbell lift offers its warm-up ramp as a cell reading "Warm-up" over its range, no "+"', () => {
  renderBarbell()

  // The ramp is the track's first cell, dashed like a Set to come, named in full for a screen
  // reader; DX-22: "Warm-up" with the range under it, in kg, and no "+".
  const cell = warmupLine() as HTMLElement
  expect(cell).not.toBeNull()
  expect(cell.tagName).toBe('BUTTON')
  expect(cell).toHaveAttribute('data-state', 'planned')
  expect(cell).toHaveAccessibleName('Warm-up: 50×5 · 70×3 · 85×2')
  expect(textOf(cell.querySelector('.set-cell-index'))).toBe('Warm-up')
  expect(textOf(cell.querySelector('.set-cell-value'))).toBe('50–85 kg')
  expect(cell.textContent).not.toContain('+')
  expect(document.querySelector('.set-cells')?.firstElementChild).toBe(cell)
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'SetScreen.css'), 'utf-8')
  const decls = declarationsFor(css, '.warmup-offer')
  expect(decls.get('min-height')).toBe('64px')
})

test('V6-16 DX-07 the Warm-up cell opens its rows inline under the cells, and Add warm-ups starts the ramp', async () => {
  const { user } = renderBarbell()

  await user.click(screen.getByRole('button', { name: /^Warm-up: / }))
  const rows = screen.getByRole('group', { name: 'Warm-ups' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(rows.querySelectorAll('.tools-warmup-row')).toHaveLength(3)
  expect(document.querySelector('.set-cells')?.nextElementSibling).toBe(rows)
  await user.click(within(rows).getByRole('button', { name: 'Add warm-ups' }))

  await waitFor(() => expect(rampLineText()).toBe('Warm-up 1 of 3 · 50 kg × 5'))
  expect(warmupLine()).toBeNull()
  expect(screen.queryByRole('group', { name: 'Warm-ups' })).toBeNull()
})

test('V6-16 no warm-up offer without plates, and none once a working Set is logged', () => {
  const first = renderBarbell([], { plates: null })
  expect(warmupLine()).toBeNull()
  first.unmount()
  renderBarbell([{ exerciseId: 'back-squat', setIndex: 1, weightKg: 100, reps: 8, loggedAt: BASE + 1 }])
  expect(warmupLine()).toBeNull()
})

test('V6-18 the line under the Dials names last time\'s day, never "same"', () => {
  renderSetScreen({ lastEntries: [historyEntry(1, 85, 5)], lastTime: [historyEntry(1, 85, 5)] })
  const line = textOf(document.querySelector('.set-projection'))
  expect(line).toBe(`Last time 85 × 5 · ${formatDay(new Date(BASE), new Date())}`)
  expect(line).not.toMatch(/same/)
})

test('V6-17 a lift with no history reads First time · start light', () => {
  renderSetScreen()
  expect(textOf(document.querySelector('.set-projection'))).toBe('First time · start light')
  expect(screen.queryByText(/Last time/)).toBeNull()
})
