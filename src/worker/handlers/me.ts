import type { Env } from '../env'

export async function handleMe(_request: Request, _env: Env, _email: string): Promise<Response> {
  throw new Error('NotImplementedError')
}
