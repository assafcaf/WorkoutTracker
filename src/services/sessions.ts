import {
  clearSwap,
  finishSession,
  finishStaleSession,
  getActiveSession,
  getLastEntriesFor,
  getLastSwap,
  listSessions,
  logSet,
  deleteSet,
  restoreSet,
  saveSession,
  updateSet,
  setSwap,
  startOrResumeSession,
} from '../storage/sessionStore'
import type { Program, Session, SetEntry, Workout } from '../types'
import type { ServiceDeps } from './deps'
import { callStorage, ServiceError } from './errors'

export type SessionService = {
  resumeActive(): Promise<Session | null>
  start(programId: string, workoutId: string): Promise<Session>
  logSet(sessionId: string, entry: SetEntry): Promise<Session>
  updateSet(
    sessionId: string,
    exerciseId: string,
    setIndex: number,
    values: { weightKg: number | null; reps: number },
  ): Promise<Session>
  deleteSet(
    sessionId: string,
    exerciseId: string,
    setIndex: number,
  ): Promise<{ session: Session; removed: SetEntry }>
  restoreSet(sessionId: string, entry: SetEntry): Promise<Session>
  finish(sessionId: string): Promise<Session>
  save(session: Session): Promise<Session>
  lastEntriesFor(exerciseId: string): Promise<SetEntry[]>
  lastEntriesForSession(session: Session | null, programs: Program[]): Promise<Map<string, SetEntry[]>>
  lastSwapsForSession(session: Session | null, programs: Program[]): Promise<Record<string, string>>
  presetHistory(history: SetEntry[], session: Session, exerciseId: string): SetEntry[]
  list(): Promise<Session[]>
  applySwap(sessionId: string, plannedId: string, doneId: string): Promise<void>
  undoSwap(sessionId: string, plannedId: string): Promise<void>
  discard(sessionId: string): Promise<void>
}

// The UI shows no text when starting, finishing, swapping or reading history fails: each of
// these is the message a caller may surface, never one the screen shows today.
const START_FAILED = 'the workout could not be started'
const FINISH_FAILED = 'the workout could not be finished'
const SWAP_FAILED = 'the swap could not be saved'
const HISTORY_FAILED = 'the history could not be read'
/** SetScreen shows a failed log's message under the set as it stands. */
const LOG_FAILED = 'the set could not be saved'
/** The History editor shows a failed save's message under its Sets (E12-T6). */
const SAVE_FAILED = 'the workout could not be saved'

/** `sessionStore`'s rejection for an id it does not hold (`requireSession`). */
const MISSING_SESSION = /^no session .* is stored$/

/**
 * `op` through `callStorage`, with the store's missing-session rejection as `'not-found'` rather
 * than `'storage-failed'`.
 */
async function callSession<T>(
  deps: ServiceDeps,
  sessionId: string,
  op: () => Promise<T>,
  message: string,
): Promise<T> {
  return callStorage(
    deps,
    async () => {
      try {
        return await op()
      } catch (err) {
        if (err instanceof Error && MISSING_SESSION.test(err.message)) {
          throw new ServiceError('not-found', `no session ${sessionId} is stored`)
        }
        throw err
      }
    },
    message,
  )
}

/** The program and workout a session was started from, or null when the program is gone. */
function locateSession(
  programs: Program[],
  session: Session,
): { program: Program; workout: Workout } | null {
  const program = programs.find((candidate) => candidate.id === session.programId)
  const workout = program?.workouts.find((candidate) => candidate.id === session.workoutId)
  return program && workout ? { program, workout } : null
}

export function createSessionService(deps: ServiceDeps): SessionService {
  const { bus, now } = deps

  /** Runs a write, then announces it on `'sessions'`; a rejected write announces nothing. */
  async function write<T>(sessionId: string, op: () => Promise<T>, message: string): Promise<T> {
    const result = await callSession(deps, sessionId, op, message)
    bus.emit('sessions')
    return result
  }

  return {
    /**
     * The session in progress, or null when there is none or storage cannot be read. A stale
     * one is finished (or deleted, when empty) first, and that write is announced.
     */
    async resumeActive() {
      if (!deps.storageAvailable) return null
      try {
        const before = await getActiveSession()
        await finishStaleSession(now())
        const active = await getActiveSession()
        if (before && active?.id !== before.id) bus.emit('sessions')
        return active
      } catch {
        return null
      }
    },

    async start(programId, workoutId) {
      return callStorage(
        deps,
        async () => {
          const started = await startOrResumeSession(programId, workoutId, now())
          bus.emit('sessions')
          return started
        },
        START_FAILED,
      )
    },

    async logSet(sessionId, entry) {
      return write(sessionId, () => logSet(sessionId, entry, now()), LOG_FAILED)
    },

    async updateSet(sessionId, exerciseId, setIndex, values) {
      return write(
        sessionId,
        () => updateSet(sessionId, exerciseId, setIndex, values, now()),
        LOG_FAILED,
      )
    },

    async deleteSet(sessionId, exerciseId, setIndex) {
      return write(sessionId, () => deleteSet(sessionId, exerciseId, setIndex, now()), LOG_FAILED)
    },

    async restoreSet(sessionId, entry) {
      return write(sessionId, () => restoreSet(sessionId, entry, now()), LOG_FAILED)
    },

    async finish(sessionId) {
      return write(sessionId, () => finishSession(sessionId, now()), FINISH_FAILED)
    },

    async save(session) {
      return write(session.id, () => saveSession(session, now()), SAVE_FAILED)
    },

    async lastEntriesFor(exerciseId) {
      return callStorage(deps, () => getLastEntriesFor(exerciseId), HISTORY_FAILED)
    },

    /**
     * The last finished session's entries of every exercise `session`'s list can show: each
     * plan id of its workout, and each done id in `session.swaps`. A load that rejects just
     * leaves its id out, so that row reads as no history.
     */
    async lastEntriesForSession(session, programs) {
      if (!session) return new Map()
      const located = locateSession(programs, session)
      const planIds = located ? located.workout.exercises.map((plan) => plan.exerciseId) : []
      const ids = [...new Set([...planIds, ...Object.values(session.swaps ?? {})])]
      const loaded = await Promise.all(
        ids.map((id) =>
          callStorage(deps, () => getLastEntriesFor(id), HISTORY_FAILED).then(
            (entries) => [id, entries] as const,
            () => null,
          ),
        ),
      )
      return new Map(loaded.filter((pair) => pair !== null))
    },

    /**
     * The swap each plan of `session`'s workout carried in the last finished session of that
     * workout, plannedId -> doneId. Empty when the workout is gone or storage cannot answer.
     */
    async lastSwapsForSession(session, programs) {
      if (!session) return {}
      const located = locateSession(programs, session)
      if (!located) return {}
      try {
        const found: Record<string, string> = {}
        for (const plan of located.workout.exercises) {
          const doneId = await callStorage(
            deps,
            () => getLastSwap(session.programId, session.workoutId, plan.exerciseId),
            HISTORY_FAILED,
          )
          if (doneId !== null) found[plan.exerciseId] = doneId
        }
        return found
      } catch {
        return {}
      }
    },

    /**
     * What a set opens preset from: today's sets for the exercise laid over the last finished
     * session's, so a set past the plan opens on the set before it as it was actually lifted.
     */
    presetHistory(history, session, exerciseId) {
      const today = session.entries.filter((entry) => entry.exerciseId === exerciseId)
      const older = history.filter(
        (entry) => !today.some((logged) => logged.setIndex === entry.setIndex),
      )
      return [...older, ...today]
    },

    async list() {
      return callStorage(deps, () => listSessions(), HISTORY_FAILED)
    },

    async applySwap(sessionId, plannedId, doneId) {
      await write(sessionId, () => setSwap(sessionId, plannedId, doneId, now()), SWAP_FAILED)
    },

    /** Refused, as `'storage-failed'`, once the swapped-in exercise has a logged set. */
    async undoSwap(sessionId, plannedId) {
      await write(sessionId, () => clearSwap(sessionId, plannedId, now()), SWAP_FAILED)
    },

    /** Marks the Session deleted through `discardSession` (E12-T1). */
    async discard(sessionId) {
      void sessionId
      throw new Error('not implemented: SessionService.discard (E12-T1)')
    },
  }
}
