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
  // v7: a ledger row says its status in words -- Ready with a load to go to reads "Up to 15 kg",
  // Stalled reads since when.
  expect(screen.getAllByText('↑ Moving')).toHaveLength(10)
  expect(screen.getAllByText('= Flat since 7 Aug')).toHaveLength(1)
  expect(screen.getAllByText('↓ Lowered')).toHaveLength(1)
  expect(screen.getAllByText('↑ Ready')).toHaveLength(1)
  expect(screen.getAllByText('↑ Up to 15 kg')).toHaveLength(1)
  expect(screen.queryByText(/Slipping/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^DB bench press:/ }))
  expect(push).toHaveBeenCalledWith({ kind: 'lift', exerciseId: 'db-bench-press' })
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(onBack).toHaveBeenCalled()
})

test('V2-08 a status filter narrows All lifts to the moving, stalled, slipping or ready lifts', async () => {
  // v6 §6.2: the filter chips are cut. v7 (study §1.7): the list is one ledger in Plan order --
  // Workout A's lifts, then Workout B's -- with no group headings, and a lift in both Workouts is
  // listed once.
  await db.sessions.bulkPut(sessionsJson as unknown as Session[])
  await setActiveProgramId('assaf-ab-2026', NOW)
  render(
    <ServicesProvider services={createServices({ now: () => NOW, storageAvailable: true })}>
      <AllLifts page={{ kind: 'lifts' }} push={vi.fn()} onBack={vi.fn()} now={() => NOW} />
    </ServicesProvider>,
  )
  await waitFor(() => expect(screen.getByRole('button', { name: /^DB bench press:/ })).toBeTruthy(), { timeout: 5000 })
  expect(screen.queryByRole('radiogroup', { name: 'Show lifts' })).toBeNull()
  expect(screen.queryByRole('list', { name: 'Workout A' })).toBeNull()
  expect(screen.queryByRole('list', { name: 'Workout B' })).toBeNull()
  const ledger = within(screen.getByRole('list', { name: 'Lifts' })).getAllByRole('button')
  const names = ledger.map((b) => (b.getAttribute('aria-label') ?? '').split(':')[0])
  expect(ledger).toHaveLength(14)
  expect(new Set(names).size).toBe(14)
  expect(ledger[0].getAttribute('aria-label')).toMatch(/^Back squat: Moving/)
  const curls = ledger.findIndex((b) => /^Seated biceps curls: Ready, up to 15 kg\./.test(b.getAttribute('aria-label') ?? ''))
  expect(curls).toBeGreaterThan(names.indexOf('Back squat'))
  expect(curls).toBeGreaterThan(names.indexOf('DB bench press'))
})
