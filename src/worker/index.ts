import type { JWTVerifyGetKey } from 'jose'
import { requireUser } from './auth'
import type { Env } from './env'
import type { MeResponse } from '../sync/protocol'

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

/** Authenticated API routes, keyed `'<METHOD> <path>'`. */
export const apiRoutes: Record<
  string,
  (request: Request, env: Env, email: string) => Promise<Response>
> = {
  'GET /api/me': async (_request, _env, email) => json({ email } satisfies MeResponse),
  // Access has already signed the user in by the time this runs; send them back to the app.
  'GET /api/login': async () => new Response(null, { status: 302, headers: { Location: '/' } }),
}

export function createHandler(deps: { keys?: JWTVerifyGetKey } = {}): {
  fetch(request: Request, env: Env): Promise<Response>
} {
  return {
    async fetch(request, env) {
      const { pathname } = new URL(request.url)
      if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

      const email = await requireUser(request, env, deps.keys)
      if (email === null) return json({ error: 'unauthenticated' }, 401)

      const route = apiRoutes[`${request.method} ${pathname}`]
      if (!route) return json({ error: 'not found' }, 404)
      return route(request, env, email)
    },
  }
}

export default createHandler()
