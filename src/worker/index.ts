import type { JWTVerifyGetKey } from 'jose'
import type { Env } from './env'

export function json(_body: unknown, _status = 200): Response {
  throw new Error('NotImplemented: json')
}

export const apiRoutes: Record<
  string,
  (request: Request, env: Env, email: string) => Promise<Response>
> = {}

export function createHandler(_deps?: { keys?: JWTVerifyGetKey }): {
  fetch(request: Request, env: Env): Promise<Response>
} {
  return {
    async fetch() {
      throw new Error('NotImplemented: createHandler')
    },
  }
}

export default createHandler()
