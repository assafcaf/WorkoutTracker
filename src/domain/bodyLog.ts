import type { BodyEntry, BodyLog, BodyMetric } from '../types'

const METRICS: BodyMetric[] = ['weightKg', 'waistCm', 'chestCm', 'armsCm', 'thighsCm']
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const pad = (n: number) => String(n).padStart(2, '0')

/** The local `YYYY-MM-DD` of `ms`. */
export function dayOf(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function midnightOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

function isRealDay(day: unknown): day is string {
  if (typeof day !== 'string' || !DAY_RE.test(day)) return false
  return dayOf(midnightOf(day)) === day
}

/** The entry rounded and trimmed, or `null` when refused. `now` is the clock for "after today". */
export function validateBodyEntry(raw: unknown, now: number = Date.now()): BodyEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const src = raw as Record<string, unknown>
  if (!isRealDay(src.day) || src.day > dayOf(now)) return null
  const out: BodyEntry = { day: src.day }
  let any = false
  for (const metric of METRICS) {
    const v = src[metric]
    if (v === undefined) continue
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    const [lo, hi] = metric === 'weightKg' ? [20, 400] : [10, 300]
    if (v < lo || v > hi) return null
    out[metric] = Math.round(v * 10) / 10
    any = true
  }
  return any ? out : null
}

/** The valid entries of a stored value, one per day, oldest first; `[]` for a non-array. */
export function validateBodyLog(raw: unknown, now: number = Date.now()): BodyLog {
  if (!Array.isArray(raw)) return []
  let log: BodyLog = []
  for (const item of raw) {
    const e = validateBodyEntry(item, now)
    if (e) log = upsertBodyEntry(log, e)
  }
  return log
}

export function upsertBodyEntry(log: BodyLog, entry: BodyEntry): BodyLog {
  const rest = log.filter((e) => e.day !== entry.day)
  const at = rest.findIndex((e) => e.day > entry.day)
  if (at < 0) return [...rest, entry]
  return [...rest.slice(0, at), entry, ...rest.slice(at)]
}

export function removeBodyEntry(log: BodyLog, day: string): BodyLog {
  return log.filter((e) => e.day !== day)
}

export function bodyweightOn(log: BodyLog, at: number): { kg: number; day: string } | null {
  const today = dayOf(at)
  let found: { kg: number; day: string } | null = null
  for (const e of log) {
    if (e.day > today) break
    if (e.weightKg !== undefined) found = { kg: e.weightKg, day: e.day }
  }
  return found
}

export function bodySeries(log: BodyLog, metric: BodyMetric): { at: number; value: number }[] {
  const out: { at: number; value: number }[] = []
  for (const e of log) {
    const value = e[metric]
    if (value !== undefined) out.push({ at: midnightOf(e.day), value })
  }
  return out
}
