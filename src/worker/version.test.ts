// @vitest-environment node
import { beforeAll, describe, expect, test } from 'vitest'
import { VERSION_HEADER } from '../contract'
import { versionGate } from './version'
import { createHandler } from './index'
import { accessKeys, apiRequest, testEnv, type AccessKeys } from '../test/access'

let access: AccessKeys
let worker: ReturnType<typeof createHandler>

beforeAll(async () => {
  access = await accessKeys()
  worker = createHandler({ keys: access.keys })
})

function withVersion(version: string | null): Record<string, string> {
  return version === null ? {} : { [VERSION_HEADER]: version }
}

describe('O9: the version gate on an authenticated /api request', () => {
  test('O9 no header is served as v1: GET /api/me answers 200 with the email', async () => {
    const { env } = testEnv()
    const token = await access.sign({ email: 'x@example.com' })
    const response = await worker.fetch(apiRequest('/api/me', token), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ email: 'x@example.com' })
  })

  test.each(['1', '2'])('O9 version %s is served as today: GET /api/me answers 200', async (version) => {
    const { env } = testEnv()
    const token = await access.sign({ email: 'x@example.com' })
    const response = await worker.fetch(apiRequest('/api/me', token, { headers: withVersion(version) }), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ email: 'x@example.com' })
  })

  test.each(['3', '0', 'abc'])(
    'O9 version %s is answered 426 with the supported range and env.DB is untouched',
    async (version) => {
      const { env, touched } = testEnv()
      const token = await access.sign()
      const requests = [
        apiRequest('/api/me', token, { headers: withVersion(version) }),
        apiRequest('/api/sync', token, {
          method: 'POST',
          headers: withVersion(version),
          body: '{"since":0,"sessions":[],"settings":[]}',
        }),
        apiRequest('/api/replace', token, {
          method: 'POST',
          headers: withVersion(version),
          body: '{"sessions":[],"settings":[]}',
        }),
      ]
      for (const request of requests) {
        const response = await worker.fetch(request, env)
        expect(response.status, new URL(request.url).pathname).toBe(426)
        expect(response.headers.get('content-type')).toMatch(/^application\/json/)
        expect(await response.json()).toEqual({ error: 'update required', supported: { min: 1, max: 2 } })
      }
      expect(touched).toEqual([])
    },
  )

  test('O9 GET /api/login with no header still answers 302 to /', async () => {
    const { env } = testEnv()
    const token = await access.sign()
    const response = await worker.fetch(apiRequest('/api/login', token), env)
    expect(response.status).toBe(302)
    expect(new URL(response.headers.get('location') ?? '', 'https://workout.example.com').pathname).toBe('/')
  })

  test('O9 versionGate lets a request with no header or 2 through and answers 426 for 3', async () => {
    expect(versionGate(apiRequest('/api/me'))).toBeNull()
    expect(versionGate(apiRequest('/api/me', undefined, { headers: withVersion('2') }))).toBeNull()
    const refused = versionGate(apiRequest('/api/me', undefined, { headers: withVersion('3') }))
    expect(refused?.status).toBe(426)
  })
})

describe('O10: authentication and assets come before the gate', () => {
  test.each(['3', '0', 'abc', '2'])('O10 with version %s and no token, /api/me is 401', async (version) => {
    const { env, touched } = testEnv()
    const response = await worker.fetch(apiRequest('/api/me', undefined, { headers: withVersion(version) }), env)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'unauthenticated' })
    expect(touched).toEqual([])
  })

  test('O10 an unverifiable token with version 3 is 401, not 426', async () => {
    const { env } = testEnv()
    const stranger = await accessKeys()
    const forged = await stranger.sign()
    const response = await worker.fetch(apiRequest('/api/me', forged, { headers: withVersion('3') }), env)
    expect(response.status).toBe(401)
  })

  test.each(['3', 'abc', '1'])('O10 a path outside /api/ is served by env.ASSETS with version %s', async (version) => {
    const { env, assetRequests, asset } = testEnv()
    const response = await worker.fetch(apiRequest('/index.html', undefined, { headers: withVersion(version) }), env)
    expect(response).toBe(asset)
    expect(assetRequests).toHaveLength(1)
  })
})
