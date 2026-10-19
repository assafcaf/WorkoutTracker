import type { D1Database } from './d1'

/** The Durable Object namespace binding, as far as the Worker uses it. */
export type RestAlarmNamespace = {
  idFromName(name: string): { toString(): string }
  get(id: { toString(): string }): { fetch(request: Request): Promise<Response> }
}

export type Env = {
  DB: D1Database
  ASSETS: { fetch(request: Request): Promise<Response> }
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  DEV_USER_EMAIL?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
  REST_ALARM?: RestAlarmNamespace
}
