// E22-T8 [O20 O21 O22]: the Last week card and the Body row on the Progress home.
// v7 (study §1.7): the Last week table is cut from Progress -- it repeated the weeks strip in a
// worse form. Each test keeps its title: it asserts the table is gone and that the week's numbers
// it used to print are still what the engine (`lastWeekCard`) gives for that week.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import { dayMonth } from '../../domain/stats/words'
import { lastWeekCard } from '../../domain/stats/weekCard'
import type { Weekday } from '../../domain/stats/weeks'
import { createServices } from '../../services'
import { db } from '../../storage/db'
import { setActiveProgramId, setWeekStart } from '../../storage/settingsStore'
import type { Session } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { Home } from './Home'
import type { ProgressPage } from './pages'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

const THU_15 = new Date(2026, 9, 15, 18, 5).getTime()
const MON_19 = new Date(2026, 9, 19, 9, 0).getTime()
const SETTLE = { timeout: 5000 }
const fixture = sessionsJson as unknown as Session[]
const catalog = loadCatalog()
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')!
const planOf = (id: string) => program.workouts.flatMap((w) => w.exercises).find((e) => e.exerciseId === id)

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

async function mount(sessions: Session[], now: number) {
  await db.sessions.bulkPut(sessions)
  await setActiveProgramId('assaf-ab-2026', now)
  const push = vi.fn<(page: ProgressPage) => void>()
  render(
    <ServicesProvider services={createServices({ now: () => now, storageAvailable: true })}>
      <Home page={{ kind: 'home' }} push={push} onBack={undefined} navigate={vi.fn()} now={() => now} />
    </ServicesProvider>,
  )
  return { push }
}

/** The page has drawn (its Body row), and it has no Last week table. */
async function noTable() {
  await waitFor(() => expect(screen.getByRole('button', { name: /^Body/ })).toBeTruthy(), SETTLE)
  expect(screen.queryByRole('region', { name: 'Last week' })).toBeNull()
  expect(document.querySelector('.progress-lastweek')).toBeNull()
}

const week = (sessions: Session[], now: number, weekStart: Weekday = 1) =>
  lastWeekCard(sessions, now, (id) => catalog.get(id), planOf, weekStart, [])!

/** `5 Oct` to `11 Oct`: the week's first and last day. */
const span = (card: { start: number; end: number }) => [dayMonth(card.start), dayMonth(card.end - 12 * 3600_000)]

describe('E22-T8 O20 the Last week card', () => {
  test('O20 reads the dates and four rows with their change on the week before', async () => {
    await mount(fixture, THU_15)
    await noTable()
    const card = week(fixture, THU_15)
    expect(span(card)).toEqual(['5 Oct', '11 Oct'])
    expect(card.last.sessions).toBe(3)
    expect(card.before.sessions).toBe(3)
    expect(card.last.sets).toBe(69)
    expect(card.before.sets).toBe(69)
    expect(Math.round(card.last.volumeKg)).toBe(15908)
    expect(Math.round(((card.last.volumeKg - card.before.volumeKg) / card.before.volumeKg) * 100)).toBe(-11)
  })

  test('O20 a drop in Sessions and Sets shows its signed difference', async () => {
    await mount(fixture, MON_19)
    await noTable()
    const card = week(fixture, MON_19)
    expect(span(card)).toEqual(['12 Oct', '18 Oct'])
    expect(card.last.sessions - card.before.sessions).toBe(-1)
    expect(card.last.sets - card.before.sets).toBe(-22)
    expect(Math.round(card.last.volumeKg)).toBe(11000)
    expect(Math.round(((card.last.volumeKg - card.before.volumeKg) / card.before.volumeKg) * 100)).toBe(-31)
  })

  test('O20 sits above This week', async () => {
    // v7: neither This week nor Last week is on Progress; the weeks strip sits above the ledger,
    // and the ledger above Muscles.
    await mount(fixture, THU_15)
    await noTable()
    expect(screen.queryByRole('region', { name: 'This week' })).toBeNull()
    const weeks = screen.getByRole('region', { name: 'Weeks' })
    const lifts = screen.getByRole('region', { name: 'Lifts' })
    expect(weeks.compareDocumentPosition(lifts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const muscles = screen.getByRole('button', { name: /^Muscles/ })
    expect(lifts.compareDocumentPosition(muscles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('O20 a first week on record says so instead of showing changes', async () => {
    const onlyLast = fixture.filter((s) => s.startedAt >= new Date(2026, 9, 12).getTime())
    await mount(onlyLast, MON_19)
    await noTable()
    expect(screen.queryByText('First week on record')).toBeNull()
    const card = week(onlyLast, MON_19)
    expect(card.before.sessions).toBe(0)
    expect(card.last.sessions).toBeGreaterThan(0)
  })

  test('O20 shows no card when neither week had a Session', async () => {
    const at = new Date(2026, 11, 14, 9).getTime()
    await mount(fixture, at)
    await noTable()
    expect(lastWeekCard(fixture, at, (id) => catalog.get(id), planOf, 1, [])).toBeNull()
  })
})

describe('E22-T8 O21 the trainee week', () => {
  test('O21 weekStart 6 on Mon 19 Oct covers Sat 10 to Fri 16 Oct', async () => {
    await setWeekStart(6, MON_19)
    await mount(fixture, MON_19)
    await noTable()
    expect(span(week(fixture, MON_19, 6))).toEqual(['10 Oct', '16 Oct'])
  })

  test('O21 with nothing stored it covers Mon 12 to Sun 18 Oct', async () => {
    await mount(fixture, MON_19)
    await noTable()
    expect(span(week(fixture, MON_19))).toEqual(['12 Oct', '18 Oct'])
  })
})

describe('E22-T8 O22 the Body row', () => {
  test('O22 shows the latest bodyweight and its date, and opens the Body page', async () => {
    await db.settings.put({
      key: 'bodyLog',
      value: [
        { day: '2026-10-01', weightKg: 80 },
        { day: '2026-10-15', weightKg: 78.5 },
      ],
      updatedAt: 1,
    })
    const { push } = await mount(fixture, THU_15)
    const body = await waitFor(() => screen.getByRole('button', { name: /78\.5 kg · 15 Oct/ }), SETTLE)
    fireEvent.click(body)
    expect(push).toHaveBeenCalledWith({ kind: 'body' })
  })

  test('O22 with an empty log it reads Log your bodyweight and still opens the Body page', async () => {
    const { push } = await mount(fixture.slice(0, 1), THU_15)
    const body = await waitFor(() => screen.getByRole('button', { name: /Log your bodyweight/ }), SETTLE)
    fireEvent.click(body)
    expect(push).toHaveBeenCalledWith({ kind: 'body' })
  })
})
