export type Exercise = {
  id: string
  name: string
  weightStep: number
  startWeight: number | null
  bodyweight: boolean
  invertProgress: boolean
  infoUrl: string
}

export type ExercisePlan = {
  exerciseId: string
  sets: number
  repRange: [number, number]
  restSeconds: number
}

export type Workout = {
  id: string
  name: string
  exercises: ExercisePlan[]
}

export type Program = {
  id: string
  name: string
  units: 'kg'
  workouts: Workout[]
}

export type SetEntry = {
  exerciseId: string
  setIndex: number
  weightKg: number | null
  reps: number
  loggedAt: number
}

export type Session = {
  id: string
  programId: string
  workoutId: string
  startedAt: number
  finishedAt: number | null
  entries: SetEntry[]
}
