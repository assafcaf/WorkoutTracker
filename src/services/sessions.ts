import type { Program, Session, SetEntry } from '../types'
import type { ServiceDeps } from './deps'

export type SessionService = {
  resumeActive(): Promise<Session | null>
  start(programId: string, workoutId: string): Promise<Session>
  logSet(sessionId: string, entry: SetEntry): Promise<Session>
  finish(sessionId: string): Promise<Session>
  lastEntriesFor(exerciseId: string): Promise<SetEntry[]>
  lastEntriesForSession(session: Session | null, programs: Program[]): Promise<Map<string, SetEntry[]>>
  lastSwapsForSession(session: Session | null, programs: Program[]): Promise<Record<string, string>>
  presetHistory(history: SetEntry[], session: Session, exerciseId: string): SetEntry[]
  list(): Promise<Session[]>
  applySwap(sessionId: string, plannedId: string, doneId: string): Promise<void>
  undoSwap(sessionId: string, plannedId: string): Promise<void>
}

export function createSessionService(deps: ServiceDeps): SessionService {
  void deps
  throw new Error('not implemented')
}
