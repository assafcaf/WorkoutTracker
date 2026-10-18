import { weekStart, type Weekday } from './stats/weeks'

/** The weight a deload Set opens at: `weight` less 10 %, in whole `weightStep`s. */
export function deloadWeight(weight: number, weightStep: number): number {
  const wanted = (weight * 0.1) / weightStep
  // Nearest whole number of steps; a tie takes the lighter weight (more steps off). At least one.
  const steps = Math.max(1, Math.floor(wanted + 0.5 + 1e-9))
  return Math.max(0, Math.round((weight - steps * weightStep) * 1e6) / 1e6)
}

/** The line shown on a deloaded Set, e.g. `Deload: 72.5 (from 80)`. */
export function deloadText(deloaded: number, from: number): string {
  return `Deload: ${deloaded} (from ${from})`
}

/** Whether `stored` (the deload week's epoch ms, or null) falls in the same week as `now`. */
export function isDeloadWeek(stored: number | null, now: number, weekStartsOn: Weekday): boolean {
  return stored !== null && weekStart(stored, weekStartsOn) === weekStart(now, weekStartsOn)
}
