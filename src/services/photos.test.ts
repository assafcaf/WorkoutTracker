// E26-T7: the photos service over photoStore and the fake IndexedDB.
import { beforeEach, describe, expect, test } from 'vitest'
import { db } from '../storage/db'
import type { ImageIo } from '../storage/photoImage'
import { createChangeBus } from './changes'
import { createPhotoService } from './photos'

const io: ImageIo = {
  decode: async () => ({ width: 800, height: 600 }),
  render: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
}

function make(storageAvailable = true) {
  const bus = createChangeBus()
  let fired = 0
  bus.subscribe('preferences', () => (fired += 1))
  const service = createPhotoService({ now: () => 1, bus, storageAvailable }, io)
  return { service, fired: () => fired }
}

const input = (day: string) => ({
  file: new Blob(['x'], { type: 'image/jpeg' }),
  day,
  angle: 'front' as const,
  align: null,
})

beforeEach(async () => {
  await db.open()
  await db.photos.clear()
})

describe('E26-T7 O1 the photos service', () => {
  test('O1 add stores a photo, list returns newest day first, and each write announces a change', async () => {
    const { service, fired } = make()
    await service.add(input('2026-11-01'))
    const newer = await service.add(input('2026-11-10'))
    expect((await service.list()).map((p) => p.day)).toEqual(['2026-11-10', '2026-11-01'])
    expect(fired()).toBe(2)
    await service.remove(newer.id)
    expect(await service.list()).toHaveLength(1)
    await service.restore(newer)
    expect(await service.list()).toHaveLength(2)
    expect(fired()).toBe(4)
  })

  test('O1 a write with storage unavailable is a ServiceError', async () => {
    const { service } = make(false)
    await expect(service.add(input('2026-11-01'))).rejects.toMatchObject({ code: 'storage-unavailable' })
  })

  test('photos v2: add keeps the capture fields and list returns them', async () => {
    const { service } = make()
    const info = {
      camera: 'environment' as const,
      roll: 0.5,
      pitch: -1,
      bodyScale: { full: 0.6, torso: 0.2 },
      source: 'live' as const,
      streamWidth: 1440,
      streamHeight: 1920,
    }
    await service.add({ ...input('2026-11-12'), ...info })
    const [back] = await service.list()
    expect(back).toMatchObject(info)
  })
})
