import type { Env } from './env'
import { handleLogin } from './handlers/login'
import { handleMe } from './handlers/me'
import { handleReplace } from './handlers/replace'
import { handleSync } from './handlers/sync'

/** Authenticated API routes, keyed `'<METHOD> <path>'`. */
export const apiRoutes: Record<string, (request: Request, env: Env, email: string) => Promise<Response>> = {
  'GET /api/login': handleLogin,
  'GET /api/me': handleMe,
  'POST /api/replace': handleReplace,
  'POST /api/sync': handleSync,
}
