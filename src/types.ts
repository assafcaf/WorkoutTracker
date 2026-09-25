export type Exercise = {
  id: string
  name: string
  weightStep: number
  startWeight: number | null
  bodyweight: boolean
  invertProgress: boolean
  libraryId: string
}

/** The 17 muscle names free-exercise-db uses across `primaryMuscles`/`secondaryMuscles`. */
export type Muscle =
  | 'abdominals'
  | 'abductors'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'forearms'
  | 'glutes'
  | 'hamstrings'
  | 'lats'
  | 'lower back'
  | 'middle back'
  | 'neck'
  | 'quadriceps'
  | 'shoulders'
  | 'traps'
  | 'triceps'

/** One entry of the bundled free-exercise-db library, keyed by its `id` (a catalog `libraryId`). */
export type LibraryExercise = {
  id: string
  name: string
  force: 'push' | 'pull' | 'static' | null
  level: 'beginner' | 'intermediate' | 'expert'
  mechanic: 'compound' | 'isolation' | null
  equipment: string | null
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  instructions: string[]
  category: string
  images: string[]
}

/** A harvested Muscle & Strength video for one library exercise (E5-T2/E5-T7). */
export type Video = {
  provider: 'youtube' | 'vimeo'
  id: string
  source: string
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
  /** How many sessions per week the program prescribes, averaged over its rotation (E5-T13). */
  sessionsPerWeek: number
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
  /**
   * Planned exerciseId -> exerciseId done instead, for a plan swapped mid-session (E5-T11).
   * Absent on a session with no swap, and on every session recorded before this epic.
   */
  swaps?: Record<string, string>
  /**
   * When this session was last written on this device (E7-T2). Always present on records
   * written by this build; absent on sessions imported from an older backup.
   */
  updatedAt?: number
}
