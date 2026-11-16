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
 * `All lifts` (v6, v7): the Progress ledger on a page of its own -- every lift once, in Plan
 * order, with its status, a 12-week sparkline, its est. strength and 12-week change. The Progress
 * home carries the same ledger, so nothing links here any more (§6.2); the page stays registered for
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
