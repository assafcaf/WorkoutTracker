import type { Env } from '../env'

// Access has already signed the user in by the time this runs; send them back to the app.
export async function handleLogin(_request: Request, _env: Env, _email: string): Promise<Response> {
  return new Response(null, { status: 302, headers: { Location: '/' } })
}
