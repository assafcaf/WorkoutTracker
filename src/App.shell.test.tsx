// The app shell, end to end through App (DX-01, DX-04, DX-06, DX-09): four tabs -- Train,
// Sessions, Progress, Program -- with Train the launch screen; Settings and Exercises as pages
// pushed over Program that keep the tab bar; and the Live session -- full screen with no tabs,
// minimised to one strip above the tab bar on every tab, and back again exactly where it was.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test/renderApp'
import { db } from './storage/db'
import { getActiveSession } from './storage/sessionStore'
import { setActiveProgramId } from './storage/settingsStore'
import { FakeSyncServer } from './test/fakeSyncServer'
import type { Session } from './types'
import { finishWorkout } from './test/live'

vi.mock('virtual:pwa-register', () => ({
  registerSW() {
    return async () => {}
  },
}))

const SETTLE = { timeout: 3000 }

type User = ReturnType<typeof userEvent.setup>

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  await setActiveProgramId('assaf-ab-2026')
  vi.stubGlobal('fetch', new FakeSyncServer().fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mainNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Main' })
}

async function pressTab(user: User, name: string): Promise<void> {
  await user.click(within(mainNav()).getByRole('button', { name }))
}

/** DX-01: Train has loaded -- today's Workout and its Start are on screen. */
async function trainReady(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: /^Start Workout / }, SETTLE)
}

function liveStrip(): HTMLElement | null {
  return document.body.querySelector('.live-strip')
}

/** Starts Workout A, opens Back squat and logs its first set, landing on Set 2 of 4. */
async function logFirstBackSquatSet(user: User): Promise<void> {
  // Start opens Back squat's Set 1 on Now (V1-01).
  await user.click(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE))
  await user.click(await screen.findByRole('button', { name: /^Log set / }, SETTLE))
  await screen.findByText('Set 2 of 4', undefined, SETTLE)
}

test('DX-04 Settings opens from the Program tab\'s Settings row as a pushed page that keeps the tab bar', async () => {
  const user = userEvent.setup()
  await renderApp()
  await trainReady()
  // No gear anywhere but the Program tab's row.
  expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()

  await pressTab(user, 'Program')
  await user.click(await screen.findByRole('button', { name: /^Settings/ }, SETTLE))

  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' }, SETTLE)).toBeVisible()
  expect(within(mainNav()).getByRole('button', { name: 'Program' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'A/B Split' }, SETTLE)).toBeVisible()
})

test('each of the four tabs is titled in a large page header, Train by today\'s Workout', async () => {
  const user = userEvent.setup()
  await renderApp()
  await trainReady()
  expect(screen.getByRole('heading', { level: 1, name: 'Workout A' })).toHaveClass('page-header-title')

  for (const [name, title] of [['Sessions', 'Sessions'], ['Progress', 'Progress'], ['Program', 'A/B Split']]) {
    await pressTab(user, name)
    const heading = await screen.findByRole('heading', { level: 1, name: title }, SETTLE)
    expect(heading).toHaveClass('page-header-title')
    expect(within(mainNav()).getByRole('button', { name })).toHaveAttribute('aria-current', 'page')
  }
})

test('DX-04 the Program tab opens the exercise library from its Exercises row, a pushed page with the tab bar', async () => {
  const user = userEvent.setup()
  await renderApp()
  await trainReady()

  await pressTab(user, 'Program')
  expect(screen.queryByRole('radiogroup', { name: 'Program view' })).toBeNull()
  await user.click(await screen.findByRole('button', { name: 'Exercises' }, SETTLE))

  expect(await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)).toBeVisible()
  expect(within(mainNav()).getByRole('button', { name: 'Program' })).toHaveAttribute('aria-current', 'page')
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'A/B Split' }, SETTLE)).toBeVisible()
})

test('DX-06 a lift page pushed over Train keeps the tab bar and goes back with its chevron', async () => {
  const user = userEvent.setup()
  await renderApp()
  await trainReady()

  await user.click(screen.getByRole('button', { name: 'Back squat' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Back squat' }, SETTLE)).toBeVisible()
  expect(within(mainNav()).getByRole('button', { name: 'Train' })).toHaveAttribute('aria-current', 'page')
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(await trainReady()).toBeVisible()
})

test('a workout in progress is a full-screen Live session: no tab bar, a minimise chevron, the workout and Finish in its header', async () => {
  const user = userEvent.setup()
  await renderApp()

  await user.click(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE))
  await screen.findByText('Set 1 of 4', undefined, SETTLE)
  await user.click(screen.getByRole('radio', { name: 'All' }))
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  const header = document.body.querySelector('header.live-header') as HTMLElement
  expect(within(header).getByRole('button', { name: 'Minimise' })).toBeVisible()
  expect(within(header).getByRole('heading', { level: 1, name: 'Workout A' })).toBeVisible()
  expect(within(header).getByRole('timer', { name: 'Workout time' })).toBeVisible()
  expect(within(header).getByRole('button', { name: 'Finish' })).toHaveClass('btn-secondary')
  expect(within(header).getByRole('radio', { name: 'Set' })).toBeVisible()
})

test('Now on the exercise list opens the set the session is on', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)
  await user.click(screen.getByRole('radio', { name: 'All' }))
  await screen.findByRole('button', { name: /^Lunges/ }, SETTLE)

  await user.click(screen.getByRole('radio', { name: 'Set' }))

  expect(await screen.findByText('Set 2 of 4', undefined, SETTLE)).toBeVisible()
  expect(screen.getByRole('heading', { level: 1, name: 'Back squat' })).toBeVisible()
})

test('DX-09 minimising the Live session leaves one strip above the tab bar on every tab and Settings, and no other Resume', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)

  await user.click(screen.getByRole('button', { name: 'Minimise' }))

  // Train under the strip: the live Workout's Plans, and no Start.
  await screen.findByRole('list', { name: 'Workout A lifts' }, SETTLE)
  expect(screen.queryByRole('button', { name: /^Start / })).toBeNull()
  for (const [name, title] of [['Sessions', 'Sessions'], ['Progress', 'Progress'], ['Program', 'A/B Split'], ['Train', 'Workout A']]) {
    await pressTab(user, name)
    await screen.findByRole('heading', { level: 1, name: title }, SETTLE)
    const strip = liveStrip()
    expect(strip, `no live strip on ${name}`).not.toBeNull()
    expect(strip).toHaveTextContent(/Workout A/)
    expect(within(strip as HTMLElement).getByRole('timer', { name: 'Workout time' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: /^Resume/ }), `one Resume on ${name}`).toHaveLength(1)
  }
  await pressTab(user, 'Program')
  await user.click(await screen.findByRole('button', { name: /^Settings/ }, SETTLE))
  await screen.findByRole('heading', { level: 1, name: 'Settings' }, SETTLE)
  expect(liveStrip()).not.toBeNull()
  // Minimised is not ended.
  expect(await getActiveSession()).not.toBeNull()
})

test('the live strip shows the rest countdown after a logged set', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)

  await user.click(screen.getByRole('button', { name: 'Minimise' }))

  // Back squat rests 3:00 after a set; the countdown has only just started.
  await waitFor(() => expect(liveStrip()).toHaveTextContent(/Rest [23]:\d\d/), SETTLE)
})

test('Resume on the live strip brings the Live session back on the same set', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)
  await user.click(screen.getByRole('button', { name: 'Minimise' }))
  await screen.findByRole('button', { name: 'Resume Workout A' }, SETTLE)
  await pressTab(user, 'Sessions')

  await user.click(screen.getByRole('button', { name: 'Resume Workout A' }))

  expect(await screen.findByText('Set 2 of 4', undefined, SETTLE)).toBeVisible()
  expect(screen.getByRole('heading', { level: 1, name: 'Back squat' })).toBeVisible()
  expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  expect(liveStrip()).toBeNull()
})

test('a tap anywhere on the live strip returns to the Live session', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)
  await user.click(screen.getByRole('button', { name: 'Minimise' }))
  // DX-09: the strip is the way back.
  await screen.findByRole('button', { name: 'Resume Workout A' }, SETTLE)

  await user.click(liveStrip()?.querySelector('.live-strip-text') as HTMLElement)

  expect(await screen.findByText('Set 2 of 4', undefined, SETTLE)).toBeVisible()
})

test('finishing a session returned to from another tab lands on Train under its summary', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)
  await user.click(screen.getByRole('button', { name: 'Minimise' }))
  // DX-09: the strip is the way back.
  await screen.findByRole('button', { name: 'Resume Workout A' }, SETTLE)
  await pressTab(user, 'Progress')
  await user.click(screen.getByRole('button', { name: 'Resume Workout A' }))
  await screen.findByText('Set 2 of 4', undefined, SETTLE)

  await finishWorkout(user)

  expect(await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)).toBeVisible()
  expect(within(mainNav()).getByRole('button', { name: 'Train' })).toHaveAttribute('aria-current', 'page')
  expect(liveStrip()).toBeNull()
  expect(await getActiveSession()).toBeNull()
})

test('DX-09 the strip\'s Resume while minimised returns to the same set', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)
  await user.click(screen.getByRole('button', { name: 'Minimise' }))

  await user.click(await screen.findByRole('button', { name: 'Resume Workout A' }, SETTLE))

  expect(await screen.findByText('Set 2 of 4', undefined, SETTLE)).toBeVisible()
})

test('the tab bar reads Train, Sessions, Progress, Program, and Progress opens its own home page', async () => {
  const user = userEvent.setup()
  await renderApp()
  await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)

  const names = within(mainNav())
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'))
  expect(names).toEqual(['Train', 'Sessions', 'Progress', 'Program'])

  await pressTab(user, 'Progress')
  expect(await screen.findByRole('heading', { level: 1, name: 'Progress' }, SETTLE)).toBeVisible()
  expect(within(mainNav()).getByRole('button', { name: 'Progress' })).toHaveAttribute('aria-current', 'page')
})

test('Progress to a lift to a Session is two taps, and Back returns each step', async () => {
  const sessions = JSON.parse(
    readFileSync(join(process.cwd(), 'src/test/fixtures/stats/sessions.json'), 'utf8'),
  ) as Session[]
  await db.sessions.bulkPut(sessions)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 18, 5))
  try {
    const user = userEvent.setup()
    await renderApp()
    // DX-01: the app opens on Train, today's Workout.
    await screen.findByRole('button', { name: /^Start Workout [AB]/ }, SETTLE)

    await pressTab(user, 'Progress')
    const rows = await screen.findAllByRole('button', { name: /Push-ups/ }, SETTLE)
    await user.click(rows[0])
    // v6: the Lift page's session log opens a Session (the "Last moved" link is cut).
    const log = await screen.findByRole('list', { name: 'Sessions' }, SETTLE)
    const lastMoved = within(log).getAllByRole('button')[0]

    await user.click(lastMoved)
    // DX-14: Session detail has a header Back, no bottom Done bar.
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
    const back = await screen.findByRole('button', { name: 'Back' }, SETTLE)
    expect(back).toBeVisible()
    await user.click(back)
    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions' }, SETTLE)).toBeVisible()
  } finally {
    vi.useRealTimers()
  }
})

test('DX-06 Session detail is a pushed page with the tab bar and a bare ‹; its editor is full screen with Cancel and Save', async () => {
  const at = Date.now() - 2 * 24 * 3600_000
  const done: Session = {
    id: 'past-a',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: at,
    finishedAt: at + 60 * 60_000,
    entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 8, loggedAt: at + 60_000 }],
  }
  await db.sessions.put(done)
  const user = userEvent.setup()
  await renderApp()
  await trainReady()

  await pressTab(user, 'Sessions')
  const rows = await screen.findAllByRole('button', { name: /Workout A/ }, SETTLE)
  await user.click(rows.find((row) => row.classList.contains('session-row')) as HTMLElement)
  expect(await screen.findByRole('heading', { level: 1, name: 'Session' }, SETTLE)).toBeVisible()
  expect(within(mainNav()).getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'Back' }).textContent).toBe('')

  await user.click(screen.getByRole('button', { name: 'Edit session' }))
  expect(await screen.findByRole('button', { name: 'Save' }, SETTLE)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
  expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
})
