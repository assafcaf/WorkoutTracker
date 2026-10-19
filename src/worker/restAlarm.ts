import type { Env } from './env'
import { sendRestOver } from './services/restPush'

const KEY = 'pending'
type Pending = { user: string; title: string; body: string }

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

  async fetch(request: Request): Promise<Response> {
    const { storage } = this.state
    if (request.method === 'DELETE') {
      await storage.deleteAlarm()
      await storage.delete(KEY)
      return Response.json({})
    }
    if (request.method !== 'POST') return new Response(null, { status: 405 })
    const { user, delayMs, title, body } = (await request.json()) as Pending & { delayMs: number }
    await storage.put(KEY, { user, title, body } satisfies Pending)
    await storage.setAlarm(Date.now() + delayMs)
    return Response.json({})
  }

  async alarm(): Promise<void> {
    const { storage } = this.state
    const pending = await storage.get<Pending>(KEY)
    if (!pending) {
      console.log(JSON.stringify({ event: 'push.alarm.empty' }))
      return
    }
    await storage.delete(KEY)
    await sendRestOver(this.env, pending.user, pending)
  }
}
