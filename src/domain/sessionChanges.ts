import type { ExercisePlan, Program, Session, Workout } from '../types'

export type SessionChange =
  | { kind: 'swap'; from: string; to: string }
  | { kind: 'add'; plan: ExercisePlan }
  | { kind: 'extend'; exerciseId: string; from: number; to: number }

const working = (session: Session, exerciseId: string): number =>
  session.entries.filter((e) => e.exerciseId === exerciseId && e.kind !== 'warmup').length

/** What the Session did differently from its Workout: swaps, added Exercises, more Sets (E19-T14). */
export function sessionChanges(session: Session, workout: Workout): SessionChange[] {
  const changes: SessionChange[] = []
  for (const p of workout.exercises) {
    const done = session.swaps?.[p.exerciseId]
    if (done !== undefined && done !== p.exerciseId) {
      changes.push({ kind: 'swap', from: p.exerciseId, to: done })
    }
    const logged = working(session, done ?? p.exerciseId)
    if (logged > p.sets) {
      changes.push({ kind: 'extend', exerciseId: p.exerciseId, from: p.sets, to: logged })
    }
  }
  for (const a of session.added ?? []) {
    const logged = working(session, a.exerciseId)
    if (logged >= 1) changes.push({ kind: 'add', plan: { ...a, sets: logged } })
  }
  return changes
}

/** The Program with the changes applied to one Workout; saved changes only add or widen. */
export function applySessionChanges(
  program: Program,
  workoutId: string,
  changes: SessionChange[],
): Program {
  return {
    ...program,
    workouts: program.workouts.map((w) => {
      if (w.id !== workoutId) return w
      const exercises = w.exercises.map((p) => {
        let next = p
        for (const c of changes) {
          if (c.kind === 'swap' && c.from === p.exerciseId) next = { ...next, exerciseId: c.to }
          else if (c.kind === 'extend' && c.exerciseId === p.exerciseId) next = { ...next, sets: c.to }
        }
        return next
      })
      const added = changes.flatMap((c) => (c.kind === 'add' ? [{ ...c.plan }] : []))
      return { ...w, exercises: [...exercises, ...added] }
    }),
  }
}
