import type { Env } from '../env'
import { json } from '../http'

const notImplemented = () => json({ error: 'not implemented' }, 501)

export async function handlePushKey(_request: Request, _env: Env, _email: string): Promise<Response> {
  return notImplemented()
}

export async function handleSubscribe(_request: Request, _env: Env, _email: string): Promise<Response> {
  return notImplemented()
}

export async function handleUnsubscribe(_request: Request, _env: Env, _email: string): Promise<Response> {
  return notImplemented()
}
