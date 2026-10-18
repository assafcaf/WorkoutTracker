import type { LibraryExercise } from '../types'

export type ExercisePickerProps = {
  library: LibraryExercise[]
  taken: string[]
  onPick(id: string): void
  onClose(): void
}

export function ExercisePicker(_props: ExercisePickerProps): JSX.Element | null {
  return null
}
