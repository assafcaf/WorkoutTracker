import { HttpError, checkRestPushRequest } from '../../contract'
import type { Env } from '../env'
import { json, readJsonBody } from '../http'
import { cancelRest, scheduleRest } from '../services/restPush'

export async function handleScheduleRest(request: Request, env: Env, email: string): Promise<Response> {
  try {
    await scheduleRest(env, email, checkRestPushRequest(await readJsonBody(request)))
    return json({})
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status)
    throw error
  }
}

export async function handleCancelRest(_request: Request, env: Env, email: string): Promise<Response> {
  await cancelRest(env, email)
  return json({})
}
