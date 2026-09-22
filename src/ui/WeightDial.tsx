import type { Exercise } from '../types'

export type WeightDialProps = {
  exercise: Exercise
  value: number | null
  onChange(value: number | null): void
}

/**
 * Stub for E1-T5. The weight scroll-snap column with its minus/plus buttons and its readout.
 */
export function WeightDial(_props: WeightDialProps): JSX.Element {
  return <div />
}
