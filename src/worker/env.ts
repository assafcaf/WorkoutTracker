import type { D1Database } from './d1'

export type Env = {
  DB: D1Database
  ASSETS: { fetch(request: Request): Promise<Response> }
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  DEV_USER_EMAIL?: string
}
