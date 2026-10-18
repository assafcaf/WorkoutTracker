import type { Session } from '../types'

export type SyncedSession = Session & { updatedAt: number }
export type SyncedSettingKey =
  | 'activeProgramId'
  | 'gymEquipment'
  | 'weightSteps'
  | 'volumeBaseline'
  | 'userPrograms'
  | 'exerciseNotes'
  | 'effortTracking'
  | 'plateInventory'
  | 'bodyweightOverrides'
  | 'weekStart'
  | 'keepScreenOnDuringRest'
  | 'customExercises'
export type SyncedSetting = { key: SyncedSettingKey; value: unknown; updatedAt: number }
export type SyncRequest = { since: number; sessions: SyncedSession[]; settings: SyncedSetting[] }
export type SyncResponse = { cursor: number; sessions: SyncedSession[]; settings: SyncedSetting[] }
export type ReplaceRequest = { sessions: SyncedSession[]; settings: SyncedSetting[] }
export type ReplaceResponse = { cursor: number }

// Stub values: E20-T1 replaces every placeholder below.
export const CONTRACT_VERSION = 0
export const SUPPORTED_VERSIONS: { min: number; max: number } = { min: 0, max: 0 }
export const VERSION_HEADER = ''
export const SYNCED_SETTING_KEYS: readonly SyncedSettingKey[] = []
export const MAX_BODY_BYTES = 0

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export function versionOf(_header: string | null): number | null {
  throw new Error('NotImplementedError')
}
export function isSupportedVersion(_version: number): boolean {
  throw new Error('NotImplementedError')
}
export function checkSyncRequest(_body: unknown): SyncRequest {
  throw new Error('NotImplementedError')
}
export function checkReplaceRequest(_body: unknown): ReplaceRequest {
  throw new Error('NotImplementedError')
}
export function checkSyncResponse(_body: unknown): SyncResponse | null {
  throw new Error('NotImplementedError')
}
export function checkReplaceResponse(_body: unknown): ReplaceResponse | null {
  throw new Error('NotImplementedError')
}
