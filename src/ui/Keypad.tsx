export type KeypadProps = {
  label: string
  value: number | null
  onCommit(value: number): void
  onCancel(): void
}

/**
 * Stub for E1-T5. The number pad a dial's readout opens: digits, a decimal point, OK and
 * Cancel. Renders nothing until it is implemented, so its suite fails on assertions rather
 * than on a render that throws.
 */
export function Keypad(_props: KeypadProps): JSX.Element {
  return <div />
}
