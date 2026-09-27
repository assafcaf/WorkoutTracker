import type { Program, UserProgram } from '../types'
import type { ServiceDeps } from './deps'

/** Shown, and thrown as a `ServiceError('in-progress', ...)`, when a write would strand the
 * Session in progress (E9-T10's guard, moved here for E11-T5). */
export const IN_PROGRESS_MESSAGE = 'Finish the workout in progress first'

export type ProgramsLoad = {
  programs: Program[]
  userPrograms: UserProgram[]
  activeProgramId: string | null
  staleActiveProgramNotice: boolean
}

export type ProgramService = {
  load(): Promise<ProgramsLoad>
  setActive(id: string): Promise<void>
  save(program: UserProgram): Promise<void>
  remove(id: string): Promise<void>
  reset(id: string): Promise<void>
}

/**
 * The one service the UI loads, switches, saves, deletes and resets Programs through: it owns
 * the active-program fallback (E9-T2's `getActiveProgramId`) and the in-progress guard (E9-T10)
 * that `App.tsx` used to hold.
 */
export function createProgramService(_deps: ServiceDeps): ProgramService {
  throw new Error('createProgramService is not implemented yet')
}
