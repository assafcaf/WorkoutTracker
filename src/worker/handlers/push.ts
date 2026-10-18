import { HttpError, checkSubscriptionRequest, checkUnsubscribeRequest, type PushKeyResponse } from '../../contract'
import type { Env } from '../env'
import { json, readJsonBody } from '../http'
import { publicKeyOf, subscribe, unsubscribe } from '../services/push'

export async function handlePushKey(_request: Request, env: Env, _email: string): Promise<Response> {
  const publicKey = publicKeyOf(env)
  if (!publicKey) return json({ error: 'push not configured' }, 503)
  return json({ publicKey } satisfies PushKeyResponse)
}

export async function handleSubscribe(request: Request, env: Env, email: string): Promise<Response> {
  try {
    await subscribe(env.DB, email, checkSubscriptionRequest(await readJsonBody(request)))
    return json({})
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status)
    throw error
  }
}

export async function handleUnsubscribe(request: Request, env: Env, email: string): Promise<Response> {
  try {
    await unsubscribe(env.DB, email, checkUnsubscribeRequest(await readJsonBody(request)).endpoint)
    return json({})
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status)
    throw error
  }
}
