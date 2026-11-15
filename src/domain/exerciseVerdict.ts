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

// ---- V4-01 / V4-02: one comparison sentence per Set ------------------------------------------

/** The part of a Set a comparison reads: its load and its reps. */
export type ComparedSet = Pick<SetEntry, 'weightKg' | 'reps' | 'loadKg'>

/**
 * How a Set compares with last time's Set at the same place, with its short words: "same",
 * "+1 rep", "+2.5 kg", "1 fewer rep", "2.5 kg under". The load decides first (a Bodyweight Set's
 * signed Load, so less assistance is up); with the same load, the reps.
 */
export type SetDelta = { kind: 'same' | 'up' | 'down'; text: string }

/** A number as the app writes a weight: no trailing zeros, at most two decimals. */
function plainKg(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/** The load a comparison weighs: the weight, or a Bodyweight Set's signed Load (0 at plain BW). */
function loadOf(set: ComparedSet): number {
  return set.weightKg ?? set.loadKg ?? 0
}

function repsWord(count: number): string {
  return `${count} ${count === 1 ? 'rep' : 'reps'}`
}

/** `set` against last time's `last` (V4-02's live line, V4-01's sentence). */
export function setDelta(set: ComparedSet, last: ComparedSet): SetDelta {
  const kg = Math.round((loadOf(set) - loadOf(last)) * 1000) / 1000
  if (kg !== 0) {
    return kg > 0 ? { kind: 'up', text: `+${plainKg(kg)} kg` } : { kind: 'down', text: `${plainKg(-kg)} kg under` }
  }
  const reps = set.reps - last.reps
  if (reps === 0) return { kind: 'same', text: 'same' }
  return reps > 0 ? { kind: 'up', text: `+${repsWord(reps)}` } : { kind: 'down', text: fewerWords(-reps) }
}

/** V6-18, wave 3: fewer reps said plainly, app-wide: "1 fewer rep", "3 fewer reps". */
function fewerWords(count: number): string {
  return `${count} fewer ${count === 1 ? 'rep' : 'reps'}`
}

/** What one logged Set's comparison says (V4-01): its kind, its sentence and its Record, if any. */
export type SetComparison = {
  kind: 'first' | 'same' | 'up' | 'down'
  /** "Same as Mon 12 Oct", "2.5 kg more than Mon 12 Oct", "1 fewer rep than Mon 12 Oct", "First time logged". */
  text: string
  /** The Record's name when the Set set one ("Rep record"); the sentence then leads with it. */
  record: string | null
}

/**
 * The one sentence a logged Set gets (V4-01), against last time's Set at its place, `last`,
 * lifted on `lastDay` ("Mon 12 Oct"): "Same as Mon 12 Oct", "2.5 kg more than Mon 12 Oct", "1 rep
 * under Mon 12 Oct", or "First time logged" with no `last`. A Set that set a Record leads with
 * its name: "Rep record · 1 more than Mon 12 Oct".
 */
export function setComparison(
  set: ComparedSet,
  last: ComparedSet | null,
  lastDay: string,
  record: string | null = null,
): SetComparison {
  if (last === null) return { kind: 'first', text: record ?? 'First time logged', record }
  const delta = setDelta(set, last)
  // V5-13: "+1 rep on Mon 12 Oct" read as the Record's date; "1 more than Mon 12 Oct" compares.
  // A Record whose name says reps leaves the word out: "Rep record · 1 more than Mon 12 Oct".
  const more = delta.text.replace(/^\+/, '')
  const upText = record !== null && /\brep\b/i.test(record) ? more.replace(/ reps?$/, '') : more
  const words =
    delta.kind === 'same'
      ? `Same as ${lastDay}`
      : delta.kind === 'up'
        ? `${upText} more than ${lastDay}`
        : delta.text.endsWith(' under')
          ? `${delta.text} ${lastDay}`
          : `${delta.text} than ${lastDay}`
  return { kind: delta.kind, text: `${record === null ? '' : `${record} · `}${words}`, record }
}

/**
 * An Exercise once its Sets are in (V4-01's hand-over, V4-07's done state): its working Sets as
 * the cells say them, a Record's marked, "60×10 · 70×8 PR · 70×7", then one comparison with last
 * time's Sets, "1 rep more than Mon 12 Oct". The same loads at every place compare the reps;
 * else the top load. Fewer Sets than planned say so, "2 of 3 sets"; no last time, "First time
 * logged". Never two totals side by side ("15 vs 14").
 */
export function exerciseDoneLine(args: {
  today: SetEntry[]
  last: SetEntry[]
  lastDay: string
  plannedSets: number
  isRecord(entry: SetEntry): boolean
}): string {
  const today = workingSets(args.today).sort((a, b) => a.setIndex - b.setIndex)
  const last = workingSets(args.last).sort((a, b) => a.setIndex - b.setIndex)
  if (today.length === 0) return ''
  const sets = today.map((set) => `${loadText(set)}×${set.reps}${args.isRecord(set) ? ' PR' : ''}`).join(' · ')
  return `${sets} · ${exerciseComparison({ today, last, lastDay: args.lastDay, plannedSets: args.plannedSets })}`
}

function repsMove(today: SetEntry[], last: SetEntry[], lastDay: string, same: string): string {
  const reps = today.reduce((sum, set) => sum + set.reps, 0) - last.reduce((sum, set) => sum + set.reps, 0)
  if (reps === 0) return same
  return reps > 0 ? `${repsWord(reps)} more than ${lastDay}` : `${fewerWords(-reps)} than ${lastDay}`
}

/** Every Set is a Bodyweight one at or below plain BW, with some assistance. */
function assisted(sets: SetEntry[]): boolean {
  return (
    sets.every((set) => set.weightKg === null && (set.loadKg ?? 0) <= 0) && sets.some((set) => (set.loadKg ?? 0) < 0)
  )
}

/**
 * V5: the one comparison sentence an Exercise gets against last time, app-wide. The live
 * Session's done line (`exerciseDoneLine`) and the finish summary's Lift by lift (`liftLine` in
 * summaryLines.ts) both end with it. `today` and `last` are working Sets, `lastDay` is last
 * time's day ("Mon 12 Oct"):
 *   fewer Sets than planned     -> "2 of 3 sets" (no comparison with a full Exercise)
 *   a deload                    -> "Deload"
 *   no last time                -> "First time logged"
 *   the same load at every Set  -> "1 rep more than Mon 12 Oct", "2 fewer reps than Mon 12 Oct", "Same as Mon 12 Oct"
 *   else the top load           -> "+2.5 kg top set on Mon 12 Oct", "2.5 kg under Mon 12 Oct",
 *                                  "5 kg less assistance than Mon 12 Oct" (assisted Bodyweight),
 *                                  or the reps with "Same top weight as Mon 12 Oct"
 * Never two totals side by side ("15 vs 14"), never "record": the PR tag on the Set says that.
 */
export function exerciseComparison(args: {
  today: SetEntry[]
  last: SetEntry[]
  lastDay: string
  plannedSets?: number
  deload?: boolean
}): string {
  const today = [...args.today].sort((a, b) => a.setIndex - b.setIndex)
  const last = [...args.last].sort((a, b) => a.setIndex - b.setIndex)
  const { lastDay, plannedSets } = args
  if (plannedSets !== undefined && today.length < plannedSets) return `${today.length} of ${plannedSets} sets`
  if (args.deload === true) return 'Deload'
  if (last.length === 0) return 'First time logged'
  const sameLoads =
    today.length === last.length && today.every((set, at) => loadOf(set) === loadOf(last[at] as SetEntry))
  if (sameLoads) return repsMove(today, last, lastDay, `Same as ${lastDay}`)
  const top = (sets: SetEntry[]): number => Math.max(...sets.map(loadOf))
  const kg = Math.round((top(today) - top(last)) * 1000) / 1000
  if (kg === 0) return repsMove(today, last, lastDay, `Same top weight as ${lastDay}`)
  if (assisted([...today, ...last])) {
    return `${plainKg(Math.abs(kg))} kg ${kg > 0 ? 'less' : 'more'} assistance than ${lastDay}`
  }
  return kg > 0 ? `+${plainKg(kg)} kg top set on ${lastDay}` : `${plainKg(-kg)} kg under ${lastDay}`
}
