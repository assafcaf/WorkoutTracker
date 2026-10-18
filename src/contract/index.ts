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
  | 'deloadWeek'
  | 'keepScreenOnDuringRest'
  | 'customExercises'
  | 'bodyLog'
  | 'workoutReminders'
export type SyncedSetting = { key: SyncedSettingKey; value: unknown; updatedAt: number }
export type SyncRequest = { since: number; sessions: SyncedSession[]; settings: SyncedSetting[] }
export type SyncResponse = { cursor: number; sessions: SyncedSession[]; settings: SyncedSetting[] }
export type ReplaceRequest = { sessions: SyncedSession[]; settings: SyncedSetting[] }
export type ReplaceResponse = { cursor: number }

/** The wire contract's version: bump it when a request or answer changes shape. */
export const CONTRACT_VERSION = 2
/** The versions the Worker serves. */
export const SUPPORTED_VERSIONS: { min: number; max: number } = { min: 1, max: 2 }
/** The request header that carries the sender's contract version. */
export const VERSION_HEADER = 'X-Contract-Version'
export const SYNCED_SETTING_KEYS: readonly SyncedSettingKey[] = [
  'activeProgramId',
  'gymEquipment',
  'weightSteps',
  'volumeBaseline',
  'userPrograms',
  'exerciseNotes',
  'effortTracking',
  'plateInventory',
  'bodyweightOverrides',
  'weekStart',
  'deloadWeek',
  'keepScreenOnDuringRest',
  'customExercises',
  'bodyLog',
  'workoutReminders',
]
export const MAX_BODY_BYTES = 2 * 1024 * 1024

/** A failure the caller should see as this HTTP status, with the message as its `error`. */
export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/** The version a header names: a missing header is 1, a plain decimal integer itself, else null. */
export function versionOf(header: string | null): number | null {
  if (header === null) return 1
  return /^\d+$/.test(header) ? Number(header) : null
}

export function isSupportedVersion(version: number): boolean {
  return Number.isInteger(version) && version >= SUPPORTED_VERSIONS.min && version <= SUPPORTED_VERSIONS.max
}

export function checkSyncRequest(body: unknown): SyncRequest {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a JSON object')
  if (!isFiniteNumber(body.since)) throw new HttpError(400, 'since must be a number')
  return { ...body, since: body.since, sessions: requestSessions(body.sessions), settings: requestSettings(body.settings) }
}

export function checkReplaceRequest(body: unknown): ReplaceRequest {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a JSON object')
  return { sessions: requestSessions(body.sessions), settings: requestSettings(body.settings) }
}

export function checkSyncResponse(body: unknown): SyncResponse | null {
  if (!isRecord(body) || !isFiniteNumber(body.cursor)) return null
  if (!Array.isArray(body.sessions) || !body.sessions.every((s) => isRecord(s) && typeof s.id === 'string')) return null
  if (!Array.isArray(body.settings) || !body.settings.every(isSetting)) return null
  return body as SyncResponse
}

export function checkReplaceResponse(body: unknown): ReplaceResponse | null {
  if (!isRecord(body) || !isFiniteNumber(body.cursor)) return null
  return body as ReplaceResponse
}

function requestSessions(value: unknown): SyncedSession[] {
  if (!Array.isArray(value)) throw new HttpError(400, 'sessions must be an array')
  for (const session of value) {
    if (!isRecord(session) || typeof session.id !== 'string' || !isFiniteNumber(session.updatedAt)) {
      throw new HttpError(400, 'every session needs a string id and a numeric updatedAt')
    }
    requireField(session, 'programId', typeof session.programId === 'string')
    requireField(session, 'workoutId', typeof session.workoutId === 'string')
    requireField(session, 'startedAt', isFiniteNumber(session.startedAt))
    requireField(session, 'finishedAt', session.finishedAt === null || isFiniteNumber(session.finishedAt))
    requireField(session, 'entries', Array.isArray(session.entries))
    for (const entry of session.entries as unknown[]) {
      if (!isRecord(entry)) throw new HttpError(400, `session ${session.id}: every entry in entries must be an object`)
      requireField(session, 'entries.exerciseId', typeof entry.exerciseId === 'string')
      requireField(session, 'entries.reps', isFiniteNumber(entry.reps))
      requireField(session, 'entries.loggedAt', isFiniteNumber(entry.loggedAt))
    }
  }
  return value as SyncedSession[]
}

function requireField(session: Record<string, unknown>, field: string, ok: boolean): void {
  if (!ok) throw new HttpError(400, `session ${String(session.id)}: ${field} is missing or the wrong type`)
}

function requestSettings(value: unknown): SyncedSetting[] {
  if (!Array.isArray(value)) throw new HttpError(400, 'settings must be an array')
  for (const setting of value) {
    if (!isSetting(setting)) {
      throw new HttpError(400, `every setting needs a key in ${SYNCED_SETTING_KEYS.join(', ')}, a value and a numeric updatedAt`)
    }
  }
  return value as SyncedSetting[]
}

function isSetting(value: unknown): boolean {
  return (
    isRecord(value) &&
    (SYNCED_SETTING_KEYS as readonly unknown[]).includes(value.key) &&
    'value' in value &&
    isFiniteNumber(value.updatedAt)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
export * from './push'
