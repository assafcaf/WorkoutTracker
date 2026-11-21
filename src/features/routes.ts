import type { Muscle } from '../types'

/** Where a screen group can send the app: a tab, or a page pushed over one. */
export type AppRoute =
  /** The Exercises library, pushed over Program; `muscles` filters it (a region's "Browse exercises"). */
  | { tab: 'exercises'; muscles?: Muscle[] }
  | { tab: 'history'; sessionId?: string }
  | { tab: 'progress' }
  | { tab: 'program' }
  /** The Train tab: today's Workout. */
  | { tab: 'workout' }
  /** V6-03: the one Lift page, pushed over the tab it was opened from; Back returns there. */
  | { tab: 'lift'; exerciseId: string }
  /** DX-03: Progress › Muscles, pushed over Program (its muscles row); Back returns there. */
  | { tab: 'muscles' }
  /** DX-04: Settings, pushed over Program (its "Settings" row); Back returns there. */
  | { tab: 'settings' }
