// E22-T7 [O17 O18 O19]: the Body page, over the real services and the fake IndexedDB.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { createServices } from '../../services'
import { db } from '../../storage/db'
import { getBodyLog, setBodyLog } from '../../storage/settingsStore'
import type { BodyLog } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { ProgressFeature } from './ProgressFeature'
import { PROGRESS_PAGES } from './pages'
import { BodyPage } from './BodyPage'

process.env.TZ = 'Asia/Jerusalem'

const NOW = new Date(2026, 9, 15, 18, 5).getTime() // Thu 15 Oct 2026
const SETTLE = { timeout: 5000 }

beforeEach(async () => {
  await db.open()
  await db.settings.clear()
})

async function mount(log: BodyLog = []) {
  if (log.length > 0) await setBodyLog(log, NOW)
  const services = createServices({ now: () => NOW, storageAvailable: true })
  const user = userEvent.setup()
  render(
    <ServicesProvider services={services}>
      <BodyPage page={{ kind: 'body' }} push={() => undefined} onBack={() => undefined} now={() => NOW} />
    </ServicesProvider>,
  )
  await screen.findByLabelText('Bodyweight (kg)', undefined, SETTLE)
  return user
}

const save = () => screen.getByRole('button', { name: 'Save' })
const stored = () => getBodyLog()

describe('E22-T7 O17 logging a bodyweight', () => {
  test('O17 Save is disabled with no value', async () => {
    await mount()
    expect(save()).toBeDisabled()
  })

  test('O17 a bodyweight for today is stored, listed and charted', async () => {
    const user = await mount()
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-15')
    await user.type(screen.getByLabelText('Bodyweight (kg)'), '80')
    await user.click(save())
    await waitFor(async () => expect(await stored()).toEqual([{ day: '2026-10-15', weightKg: 80 }]), SETTLE)
    const list = await screen.findByRole('list', { name: 'Entries' }, SETTLE)
    expect(within(list).getByText(/15 Oct/)).toBeVisible()
    expect(within(list).getByText(/80 kg/)).toBeVisible()
    expect(screen.getByRole('img', { name: 'Bodyweight chart' })).toBeVisible()
  })

  test('O17 saving again for the same date replaces it; another date adds one', async () => {
    const user = await mount([{ day: '2026-10-15', weightKg: 80 }])
    await screen.findByRole('list', { name: 'Entries' }, SETTLE)
    await user.type(screen.getByLabelText('Bodyweight (kg)'), '79.5')
    await user.click(save())
    await waitFor(async () => expect(await stored()).toEqual([{ day: '2026-10-15', weightKg: 79.5 }]), SETTLE)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-10' } })
    await user.type(screen.getByLabelText('Bodyweight (kg)'), '81')
    await user.click(save())
    await waitFor(
      async () =>
        expect(await stored()).toEqual([
          { day: '2026-10-10', weightKg: 81 },
          { day: '2026-10-15', weightKg: 79.5 },
        ]),
      SETTLE,
    )
  })

  test('O17 the date field allows no day after today', async () => {
    await mount()
    expect(screen.getByLabelText('Date')).toHaveAttribute('max', '2026-10-15')
  })

  test('O17 a value out of range shows an inline error and stores nothing', async () => {
    const user = await mount()
    await user.type(screen.getByLabelText('Bodyweight (kg)'), '500')
    await user.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent(/20.*400/)
    expect(await stored()).toEqual([])
  })
})

describe('E22-T7 O18 measurements and the chart metric', () => {
  test('O18 a waist alone is stored with only what was entered', async () => {
    const user = await mount()
    await user.click(screen.getByRole('button', { name: 'Add measurements' }))
    await user.type(screen.getByLabelText('Waist (cm)'), '82')
    await user.click(save())
    await waitFor(async () => expect(await stored()).toEqual([{ day: '2026-10-15', waistCm: 82 }]), SETTLE)
  })

  test('O18 a waist with a bodyweight keeps both and nothing else', async () => {
    const user = await mount()
    await user.type(screen.getByLabelText('Bodyweight (kg)'), '80')
    await user.click(screen.getByRole('button', { name: 'Add measurements' }))
    await user.type(screen.getByLabelText('Waist (cm)'), '82')
    await user.click(save())
    await waitFor(async () => expect(await stored()).toEqual([{ day: '2026-10-15', weightKg: 80, waistCm: 82 }]), SETTLE)
  })

  test('O18 the metric chips show only metrics with entries and choosing one charts it', async () => {
    const user = await mount([
      { day: '2026-10-01', weightKg: 80, waistCm: 84 },
      { day: '2026-10-15', weightKg: 79, waistCm: 82 },
    ])
    const chips = await screen.findByRole('radiogroup', { name: 'Metric' }, SETTLE)
    expect(within(chips).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['weightKg', 'waistCm'])
    expect(screen.getByRole('radio', { name: 'Bodyweight' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Waist' }))
    expect(screen.getByRole('img', { name: 'Waist chart' })).toBeVisible()
  })
})

describe('E22-T7 O19 reading and deleting entries', () => {
  const log: BodyLog = [
    { day: '2026-10-01', weightKg: 80 },
    { day: '2026-10-15', weightKg: 78.5 },
  ]

  test('O19 tapping a chart point shows its date and value', async () => {
    const user = await mount(log)
    await screen.findByRole('img', { name: 'Bodyweight chart' }, SETTLE)
    await user.click(screen.getByRole('button', { name: /1 Oct.*80 kg/ }))
    const readout = screen.getByRole('region', { name: 'Chart readout' })
    expect(readout).toHaveTextContent(/80 kg/)
  })

  test('O19 entries list newest first', async () => {
    await mount(log)
    const list = await screen.findByRole('list', { name: 'Entries' }, SETTLE)
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('15 Oct')
    expect(rows[1]).toHaveTextContent('1 Oct')
  })

  test('O19 Delete removes the entry at once with an Undo snackbar, and Undo puts it back', async () => {
    const user = await mount(log)
    await screen.findByRole('list', { name: 'Entries' }, SETTLE)
    await user.click(screen.getByRole('button', { name: 'Delete 15 Oct' }))
    await waitFor(async () => expect(await stored()).toEqual([log[0]]), SETTLE)
    const bar = await screen.findByRole('status')
    expect(bar).toHaveTextContent('Entry deleted')
    await user.click(within(bar).getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect(await stored()).toEqual(log), SETTLE)
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })
})

describe('E22-T7 the page is registered', () => {
  test('a group opened on a page that pushes the Body page draws it', async () => {
    const services = createServices({ now: () => NOW, storageAvailable: true })
    const user = userEvent.setup()
    render(
      <ServicesProvider services={services}>
        <ProgressFeature
          pages={{
            ...PROGRESS_PAGES,
            home: ({ push }) => <button onClick={() => push({ kind: 'body' })}>Open body</button>,
          }}
        />
      </ServicesProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Open body' }))
    expect(await screen.findByLabelText('Bodyweight (kg)', undefined, SETTLE)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('button', { name: 'Open body' })).toBeVisible()
  })
})
