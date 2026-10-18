import type { Session, SetEntry } from '../../types'
import type { ImportDraft } from './types'

const NOTE_MAX = 500
const MINUTE = 60_000

export function buildSessions(
  drafts: ImportDraft[],
  choices: Record<string, string | null>,
  source: 'Strong' | 'Hevy',
  now: number,
  newId: () => string,
  isBodyweight: (exerciseId: string) => boolean,
): { sessions: Session[]; leftOut: number } {
  const sessions: Session[] = []
  let leftOut = 0
  for (const draft of drafts) {
    const entries: SetEntry[] = []
    const counts = new Map<string, number>()
    for (const set of draft.sets) {
      const exerciseId = choices[set.name]
      if (!exerciseId) {
        leftOut += 1
        continue
      }
      const setIndex = (counts.get(exerciseId) ?? 0) + 1
      counts.set(exerciseId, setIndex)
      const weight = set.weightKg !== null && set.weightKg > 0 ? set.weightKg : null
      const bodyweight = isBodyweight(exerciseId)
      const entry: SetEntry = {
        exerciseId,
        setIndex,
        weightKg: bodyweight ? null : weight,
        reps: set.reps,
        loggedAt: draft.startedAt + entries.length * 1000,
      }
      if (bodyweight && weight !== null) entry.loadKg = weight
      if (set.kind) entry.kind = set.kind
      if (set.rir !== undefined) entry.rir = set.rir as SetEntry['rir']
      entries.push(entry)
    }
    if (entries.length === 0) continue
    const session: Session = {
      id: newId(),
      programId: source,
      workoutId: draft.workoutName.trim() === '' ? 'Imported workout' : draft.workoutName,
      startedAt: draft.startedAt,
      finishedAt: Math.max(draft.finishedAt, entries[entries.length - 1].loggedAt),
      entries,
      updatedAt: now,
    }
    if (draft.note) session.note = draft.note.slice(0, NOTE_MAX)
    sessions.push(session)
  }
  return { sessions, leftOut }
}

function keyOf(s: Session): string {
  const ids = Array.from(new Set(s.entries.map((e) => e.exerciseId))).sort()
  return `${Math.floor(s.startedAt / MINUTE)}|${ids.join(',')}`
}

export function skipDuplicates(
  existing: Session[],
  incoming: Session[],
): { sessions: Session[]; skipped: number } {
  const seen = new Set(existing.filter((s) => s.deletedAt === undefined).map(keyOf))
  const sessions: Session[] = []
  let skipped = 0
  for (const s of incoming) {
    const k = keyOf(s)
    if (seen.has(k)) {
      skipped += 1
      continue
    }
    seen.add(k)
    sessions.push(s)
  }
  return { sessions, skipped }
}
