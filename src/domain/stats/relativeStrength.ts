import type { BodyLog } from '../../types'
import { bodyweightOn } from '../bodyLog'

/** Est. strength as a multiple of the bodyweight on or before the day of `at`; `null` without one. */
export function relativeStrength(estKg: number, log: BodyLog, at: number): { ratio: number; text: string } | null {
  const bw = bodyweightOn(log, at)
  if (!bw || bw.kg <= 0) return null
  const ratio = Math.round((estKg / bw.kg) * 100) / 100
  return { ratio, text: `${ratio.toFixed(2)} × bodyweight` }
}
