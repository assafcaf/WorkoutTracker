// E18-T7 [O11 O18 R-C]: every generated sentence of the stats screens, from engine values only.
// Pure; imports only src/domain/** and src/types.ts. Stub: the code-writer fills it in.
//
// Exported contract (chosen by the test-designer, documented here and in the tests):
//   leverText(lever, bodyweight)      -> '62.5 kg' | 'BW' | 'BW+5' | 'BW−19' (U+2212)
//   topText(top, bodyweight)          -> '13 kg × 9' | 'BW × 15'
//   humanDate(ms)                     -> 'Wed 14 Oct' (local time, no year)
//   verdictLabel(kind)                -> '▲ Moving' | '■ Stalled' | '▼ Slipping' | '○ Too new'
//   nextStepText(step, bodyweight)    -> '15 of 20 reps at 62.5 kg'
//   suggestionText(step, bodyweight)  -> 'Try 15 kg next' | 'Try one more set next' | null
//   compareText(compare, bodyweight)  -> '13 × 9 → 13 × 9 · no change' | null
//   homeCopy(program, sessions, resolve, now) -> HomeCopy
import type { Program, Session } from '../../types'
import type { Resolve } from '../muscles'
import type { Compare } from './ladder'
import type { NextStep, VerdictKind } from './verdict'

export type HomeStage = 'empty' | 'starting' | 'early' | 'full'

export type AttentionCard = {
  exerciseId: string
  kind: 'slipping' | 'stalled' | 'ready'
  sentence: string
  suggestion: string
  /** The `Why?` lines: the rule, the last 4 non-deload Sessions' top sets, the bar to clear. */
  why: string[]
}

export type StartingPoint = {
  exerciseId: string
  name: string
  /** The lift's latest top set when logged, else its prescription (`4 × 8–10`). */
  value: string
  /** `Too new · 2 more` for a logged lift in a sparse state, else ''. */
  note: string
}

export type HomeCopy = {
  stage: HomeStage
  /** `11 of 14 lifts moving.` ('Too early to call' when stage is 'early'; '' otherwise). */
  sentence: string
  /** `▲ 11 moving · ■ 2 stalled · ▼ 1 slipping · ↑ 1 ready`; '' unless stage is 'full'. */
  counts: string
  /** `12 of 14 lifts stepped up since Fri 18 Sep.`; '' unless stage is 'full'. */
  climbed: string
  /** `2 of 3 this week`; '' unless stage is 'full'. */
  adherence: string
  cards: AttentionCard[]
  /** Stage 'empty' only: what to expect, one line each. */
  expectations: string[]
  /** Stages 'starting' and 'early': every lift of the Program, in Plan order. */
  startingPoints: StartingPoint[]
}

export function leverText(_lever: number, _bodyweight: boolean): string {
  return ''
}

export function topText(_top: { lever: number; reps: number }, _bodyweight: boolean): string {
  return ''
}

export function humanDate(_ms: number): string {
  return ''
}

export function verdictLabel(_kind: VerdictKind): string {
  return ''
}

export function nextStepText(_step: NextStep, _bodyweight: boolean): string {
  return ''
}

export function suggestionText(_step: NextStep, _bodyweight: boolean): string | null {
  return ''
}

export function compareText(_compare: Compare | null, _bodyweight: boolean): string | null {
  return ''
}

export function homeCopy(_program: Program, _sessions: Session[], _resolve: Resolve, _now: number): HomeCopy {
  return {
    stage: 'empty',
    sentence: '',
    counts: '',
    climbed: '',
    adherence: '',
    cards: [],
    expectations: [],
    startingPoints: [],
  }
}
