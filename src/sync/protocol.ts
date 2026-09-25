import type { Session } from '../types'
export type SyncedSession = Session & { updatedAt: number }
export type SyncedSettingKey =
  | 'activeProgramId'
  | 'gymEquipment'
  | 'weightSteps'
  | 'volumeBaseline'
  | 'userPrograms'
export const SYNCED_SETTING_KEYS: readonly SyncedSettingKey[] = [
  'activeProgramId',
  'gymEquipment',
  'weightSteps',
  'volumeBaseline',
]
export type SyncedSetting = { key: SyncedSettingKey; value: unknown; updatedAt: number }
export type SyncRequest = { since: number; sessions: SyncedSession[]; settings: SyncedSetting[] }
export type SyncResponse = { cursor: number; sessions: SyncedSession[]; settings: SyncedSetting[] }
export type ReplaceRequest = { sessions: SyncedSession[]; settings: SyncedSetting[] }
export type ReplaceResponse = { cursor: number }
export type MeResponse = { email: string }
export const MAX_BODY_BYTES = 2 * 1024 * 1024
