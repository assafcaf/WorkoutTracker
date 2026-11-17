// E26-T4 [O11]: the plain data of the share card, from a finished Session.
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'
import { countsTowardStats } from './setKind'
import { humanDate, topText } from './stats/copy'
import { computeRecords, sessionPrs } from './stats/records'
import type { RecordKindName } from './stats/records'

export type ShareCard = {
  /** The workout name, or `Workout` when none. */
  name: string
  /** `humanDate(startedAt)`, e.g. `Mon 12 Oct`. */
  dateText: string
  /** `45 min`, or `1 h 05 min` from 60 minutes (the summary's wording). */
  durationText: string
  /** One per lift done, in first-logged order: the lift's top set as `topText`, e.g. `62.5 kg × 5`. */
  lifts: { name: string; topSet: string }[]
  /** The Session's PRs under the shared rule (decision 0024), `sessionPrs` order. */
  prs: { name: string; kind: RecordKindName }[]
}

const heft = (entry: SetEntry): number => entry.weightKg ?? entry.loadKg ?? 0

function topOf(entries: SetEntry[]): SetEntry {
  const working = entries.filter(countsTowardStats)
  const pool = working.length > 0 ? working : entries
  return pool.reduce((best, entry) =>
    heft(entry) > heft(best) || (heft(entry) === heft(best) && entry.reps > best.reps) ? entry : best,
  )
}

function durationText(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}

export function buildShareCard(
  session: Session,
  earlierSessions: Session[],
  resolve: (id: string) => Exercise | undefined,
  planFor: (id: string) => ExercisePlan | undefined,
  workoutName: string | undefined,
): ShareCard {
  const all = [...earlierSessions.filter((other) => other.id !== session.id), session]
  const ids = [...new Set(session.entries.map((entry) => entry.exerciseId))]
  const lifts = ids.map((id) => {
    const exercise = resolve(id)
    const bodyweight = exercise?.bodyweight === true
    const top = topOf(session.entries.filter((entry) => entry.exerciseId === id))
    const lever = bodyweight ? (top.loadKg ?? 0) : (top.weightKg ?? 0)
    return { name: exercise?.name ?? id, topSet: topText({ lever, reps: top.reps }, bodyweight) }
  })
  const prs = sessionPrs(computeRecords(all, resolve, planFor), session.id).map((record) => ({
    name: resolve(record.exerciseId)?.name ?? record.exerciseId,
    kind: record.kind,
  }))
  return {
    name: workoutName ?? 'Workout',
    dateText: humanDate(session.startedAt),
    durationText: durationText((session.finishedAt ?? session.startedAt) - session.startedAt),
    lifts,
    prs,
  }
}
