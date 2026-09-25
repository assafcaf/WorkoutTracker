import type { D1Database } from './d1'
import type { Env } from './env'
import type { SyncedSession, SyncedSetting } from '../sync/protocol'

/** A failure the caller should see as this HTTP status, with the message as its `error`. */
export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/** POST /api/sync: store the caller's newer rows, answer every row of theirs past `since`. */
export async function handleSync(_request: Request, _env: Env, _email: string): Promise<Response> {
  throw new Error('not implemented')
}

/** The parsed JSON body; HttpError(413) over MAX_BODY_BYTES, HttpError(400) when not JSON. */
export async function readJsonBody(_request: Request): Promise<unknown> {
  throw new Error('not implemented')
}

/** `value` as synced sessions; HttpError(400) unless every one has a string id and numeric updatedAt. */
export function parseSessions(_value: unknown): SyncedSession[] {
  throw new Error('not implemented')
}

/** `value` as synced settings; HttpError(400) for a key outside SYNCED_SETTING_KEYS. */
export function parseSettings(_value: unknown): SyncedSetting[] {
  throw new Error('not implemented')
}

/** Reserves `count` consecutive seqs for `email` and returns the first of them. */
export async function nextSeq(_db: D1Database, _email: string, _count: number): Promise<number> {
  throw new Error('not implemented')
}
