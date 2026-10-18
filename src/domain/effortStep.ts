import type { SetEntry } from '../types'

/**
 * E21 one effort rule: how many steps a full bar earns. 2 when every counted Set carries
 * `rir` >= 2, 0 when every one carries `rir` 0, else 1 (a mix, or any Set without `rir`).
 */
export function effortSteps(sets: SetEntry[]): 0 | 1 | 2 {
  void sets
  return 1 // stub
}
