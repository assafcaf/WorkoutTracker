// E18-T10 [O20]: the Progress home on the stats fixture at Thu 15 Oct 18:05, and its sparse states.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { createServices } from '../../services'
import { db } from '../../storage/db'
import { setActiveProgramId } from '../../storage/settingsStore'
import type { Session } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import programJson from '../../data/programs/assaf-ab-2026.json'
import type { Program } from '../../types'
import { weekStripOf } from '../dashboard/trainCard'
import { Home } from './Home'
import type { ProgressPage } from './pages'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

const NOW = new Date(2026, 9, 15, 18, 5).getTime()
const SETTLE = { timeout: 5000 }
/** The V3-11 lead line on the fixture. */
const LEAD = '11 of 14 lifts moving · 12 stepped up since 18 Sep'
/** The V3-12 Muscles row on the fixture: the muscles the Muscles page flags above or below 10–20. */
const ROW = 'MusclesShoulders 21 above · Abs 3 below · Calves 8 below'
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
    // V3-11: the sentence, the count row and the climbed clause are one lead line now; there
    // are no count tiles, and "moving" is said once above the first card.
    await mount(fixture)
    const lead = await waitFor(() => screen.getByText(LEAD), SETTLE)
    expect(screen.queryByText('▲ 11')).toBeNull()
    expect(screen.queryByLabelText(/■ 2 stalled/)).toBeNull()
    expect(screen.queryByText('12 of 14 lifts stepped up since Fri 18 Sep.')).toBeNull()
    const firstCard = screen.getAllByRole('region')[0]
    expect(lead.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const above = (lead.parentElement?.textContent ?? '').split(firstCard.textContent ?? '')[0]
    expect(above.match(/moving/g)).toHaveLength(1)
  })

  test('O20 an attention card has its sentence, its suggestion and a Why? that expands in place', async () => {
    const { push } = await mount(fixture)
    const card = await waitFor(() => screen.getByRole('region', { name: 'Narrow-grip pull-down' }), SETTLE)
    // V2-08: three lines -- name and verdict, the top set against the best it slipped below, then
    // the suggestion and Why?. The sentence is the card's accessible description, not drawn text.
    expect(card).toHaveAccessibleDescription(/^Slipping, 46\.25 kg × 9 on Mon 12 Oct, below 47\.5 kg × 10/)
    expect(within(card).getByText('46.25 kg × 9')).toBeVisible()
    expect(within(card).getByText('· was 47.5 × 10 on 28 Sep')).toBeVisible()
    expect(card.textContent?.split('Narrow-grip pull-down')).toHaveLength(2)
    expect(within(card).getByText('Consider a lighter week or a variation')).toBeTruthy()
    expect(within(card).queryByText(/Slipping: the last 2 sessions/)).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: 'Why?' }))
    expect(within(card).getByText(/Slipping: the last 2 sessions/)).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: 'Hide' }))
    expect(within(card).queryByText(/Slipping: the last 2 sessions/)).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: /Narrow-grip pull-down/ }))
    expect(push).toHaveBeenCalledWith({ kind: 'lift', exerciseId: 'narrow-grip-pull-down' })
  })

  test('V2-08 a stalled card compares its top set with the day of its last record', async () => {
    await mount(fixture)
    const card = await waitFor(() => screen.getByRole('region', { name: 'Push-ups' }), SETTLE)
    expect(within(card).getByText('BW × 15')).toBeTruthy()
    expect(within(card).getByText('· no record since 3 Aug')).toBeTruthy()
    expect(card).toHaveAccessibleDescription(/^Stalled for 10 weeks/)
  })

  test('O20 the adherence tile reads 2 of 3 this week and its done days open their Session', async () => {
    // V2-05: the week moved to the top of Train. Progress Home draws no This week tile, and
    // Train's strip over the same Sessions reads 2 of 3 with the two done days named.
    await mount(fixture)
    await waitFor(() => expect(screen.getByText(LEAD)).toBeTruthy(), SETTLE)
    expect(screen.queryByRole('region', { name: 'This week' })).toBeNull()
    expect(screen.queryByText('2 of 3 this week')).toBeNull()
    const strip = weekStripOf(fixture, programJson as unknown as Program, NOW, 1)
    expect(`${strip.done} of ${strip.planned}`).toBe('2 of 3')
    expect(strip.days).toHaveLength(7)
    expect(strip.days.filter((d) => d.workout !== null)).toHaveLength(2)
  })

  test('O20 the muscles finding opens Muscles, the moving list is collapsed and All 14 lifts opens the list', async () => {
    const { push } = await mount(fixture)
    await waitFor(() => expect(screen.getByRole('button', { name: /All 14 lifts/ })).toBeTruthy(), SETTLE)
    expect(screen.queryByText('▲ Moving')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Muscles/ }))
    expect(push).toHaveBeenCalledWith({ kind: 'muscles' })
    // V2-08: one row opens the lifts; the moving row went into All lifts' status filter.
    expect(screen.queryByRole('button', { name: /11 lifts moving/ })).toBeNull()
    expect(screen.getAllByRole('button').filter((b) => /\blifts/.test(b.textContent ?? ''))).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /All 14 lifts/ }))
    expect(push).toHaveBeenCalledWith({ kind: 'lifts' })
  })

  test('V3-12 the Muscles row names the muscles out of range in the Muscles page words, never Traps or Abdominals', async () => {
    await mount(fixture)
    const row = await waitFor(() => screen.getByRole('button', { name: /^Muscles/ }), SETTLE)
    const text = row.textContent ?? ''
    expect(document.body.textContent).not.toMatch(/Abdominals|Traps/)
    // Every name is one of the Muscles page's 12, and says which side of 10–20 it is on.
    const named = text.replace(/^Muscles/, '').split(' · ')
    expect(named.length).toBeGreaterThan(0)
    for (const part of named) expect(part).toMatch(/^[A-Z][a-z]+( [a-z]+)? \d+ (above|below)$/)
    expect(text).toBe(ROW)
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
  // V2-05: the strip is Train's now; its days come from weekStripOf over the stored week start.
  const program = programJson as unknown as Program

  test('O6 with Sunday stored the strip runs Sun to Sat and marks Thursday as today', async () => {
    const strip = weekStripOf(fixture, program, NOW, 0)
    expect(strip.days.map((d) => d.name)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    expect(strip.days.map((d) => d.today)).toEqual([false, false, false, false, true, false, false])
  })

  test('O6 with nothing stored the strip still runs Mon to Sun', async () => {
    await mount(fixture)
    await waitFor(() => expect(screen.getByText(LEAD)).toBeTruthy(), SETTLE)
    expect(screen.queryByRole('region', { name: 'This week' })).toBeNull()
    const strip = weekStripOf(fixture, program, NOW, 1)
    expect(strip.days[0].name).toBe('Mon')
    expect(strip.days[3].today).toBe(true)
  })
})
