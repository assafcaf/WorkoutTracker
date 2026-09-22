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
export function ImportConfirm(_props: ImportConfirmProps): JSX.Element {
  throw new Error('not implemented')
}
