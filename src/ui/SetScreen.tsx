import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

export type SetScreenProps = {
  exercise: Exercise
  plan: ExercisePlan
  setIndex: number
  sessionId: string
  lastEntries: SetEntry[]
  onLogged(session: Session, nextSetIndex: number): void
}

/**
 * Stub for E1-T5. The screen one set is logged from: the two dials, the keypad behind each
 * readout, the rest timer and the log button.
 */
export function SetScreen(_props: SetScreenProps): JSX.Element {
  return <div />
}
