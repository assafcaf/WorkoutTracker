import type { SetKind } from '../types'
import './SetKindRow.css'

export type SetKindRowProps = {
  /** The chosen kind; `null` is Working. */
  value: SetKind | null
  onChange(kind: SetKind | null): void
}

const CHOICES: { label: string; kind: SetKind | null }[] = [
  { label: 'W-up', kind: 'warmup' },
  { label: 'Working', kind: null },
  { label: 'Drop', kind: 'drop' },
  { label: 'Fail', kind: 'failure' },
  { label: 'AMRAP', kind: 'amrap' },
]

/** The segmented row `W-up | Working | Drop | Fail | AMRAP` under the Dials (E14-T9). */
export function SetKindRow({ value, onChange }: SetKindRowProps): JSX.Element {
  return (
    <div className="set-kind-row" role="group" aria-label="Set kind">
      {CHOICES.map(({ label, kind }) => (
        <button
          key={label}
          type="button"
          className="set-kind-choice"
          aria-pressed={kind === value}
          onClick={() => onChange(kind)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
