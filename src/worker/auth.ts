import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { Env } from './env'

// One remote key set per team domain, so jose's own cache of the certs survives across requests.
const remoteKeys = new Map<string, JWTVerifyGetKey>()

function teamKeys(teamDomain: string): JWTVerifyGetKey {
  let keys = remoteKeys.get(teamDomain)
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`))
    remoteKeys.set(teamDomain, keys)
  }
  return keys
}

/**
 * The verified email of the Access user behind this request, or null. Only the signed
 * `Cf-Access-Jwt-Assertion` is trusted, never the plain email header. With Access unconfigured
 * the request is attributed to DEV_USER_EMAIL if set, and otherwise refused (fail closed).
 */
export async function requireUser(
  request: Request,
  env: Env,
  keys?: JWTVerifyGetKey,
): Promise<string | null> {
  const { ACCESS_AUD: audience, ACCESS_TEAM_DOMAIN: teamDomain } = env
  if (!audience && !teamDomain) return env.DEV_USER_EMAIL || null
  if (!audience || !teamDomain) return null

  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, keys ?? teamKeys(teamDomain), {
      audience,
      issuer: `https://${teamDomain}`,
    })
    return typeof payload.email === 'string' && payload.email !== '' ? payload.email : null
  } catch {
    return null
  }
}
