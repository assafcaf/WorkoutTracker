import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from './db'
import { MAX_PHOTO_SIDE, encodePhoto, fitWithin, type ImageIo } from './photoImage'
import * as photoStore from './photoStore'
import { getPersistenceAnswer } from './persist'

// `fake-indexeddb/auto` is installed globally in src/test/setup.ts.

/** The bytes of a Blob; jsdom's Blob has no reliable `.text()`. */
function bytesOf(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

/** A camera file: a JPEG header, an EXIF block with GPS, then pixels. */
const CAMERA_FILE = new Blob(['\xff\xd8\xff\xe1', 'Exif\0\0', 'GPSLatitude=32.08', 'PIXELS'], {
  type: 'image/jpeg',
})

/** An ImageIo double: decode reports `size`, render returns metadata-free JPEG bytes. */
function fakeIo(size: { width: number; height: number }) {
  const rendered: { width: number; height: number }[] = []
  const io: ImageIo = {
    decode: async () => size,
    render: async (_file, target) => {
      rendered.push(target)
      return new Blob(['\xff\xd8\xff\xdb', 'CLEANPIXELS'], { type: 'image/jpeg' })
    },
  }
  return { io, rendered }
}

const ALIGN = { scale: 1.25, rotate: -3.5, dx: 12, dy: -40 }

function stubStorage(opts: { persisted?: boolean; grant?: boolean }) {
  const persist = vi.fn(async () => opts.grant ?? true)
  const persisted = vi.fn(async () => opts.persisted ?? false)
  Object.defineProperty(navigator, 'storage', {
    value: { persist, persisted },
    configurable: true,
  })
  return { persist, persisted }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(() => {
  db.close()
  Reflect.deleteProperty(navigator, 'storage')
})

describe('O1 saved photo survives a restart', () => {
  test('photo, angle, day and alignment are read back unchanged after the database is reopened', async () => {
    stubStorage({})
    const { io } = fakeIo({ width: 1200, height: 1600 })
    const saved = await photoStore.add(
      { file: CAMERA_FILE, day: '2026-11-17', angle: 'side', align: ALIGN },
      io,
    )

    db.close()
    await db.open()

    const [back] = await photoStore.list()
    expect(back.id).toBe(saved.id)
    expect(back.day).toBe('2026-11-17')
    expect(back.angle).toBe('side')
    expect(back.align).toEqual(ALIGN)
    expect(back.width).toBe(1200)
    expect(back.height).toBe(1600)
    // fake-indexeddb clones a jsdom Blob into a plain object, so its bytes cannot be read back here.
    expect(back.blob).toBeTruthy()
  })

  test('an unaligned photo reads back with align null', async () => {
    stubStorage({})
    const { io } = fakeIo({ width: 800, height: 600 })
    await photoStore.add({ file: CAMERA_FILE, day: '2026-11-17', angle: 'front', align: null }, io)
    const [back] = await photoStore.list()
    expect(back.align).toBeNull()
  })

  test('list is newest day first', async () => {
    stubStorage({})
    const { io } = fakeIo({ width: 800, height: 600 })
    for (const day of ['2026-10-01', '2026-11-17', '2026-10-20']) {
      await photoStore.add({ file: CAMERA_FILE, day, angle: 'front', align: null }, io)
    }
    expect((await photoStore.list()).map((p) => p.day)).toEqual([
      '2026-11-17',
      '2026-10-20',
      '2026-10-01',
    ])
  })

  test('a store with no photos lists none', async () => {
    expect(await photoStore.list()).toEqual([])
  })
})

describe('O2 stored image has no EXIF and is at most 1600 px', () => {
  test('the stored blob is the re-encoded one, with no Exif or GPS bytes', async () => {
    stubStorage({})
    const { io } = fakeIo({ width: 3000, height: 4000 })
    const saved = await photoStore.add(
      { file: CAMERA_FILE, day: '2026-11-17', angle: 'back', align: null },
      io,
    )
    const stored = await bytesOf(saved.blob)
    expect(stored).not.toContain('Exif')
    expect(stored).not.toContain('GPS')
  })

  test('a 3000x4000 camera photo is rendered and stored at 1200x1600', async () => {
    stubStorage({})
    const { io, rendered } = fakeIo({ width: 3000, height: 4000 })
    const saved = await photoStore.add(
      { file: CAMERA_FILE, day: '2026-11-17', angle: 'front', align: null },
      io,
    )
    expect(rendered).toEqual([{ width: 1200, height: 1600 }])
    expect([saved.width, saved.height]).toEqual([1200, 1600])
  })

  test('fitWithin keeps the ratio and caps the longest side, landscape and portrait', () => {
    expect(MAX_PHOTO_SIDE).toBe(1600)
    expect(fitWithin({ width: 4000, height: 3000 })).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin({ width: 3000, height: 4000 })).toEqual({ width: 1200, height: 1600 })
  })

  test('fitWithin leaves a photo already within 1600 px unchanged, boundary included', () => {
    expect(fitWithin({ width: 1600, height: 900 })).toEqual({ width: 1600, height: 900 })
    expect(fitWithin({ width: 640, height: 480 })).toEqual({ width: 640, height: 480 })
  })

  test('encodePhoto renders a small photo at its own size, never upscaled', async () => {
    const { io, rendered } = fakeIo({ width: 640, height: 480 })
    const out = await encodePhoto(CAMERA_FILE, io)
    expect(rendered).toEqual([{ width: 640, height: 480 }])
    expect([out.width, out.height]).toEqual([640, 480])
  })
})

describe('O3 the first save asks iOS once to keep the data', () => {
  const input = { file: CAMERA_FILE, day: '2026-11-17', angle: 'front' as const, align: null }

  test('the first save calls persist() once and records the grant', async () => {
    const { persist } = stubStorage({ grant: true })
    const { io } = fakeIo({ width: 800, height: 600 })
    await photoStore.add(input, io)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(await getPersistenceAnswer()).toBe(true)
  })

  test('a granted answer is not asked for again on the next save', async () => {
    const { persist } = stubStorage({ grant: true })
    const { io } = fakeIo({ width: 800, height: 600 })
    await photoStore.add(input, io)
    await photoStore.add(input, io)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  test('a refusal is recorded and never asked again, even after a restart', async () => {
    const { persist } = stubStorage({ grant: false })
    const { io } = fakeIo({ width: 800, height: 600 })
    await photoStore.add(input, io)
    expect(await getPersistenceAnswer()).toBe(false)

    db.close()
    await db.open()
    await photoStore.add(input, io)
    await photoStore.add(input, io)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(await getPersistenceAnswer()).toBe(false)
  })

  test('storage that is already persistent is not asked', async () => {
    const { persist } = stubStorage({ persisted: true })
    const { io } = fakeIo({ width: 800, height: 600 })
    await photoStore.add(input, io)
    expect(persist).not.toHaveBeenCalled()
  })

  test('nothing is recorded before any photo is saved', async () => {
    stubStorage({})
    expect(await getPersistenceAnswer()).toBeNull()
  })

  test('a browser without navigator.storage still saves the photo', async () => {
    const { io } = fakeIo({ width: 800, height: 600 })
    await photoStore.add(input, io)
    expect(await photoStore.list()).toHaveLength(1)
  })
})

describe('O5 store half: remove and restore', () => {
  test('remove deletes the photo and restore brings it back exactly as it was', async () => {
    stubStorage({})
    const { io } = fakeIo({ width: 800, height: 600 })
    const saved = await photoStore.add(
      { file: CAMERA_FILE, day: '2026-11-17', angle: 'side', align: ALIGN },
      io,
    )

    await photoStore.remove(saved.id)
    expect(await photoStore.list()).toEqual([])

    await photoStore.restore(saved)
    const [back] = await photoStore.list()
    expect(back.id).toBe(saved.id)
    expect(back.day).toBe('2026-11-17')
    expect(back.angle).toBe('side')
    expect(back.align).toEqual(ALIGN)
    expect(back.createdAt).toBe(saved.createdAt)
  })

  test('remove of an unknown id leaves the other photos alone', async () => {
    stubStorage({})
    const { io } = fakeIo({ width: 800, height: 600 })
    await photoStore.add({ file: CAMERA_FILE, day: '2026-11-17', angle: 'front', align: null }, io)
    await photoStore.remove('no-such-photo')
    expect(await photoStore.list()).toHaveLength(1)
  })
})
