// E18-T10 [O20], v6 §6.2: the Lifts list -- every lift of the Program with its one status, grouped
// by Workout -- and the page that still shows it on its own.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { createServices } from '../../services'
import { db } from '../../storage/db'
import { setActiveProgramId } from '../../storage/settingsStore'
import type { Session } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { AllLifts } from './AllLifts'
import type { ProgressPage } from './pages'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

const NOW = new Date(2026, 9, 15, 18, 5).getTime()

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

/** The rows' status lines, by lift name (from each row's accessible name). */
const rows = () => screen.getAllByRole('button').filter((b) => b.classList.contains('progress-row'))

test('O20 All lifts lists the 14 lifts with their verdicts, Back, and a lift opens its page', async () => {
  await db.sessions.bulkPut(sessionsJson as unknown as Session[])
  await setActiveProgramId('assaf-ab-2026', NOW)
  const push = vi.fn<(page: ProgressPage) => void>()
  const onBack = vi.fn()
  render(
    <ServicesProvider services={createServices({ now: () => NOW, storageAvailable: true })}>
      <AllLifts page={{ kind: 'lifts' }} push={push} onBack={onBack} now={() => NOW} />
    </ServicesProvider>,
  )
  await waitFor(() => expect(screen.getByRole('button', { name: /^DB bench press:/ })).toBeTruthy(), { timeout: 5000 })
  expect(rows()).toHaveLength(14)
  expect(screen.getAllByText('▲ Moving')).toHaveLength(10)
  expect(screen.getAllByText('■ Stalled')).toHaveLength(1)
  expect(screen.getAllByText('↓ Lowered')).toHaveLength(1)
  expect(screen.getAllByText('↑ Ready')).toHaveLength(2)
  expect(screen.queryByText(/Slipping/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^DB bench press:/ }))
  expect(push).toHaveBeenCalledWith({ kind: 'lift', exerciseId: 'db-bench-press' })
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(onBack).toHaveBeenCalled()
})

test('V2-08 a status filter narrows All lifts to the moving, stalled, slipping or ready lifts', async () => {
  // v6 §6.2: the filter chips are cut; the list is grouped by Workout in Plan order instead, and a
  // lift in both Workouts is listed once.
  await db.sessions.bulkPut(sessionsJson as unknown as Session[])
  await setActiveProgramId('assaf-ab-2026', NOW)
  render(
    <ServicesProvider services={createServices({ now: () => NOW, storageAvailable: true })}>
      <AllLifts page={{ kind: 'lifts' }} push={vi.fn()} onBack={vi.fn()} now={() => NOW} />
    </ServicesProvider>,
  )
  await waitFor(() => expect(screen.getByRole('button', { name: /^DB bench press:/ })).toBeTruthy(), { timeout: 5000 })
  expect(screen.queryByRole('radiogroup', { name: 'Show lifts' })).toBeNull()
  const a = screen.getByRole('list', { name: 'Workout A' })
  const b = screen.getByRole('list', { name: 'Workout B' })
  expect(within(a).getAllByRole('button')[0].getAttribute('aria-label')).toMatch(/^Back squat: Moving/)
  expect(within(b).getByRole('button', { name: /^Seated biceps curls: Ready/ })).toBeTruthy()
  expect(within(a).getAllByRole('button').length + within(b).getAllByRole('button').length).toBe(14)
})
