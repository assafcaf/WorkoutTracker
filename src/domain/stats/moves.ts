// E18-T7 [O18 O25 O26]: a finished Session in words: each lift's move, `Next time`, the volume
// line and the week heading. Pure; imports only src/domain/** and src/types.ts. Stub: the
// functions return empty values until the code-writer fills them in.
//
// Exported contract (chosen by the test-designer, documented here and in the tests). Every
// function reads `sessions` up to and including the Session named by `sessionId` ("as of that
// Session"); later Sessions are ignored.
//   sessionMoves(sessionId, sessions, resolve, program) -> LiftMove[]
//   nextTime(sessionId, sessions, resolve, program)     -> string[]
//   volumeLine(sessionId, sessions, resolve)            -> string
//   summaryWeek(sessionId, sessions, program)           -> { heading, line }
import type { Program, Session } from '../../types'
import type { Resolve } from '../muscles'

export type LiftMove = {
  exerciseId: string
  name: string
  /** The lift's top set that Session: `62.5 kg × 8`, `BW × 15`. */
  top: string
  /** The move in words: `Stepped up to 62.5 kg · +2.5 kg · record`. */
  text: string
}

export function sessionMoves(
  _sessionId: string,
  _sessions: Session[],
  _resolve: Resolve,
  _program: Program,
): LiftMove[] {
  return []
}

export function nextTime(
  _sessionId: string,
  _sessions: Session[],
  _resolve: Resolve,
  _program: Program,
): string[] {
  return []
}

export function volumeLine(_sessionId: string, _sessions: Session[], _resolve: Resolve): string {
  return ''
}

export function summaryWeek(
  _sessionId: string,
  _sessions: Session[],
  _program: Program,
): { heading: string; line: string } {
  return { heading: '', line: '' }
}
