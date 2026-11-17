import type { BodyLog } from '../../types'

/** Est. strength as a multiple of the bodyweight on or before the day of `at`; `null` without one. */
export function relativeStrength(estKg: number, log: BodyLog, at: number): { ratio: number; text: string } | null {
  void estKg
  void log
  void at
  throw new Error('NotImplementedError')
}
