import type { Muscle } from '../types'

/** What the form edits; the caller adds the id and `createdAt` when it saves. */
export type CustomExerciseValues = {
  name: string
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  equipment: string | null
  bodyweight: boolean
  weightStep: number
}

export type CustomExerciseFormProps = {
  initial?: CustomExerciseValues
  equipmentOptions: string[]
  error?: string | null
  onSave(values: CustomExerciseValues): void
  onCancel(): void
}

export function CustomExerciseForm(_props: CustomExerciseFormProps): JSX.Element | null {
  return null
}
