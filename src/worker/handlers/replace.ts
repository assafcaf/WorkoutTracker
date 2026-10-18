import { HttpError, checkReplaceRequest, type ReplaceResponse } from '../../contract'
import type { Env } from '../env'
import { json, readJsonBody } from '../http'
import { replaceAll } from '../services/sync'

/** POST /api/replace: make the caller's stored rows exactly the pushed sessions and settings. */
export async function handleReplace(request: Request, env: Env, email: string): Promise<Response> {
  try {
    const { sessions, settings } = checkReplaceRequest(await readJsonBody(request))

    const cursor = await replaceAll(env.DB, email, sessions, settings)
    return json({ cursor } satisfies ReplaceResponse)
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status)
    throw error
  }
}
