import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { SessionsScreen } from './SessionsScreen'
import { declarationsFor } from '../../test/cssAudit'

// E22-T6, O15. "Now" is Tue 13 Oct 2026, 18:00 local.

const at = (month: number, day: number, hour = 9): number => new Date(2026, month - 1, day, hour).getTime()
const NOW = at(10, 13, 18)
const SETTLE = { timeout: 2000 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

async function seed(id: string, startedAt: number, workoutId: 'workout-a' | 'workout-b'): Promise<void> {
  await db.sessions.put({
    id,
    programId: 'assaf-ab-2026',
    workoutId,
    startedAt,
    finishedAt: startedAt + 3_000_000,
    entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 8, loggedAt: startedAt + 60_000 }],
    updatedAt: startedAt + 3_600_000,
  })
}

async function calendar(): Promise<HTMLElement> {
  render(
    <ServicesProvider services={createServices({ now: () => NOW, storageAvailable: true })}>
      <SessionsScreen navigate={() => {}} onInSession={() => {}} now={() => NOW} />
    </ServicesProvider>,
  )
  return screen.findByRole('region', { name: 'Calendar' }, SETTLE)
}

test('E22-T6 O15 a trained day is a button named by its date and Workout, coloured by Workout; other days are not buttons', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  await seed('fri', at(10, 9), 'workout-a')
  const cal = await calendar()

  expect(within(cal).getAllByRole('button')).toHaveLength(2)
  const a = within(cal).getByRole('button', { name: 'Fri 9 Oct: Workout A' })
  const b = within(cal).getByRole('button', { name: 'Mon 12 Oct: Workout B' })
  expect(a.getAttribute('data-workout')).not.toBe(b.getAttribute('data-workout'))
  expect(cal.querySelectorAll('.sessions-calendar-grid .sessions-calendar-day')).toHaveLength(42)
  expect(within(cal).getByRole('group', { name: 'Last 6 weeks: 2 sessions' })).toBeVisible()
  // The key lists each Workout shown.
  const key = cal.querySelector('.sessions-calendar-side') as HTMLElement
  expect(within(key).getByText('Workout A')).toBeVisible()
  expect(within(key).getByText('Workout B')).toBeVisible()
})

test('E22-T6 O15 tapping a day with one Session opens its summary', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  const cal = await calendar()

  await userEvent.click(within(cal).getByRole('button', { name: 'Mon 12 Oct: Workout B' }))
  const dialog = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(within(dialog).getByRole('heading', { name: 'Workout B' })).toBeVisible()
})

test('E22-T6 O15 a day with two Sessions lists both inline, each opening its summary', async () => {
  await seed('am', at(10, 12, 8), 'workout-a')
  await seed('pm', at(10, 12, 17), 'workout-b')
  const cal = await calendar()

  await userEvent.click(within(cal).getByRole('button', { name: /Mon 12 Oct/ }))
  expect(screen.queryByRole('dialog', { name: 'Session summary' })).toBeNull()
  const list = screen.getByRole('list', { name: 'Mon 12 Oct' })
  expect(within(list).getAllByRole('button')).toHaveLength(2)
  await userEvent.click(within(list).getByRole('button', { name: /Workout B/ }))
  const dialog = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(within(dialog).getByRole('heading', { name: 'Workout B' })).toBeVisible()
})

// V1-29: calendar days are big enough to tap, and a trained day says its Workout by a letter,
// not by hue alone.
test('V1-29 trained calendar days carry their Workout letter, and the key repeats it', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  await seed('fri', at(10, 9), 'workout-a')
  const cal = await calendar()

  expect(within(cal).getByRole('button', { name: 'Fri 9 Oct: Workout A' })).toHaveTextContent(/^A$/)
  expect(within(cal).getByRole('button', { name: 'Mon 12 Oct: Workout B' })).toHaveTextContent(/^B$/)
  const key = cal.querySelector('.sessions-calendar-side') as HTMLElement
  expect(key).toHaveTextContent(/A\s*Workout A/)
  expect(key).toHaveTextContent(/B\s*Workout B/)
})

test('V1-29 calendar day cells are at least 32 by 32', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(join(here, 'SessionsScreen.css'), 'utf-8')
  const day = declarationsFor(css, '.sessions-calendar-day')
  expect(parseInt(day.get('width') ?? '0', 10)).toBeGreaterThanOrEqual(32)
  expect(parseInt(day.get('height') ?? '0', 10)).toBeGreaterThanOrEqual(32)
  const columns = declarationsFor(css, '.sessions-calendar-grid').get('grid-template-columns') ?? ''
  expect(columns).toMatch(/repeat\(7, (3[2-9]|[4-9]\d)px\)/)
})
