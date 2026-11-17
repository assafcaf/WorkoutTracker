// E26-T3 [O10]: the Lift page's Est. strength hero reads as a multiple of the bodyweight.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import sessionsJson from '../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../data/catalog'
import type { BodyLog, Session } from '../types'
import { LiftPageView } from '../features/progress/LiftPage'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

const sessions = sessionsJson as unknown as Session[]
const catalog = loadCatalog()
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')
const NOW = new Date(2026, 9, 15, 18, 5).getTime()

function open(bodyLog?: BodyLog) {
  return render(
    <LiftPageView
      exerciseId="back-squat"
      sessions={sessions}
      program={program}
      resolve={(id) => catalog.get(id)}
      now={NOW}
      bodyLog={bodyLog}
    />,
  )
}

describe('E26-T3 O10 lift page relative strength', () => {
  it('O10 shows est. strength over bodyweight in the Est. strength hero', () => {
    // hero is 79.2 kg; 79.2 / 60 = 1.32
    open([{ day: '2026-10-01', weightKg: 60 }])
    const hero = within(screen.getByRole('region', { name: 'Est. strength' }))
    expect(hero.getByText('1.32 × bodyweight')).toBeVisible()
  })
  it('O10 shows nothing without a bodyweight on or before the latest session', () => {
    open([{ day: '2026-10-15', weightKg: 60 }])
    expect(screen.queryByText(/× bodyweight/)).toBeNull()
  })
  it('O10 shows nothing without a body log', () => {
    open()
    expect(screen.queryByText(/× bodyweight/)).toBeNull()
  })
})
