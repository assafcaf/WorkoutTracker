import type { SetKind } from '../../types'
import { headerIndex, parseCsv } from '../csv'
import type { ImportDraft, ImportDraftSet, ParseResult } from './types'
import { lbsToKg, rirFromRpe } from './units'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const KINDS: Record<string, SetKind> = { warmup: 'warmup', dropset: 'drop', failure: 'failure' }

/** `15 Jan 2026, 18:05` or `2026-01-15 18:05:00`, read as local time. NaN when unreadable. */
function parseTime(s: string): number {
  const t = s.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime()
  m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t)
  if (m) {
    const mon = MONTHS.indexOf(m[2].toLowerCase())
    if (mon >= 0) return new Date(+m[3], mon, +m[1], +m[4], +m[5], +(m[6] ?? 0)).getTime()
  }
  return NaN
}

function num(s: string | undefined): number | null {
  if (s == null || s.trim() === '') return null
  const n = Number(s.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function parseHevy(text: string): ParseResult {
  const rows = parseCsv(text)
  if (rows.length === 0) throw new Error('Missing column: title')
  const header = rows[0]
  const norm = header.map((h) => h.trim().toLowerCase())
  const lbs = !norm.includes('weight_kg') && norm.includes('weight_lbs')
  const weightCol = lbs ? 'weight_lbs' : 'weight_kg'
  const ix = headerIndex(
    header,
    ['title', 'start_time', 'exercise_title', 'reps', weightCol],
    ['end_time', 'description', 'set_type', 'rpe'],
  )
  const cell = (r: string[], name: string): string => (name in ix ? (r[ix[name]] ?? '') : '')

  const drafts = new Map<string, ImportDraft>()
  let leftOut = 0
  for (const r of rows.slice(1)) {
    if (r.every((c) => c.trim() === '')) continue
    const reps = num(cell(r, 'reps'))
    if (reps == null || reps <= 0) {
      leftOut++
      continue
    }
    const startRaw = cell(r, 'start_time')
    const title = cell(r, 'title')
    const key = `${startRaw}\u0000${title}`
    let d = drafts.get(key)
    if (!d) {
      const startedAt = parseTime(startRaw)
      const endedAt = parseTime(cell(r, 'end_time'))
      d = {
        workoutName: title,
        startedAt,
        finishedAt: Number.isFinite(endedAt) ? endedAt : startedAt,
        sets: [],
      }
      const note = cell(r, 'description').trim()
      if (note) d.note = note
      drafts.set(key, d)
    }
    const w = num(cell(r, weightCol))
    const set: ImportDraftSet = {
      name: cell(r, 'exercise_title'),
      weightKg: w == null ? null : lbs ? lbsToKg(w) : w,
      reps,
    }
    const kind = KINDS[cell(r, 'set_type').trim().toLowerCase()]
    if (kind) set.kind = kind
    const rir = rirFromRpe(num(cell(r, 'rpe')))
    if (rir !== undefined) set.rir = rir
    d.sets.push(set)
  }
  return { drafts: [...drafts.values()], leftOut, unit: 'stated' }
}
