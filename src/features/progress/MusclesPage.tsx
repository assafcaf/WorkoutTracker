import type { LibraryExercise, Program, Session } from '../../types'
import type { Resolve } from '../../domain/muscles'
import type { ProgressPageProps } from './pages'

export type MusclesData = {
  sessions: Session[]
  program: Program
  resolve: Resolve
  library: Map<string, LibraryExercise>
}

export type MusclesViewProps = { data: MusclesData; now: number; onBack: (() => void) | undefined }

/** The Muscles page's drawing, over loaded data. */
export function MusclesView(_props: MusclesViewProps): JSX.Element {
  return <div />
}

export function MusclesPage(_props: ProgressPageProps<'muscles'>): JSX.Element {
  return <div />
}
