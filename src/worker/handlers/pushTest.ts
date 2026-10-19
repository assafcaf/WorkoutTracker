import type { Env } from '../env'
import { json } from '../http'
import { sendTestPush } from '../services/push'

/** Sends a test notification at once to every subscription of the user and answers per device. */
export async function handlePushTest(_request: Request, env: Env, email: string): Promise<Response> {
  const answer = await sendTestPush(env, email)
  return answer ? json(answer) : json({ error: 'push not configured' }, 503)
}
