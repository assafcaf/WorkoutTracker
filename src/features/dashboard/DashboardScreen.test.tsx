import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    expect(screen.getByText('1/3')).toBeTruthy()
    expect(screen.getByText('800')).toBeTruthy()
    expect(screen.getByText('vs 1,200')).toBeTruthy()
    expect(screen.getByText('Back squat — try 62.5 kg')).toBeTruthy()
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
    expect(screen.getByText('Your lifts show here after your first workout.')).toBeTruthy()
  })

  test('settings opens from the header', async () => {
    const { onOpenSettings } = mount(services())
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })
})
