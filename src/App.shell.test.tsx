// The Progress Dashboard's app shell, end to end through App: four tabs, Settings as a page off
// the Dashboard's gear, the Program tab's Program | Exercises switch, and the Live session --
// full screen with no tabs, minimised to a live strip pinned over every tab, and back again
// exactly where it was.
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

function liveStrip(): HTMLElement | null {
  return document.body.querySelector('.live-strip')
}

/** Starts Workout A, opens Back squat and logs its first set, landing on Set 2 of 4. */
async function logFirstBackSquatSet(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE))
  await user.click(await screen.findByRole('button', { name: /^Back squat/ }, SETTLE))
  await user.click(await screen.findByRole('button', { name: 'Log set' }, SETTLE))
  await screen.findByText('Set 2 of 4', undefined, SETTLE)
}

test('the Dashboard header carries a Settings gear that opens Settings as a full-screen page with a back chevron', async () => {
  const user = userEvent.setup()
  await renderApp()
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Settings' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' }, SETTLE)).toBeVisible()
  expect(mainNav()).toBeVisible()
})

test('each of the four tabs is titled for itself in a large page header', async () => {
  const user = userEvent.setup()
  await renderApp()
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' }, SETTLE)

  for (const name of ['Progress', 'Sessions', 'Program']) {
    await pressTab(user, name)
    const title = await screen.findByRole('heading', { level: 1, name }, SETTLE)
    expect(title).toHaveClass('page-header-title')
    expect(within(mainNav()).getByRole('button', { name })).toHaveAttribute('aria-current', 'page')
  }
})

test('the Program tab switches between the program and the exercise library', async () => {
  const user = userEvent.setup()
  await renderApp()
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' }, SETTLE)

  await pressTab(user, 'Program')
  const side = await screen.findByRole('radiogroup', { name: 'Program view' }, SETTLE)
  expect(within(side).getByRole('radio', { name: 'Program' })).toBeChecked()

  await user.click(within(side).getByRole('radio', { name: 'Exercises' }))

  expect(await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)).toBeVisible()
  expect(within(mainNav()).getByRole('button', { name: 'Program' })).toHaveAttribute('aria-current', 'page')
})

test('a workout in progress is a full-screen Live session: no tab bar, a minimise chevron, the workout and Finish in its header', async () => {
  const user = userEvent.setup()
  await renderApp()

  await user.click(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE))
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  const header = document.body.querySelector('header.live-header') as HTMLElement
  expect(within(header).getByRole('button', { name: 'Minimise' })).toBeVisible()
  expect(within(header).getByRole('heading', { level: 1, name: 'Workout A' })).toBeVisible()
  expect(within(header).getByRole('timer', { name: 'Workout time' })).toBeVisible()
  expect(within(header).getByRole('button', { name: 'Finish' })).toHaveClass('btn-secondary')
  expect(within(header).getByRole('radio', { name: 'All' })).toBeChecked()
})

test('Now on the exercise list opens the set the session is on', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)
  await user.click(screen.getByRole('radio', { name: 'All' }))
  await screen.findByRole('button', { name: /^Lunges/ }, SETTLE)

  await user.click(screen.getByRole('radio', { name: 'Now' }))

  expect(await screen.findByText('Set 2 of 4', undefined, SETTLE)).toBeVisible()
  expect(screen.getByRole('heading', { level: 1, name: 'Back squat' })).toBeVisible()
})

test('minimising the Live session pins a live strip naming the workout over every tab and the Settings page', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)

  await user.click(screen.getByRole('button', { name: 'Minimise' }))

  await screen.findByRole('heading', { level: 1, name: 'Dashboard' }, SETTLE)
  for (const name of ['Progress', 'Sessions', 'Program', 'Train']) {
    await pressTab(user, name)
    await screen.findByRole('heading', { level: 1, name: name === 'Train' ? 'Dashboard' : name }, SETTLE)
    const strip = liveStrip()
    expect(strip, `no live strip on ${name}`).not.toBeNull()
    expect(strip).toHaveTextContent(/Workout A/)
    expect(within(strip as HTMLElement).getByRole('timer', { name: 'Workout time' })).toBeVisible()
  }
  await user.click(screen.getByRole('button', { name: 'Settings' }))
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

test('Return on the live strip brings the Live session back on the same set', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)
  await user.click(screen.getByRole('button', { name: 'Minimise' }))
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' }, SETTLE)
  await pressTab(user, 'Sessions')

  await user.click(screen.getByRole('button', { name: 'Return to Workout A' }))

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
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' }, SETTLE)

  await user.click(liveStrip()?.querySelector('.live-strip-text') as HTMLElement)

  expect(await screen.findByText('Set 2 of 4', undefined, SETTLE)).toBeVisible()
})

test('finishing a session returned to from another tab lands on the Dashboard under its summary', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)
  await user.click(screen.getByRole('button', { name: 'Minimise' }))
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' }, SETTLE)
  await pressTab(user, 'Progress')
  await user.click(screen.getByRole('button', { name: 'Return to Workout A' }))
  await screen.findByText('Set 2 of 4', undefined, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Finish' }))

  expect(await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)).toBeVisible()
  expect(within(mainNav()).getByRole('button', { name: 'Train' })).toHaveAttribute('aria-current', 'page')
  expect(liveStrip()).toBeNull()
  expect(await getActiveSession()).toBeNull()
})

test('Resume on the Dashboard while minimised returns to the same set', async () => {
  const user = userEvent.setup()
  await renderApp()
  await logFirstBackSquatSet(user)
  await user.click(screen.getByRole('button', { name: 'Minimise' }))

  await user.click(await screen.findByRole('button', { name: 'Resume Workout A' }, SETTLE))

  expect(await screen.findByText('Set 2 of 4', undefined, SETTLE)).toBeVisible()
})

test('the tab bar reads Train, Progress, Sessions, Program, and Progress opens its own home page', async () => {
  const user = userEvent.setup()
  await renderApp()
  await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)

  const names = within(mainNav())
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'))
  expect(names).toEqual(['Train', 'Progress', 'Sessions', 'Program'])

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
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' }, SETTLE)

    await pressTab(user, 'Progress')
    const rows = await screen.findAllByRole('button', { name: /Push-ups/ }, SETTLE)
    await user.click(rows[0])
    const lastMoved = await screen.findByRole('button', { name: /^Last moved/ }, SETTLE)

    await user.click(lastMoved)
    const done = await screen.findByRole('button', { name: 'Done' }, SETTLE)
    expect(done).toBeVisible()
    await user.click(done)
    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions' }, SETTLE)).toBeVisible()
  } finally {
    vi.useRealTimers()
  }
})
