import type { Session, SetEntry } from '../types'
import { db } from './db'
import { END_BEFORE_START, NO_SETS_LEFT, insertSet, removeSet } from '../domain/setEdits'

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

/** False when the Session has been discarded or deleted (`deletedAt` set) (E12-T1). */
export function isLive(session: Session): boolean {
  return session.deletedAt === undefined
}

/**
 * Stores the Session marked deleted, `deletedAt` and `updatedAt` at `now`, entries kept (E12-T1).
 * Rejects with `no session <id> is stored` for an unknown id.
 */
export async function discardSession(sessionId: string, now: number): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(sessionId)
    await db.sessions.put({ ...session, deletedAt: now, updatedAt: now })
  })
}

/**
 * Finished sessions, newest first, across every program, at most `limit` of them. The cap
 * keeps the newest end, so only sessions older than it fall out of reach.
 */
async function finishedSessionsNewestFirst(limit?: number): Promise<Session[]> {
  const finished = db.sessions
    .orderBy('startedAt')
    .reverse()
    .filter((session) => isFinished(session) && isLive(session))
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
 * more before `now`, or marks it deleted when it holds no Sets (E8-T6, E12-T1).
 */
export async function finishStaleSession(now: number): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const active = await getActiveSession()
    if (!active) return
    const lastActivity = active.entries.reduce(
      (latest, entry) => Math.max(latest, entry.loggedAt),
      active.startedAt,
    )
    if (now - lastActivity < STALE_SESSION_MS) return
    // An empty session has nothing for history or presets, so it goes rather than finishes:
    // marked deleted, not removed, so the deletion syncs to other devices (E12-T1).
    if (active.entries.length === 0) {
      await db.sessions.put({ ...active, deletedAt: now, updatedAt: now })
    } else await db.sessions.put({ ...active, finishedAt: lastActivity, updatedAt: now })
  })
}

/**
 * The session in progress, or a new one when there is none.
 *
 * At most one session ever has `finishedAt === null`; when one exists it is returned as it
 * stands, whatever program or workout was asked for, unless it has gone stale (E8-T6).
 */
export async function startOrResumeSession(
  programId: string,
  workoutId: string,
  now: number,
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    await finishStaleSession(now)
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
 * The live session with `finishedAt === null`, or null when there is none.
 */
export async function getActiveSession(): Promise<Session | null> {
  const active = await db.sessions
    .orderBy('startedAt')
    .reverse()
    .filter((session) => !isFinished(session) && isLive(session))
    .first()
  return active ?? null
}

/**
 * Records one set on a session and returns the session as stored.
 *
 * Writes the whole document, replacing any entry with the same `exerciseId` and `setIndex`.
 */
export async function logSet(
  sessionId: string,
  entry: SetEntry,
  now: number = Date.now(),
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(sessionId)
    const entries = [...session.entries]
    const at = entries.findIndex(
      (stored) => stored.exerciseId === entry.exerciseId && stored.setIndex === entry.setIndex,
    )
    if (at >= 0) entries[at] = entry
    else entries.push(entry)

    const updated: Session = { ...session, entries, updatedAt: now }
    await db.sessions.put(updated)
    return updated
  })
}

/** Replaces the weight and reps of one logged Set, keeping its `setIndex` and `loggedAt`. */
export async function updateSet(
  sessionId: string,
  exerciseId: string,
  setIndex: number,
  values: { weightKg: number | null; reps: number },
  now: number = Date.now(),
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(sessionId)
    const at = session.entries.findIndex(
      (stored) => stored.exerciseId === exerciseId && stored.setIndex === setIndex,
    )
    if (at < 0) throw new Error(`no set ${setIndex} of ${exerciseId} is logged`)
    const entries = [...session.entries]
    entries[at] = { ...entries[at], weightKg: values.weightKg, reps: values.reps }
    const updated: Session = { ...session, entries, updatedAt: now }
    await db.sessions.put(updated)
    return updated
  })
}

/** Stores a changed rest length on one logged Set (E13-T5). */
export async function setRest(
  sessionId: string,
  exerciseId: string,
  setIndex: number,
  restSeconds: number,
  now: number = Date.now(),
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(sessionId)
    const at = session.entries.findIndex(
      (stored) => stored.exerciseId === exerciseId && stored.setIndex === setIndex,
    )
    if (at < 0) throw new Error(`no set ${setIndex} of ${exerciseId} is logged`)
    const entries = [...session.entries]
    entries[at] = { ...entries[at], restSeconds }
    const updated: Session = { ...session, entries, updatedAt: now }
    await db.sessions.put(updated)
    return updated
  })
}

/** Removes one logged Set, renumbering the Exercise's later Sets down by one. */
export async function deleteSet(
  sessionId: string,
  exerciseId: string,
  setIndex: number,
  now: number = Date.now(),
): Promise<{ session: Session; removed: SetEntry }> {
  return db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(sessionId)
    const { entries, removed } = removeSet(session.entries, exerciseId, setIndex)
    const updated: Session = { ...session, entries, updatedAt: now }
    await db.sessions.put(updated)
    return { session: updated, removed }
  })
}

/** Puts a removed Set back where it was, moving the Exercise's later Sets up by one. */
export async function restoreSet(
  sessionId: string,
  entry: SetEntry,
  now: number = Date.now(),
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(sessionId)
    const updated: Session = { ...session, entries: insertSet(session.entries, entry), updatedAt: now }
    await db.sessions.put(updated)
    return updated
  })
}

/**
 * The History editor's single write (E12-T6): checks `finishedAt >= startedAt` and that at
 * least one Set remains, stamps `updatedAt`, and stores the whole Session in one `put`.
 */
export async function saveSession(session: Session, now: number = Date.now()): Promise<Session> {
  if (session.finishedAt !== null && session.finishedAt < session.startedAt) {
    throw new Error(END_BEFORE_START)
  }
  if (session.entries.length === 0) throw new Error(NO_SETS_LEFT)
  return db.transaction('rw', db.sessions, async () => {
    await requireSession(session.id)
    const updated: Session = { ...session, updatedAt: now }
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

// --- whole-table reads and writes for sync and backup (E11-T2) ------------------------------

/** Sessions stamped after `since`, plus every session never stamped. */
export async function sessionsChangedSince(since: number): Promise<Session[]> {
  return db.transaction('r', db.sessions, async () => {
    const changed = await db.sessions.where('updatedAt').above(since).toArray()
    // A session from before E7 has no stamp, so the `updatedAt` index never lists it.
    const unstamped = await db.sessions.filter((session) => session.updatedAt === undefined).toArray()
    return [...changed, ...unstamped]
  })
}

/** Every stored session, finished or in progress. */
export async function allSessions(): Promise<Session[]> {
  return db.sessions.toArray()
}

/** Writes each session as given, replacing any stored one with the same id. */
export async function putSessions(sessions: Session[]): Promise<void> {
  await db.sessions.bulkPut(sessions)
}

/** Clears the sessions table and writes `sessions`, in one transaction. */
export async function replaceAllSessions(sessions: Session[]): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    await db.sessions.clear()
    await db.sessions.bulkPut(sessions)
  })
}

// --- swaps (E5-T11) -------------------------------------------------------------------------

/**
 * Records that `plannedId` was swapped for `doneId` on `sessionId`.
 */
export async function setSwap(
  sessionId: string,
  plannedId: string,
  doneId: string,
  now: number = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const session = await requireSession(sessionId)
    const swaps = { ...session.swaps, [plannedId]: doneId }
    await db.sessions.put({ ...session, swaps, updatedAt: now })
  })
}

/**
 * Removes the swap for `plannedId` on `sessionId`. Rejects if the session already has a
 * logged entry for the done id.
 */
export async function clearSwap(
  sessionId: string,
  plannedId: string,
  now: number = Date.now(),
): Promise<void> {
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
    await db.sessions.put({ ...session, swaps, updatedAt: now })
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
