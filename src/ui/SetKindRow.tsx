import type { SetKind } from '../types'
import './SetKindRow.css'

export type SetKindRowProps = {
  /** The chosen kind; `null` is Working. */
  value: SetKind | null
  onChange(kind: SetKind | null): void
}

const CHOICES: { label: string; kind: SetKind | null }[] = [
  { label: 'Warm-up', kind: 'warmup' },
  { label: 'Working', kind: null },
  { label: 'Drop', kind: 'drop' },
  { label: 'Failure', kind: 'failure' },
  { label: 'AMRAP', kind: 'amrap' },
]

/** A kind's name as the chips and the tools sheet's Set type row read it. */
export function setKindLabel(kind: SetKind | null): string {
  return CHOICES.find((choice) => choice.kind === kind)?.label ?? 'Working'
}

/** The Set kind chips `Warm-up · Working · Drop · Failure · AMRAP` (E14-T9, S2b). */
export function SetKindRow({ value, onChange }: SetKindRowProps): JSX.Element {
  return (
    <div className="set-kind-row" role="group" aria-label="Set kind">
      {CHOICES.map(({ label, kind }) => (
        <button
          key={label}
          type="button"
          className="set-kind-choice chip"
          aria-pressed={kind === value}
          onClick={() => onChange(kind)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
