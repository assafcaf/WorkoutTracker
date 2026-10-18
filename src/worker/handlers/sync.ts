import { HttpError, checkSyncRequest, type SyncResponse } from '../../contract'
import type { Env } from '../env'
import { json, readJsonBody } from '../http'
import { changesSince, storeNewer } from '../services/sync'

/** POST /api/sync: store the caller's newer rows, answer every row of theirs past `since`. */
export async function handleSync(request: Request, env: Env, email: string): Promise<Response> {
  try {
    const { since, sessions, settings } = checkSyncRequest(await readJsonBody(request))

    await storeNewer(env.DB, email, sessions, settings)
    return json((await changesSince(env.DB, email, since)) satisfies SyncResponse)
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status)
    throw error
  }
}
