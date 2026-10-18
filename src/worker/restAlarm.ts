import type { Env } from './env'

/** The slice of Durable Object storage RestAlarm uses (SQLite-backed, alarm included). */
export type RestAlarmStorage = {
  get<T = unknown>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<boolean>
  setAlarm(scheduledTimeMs: number): Promise<void>
  getAlarm(): Promise<number | null>
  deleteAlarm(): Promise<void>
}

export type RestAlarmState = { storage: RestAlarmStorage }

/** One per user (idFromName(email)): holds the pending "Rest over" message and its alarm. */
export class RestAlarm {
  constructor(
    readonly state: RestAlarmState,
    readonly env: Env,
  ) {}

  async fetch(_request: Request): Promise<Response> {
    return new Response(null, { status: 501 })
  }

  async alarm(): Promise<void> {
    // NotImplemented: sends the stored message through pushToUser, then clears it.
  }
}
