import { verdictLabel } from '../../domain/stats/copy'
import { AppShell } from '../../ui/AppShell'
import { useServiceData } from '../useServiceData'
import { latestTop, loadProgress, MiniLadder, progressModel } from './Home'
import type { ProgressPageProps } from './pages'
import './Home.css'

type AllLiftsProps = ProgressPageProps<'lifts'> & {
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
}

/** `All lifts` (O20): every lift of the Program with its verdict, latest top set and mini ladder. */
export function AllLifts({ push, onBack, now = Date.now }: AllLiftsProps): JSX.Element {
  const loaded = useServiceData(loadProgress, ['programs', 'sessions', 'preferences'])
  const model = loaded.status === 'ready' && loaded.data ? progressModel(loaded.data, now()) : null
  if (!model) return <AppShell title="All lifts" onBack={onBack}>{null}</AppShell>

  const prescription = (id: string): string => {
    const plan = model.plans.get(id)
    return plan ? `${plan.sets} × ${plan.repRange[0]}–${plan.repRange[1]}` : ''
  }

  return (
    <AppShell title="All lifts" onBack={onBack}>
      <ul className="progress-rows progress-all">
        {model.order.map((id) => {
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
