import type { ImportPlan } from '../storage/backup'

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
    <div role="alertdialog" aria-label="Confirm import">
      <p>
        The phone currently holds {currentCount} session{currentCount === 1 ? '' : 's'}. The
        chosen file holds {incomingCount} session{incomingCount === 1 ? '' : 's'}. Importing it
        will remove {plan.removed} local session{plan.removed === 1 ? '' : 's'}.
      </p>
      <button type="button" onClick={onConfirm}>
        Import
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
