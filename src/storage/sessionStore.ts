import type { Session, SetEntry } from '../types'

/**
 * The session in progress, or a new one when there is none.
 *
 * At most one session ever has `finishedAt === null`; when one exists it is returned as it
 * stands, whatever program or workout was asked for.
 */
export async function startOrResumeSession(
  _programId: string,
  _workoutId: string,
  _now: number,
): Promise<Session> {
  throw new Error('startOrResumeSession is not implemented')
}

/**
 * The session with `finishedAt === null`, or null when there is none.
 */
export async function getActiveSession(): Promise<Session | null> {
  throw new Error('getActiveSession is not implemented')
}

/**
 * Records one set on a session and returns the session as stored.
 *
 * Writes the whole document, replacing any entry with the same `exerciseId` and `setIndex`.
 */
export async function logSet(_sessionId: string, _entry: SetEntry): Promise<Session> {
  throw new Error('logSet is not implemented')
}

/**
 * Stamps a session finished and returns it as stored.
 */
export async function finishSession(_sessionId: string, _now: number): Promise<Session> {
  throw new Error('finishSession is not implemented')
}

/**
 * The entries for `exerciseId` from the most recent finished session that contains it, in
 * `setIndex` order, across every program. Scans at most 200 sessions.
 */
export async function getLastEntriesFor(_exerciseId: string): Promise<SetEntry[]> {
  throw new Error('getLastEntriesFor is not implemented')
}

/**
 * Every finished session, newest first.
 */
export async function listSessions(): Promise<Session[]> {
  throw new Error('listSessions is not implemented')
}
