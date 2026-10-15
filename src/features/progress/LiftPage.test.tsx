// E18-T11 [O21]: the lift page over the stats fixture (Thu 15 Oct 2026, 18:05).
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
    open('back-squat')
    expect(screen.getByText('▲ Moving')).toBeVisible()
    const hero = within(screen.getByRole('region', { name: 'Latest top set' }))
    expect(hero.getByText('62.5 kg × 8')).toBeVisible()
    expect(hero.getByText(/Wed 14 Oct/)).toBeVisible()
  })

  it('O21 draws the ladder with the presets Step, 3M, 1Y and All, Step first', async () => {
    const user = userEvent.setup()
    open('back-squat')
    expect(screen.getByRole('img', { name: /Back squat/ })).toBeVisible()
    const presets = within(screen.getByRole('radiogroup', { name: 'Range' })).getAllByRole('radio')
    expect(presets.map((p) => (p as HTMLInputElement).value)).toEqual(['step', '3M', '1Y', 'all'])
    expect(presets[0]).toBeChecked()
    await user.click(presets[2])
    expect(presets[2]).toBeChecked()
  })

  it('O21 says the next step in reps at the weight', () => {
    open('back-squat')
    expect(screen.getByText('Next: 15 of 20 reps at 62.5 kg')).toBeVisible()
  })

  it('O21 shows the e1RM line only on an e1RM lift', () => {
    const squat = open('back-squat')
    const line = squat.container.querySelector('.lift-e1rm')
    expect(line).not.toBeNull()
    expect(line?.textContent).toMatch(/79\.2 kg/)
    expect(line?.textContent).toMatch(/estimated/i)
    squat.unmount()
    const pullups = open('assisted-pull-ups')
    expect(pullups.container.querySelector('.lift-e1rm')).toBeNull()
  })

  it('O21 lists the bests table and the warm-ups as not counted', () => {
    open('back-squat')
    const table = screen.getByRole('table', { name: 'Bests' })
    expect(within(table).getByText('Heaviest set')).toBeVisible()
    expect(within(table).getByText('Best estimated 1RM')).toBeVisible()
    expect(screen.getByText(/Warm-ups 20 × 10 · 37\.5 × 5 · not counted/)).toBeVisible()
  })

  it('O21 a stalled lift names how long and opens the Session it last moved in', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    open('db-bench-press', onOpen)
    expect(screen.getByText('■ Stalled')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Last moved: Fri 7 Aug/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(sessions.some((s) => s.id === onOpen.mock.calls[0][0])).toBe(true)
  })

  it('O21 the 4 weeks ago toggle reads the then-and-now top sets', async () => {
    const user = userEvent.setup()
    open('db-bench-press')
    expect(screen.queryByText(/no change/)).toBeNull()
    await user.click(screen.getByRole('button', { name: '4 weeks ago' }))
    expect(screen.getByText('13 × 9 → 13 × 9 · no change')).toBeVisible()
  })

  it('O21 a lift never logged says so instead of drawing an axis', () => {
    open('no-such-lift')
    expect(screen.getByText(/No sessions of this lift yet/)).toBeVisible()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
