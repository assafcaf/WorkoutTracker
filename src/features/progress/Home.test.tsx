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
/** The v7 headline on the fixture (study §1.7): Moving and Ready lifts of all 14. */
const LEAD = '12 of 14 lifts are moving'
/** The v7 exceptions sentence: the two lifts that are not moving, in Plan order. */
const EXCEPTIONS =
  'DB bench press has been flat since 7 Aug. Narrow-grip pull-down is lower on purpose since 7 Oct; that is a choice, not a slide.'
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
    // v7 (study §1.7): the headline is the count of moving lifts and one sentence on the
    // exceptions, under "Since 23 Jul · 12 weeks"; no count row, no "stepped up" clause, and the
    // ledger follows -- no decision cards between them.
    await mount(fixture)
    const lead = await waitFor(() => screen.getByRole('heading', { name: LEAD }), SETTLE)
    expect(screen.getByText('Since 23 Jul · 12 weeks')).toBeVisible()
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
    expect(screen.queryByRole('region', { name: 'Needs a decision' })).toBeNull()
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

  test('V2-08 a stalled card compares its top set with the day of its last record', async () => {
    // v7: the stalled lift is a ledger row that says since when ("Flat since 7 Aug"), with its
    // est. strength and 12-week change; Swap lives on Program and at the bar, not here.
    const { push, navigate } = await mount(fixture)
    const lifts = await waitFor(() => screen.getByRole('region', { name: 'Lifts' }), SETTLE)
    const row = within(lifts).getByRole('button', { name: /^DB bench press: Stalled, flat since 7 aug\. est\. strength 16\.9 kg, / })
    expect(within(row).getByText('= Flat since 7 Aug')).toBeVisible()
    expect(within(row).getByText('16.9')).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Swap/ })).toBeNull()
    expect(screen.queryByText('Try a variation for 4 weeks.')).toBeNull()
    fireEvent.click(row)
    expect(push).toHaveBeenCalledWith({ kind: 'lift', exerciseId: 'db-bench-press' })
    expect(navigate).not.toHaveBeenCalled()
  })

  test('O20 the adherence tile reads 2 of 3 this week and its done days open their Session', async () => {
    // V2-05: the week moved to the top of Train. Progress Home draws no This week tile, and
    // Train's strip over the same Sessions reads 2 of 3 with the two done days named. v7: Progress
    // has the weeks strip -- 6 weeks of Sessions in the Workouts' colours, 15 in all.
    await mount(fixture)
    await waitFor(() => expect(screen.getByText(LEAD)).toBeTruthy(), SETTLE)
    expect(screen.queryByRole('region', { name: 'This week' })).toBeNull()
    expect(screen.queryByText('2 of 3 this week')).toBeNull()
    const weeks = screen.getByRole('region', { name: 'Weeks' })
    const strip = within(weeks).getByRole('img', { name: /^15 sessions in 6 weeks\. Week of 7 Sep: 3;/ })
    expect(strip.getAttribute('aria-label')).toMatch(/Week of 12 Oct: 2\.$/)
    const marks = [...strip.querySelectorAll('.progress-week-mark')].map((m) => m.getAttribute('data-slot'))
    expect(marks.filter((m) => m === 'a' || m === 'b')).toHaveLength(15)
    expect(marks.filter((m) => m?.startsWith('next-'))).toHaveLength(1)
    const train = weekStripOf(fixture, programJson as unknown as Program, NOW, 1)
    expect(`${train.done} of ${train.planned}`).toBe('2 of 3')
    expect(train.days).toHaveLength(7)
    expect(train.days.filter((d) => d.workout !== null)).toHaveLength(2)
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
