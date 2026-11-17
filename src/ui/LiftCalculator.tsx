import { useState } from 'react'
import { liftEstimate, percentTable, repMaxTable } from '../domain/calculator'
import type { CalcRow } from '../domain/calculator'
import { DEFAULT_PLATE_INVENTORY, formatPlates } from '../domain/plates'
import type { PlateInventory } from '../types'
import { Icon } from './icons'
import { Sheet } from './Sheet'
import './LiftCalculator.css'

export type LiftCalculatorProps = {
  /** The lift's name, the sheet's title. */
  name: string
  /** The lift's latest top set; the fields open on it. */
  weightKg: number
  reps: number
  /** The trainee's bar and plates; the default set when not known. */
  plates?: PlateInventory | null
  onClose(): void
}

const num = (kg: number): string => String(Math.round(kg * 100) / 100)

function parse(text: string): number | null {
  const value = Number(text.replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null
}

function Table({ title, rows, inventory }: { title: string; rows: CalcRow[]; inventory: PlateInventory }): JSX.Element {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="calc-table" aria-label={title}>
      <h3 className="calc-table-title">{title}</h3>
      <ul className="calc-rows">
        {rows.map((row, at) => {
          const head = row.reps !== undefined ? `${row.reps} ${row.reps === 1 ? 'rep' : 'reps'}` : `${row.percent} %`
          const spoken = `${head}, ${num(row.loadKg)} kilograms`
          return (
            <li key={at}>
              <button
                type="button"
                className="calc-row cell"
                aria-expanded={open === at}
                aria-label={spoken}
                onClick={() => setOpen(open === at ? null : at)}
              >
                <span className="calc-row-head">{head}</span>
                <span className="calc-row-load">{num(row.loadKg)} kg</span>
              </button>
              {open === at ? <p className="calc-plates">{formatPlates(row.loading, inventory)}</p> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * "What can I lift": a weight and reps become Est. strength, a 1-12 rep table and a 50-95 %
 * table, each load rounded to the plates the trainee owns; a row opens its plate line.
 */
export function LiftCalculator({ name, weightKg, reps, plates, onClose }: LiftCalculatorProps): JSX.Element {
  const inventory = plates ?? DEFAULT_PLATE_INVENTORY
  const [weight, setWeight] = useState(num(weightKg))
  const [repsText, setRepsText] = useState(String(reps))
  const w = parse(weight)
  const r = parse(repsText)
  const ok = w !== null && r !== null && Number.isInteger(r)
  const est = ok ? liftEstimate(w, r) : null
  const estText = est === null ? null : (Math.round(est * 10) / 10).toFixed(1)

  return (
    <Sheet label={`${name} lift calculator`} onClose={onClose}>
      <div className="sheet-head">
        <h2 className="sheet-title">What can I lift</h2>
        <button type="button" className="sheet-close icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="X" size={24} />
        </button>
      </div>
      <div className="calc-inputs">
        <label className="calc-field">
          <span className="calc-field-label">Weight (kg)</span>
          <input
            type="text"
            inputMode="decimal"
            className="calc-input"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
        </label>
        <label className="calc-field">
          <span className="calc-field-label">Reps</span>
          <input
            type="text"
            inputMode="numeric"
            className="calc-input"
            value={repsText}
            onChange={(event) => setRepsText(event.target.value)}
          />
        </label>
      </div>
      {est === null || estText === null ? (
        <p className="calc-hint">Enter a weight and a whole number of reps.</p>
      ) : (
        <>
          <p className="calc-est" role="status" aria-label={`Est. strength ${estText} kilograms`}>
            <span className="calc-est-label">Est. strength</span>
            <span className="calc-est-value">{estText}</span>
            <span className="calc-est-unit"> kg</span>
          </p>
          <div className="calc-tables">
            <Table title="Rep maxes" rows={repMaxTable(est, inventory)} inventory={inventory} />
            <Table title="Percent of Est. strength" rows={percentTable(est, inventory)} inventory={inventory} />
          </div>
        </>
      )}
    </Sheet>
  )
}
