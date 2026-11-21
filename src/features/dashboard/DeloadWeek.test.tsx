import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { weekStart } from '../../domain/stats/weeks'
import { createServices, type Services } from '../../services'
import { db } from '../../storage/db'
import { setActiveProgramId } from '../../storage/settingsStore'
import type { Session, SetEntry } from '../../types'
import { ProgramFeature } from '../program/ProgramFeature'
import { ServicesProvider } from '../ServicesProvider'
import { DashboardScreen } from './DashboardScreen'

const SETTLE = { timeout: 3000 }
const TUE = new Date(2026, 9, 13, 17, 58).getTime()
const FRI = new Date(2026, 9, 23, 17, 58).getTime()
const SAT = new Date(2026, 9, 24, 9, 0).getTime()
const day = (month: number, d: number): number => new Date(2026, month, d, 18).getTime()

function servicesAt(now: number): Services {
  return createServices({ now: () => now, storageAvailable: true })
}

function mount(s: Services, now: number) {
  const onStartWorkout = vi.fn()
  render(
    <ServicesProvider services={s}>
      <DashboardScreen now={() => now} onStartWorkout={onStartWorkout} />
    </ServicesProvider>,
  )
  return { onStartWorkout }
}

/** Train and the Program tab over one set of services: the Deload week is set on Program (V1-22),
 * from its "Deload week" row since DX-04. */
function mountBoth(s: Services, now: number): void {
  render(
    <ServicesProvider services={s}>
      <ProgramFeature now={() => now} navigate={() => {}} onInSession={() => {}} />
      <DashboardScreen now={() => now} onStartWorkout={() => {}} />
    </ServicesProvider>,
  )
}

// v7: the workout page says it in its headline sentence.
const TRAIN_LINE = 'Deload week: every load is 10 % lighter.'

/** A Train row's `sets × kg`, as its text reads (`4×60 kg`). */
const presetOf = (row: HTMLElement): string | null | undefined => row.querySelector('.dashboard-step-preset')?.textContent
/** DX-04: opens the Program tab's "Deload week" row and taps "Start a deload week". */
async function startDeloadFromProgram(): Promise<void> {
  await openDeloadPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Start a deload week' }, SETTLE))
}

/** DX-04: the Program tab's "Deload week" row opens its page. */
async function openDeloadPage(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /^Deload week/ }, SETTLE))
}

/** While a deload is on, the Program's meta line ends "· Deload week" (DX-04); null while off. */
function programLine(): HTMLElement | null {
  return screen.queryByText(/ · Deload week$/)
}

const squat = (rir: SetEntry['rir']): SetEntry[] =>
  [0, 1].map((setIndex) => ({
    exerciseId: 'back-squat',
    setIndex,
    weightKg: 60,
    reps: 10,
    loggedAt: day(9, 9),
    rir,
  }))

async function seedSquat(rir: SetEntry['rir']): Promise<void> {
  const session: Session = {
    id: 'fri',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: day(9, 9),
    finishedAt: day(9, 9) + 3_000_000,
    entries: squat(rir),
    updatedAt: day(9, 9) + 3_000_000,
  }
  const other: Session = {
    ...session,
    id: 'mon',
    workoutId: 'workout-b',
    startedAt: day(9, 12),
    finishedAt: day(9, 12) + 3_000_000,
    entries: [
      { exerciseId: 'deadlift', setIndex: 0, weightKg: 100, reps: 8, loggedAt: day(9, 12) },
      // V6-11: 12 more working Sets of an unplanned Exercise make Monday's B a full Session, so
      // Workout A is due next as before.
      ...Array.from({ length: 12 }, (_, index) => ({
        exerciseId: 'not-planned',
        setIndex: 100 + index,
        weightKg: 10,
        reps: 10,
        loggedAt: day(9, 12) + index,
      })),
    ],
  }
  // V6-01: Train's hint is the lift's status, which needs 4 Sessions: three earlier ones at 60 kg.
  const earlier = [[8, 25], [8, 30], [9, 5]].map(([month, d], at): Session => ({
    ...session,
    id: `earlier-${at}`,
    startedAt: day(month, d),
    finishedAt: day(month, d) + 3_000_000,
    updatedAt: day(month, d) + 3_000_000,
    entries: squat(undefined).map((entry) => ({ ...entry, loggedAt: day(month, d) })),
  }))
  await db.sessions.bulkPut([...earlier, session, other])
  await setActiveProgramId('assaf-ab-2026', TUE)
}

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

describe('Train Deload week switch (E21-T7; on the Program tab since V1-22)', () => {
  test('O15 the switch shows off when deloadWeek is unset, and turning it on stores this week through the week start', async () => {
    await db.settings.put({ key: 'weekStart', value: 6, updatedAt: FRI })
    await setActiveProgramId('assaf-ab-2026', FRI)
    mountBoth(servicesAt(FRI), FRI)
    // V4-08: "off" is no deload line on Program and none on Train; the overflow offers to start one.
    await screen.findByRole('button', { name: /^Start Workout / }, SETTLE)
    expect(programLine()).toBeNull()
    expect(screen.queryByText(TRAIN_LINE)).toBeNull()

    await startDeloadFromProgram()
    await waitFor(() => expect(screen.getByText(TRAIN_LINE)).toBeTruthy(), SETTLE)
    expect((await db.settings.get('deloadWeek'))?.value).toBe(weekStart(FRI, 6))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(programLine()).not.toBeNull(), SETTLE)
    expect(screen.getByRole('button', { name: /^Deload week/ })).toHaveTextContent('On this week')
  })

  test('O15 with weekStart 6, a switch turned on on Fri 23 Oct still reads on that Friday', async () => {
    await db.settings.put({ key: 'weekStart', value: 6, updatedAt: FRI })
    await db.settings.put({ key: 'deloadWeek', value: weekStart(FRI, 6), updatedAt: FRI })
    await setActiveProgramId('assaf-ab-2026', FRI)
    mountBoth(servicesAt(FRI), FRI)
    await waitFor(() => expect(programLine()).not.toBeNull(), SETTLE)
    await openDeloadPage()
    expect(await screen.findByRole('button', { name: 'End deload week' }, SETTLE)).toBeTruthy()
  })

  test('O15 with weekStart 6, the switch turned on on Fri 23 Oct reads off on Sat 24 Oct', async () => {
    await db.settings.put({ key: 'weekStart', value: 6, updatedAt: FRI })
    await db.settings.put({ key: 'deloadWeek', value: weekStart(FRI, 6), updatedAt: FRI })
    await setActiveProgramId('assaf-ab-2026', SAT)
    mountBoth(servicesAt(SAT), SAT)
    await screen.findByRole('button', { name: /^Start Workout / }, SETTLE)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(programLine()).toBeNull()
    expect(screen.queryByRole('button', { name: 'End deload week' })).toBeNull()
    expect(screen.queryByText(TRAIN_LINE)).toBeNull()
    await openDeloadPage()
    expect(await screen.findByRole('button', { name: 'Start a deload week' }, SETTLE)).toBeTruthy()
  })

  test('O15 turning it off stores null', async () => {
    await db.settings.put({ key: 'deloadWeek', value: weekStart(TUE, 1), updatedAt: TUE })
    await setActiveProgramId('assaf-ab-2026', TUE)
    mountBoth(servicesAt(TUE), TUE)
    await openDeloadPage()
    fireEvent.click(await screen.findByRole('button', { name: 'End deload week' }, SETTLE))
    await waitFor(() => expect(screen.queryByText(TRAIN_LINE)).toBeNull(), SETTLE)
    expect(await db.settings.get('deloadWeek')).toBeUndefined()
    await waitFor(() => expect(programLine()).toBeNull(), SETTLE)
  })

  test('V1-22 Train draws no Deload week switch; the Program tab does', async () => {
    await setActiveProgramId('assaf-ab-2026', TUE)
    mount(servicesAt(TUE), TUE)
    await screen.findByRole('button', { name: /^Start Workout / }, SETTLE)
    expect(screen.queryByRole('switch', { name: 'Deload week' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Start a deload week' })).toBeNull()
    cleanup()
    render(
      <ServicesProvider services={servicesAt(TUE)}>
        <ProgramFeature now={() => TUE} navigate={() => {}} onInSession={() => {}} />
      </ServicesProvider>,
    )
    // DX-04: the Program tab's control is "Start a deload week" on its "Deload week" page.
    await openDeloadPage()
    expect(await screen.findByRole('button', { name: 'Start a deload week' }, SETTLE)).toBeTruthy()
  })

  test('V1-22 with Deload on, Train keeps only the "Deload week · Presets 10% lighter" line', async () => {
    await db.settings.put({ key: 'deloadWeek', value: weekStart(TUE, 1), updatedAt: TUE })
    await setActiveProgramId('assaf-ab-2026', TUE)
    mount(servicesAt(TUE), TUE)
    expect(await screen.findByText(TRAIN_LINE, undefined, SETTLE)).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Deload week' })).toBeNull()
  })

  test('O16 starting the due Workout with the switch on stores a deload Session', async () => {
    await db.settings.put({ key: 'deloadWeek', value: weekStart(TUE, 1), updatedAt: TUE })
    await setActiveProgramId('assaf-ab-2026', TUE)
    const s = servicesAt(TUE)
    const { onStartWorkout } = mount(s, TUE)
    await waitFor(() => expect(screen.getByText(TRAIN_LINE)).toBeTruthy(), SETTLE)
    fireEvent.click(screen.getByRole('button', { name: /^Start / }))
    const [workoutId] = onStartWorkout.mock.calls[0] as [string]
    const started = await s.sessions.start('assaf-ab-2026', workoutId)
    expect(started.deload).toBe(true)
  })

  test('O16 a lift on hold reads "stay at" its weight', async () => {
    await seedSquat(0)
    mount(servicesAt(TUE), TUE)
    const lifts = await screen.findByRole('list', { name: 'Workout A lifts' }, SETTLE)
    const row = within(lifts).getByText('Back squat').closest('li') as HTMLElement
    // V2-05: the row reads the Set 1 Preset. V6-01: a Hold's next load is the Preset, so the row
    // offers no other load (the hint is the status's, and Hold has nothing to dial in).
    expect(presetOf(row)).toBe('4×60 kg')
    expect(within(row).queryByText(/was /)).toBeNull()
    expect(within(row).queryByText(/step up/)).toBeNull()
  })

  test('O16 a lift after an easy full bar reads the two-step try', async () => {
    await seedSquat(2)
    mount(servicesAt(TUE), TUE)
    const lifts = await screen.findByRole('list', { name: 'Workout A lifts' }, SETTLE)
    const row = within(lifts).getByText('Back squat').closest('li') as HTMLElement
    // V6-01: the change is the status's next load, two steps up with 2 reps to spare; v7 writes
    // it as the row's load in the up colour, over "was 60 kg".
    expect(presetOf(row)).toBe('4×65 kg')
    expect(within(row).getByText('was 60 kg')).toBeTruthy()
  })
})

describe('DX-04 the Deload week is a visible row on the Program tab', () => {
  test('V4-08 with no deload on, Program shows no Deload week switch and no deload line', async () => {
    await setActiveProgramId('assaf-ab-2026', TUE)
    render(
      <ServicesProvider services={servicesAt(TUE)}>
        <ProgramFeature now={() => TUE} navigate={() => {}} onInSession={() => {}} />
      </ServicesProvider>,
    )
    // Anchored on the stored deload state having loaded: the page offers to start one.
    await openDeloadPage()
    await screen.findByRole('button', { name: 'Start a deload week' }, SETTLE)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('button', { name: 'Deload week' }, SETTLE)).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Deload week' })).toBeNull()
    expect(programLine()).toBeNull()
    expect(screen.queryByText('On this week')).toBeNull()
  })

  test('V4-08 Start a deload week from the overflow shows the line under the title, and Train\'s Presets are the deload ones', async () => {
    await seedSquat(0)
    mountBoth(servicesAt(TUE), TUE)
    const lifts = await screen.findByRole('list', { name: 'Workout A lifts' }, SETTLE)
    const squatRow = (): HTMLElement => within(lifts).getByText('Back squat').closest('li') as HTMLElement
    expect(presetOf(squatRow())).toBe('4×60 kg')

    await startDeloadFromProgram()

    // While on, the page offers End instead, and Train's Presets are the deload ones.
    const end = await screen.findByRole('button', { name: 'End deload week' }, SETTLE)
    expect(screen.queryByRole('button', { name: 'Start a deload week' })).toBeNull()
    await waitFor(() => expect(presetOf(squatRow())).not.toBe('4×60 kg'), SETTLE)
    expect(presetOf(squatRow())).toMatch(/^4×5\d(\.\d+)? kg$/)
    expect(screen.getByText(TRAIN_LINE)).toBeTruthy()

    fireEvent.click(end)
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Deload week' })).toBeTruthy(), SETTLE)
    expect(programLine()).toBeNull()
    await waitFor(() => expect(presetOf(squatRow())).toBe('4×60 kg'), SETTLE)
  })
})
