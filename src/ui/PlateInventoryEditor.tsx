import type { PlateInventory } from '../types'

export type PlateInventoryEditorProps = {
  inventory: PlateInventory
  onChange(inventory: PlateInventory): void
  error?: string | null
}

/** Edits the trainee's bar and plates (E15-T5). */
export function PlateInventoryEditor(_props: PlateInventoryEditorProps): JSX.Element | null {
  return null
}
