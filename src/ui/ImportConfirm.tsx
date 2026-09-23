import type { ImportPlan } from '../storage/backup'
import './ImportConfirm.css'

export type ImportConfirmProps = {
  currentCount: number
  incomingCount: number
  plan: ImportPlan
  onConfirm(): void
  onCancel(): void
}

/**
 * Names exactly what an import will do before it touches anything: how many sessions are on the
 * phone now (`currentCount`), how many the chosen file holds (`incomingCount`), and how many
 * local-only sessions replacing the database will remove (`plan.removed`).
 *
 * Confirming calls `onConfirm`; cancelling calls `onCancel` and changes nothing.
 */
export function ImportConfirm(props: ImportConfirmProps): JSX.Element {
  const { currentCount, incomingCount, plan, onConfirm, onCancel } = props

  return (
    <div className="import-confirm-overlay">
      <div role="alertdialog" aria-label="Confirm import" className="import-confirm">
        <p className="import-confirm-text">
          The phone currently holds {currentCount} session{currentCount === 1 ? '' : 's'}. The
          chosen file holds {incomingCount} session{incomingCount === 1 ? '' : 's'}. Importing it
          will remove{' '}
          <strong className="import-confirm-danger">
            {plan.removed} local session{plan.removed === 1 ? '' : 's'}
          </strong>
          .
        </p>
        <div className="import-confirm-actions">
          <button type="button" className="import-confirm-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="import-confirm-confirm" onClick={onConfirm}>
            Import
          </button>
        </div>
      </div>
    </div>
  )
}
