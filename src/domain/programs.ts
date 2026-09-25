import type { Exercise, ExercisePlan, Program, UserProgram } from '../types'

/** One validation fault: the field it sits on, and what the trainee is told (E9-T1). */
export type ProgramFault = { path: string; message: string }

/**
 * The Programs the app knows: bundled ones in their order, each replaced by the trainee's edited
 * copy when one shares its id, then the trainee's own Programs by `createdAt`. Hidden Programs and
 * Workouts are kept, so a Session pointing at them still resolves.
 */
export function mergePrograms(bundled: Program[], user: UserProgram[]): Program[] {
  const userById = new Map(user.map((p) => [p.id, p]))
  const bundledIds = new Set(bundled.map((p) => p.id))
  const merged: Program[] = bundled.map((p) => userById.get(p.id) ?? p)
  const created = user
    .filter((p) => !bundledIds.has(p.id))
    .sort((a, b) => a.createdAt - b.createdAt)
  return [...merged, ...created]
}

/** The Programs, and their Workouts, a picker may offer. Never mutates its input. */
export function visiblePrograms(programs: Program[]): Program[] {
  return programs
    .filter((p) => !p.hidden)
    .map((p) =>
      p.workouts.some((w) => w.hidden)
        ? { ...p, workouts: p.workouts.filter((w) => !w.hidden) }
        : p,
    )
}

/** A Plan for a freshly picked Exercise: 3 sets, 8-12 reps, 90 s rest, no starting weight (E9-T7). */
export function newPlan(exerciseId: string): ExercisePlan {
  return { exerciseId, sets: 3, repRange: [8, 12], restSeconds: 90 }
}

const isBlank = (text: string) => text.trim() === ''
const inRange = (value: number, min: number, max: number) => value >= min && value <= max

function planFaults(
  plan: ExercisePlan,
  path: string,
  resolve: (id: string) => Exercise | undefined,
): ProgramFault[] {
  const faults: ProgramFault[] = []
  const exercise = resolve(plan.exerciseId)
  if (exercise === undefined) {
    faults.push({ path: `${path}.exerciseId`, message: 'Unknown exercise' })
  }
  if (!Number.isInteger(plan.sets) || !inRange(plan.sets, 1, 10)) {
    faults.push({ path: `${path}.sets`, message: 'Sets: 1 to 10' })
  }
  const [min, max] = plan.repRange
  if (!inRange(min, 1, 100) || !inRange(max, 1, 100)) {
    faults.push({ path: `${path}.repRange`, message: 'Rep range: 1 to 100' })
  } else if (min > max) {
    faults.push({ path: `${path}.repRange`, message: 'Rep range: min is more than max' })
  }
  if (!inRange(plan.restSeconds, 0, 600)) {
    faults.push({ path: `${path}.restSeconds`, message: 'Rest: 0 to 600 s' })
  }
  if (plan.startWeightKg !== undefined) {
    if (exercise?.bodyweight) {
      faults.push({
        path: `${path}.startWeightKg`,
        message: 'Starting weight: not for a bodyweight exercise',
      })
    } else if (!inRange(plan.startWeightKg, 0, 500)) {
      faults.push({ path: `${path}.startWeightKg`, message: 'Starting weight: 0 to 500 kg' })
    }
  }
  return faults
}

/**
 * Every fault in a Program, at most one per field; `[]` when it is valid. Hidden Workouts count in
 * the `workouts.i` index but are never validated.
 */
export function validateProgram(
  program: Program,
  resolve: (id: string) => Exercise | undefined,
): ProgramFault[] {
  const faults: ProgramFault[] = []
  if (isBlank(program.name)) faults.push({ path: 'name', message: 'Name is empty' })
  // Not integer-checked: sessionsPerWeek is an average over the rotation (E5-T13).
  if (!inRange(program.sessionsPerWeek, 1, 14)) {
    faults.push({ path: 'sessionsPerWeek', message: 'Sessions per week: 1 to 14' })
  }
  if (!program.workouts.some((w) => !w.hidden)) {
    faults.push({ path: 'workouts', message: 'Add a workout' })
  }
  program.workouts.forEach((workout, i) => {
    if (workout.hidden) return
    const path = `workouts.${i}`
    if (isBlank(workout.name)) faults.push({ path: `${path}.name`, message: 'Name is empty' })
    if (workout.exercises.length === 0) {
      faults.push({ path: `${path}.exercises`, message: 'Add an exercise' })
    }
    workout.exercises.forEach((plan, j) => {
      faults.push(...planFaults(plan, `${path}.exercises.${j}`, resolve))
    })
  })
  return faults
}
