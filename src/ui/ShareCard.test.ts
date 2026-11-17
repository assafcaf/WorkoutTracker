import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderShareCardBlob, shareCardImage } from './ShareCard'
import type { ShareCard } from '../domain/shareCard'

// E26-T4 [O12]: the PNG of the card, shared through the share sheet or downloaded. Canvas,
// navigator and the object URL are stubbed (jsdom has none). The implementation draws on a
// canvas made with document.createElement('canvas').

const CARD: ShareCard = {
  name: 'Push day',
  dateText: 'Mon 12 Oct',
  durationText: '45 min',
  lifts: [{ name: 'Bench press', topSet: '62.5 kg × 5' }],
  prs: [{ name: 'Bench press', kind: 'Heaviest weight' }],
}

let drawn: string[]
let blobTypes: (string | undefined)[]

beforeEach(() => {
  drawn = []
  blobTypes = []
  const ctx = new Proxy(
    { fillText: (text: string) => void drawn.push(String(text)), measureText: () => ({ width: 10 }) },
    { get: (target, key) => (key in target ? (target as never)[key] : () => undefined), set: () => true },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(((cb: BlobCallback, type?: string) => {
    blobTypes.push(type)
    cb(new Blob(['png'], { type: type ?? 'image/png' }))
  }) as never)
  URL.createObjectURL = vi.fn(() => 'blob:card')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
})

test('O12 the card renders to a PNG blob that draws the name, date, duration, top set and PR tag', async () => {
  const blob = await renderShareCardBlob(CARD)
  expect(blob.type).toBe('image/png')
  expect(blobTypes).toContain('image/png')
  const text = drawn.join('|')
  for (const part of ['Push day', 'Mon 12 Oct', '45 min', 'Bench press', '62.5 kg × 5', 'Heaviest weight']) {
    expect(text).toContain(part)
  }
})

test('O12 where the share sheet accepts files, the PNG goes through navigator.share', async () => {
  const share = vi.fn(() => Promise.resolve())
  const canShare = vi.fn(() => true)
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

  expect(await shareCardImage(CARD)).toBe('shared')

  expect(share).toHaveBeenCalledTimes(1)
  const arg = (share.mock.calls[0] as unknown as [{ files: File[] }])[0]
  expect(arg.files).toHaveLength(1)
  expect(arg.files[0].type).toBe('image/png')
  expect(arg.files[0].name).toMatch(/\.png$/)
  expect(click).not.toHaveBeenCalled()
})

test('O12 where the share sheet refuses files, the PNG downloads through an anchor', async () => {
  const share = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true })
  const downloads: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download)
  })

  expect(await shareCardImage(CARD)).toBe('downloaded')

  expect(share).not.toHaveBeenCalled()
  expect(downloads).toHaveLength(1)
  expect(downloads[0]).toMatch(/\.png$/)
})

test('O12 with no Web Share API at all, the PNG downloads', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  expect(await shareCardImage(CARD)).toBe('downloaded')
  expect(click).toHaveBeenCalledTimes(1)
})
