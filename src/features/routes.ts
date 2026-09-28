import type { Muscle } from '../types'

/** Where a screen group can send the app: a tab, and for Exercises the muscles to open on. */
export type AppRoute =
  | { tab: 'exercises'; muscles: Muscle[] }
  | { tab: 'history' }
  | { tab: 'program' }
  | { tab: 'workout' }
