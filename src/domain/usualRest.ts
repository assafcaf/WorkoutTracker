import { countsTowardStats } from './setKind'
import type { Session } from '../types'

/** A gap longer than this between two Sets is a break, not a rest, and is left out. */
const LONGEST_REST_SECONDS = 15 * 60

/** Fewer rests than this say nothing usual. */
const FEWEST_RESTS = 3

/** The latest rests the median is taken over. */
const LATEST_RESTS = 20

/**
 * How long the trainee usually rests after a working Set of `exerciseId` (the rest panel's
 * "you usually rest 2:40", Progress Dashboard S4), in seconds rounded to 5 s, from `sessions`.
 *
 * A Set's rest is its stored `restSeconds` when it has one (Skip stores what was rested, ±15 s
 * and the rest Dial what was chosen), else the time to the Session's next Set, whichever
 * Exercise that was. Breaks over 15 min are left out. The median of the latest 20 rests; null
 * under 3.
 */
export function usualRestSeconds(exerciseId: string, sessions: Session[]): number | null {
  const rests: { at: number; seconds: number }[] = []
  for (const session of sessions) {
    const entries = [...session.entries].sort((a, b) => a.loggedAt - b.loggedAt)
    entries.forEach((entry, index) => {
      if (entry.exerciseId !== exerciseId || !countsTowardStats(entry)) return
      const next = entries[index + 1]
      const seconds =
        entry.restSeconds ?? (next === undefined ? null : (next.loggedAt - entry.loggedAt) / 1000)
      if (seconds === null || seconds <= 0 || seconds > LONGEST_REST_SECONDS) return
      rests.push({ at: entry.loggedAt, seconds })
    })
  }
  if (rests.length < FEWEST_RESTS) return null
  const latest = rests
    .sort((a, b) => a.at - b.at)
    .slice(-LATEST_RESTS)
    .map((rest) => rest.seconds)
    .sort((a, b) => a - b)
  const middle = Math.floor(latest.length / 2)
  const median =
    latest.length % 2 === 1 ? latest[middle] : (latest[middle - 1] + latest[middle]) / 2
  return Math.round(median / 5) * 5
}
