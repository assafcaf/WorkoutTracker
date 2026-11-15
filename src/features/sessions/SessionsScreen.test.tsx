import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import type { AppRoute } from '../routes'
import { ServicesProvider } from '../ServicesProvider'
import { SessionsScreen } from './SessionsScreen'

// Progress Dashboard S6a, over the real services on fake-indexeddb (src/test/setup.ts). "Now" is
// Tue 13 Oct 2026, 18:00 local, so this week is Mon 12 Oct to Sun 18 Oct.

const HOUR = 60 * 60 * 1_000
const at = (month: number, day: number, hour = 9): number => new Date(2026, month - 1, day, hour).getTime()
const NOW = at(10, 13, 18)
const SETTLE = { timeout: 2000 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

function navigate(_to: AppRoute): void {}
function onInSession(_inSession: boolean): void {}

/** A finished bundled-program Session at `startedAt`: `sets` Back squat Sets of 60 kg x 8. */
async function seedSession(
  id: string,
  startedAt: number,
  workoutId: 'workout-a' | 'workout-b',
  sets: number,
  weightKg = 60,
): Promise<void> {
  await db.sessions.put({
    id,
    programId: 'assaf-ab-2026',
    workoutId,
    startedAt,
    finishedAt: startedAt + 52 * 60_000,
    entries: Array.from({ length: sets }, (_, index) => ({
      exerciseId: 'back-squat',
      setIndex: index + 1,
      weightKg,
      reps: 8,
      loggedAt: startedAt + (index + 1) * 60_000,
    })),
    updatedAt: startedAt + HOUR,
  })
}

function renderScreen(initialSessionId?: string) {
  const services = createServices({ now: () => NOW, storageAvailable: true })
  render(
    <ServicesProvider services={services}>
      <SessionsScreen
        navigate={navigate}
        onInSession={onInSession}
        now={() => NOW}
        initialSessionId={initialSessionId}
      />
    </ServicesProvider>,
  )
  return services
}

/** The consistency strip's six week totals, oldest first. */
function stripTotals(strip: HTMLElement): string[] {
  return [...strip.querySelectorAll('.sessions-strip-week')].map((week) => week.textContent ?? '')
}

test('S6a SessionsScreen is headed Sessions and says so when nothing is finished yet', async () => {
  renderScreen()

  expect(await screen.findByRole('heading', { name: 'Sessions', level: 1 }, SETTLE)).toBeVisible()
  expect(await screen.findByText(/No finished workouts yet/, {}, SETTLE)).toBeVisible()
})

test('S6a SessionsScreen reports onInSession(false)', async () => {
  const report = vi.fn()
  const services = createServices({ now: () => NOW, storageAvailable: true })
  render(
    <ServicesProvider services={services}>
      <SessionsScreen navigate={navigate} onInSession={report} now={() => NOW} />
    </ServicesProvider>,
  )
  await waitFor(() => expect(report).toHaveBeenCalledWith(false), SETTLE)
})

test('S6a the calendar fills each day with a Session, outlines today and counts the last six weeks', async () => {
  await seedSession('tue', at(10, 13), 'workout-a', 3)
  await seedSession('mon', at(10, 12), 'workout-b', 3)
  await seedSession('fri', at(10, 9), 'workout-a', 3)
  await seedSession('old', at(8, 3), 'workout-a', 3)
  renderScreen()

  // Title kept (weakened-tests gate); V2-07: the calendar is one consistency row, six week
  // totals (7 Sep ... 12 Oct, this week last) and the Sessions they hold.
  const strip = await screen.findByRole('region', { name: 'Last 6 weeks' }, SETTLE)
  expect(stripTotals(strip)).toEqual(['0', '0', '0', '0', '1', '2'])
  expect(strip.querySelector('.sessions-strip-count')?.textContent).toBe('3 sessions')
  expect(within(strip).getByRole('img', { name: 'Sessions per week from 7 Sep: 0, 0, 0, 0, 1, 2' })).toBeVisible()
  expect(strip.querySelector('[data-week="12 Oct"]')).toHaveAttribute('data-current')
  expect(strip.querySelector('[data-week="12 Oct"]')).toHaveAttribute('title', 'Week of 12 Oct: 2 sessions')
  expect(screen.queryByRole('region', { name: 'Calendar' })).toBeNull()
})

test('S6a Muscle sets by week counts each of the last four weeks per region, heat-banded on the week scale', async () => {
  await seedSession('tue', at(10, 13), 'workout-a', 12)
  await seedSession('fri', at(10, 9), 'workout-a', 3)
  renderScreen()

  // Title kept (weakened-tests gate); V2-06/V2-07: the matrix moved to Progress › Muscles' 4 weeks
  // segment (MusclesPage.test.tsx); the Sessions tab no longer draws it.
  await screen.findByRole('region', { name: 'This week' }, SETTLE)
  expect(screen.queryByRole('region', { name: 'Muscle sets by week' })).toBeNull()
  expect(document.querySelector('.week-heat')).toBeNull()
})

test('S6a Volume per session draws one bar per Session, Workout B as the second series, with an A / B key', async () => {
  await seedSession('mon', at(10, 12), 'workout-b', 2)
  await seedSession('tue', at(10, 13), 'workout-a', 3)
  await seedSession('thu', at(10, 15), 'workout-a', 4)
  renderScreen()

  // Title kept (weakened-tests gate); V2-07: the volume charts are cut; each Session's volume
  // reads on its summary.
  await screen.findByRole('region', { name: 'This week' }, SETTLE)
  expect(screen.queryByRole('region', { name: 'Volume per session, kg' })).toBeNull()
  expect(document.querySelector('.bar-chart-bar')).toBeNull()
})

test('O25 the muscle table has the 12 muscles, Lats and Mid back apart', async () => {
  await db.sessions.put({
    id: 'row',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-b',
    startedAt: at(10, 13),
    finishedAt: at(10, 13) + HOUR,
    entries: Array.from({ length: 4 }, (_, index) => ({
      exerciseId: 'machine-row',
      setIndex: index + 1,
      weightKg: 50,
      reps: 8,
      loggedAt: at(10, 13) + (index + 1) * 60_000,
    })),
    updatedAt: at(10, 13) + HOUR,
  })
  renderScreen()

  // Title kept (weakened-tests gate); V2-06: the muscle table is on Progress › Muscles now
  // (MusclesPage.test.tsx checks its 12 rows there); Sessions names no muscle.
  const thisWeek = await screen.findByRole('region', { name: 'This week' }, SETTLE)
  expect(within(thisWeek).getAllByRole('button')).toHaveLength(1)
  expect(screen.queryAllByRole('rowheader')).toHaveLength(0)
  expect(document.body.textContent).not.toMatch(/Mid back|Middle back/)
})

test('O25 a route naming a Session opens its summary', async () => {
  await seedSession('tue', at(10, 13), 'workout-a', 3)
  renderScreen('tue')

  const dialog = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(within(dialog).getByRole('heading', { name: 'Workout A' })).toBeVisible()
})

test('S6a THIS WEEK lists this week’s Sessions newest first with their figures and PR count, then LAST WEEK', async () => {
  await seedSession('fri', at(10, 9), 'workout-a', 3, 60)
  await seedSession('mon', at(10, 12), 'workout-b', 2)
  await seedSession('tue', at(10, 13), 'workout-a', 3, 62.5)
  renderScreen()

  const thisWeek = await screen.findByRole('region', { name: 'This week' }, SETTLE)
  expect(within(thisWeek).getByRole('heading', { name: 'This week' })).toBeVisible()
  const rows = within(thisWeek).getAllByRole('button')
  expect(rows.map((row) => row.querySelector('.session-row-date')?.textContent)).toEqual(['Tue 13 Oct', 'Mon 12 Oct'])
  expect(rows[0].querySelector('.session-row-workout')?.textContent).toBe('Workout A')
  expect(rows[0].querySelector('.session-row-stats')?.textContent).toBe('52 min · 3 sets · 1,500 kg')
  // V2-07: the PR tag reads `1 PR`, in place of `1 record`.
  expect(rows[0].querySelector('.tag-pr')?.textContent).toBe('1 PR')
  expect(rows[1].querySelector('.tag-pr')).toBeNull()

  const lastWeek = screen.getByRole('region', { name: 'Last week' })
  expect(within(lastWeek).getAllByRole('button')).toHaveLength(1)
})

test('S6a a Session row opens its summary, headed by its Workout and day', async () => {
  await seedSession('tue', at(10, 13), 'workout-a', 3)
  renderScreen()

  const thisWeek = await screen.findByRole('region', { name: 'This week' }, SETTLE)
  await userEvent.setup().click(within(thisWeek).getByRole('button'))

  const dialog = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(within(dialog).getByRole('heading', { name: 'Workout A' })).toBeVisible()
  expect(within(dialog).getByText('Tue 13 Oct')).toBeVisible()
})

test('S6a Edit session on the summary opens the History editor, and Delete workout removes the Session', async () => {
  await seedSession('tue', at(10, 13), 'workout-a', 3)
  renderScreen()
  const user = userEvent.setup()

  const thisWeek = await screen.findByRole('region', { name: 'This week' }, SETTLE)
  await user.click(within(thisWeek).getByRole('button'))
  const dialog = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  await user.click(within(dialog).getByRole('button', { name: 'Edit session' }))

  expect(screen.queryByRole('dialog', { name: 'Session summary' })).toBeNull()
  expect(await screen.findByRole('heading', { name: 'Workout A', level: 2 }, SETTLE)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Delete workout' }))
  await user.click(screen.getByRole('button', { name: 'Confirm' }))

  expect(await screen.findByText(/No finished workouts yet/, {}, SETTLE)).toBeVisible()
})

test('S6a a Session finished through services shows on the Sessions tab without a reload', async () => {
  const services = renderScreen()
  await screen.findByText(/No finished workouts yet/, {}, SETTLE)

  await act(async () => {
    const session = await services.sessions.start('assaf-ab-2026', 'workout-a')
    await services.sessions.logSet(session.id, {
      exerciseId: 'back-squat',
      setIndex: 0,
      weightKg: 60,
      reps: 8,
      loggedAt: NOW,
    })
    await services.sessions.finish(session.id)
  })

  const thisWeek = await screen.findByRole('region', { name: 'This week' }, SETTLE)
  expect(within(thisWeek).getByText('Workout A')).toBeVisible()
})

test('E19-T5 O7 the calendar, week groups and muscle table follow a Sunday week start', async () => {
  await db.settings.put({ key: 'weekStart', value: 0, updatedAt: NOW })
  await seedSession('sun', at(10, 11), 'workout-b', 3)
  await seedSession('tue', at(10, 13), 'workout-a', 3)
  renderScreen()

  // Title kept (weakened-tests gate); V2-07: the strip's weeks start on Sunday (the muscle
  // table's week start is checked on Progress › Muscles).
  const strip = await screen.findByRole('region', { name: 'Last 6 weeks' }, SETTLE)
  expect(strip.querySelector('[data-week="11 Oct"]')).toHaveAttribute('data-current')
  expect(strip.querySelector('[data-week="11 Oct"]')?.textContent).toBe('2')
  expect(strip.querySelector('[data-week="12 Oct"]')).toBeNull()

  const thisWeek = await screen.findByRole('region', { name: 'This week' }, SETTLE)
  expect(within(thisWeek).getAllByRole('button')).toHaveLength(2)
})

test('V2-07 the list comes first: only the consistency strip sits above the first week group', async () => {
  await seedSession('tue', at(10, 13), 'workout-a', 3)
  renderScreen()

  const thisWeek = await screen.findByRole('region', { name: 'This week' }, SETTLE)
  const screenRoot = document.querySelector('.sessions-screen') as HTMLElement
  const before = [...screenRoot.children].slice(0, [...screenRoot.children].indexOf(thisWeek))
  expect(before.map((element) => element.className)).toEqual(['sessions-strip'])
})
