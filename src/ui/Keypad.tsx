import { useState } from 'react'

export type KeypadProps = {
  label: string
  value: number | null
  onCommit(value: number): void
  onCancel(): void
}

/** The keys, laid out as the three-by-four grid a thumb expects. */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0']

/**
 * The number pad a dial's readout opens: digits, a decimal point, OK and Cancel.
 *
 * It starts on an empty entry showing the dial's current value as a hint, so the first digit
 * tapped replaces the weight rather than being appended to it. OK commits what was typed;
 * an empty entry has nothing to commit and cancels instead.
 */
export function Keypad(props: KeypadProps): JSX.Element {
  const { label, value, onCommit, onCancel } = props
  const [entry, setEntry] = useState('')

  function append(key: string): void {
    // One decimal point at most; the dials all read in tenths of a kg or half reps.
    if (key === '.' && entry.includes('.')) return
    setEntry(entry + key)
  }

  function commit(): void {
    const entered = Number(entry)
    if (entry === '' || Number.isNaN(entered)) {
      onCancel()
      return
    }
    onCommit(entered)
  }

  const shown = entry === '' ? (value === null ? '' : String(value)) : entry

  return (
    <div className="keypad" role="group" aria-label={`${label} keypad`}>
      <output className="keypad-entry">{shown}</output>
      <div className="keypad-keys">
        {KEYS.map((key) => (
          <button key={key} type="button" onClick={() => append(key)}>
            {key}
          </button>
        ))}
      </div>
      <div className="keypad-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={commit}>
          OK
        </button>
      </div>
    </div>
  )
}
