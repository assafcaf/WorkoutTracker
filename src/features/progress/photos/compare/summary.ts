import { seriesFor } from '../../../../domain/series'
import type { BodyLog, BodyMetric, Exercise, Session } from '../../../../types'

const DAY_MS = 86_400_000

/** Local midnight of a YYYY-MM-DD day. */
function midnightOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Whole calendar days between two YYYY-MM-DD days (rounded, so a DST shift does not move it). */
export function daysApart(before: string, after: string): number {
  return Math.round((midnightOf(after) - midnightOf(before)) / DAY_MS)
}

/** The latest value of a metric logged on or before `day`. */
function latest(log: BodyLog, metric: BodyMetric, day: string): number | null {
  let found: number | null = null
  for (const entry of [...log].sort((a, b) => a.day.localeCompare(b.day))) {
    if (entry.day > day) break
    if (entry[metric] !== undefined) found = entry[metric] as number
  }
  return found
}

const trim = (n: number): string => String(Math.round(n * 10) / 10)
const signed = (n: number): string => `${n < 0 ? '−' : '+'}${trim(Math.abs(n))}`
const moved = (n: number): boolean => Math.round(n * 10) !== 0

/**
 * What changed between two photo days, as short phrases: bodyweight, waist, and the lift whose
 * Est. strength moved most. A phrase appears only when both days have a value to compare.
 */
export function changeParts(input: {
  before: string
  after: string
  log: BodyLog
  sessions: Session[]
  exercises: Exercise[]
}): string[] {
  const { before, after, log, sessions, exercises } = input
  const parts: string[] = []

  const w0 = latest(log, 'weightKg', before)
  const w1 = latest(log, 'weightKg', after)
  if (w0 !== null && w1 !== null && moved(w1 - w0)) parts.push(`${signed(w1 - w0)} kg`)

  const c0 = latest(log, 'waistCm', before)
  const c1 = latest(log, 'waistCm', after)
  if (c0 !== null && c1 !== null && moved(c1 - c0)) parts.push(`waist ${signed(c1 - c0)} cm`)

  const endOf = (day: string): number => midnightOf(day) + DAY_MS
  let best: { name: string; delta: number } | null = null
  for (const exercise of exercises) {
    const series = seriesFor(exercise, sessions)
    if (series.kind !== 'e1rm') continue
    const upTo = (day: string): number | null => {
      const points = series.points.filter((p) => p.at < endOf(day))
      return points.length === 0 ? null : points[points.length - 1].value
    }
    const a = upTo(before)
    const b = upTo(after)
    if (a === null || b === null) continue
    const delta = b - a
    if (moved(delta) && (best === null || Math.abs(delta) > Math.abs(best.delta))) {
      best = { name: exercise.name, delta }
    }
  }
  if (best) parts.push(`${best.name} Est. strength ${signed(best.delta)} kg`)
  return parts
}
