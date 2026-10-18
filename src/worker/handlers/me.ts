import type { MeResponse } from '../../sync/protocol'
import type { Env } from '../env'
import { json } from '../http'

export async function handleMe(_request: Request, _env: Env, email: string): Promise<Response> {
  return json({ email } satisfies MeResponse)
}
