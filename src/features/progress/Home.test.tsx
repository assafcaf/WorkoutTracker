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
/** The v6 headline on the fixture (report §6.4). */
const LEAD = 'This week 2 of 3 sessions · 4 lifts need a decision'
/**
 * The v6 Muscles row on the fixture: the one muscle furthest from 10–20 sets a week, with its unit.
 * V6-19: Abs (3 of a planned 3) and Calves (8 of 8) are as planned, so Shoulders is named (§6.2).
 */
const ROW = 'MusclesShoulders above the typical range (21 sets/week)'
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
    // v6 §6.2: one true headline, then the "Needs a decision" cards; no count row, no
    // "stepped up" clause.
    await mount(fixture)
    const lead = await waitFor(() => screen.getByText(LEAD), SETTLE)
    expect(screen.queryByText(/stepped up/)).toBeNull()
    expect(screen.queryByText(/lifts moving/)).toBeNull()
    const firstCard = screen.getByRole('region', { name: 'DB bench press' })
    expect(lead.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('O20 an attention card has its sentence, its suggestion and a Why? that expands in place', async () => {
    const { push } = await mount(fixture)
    const card = await waitFor(() => screen.getByRole('region', { name: 'Narrow-grip pull-down' }), SETTLE)
    // v6 (V6-07): the reason is visible -- the evidence line carries the note -- and nothing is
    // screen-reader-only.
    expect(card.querySelector('.progress-visually-hidden')).toBeNull()
    expect(card).not.toHaveAttribute('aria-describedby')
    expect(within(card).getByText('↓ Lowered')).toBeVisible()
    expect(within(card).getByText(/· note: “Right elbow sore on pull-downs, dropped…”$/)).toBeVisible()
    expect(within(card).getByText('Stay at 46.25 kg until all 3 sets reach 12.')).toBeVisible()
    expect(within(card).queryByText(/A lower weight you chose is not a loss/)).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: 'Why?' }))
    expect(within(card).getByText(/A lower weight you chose is not a loss/)).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: 'Hide' }))
    expect(within(card).queryByText(/A lower weight you chose is not a loss/)).toBeNull()
    fireEvent.click(within(card).getAllByRole('button')[0])
    expect(push).toHaveBeenCalledWith({ kind: 'lift', exerciseId: 'narrow-grip-pull-down' })
  })

  test('V2-08 a stalled card compares its top set with the day of its last record', async () => {
    const { navigate } = await mount(fixture)
    const card = await waitFor(() => screen.getByRole('region', { name: 'DB bench press' }), SETTLE)
    expect(within(card).getByText('13 kg × 9 · no new best since Fri 7 Aug')).toBeTruthy()
    // V6-04: the deload of 21–25 Sep already failed, so a variation, with a Swap link.
    expect(within(card).getByText('Try a variation for 4 weeks.')).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: 'Swap ›' }))
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ tab: 'exercises' }))
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
    // v6 §6.2: every lift is a row on the dashboard itself, grouped by Workout; the All lifts
    // link is gone and a row opens its Lift page.
    const { push } = await mount(fixture)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Lifts' })).toBeTruthy(), SETTLE)
    expect(screen.queryByRole('button', { name: /All 14 lifts/ })).toBeNull()
    const lifts = screen.getByRole('region', { name: 'Lifts' })
    expect(within(lifts).getAllByRole('button')).toHaveLength(14)
    fireEvent.click(within(lifts).getByRole('button', { name: /^Back squat: Moving/ }))
    expect(push).toHaveBeenCalledWith({ kind: 'lift', exerciseId: 'back-squat' })
    fireEvent.click(screen.getByRole('button', { name: /^Muscles/ }))
    expect(push).toHaveBeenCalledWith({ kind: 'muscles' })
  })

  test('V3-12 the Muscles row names the muscles out of range in the Muscles page words, never Traps or Abdominals', async () => {
    await mount(fixture)
    const row = await waitFor(() => screen.getByRole('button', { name: /^Muscles/ }), SETTLE)
    expect(document.body.textContent).not.toMatch(/Abdominals|Traps/)
    expect(row.textContent).toBe(ROW)
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
