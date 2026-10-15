// E18-T6 [O16 O17]: the Progression Ladder as pure data (treads, off-tread deload points, labelled
// gaps, rep bars with target), its range cuts and the `4 weeks ago` compare.
// Stub: bodies are written in the green commit.
import type { Program, Session } from '../../types'
import type { LiftHistory } from './liftHistory'

export type LadderPoint = {
  sessionId: string
  startedAt: number
  deload: boolean
  /** R-T top lever of the Session. */
  lever: number
  /** Reps of the straight sets at the top lever, summed (the rep bar). */
  reps: number
  /** Straight sets at the top lever x the top of the Plan's range; null with no Plan or on a deload point. */
  target: number | null
}

export type Tread = {
  lever: number
  /** The target of the tread's latest point; null when the lift has no Plan. */
  target: number | null
  /** Non-deload Sessions on the tread, oldest first. */
  sessionIds: string[]
}

export type LadderGap = {
  /** Monday 00:00 local (R-K) of a calendar week with no Session of the lift. */
  weekStart: number
  /** `No sessions`, or `No <workout> session` (`A` from `Workout A`) when other Sessions exist. */
  label: string
}

export type Ladder = {
  exerciseId: string
  treads: Tread[]
  /** Every point, deload ones included, oldest first. */
  points: LadderPoint[]
  gaps: LadderGap[]
}

export type LadderRange = 'step' | '3M' | '1Y' | 'all'

export type LadderContext = {
  /** All Sessions (to tell an empty week from one where only another workout was done). */
  sessions: Session[]
  program: Program | undefined
}

export type Compare = {
  then: { sessionId: string; startedAt: number; lever: number; reps: number }
  now: { sessionId: string; startedAt: number; lever: number; reps: number }
  change: 'up' | 'same' | 'down'
}

export function buildLadder(_history: LiftHistory, _ctx: LadderContext): Ladder {
  throw new Error('NotImplementedError')
}

export function cutLadder(_ladder: Ladder, _range: LadderRange, _now: number): Ladder {
  throw new Error('NotImplementedError')
}

export function compareAgo(_history: LiftHistory, _now: number, _weeks?: number): Compare | null {
  throw new Error('NotImplementedError')
}
