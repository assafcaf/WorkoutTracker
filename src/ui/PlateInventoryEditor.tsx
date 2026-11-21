import { useState } from 'react'
import { DEFAULT_PLATE_INVENTORY } from '../domain/plates'
import type { PlateInventory } from '../types'
import { Stepper } from './Stepper'
import './PlateInventoryEditor.css'

export type PlateInventoryEditorProps = {
  inventory: PlateInventory
  onChange(inventory: PlateInventory): void
  error?: string | null
}

/** The bar steps by 2.5 kg; a plate size holds 0 to 20 pairs (`validatePlateInventory`). */
const BAR_STEP = 2.5
const MAX_PAIRS = 20

/**
 * Edits the trainee's bar and plates (E15-T5), as rows on the Bar and plates page (DX-23): the bar
 * and each plate's pairs on a − value + stepper, no trash icons -- stepping a plate to 0 pairs
 * removes it -- then a new plate's weight and "Reset to defaults" as text at the bottom.
 */
export function PlateInventoryEditor(props: PlateInventoryEditorProps): JSX.Element {
  const { inventory, onChange, error } = props
  const [newKg, setNewKg] = useState('')

  function handleAdd(): void {
    const kg = Number(newKg)
    if (newKg.trim() === '' || Number.isNaN(kg)) return
    onChange({ ...inventory, plates: [...inventory.plates, { kg, pairs: 1 }] })
    setNewKg('')
  }

  function setPairs(kg: number, pairs: number): void {
    onChange({
      ...inventory,
      plates:
        pairs === 0
          ? inventory.plates.filter((p) => p.kg !== kg)
          : inventory.plates.map((p) => (p.kg === kg ? { ...p, pairs } : p)),
    })
  }

  return (
    <div className="plate-editor">
      <div className="plate-editor-rows">
        <div className="plate-editor-row">
          <span className="plate-editor-label">Bar</span>
          <Stepper
            label="Bar weight"
            value={`${inventory.barKg} kg`}
            canDecrease={inventory.barKg >= BAR_STEP}
            onDecrease={() => onChange({ ...inventory, barKg: Math.max(0, inventory.barKg - BAR_STEP) })}
            onIncrease={() => onChange({ ...inventory, barKg: inventory.barKg + BAR_STEP })}
          />
        </div>
        {inventory.plates.map((plate) => (
          <div key={plate.kg} className="plate-editor-row">
            <span className="plate-editor-label">
              {`${plate.kg} kg`}
              <span className="plate-editor-hint">pairs</span>
            </span>
            <Stepper
              label={`Pairs of ${plate.kg} kg`}
              value={String(plate.pairs)}
              canIncrease={plate.pairs < MAX_PAIRS}
              onDecrease={() => setPairs(plate.kg, plate.pairs - 1)}
              onIncrease={() => setPairs(plate.kg, plate.pairs + 1)}
            />
          </div>
        ))}
        <div className="plate-editor-row">
          <input
            type="number"
            inputMode="decimal"
            className="plate-editor-input"
            aria-label="New plate weight (kg)"
            placeholder="New plate (kg)"
            value={newKg}
            onChange={(event) => setNewKg(event.target.value)}
          />
          <button type="button" className="plate-editor-add btn-quiet" onClick={handleAdd}>
            Add plate
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="plate-editor-error">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="plate-editor-reset btn-quiet"
        onClick={() => onChange(DEFAULT_PLATE_INVENTORY)}
      >
        Reset to defaults
      </button>
    </div>
  )
}
