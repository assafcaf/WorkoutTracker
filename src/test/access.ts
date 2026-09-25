// Test utilities for the Worker: a local stand-in for Cloudflare Access's signing keys, and
// Env doubles that record what the Worker touched. Nothing here reaches the network.
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from 'jose'
import type { D1Database } from '../worker/d1'
import type { Env } from '../worker/env'

export const TEAM_DOMAIN = 'myteam.cloudflareaccess.com'
export const AUD = '4f2c9a1b7e3d4c5a8b6e0f1d2c3b4a59'

export type Claims = {
  email?: string
  aud?: string
  iss?: string
  /** Seconds since the epoch. Defaults to an hour from now. */
  exp?: number
}

export type AccessKeys = {
  /** The key set the Worker is handed in place of the team's remote certs. */
  keys: JWTVerifyGetKey
  sign(claims?: Claims): Promise<string>
}

/** A key pair published as a one-key JWKS, the shape `/cdn-cgi/access/certs` serves. */
export async function accessKeys(kid = 'access-key-1'): Promise<AccessKeys> {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey)
  const keys = createLocalJWKSet({ keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] })
  const now = Math.floor(Date.now() / 1000)
  return {
    keys,
    sign(claims: Claims = {}) {
      const payload: Record<string, unknown> = {}
      if (!('email' in claims)) payload.email = 'x@example.com'
      else if (claims.email !== undefined) payload.email = claims.email
      return new SignJWT(payload)
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuedAt(now - 60)
        .setIssuer(claims.iss ?? `https://${TEAM_DOMAIN}`)
        .setAudience(claims.aud ?? AUD)
        .setExpirationTime(claims.exp ?? now + 3600)
        .setSubject('7f3a0c52-5b1e-4d7a-9c1f-2e8b6d4a0c93')
        .sign(privateKey)
    },
  }
}

/** An env.DB that records every property the Worker reads from it. */
export function recordingDb(): { db: D1Database; touched: string[] } {
  const touched: string[] = []
  const db = new Proxy(
    {},
    {
      get(_target, property) {
        touched.push(String(property))
        return undefined
      },
    },
  ) as unknown as D1Database
  return { db, touched }
}

/** An env.ASSETS that answers every request with the same Response and records the requests. */
export function recordingAssets(response: Response): {
  assets: Env['ASSETS']
  requests: Request[]
} {
  const requests: Request[] = []
  return {
    assets: {
      async fetch(request: Request) {
        requests.push(request)
        return response
      },
    },
    requests,
  }
}

export type TestEnv = { env: Env; touched: string[]; assetRequests: Request[]; asset: Response }

export function testEnv(vars: Partial<Pick<Env, 'ACCESS_AUD' | 'ACCESS_TEAM_DOMAIN' | 'DEV_USER_EMAIL'>> = {
  ACCESS_AUD: AUD,
  ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
}): TestEnv {
  const { db, touched } = recordingDb()
  const asset = new Response('<!doctype html><title>asset</title>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-asset': 'from-assets' },
  })
  const { assets, requests } = recordingAssets(asset)
  return { env: { DB: db, ASSETS: assets, ...vars }, touched, assetRequests: requests, asset }
}

export function apiRequest(path: string, token?: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers)
  if (token !== undefined) headers.set('Cf-Access-Jwt-Assertion', token)
  return new Request(`https://workout.example.com${path}`, { ...init, headers })
}
