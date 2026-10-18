import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createServices, type Services, type SyncService } from '../../services'
import { db } from '../../storage/db'
import { setActiveProgramId } from '../../storage/settingsStore'
import type { Session, SetEntry } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { DashboardScreen } from './DashboardScreen'

// fake-indexeddb runs the real storage underneath (src/test/setup.ts); only sync is a double.

const NOW = new Date(2026, 9, 13, 17, 58).getTime()
const SETTLE = { timeout: 3000 }
const at = (month: number, day: number): number => new Date(2026, month, day, 18).getTime()

function syncDouble(lastSyncedAt: number | null): SyncService {
  const result = (): ReturnType<SyncService['syncNow']> =>
    Promise.resolve(
      lastSyncedAt ? { status: 'ok', at: lastSyncedAt, pushed: 0, pulled: 0 } : { status: 'signed-out' },
    )
  return {
    state: async () => ({ accountEmail: lastSyncedAt ? 'me@example.com' : null, lastSyncedAt }),
    syncNow: result,
    replaceRemote: result,
    adoptAccount: async () => {},
  }
}

function services(lastSyncedAt: number | null = null): Services {
  return { ...createServices({ now: () => NOW, storageAvailable: true }), sync: syncDouble(lastSyncedAt) }
}

const squat = (weightKg: number, reps: number, loggedAt: number, setIndex: number): SetEntry => ({
  exerciseId: 'back-squat',
  setIndex,
  weightKg,
  reps,
  loggedAt,
})

function session(id: string, workoutId: string, startedAt: number, entries: SetEntry[]): Session {
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId,
    startedAt,
    finishedAt: startedAt + 3_000_000,
    entries,
    updatedAt: startedAt + 3_000_000,
  }
}

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

function mount(s: Services) {
  const onStartWorkout = vi.fn()
  const onOpenSettings = vi.fn()
  render(
    <ServicesProvider services={s}>
      <DashboardScreen now={() => NOW} onStartWorkout={onStartWorkout} onOpenSettings={onOpenSettings} />
    </ServicesProvider>,
  )
  return { onStartWorkout, onOpenSettings }
}

describe('DashboardScreen', () => {
  test('reads the stored sessions into this week, the lifts and the workout due, and starts it', async () => {
    await db.sessions.bulkPut([
      session('fri', 'workout-a', at(9, 9), [squat(60, 10, at(9, 9), 0), squat(60, 10, at(9, 9), 1)]),
      session('mon', 'workout-b', at(9, 12), [
        { exerciseId: 'deadlift', setIndex: 0, weightKg: 100, reps: 8, loggedAt: at(9, 12) },
      ]),
    ])
    await setActiveProgramId('assaf-ab-2026', NOW)
    const { onStartWorkout } = mount(services(NOW - 2 * 60_000))

    await waitFor(() => expect(screen.getByText('Workout A due')).toBeTruthy(), SETTLE)
    expect(screen.getByText('· last Fri 9 Oct')).toBeTruthy()
    expect(screen.queryByText('1/3')).toBeNull()
    expect(screen.queryByText('Muscle week')).toBeNull()
    const lifts = screen.getByRole('list', { name: 'Workout A lifts' })
    const squatRow = within(lifts).getByText('Back squat').closest('li') as HTMLElement
    expect(within(squatRow).getByText(/^20 of 20 → try /)).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Tue 13 Oct · Synced 2 min ago')).toBeTruthy(), SETTLE)

    fireEvent.click(screen.getByRole('button', { name: 'Start Workout A' }))
    expect(onStartWorkout).toHaveBeenCalledWith('workout-a')
  })

  test('a new trainee picks a program, and using it makes it the active one', async () => {
    mount(services())
    await waitFor(() => expect(screen.getByText('No program yet')).toBeTruthy(), SETTLE)
    const use = screen.getByRole('button', { name: /^Use / })
    fireEvent.click(use)
    await waitFor(() => expect(screen.getByText(/ due$/)).toBeTruthy(), SETTLE)
    expect(screen.queryByText('Your lifts show here after your first workout.')).toBeNull()
    expect(screen.getAllByText('No sets yet').length).toBeGreaterThan(0)
  })

  test("the estimate is the median of the workout's last logged durations once there are three", async () => {
    await db.sessions.bulkPut([
      session('a1', 'workout-a', at(8, 20), [squat(60, 10, at(8, 20), 0)]),
      session('a2', 'workout-a', at(8, 27), [squat(60, 10, at(8, 27), 0)]),
      session('a3', 'workout-a', at(9, 2), [squat(60, 10, at(9, 2), 0)]),
      session('b1', 'workout-b', at(9, 12), [
        { exerciseId: 'deadlift', setIndex: 0, weightKg: 100, reps: 8, loggedAt: at(9, 12) },
      ]),
    ])
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())
    // Each Session ran 3,000,000 ms: 50 minutes. Workout A is due after B.
    await waitFor(() => expect(screen.getByText('~50 min · from your logged workouts')).toBeTruthy(), SETTLE)
  })

  test('settings opens from the header', async () => {
    const { onOpenSettings } = mount(services())
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })
})

describe('DashboardScreen when the Worker refuses this version (E20-T5 O16)', () => {
  test('E20-T5 O16 the sync line shows its failed state, and a Session still starts and a Set is stored', async () => {
    const refused = (): ReturnType<SyncService['syncNow']> =>
      Promise.resolve({ status: 'update-required' } as unknown as Awaited<ReturnType<SyncService['syncNow']>>)
    const base = createServices({ now: () => NOW, storageAvailable: true })
    const s: Services = {
      ...base,
      sync: {
        state: async () => ({ accountEmail: 'me@example.com', lastSyncedAt: null }),
        syncNow: refused,
        replaceRemote: refused,
        adoptAccount: async () => {},
      },
    }
    await setActiveProgramId('assaf-ab-2026', NOW)
    const { onStartWorkout } = mount(s)

    await waitFor(() => expect(screen.getByText(/Not synced · saved on this phone/)).toBeTruthy(), SETTLE)

    fireEvent.click(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE))
    expect(onStartWorkout).toHaveBeenCalledTimes(1)

    const started = await s.sessions.start('assaf-ab-2026', 'workout-a')
    await s.sessions.logSet(started.id, squat(60, 10, NOW, 1))
    expect((await db.sessions.get(started.id))?.entries).toHaveLength(1)
  })
})

describe('DashboardScreen week start (E19-T5 O7)', () => {
  test('E19-T5 O7 Train counts this week from the stored week start', async () => {
    // Sunday 11 Oct: last week on a Monday start, this week on a Sunday start.
    await db.sessions.put(session('sun', 'workout-a', at(9, 11), [squat(60, 10, at(9, 11), 0)]))
    await db.settings.put({ key: 'weekStart', value: 0, updatedAt: NOW })
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())

    await waitFor(() => expect(screen.getByText('Workout B due')).toBeTruthy(), SETTLE)
    expect(screen.getByText('next · 1 more this week')).toBeTruthy()
  })

  test('E19-T5 O7 Train counts this week from Monday when no week start is stored', async () => {
    await db.sessions.put(session('sun', 'workout-a', at(9, 11), [squat(60, 10, at(9, 11), 0)]))
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())

    await waitFor(() => expect(screen.getByText('Workout B due')).toBeTruthy(), SETTLE)
    expect(screen.getByText('next · 2 more this week')).toBeTruthy()
  })
})
