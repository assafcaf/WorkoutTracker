import type { BodyEntry, BodyLog, BodyMetric } from '../types'

/** The local `YYYY-MM-DD` of `ms`. */
export function dayOf(_ms: number): string {
  throw new Error('NotImplementedError')
}

/** The entry rounded and trimmed, or `null` when refused. `now` is the clock for "after today". */
export function validateBodyEntry(_raw: unknown, _now: number = Date.now()): BodyEntry | null {
  throw new Error('NotImplementedError')
}

/** The valid entries of a stored value, one per day, oldest first; `[]` for a non-array. */
export function validateBodyLog(_raw: unknown, _now: number = Date.now()): BodyLog {
  throw new Error('NotImplementedError')
}

export function upsertBodyEntry(_log: BodyLog, _entry: BodyEntry): BodyLog {
  throw new Error('NotImplementedError')
}

export function removeBodyEntry(_log: BodyLog, _day: string): BodyLog {
  throw new Error('NotImplementedError')
}

export function bodyweightOn(_log: BodyLog, _at: number): { kg: number; day: string } | null {
  throw new Error('NotImplementedError')
}

export function bodySeries(_log: BodyLog, _metric: BodyMetric): { at: number; value: number }[] {
  throw new Error('NotImplementedError')
}
