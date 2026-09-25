import type { Exercise, Program, UserProgram } from '../types'

/** One validation fault: the field it sits on, and what the trainee is told (E9-T1). */
export type ProgramFault = { path: string; message: string }

export function mergePrograms(_bundled: Program[], _user: UserProgram[]): Program[] {
  throw new Error('not implemented')
}

export function visiblePrograms(_programs: Program[]): Program[] {
  throw new Error('not implemented')
}

export function validateProgram(
  _program: Program,
  _resolve: (id: string) => Exercise | undefined,
): ProgramFault[] {
  throw new Error('not implemented')
}
