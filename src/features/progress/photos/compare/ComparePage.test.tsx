// E26-T8 [O5]: delete a progress photo, with an Undo that lasts, over the real photo store.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { createServices } from '../../../../services'
import * as photoStore from '../../../../storage/photoStore'
import type { Photo } from '../../../../storage/photoStore'
import { db } from '../../../../storage/db'
import { ServicesProvider } from '../../../ServicesProvider'
import { ComparePage } from './ComparePage'

process.env.TZ = 'Asia/Jerusalem'

const SETTLE = { timeout: 5000 }

function photo(id: string, day: string): Photo {
  return {
    id,
    day,
    angle: 'front',
    data: new Uint8Array([1, 2, 3]).buffer,
    type: 'image/jpeg',
    width: 10,
    height: 20,
    align: { scale: 1, rotate: 0, dx: 0, dy: 0 },
    createdAt: 1,
  }
}

beforeEach(async () => {
  await db.open()
  await db.photos.clear()
  await db.photos.bulkPut([photo('a', '2026-10-12'), photo('b', '2026-11-17')])
})

async function mount(undoMs = 8000) {
  const services = createServices({ now: () => Date.now(), storageAvailable: true })
  services.photos = {
    list: photoStore.list,
    add: photoStore.add,
    remove: photoStore.remove,
    restore: photoStore.restore,
  }
  const user = userEvent.setup()
  render(
    <ServicesProvider services={services}>
      <ComparePage page={{ kind: 'compare' }} push={() => undefined} onBack={() => undefined} undoMs={undoMs} />
    </ServicesProvider>,
  )
  await screen.findByRole('button', { name: 'Delete after photo' }, SETTLE)
  return user
}

describe('E26-T8 O5 deleting a photo', () => {
  test('O5 delete removes the photo and offers Undo, which puts it back', async () => {
    const user = await mount()
    await user.click(screen.getByRole('button', { name: 'Delete after photo' }))
    await waitFor(async () => expect(await db.photos.get('b')).toBeUndefined(), SETTLE)
    await user.click(await screen.findByRole('button', { name: 'Undo' }, SETTLE))
    await waitFor(async () => expect(await db.photos.get('b')).toBeDefined(), SETTLE)
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  test('O5 once the Undo window has passed the photo stays gone', async () => {
    const user = await mount(60)
    await user.click(screen.getByRole('button', { name: 'Delete after photo' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull(), SETTLE)
    expect(await db.photos.get('b')).toBeUndefined()
    expect(await db.photos.get('a')).toBeDefined()
  })
})

describe('mirror mode: compare flips a mirror photo next to a stand one', () => {
  test('the mirror photo is drawn flipped against a stand photo; Flip turns the after photo over too', async () => {
    await db.photos.clear()
    await db.photos.bulkPut([photo('a', '2026-10-12'), { ...photo('b', '2026-11-17'), mode: 'mirror' }])
    const user = await mount()
    const frames = () => [...screen.getByTestId('compare-wipe').querySelectorAll('img')]
    await waitFor(() => expect(frames().map((img) => img.getAttribute('data-flipped'))).toEqual(['false', 'true']))
    expect(frames()[1].style.transform).toBe('scaleX(-1) translate(0%, 0%) rotate(0deg) scale(1)')
    expect(screen.getByText('Mirror')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Flip' }))
    expect(frames().map((img) => img.getAttribute('data-flipped'))).toEqual(['false', 'false'])
  })

  test('two photos of the same mode are never flipped', async () => {
    await mount()
    const flips = [...screen.getByTestId('compare-wipe').querySelectorAll('img')].map((img) => img.getAttribute('data-flipped'))
    expect(flips).toEqual(['false', 'false'])
    expect(screen.queryByText('Mirror')).toBeNull()
  })
})
