import type { Session, SetEntry } from '../types'
import { db } from './db'

/** How many finished sessions a history lookup walks before it gives up. */
const HISTORY_SCAN_LIMIT = 200

/** Distinguishes two sessions started in the same millisecond, when there is no randomUUID. */
let idCounter = 0

/**
 * A session id unique on this device. The clock alone would collide for two sessions started
 * in the same millisecond, so the fallback adds a counter and some randomness.
 */
function newSessionId(now: number): string {
  const webCrypto = globalThis.crypto as Crypto | undefined
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID()
  idCounter += 1
  return `${now.toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isFinished(session: Session): boolean {
  return session.finishedAt !== null
}

/**
 * Finished sessions, newest first, across every program, at most `limit` of them. The cap
 * keeps the newest end, so only sessions older than it fall out of reach.
 */
async function finishedSessionsNewestFirst(limit?: number): Promise<Session[]> {
  const finished = db.sessions.orderBy('startedAt').reverse().filter(isFinished)
  return limit === undefined ? finished.toArray() : finished.limit(limit).toArray()
}

/**
 * The stored session, or an error naming the id: a set is never dropped quietly.
 */
async function requireSession(sessionId: string): Promise<Session> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error(`no session ${sessionId} is stored`)
  return session
}

/** How long a Session in progress may sit untouched before it finishes itself (E8-T6). */
export const STALE_SESSION_MS = 4 * 60 * 60 * 1000

/**
 * Finishes the Session in progress at its last activity when that was `STALE_SESSION_MS` or
 * more before `now`, or deletes it when it holds no Sets (E8-T6).
 */
export async function finishStaleSession(now: number): Promise<void> {
  void now
  throw new Error('not implemented: finishStaleSession (E8-T6)')
}

/**
 * The session in progress, or a new one when there is none.
 *
 * At most one session ever has `finishedAt === null`; when one exists it is returned as it
 * stands, whatever program or workout was asked for.
 */
export async function startOrResumeSession(
  programId: string,
  workoutId: string,
  now: number,
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const active = await getActiveSession()
    if (active) return active

    const session: Session = {
      id: newSessionId(now),
      programId,
      workoutId,
      startedAt: now,
      finishedAt: null,
      entries: [],
      updatedAt: now,
    }
    await db.sessions.put(session)
    return session
  })
}

/**
 * The session with `finishedAt === null`, or null when there is none.
 */
export async function getActiveSession(): Promise<Session | null> {
  const active = await db.sessions
    .orderBy('startedAt')
    .reverse()
    .filter((session) => !isFinished(session))
    .first()
  return active ?? null
}

/**
 * Records one set on a session and returns the session as stored.
 *
 * Writes the whole document, replacing any entry with the same `exerciseId` and `setIndex`.
 */
export async function logSet(sessionId: string, entry: SetEntry): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(sessionId)
    const entries = [...session.entries]
    const at = entries.findIndex(
      (stored) => stored.exerciseId === entry.exerciseId && stored.setIndex === entry.setIndex,
    )
    if (at >= 0) entries[at] = entry
    else entries.push(entry)

    const updated: Session = { ...session, entries, updatedAt: Date.now() }
    await db.sessions.put(updated)
    return updated
  })
}

/**
 * Stamps a session finished and returns it as stored.
 */
export async function finishSession(sessionId: string, now: number): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(sessionId)
    const finished: Session = { ...session, finishedAt: now, updatedAt: now }
    await db.sessions.put(finished)
    return finished
  })
}

/**
 * The entries for `exerciseId` from the most recent finished session that contains it, in
 * `setIndex` order, across every program. Scans at most 200 sessions.
 */
export async function getLastEntriesFor(exerciseId: string): Promise<SetEntry[]> {
  for (const session of await finishedSessionsNewestFirst(HISTORY_SCAN_LIMIT)) {
    const entries = session.entries.filter((entry) => entry.exerciseId === exerciseId)
    // The first session holding the exercise is the answer; older ones are not merged in.
    if (entries.length > 0) return entries.sort((one, other) => one.setIndex - other.setIndex)
  }
  return []
}

/**
 * Every finished session, newest first.
 */
export async function listSessions(): Promise<Session[]> {
  return finishedSessionsNewestFirst()
}

// --- swaps (E5-T11) -------------------------------------------------------------------------

/**
 * Records that `plannedId` was swapped for `doneId` on `sessionId`.
 */
export async function setSwap(
  sessionId: string,
  plannedId: string,
  doneId: string,
): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(sessionId)
    const swaps = { ...session.swaps, [plannedId]: doneId }
    await db.sessions.put({ ...session, swaps, updatedAt: Date.now() })
  })
}

/**
 * Removes the swap for `plannedId` on `sessionId`. Rejects if the session already has a
 * logged entry for the done id.
 */
export async function clearSwap(sessionId: string, plannedId: string): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(sessionId)
    const doneId = session.swaps?.[plannedId]
    if (doneId !== undefined) {
      const hasLoggedEntry = session.entries.some((entry) => entry.exerciseId === doneId)
      if (hasLoggedEntry) {
        throw new Error(
          `cannot clear swap for ${plannedId}: session ${sessionId} already has a logged entry for ${doneId}`,
        )
      }
    }

    const swaps = { ...session.swaps }
    delete swaps[plannedId]
    await db.sessions.put({ ...session, swaps, updatedAt: Date.now() })
  })
}

/**
 * The swap recorded for `plannedId`, from the most recent finished session of `workoutId`
 * under `programId`, or null when none exists.
 */
export async function getLastSwap(
  programId: string,
  workoutId: string,
  plannedId: string,
): Promise<string | null> {
  const sessions = await finishedSessionsNewestFirst()
  for (const session of sessions) {
    if (session.programId !== programId || session.workoutId !== workoutId) continue
    const doneId = session.swaps?.[plannedId]
    if (doneId !== undefined) return doneId
  }
  return null
}
