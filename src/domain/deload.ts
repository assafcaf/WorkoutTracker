import type { Weekday } from './stats/weeks'

/** The weight a deload Set opens at: `weight` less 10 %, in whole `weightStep`s. */
export function deloadWeight(weight: number, weightStep: number): number {
  void weight
  void weightStep
  throw new Error('not implemented')
}

/** The line shown on a deloaded Set, e.g. `Deload: 72.5 (from 80)`. */
export function deloadText(deloaded: number, from: number): string {
  void deloaded
  void from
  throw new Error('not implemented')
}

/** Whether `stored` (the deload week's epoch ms, or null) falls in the same week as `now`. */
export function isDeloadWeek(stored: number | null, now: number, weekStartsOn: Weekday): boolean {
  void stored
  void now
  void weekStartsOn
  throw new Error('not implemented')
}
