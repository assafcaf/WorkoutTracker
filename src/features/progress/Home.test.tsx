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
import { Home, headlineOf, progressModel } from './Home'
import { loadCatalog } from '../../data/catalog'
import type { ProgressPage } from './pages'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

const NOW = new Date(2026, 9, 15, 18, 5).getTime()
const SETTLE = { timeout: 5000 }
/** The v7 headline on the fixture (study §1.7): Moving and Ready lifts of all 14. */
const LEAD = '12 of 14 lifts are moving'
/** The v7 exceptions sentence: the two lifts that are not moving, in Plan order. */
const EXCEPTIONS =
  'DB bench press has been flat since 7 Aug. Narrow-grip pull-down is lower on purpose since 7 Oct; that is a choice, not a slide.'
/**
 * DX-03: the Muscles row names every muscle outside 10–20 sets a week, as the Muscles page judges
 * each row; a plan that sets a low count does not excuse it (Abs 3, Calves 8 are below).
 */
const ROW = 'MusclesShoulders above · Calves and Abs below range'
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
  test('DX-02 opens on the headline, its sentence and a grey meta line; no date, no calendar', async () => {
    // DX-02: the headline block is the count of moving lifts, one sentence on the exceptions and
    // the meta line "Since 23 Jul · 31 Sessions"; the 6-week dot grid and the date are gone.
    await mount(fixture)
    const lead = await waitFor(() => screen.getByRole('heading', { name: LEAD }), SETTLE)
    const meta = screen.getByText('Since 23 Jul · 31 Sessions')
    expect(meta).toBeVisible()
    expect(meta.compareDocumentPosition(screen.getByText(EXCEPTIONS)) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(screen.queryByText(/Thu 15 Oct/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'Weeks' })).toBeNull()
    expect(screen.queryByText(/sessions in 6 weeks/i)).toBeNull()
    expect(screen.queryByText('Est. strength')).toBeNull()
    expect(screen.queryByText('Change')).toBeNull()
    expect(screen.getByText(EXCEPTIONS)).toBeVisible()
    expect(screen.queryByText(/stepped up/)).toBeNull()
    expect(screen.queryByText(/lifts moving/)).toBeNull()
    expect(screen.queryByText(/need a decision/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'DB bench press' })).toBeNull()
    const lifts = screen.getByRole('region', { name: 'Lifts' })
    expect(lead.compareDocumentPosition(lifts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('O20 an attention card has its sentence, its suggestion and a Why? that expands in place', async () => {
    // v7: the decision cards moved to Program; Progress reads. The lowered lift is one ledger row
    // with its status, and the reason is in the headline sentence ("a choice, not a slide"), with
    // no Why? anywhere and nothing screen-reader-only.
    const { push } = await mount(fixture)
    await waitFor(() => screen.getByRole('heading', { name: LEAD }), SETTLE)
    expect(screen.queryByRole('region', { name: 'Narrow-grip pull-down' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Why?' })).toBeNull()
    expect(document.querySelector('.progress-visually-hidden')).toBeNull()
    expect(screen.queryByText('Stay at 46.25 kg until all 3 sets reach 12.')).toBeNull()
    const lifts = screen.getByRole('region', { name: 'Lifts' })
    const row = within(lifts).getByRole('button', { name: /^Narrow-grip pull-down: Lowered\./ })
    expect(within(row).getByText('↓ Lowered')).toBeVisible()
    expect(screen.getByText(/Narrow-grip pull-down is lower on purpose since 7 Oct; that is a choice, not a slide\./)).toBeVisible()
    fireEvent.click(row)
    expect(push).toHaveBeenCalledWith({ kind: 'lift', exerciseId: 'narrow-grip-pull-down' })
  })

  test('DX-03 a Flat lift says since when, and no screen string says Stalled', async () => {
    // DX-03: one vocabulary; the code kind `stalled` reads "Flat", "Flat since 7 Aug".
    const { push, navigate } = await mount(fixture)
    const lifts = await waitFor(() => screen.getByRole('region', { name: 'Lifts' }), SETTLE)
    expect(document.body.textContent).not.toMatch(/stalled/i)
    const row = within(lifts).getByRole('button', { name: /^DB bench press: Flat since 7 Aug\. est\. strength 16\.9 kg, / })
    expect(within(row).getByText('= Flat since 7 Aug')).toBeVisible()
    expect(within(row).getByText('16.9')).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Swap/ })).toBeNull()
    expect(screen.queryByText('Try a variation for 4 weeks.')).toBeNull()
    fireEvent.click(row)
    expect(push).toHaveBeenCalledWith({ kind: 'lift', exerciseId: 'db-bench-press' })
    expect(navigate).not.toHaveBeenCalled()
  })

  test('DX-03 the lifts needing a decision (Flat, Ready) come first under their own heading', async () => {
    await mount(fixture)
    const lifts = await waitFor(() => screen.getByRole('region', { name: 'Lifts' }), SETTLE)
    expect(within(lifts).getByRole('heading', { name: 'Needs a decision (3)' })).toBeVisible()
    const decide = within(lifts).getByRole('list', { name: 'Needs a decision' })
    const names = within(decide)
      .getAllByRole('button')
      .map((b) => (b.getAttribute('aria-label') ?? '').split(':')[0])
    // Flat first, then Ready, each in Plan order.
    expect(names).toEqual(['DB bench press', 'Push-ups', 'Seated biceps curls'])
    const others = within(lifts).getByRole('list', { name: 'Other lifts' })
    expect(within(others).getAllByRole('button')).toHaveLength(11)
    expect(within(others).getByRole('button', { name: /^Narrow-grip pull-down: Lowered/ })).toBeVisible()
  })

  test('DX-12 Muscles and Body are a two-row group right under the headline, with no Photos row', async () => {
    await mount(fixture)
    const lead = await waitFor(() => screen.getByRole('heading', { name: LEAD }), SETTLE)
    const more = screen.getByRole('navigation', { name: 'More' })
    const rows = within(more).getAllByRole('button')
    expect(rows.map((r) => r.textContent)).toEqual([ROW, 'BodyLog your bodyweight'])
    expect(lead.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const lifts = screen.getByRole('region', { name: 'Lifts' })
    expect(more.compareDocumentPosition(lifts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Photos/ })).toBeNull()
  })

  test('O20 the muscles finding opens Muscles, the moving list is collapsed and All 14 lifts opens the list', async () => {
    // v6 §6.2, v7: every lift is one ledger row on the dashboard itself; the All lifts
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
  test('DX-21 with 0 Sessions the page is one line and one outline Go to Train', async () => {
    const { navigate } = await mount([])
    const start = await waitFor(() => screen.getByRole('button', { name: 'Go to Train' }), SETTLE)
    expect(screen.getByText('Your lifts appear here after your first Session.')).toBeVisible()
    expect(start).toHaveClass('btn-secondary')
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
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

describe('V7R-14 Progress on a Break', () => {
  test('V7R-14 one sentence, as Home says it: no "0 of 14 moving", no days off repeated per lift', () => {
    const catalog = loadCatalog()
    const BREAK = new Date(2026, 10, 9, 7, 40).getTime() // Mon 9 Nov, 26 days after Wed 14 Oct
    const model = progressModel(
      {
        program: programJson as unknown as Program,
        sessions: fixture,
        resolve: (id: string) => catalog.get(id),
        library: new Map(),
        weekStart: 1,
        bodyLog: [],
      },
      BREAK,
    )
    expect(headlineOf(model)).toEqual({ title: 'As you left them', exceptions: 'Back after 26 days off.' })
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
