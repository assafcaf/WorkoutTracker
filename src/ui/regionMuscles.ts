import { MUSCLES } from '../data/library'
import { regionsFor } from '../domain/muscles'
import type { Region } from '../domain/muscles'
import type { Muscle } from '../types'

/** Every muscle `regionsFor` maps to `region` -- the inverse of that mapping (E5-T20). */
export function musclesForRegion(region: Region): Muscle[] {
  return MUSCLES.filter((muscle) => regionsFor(muscle).includes(region))
}
