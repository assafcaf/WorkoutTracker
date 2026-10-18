// E22-T8 [O20 O21 O22]: the Last week card and the Body row on the Progress home.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
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

const card = () => waitFor(() => screen.getByRole('region', { name: 'Last week' }), SETTLE)
const row = (c: HTMLElement, label: string) => (within(c).getByText(label).closest('li') as HTMLElement).textContent

describe('E22-T8 O20 the Last week card', () => {
  test('O20 reads the dates and four rows with their change on the week before', async () => {
    await mount(fixture, THU_15)
    const c = await card()
    expect(within(c).getByText('5–11 Oct')).toBeTruthy()
    expect(row(c, 'Sessions')).toContain('3')
    expect(row(c, 'Sessions')).toContain('same')
    expect(row(c, 'Sets')).toContain('69')
    expect(row(c, 'Sets')).toContain('same')
    expect(row(c, 'Volume')).toContain('15,908 kg')
    expect(row(c, 'Volume')).toContain('−11 %')
    expect(row(c, 'PRs')).toContain('15')
    expect(row(c, 'PRs')).toContain('−1')
  })

  test('O20 a drop in Sessions and Sets shows its signed difference', async () => {
    await mount(fixture, MON_19)
    const c = await card()
    expect(within(c).getByText('12–18 Oct')).toBeTruthy()
    expect(row(c, 'Sessions')).toContain('−1')
    expect(row(c, 'Sets')).toContain('−22')
    expect(row(c, 'Volume')).toContain('11,000 kg')
    expect(row(c, 'Volume')).toContain('−31 %')
    expect(row(c, 'PRs')).toContain('−6')
  })

  test('O20 sits above This week', async () => {
    await mount(fixture, THU_15)
    const c = await card()
    const week = await waitFor(() => screen.getByRole('region', { name: 'This week' }), SETTLE)
    expect(c.compareDocumentPosition(week) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('O20 a first week on record says so instead of showing changes', async () => {
    const onlyLast = fixture.filter((s) => s.startedAt >= new Date(2026, 9, 12).getTime())
    await mount(onlyLast, MON_19)
    const c = await card()
    expect(within(c).getByText('First week on record')).toBeTruthy()
    expect(within(c).queryByText('same')).toBeNull()
    expect(c.textContent).not.toContain('%')
  })

  test('O20 shows no card when neither week had a Session', async () => {
    await mount(fixture, new Date(2026, 11, 14, 9).getTime())
    await waitFor(() => expect(screen.getByRole('button', { name: /Body/ })).toBeTruthy(), SETTLE)
    expect(screen.queryByRole('region', { name: 'Last week' })).toBeNull()
  })
})

describe('E22-T8 O21 the trainee week', () => {
  test('O21 weekStart 6 on Mon 19 Oct covers Sat 10 to Fri 16 Oct', async () => {
    await setWeekStart(6, MON_19)
    await mount(fixture, MON_19)
    const c = await card()
    expect(within(c).getByText('10–16 Oct')).toBeTruthy()
  })

  test('O21 with nothing stored it covers Mon 12 to Sun 18 Oct', async () => {
    await mount(fixture, MON_19)
    const c = await card()
    expect(within(c).getByText('12–18 Oct')).toBeTruthy()
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
