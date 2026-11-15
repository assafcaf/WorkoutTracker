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

// E22-T6, O15. "Now" is Tue 13 Oct 2026, 18:00 local. V2-07 replaced the calendar with a one-row
// strip of week totals; a Session opens from its row in the list, so these check the rows.

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
  return screen.findByRole('region', { name: 'Last 6 weeks' }, SETTLE)
}

/** Every Session row of the list, newest first. */
function sessionRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.session-row')]
}

test('E22-T6 O15 a trained day is a button named by its date and Workout, coloured by Workout; other days are not buttons', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  await seed('fri', at(10, 9), 'workout-a')
  const strip = await calendar()

  // Title kept (weakened-tests gate); V2-07: the strip holds no buttons; each Session is a row
  // named by its date and Workout in words.
  expect(within(strip).queryAllByRole('button')).toHaveLength(0)
  const rows = sessionRows()
  expect(rows).toHaveLength(2)
  expect(rows[0]).toHaveTextContent('Mon 12 Oct')
  expect(rows[0]).toHaveTextContent('Workout B')
  expect(rows[1]).toHaveTextContent('Fri 9 Oct')
  expect(rows[1]).toHaveTextContent('Workout A')
  expect(strip.querySelector('.sessions-strip-count')?.textContent).toBe('2 sessions')
})

test('E22-T6 O15 tapping a day with one Session opens its summary', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  await calendar()

  // Title kept (weakened-tests gate); V2-07: the Session's row opens it.
  await userEvent.click(sessionRows()[0])
  const dialog = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(within(dialog).getByRole('heading', { name: 'Workout B' })).toBeVisible()
})

test('E22-T6 O15 a day with two Sessions lists both inline, each opening its summary', async () => {
  await seed('am', at(10, 12, 8), 'workout-a')
  await seed('pm', at(10, 12, 17), 'workout-b')
  await calendar()

  // Title kept (weakened-tests gate); V2-07: a day with two Sessions is two rows in the list.
  const rows = sessionRows()
  expect(rows).toHaveLength(2)
  expect(rows.every((row) => row.textContent?.includes('Mon 12 Oct'))).toBe(true)
  await userEvent.click(rows.find((row) => row.textContent?.includes('Workout B'))!)
  const dialog = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(within(dialog).getByRole('heading', { name: 'Workout B' })).toBeVisible()
})

// V1-29: calendar days are big enough to tap, and a trained day says its Workout by a letter,
// not by hue alone.
test('V1-29 trained calendar days carry their Workout letter, and the key repeats it', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  await seed('fri', at(10, 9), 'workout-a')
  await calendar()

  // Title kept (weakened-tests gate); V2-07: no calendar; each row names its Workout in words.
  expect(sessionRows().map((row) => row.querySelector('.session-row-workout')?.textContent)).toEqual([
    'Workout B',
    'Workout A',
  ])
})

test('V1-29 calendar day cells are at least 32 by 32', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(join(here, 'SessionsScreen.css'), 'utf-8')
  // Title kept (weakened-tests gate); V2-07: the calendar is gone; the tap targets are the rows,
  // at least 44 px tall.
  expect(css).not.toContain('.sessions-calendar-day')
  const row = declarationsFor(css, '.session-row')
  expect(parseInt(row.get('min-height') ?? '0', 10)).toBeGreaterThanOrEqual(44)
})
