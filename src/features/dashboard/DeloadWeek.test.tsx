import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { weekStart } from '../../domain/stats/weeks'
import { createServices, type Services } from '../../services'
import { db } from '../../storage/db'
import { setActiveProgramId } from '../../storage/settingsStore'
import type { Session, SetEntry } from '../../types'
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
  await db.sessions.put(session)
  await setActiveProgramId('assaf-ab-2026', TUE)
}

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

describe('Train Deload week switch (E21-T7)', () => {
  test('O15 the switch shows off when deloadWeek is unset, and turning it on stores this week through the week start', async () => {
    await db.settings.put({ key: 'weekStart', value: 6, updatedAt: FRI })
    await setActiveProgramId('assaf-ab-2026', FRI)
    mount(servicesAt(FRI), FRI)
    const toggle = (await screen.findByRole('switch', { name: 'Deload week' }, SETTLE)) as HTMLInputElement
    expect(toggle.checked).toBe(false)
    expect(screen.queryByText('Deload week · Presets 10% lighter')).toBeNull()

    fireEvent.click(toggle)
    await waitFor(() => expect(screen.getByText('Deload week · Presets 10% lighter')).toBeTruthy(), SETTLE)
    expect((await db.settings.get('deloadWeek'))?.value).toBe(weekStart(FRI, 6))
    expect((screen.getByRole('switch', { name: 'Deload week' }) as HTMLInputElement).checked).toBe(true)
  })

  test('O15 with weekStart 6, a switch turned on on Fri 23 Oct still reads on that Friday', async () => {
    await db.settings.put({ key: 'weekStart', value: 6, updatedAt: FRI })
    await db.settings.put({ key: 'deloadWeek', value: weekStart(FRI, 6), updatedAt: FRI })
    await setActiveProgramId('assaf-ab-2026', FRI)
    mount(servicesAt(FRI), FRI)
    const on = (await screen.findByRole('switch', { name: 'Deload week' }, SETTLE)) as HTMLInputElement
    await waitFor(() => expect(on.checked).toBe(true), SETTLE)
  })

  test('O15 with weekStart 6, the switch turned on on Fri 23 Oct reads off on Sat 24 Oct', async () => {
    await db.settings.put({ key: 'weekStart', value: 6, updatedAt: FRI })
    await db.settings.put({ key: 'deloadWeek', value: weekStart(FRI, 6), updatedAt: FRI })
    await setActiveProgramId('assaf-ab-2026', SAT)
    mount(servicesAt(SAT), SAT)
    const toggle = (await screen.findByRole('switch', { name: 'Deload week' }, SETTLE)) as HTMLInputElement
    await waitFor(() => expect(screen.getByText('Sat 24 Oct · Saved on this phone')).toBeTruthy(), SETTLE)
    expect(toggle.checked).toBe(false)
    expect(screen.queryByText('Deload week · Presets 10% lighter')).toBeNull()
  })

  test('O15 turning it off stores null', async () => {
    await db.settings.put({ key: 'deloadWeek', value: weekStart(TUE, 1), updatedAt: TUE })
    await setActiveProgramId('assaf-ab-2026', TUE)
    mount(servicesAt(TUE), TUE)
    const toggle = (await screen.findByRole('switch', { name: 'Deload week' }, SETTLE)) as HTMLInputElement
    await waitFor(() => expect(toggle.checked).toBe(true), SETTLE)
    fireEvent.click(toggle)
    await waitFor(() => expect(screen.queryByText('Deload week · Presets 10% lighter')).toBeNull(), SETTLE)
    expect(await db.settings.get('deloadWeek')).toBeUndefined()
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
    expect(within(row).getByText('20 of 20')).toBeTruthy()
    expect(within(row).getByText('stay at 60 kg')).toBeTruthy()
    expect(within(row).queryByText(/→ try/)).toBeNull()
  })

  test('O16 a lift after an easy full bar reads the two-step try', async () => {
    await seedSquat(2)
    mount(servicesAt(TUE), TUE)
    const lifts = await screen.findByRole('list', { name: 'Workout A lifts' }, SETTLE)
    const row = within(lifts).getByText('Back squat').closest('li') as HTMLElement
    expect(within(row).getByText(/^20 of 20 → try (6[0-9](\.\d+)?) kg$/)).toBeTruthy()
  })
})
