// V2-11: one Exercise's verdict the moment its last Set is in, "Deadlift done · stepped up to
// 70 kg · +10 kg · 1 PR", in the words the Session summary's Lift by lift uses (`sessionMoves`),
// and the live count of a Session's Records. Pure; Records and moves are the stats rules'.
import { computeRecords, recordCount } from './stats/records'
import { sessionMoves } from './stats/moves'
import type { Exercise, ExercisePlan, Program, Session } from '../types'
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
  const text = move.text.endsWith(RECORD_SUFFIX) ? move.text.slice(0, -RECORD_SUFFIX.length) : move.text
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
