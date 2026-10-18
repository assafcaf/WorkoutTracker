import type { JWTVerifyGetKey } from 'jose'
import { requireUser } from './auth'
import type { Env } from './env'
import { json } from './http'
import { apiRoutes } from './routes'
import { versionGate } from './version'

export function createHandler(deps: { keys?: JWTVerifyGetKey } = {}): {
  fetch(request: Request, env: Env): Promise<Response>
} {
  return {
    async fetch(request, env) {
      const { pathname } = new URL(request.url)
      if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

      const email = await requireUser(request, env, deps.keys)
      if (email === null) return json({ error: 'unauthenticated' }, 401)

      const stale = versionGate(request)
      if (stale) return stale

      const route = apiRoutes[`${request.method} ${pathname}`]
      if (!route) return json({ error: 'not found' }, 404)
      return route(request, env, email)
    },
  }
}

export default createHandler()
export { RestAlarm } from './restAlarm'
