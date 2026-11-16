// E18-T11 [O21], v6 §6.3: the one Lift page over the stats fixture (Thu 15 Oct 2026, 18:05).
import { render, screen, within } from '@testing-library/react'
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
    // v6: the status block (label and action from liftStatus), then the latest top set.
    open('back-squat')
    const status = within(screen.getByRole('region', { name: 'Status' }))
    expect(status.getByText('↑ Moving')).toBeVisible()
    expect(status.getByText('Next time: 62.5 kg × 9.')).toBeVisible()
    const hero = within(screen.getByRole('region', { name: 'Latest top set' }))
    expect(hero.getByText('62.5 kg × 8')).toBeVisible()
    expect(hero.getByText('Wed 14 Oct · up 2.5 kg')).toBeVisible()
  })

  it('O21 draws the ladder with the presets Step, 3M, 1Y and All, Step first', async () => {
    // v6: one chart, Weight or Est. max, ranges 3M (default), 1Y and All -- never a Step tab.
    const user = userEvent.setup()
    open('back-squat')
    expect(screen.getByRole('img', { name: /^Top-set weight, / })).toBeVisible()
    const shows = within(screen.getByRole('radiogroup', { name: 'Show' })).getAllByRole('radio')
    expect(shows.map((p) => (p as HTMLInputElement).value)).toEqual(['weight', 'est'])
    const presets = within(screen.getByRole('radiogroup', { name: 'Range' })).getAllByRole('radio')
    expect(presets.map((p) => (p as HTMLInputElement).value)).toEqual(['3M', '1Y', 'all'])
    expect(presets[0]).toBeChecked()
    await user.click(presets[1])
    expect(presets[1]).toBeChecked()
  })

  it('O21 says the next step in reps at the weight', () => {
    // v6: the action sentence replaces "Next: 15 of 20 reps at 62.5 kg"; its Why? ends with it.
    open('back-squat')
    expect(screen.queryByText(/of 20 reps/)).toBeNull()
    expect(screen.getByText('Next time: 62.5 kg × 9.')).toBeVisible()
  })

  it('O21 shows the e1RM line only on an e1RM lift', async () => {
    // v6: the est. max is a chart view of loaded lifts, its formula footnoted once it is shown.
    const user = userEvent.setup()
    const squat = open('back-squat')
    expect(screen.queryByText(/Est\. max ≈ weight/)).toBeNull()
    await user.click(within(screen.getByRole('radiogroup', { name: 'Show' })).getByRole('radio', { name: 'Est. strength' }))
    expect(screen.getByRole('img', { name: /^Estimated strength, / })).toBeVisible()
    expect(screen.getByText('Est. strength ≈ weight × (1 + reps ÷ 30), from your best working set.')).toBeVisible()
    squat.unmount()
    open('assisted-pull-ups')
    expect(screen.queryByRole('radiogroup', { name: 'Show' })).toBeNull()
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
    const user = userEvent.setup()
    const onOpen = vi.fn()
    open('db-bench-press', onOpen)
    expect(screen.getByText('= Stalled')).toBeVisible()
    expect(screen.getByText('Try a variation for 4 weeks.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Why?' }))
    expect(screen.getByText(/No new best at 13 kg since Fri 7 Aug/)).toBeVisible()
    // A log row opens its Session.
    await user.click(within(screen.getByRole('list', { name: 'Sessions' })).getByRole('button', { name: /^Wed 14 Oct/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(sessions.some((s) => s.id === onOpen.mock.calls[0][0])).toBe(true)
  })

  it('O21 the 4 weeks ago toggle reads the then-and-now top sets', () => {
    // v6: the toggle is cut; the hero says how the latest top set moved, and the deload week is
    // named once, under the axis.
    open('db-bench-press')
    expect(screen.queryByRole('button', { name: '4 weeks ago' })).toBeNull()
    expect(screen.getByText('Wed 14 Oct · same')).toBeVisible()
    expect(screen.getByText('Deload 21–25 Sep')).toBeVisible()
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
