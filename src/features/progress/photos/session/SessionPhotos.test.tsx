// Photos2: progress photos from a Session -- the finish summary's "Add progress photos", the
// day's thumbnail line on any summary, and the Session editor's Photos row with delete and Undo.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createServices } from '../../../../services'
import type { Services } from '../../../../services'
import { db } from '../../../../storage/db'
import type { Photo } from '../../../../storage/photoStore'
import { ServicesProvider } from '../../../ServicesProvider'
import { SessionPhotos } from './SessionPhotos'

const DAY = '2026-11-17'
const NOW = new Date(2026, 10, 17, 19, 0).getTime()
const SETTLE = { timeout: 3000 }

const photo = (angle: Photo['angle'], day = DAY, createdAt = 1): Photo => ({
  id: `${angle}-${day}-${createdAt}`,
  day,
  angle,
  data: new Uint8Array([1, 2, 3]).buffer,
  type: 'image/jpeg',
  width: 800,
  height: 1200,
  align: null,
  createdAt,
})

/** Real services; `add` stores the picked file as a ready photo (jsdom has no canvas to re-encode). */
function servicesWithAdd(): Services {
  const services = createServices({ now: () => NOW, storageAvailable: true })
  vi.spyOn(services.photos, 'add').mockImplementation(async (input) => {
    const stored = { ...photo(input.angle, input.day, Date.now()), align: input.align }
    await services.photos.restore(stored)
    return stored
  })
  return services
}

function renderPhotos(props: Parameters<typeof SessionPhotos>[0], services = servicesWithAdd()): Services {
  render(
    <ServicesProvider services={services}>
      <SessionPhotos {...props} />
    </ServicesProvider>,
  )
  return services
}

beforeEach(async () => {
  await db.open()
  await db.photos.clear()
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('Photos2 O1 the finish summary offers progress photos for the Session day', () => {
  test('O1 with no photos that day, one quiet named action "Add progress photos"', async () => {
    renderPhotos({ day: DAY, variant: 'finish' })
    const add = await screen.findByRole('button', { name: 'Add progress photos' }, SETTLE)
    expect(add).toHaveClass('btn-quiet')
    expect(add).toHaveClass('session-photos-action')
    expect(screen.queryByText(/photos? ·/)).toBeNull()
  })

  test('O1 Add progress photos opens the existing capture screen; Close returns to the summary line', async () => {
    const user = userEvent.setup()
    renderPhotos({ day: DAY, variant: 'finish' })
    await user.click(await screen.findByRole('button', { name: 'Add progress photos' }, SETTLE))
    expect(await screen.findByRole('heading', { name: /^(Front|Side|Back)(, mirror)?$/ })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(await screen.findByRole('button', { name: 'Add progress photos' })).toBeVisible()
  })

  test('O1 a photo saved from the summary is stored for the Session day and the line then counts it', async () => {
    const user = userEvent.setup()
    const services = renderPhotos({ day: DAY, variant: 'finish' })
    await user.click(await screen.findByRole('button', { name: 'Add progress photos' }, SETTLE))
    await screen.findByRole('heading', { name: /^(Front|Side|Back)(, mirror)?$/ })
    fireEvent.change(screen.getByLabelText('Library photo'), {
      target: { files: [new File(['pixels'], 'me.jpg', { type: 'image/jpeg' })] },
    })
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    await waitFor(() => expect(services.photos.add).toHaveBeenCalledTimes(1))
    expect(vi.mocked(services.photos.add).mock.calls[0][0]).toMatchObject({ day: DAY, angle: 'front' })
    expect(await screen.findByRole('button', { name: '1 photo · front' }, SETTLE)).toBeVisible()
  })

  test('O1 with photos that day, the line reads "3 photos · front, side, back" and opens them', async () => {
    await db.photos.bulkPut([photo('back'), photo('front'), photo('side'), photo('front', '2026-11-10')])
    const user = userEvent.setup()
    renderPhotos({ day: DAY, variant: 'finish' })
    const line = await screen.findByRole('button', { name: '3 photos · front, side, back' }, SETTLE)
    expect(line.querySelectorAll('img')).toHaveLength(3)
    // Still one more can be added, from the same line.
    expect(screen.getByRole('button', { name: 'Add progress photos' })).toBeVisible()
    await user.click(line)
    const sheet = await screen.findByRole('dialog', { name: 'Progress photos' })
    expect(within(sheet).getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual([
      'Front photo',
      'Side photo',
      'Back photo',
    ])
  })
})

describe('Photos2 O3 the past-workout summary shows the day line only when there are photos', () => {
  test('O3 no photos that day: nothing is drawn', async () => {
    const services = renderPhotos({ day: DAY, variant: 'past' })
    await waitFor(() => expect(document.querySelector('.session-photos')).toBeNull())
    // Give the read a moment to land, then still nothing.
    await services.photos.list()
    expect(screen.queryByRole('button', { name: /photo/ })).toBeNull()
  })

  test('O3 photos that day: the same thumbnail line, with no Add', async () => {
    await db.photos.bulkPut([photo('front'), photo('side')])
    renderPhotos({ day: DAY, variant: 'past' })
    expect(await screen.findByRole('button', { name: '2 photos · front, side' }, SETTLE)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Add progress photos' })).toBeNull()
  })
})

describe('Photos2 O2 the Session editor has a Photos row', () => {
  test('O2 the row lists the day thumbnails and offers Add photos into the capture screen', async () => {
    await db.photos.bulkPut([photo('front'), photo('back'), photo('side', '2026-11-16')])
    const user = userEvent.setup()
    renderPhotos({ day: DAY, variant: 'editor' })
    const row = await screen.findByRole('group', { name: 'Photos' }, SETTLE)
    await waitFor(() =>
      expect(within(row).getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual(['Front photo', 'Back photo']),
    )
    await user.click(within(row).getByRole('button', { name: 'Add photos' }))
    expect(await screen.findByRole('heading', { name: /^(Front|Side|Back)(, mirror)?$/ })).toBeVisible()
  })

  test('O2 with no photos that day, the row still offers Add photos', async () => {
    renderPhotos({ day: DAY, variant: 'editor' })
    const row = await screen.findByRole('group', { name: 'Photos' }, SETTLE)
    expect(within(row).getByRole('button', { name: 'Add photos' })).toBeVisible()
    expect(within(row).queryAllByRole('img')).toHaveLength(0)
  })

  test('O2 Delete removes the photo at once and Undo puts it back', async () => {
    await db.photos.bulkPut([photo('front'), photo('side')])
    const user = userEvent.setup()
    renderPhotos({ day: DAY, variant: 'editor' })
    const row = await screen.findByRole('group', { name: 'Photos' }, SETTLE)
    await user.click(await within(row).findByRole('button', { name: 'Delete front photo' }, SETTLE))
    expect(await screen.findByRole('status')).toHaveTextContent('Photo deleted · frontUndo')
    await waitFor(() => expect(within(row).queryByRole('button', { name: 'Delete front photo' })).toBeNull())
    expect(await db.photos.get(photo('front').id)).toBeUndefined()

    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Undo' }))
    expect(await within(row).findByRole('button', { name: 'Delete front photo' }, SETTLE)).toBeVisible()
    expect(await db.photos.get(photo('front').id)).toBeDefined()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
