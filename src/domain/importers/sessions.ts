import type { Session } from '../../types'
import type { ImportDraft } from './types'

export function buildSessions(
  drafts: ImportDraft[],
  choices: Record<string, string | null>,
  source: 'Strong' | 'Hevy',
  now: number,
  newId: () => string,
  isBodyweight: (exerciseId: string) => boolean,
): { sessions: Session[]; leftOut: number } {
  void drafts, choices, source, now, newId, isBodyweight
  throw new Error('NotImplementedError')
}

export function skipDuplicates(
  existing: Session[],
  incoming: Session[],
): { sessions: Session[]; skipped: number } {
  void existing, incoming
  throw new Error('NotImplementedError')
}
