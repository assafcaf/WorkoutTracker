import { HttpError, MAX_BODY_BYTES } from '../contract'

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

/** The parsed JSON body; HttpError(413) over MAX_BODY_BYTES, HttpError(400) when not JSON. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const tooLarge = () => new HttpError(413, `body exceeds ${MAX_BODY_BYTES} bytes`)
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) throw tooLarge()
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > MAX_BODY_BYTES) throw tooLarge()
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new HttpError(400, 'body is not valid JSON')
  }
}
