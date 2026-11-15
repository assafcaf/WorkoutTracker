import { AppShell } from '../../ui/AppShell'
import { useServiceData } from '../useServiceData'
import { LiftsList, loadProgress, progressModel } from './Home'
import type { ProgressPageProps } from './pages'
import './Home.css'

type AllLiftsProps = ProgressPageProps<'lifts'> & {
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
}

/**
 * `All lifts` (v6): the dashboard's Lifts list on a page of its own -- every lift grouped by
 * Workout, with its one status, sparkline, latest top set and 4-week change. The dashboard now
 * carries the same list, so nothing links here any more (§6.2); the page stays registered for
 * anything that still pushes `{ kind: 'lifts' }`.
 */
export function AllLifts({ push, onBack, now = Date.now }: AllLiftsProps): JSX.Element {
  const loaded = useServiceData(loadProgress, ['programs', 'sessions', 'preferences'])
  const model = loaded.status === 'ready' && loaded.data ? progressModel(loaded.data, now()) : null
  return (
    <AppShell title="All lifts" onBack={onBack}>
      {model ? (
        <div className="progress-all">
          <LiftsList model={model} onOpen={(exerciseId) => push({ kind: 'lift', exerciseId })} />
        </div>
      ) : null}
    </AppShell>
  )
}
