import type { LibraryExercise } from '../types'
import type { NameProposal } from '../domain/importers/mapping'
import type { CustomExerciseValues } from './CustomExerciseForm'

export type ImportReviewName = { source: string; proposal: NameProposal | null }

export type ImportReviewProps = {
  names: ImportReviewName[]
  sessionCount: number
  unitStated: boolean
  library: LibraryExercise[]
  exerciseName(id: string): string
  equipmentOptions: string[]
  createCustom(values: CustomExerciseValues): Promise<{ id: string } | { error: string }>
  onImport(choices: Record<string, string | null>, unit: 'kg' | 'lbs'): void
  onCancel(): void
}

export function ImportReview(_props: ImportReviewProps): JSX.Element | null {
  return null
}
