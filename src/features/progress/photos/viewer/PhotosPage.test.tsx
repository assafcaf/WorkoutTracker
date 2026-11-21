// Photos viewer: the Photos page over the real photo store, and the ways in (Progress, Body) and
// on (Compare with two chosen dates).
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import sessionsJson from '../../../../test/fixtures/stats/sessions.json'
import { createServices } from '../../../../services'
import * as photoStore from '../../../../storage/photoStore'
import type { Photo, PhotoAngle } from '../../../../storage/photoStore'
import { db } from '../../../../storage/db'
import { setActiveProgramId, setBodyLog } from '../../../../storage/settingsStore'
import type { Session } from '../../../../types'
import { ServicesProvider } from '../../../ServicesProvider'
import { BodyPage } from '../../BodyPage'
import { Home } from '../../Home'
import { PROGRESS_PAGES, type ProgressPage } from '../../pages'
import { ComparePage } from '../compare/ComparePage'
import { PhotosPage } from './PhotosPage'

process.env.TZ = 'Asia/Jerusalem'

const NOW = new Date(2026, 10, 17, 9, 0).getTime()
const SETTLE = { timeout: 5000 }

function photo(id: string, day: string, angle: PhotoAngle = 'front'): Photo {
  return {
    id,
    day,
    angle,
    data: new Uint8Array([1, 2, 3]).buffer,
    type: 'image/jpeg',
    width: 10,
    height: 20,
    align: { scale: 1, rotate: 0, dx: 0, dy: 0 },
    createdAt: 1,
  }
}

function services() {
  const s = createServices({ now: () => NOW, storageAvailable: true })
  s.photos = { list: photoStore.list, add: photoStore.add, remove: photoStore.remove, restore: photoStore.restore }
  return s
}

beforeEach(async () => {
  await db.open()
  await db.photos.clear()
  await db.settings.clear()
  await db.sessions.clear()
})

describe('photos page over the real store', () => {
  test('lists the stored photos with that day’s bodyweight', async () => {
    await db.photos.bulkPut([photo('a', '2026-10-12'), photo('b', '2026-11-17')])
    await setBodyLog([{ day: '2026-11-17', weightKg: 82.2 }], NOW)
    render(
      <ServicesProvider services={services()}>
        <PhotosPage page={{ kind: 'photos' }} push={() => undefined} onBack={() => undefined} now={() => NOW} />
      </ServicesProvider>,
    )
    const region = await screen.findByRole('region', { name: 'Front photos' }, SETTLE)
    expect(within(region).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Front photo, 17 Nov, 82.2 kg',
      'Front photo, 12 Oct',
    ])
  })

  test('delete in the viewer removes the stored photo; Undo puts it back', async () => {
    await db.photos.bulkPut([photo('a', '2026-10-12'), photo('b', '2026-11-17')])
    const user = userEvent.setup()
    render(
      <ServicesProvider services={services()}>
        <PhotosPage page={{ kind: 'photos' }} push={() => undefined} onBack={() => undefined} now={() => NOW} />
      </ServicesProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'Front photo, 17 Nov' }, SETTLE))
    await user.click(screen.getByRole('button', { name: 'Delete photo, 17 Nov' }))
    await waitFor(async () => expect(await db.photos.get('b')).toBeUndefined(), SETTLE)
    expect(await screen.findByRole('heading', { name: '12 Oct' }, SETTLE)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect(await db.photos.get('b')).toBeDefined(), SETTLE)
  })

  test('Compare in the viewer pushes the Compare page with the two dates', async () => {
    await db.photos.bulkPut([photo('a', '2026-10-12'), photo('b', '2026-11-17')])
    const push = vi.fn<(page: ProgressPage) => void>()
    const user = userEvent.setup()
    render(
      <ServicesProvider services={services()}>
        <PhotosPage page={{ kind: 'photos' }} push={push} onBack={() => undefined} now={() => NOW} />
      </ServicesProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'Front photo, 17 Nov' }, SETTLE))
    await user.click(screen.getByRole('button', { name: 'Compare 12 Oct with 17 Nov' }))
    expect(push).toHaveBeenCalledWith({ kind: 'compare', angle: 'front', before: 'a', after: 'b' })
  })

  test('the Photos page is registered on the Progress tab', () => {
    expect(PROGRESS_PAGES.photos).toBe(PhotosPage)
  })
})

describe('photos page: the Compare page opens on the chosen dates', () => {
  test('Compare honours the angle and the two photos it was opened with', async () => {
    await db.photos.bulkPut([
      photo('s0', '2026-09-30', 'side'),
      photo('s1', '2026-10-12', 'side'),
      photo('s2', '2026-11-17', 'side'),
    ])
    render(
      <ServicesProvider services={services()}>
        <ComparePage
          page={{ kind: 'compare', angle: 'side', before: 's1', after: 's2' }}
          push={() => undefined}
          onBack={() => undefined}
        />
      </ServicesProvider>,
    )
    expect(await screen.findByRole('combobox', { name: 'Before date' }, SETTLE)).toHaveValue('s1')
    expect(screen.getByRole('combobox', { name: 'After date' })).toHaveValue('s2')
    expect(screen.getByRole('radio', { name: 'Side' })).toBeChecked()
  })
})

describe('photos page: the ways in', () => {
  test('DX-10 Body shows each angle\'s latest photo and See all, which opens the Photos page', async () => {
    await db.photos.bulkPut([
      photo('f1', '2026-10-12'),
      photo('f2', '2026-11-17'),
      photo('s2', '2026-11-17', 'side'),
      photo('b2', '2026-11-17', 'back'),
    ])
    const push = vi.fn<(page: ProgressPage) => void>()
    const user = userEvent.setup()
    render(
      <ServicesProvider services={services()}>
        <BodyPage page={{ kind: 'body' }} push={push} onBack={() => undefined} now={() => NOW} />
      </ServicesProvider>,
    )
    await screen.findByRole('button', { name: 'See all ›' }, SETTLE)
    const thumbs = ['Front photo', 'Side photo', 'Back photo'].map((name) => screen.getByRole('button', { name }))
    expect(thumbs).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'See all ›' }))
    expect(push).toHaveBeenCalledWith({ kind: 'photos' })
    await user.click(thumbs[1])
    expect(push).toHaveBeenCalledTimes(2)
  })

  test('DX-10 Progress has no Photos row: Photos is reached from Body only', async () => {
    const at = new Date(2026, 9, 15, 18, 5).getTime()
    await db.sessions.bulkPut(sessionsJson as unknown as Session[])
    await setActiveProgramId('assaf-ab-2026', at)
    const push = vi.fn<(page: ProgressPage) => void>()
    const user = userEvent.setup()
    render(
      <ServicesProvider services={createServices({ now: () => at, storageAvailable: true })}>
        <Home page={{ kind: 'home' }} push={push} onBack={undefined} now={() => at} />
      </ServicesProvider>,
    )
    const more = await screen.findByRole('navigation', { name: 'More' }, SETTLE)
    expect(within(more).queryByRole('button', { name: /^Photos/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Photos/ })).toBeNull()
    await user.click(within(more).getByRole('button', { name: /^Body/ }))
    expect(push).toHaveBeenCalledWith({ kind: 'body' })
  })
})
