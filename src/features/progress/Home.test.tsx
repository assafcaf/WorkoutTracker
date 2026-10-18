// E18-T10 [O20]: the Progress home on the stats fixture at Thu 15 Oct 18:05, and its sparse states.
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

const NOW = new Date(2026, 9, 15, 18, 5).getTime()
const SETTLE = { timeout: 5000 }
const fixture = sessionsJson as unknown as Session[]

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

async function mount(sessions: Session[]) {
  await db.sessions.bulkPut(sessions)
  await setActiveProgramId('assaf-ab-2026', NOW)
  const push = vi.fn<(page: ProgressPage) => void>()
  const navigate = vi.fn()
  render(
    <ServicesProvider services={createServices({ now: () => NOW, storageAvailable: true })}>
      <Home page={{ kind: 'home' }} push={push} onBack={undefined} navigate={navigate} now={() => NOW} />
    </ServicesProvider>,
  )
  return { push, navigate }
}

describe('E18-T10 O20 Progress home with 45 Sessions', () => {
  test('O20 opens on the verdict sentence, the count row and the climbed clause', async () => {
    await mount(fixture)
    await waitFor(() => expect(screen.getByText('11 of 14 lifts moving.')).toBeTruthy(), SETTLE)
    expect(screen.getByLabelText('▲ 11 moving · ■ 2 stalled · ▼ 1 slipping · ↑ 1 ready')).toBeTruthy()
    expect(screen.getByText('▲ 11')).toBeTruthy()
    expect(screen.getByText('12 of 14 lifts stepped up since Fri 18 Sep.')).toBeTruthy()
  })

  test('O20 an attention card has its sentence, its suggestion and a Why? that expands in place', async () => {
    const { push } = await mount(fixture)
    const card = await waitFor(() => screen.getByRole('region', { name: 'Narrow-grip pull-down' }), SETTLE)
    expect(within(card).getByText(/slipping, 46\.25 kg × 9 on Mon 12 Oct/)).toBeTruthy()
    expect(within(card).getByText('Consider a lighter week or a variation')).toBeTruthy()
    expect(within(card).queryByText(/Slipping: the last 2 sessions/)).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: 'Why?' }))
    expect(within(card).getByText(/Slipping: the last 2 sessions/)).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: 'Hide' }))
    expect(within(card).queryByText(/Slipping: the last 2 sessions/)).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: /Narrow-grip pull-down/ }))
    expect(push).toHaveBeenCalledWith({ kind: 'lift', exerciseId: 'narrow-grip-pull-down' })
  })

  test('O20 the adherence tile reads 2 of 3 this week and its done days open their Session', async () => {
    const { navigate } = await mount(fixture)
    await waitFor(() => expect(screen.getByText('2 of 3 this week')).toBeTruthy(), SETTLE)
    const tile = screen.getByRole('region', { name: 'This week' })
    expect(within(tile).getAllByRole('listitem')).toHaveLength(7)
    const done = within(tile).getAllByRole('button')
    expect(done).toHaveLength(2)
    fireEvent.click(done[0])
    expect(navigate).toHaveBeenCalledWith({ tab: 'history', sessionId: expect.any(String) })
  })

  test('O20 the muscles finding opens Muscles, the moving list is collapsed and All 14 lifts opens the list', async () => {
    const { push } = await mount(fixture)
    await waitFor(() => expect(screen.getByText('11 lifts moving')).toBeTruthy(), SETTLE)
    expect(screen.queryByText('▲ Moving')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Muscles/ }))
    expect(push).toHaveBeenCalledWith({ kind: 'muscles' })
    fireEvent.click(screen.getByRole('button', { name: /11 lifts moving/ }))
    expect(screen.getAllByText('▲ Moving')).toHaveLength(11)
    fireEvent.click(screen.getByRole('button', { name: /All 14 lifts/ }))
    expect(push).toHaveBeenCalledWith({ kind: 'lifts' })
  })
})

describe('E18-T10 O20 the sparse states', () => {
  test('O20 with 0 Sessions the page is the expectation list and one Start button', async () => {
    const { navigate } = await mount([])
    const start = await waitFor(() => screen.getByRole('button', { name: 'Start workout' }), SETTLE)
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(start)
    expect(navigate).toHaveBeenCalledWith({ tab: 'workout' })
  })

  test('O20 with 1 Session it shows starting points, each unlogged lift with its prescription', async () => {
    await mount(fixture.slice(0, 1))
    await waitFor(() => expect(screen.getByText('Back squat')).toBeTruthy(), SETTLE)
    expect(screen.getByText('Deadlift')).toBeTruthy()
    expect(screen.getAllByText(/^\d+ × \d+–\d+$/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/lifts moving/)).toBeNull()
  })

  test('O20 with 3 Sessions it says Too early to call and shows no delta', async () => {
    await mount(fixture.slice(0, 3))
    await waitFor(() => expect(screen.getByText('Too early to call')).toBeTruthy(), SETTLE)
    expect(screen.queryByText(/lifts moving/)).toBeNull()
    expect(screen.queryByText(/Why\?/)).toBeNull()
  })
})

describe('E19-T4 O6 the day strip follows the stored week start', () => {
  test('O6 with Sunday stored the strip runs Sun to Sat and marks Thursday as today', async () => {
    await setWeekStart(0, NOW)
    await mount(fixture)
    const tile = await waitFor(() => screen.getByRole('region', { name: 'This week' }), SETTLE)
    const days = within(tile).getAllByRole('listitem')
    expect(days.map((d) => d.querySelector('.progress-day-name')?.textContent)).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ])
    expect(days[0].querySelector('.progress-day-date')?.textContent).toBe('11')
    expect(days.map((d) => d.classList.contains('progress-day-today'))).toEqual([false, false, false, false, true, false, false])
  })

  test('O6 with nothing stored the strip still runs Mon to Sun', async () => {
    await mount(fixture)
    const tile = await waitFor(() => screen.getByRole('region', { name: 'This week' }), SETTLE)
    const days = within(tile).getAllByRole('listitem')
    expect(days[0].querySelector('.progress-day-name')?.textContent).toBe('Mon')
    expect(days[3].classList.contains('progress-day-today')).toBe(true)
  })
})
