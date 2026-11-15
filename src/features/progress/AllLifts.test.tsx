// E18-T10 [O20]: All lifts lists every lift of the Program with its verdict and opens its page.
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
  await waitFor(() => expect(screen.getByText('DB bench press')).toBeTruthy(), { timeout: 5000 })
  expect(screen.getAllByText('▲ Moving')).toHaveLength(11)
  expect(screen.getAllByText('■ Stalled')).toHaveLength(2)
  expect(screen.getAllByText('▼ Slipping')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: /DB bench press/ }))
  expect(push).toHaveBeenCalledWith({ kind: 'lift', exerciseId: 'db-bench-press' })
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(onBack).toHaveBeenCalled()
})

test('V2-08 a status filter narrows All lifts to the moving, stalled, slipping or ready lifts', async () => {
  await db.sessions.bulkPut(sessionsJson as unknown as Session[])
  await setActiveProgramId('assaf-ab-2026', NOW)
  render(
    <ServicesProvider services={createServices({ now: () => NOW, storageAvailable: true })}>
      <AllLifts page={{ kind: 'lifts' }} push={vi.fn()} onBack={vi.fn()} now={() => NOW} />
    </ServicesProvider>,
  )
  await waitFor(() => expect(screen.getByText('DB bench press')).toBeTruthy(), { timeout: 5000 })
  const filter = screen.getByRole('radiogroup', { name: 'Show lifts' })
  expect(within(filter).getByRole('radio', { name: 'All' })).toBeChecked()
  const rows = () => screen.getAllByRole('button').filter((b) => b.classList.contains('progress-row'))
  expect(rows()).toHaveLength(14)
  fireEvent.click(within(filter).getByRole('radio', { name: 'Moving' }))
  expect(rows()).toHaveLength(11)
  fireEvent.click(within(filter).getByRole('radio', { name: 'Stalled' }))
  expect(rows().map((r) => r.querySelector('.progress-row-name')?.textContent).sort()).toEqual(['DB bench press', 'Push-ups'])
  fireEvent.click(within(filter).getByRole('radio', { name: 'Slipping' }))
  expect(rows()).toHaveLength(1)
  fireEvent.click(within(filter).getByRole('radio', { name: 'Ready' }))
  expect(rows().map((r) => r.querySelector('.progress-row-name')?.textContent)).toEqual(['Seated biceps curls'])
})
