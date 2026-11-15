import { useState } from 'react'
import { verdictLabel } from '../../domain/stats/copy'
import { AppShell } from '../../ui/AppShell'
import { Segmented } from '../../ui/controls'
import { useServiceData } from '../useServiceData'
import { latestTop, loadProgress, MiniLadder, progressModel } from './Home'
import type { ProgressPageProps } from './pages'
import './Home.css'

type AllLiftsProps = ProgressPageProps<'lifts'> & {
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
}

/** The status filter over the list (V2-08): every lift, or those of one verdict, or the ready ones. */
type LiftFilter = 'all' | 'moving' | 'stalled' | 'slipping' | 'ready'

const FILTERS: { value: LiftFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'moving', label: 'Moving' },
  { value: 'stalled', label: 'Stalled' },
  { value: 'slipping', label: 'Slipping' },
  { value: 'ready', label: 'Ready' },
]

/**
 * `All lifts` (O20): every lift of the Program with its verdict, latest top set and mini ladder.
 * A status filter narrows it to the moving, stalled, slipping or ready lifts (V2-08), so Progress
 * Home needs only the one row that opens it.
 */
export function AllLifts({ push, onBack, now = Date.now }: AllLiftsProps): JSX.Element {
  const loaded = useServiceData(loadProgress, ['programs', 'sessions', 'preferences'])
  const [filter, setFilter] = useState<LiftFilter>('all')
  const model = loaded.status === 'ready' && loaded.data ? progressModel(loaded.data, now()) : null
  if (!model) return <AppShell title="All lifts" onBack={onBack}>{null}</AppShell>

  const prescription = (id: string): string => {
    const plan = model.plans.get(id)
    return plan ? `${plan.sets} × ${plan.repRange[0]}–${plan.repRange[1]}` : ''
  }
  const ready = new Set(model.copy.cards.filter((card) => card.kind === 'ready').map((card) => card.exerciseId))
  const shown = model.order.filter((id) =>
    filter === 'all' ? true : filter === 'ready' ? ready.has(id) : model.verdicts.get(id)?.kind === filter,
  )

  return (
    <AppShell title="All lifts" onBack={onBack}>
      <div className="progress-all-filter">
        <Segmented name="lift-filter" label="Show lifts" value={filter} options={FILTERS} onChange={setFilter} />
      </div>
      {shown.length === 0 ? <p className="progress-all-empty">No lifts here right now.</p> : null}
      <ul className="progress-rows progress-all">
        {shown.map((id) => {
          const verdict = model.verdicts.get(id)
          return (
            <li key={id}>
              <button
                type="button"
                className="btn-quiet progress-row"
                onClick={() => push({ kind: 'lift', exerciseId: id })}
              >
                <span className="progress-row-main">
                  <span className="progress-row-name">{model.nameOf(id)}</span>
                  <span className="progress-row-note">{verdict ? verdictLabel(verdict.kind) : prescription(id)}</span>
                </span>
                <MiniLadder model={model} exerciseId={id} />
                <span className="progress-row-value">{latestTop(model, id) ?? prescription(id)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </AppShell>
  )
}
