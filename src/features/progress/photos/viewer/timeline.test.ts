// Photos viewer: the pure model under the Photos page and the full-screen viewer.
import { describe, expect, test } from 'vitest'
import type { Photo, PhotoAngle } from '../../../../storage/photoStore'
import type { BodyLog } from '../../../../types'
import { photosOfAngle, sinceFirst, timelineMonths, weightOnDay } from './timeline'

process.env.TZ = 'Asia/Jerusalem'

function photo(id: string, day: string, angle: PhotoAngle = 'front', createdAt = 1): Photo {
  return {
    id,
    day,
    angle,
    data: new Uint8Array([1]).buffer,
    type: 'image/jpeg',
    width: 3,
    height: 4,
    align: null,
    createdAt,
  }
}

const PHOTOS = [
  photo('f2', '2026-11-17'),
  photo('s1', '2026-10-12', 'side'),
  photo('f1', '2026-10-12'),
  photo('f0', '2026-09-30'),
  photo('f2b', '2026-11-17', 'front', 5),
]

describe('photos viewer: one angle in time order', () => {
  test('photosOfAngle keeps one angle, oldest day first, then by when it was taken', () => {
    expect(photosOfAngle(PHOTOS, 'front').map((p) => p.id)).toEqual(['f0', 'f1', 'f2', 'f2b'])
    expect(photosOfAngle(PHOTOS, 'side').map((p) => p.id)).toEqual(['s1'])
    expect(photosOfAngle(PHOTOS, 'back')).toEqual([])
  })

  test('timelineMonths groups the angle newest-first by month, with a month label', () => {
    const months = timelineMonths(PHOTOS, 'front')
    expect(months.map((m) => m.label)).toEqual(['November 2026', 'October 2026', 'September 2026'])
    expect(months[0].photos.map((p) => p.id)).toEqual(['f2b', 'f2'])
    expect(months[2].photos.map((p) => p.id)).toEqual(['f0'])
  })
})

describe('photos viewer: bodyweight and the change since the first photo', () => {
  const log: BodyLog = [
    { day: '2026-09-30', weightKg: 84.3 },
    { day: '2026-10-20', waistCm: 90 },
    { day: '2026-11-17', weightKg: 82.2 },
  ]

  test('weightOnDay is the bodyweight logged that very day, else null', () => {
    expect(weightOnDay(log, '2026-09-30')).toBe(84.3)
    expect(weightOnDay(log, '2026-10-20')).toBeNull()
    expect(weightOnDay(log, '2026-10-12')).toBeNull()
  })

  test('sinceFirst names the first photo as such', () => {
    expect(sinceFirst(PHOTOS[3], PHOTOS[3], log)).toBe('First photo')
  })

  test('sinceFirst counts the days and, when both days have a weight, the signed change', () => {
    expect(sinceFirst(PHOTOS[3], PHOTOS[0], log)).toBe('48 days since first · −2.1 kg')
  })

  test('sinceFirst uses the latest weight on or before each day, and leaves weight out when there is none', () => {
    // 12 Oct has no weight of its own; 30 Sep's 84.3 still stands, so there is no change.
    expect(sinceFirst(PHOTOS[3], PHOTOS[2], log)).toBe('12 days since first')
    expect(sinceFirst(PHOTOS[3], PHOTOS[0], [])).toBe('48 days since first')
  })
})
