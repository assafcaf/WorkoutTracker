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
  const onOpenSessions = vi.fn()
  render(
    <ServicesProvider services={s}>
      <DashboardScreen
        now={() => NOW}
        onStartWorkout={onStartWorkout}
        onOpenSettings={onOpenSettings}
        onOpenSessions={onOpenSessions}
      />
    </ServicesProvider>,
  )
  return { onStartWorkout, onOpenSettings, onOpenSessions }
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

    // V3-08: the header names the workout due and when it was last done.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toBeTruthy(), SETTLE)
    expect(screen.getByText('Tue 13 Oct · last done Fri 9 Oct')).toBeTruthy()
    expect(screen.queryByText('1/3')).toBeNull()
    expect(screen.queryByText('Muscle week')).toBeNull()
    const lifts = screen.getByRole('list', { name: 'Workout A lifts' })
    const squatRow = within(lifts).getByText('Back squat').closest('li') as HTMLElement
    // V2-05: Set 1 opens on last time's 60 kg over the Plan's 4 Sets; the full range earns a step up.
    expect(within(squatRow).getByText('4 × 60 kg')).toBeTruthy()
    expect(within(squatRow).getByText(/^step up · try /)).toBeTruthy()
    expect(within(screen.getByRole('button', { name: /^This week/ })).getByText('1 of 3')).toBeTruthy()
    // V3-08: the sync state is the cloud button's name, not a line of text.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sync now · Synced 2 min ago' })).toBeTruthy(), SETTLE)

    fireEvent.click(screen.getByRole('button', { name: 'Start Workout A' }))
    expect(onStartWorkout).toHaveBeenCalledWith('workout-a')
  })

  test('a new trainee picks a program, and using it makes it the active one', async () => {
    mount(services())
    await waitFor(() => expect(screen.getByText('No program yet')).toBeTruthy(), SETTLE)
    const use = screen.getByRole('button', { name: /^Use / })
    fireEvent.click(use)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Start Workout / })).toBeTruthy(), SETTLE)
    expect(screen.queryByText('Your lifts show here after your first workout.')).toBeNull()
    // V2-05: with no history each row still reads the Preset Set 1 opens on (the start weight).
    expect(screen.queryByText('No sets yet')).toBeNull()
    const rows = within(screen.getByRole('list', { name: /lifts$/ })).getAllByRole('listitem')
    expect(rows.every((row) => /\d+ (×|sets)/.test(row.textContent ?? ''))).toBe(true)
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
    // V2-05, V3-08: the dock carries the estimate alone; the card no longer repeats it.
    await waitFor(() => expect(screen.getByText('~50 min')).toBeTruthy(), SETTLE)
    expect(screen.queryByText('~50 min · from your logged workouts')).toBeNull()
  })

  test('V1-21 after Change the Workout card is the chosen Workout with its first lift', async () => {
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())
    await screen.findByRole('list', { name: 'Workout A lifts' }, SETTLE)
    fireEvent.click(screen.getByRole('button', { name: 'Choose another workout' }))
    expect(screen.getByRole('button', { name: 'Start Workout B' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Workout B' })).toBeTruthy()
    const rows = within(screen.getByRole('list', { name: 'Workout B lifts' })).getAllByRole('listitem')
    expect(within(rows[0]).getByText('Deadlift')).toBeTruthy()
  })

  test('settings opens from the header', async () => {
    const { onOpenSettings } = mount(services())
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  test('V3-09 the week strip is drawn in the Workouts colours and opens Sessions', async () => {
    await db.sessions.bulkPut([
      session('fri', 'workout-a', at(9, 9), [squat(60, 10, at(9, 9), 0)]),
      session('mon', 'workout-b', at(9, 12), [
        { exerciseId: 'deadlift', setIndex: 0, weightKg: 100, reps: 8, loggedAt: at(9, 12) },
      ]),
    ])
    await setActiveProgramId('assaf-ab-2026', NOW)
    const { onOpenSessions } = mount(services())
    const week = await screen.findByRole('button', { name: /^This week/ }, SETTLE)
    const monday = week.querySelectorAll('.calendar-day')[0]
    expect(monday.textContent).toBe('B')
    expect(monday.getAttribute('data-workout')).toBe('pull')
    expect(week.querySelectorAll('.calendar-day[data-today]')).toHaveLength(1)
    fireEvent.click(week)
    expect(onOpenSessions).toHaveBeenCalledTimes(1)
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

    // V3-08: the failed state is the cloud button's name and its dot, not a visible line.
    await waitFor(
      () => expect(screen.getByRole('button', { name: /^Sync now · Not synced · saved on this phone/ })).toBeTruthy(),
      SETTLE,
    )

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

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workout B' })).toBeTruthy(), SETTLE)
    // V2-05: the week strip at the top of Train counts it; Sunday's Session is in this week.
    const week = screen.getByRole('button', { name: /^This week/ })
    expect(within(week).getByText('1 of 3')).toBeTruthy()
    expect(week.querySelectorAll('.calendar-day')[0].textContent).toBe('A')
    expect(week.getAttribute('aria-label')).toContain('Workout A Sun')
  })

  test('E19-T5 O7 Train counts this week from Monday when no week start is stored', async () => {
    await db.sessions.put(session('sun', 'workout-a', at(9, 11), [squat(60, 10, at(9, 11), 0)]))
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workout B' })).toBeTruthy(), SETTLE)
    const week = screen.getByRole('button', { name: /^This week/ })
    expect(within(week).getByText('0 of 3')).toBeTruthy()
    expect(week.querySelectorAll('.calendar-day')[0].textContent).toBe('')
    expect(week.getAttribute('aria-label')).toContain('no sessions yet')
  })
})

describe('DashboardScreen V2-05 today’s Workout as the live Session opens it', () => {
  test('V2-05 the Deadlift row reads the Set 1 Preset: last time’s first working Set, past the warm-up', async () => {
    const mon = at(9, 12)
    await db.sessions.bulkPut([
      session('fri', 'workout-a', at(9, 9), [squat(60, 10, at(9, 9), 0)]),
      session('mon', 'workout-b', mon, [
        { exerciseId: 'deadlift', setIndex: 1, weightKg: 40, reps: 5, loggedAt: mon, kind: 'warmup' },
        { exerciseId: 'deadlift', setIndex: 2, weightKg: 60, reps: 10, loggedAt: mon },
        { exerciseId: 'deadlift', setIndex: 3, weightKg: 70, reps: 7, loggedAt: mon },
        { exerciseId: 'deadlift', setIndex: 4, weightKg: 70, reps: 7, loggedAt: mon },
      ]),
    ])
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toBeTruthy(), SETTLE)
    fireEvent.click(screen.getByRole('button', { name: 'Choose another workout' }))
    const lifts = screen.getByRole('list', { name: 'Workout B lifts' })
    const row = within(lifts).getByText('Deadlift').closest('li') as HTMLElement
    // V6 (V5-07): these Sets ramp, 60 then 70, so the row opens on 60 and says where it goes.
    expect(within(row).getByText('3 sets · 60 → 70 kg')).toBeTruthy()
    expect(within(row).getByText('· 8–10')).toBeTruthy()
  })

  test('V2-05 on a deload week each row reads the deloaded Preset', async () => {
    await db.sessions.put(session('fri', 'workout-a', at(9, 9), [squat(60, 10, at(9, 9), 0)]))
    await db.settings.put({ key: 'deloadWeek', value: new Date(2026, 9, 12).getTime(), updatedAt: NOW })
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())
    const lifts = await screen.findByRole('list', { name: 'Workout B lifts' }, SETTLE)
    expect(lifts).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Choose another workout' }))
    const a = screen.getByRole('list', { name: 'Workout A lifts' })
    const row = within(a).getByText('Back squat').closest('li') as HTMLElement
    expect(within(row).getByText(/^4 × 5\d(\.\d+)? kg$/)).toBeTruthy()
    expect(screen.getByText('Deload week · Presets 10% lighter')).toBeTruthy()
  })

  test('V6 V5-07 a ramped lift reads its Sets and its range, 4 sets · 47.5 → 62.5 kg', async () => {
    await db.sessions.put(
      session('fri', 'workout-a', at(9, 9), [
        squat(47.5, 10, at(9, 9), 0),
        squat(57.5, 10, at(9, 9), 1),
        squat(62.5, 8, at(9, 9), 2),
        squat(62.5, 8, at(9, 9), 3),
      ]),
    )
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())
    await screen.findByRole('list', { name: 'Workout B lifts' }, SETTLE)
    fireEvent.click(screen.getByRole('button', { name: 'Choose another workout' }))
    const a = screen.getByRole('list', { name: 'Workout A lifts' })
    const row = within(a).getByText('Back squat').closest('li') as HTMLElement

    expect(within(row).getByText('4 sets · 47.5 → 62.5 kg')).toBeTruthy()
    expect(within(row).queryByText('4 × 47.5 kg')).toBeNull()
  })
})
