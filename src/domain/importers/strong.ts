import type { SetKind } from '../../types'
import { headerIndex, parseCsv } from '../csv'
import type { ImportDraft, ParseResult } from './types'
import { lbsToKg, rirFromRpe } from './units'

const REQUIRED = ['Date', 'Exercise Name', 'Set Order', 'Reps']
const OPTIONAL = [
  'Workout Name',
  'Duration',
  'Duration (sec)',
  'Workout Duration',
  'Weight',
  'Weight (kg)',
  'Weight (lbs)',
  'Weight Unit',
  'RPE',
  'Workout Notes',
]

const KINDS: Record<string, SetKind> = { w: 'warmup', d: 'drop', f: 'failure' }

function parseDate(s: string): number {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s.trim())
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)).getTime()
  return new Date(s).getTime()
}

/** Seconds from `1h 5m`, `45m`, `1h 5m 3s`, or a bare number of seconds. */
function parseDuration(s: string): number {
  const t = s.trim().toLowerCase()
  if (!t) return 0
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t)
  let secs = 0
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*([hms])/g)) {
    secs += Number(m[1]) * (m[2] === 'h' ? 3600 : m[2] === 'm' ? 60 : 1)
  }
  return secs
}

function num(s: string | undefined): number | null {
  if (s == null || s.trim() === '') return null
  const n = Number(s.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function parseStrong(text: string, unit: 'kg' | 'lbs' = 'kg'): ParseResult {
  const rows = parseCsv(text)
  if (rows.length === 0) throw new Error('Missing column: Date')
  const col = headerIndex(rows[0], REQUIRED, OPTIONAL)
  const weightCol = col['Weight (kg)'] ?? col['Weight (lbs)'] ?? col['Weight']
  const headerUnit: 'kg' | 'lbs' | null =
    col['Weight (kg)'] != null ? 'kg' : col['Weight (lbs)'] != null ? 'lbs' : null
  const stated = headerUnit != null || col['Weight Unit'] != null

  const drafts: ImportDraft[] = []
  const byKey = new Map<string, ImportDraft>()
  let leftOut = 0

  for (const r of rows.slice(1)) {
    if (r.every((f) => f.trim() === '')) continue
    const get = (name: string) => (col[name] != null ? (r[col[name]] ?? '') : '')
    const order = get('Set Order').trim()
    const reps = num(get('Reps'))
    const startedAt = parseDate(get('Date'))
    if (order.toLowerCase() === 'rest timer' || reps == null || reps <= 0 || Number.isNaN(startedAt)) {
      leftOut++
      continue
    }
    const workoutName = get('Workout Name').trim()
    const key = `${get('Date').trim()}\u0000${workoutName}`
    let draft = byKey.get(key)
    if (!draft) {
      const dur = parseDuration(get('Duration') || get('Duration (sec)') || get('Workout Duration'))
      draft = { workoutName, startedAt, finishedAt: startedAt + dur * 1000, sets: [] }
      const note = get('Workout Notes').trim()
      if (note) draft.note = note
      byKey.set(key, draft)
      drafts.push(draft)
    }

    let weightKg: number | null = null
    const w = weightCol != null ? num(r[weightCol]) : null
    if (w != null) {
      let rowUnit: 'kg' | 'lbs' = unit
      if (headerUnit != null) rowUnit = headerUnit
      else if (col['Weight Unit'] != null) {
        rowUnit = get('Weight Unit').trim().toLowerCase().startsWith('lb') ? 'lbs' : 'kg'
      }
      weightKg = rowUnit === 'lbs' ? lbsToKg(w) : w
    }

    const set: ImportDraft['sets'][number] = { name: get('Exercise Name').trim(), weightKg, reps }
    const kind = KINDS[order.toLowerCase()]
    if (kind) set.kind = kind
    const rir = rirFromRpe(num(get('RPE')))
    if (rir != null) set.rir = rir
    draft.sets.push(set)
  }

  return { drafts, leftOut, unit: stated ? 'stated' : 'unstated' }
}
