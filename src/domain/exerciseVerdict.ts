// V2-11: one Exercise's verdict the moment its last Set is in, "Deadlift done · stepped up to
// 70 kg · +10 kg · 1 PR", in the words the Session summary's Lift by lift uses (`sessionMoves`),
// and the live count of a Session's Records. Pure; Records and moves are the stats rules'.
import { computeRecords, recordCount } from './stats/records'
import { sessionMoves } from './stats/moves'
import { loadText } from './setText'
import { workingSets } from './setKind'
import type { Exercise, ExercisePlan, Program, Session, SetEntry } from '../types'
import type { Resolve } from './muscles'

/** " · record" ends a move that set a Record; the verdict says "1 PR" for it instead. */
const RECORD_SUFFIX = ' · record'

/**
 * "<Exercise> done · <move> · 1 PR": the move as Lift by lift words it (first letter lower-cased
 * after "done"), and "1 PR" when this Exercise set a Record in `session`. Null when the Exercise
 * has no working Set in `session`.
 */
export function exerciseVerdict(
  exercise: Exercise,
  plan: ExercisePlan,
  earlier: Session[],
  session: Session,
): string | null {
  const resolve: Resolve = (id) => (id === exercise.id ? exercise : undefined)
  const own: ExercisePlan = { ...plan, exerciseId: exercise.id }
  const program: Program = {
    id: session.programId,
    name: '',
    units: 'kg',
    sessionsPerWeek: 0,
    workouts: [{ id: session.workoutId, name: '', exercises: [own] }],
  }
  const all = [...earlier.filter((other) => other.id !== session.id), session]
  const move = sessionMoves(session.id, all, resolve, program).find((found) => found.exerciseId === exercise.id)
  if (move === undefined) return null
  const prs = computeRecords(all, resolve, (id) => (id === exercise.id ? own : undefined)).filter(
    (record) => record.sessionId === session.id && record.exerciseId === exercise.id,
  ).length
  const honest = honestMoveText(
    move.text,
    session.entries.filter((entry) => entry.exerciseId === exercise.id),
    plan.sets,
  )
  const text = honest.endsWith(RECORD_SUFFIX) ? honest.slice(0, -RECORD_SUFFIX.length) : honest
  const words = text.charAt(0).toLowerCase() + text.slice(1)
  return `${exercise.name} done · ${words}${prs > 0 ? ` · ${prs} PR` : ''}`
}

/** The Records `session` has set so far against `earlier`: the live header's "· 1 PR". */
export function liveRecordCount(
  earlier: Session[],
  session: Session,
  resolve: Resolve,
  planOf: (exerciseId: string) => ExercisePlan | undefined,
): number {
  const all = [...earlier.filter((other) => other.id !== session.id), session]
  return recordCount(computeRecords(all, resolve, planOf), session.id)
}

/** The moves that compare reps with last time's, which a partial Exercise cannot honestly make. */
const REP_COMPARISONS = ['Fewer reps', 'More reps', 'Same', 'Held ']

/**
 * The Sets an Exercise was lifted with, as numbers: "3 × 70 × 7" when every working Set was the
 * same, else each one, "70 × 8, 70 × 7".
 */
export function setsInNumbers(entries: SetEntry[]): string {
  const sets = workingSets(entries).sort((a, b) => a.setIndex - b.setIndex)
  const texts = sets.map((set) => `${loadText(set)} × ${set.reps}`)
  if (texts.length === 0) return ''
  return texts.every((text) => text === texts[0]) ? `${texts.length} × ${texts[0]}` : texts.join(', ')
}

/**
 * V3-02: a move as Lift by lift and the live verdict say it. "Same" names its numbers, "Same as
 * last time · 3 × 70 × 7"; an Exercise with fewer working Sets than `plannedSets` makes no rep
 * comparison with a full one, "1 of 4 sets", and a weight move notes it, "… · 1 of 4 sets".
 * `entries` are the Exercise's Sets in the Session; a Record's " · record" stays at the end.
 */
export function honestMoveText(text: string, entries: SetEntry[], plannedSets?: number): string {
  const record = text.endsWith(RECORD_SUFFIX)
  const bare = record ? text.slice(0, -RECORD_SUFFIX.length) : text
  const suffix = record ? RECORD_SUFFIX : ''
  const done = workingSets(entries).length
  if (plannedSets !== undefined && done > 0 && done < plannedSets) {
    const count = `${done} of ${plannedSets} sets`
    if (REP_COMPARISONS.some((start) => bare.startsWith(start))) return `${count}${suffix}`
    if (bare.startsWith('Stepped')) return `${bare} · ${count}${suffix}`
    return text
  }
  if (bare === 'Same') {
    const numbers = setsInNumbers(entries)
    return `Same as last time${numbers === '' ? '' : ` · ${numbers}`}${suffix}`
  }
  return text
}
