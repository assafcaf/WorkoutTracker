import type { Photo, PhotoAngle } from '../../../../storage/photoStore'
import type { BodyLog } from '../../../../types'
import { daysApart } from '../compare/summary'

/** How long each photo holds in the timelapse. */
export const PLAY_MS = 800

export const ANGLE_NAMES: Record<PhotoAngle, string> = { front: 'Front', side: 'Side', back: 'Back' }

/** What the viewer's Compare asks for: an angle and two of its photos, by id. */
export type CompareRequest = { angle: PhotoAngle; before: string; after: string }

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** One angle's photos in time order: oldest day first, then in the order they were taken. */
export function photosOfAngle(photos: Photo[], angle: PhotoAngle): Photo[] {
  return photos
    .filter((p) => p.angle === angle)
    .sort((a, b) => a.day.localeCompare(b.day) || a.createdAt - b.createdAt)
}

export type TimelineMonth = { key: string; label: string; photos: Photo[] }

/** One angle's photos grouped by calendar month, newest month and newest photo first. */
export function timelineMonths(photos: Photo[], angle: PhotoAngle): TimelineMonth[] {
  const months: TimelineMonth[] = []
  for (const photo of [...photosOfAngle(photos, angle)].reverse()) {
    const key = photo.day.slice(0, 7)
    let month = months[months.length - 1]
    if (!month || month.key !== key) {
      const [y, m] = key.split('-').map(Number)
      month = { key, label: `${MONTHS[m - 1]} ${y}`, photos: [] }
      months.push(month)
    }
    month.photos.push(photo)
  }
  return months
}

/** The bodyweight logged on that very day, else null. */
export function weightOnDay(log: BodyLog, day: string): number | null {
  return log.find((e) => e.day === day)?.weightKg ?? null
}

/** The latest bodyweight logged on or before a day. */
function weightBy(log: BodyLog, day: string): number | null {
  let found: number | null = null
  for (const entry of [...log].sort((a, b) => a.day.localeCompare(b.day))) {
    if (entry.day > day) break
    if (entry.weightKg !== undefined) found = entry.weightKg
  }
  return found
}

/** A signed change in kg, one decimal, with a true minus: "−2.1 kg"; null when it did not move. */
export function weightChange(log: BodyLog, from: string, to: string): string | null {
  const a = weightBy(log, from)
  const b = weightBy(log, to)
  if (a === null || b === null) return null
  const delta = Math.round((b - a) * 10) / 10
  if (delta === 0) return null
  return `${delta < 0 ? '−' : '+'}${Math.abs(delta)} kg`
}

/** The viewer's "Δ since first" line: days since the angle's first photo and the weight change. */
export function sinceFirst(first: Photo, current: Photo, log: BodyLog): string {
  if (first.id === current.id) return 'First photo'
  const days = daysApart(first.day, current.day)
  const kg = weightChange(log, first.day, current.day)
  const text = `${days} ${days === 1 ? 'day' : 'days'} since first`
  return kg ? `${text} · ${kg}` : text
}
