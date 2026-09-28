export type ChangeTopic = 'sessions' | 'programs' | 'preferences'

export const CHANGE_TOPICS: readonly ChangeTopic[] = ['sessions', 'programs', 'preferences']

export type ChangeBus = {
  subscribe(topic: ChangeTopic, fn: () => void): () => void
  emit(topic: ChangeTopic): void
}

export function createChangeBus(): ChangeBus {
  const subscribers = new Map<ChangeTopic, Set<() => void>>()

  return {
    subscribe(topic, fn) {
      let topicSubscribers = subscribers.get(topic)
      if (!topicSubscribers) {
        topicSubscribers = new Set()
        subscribers.set(topic, topicSubscribers)
      }
      topicSubscribers.add(fn)
      return () => {
        topicSubscribers?.delete(fn)
      }
    },
    emit(topic) {
      subscribers.get(topic)?.forEach((fn) => fn())
    },
  }
}
