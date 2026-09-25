import type { JWTVerifyGetKey } from 'jose'
import type { Env } from './env'

export async function requireUser(
  _request: Request,
  _env: Env,
  _keys?: JWTVerifyGetKey,
): Promise<string | null> {
  throw new Error('NotImplemented: requireUser')
}
