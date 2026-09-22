import type { Exercise, Program } from '../types'

export type ProgramPickerProps = {
  programs: Program[]
  catalog: Map<string, Exercise>
  activeProgramId: string
  onChoose(programId: string, workoutId: string): void
}

/**
 * Lists the active program's workouts, each with its exercises, and collapses the rest.
 */
export function ProgramPicker(_props: ProgramPickerProps): JSX.Element {
  throw new Error('ProgramPicker is not implemented')
}
