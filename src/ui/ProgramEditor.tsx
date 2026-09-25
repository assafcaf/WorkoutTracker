import type { Exercise, LibraryExercise, Program } from '../types'

export type ProgramEditorProps = {
  initial: Program
  isNew: boolean
  resolve: (id: string) => Exercise | undefined
  library: LibraryExercise[]
  gymEquipment: string[] | null
  onSave(p: Program): void
  onCancel(): void
  /** When set, shown above `Save`. */
  saveError?: string | null
}

/** Builds and rearranges a Program's name, Workouts and Plans on one screen (E9-T7). */
export function ProgramEditor(_props: ProgramEditorProps): JSX.Element {
  return <div />
}
