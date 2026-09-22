// E2-T3 / O5: a new deployment never interrupts a workout.
//
// O5 makes four claims, and each one is tested here: when the service worker finds an update
// (a) nothing reloads and the session in progress is untouched, (b) an "Update ready" control
// appears, (c) the new version takes over when that control is used, and (d) not one moment
// before it.
//
// What is mocked and why: `virtual:pwa-register` is vite-plugin-pwa's generated module. Under
// vitest it resolves to a no-op stub -- there is no browser service worker to drive -- so an
// update can never be found and none of O5 could be exercised. It is therefore replaced with a
// double that mirrors the real module: `registerSW(options)` records the options the app
// registered with and hands back the `updateServiceWorker(reloadPage?)` function the real one
// returns. Everything above it is real: `registerServiceWorker`, `useServiceWorkerUpdate`,
// `UpdatePill` and the whole `App` with its fake-indexeddb-backed session store.
import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from '../App'
import { useServiceWorkerUpdate } from '../pwa/registerSW'
import { db } from '../storage/db'
import { UpdatePill } from './UpdatePill'

/** The options vite-plugin-pwa's `registerSW` accepts; the app uses the first two. */
type PwaRegisterOptions = {
  immediate?: boolean
  onNeedRefresh?(): void
  onOfflineReady?(): void
  onRegisteredSW?(swScriptUrl: string, registration: unknown): void
  onRegisterError?(error: unknown): void
}

const pwa = vi.hoisted(() => ({
  /** One entry per `registerSW` call, in order. */
  registrations: [] as PwaRegisterOptions[],
  /** The real module's return value: what activates the waiting worker and reloads. */
  updateServiceWorker: vi.fn(async (_reloadPage?: boolean) => {}),
}))

vi.mock('virtual:pwa-register', () => ({
  registerSW(options: PwaRegisterOptions = {}) {
    pwa.registrations.push(options)
    return pwa.updateServiceWorker
  },
}))

/** Long enough for a Dexie round-trip on a loaded machine; still short when a query is red. */
const SETTLE = { timeout: 2000 }

/** Stands in for `window.location`, so an attempt to navigate away is visible to a test. */
let navigation: { reload: ReturnType<typeof vi.fn>; assign: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> }
let realLocation: Location

beforeEach(async () => {
  pwa.registrations.length = 0
  pwa.updateServiceWorker.mockClear()

  // jsdom has no service worker at all, and `registerServiceWorker` correctly does nothing
  // without one, so the capability has to be there for anything to register.
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { controller: null, register: vi.fn(), addEventListener: vi.fn() },
  })

  realLocation = window.location
  navigation = { reload: vi.fn(), assign: vi.fn(), replace: vi.fn() }
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, ...navigation },
  })

  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

/** The options the app last registered the service worker with. */
function lastRegistration(): PwaRegisterOptions {
  const latest = pwa.registrations[pwa.registrations.length - 1]
  if (!latest) throw new Error('nothing registered a service worker')
  return latest
}

/** What the browser does when a new deployment has installed and is waiting to take over. */
function deployNewVersion(): void {
  const { onNeedRefresh } = lastRegistration()
  act(() => {
    onNeedRefresh?.()
  })
}

/** True when nothing in this test has been able to navigate the page away. */
function nothingNavigated(): boolean {
  return (
    navigation.reload.mock.calls.length === 0 &&
    navigation.assign.mock.calls.length === 0 &&
    navigation.replace.mock.calls.length === 0
  )
}

/** Starts a workout from the picker, which leaves the app on that session's exercise list. */
async function startWorkout(user: UserEvent, workoutName: string): Promise<void> {
  await user.click(await screen.findByRole('button', { name: `Start ${workoutName}` }, SETTLE))
}

/** Opens an exercise from the exercise list, which leaves the app on its set screen. */
async function openExercise(user: UserEvent, exerciseName: string): Promise<void> {
  await user.click(
    await screen.findByRole('button', { name: new RegExp(`^${exerciseName}`) }, SETTLE),
  )
}

/** The "Update ready" control, or null when it is not on screen. */
function updateControl(): HTMLElement | null {
  return screen.queryByRole('button', { name: 'Update ready' })
}

// --- the control itself -------------------------------------------------------------------

test('O5 UpdatePill offers a control labelled "Update ready"', () => {
  render(<UpdatePill onUpdate={vi.fn()} />)

  expect(screen.getByRole('button', { name: 'Update ready' })).toBeVisible()
})

test('O5 pressing the Update ready control runs the update it was given', async () => {
  const user = userEvent.setup()
  const onUpdate = vi.fn()
  render(<UpdatePill onUpdate={onUpdate} />)

  await user.click(screen.getByRole('button', { name: 'Update ready' }))

  expect(onUpdate).toHaveBeenCalledTimes(1)
})

test('O5 UpdatePill runs no update until its control is pressed', () => {
  const onUpdate = vi.fn()

  render(<UpdatePill onUpdate={onUpdate} />)

  expect(onUpdate).not.toHaveBeenCalled()
})

// --- the hook that finds the update ---------------------------------------------------------

/** A probe that renders what `useServiceWorkerUpdate` reports and lets a test call `update`. */
function HookProbe(): JSX.Element {
  const { needRefresh, update } = useServiceWorkerUpdate()
  return (
    <div>
      <span data-testid="need-refresh">{needRefresh ? 'yes' : 'no'}</span>
      <button
        type="button"
        onClick={() => {
          void update()
        }}
      >
        run update
      </button>
    </div>
  )
}

/** What the probe currently reports for `needRefresh`. */
function reportedNeedRefresh(): string {
  return screen.getByTestId('need-refresh').textContent ?? ''
}

test('O5 useServiceWorkerUpdate needs no refresh, and activates nothing, before an update is found', () => {
  render(<HookProbe />)

  expect(reportedNeedRefresh()).toBe('no')
  expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
  expect(nothingNavigated()).toBe(true)
})

test('O5 useServiceWorkerUpdate needs a refresh once a new version is waiting, and still activates nothing', () => {
  render(<HookProbe />)

  deployNewVersion()

  expect(reportedNeedRefresh()).toBe('yes')
  expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
  expect(nothingNavigated()).toBe(true)
})

test('O5 useServiceWorkerUpdate lets the waiting worker take over, reloading, only when update is called', async () => {
  const user = userEvent.setup()
  render(<HookProbe />)
  deployNewVersion()

  await user.click(screen.getByRole('button', { name: 'run update' }))

  expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1)
  // `updateServiceWorker(false)` would activate the new worker and leave the old code running,
  // so the update would not take effect where the user asked for it.
  expect(pwa.updateServiceWorker.mock.calls[0][0]).not.toBe(false)
})

test('O5 useServiceWorkerUpdate registers the service worker once, not once per render', () => {
  // main.tsx renders under StrictMode, whose double-invoked effects register twice unless the
  // hook guards against it -- which would leave two handles and a second update to find.
  const { rerender } = render(
    <StrictMode>
      <HookProbe />
    </StrictMode>,
  )

  rerender(
    <StrictMode>
      <HookProbe />
    </StrictMode>,
  )

  expect(pwa.registrations).toHaveLength(1)
})

test('O5 useServiceWorkerUpdate needs no refresh when the browser has no service worker', () => {
  Reflect.deleteProperty(navigator, 'serviceWorker')

  render(<HookProbe />)

  expect(reportedNeedRefresh()).toBe('no')
  expect(pwa.registrations).toHaveLength(0)
})

// --- the outcome: an update found while a workout is under way -------------------------------

test('O5 App listens for an update from the moment it starts, without offering the control', async () => {
  render(<App />)
  await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)

  // Without the registration the absent control below would be vacuous: an app that never
  // listens also never shows a pill, and would never find the update O5 is about.
  expect(pwa.registrations).toHaveLength(1)
  expect(updateControl()).toBeNull()
})

test('O5 an update found mid-session leaves the session in progress on screen', async () => {
  const user = userEvent.setup()
  render(<App />)
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')
  await user.click(screen.getByRole('button', { name: 'Log set' }))
  await screen.findByText('Set 2 of 4', undefined, SETTLE)

  deployNewVersion()

  // The set screen, and the in-memory progress through it, are exactly what a reload would
  // throw away.
  expect(screen.getByText('Set 2 of 4')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Start Workout A' })).toBeNull()
})

test('O5 an update found mid-session reloads nothing and activates no waiting worker', async () => {
  const user = userEvent.setup()
  render(<App />)
  await startWorkout(user, 'Workout A')
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  deployNewVersion()

  expect(nothingNavigated()).toBe(true)
  expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
})

test('O5 an update found mid-session offers the Update ready control', async () => {
  const user = userEvent.setup()
  render(<App />)
  await startWorkout(user, 'Workout A')
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  deployNewVersion()

  expect(await screen.findByRole('button', { name: 'Update ready' }, SETTLE)).toBeVisible()
})

test('O5 the Update ready control stays up as the session carries on', async () => {
  const user = userEvent.setup()
  render(<App />)
  await startWorkout(user, 'Workout A')
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  deployNewVersion()
  await screen.findByRole('button', { name: 'Update ready' }, SETTLE)

  await openExercise(user, 'Back squat')

  expect(await screen.findByText('Set 1 of 4', undefined, SETTLE)).toBeVisible()
  expect(updateControl()).toBeVisible()
})

test('O5 using the Update ready control lets the new version take over', async () => {
  const user = userEvent.setup()
  render(<App />)
  await startWorkout(user, 'Workout A')
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  deployNewVersion()

  await user.click(await screen.findByRole('button', { name: 'Update ready' }, SETTLE))

  expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(1)
  expect(pwa.updateServiceWorker.mock.calls[0][0]).not.toBe(false)
})
