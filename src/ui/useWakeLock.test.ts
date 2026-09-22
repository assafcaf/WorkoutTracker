import { createElement } from 'react'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { db } from '../storage/db'
import { SetScreen } from './SetScreen'
import type { SetScreenProps } from './SetScreen'
import { useWakeLock } from './useWakeLock'
import type { Exercise, ExercisePlan, SetEntry } from '../types'

// This file stays .ts (per the ticket), so the set screen is rendered through
// `createElement` rather than JSX -- esbuild only parses JSX in .tsx files.
function renderSetScreen(over: Partial<SetScreenProps> = {}) {
  const props: SetScreenProps = {
    exercise: backSquat,
    plan: squatPlan,
    setIndex: 2,
    sessionId: SESSION_ID,
    lastEntries: [historyEntry(2, 60, 10)],
    onLogged: vi.fn(),
    ...over,
  }
  return render(createElement(SetScreen, props))
}

// jsdom exposes no navigator.wakeLock at all, so the "absent" case is this environment's
// default and only the resolving/rejecting cases need stubbing.
type WakeLockSentinelLike = { release(): Promise<void> }
type WakeLockRequest = (type: 'screen') => Promise<WakeLockSentinelLike>

function stubWakeLock(request: WakeLockRequest): void {
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request },
    configurable: true,
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'wakeLock')
  vi.restoreAllMocks()
})

const BASE = 1_700_000_000_000
const SESSION_ID = 'session-under-test'

const catalog = loadCatalog()
const backSquat = catalog.get('back-squat') as Exercise
const squatPlan: ExercisePlan = {
  exerciseId: 'back-squat',
  sets: 4,
  repRange: [8, 10],
  restSeconds: 180,
}

function historyEntry(setIndex: number, weightKg: number | null, reps: number): SetEntry {
  return { exerciseId: 'back-squat', setIndex, weightKg, reps, loggedAt: BASE }
}

async function storedEntries(): Promise<SetEntry[]> {
  const session = await db.sessions.get(SESSION_ID)
  return session?.entries ?? []
}

// ---- Hook-level: the API present and resolving case, and the release paths ----

test('O20 useWakeLock requests a screen wake lock while active and the API resolves', async () => {
  const release = vi.fn().mockResolvedValue(undefined)
  const request = vi.fn().mockResolvedValue({ release })
  stubWakeLock(request)

  renderHook(() => useWakeLock(true))

  await waitFor(() => {
    expect(request).toHaveBeenCalledWith('screen')
  })
})

test('O20 useWakeLock releases the lock once active turns false', async () => {
  const release = vi.fn().mockResolvedValue(undefined)
  const request = vi.fn().mockResolvedValue({ release })
  stubWakeLock(request)

  const { rerender } = renderHook(({ active }) => useWakeLock(active), {
    initialProps: { active: true },
  })
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1))

  rerender({ active: false })

  await waitFor(() => expect(release).toHaveBeenCalledTimes(1))
})

test('O20 useWakeLock releases the lock on unmount', async () => {
  const release = vi.fn().mockResolvedValue(undefined)
  const request = vi.fn().mockResolvedValue({ release })
  stubWakeLock(request)

  const { unmount } = renderHook(() => useWakeLock(true))
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1))

  unmount()

  await waitFor(() => expect(release).toHaveBeenCalledTimes(1))
})

// ---- Integration: the set screen requests a wake lock on mount, and both degrading cases
// leave logging working with nothing surfaced as an error ----

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.sessions.put({
    id: SESSION_ID,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: BASE,
    finishedAt: null,
    entries: [],
  })
})

test('O20 a screen wake lock is requested when the set screen mounts with a session active', async () => {
  const release = vi.fn().mockResolvedValue(undefined)
  const request = vi.fn().mockResolvedValue({ release })
  stubWakeLock(request)

  renderSetScreen()

  await waitFor(() => {
    expect(request).toHaveBeenCalledWith('screen')
  })
})

test('O20 logging a set still works when the set screen mounts with no Wake Lock API', async () => {
  expect((navigator as { wakeLock?: unknown }).wakeLock).toBeUndefined()
  const user = userEvent.setup()

  renderSetScreen()

  await user.click(screen.getByRole('button', { name: 'Log set' }))

  await waitFor(async () => {
    expect(await storedEntries()).toHaveLength(1)
  })
  expect(await screen.findByText('Set 3 of 4')).toBeVisible()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('O20 logging a set still works when the Wake Lock API rejects the request', async () => {
  const request = vi.fn().mockRejectedValue(new Error('not allowed'))
  stubWakeLock(request)
  const user = userEvent.setup()

  renderSetScreen()

  // The screen must actually have tried the lock -- not merely have left it untouched -- for
  // this to prove the rejection was swallowed rather than the lock never being requested at all.
  await waitFor(() => {
    expect(request).toHaveBeenCalledWith('screen')
  })

  await user.click(screen.getByRole('button', { name: 'Log set' }))

  await waitFor(async () => {
    expect(await storedEntries()).toHaveLength(1)
  })
  expect(await screen.findByText('Set 3 of 4')).toBeVisible()
  expect(screen.queryByRole('alert')).toBeNull()
})
