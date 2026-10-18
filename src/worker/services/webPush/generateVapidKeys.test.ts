// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { vapidHeaders, vapidPublicKey, type VapidJwk } from './vapid'

const SCRIPT = join(process.cwd(), 'scripts', 'generate-vapid-keys.mjs')

function run(): { out: string; jwk: VapidJwk } {
  const out = execFileSync(process.execPath, [SCRIPT], { encoding: 'utf8', timeout: 30000 })
  const m = /\{[\s\S]*?\}/.exec(out)
  expect(m, 'stdout holds a JSON object').not.toBeNull()
  return { out, jwk: JSON.parse(m![0]) as VapidJwk }
}

describe('O8: scripts/generate-vapid-keys.mjs', () => {
  test('prints a P-256 private JWK and the public key derived from it', () => {
    const { out, jwk } = run()
    expect(jwk.kty).toBe('EC')
    expect(jwk.crv).toBe('P-256')
    for (const part of [jwk.x, jwk.y, jwk.d]) expect(part).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(out).toContain(vapidPublicKey(jwk))
  })

  test('the printed JWK is accepted by vapidHeaders', async () => {
    const { jwk } = run()
    const h = await vapidHeaders('https://push.example/x', jwk, 'mailto:a@b.co', Date.now())
    expect(h.Authorization).toContain(`k=${vapidPublicKey(jwk)}`)
  })

  test('each run prints a different key', () => {
    expect(run().jwk.d).not.toBe(run().jwk.d)
  })
})
