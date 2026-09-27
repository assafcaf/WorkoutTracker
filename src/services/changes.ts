export type ChangeTopic = 'sessions' | 'programs' | 'preferences'

export const CHANGE_TOPICS: readonly ChangeTopic[] = ['sessions', 'programs', 'preferences']

export type ChangeBus = {
  subscribe(topic: ChangeTopic, fn: () => void): () => void
  emit(topic: ChangeTopic): void
}

export function createChangeBus(): ChangeBus {
  throw new Error('not implemented')
}
