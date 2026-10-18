import type { Env } from './env'
import { handleLogin } from './handlers/login'
import { handleMe } from './handlers/me'
import { handlePushKey, handleSubscribe, handleUnsubscribe } from './handlers/push'
import { handleReplace } from './handlers/replace'
import { handleSync } from './handlers/sync'

/** Authenticated API routes, keyed `'<METHOD> <path>'`. */
export const apiRoutes: Record<string, (request: Request, env: Env, email: string) => Promise<Response>> = {
  'GET /api/login': handleLogin,
  'DELETE /api/push/subscription': handleUnsubscribe,
  'GET /api/me': handleMe,
  'GET /api/push/key': handlePushKey,
  'POST /api/push/subscription': handleSubscribe,
  'POST /api/replace': handleReplace,
  'POST /api/sync': handleSync,
}
