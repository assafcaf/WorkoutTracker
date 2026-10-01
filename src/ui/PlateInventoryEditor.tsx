import { useState } from 'react'
import { DEFAULT_PLATE_INVENTORY } from '../domain/plates'
import type { PlateInventory } from '../types'
import './PlateInventoryEditor.css'

export type PlateInventoryEditorProps = {
  inventory: PlateInventory
  onChange(inventory: PlateInventory): void
  error?: string | null
}

/** Edits the trainee's bar and plates (E15-T5). */
export function PlateInventoryEditor(props: PlateInventoryEditorProps): JSX.Element {
  const { inventory, onChange, error } = props
  const [newKg, setNewKg] = useState('')

  function handleAdd(): void {
    const kg = Number(newKg)
    if (newKg.trim() === '' || Number.isNaN(kg)) return
    onChange({ ...inventory, plates: [...inventory.plates, { kg, pairs: 1 }] })
    setNewKg('')
  }

  return (
    <div className="plate-editor">
      <label className="plate-editor-row">
        <span className="plate-editor-label">Bar weight (kg)</span>
        <input
          type="number"
          className="plate-editor-input"
          aria-label="Bar weight (kg)"
          value={inventory.barKg}
          onChange={(event) => onChange({ ...inventory, barKg: Number(event.target.value) })}
        />
      </label>
      {inventory.plates.map((plate) => (
        <div key={plate.kg} className="plate-editor-row">
          <span className="plate-editor-label">{plate.kg} kg</span>
          <input
            type="number"
            className="plate-editor-input"
            aria-label={`Pairs of ${plate.kg} kg`}
            value={plate.pairs}
            onChange={(event) =>
              onChange({
                ...inventory,
                plates: inventory.plates.map((p) =>
                  p.kg === plate.kg ? { ...p, pairs: Number(event.target.value) } : p,
                ),
              })
            }
          />
          <button
            type="button"
            className="plate-editor-button"
            onClick={() =>
              onChange({ ...inventory, plates: inventory.plates.filter((p) => p.kg !== plate.kg) })
            }
          >
            Remove {plate.kg} kg
          </button>
        </div>
      ))}
      <div className="plate-editor-row">
        <input
          type="number"
          className="plate-editor-input"
          aria-label="New plate weight (kg)"
          value={newKg}
          onChange={(event) => setNewKg(event.target.value)}
        />
        <button type="button" className="plate-editor-button" onClick={handleAdd}>
          Add plate
        </button>
      </div>
      <button
        type="button"
        className="plate-editor-button"
        onClick={() => onChange(DEFAULT_PLATE_INVENTORY)}
      >
        Reset to defaults
      </button>
      {error ? (
        <p role="alert" className="plate-editor-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
