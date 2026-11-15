// v6: what earns a "PR" tag in a lift's log. Pure.
//
// A Session holds a real record when one of its straight sets is, at that time:
//   - the heaviest load ever lifted (a Bodyweight lift's signed Load: less assistance, or more
//     added load), or
//   - the best estimated max ever, by at least 0.5 kg (loaded lifts only), or
//   - on a plain Bodyweight lift (every set ever at BW), the most reps ever in one set.
// A rep best at a weight already lifted is not a PR here (V5-06). The first Session has nothing to
// beat, and a deload Session never sets one.
//
// NOTE: the shared PR rule is `isRealRecord` / `sessionPrs` in records.ts (branch ux-v6/records); this is the lift
// page's, kept small so it can be swapped for the shared one.
import type { LiftHistory } from './liftHistory'
import { leverOf, straightSets } from './liftHistory'

export type RealRecordKind = 'Heaviest weight' | 'Least assistance' | 'Heaviest added load' | 'Best est. max' | 'Most reps'

type Lifted = { lever: number; reps: number }

const MIN_EST_GAIN = 0.5

/** Estimated max (Epley): weight × (1 + reps / 30). */
export function estimatedMax(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

/**
 * Whether `set` is a real record against every straight set lifted `before` it, and which kind.
 * `plainBodyweight`: the lift has only ever been done at BW, so reps are its measure.
 */
export function isRecordSet(
  set: Lifted,
  before: Lifted[],
  bodyweight: boolean,
  plainBodyweight = false,
): RealRecordKind | null {
  if (before.length === 0) return null
  const heaviest = Math.max(...before.map((s) => s.lever))
  if (plainBodyweight) {
    return set.reps > Math.max(...before.map((s) => s.reps)) ? 'Most reps' : null
  }
  if (set.lever > heaviest) {
    if (!bodyweight) return 'Heaviest weight'
    return set.lever <= 0 ? 'Least assistance' : 'Heaviest added load'
  }
  if (!bodyweight) {
    const best = Math.max(...before.map((s) => estimatedMax(s.lever, s.reps)))
    if (estimatedMax(set.lever, set.reps) >= best + MIN_EST_GAIN) return 'Best est. max'
  }
  return null
}

/** A Session's real record: its kind and the Set (`setIndex`) that set it. */
export type SessionRealRecord = { kind: RealRecordKind; setIndex: number }

/** The real record each Session of `history` set, by sessionId (only Sessions that set one). */
export function realRecords(history: LiftHistory): Map<string, SessionRealRecord> {
  const out = new Map<string, SessionRealRecord>()
  const plain = history.bodyweight && history.points.every((p) => straightSets(p.workingSets).every((s) => leverOf(s, true) === 0))
  const before: Lifted[] = []
  for (const point of history.points) {
    const straight = straightSets(point.workingSets)
    const sets = straight.map((s) => ({ lever: leverOf(s, history.bodyweight), reps: s.reps }))
    if (!point.deload) {
      for (let i = 0; i < sets.length; i += 1) {
        const kind = isRecordSet(sets[i], before, history.bodyweight, plain)
        if (kind) {
          out.set(point.sessionId, { kind, setIndex: straight[i].setIndex })
          break
        }
      }
    }
    before.push(...sets)
  }
  return out
}
