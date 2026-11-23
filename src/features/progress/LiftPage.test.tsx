// E18-T11 [O21], v6 §6.3: the one Lift page over the stats fixture (Thu 15 Oct 2026, 18:05).
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { Session } from '../../types'
import { LiftPageView } from './LiftPage'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

const sessions = sessionsJson as unknown as Session[]
const catalog = loadCatalog()
const resolve = (id: string) => catalog.get(id)
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')
const NOW = new Date(2026, 9, 15, 18, 5).getTime()

function open(exerciseId: string, onOpenSession?: (id: string) => void) {
  return render(
    <LiftPageView
      exerciseId={exerciseId}
      sessions={sessions}
      program={program}
      resolve={resolve}
      now={NOW}
      onOpenSession={onOpenSession}
    />,
  )
}

describe('E18-T11 O21 lift page', () => {
  it('O21 shows the verdict banner and the latest top set as the hero', () => {
    // v7 (study §1.7): the status as a glyph and word, its action, and the reason with a line that
    // sets expectations; then the one number -- est. strength at 44 px, its change over the same
    // 12 weeks as the Progress row, and what it means. The latest top set is in Records and the log.
    open('back-squat')
    const status = within(screen.getByRole('region', { name: 'Status' }))
    expect(status.getByText('↑ Moving')).toBeVisible()
    expect(status.getByText('Next time: 62.5 kg × 9.')).toBeVisible()
    expect(
      status.getByText('Wed 14 Oct was your first day at 62.5 kg; 8 reps on a new weight is normal. When every set reaches 10, go to 65 kg.'),
    ).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Latest top set' })).toBeNull()
    const hero = screen.getByRole('region', { name: 'Est. strength' })
    expect(hero.querySelector('.lift-hero-value')?.textContent).toBe('79.2 kg')
    expect(within(hero).getByText('↑ +9.2 since 24 Jul')).toHaveAttribute('data-tone', 'up')
    expect(within(hero).getByText('Est. strength: the one-rep max your best set predicts')).toBeVisible()
  })

  it('O21 draws the ladder with the presets Step, 3M, 1Y and All, Step first', async () => {
    // v7: one chip row -- Est. strength (first, chosen) or Top set, then 3M (default), 1Y and All
    // as text tabs; never a Step tab.
    const user = userEvent.setup()
    open('back-squat')
    expect(screen.getByRole('img', { name: /^Estimated strength, / })).toBeVisible()
    const shows = within(screen.getByRole('radiogroup', { name: 'Show' })).getAllByRole('radio')
    expect(shows.map((p) => (p as HTMLButtonElement).value)).toEqual(['est', 'weight'])
    expect(shows.map((p) => p.textContent)).toEqual(['Est. strength', 'Top set'])
    expect(shows[0]).toBeChecked()
    const presets = within(screen.getByRole('radiogroup', { name: 'Range' })).getAllByRole('radio')
    expect(presets.map((p) => (p as HTMLButtonElement).value)).toEqual(['3M', '1Y', 'all'])
    expect(presets[0]).toBeChecked()
    await user.click(presets[1])
    expect(presets[1]).toBeChecked()
    expect(presets[0]).not.toBeChecked()
    await user.click(shows[1])
    expect(shows[1]).toBeChecked()
    expect(screen.getByRole('img', { name: /^Top-set weight, / })).toBeVisible()
  })

  it('O21 says the next step in reps at the weight', () => {
    // v6: the action sentence replaces "Next: 15 of 20 reps at 62.5 kg"; its Why? ends with it.
    open('back-squat')
    expect(screen.queryByText(/of 20 reps/)).toBeNull()
    expect(screen.getByText('Next time: 62.5 kg × 9.')).toBeVisible()
  })

  it('O21 shows the e1RM line only on an e1RM lift', () => {
    // v7: est. strength is the loaded lift's headline, defined in one line, with no formula
    // footnote; a Bodyweight lift has no Est. strength chip and leads with its top load instead.
    const squat = open('back-squat')
    expect(screen.getByText('Est. strength: the one-rep max your best set predicts')).toBeVisible()
    expect(screen.queryByText(/≈ weight ×/)).toBeNull()
    squat.unmount()
    open('assisted-pull-ups')
    expect(screen.queryByRole('radiogroup', { name: 'Show' })).toBeNull()
    expect(screen.queryByText(/^Est\. strength/)).toBeNull()
    const hero = screen.getByRole('region', { name: 'Top load' })
    expect(hero.querySelector('.lift-hero-value')?.textContent).toBe('BW−19')
    expect(within(hero).getByText('↑ 6 kg less assistance since 27 Jul')).toBeVisible()
    expect(within(hero).getByText('Top load: the assistance on your top set; less is stronger')).toBeVisible()
  })

  it('O21 lists the bests table and the warm-ups as not counted', () => {
    open('back-squat')
    const table = screen.getByRole('table', { name: 'Records' })
    expect(within(table).getByText('Heaviest set')).toBeVisible()
    expect(within(table).getByText('Best est. strength')).toBeVisible()
    expect(within(table).getByText('Most reps at 62.5 kg')).toBeVisible()
    // Warm-ups sit on their own muted line, never among the working Sets.
    expect(screen.getAllByText('W 20×10 · 37.5×5')[0]).toBeVisible()
  })

  it('O21 a stalled lift names how long and opens the Session it last moved in', async () => {
    // v7: the reason is a sentence on the page (no Why?), with one line that sets expectations.
    const user = userEvent.setup()
    const onOpen = vi.fn()
    open('db-bench-press', onOpen)
    expect(screen.getByText('= Flat')).toBeVisible()
    expect(screen.getByText('Try a variation for 4 weeks.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Why?' })).toBeNull()
    const reason = screen.getByText(/No new best at 13 kg since Fri 7 Aug/)
    expect(reason).toBeVisible()
    expect(reason.textContent).toMatch(/A few flat weeks are normal; one change usually restarts a lift\.$/)
    // A log row opens its Session.
    await user.click(within(screen.getByRole('list', { name: 'Sessions' })).getByRole('button', { name: /^Wed 14 Oct/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(sessions.some((s) => s.id === onOpen.mock.calls[0][0])).toBe(true)
  })

  it('O21 the 4 weeks ago toggle reads the then-and-now top sets', () => {
    // v6: the toggle is cut. v7: the one number says how far it moved since the window's first
    // Session, and the deload week is named once, under the axis, beside its grey band.
    const { container } = open('db-bench-press')
    expect(screen.queryByRole('button', { name: '4 weeks ago' })).toBeNull()
    expect(screen.getByText('↑ +1.7 since 24 Jul')).toBeVisible()
    expect(screen.getByText('Deload 21–25 Sep')).toBeVisible()
    expect(container.querySelectorAll('.lift-chart-band').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.lift-chart-point-deload').length).toBeGreaterThan(0)
    // No per-point labels: the chart's only text is the record's `PR` mark.
    expect(container.querySelectorAll('.lift-chart-label')).toHaveLength(0)
  })

  it('O21 a lift never logged says so instead of drawing an axis', () => {
    open('no-such-lift')
    expect(screen.getByText(/No sessions of this lift yet/)).toBeVisible()
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('E19-T4 O6 lift page gap weeks', () => {
  const base = sessions.find((s) => s.entries.some((e) => e.exerciseId === 'back-squat')) as Session
  const at = (id: string, d: Date): Session => {
    const shift = d.getTime() - base.startedAt
    return {
      ...base,
      id,
      startedAt: base.startedAt + shift,
      finishedAt: (base.finishedAt ?? base.startedAt) + shift,
      entries: base.entries.map((e) => ({ ...e, loggedAt: e.loggedAt + shift })),
    }
  }
  // Sat 3 Oct and Sun 11 Oct 2026.
  const pair = [at('gap-a', new Date(2026, 9, 3, 10, 0)), at('gap-b', new Date(2026, 9, 11, 10, 0))]

  function ladderWith(weekStart: 0 | 1) {
    return render(
      <LiftPageView
        exerciseId="back-squat"
        sessions={pair}
        program={program}
        resolve={resolve}
        now={NOW}
        weekStart={weekStart}
      />,
    )
  }

  it('O6 with Monday weeks Sat 3 and Sun 11 Oct sit in adjacent weeks, so no gap', () => {
    // v6: the chart names no gap weeks ("No A session" is cut); 8 days apart is a solid line.
    const { container } = ladderWith(1)
    expect(container.querySelectorAll('.ladder-gap')).toHaveLength(0)
    expect(container.querySelectorAll('.lift-chart-gap')).toHaveLength(0)
  })

  it('O6 with Sunday weeks the same two Sessions leave an empty week between them', () => {
    // v6: the week start no longer changes the chart: still no gap caption, still solid.
    const { container } = ladderWith(0)
    expect(container.querySelectorAll('.ladder-gap')).toHaveLength(0)
    expect(container.querySelectorAll('.lift-chart-gap')).toHaveLength(0)
    expect(container.querySelector('.lift-chart-line')).not.toBeNull()
  })
})

describe('DX-12 DX-18 DX-20 the lift page sections', () => {
  it('DX-12 Rep maxes is a plain section after Records, from the latest top set, with no sheet', () => {
    open('back-squat')
    expect(screen.queryByRole('button', { name: /What can I lift/ })).toBeNull()
    const records = screen.getByRole('region', { name: 'Records' })
    const maxes = screen.getByRole('region', { name: 'Rep maxes' })
    expect(records.compareDocumentPosition(maxes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(maxes).getByText('From 62.5 kg × 8 on 14 Oct')).toBeVisible()
    const terms = within(maxes).getAllByRole('term').map((t) => t.textContent)
    expect(terms).toEqual(['1 rep', ...Array.from({ length: 9 }, (_, i) => `${i + 2} reps`)])
    // 62.5 × 8 predicts 79.2 kg: 1 rep 77.5 kg (down to the 2.5 kg step), 8 reps 62.5 kg.
    const loads = within(maxes).getAllByRole('definition').map((d) => d.textContent)
    expect(loads[0]).toBe('77.5 kg')
    expect(loads[7]).toBe('62.5 kg')
    expect(within(maxes).queryAllByRole('button')).toHaveLength(0)
    expect(within(maxes).queryAllByRole('textbox')).toHaveLength(0)
  })

  it('DX-20 section headers are sentence case words, not upper-case labels', () => {
    open('back-squat')
    for (const name of ['Records', 'Rep maxes', 'Sessions']) expect(screen.getByRole('heading', { name })).toBeVisible()
  })

  it('technique lives in Exercises and the live Session, not on a Progress page', () => {
    open('back-squat')
    expect(screen.queryByRole('button', { name: /How to do it/ })).toBeNull()
  })

  it('DX-03 a Flat lift whose action is a variation keeps "Swap for a variation ›"', async () => {
    const onSwap = vi.fn()
    render(
      <LiftPageView exerciseId="db-bench-press" sessions={sessions} program={program} resolve={resolve} now={NOW} onSwap={onSwap} />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Swap for a variation ›' }))
    expect(onSwap).toHaveBeenCalledTimes(1)
  })

  it('DX-18 the chart has no per-point buttons: one scrub area drives the readout', () => {
    const { container } = open('back-squat')
    expect(container.querySelectorAll('.lift-chart-hit')).toHaveLength(0)
    const scrub = screen.getByRole('slider', { name: 'Sessions on the chart' })
    expect(screen.getByRole('region', { name: 'Chart readout' })).toHaveTextContent('Wed 14 Oct')
    // A press at the far left picks the first Session in the range.
    fireEvent.pointerDown(scrub, { clientX: 0, pointerId: 1 })
    expect(scrub.getAttribute('aria-valuenow')).toBe('1')
    expect(screen.getByRole('region', { name: 'Chart readout' })).not.toHaveTextContent('Wed 14 Oct')
  })
})
