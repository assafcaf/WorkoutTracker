import { withBom, writeCsv } from './csv'
import type { Exercise, Program, Session } from '../types'

export const SETS_CSV_HEADER = [
  'date',
  'program',
  'workout',
  'exercise',
  'set index',
  'kind',
  'weight kg',
  'reps',
  'rir',
  'e1RM',
  'session note',
]

const guard = (t: string): string => (/^[=+\-@]/.test(t) ? `'${t}` : t)
const pad = (n: number): string => String(n).padStart(2, '0')
const num = (n: number): string => String(n)

/** The header plus one row per Set of every finished, live Session, oldest first (E23). */
export function setsCsvRows(sessions: Session[], programs: Program[], exercises: Exercise[]): string[][] {
  const out: string[][] = [SETS_CSV_HEADER.slice()]
  const live = sessions
    .filter((s) => s.finishedAt != null && s.deletedAt == null)
    .sort((a, b) => a.startedAt - b.startedAt)
  for (const s of live) {
    const d = new Date(s.startedAt)
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    const program = programs.find((p) => p.id === s.programId)
    const workout = program?.workouts.find((w) => w.id === s.workoutId)
    const order: string[] = []
    for (const e of s.entries) if (!order.includes(e.exerciseId)) order.push(e.exerciseId)
    for (const id of order) {
      const ex = exercises.find((x) => x.id === id)
      const sets = s.entries.filter((e) => e.exerciseId === id).sort((a, b) => a.setIndex - b.setIndex)
      for (const e of sets) {
        const bw = ex?.bodyweight === true
        const weight = bw ? e.loadKg ?? null : e.weightKg
        const kind = e.kind ?? 'working'
        const e1rm =
          !bw && kind !== 'warmup' && e.weightKg != null && e.weightKg > 0
            ? num(Math.round(e.weightKg * (1 + e.reps / 30) * 10) / 10)
            : ''
        out.push([
          date,
          guard(program?.name ?? s.programId),
          guard(workout?.name ?? s.workoutId),
          guard(ex?.name ?? id),
          num(e.setIndex),
          kind,
          weight == null ? '' : num(weight),
          num(e.reps),
          e.rir == null ? '' : num(e.rir),
          e1rm,
          guard(s.note ?? ''),
        ])
      }
    }
  }
  return out
}

/** The sets CSV as file text, BOM first. */
export function setsCsvText(sessions: Session[], programs: Program[], exercises: Exercise[]): string {
  return withBom(writeCsv(setsCsvRows(sessions, programs, exercises)))
}

/** `workout-sets-YYYY-MM-DD.csv`, the local date of `now`. */
export function setsCsvFileName(now: Date): string {
  return `workout-sets-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`
}
