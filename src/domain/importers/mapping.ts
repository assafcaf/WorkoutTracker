import type { Exercise, LibraryExercise } from '../../types'

export type NameProposal = { id: string; match: 'exact' | 'guess' }

export function mapName(
  _sourceName: string,
  _catalog: Map<string, Exercise>,
  _library: Map<string, LibraryExercise>,
): NameProposal | null {
  return null
}
