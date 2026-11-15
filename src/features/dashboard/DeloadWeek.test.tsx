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
      <DashboardScreen now={() => now} onStartWorkout={onStartWorkout} onOpenSettings={() => {}} />
    </ServicesProvider>,
  )
  return { onStartWorkout }
}

/** Train and the Program tab over one set of services: the Deload week is set on Program (V1-22),
 * from the head's overflow since V4-08. */
function mountBoth(s: Services, now: number): void {
  render(
    <ServicesProvider services={s}>
      <ProgramFeature now={() => now} navigate={() => {}} onInSession={() => {}} />
      <DashboardScreen now={() => now} onStartWorkout={() => {}} onOpenSettings={() => {}} />
    </ServicesProvider>,
  )
}

const TRAIN_LINE = 'Deload week · Presets 10% lighter'
const PROGRAM_LINE = 'Deload week · lighter Presets · End'

/** Opens the Program head's overflow (the Programs panel) and taps "Start a deload week" (V4-08). */
async function startDeloadFromProgram(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Programs' }, SETTLE))
  fireEvent.click(await screen.findByRole('button', { name: 'Start a deload week' }, SETTLE))
}

/** The Program tab's deload line under its title, matched on its whole text, or null. */
function programLine(): HTMLElement | null {
  return screen.queryByText((_, element) => element?.classList.contains('program-deload-line') === true && element.textContent === PROGRAM_LINE)
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
    entries: [{ exerciseId: 'deadlift', setIndex: 0, weightKg: 100, reps: 8, loggedAt: day(9, 12) }],
  }
  await db.sessions.bulkPut([session, other])
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
    await waitFor(() => expect(programLine()).not.toBeNull(), SETTLE)
  })

  test('O15 with weekStart 6, a switch turned on on Fri 23 Oct still reads on that Friday', async () => {
    await db.settings.put({ key: 'weekStart', value: 6, updatedAt: FRI })
    await db.settings.put({ key: 'deloadWeek', value: weekStart(FRI, 6), updatedAt: FRI })
    await setActiveProgramId('assaf-ab-2026', FRI)
    mountBoth(servicesAt(FRI), FRI)
    expect(await screen.findByRole('button', { name: 'End deload week' }, SETTLE)).toBeTruthy()
    expect(programLine()).not.toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: 'Programs' }))
    expect(await screen.findByRole('button', { name: 'Start a deload week' }, SETTLE)).toBeTruthy()
  })

  test('O15 turning it off stores null', async () => {
    await db.settings.put({ key: 'deloadWeek', value: weekStart(TUE, 1), updatedAt: TUE })
    await setActiveProgramId('assaf-ab-2026', TUE)
    mountBoth(servicesAt(TUE), TUE)
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
    // Since V4-08 the Program tab's control is "Start a deload week" in its head's overflow.
    fireEvent.click(await screen.findByRole('button', { name: 'Programs' }, SETTLE))
    expect(await screen.findByRole('button', { name: 'Start a deload week' }, SETTLE)).toBeTruthy()
  })

  test('V1-22 with Deload on, Train keeps only the "Deload week · Presets 10% lighter" line', async () => {
    await db.settings.put({ key: 'deloadWeek', value: weekStart(TUE, 1), updatedAt: TUE })
    await setActiveProgramId('assaf-ab-2026', TUE)
    mount(servicesAt(TUE), TUE)
    expect(await screen.findByText('Deload week · Presets 10% lighter', undefined, SETTLE)).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Deload week' })).toBeNull()
  })

  test('O16 starting the due Workout with the switch on stores a deload Session', async () => {
    await db.settings.put({ key: 'deloadWeek', value: weekStart(TUE, 1), updatedAt: TUE })
    await setActiveProgramId('assaf-ab-2026', TUE)
    const s = servicesAt(TUE)
    const { onStartWorkout } = mount(s, TUE)
    await waitFor(() => expect(screen.getByText('Deload week · Presets 10% lighter')).toBeTruthy(), SETTLE)
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
    // V2-05: the row reads the Set 1 Preset, and the hold says to stay instead of a step up.
    expect(within(row).getByText('4 × 60 kg')).toBeTruthy()
    expect(within(row).getByText('stay at 60 kg')).toBeTruthy()
    expect(within(row).queryByText(/step up/)).toBeNull()
  })

  test('O16 a lift after an easy full bar reads the two-step try', async () => {
    await seedSquat(2)
    mount(servicesAt(TUE), TUE)
    const lifts = await screen.findByRole('list', { name: 'Workout A lifts' }, SETTLE)
    const row = within(lifts).getByText('Back squat').closest('li') as HTMLElement
    expect(within(row).getByText('4 × 60 kg')).toBeTruthy()
    expect(within(row).getByText(/^step up · try (6[0-9](\.\d+)?) kg$/)).toBeTruthy()
  })
})

describe('V4-08 the Deload week lives in the Program head\'s overflow', () => {
  test('V4-08 with no deload on, Program shows no Deload week switch and no deload line', async () => {
    await setActiveProgramId('assaf-ab-2026', TUE)
    render(
      <ServicesProvider services={servicesAt(TUE)}>
        <ProgramFeature now={() => TUE} navigate={() => {}} onInSession={() => {}} />
      </ServicesProvider>,
    )
    // Anchored on the stored deload state having loaded: the overflow offers to start one.
    fireEvent.click(await screen.findByRole('button', { name: 'Programs' }, SETTLE))
    await screen.findByRole('button', { name: 'Start a deload week' }, SETTLE)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByText('Weekly sets, planned', undefined, SETTLE)).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Deload week' })).toBeNull()
    expect(screen.queryByText(/Deload week/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'End deload week' })).toBeNull()
  })

  test('V4-08 Start a deload week from the overflow shows the line under the title, and Train\'s Presets are the deload ones', async () => {
    await seedSquat(0)
    mountBoth(servicesAt(TUE), TUE)
    const lifts = await screen.findByRole('list', { name: 'Workout A lifts' }, SETTLE)
    const squatRow = (): HTMLElement => within(lifts).getByText('Back squat').closest('li') as HTMLElement
    expect(within(squatRow()).getByText('4 × 60 kg')).toBeTruthy()

    await startDeloadFromProgram()

    // The panel closes on the choice, so the line is what shows; it sits before the plan.
    await waitFor(() => expect(programLine()).not.toBeNull(), SETTLE)
    expect(screen.queryByRole('dialog', { name: 'Programs' })).toBeNull()
    const line = programLine() as HTMLElement
    const end = within(line).getByRole('button', { name: 'End deload week' })
    expect(end).toHaveTextContent('End')
    await waitFor(() => expect(within(squatRow()).queryByText('4 × 60 kg')).toBeNull(), SETTLE)
    expect(within(squatRow()).getByText(/^4 × 5\d(\.\d+)? kg$/)).toBeTruthy()
    expect(screen.getByText(TRAIN_LINE)).toBeTruthy()

    // While on, the overflow no longer offers to start one.
    fireEvent.click(screen.getByRole('button', { name: 'Programs' }))
    await screen.findByRole('dialog', { name: 'Programs' }, SETTLE)
    expect(screen.queryByRole('button', { name: 'Start a deload week' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    fireEvent.click(end)
    await waitFor(() => expect(programLine()).toBeNull(), SETTLE)
    await waitFor(() => expect(within(squatRow()).getByText('4 × 60 kg')).toBeTruthy(), SETTLE)
  })
})
