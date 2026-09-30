import type { SetKind } from '../types'

export type SetKindRowProps = {
  /** The chosen kind; `null` is Working. */
  value: SetKind | null
  onChange(kind: SetKind | null): void
}

/**
 * STUB (E14-T9 test-designer): the segmented row `W-up | Working | Drop | Fail | AMRAP`.
 */
export function SetKindRow(_props: SetKindRowProps): JSX.Element {
  throw new Error('NotImplementedError: SetKindRow')
}
