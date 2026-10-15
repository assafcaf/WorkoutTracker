import type { Program, Session } from '../../types'
import type { Resolve } from '../../domain/muscles'

export type LiftPageViewProps = {
  exerciseId: string
  sessions: Session[]
  program: Program | undefined
  resolve: Resolve
  now: number
  /** Opens a Session's summary (the ladder readout, `Last moved ›`). */
  onOpenSession?: (sessionId: string) => void
}

export function LiftPageView(_props: LiftPageViewProps): JSX.Element {
  return <div />
}
