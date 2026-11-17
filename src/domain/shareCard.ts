// E26-T4 [O11]: the plain data of the share card (stub; the owner implements it).
import type { Exercise, ExercisePlan, Session } from '../types'
import type { RecordKindName } from './stats/records'

export type ShareCard = {
  /** The workout name, or `Workout` when none. */
  name: string
  /** `humanDate(startedAt)`, e.g. `Mon 12 Oct`. */
  dateText: string
  /** `45 min`, or `1 h 05 min` from 60 minutes (the summary's wording). */
  durationText: string
  /** One per lift done, in first-logged order: the lift's top set as `topText`, e.g. `62.5 kg × 5`. */
  lifts: { name: string; topSet: string }[]
  /** The Session's PRs under the shared rule (decision 0024), `sessionPrs` order. */
  prs: { name: string; kind: RecordKindName }[]
}

export function buildShareCard(
  _session: Session,
  _earlierSessions: Session[],
  _resolve: (id: string) => Exercise | undefined,
  _planFor: (id: string) => ExercisePlan | undefined,
  _workoutName: string | undefined,
): ShareCard {
  throw new Error('not implemented')
}
