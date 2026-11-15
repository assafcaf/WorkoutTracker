import type { Muscle } from '../types'

/** Where a screen group can send the app: a tab, and for Exercises the muscles to open on. */
export type AppRoute =
  | { tab: 'exercises'; muscles: Muscle[] }
  | { tab: 'history'; sessionId?: string }
  | { tab: 'progress' }
  | { tab: 'program' }
  | { tab: 'workout' }
  /** V6-03: the one Lift page, pushed over the tab it was opened from; Back returns there. */
  | { tab: 'lift'; exerciseId: string }
