import type { SetKind } from '../../types'

export type ImportDraftSet = {
  name: string
  weightKg: number | null
  reps: number
  kind?: SetKind
  rir?: number
}

export type ImportDraft = {
  workoutName: string
  startedAt: number
  finishedAt: number
  note?: string
  sets: ImportDraftSet[]
}

export type ParseResult = {
  drafts: ImportDraft[]
  leftOut: number
  unit: 'stated' | 'unstated'
}
