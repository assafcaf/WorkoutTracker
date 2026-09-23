import type { Resolve } from '../domain/muscles'
import type { Program, Session } from '../types'

export type StatsProps = { sessions: Session[]; resolve: Resolve; programs: Program[] }

/** E4-T4 red stub: renders nothing until the statistics screen is built. */
export function Stats(_props: StatsProps): JSX.Element {
  return <></>
}
