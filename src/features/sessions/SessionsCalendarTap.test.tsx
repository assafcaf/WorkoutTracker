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
// strip of week totals; V3-09 brought the six-week calendar back as a static picture. V5: each
// Session day is a button into its Session again (the owner could not enter a workout from the
// calendar); a day with two Sessions opens a chooser. A Session still opens from its row too.

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

  // Title kept (weakened-tests gate); V5: a trained day is a button again, named by its Workout
  // and date, coloured by Workout; empty days are not buttons. Each week row still names its
  // Sessions, and each Session is a row of the list named by its date and Workout in words.
  const days = within(strip).getAllByRole('button')
  expect(days.map((day) => day.getAttribute('aria-label'))).toEqual(['Workout A, Fri 9 Oct', 'Workout B, Mon 12 Oct'])
  expect(days.every((day) => day.classList.contains('calendar-day'))).toBe(true)
  expect(strip.querySelectorAll('span.calendar-day')).toHaveLength(42 - 2)
  expect(within(strip).getByRole('group', { name: 'Week of 5 Oct: Workout A Fri' })).toBeVisible()
  expect(strip.querySelector('.calendar-day[data-workout="pull"]')?.textContent).toBe('B')
  const rows = sessionRows()
  expect(rows).toHaveLength(2)
  expect(rows[0]).toHaveTextContent('Mon 12 Oct')
  expect(rows[0]).toHaveTextContent('Workout B')
  expect(rows[1]).toHaveTextContent('Fri 9 Oct')
  expect(rows[1]).toHaveTextContent('Workout A')
  expect(strip.querySelector('.sessions-calendar-head')?.textContent).toBe('Last 6 weeks · 2 sessions')
})

test('E22-T6 O15 tapping a day with one Session opens its summary', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  await calendar()

  // Title kept (weakened-tests gate); V5: the calendar day opens it, as its row does.
  await userEvent.click(screen.getByRole('button', { name: 'Workout B, Mon 12 Oct' }))
  const dialog = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(within(dialog).getByRole('heading', { name: 'Workout B' })).toBeVisible()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
  await userEvent.click(sessionRows()[0])
  expect(await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)).toBeVisible()
})

test('E22-T6 O15 a day with two Sessions lists both inline, each opening its summary', async () => {
  await seed('am', at(10, 12, 8), 'workout-a')
  await seed('pm', at(10, 12, 17), 'workout-b')
  await calendar()

  // Title kept (weakened-tests gate); V2-07: a day with two Sessions is two rows in the list.
  // V5: its calendar day is one button naming both, opening a chooser of the two.
  const rows = sessionRows()
  expect(rows).toHaveLength(2)
  expect(rows.every((row) => row.textContent?.includes('Mon 12 Oct'))).toBe(true)
  await userEvent.click(screen.getByRole('button', { name: 'Workout A and Workout B, Mon 12 Oct' }))
  const chooser = await screen.findByRole('dialog', { name: 'Mon 12 Oct' }, SETTLE)
  expect(within(chooser).getAllByRole('button').map((option) => option.textContent)).toEqual([
    'Workout A · 08:00',
    'Workout B · 17:00',
  ])
  await userEvent.click(within(chooser).getByRole('button', { name: 'Workout B · 17:00' }))
  const dialog = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(within(dialog).getByRole('heading', { name: 'Workout B' })).toBeVisible()
  expect(screen.queryByRole('dialog', { name: 'Mon 12 Oct' })).toBeNull()
})

// V1-29: calendar days are big enough to tap, and a trained day says its Workout by a letter,
// not by hue alone.
test('V1-29 trained calendar days carry their Workout letter, and the key repeats it', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  await seed('fri', at(10, 9), 'workout-a')
  await calendar()

  // Title kept (weakened-tests gate); V3-09: the calendar's cells carry the letter (no key: the
  // letters carry it), and each row names its Workout in words.
  const strip = document.querySelector('.sessions-calendar') as HTMLElement
  expect([...strip.querySelectorAll('.calendar-day[data-workout]')].map((day) => day.textContent)).toEqual(['A', 'B'])
  expect(sessionRows().map((row) => row.querySelector('.session-row-workout')?.textContent)).toEqual([
    'Workout B',
    'Workout A',
  ])
})

test('V1-29 calendar day cells are at least 32 by 32', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(join(here, 'SessionsScreen.css'), 'utf-8')
  // Title kept (weakened-tests gate); V3-09 kept the shared cell compact at 1.75rem (Train's
  // strip, src/ui/CalendarWeek.css). V5: Sessions' days are tap targets again, so its calendar
  // draws them 2rem (32 px) tall; the rows stay at least 44 px tall.
  const cells = readFileSync(join(here, '..', '..', 'ui', 'CalendarWeek.css'), 'utf-8')
  expect(declarationsFor(cells, '.calendar-day').get('height')).toBe('1.75rem')
  expect(declarationsFor(css, '.sessions-calendar .calendar-day').get('height')).toBe('2rem')
  expect(css).not.toContain('.sessions-calendar-day')
  const row = declarationsFor(css, '.session-row')
  expect(parseInt(row.get('min-height') ?? '0', 10)).toBeGreaterThanOrEqual(44)

})

test('DX-18 a calendar day button\'s hit area fills its 48 px tall cell, its coloured cell drawn as before', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(join(here, 'SessionsScreen.css'), 'utf-8')
  // The coloured cell keeps its 2rem; the button's hit area reaches 48 px tall around it: 8 px over
  // and under (2rem + 16 px), and 2 px into each 4 px gap of a column at least 40 px wide.
  expect(declarationsFor(css, '.sessions-calendar .calendar-day').get('height')).toBe('2rem')
  const hit = declarationsFor(css, '.sessions-calendar button.calendar-day::before')
  expect(hit.get('content')).toBe("''")
  expect(hit.get('position')).toBe('absolute')
  expect(hit.get('inset')).toBe('calc((2rem - 48px) / 2) -2px')
  // Rows are 48 px apart at least, so the hit areas of two weeks never overlap.
  expect(declarationsFor(css, '.sessions-calendar-row').get('min-height')).toBe('48px')
  // The day columns get the width: the week label narrows, the calendar's side padding thins.
  expect(declarationsFor(css, '.sessions-calendar-row').get('grid-template-columns')).toBe('2.5rem minmax(0, 1fr)')
  expect(declarationsFor(css, '.sessions-calendar').get('padding')).toBe('var(--space-3) var(--space-1)')
})
