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

/** One size of plate and how many pairs of it the trainee has. */
export type Plate = { kg: number; pairs: number }

/** The bar weight and the plates the trainee has (the Plate inventory). */
export type PlateInventory = { barKg: number; plates: Plate[] }

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
  /** The weight this Plan's Exercise starts at in this Program, overriding the catalog's (E9). */
  startWeightKg?: number
  /** The Plan's last Set is to failure (AMRAP); present only when `true` (E14). */
  amrapLast?: boolean
}

export type Workout = {
  id: string
  name: string
  exercises: ExercisePlan[]
  /** Hidden from pickers but kept, so a Session pointing at it still resolves (E9). */
  hidden?: boolean
}

export type Program = {
  id: string
  name: string
  units: 'kg'
  workouts: Workout[]
  /** How many sessions per week the program prescribes, averaged over its rotation (E5-T13). */
  sessionsPerWeek: number
  /** Hidden from pickers but kept, so a Session pointing at it still resolves (E9). */
  hidden?: boolean
}

/** A Program the trainee created or edited, stamped with when it was first stored (E9). */
export type UserProgram = Program & { createdAt: number }

/** What a Set is, when it is not plain working volume (E14). Working is the absence of `kind`. */
export type SetKind = 'warmup' | 'drop' | 'failure' | 'amrap'

export type SetEntry = {
  /** Absent on a working Set (E14). */
  kind?: SetKind
  exerciseId: string
  setIndex: number
  weightKg: number | null
  reps: number
  loggedAt: number
  /** The rest that follows this Set, when the trainee changed it (E13). */
  restSeconds?: number
  /** A Bodyweight Set's signed load in kg (E14): never 0, only on a Bodyweight Set. */
  loadKg?: number
  /** Reps in reserve, felt effort of this Set (E14); 3 means 3 or more. Absent when not told. */
  rir?: 0 | 1 | 2 | 3
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
  /**
   * When this Session was discarded or deleted (E12-T1). A deleted Session stays stored and
   * synced, but no reader returns it. Absent on a live Session.
   */
  deletedAt?: number
  /** The trainee's free-text Session note, 500 characters at most (E14-T4). Absent when none. */
  note?: string
}

/**
 * What a Session's volume is compared against (E8): the last Session, or an average or maximum
 * over a period.
 */
export type VolumeBaseline =
  | { period: 'last' }
  | { period: '1w' | '1m' | '3m' | '6m'; aggregate: 'avg' | 'max' }
  | { period: 'since'; since: number; aggregate: 'avg' | 'max' }
