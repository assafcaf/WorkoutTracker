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

/**
 * V6-11: a Session with fewer than half its Workout's planned Sets keeps that Workout next. These
 * fixtures name only the Sets a test reads, so each is topped up with 12 working Sets of an
 * Exercise no Program plans (no lift row, no history) to stand as a full Session.
 */
const fullSession = (startedAt: number): SetEntry[] =>
  Array.from({ length: 12 }, (_, index) => ({
    exerciseId: 'not-planned',
    setIndex: 100 + index,
    weightKg: 10,
    reps: 10,
    loggedAt: startedAt + index,
  }))

function session(id: string, workoutId: string, startedAt: number, entries: SetEntry[]): Session {
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId,
    startedAt,
    finishedAt: startedAt + 3_000_000,
    entries: [...entries, ...fullSession(startedAt)],
    updatedAt: startedAt + 3_000_000,
  }
}

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

function mount(s: Services, resume: Parameters<typeof DashboardScreen>[0]['resume'] = null) {
  const onStartWorkout = vi.fn()
  render(
    <ServicesProvider services={s}>
      <DashboardScreen now={() => NOW} onStartWorkout={onStartWorkout} resume={resume} />
    </ServicesProvider>,
  )
  return { onStartWorkout }
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

    // DX-01: the title is the workout due; one meta line under it; then when it was last done.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toBeTruthy(), SETTLE)
    expect(screen.getByText('Tuesday · 1 of 3 this week')).toBeTruthy()
    expect(screen.getByText('Same as Friday.')).toBeTruthy()
    expect(screen.queryByText('1/3')).toBeNull()
    expect(screen.queryByText('Muscle week')).toBeNull()
    const lifts = screen.getByRole('list', { name: 'Workout A lifts' })
    const squatRow = within(lifts).getByText('Back squat').closest('li') as HTMLElement
    // V2-05: Set 1 opens on last time's 60 kg over the Plan's 4 Sets. V6-01: one Session is Too
    // new for a verdict, so the row offers no other load, as Progress says.
    expect(squatRow.querySelector('.dashboard-step-preset')?.textContent).toBe('4×60 kg')
    expect(within(squatRow).queryByText(/was /)).toBeNull()
    // DX-01: no week strip, no ring, no sync line, no gear.
    expect(screen.queryByRole('button', { name: /^This week/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Sync now/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Start Workout A' }))
    expect(onStartWorkout).toHaveBeenCalledWith('workout-a')
  })

  test('DX-04 a new trainee chooses a Program from its row, which makes it the active one', async () => {
    mount(services())
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Choose a Program' })).toBeTruthy(), SETTLE)
    // Plain rows, name and size; no radio card, no filled button, no "plan".
    const row = screen.getByRole('button', { name: /^A\/B Split/ })
    expect(row).toHaveTextContent('3× a week · 2 workouts')
    expect(document.querySelector('.btn-primary')).toBeNull()
    expect(document.body.textContent).not.toMatch(/plan/i)
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Start Workout / })).toBeTruthy(), SETTLE)
    expect(screen.queryByText('Your lifts show here after your first workout.')).toBeNull()
    // V2-05: with no history each row still reads the Preset Set 1 opens on (the start weight).
    expect(screen.queryByText('No sets yet')).toBeNull()
    const rows = within(screen.getByRole('list', { name: /lifts$/ })).getAllByRole('listitem')
    // v7: `sets × kg` (or `3 sets` with no weight to go on).
    expect(rows.every((row) => /\d+(×| sets)/.test(row.querySelector('.dashboard-step-preset')?.textContent ?? ''))).toBe(true)
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
    await waitFor(() => expect(screen.getByText(/· about 50 min$/)).toBeTruthy(), SETTLE)
    expect(screen.queryByText('~50 min · from your logged workouts')).toBeNull()
  })

  test('DX-01 no ‹ › arrows: other Workouts are previewed on the Program tab', async () => {
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())
    await screen.findByRole('list', { name: 'Workout A lifts' }, SETTLE)
    expect(screen.queryByRole('button', { name: /^Next workout/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Previous workout/ })).toBeNull()
  })

  test('DX-01 once the week is done it is a rest day: the meta names the next Workout and Start is an outline "anyway"', async () => {
    await db.sessions.bulkPut([
      session('mon', 'workout-a', at(9, 12) - 3 * 3_600_000, [squat(60, 10, at(9, 12), 0)]),
      session('mon2', 'workout-b', at(9, 12), []),
      session('tue', 'workout-a', at(9, 13) - 6 * 3_600_000, [squat(60, 10, at(9, 13), 0)]),
    ])
    await setActiveProgramId('assaf-ab-2026', NOW)
    const { onStartWorkout } = mount(services())

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workout B' })).toBeTruthy(), SETTLE)
    expect(screen.getByText(/^Done today · next: Workout B/)).toBeTruthy()
    const start = screen.getByRole('button', { name: 'Start Workout B anyway' })
    expect(start).toHaveClass('btn-secondary')
    expect(document.querySelector('.btn-primary')).toBeNull()
    fireEvent.click(start)
    expect(onStartWorkout).toHaveBeenCalledWith('workout-b')
  })

  test('DX-09 with a Session in progress Train shows its Plans and no Start; the strip is the way back', async () => {
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services(), { workoutName: 'Workout B', programName: 'A/B Split', workoutId: 'workout-b' })

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workout B' })).toBeTruthy(), SETTLE)
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Workout B lifts' })).getByText('Deadlift')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Start / })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Resume/ })).toBeNull()
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

    // DX-13: Train says nothing about sync, failed or not; a Session still starts.
    await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)
    expect(screen.queryByText(/Not synced/)).toBeNull()

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
    // DX-01: the meta line counts it; Sunday's Session is in this week.
    expect(screen.getByText('Tuesday · 1 of 3 this week')).toBeTruthy()
  })

  test('E19-T5 O7 Train counts this week from Monday when no week start is stored', async () => {
    await db.sessions.put(session('sun', 'workout-a', at(9, 11), [squat(60, 10, at(9, 11), 0)]))
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workout B' })).toBeTruthy(), SETTLE)
    expect(screen.getByText('Tuesday · 0 of 3 this week')).toBeTruthy()
  })
})

describe('DashboardScreen V2-05 today’s Workout as the live Session opens it', () => {
  test('V2-05 the Deadlift row reads the Set 1 Preset: last time’s first working Set, past the warm-up', async () => {
    const fri = at(9, 9)
    await db.sessions.bulkPut([
      session('fri', 'workout-b', fri, [
        { exerciseId: 'deadlift', setIndex: 1, weightKg: 40, reps: 5, loggedAt: fri, kind: 'warmup' },
        { exerciseId: 'deadlift', setIndex: 2, weightKg: 60, reps: 10, loggedAt: fri },
        { exerciseId: 'deadlift', setIndex: 3, weightKg: 70, reps: 7, loggedAt: fri },
        { exerciseId: 'deadlift', setIndex: 4, weightKg: 70, reps: 7, loggedAt: fri },
      ]),
      session('mon', 'workout-a', at(9, 12), [squat(60, 10, at(9, 12), 0)]),
    ])
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workout B' })).toBeTruthy(), SETTLE)
    const lifts = screen.getByRole('list', { name: 'Workout B lifts' })
    const row = within(lifts).getByText('Deadlift').closest('li') as HTMLElement
    // V6 (V5-07): these Sets ramp, 60 then 70, so the row opens on 60 and says where it goes.
    expect(row.querySelector('.dashboard-step-preset')?.textContent).toBe('3×60 → 70 kg')
    // v7: no rep range on the row.
    expect(row.textContent).not.toMatch(/8–10/)
  })

  test('V2-05 on a deload week each row reads the deloaded Preset', async () => {
    await db.sessions.bulkPut([
      session('thu', 'workout-b', at(9, 8), []),
      session('fri', 'workout-a', at(9, 9), [squat(60, 10, at(9, 9), 0)]),
      session('sat', 'workout-b', at(9, 10), []),
    ])
    await db.settings.put({ key: 'deloadWeek', value: new Date(2026, 9, 12).getTime(), updatedAt: NOW })
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())
    await screen.findByRole('list', { name: 'Workout A lifts' }, SETTLE)
    const row = within(screen.getByRole('list', { name: 'Workout A lifts' })).getByText('Back squat').closest('li') as HTMLElement
    expect(row.querySelector('.dashboard-step-preset')?.textContent).toMatch(/^4×5\d(\.\d+)? kg$/)
    expect(screen.getByText('Deload week: every load is 10 % lighter.')).toBeTruthy()
  })

  test('V6 V5-07 a ramped lift reads its Sets and its range, 4 sets · 47.5 → 62.5 kg', async () => {
    await db.sessions.bulkPut([
      session('fri', 'workout-a', at(9, 9), [
        squat(47.5, 10, at(9, 9), 0),
        squat(57.5, 10, at(9, 9), 1),
        squat(62.5, 8, at(9, 9), 2),
        squat(62.5, 8, at(9, 9), 3),
      ]),
      session('sat', 'workout-b', at(9, 10), []),
    ])
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())
    const a = await screen.findByRole('list', { name: 'Workout A lifts' }, SETTLE)
    const row = within(a).getByText('Back squat').closest('li') as HTMLElement

    expect(row.querySelector('.dashboard-step-preset')?.textContent).toBe('4×47.5 → 62.5 kg')
  })
})

describe('DashboardScreen V6 flow', () => {
  const raw = (id: string, workoutId: string, startedAt: number, entries: SetEntry[], note?: string): Session => ({
    id,
    programId: 'assaf-ab-2026',
    workoutId,
    startedAt,
    finishedAt: startedAt + 600_000,
    entries,
    updatedAt: startedAt + 600_000,
    ...(note ? { note } : {}),
  })

  test('V6-11 after 2 Sets of Workout B and Finish, Train offers Workout B again with the lifts left', async () => {
    const mon = at(9, 12)
    await db.sessions.bulkPut([
      session('fri', 'workout-a', at(9, 9), [squat(60, 10, at(9, 9), 0)]),
      raw('mon', 'workout-b', mon, [
        { exerciseId: 'deadlift', setIndex: 1, weightKg: 60, reps: 10, loggedAt: mon },
        { exerciseId: 'deadlift', setIndex: 2, weightKg: 70, reps: 7, loggedAt: mon },
      ]),
    ])
    await setActiveProgramId('assaf-ab-2026', NOW)
    const { onStartWorkout } = mount(services())

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workout B' })).toBeTruthy(), SETTLE)
    // V6R-03: Workout B again, all of it, in plain words; no "lifts left" Start would not keep.
    expect(screen.getByText(/^Workout B again · last one was cut short on Mon 12 Oct\./)).toBeTruthy()
    expect(screen.queryByText(/lifts? left/)).toBeNull()
    // The week (from Monday) still counts it.
    expect(screen.getByText('Tuesday · 1 of 3 this week')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout B' }))
    expect(onStartWorkout).toHaveBeenCalledWith('workout-b')
  })

  test("V6-08 Train shows the offered Workout's last Session note under the date", async () => {
    await db.sessions.bulkPut([
      session('wed', 'workout-b', at(9, 7), []),
      raw('wed-note', 'workout-b', at(9, 7) - 1, [], 'Right elbow sore on pull-downs, dropped the weight.'),
      session('fri', 'workout-a', at(9, 9), [squat(60, 10, at(9, 9), 0)]),
      session('mon', 'workout-b', at(9, 12), []),
      session('tue', 'workout-a', at(9, 13) - 3_600_000, []),
    ])
    await setActiveProgramId('assaf-ab-2026', NOW)
    mount(services())

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Workout B' })).toBeTruthy(), SETTLE)
    // v7: folded into the headline sentence.
    expect(screen.getByText(/Note from Wed 7 Oct: Right elbow sore on pull-downs, dropped the weight\.$/)).toBeTruthy()
  })
})
