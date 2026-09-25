// @vitest-environment node
import { beforeAll, expect, test } from 'vitest'
import { createHandler } from './index'
import { accessKeys, apiRequest, testEnv, type AccessKeys } from '../test/access'

let access: AccessKeys
let stranger: AccessKeys
let worker: ReturnType<typeof createHandler>

beforeAll(async () => {
  access = await accessKeys()
  stranger = await accessKeys()
  worker = createHandler({ keys: access.keys })
})

async function expectUnauthenticated(response: Response) {
  expect(response.status).toBe(401)
  expect(response.headers.get('content-type')).toMatch(/^application\/json/)
  expect(await response.json()).toEqual({ error: 'unauthenticated' })
}

// --- O1: every /api/* request without a verified Access JWT is 401 and never reaches env.DB ---

test('O1 an /api request with no Cf-Access-Jwt-Assertion header is 401 unauthenticated and reads nothing from env.DB', async () => {
  const requests = [
    apiRequest('/api/me'),
    apiRequest('/api/login'),
    apiRequest('/api/sync', undefined, { method: 'POST', body: '{"since":0,"sessions":[],"settings":[]}' }),
    apiRequest('/api/replace', undefined, { method: 'POST', body: '{"sessions":[],"settings":[]}' }),
    apiRequest('/api/no-such-route'),
  ]
  for (const request of requests) {
    const { env, touched } = testEnv()

    await expectUnauthenticated(await worker.fetch(request, env))
    expect(touched, `${request.method} ${new URL(request.url).pathname}`).toEqual([])
  }
})

test('O1 an /api request whose token signature does not verify against the team certs is 401 and reads nothing from env.DB', async () => {
  const { env, touched } = testEnv()
  const forged = await stranger.sign({ email: 'x@example.com' })

  await expectUnauthenticated(await worker.fetch(apiRequest('/api/me', forged), env))
  expect(touched).toEqual([])
})

test('O1 an /api request whose token aud is not ACCESS_AUD is 401 and reads nothing from env.DB', async () => {
  const { env, touched } = testEnv()
  const token = await access.sign({ aud: 'some-other-access-application' })

  await expectUnauthenticated(await worker.fetch(apiRequest('/api/me', token), env))
  expect(touched).toEqual([])
})

test('O1 an /api request with an expired token is 401 and reads nothing from env.DB', async () => {
  const { env, touched } = testEnv()
  const token = await access.sign({ exp: Math.floor(Date.now() / 1000) - 600 })

  await expectUnauthenticated(await worker.fetch(apiRequest('/api/me', token), env))
  expect(touched).toEqual([])
})

test('O1 a POST /api/sync with a forged token is 401 and reads nothing from env.DB', async () => {
  const { env, touched } = testEnv()
  const forged = await stranger.sign({ email: 'x@example.com' })
  const request = apiRequest('/api/sync', forged, {
    method: 'POST',
    body: '{"since":0,"sessions":[],"settings":[]}',
  })

  await expectUnauthenticated(await worker.fetch(request, env))
  expect(touched).toEqual([])
})

test('O1 an /api request carrying only the Cf-Access-Authenticated-User-Email header is 401', async () => {
  const { env, touched } = testEnv()
  const request = apiRequest('/api/me', undefined, {
    headers: { 'Cf-Access-Authenticated-User-Email': 'x@example.com' },
  })

  await expectUnauthenticated(await worker.fetch(request, env))
  expect(touched).toEqual([])
})

// --- O2: /api/me answers the verified email; dev attribution; fail closed ---

test('O2 GET /api/me with a valid Access JWT answers 200 with the signed-in email', async () => {
  const { env } = testEnv()
  const token = await access.sign({ email: 'x@example.com' })

  const response = await worker.fetch(apiRequest('/api/me', token), env)

  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toMatch(/^application\/json/)
  expect(await response.json()).toEqual({ email: 'x@example.com' })
})

test('O2 GET /api/me answers the email of whoever signed in, not a fixed one', async () => {
  const { env } = testEnv()
  const token = await access.sign({ email: 'trainee@example.org' })

  const response = await worker.fetch(apiRequest('/api/me', token), env)

  expect(await response.json()).toEqual({ email: 'trainee@example.org' })
})

test('O2 GET /api/me is attributed to DEV_USER_EMAIL when ACCESS_AUD and ACCESS_TEAM_DOMAIN are unset', async () => {
  const { env } = testEnv({ DEV_USER_EMAIL: 'dev@example.com' })

  const response = await worker.fetch(apiRequest('/api/me'), env)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ email: 'dev@example.com' })
})

test('O2 with ACCESS_AUD, ACCESS_TEAM_DOMAIN and DEV_USER_EMAIL all unset every /api request is 401', async () => {
  const token = await access.sign({ email: 'x@example.com' })
  const requests = [
    apiRequest('/api/me'),
    apiRequest('/api/me', token),
    apiRequest('/api/login', token),
    apiRequest('/api/sync', token, { method: 'POST', body: '{"since":0,"sessions":[],"settings":[]}' }),
  ]
  for (const request of requests) {
    const { env, touched } = testEnv({})

    await expectUnauthenticated(await worker.fetch(request, env))
    expect(touched).toEqual([])
  }
})

test('O2 the default export fails closed when Access is not configured', async () => {
  const { default: defaultWorker } = await import('./index')
  const { env } = testEnv({})

  await expectUnauthenticated(await defaultWorker.fetch(apiRequest('/api/me'), env))
})

// --- O3: everything outside /api/ is the static assets; /api/login redirects home ---

test('O3 a path outside /api/ returns env.ASSETS.fetch(request) response unchanged', async () => {
  const paths = ['/', '/index.html', '/assets/index-3f9a1c.js', '/manifest.webmanifest', '/apiary', '/history']
  for (const path of paths) {
    const { env, asset, assetRequests } = testEnv()
    const request = new Request(`https://workout.example.com${path}`)

    const response = await worker.fetch(request, env)

    expect(response, path).toBe(asset)
    expect(assetRequests, path).toHaveLength(1)
    expect(assetRequests[0], path).toBe(request)
  }
})

test('O3 a path outside /api/ is served without a token and reads nothing from env.DB', async () => {
  const { env, asset, touched } = testEnv()

  const response = await worker.fetch(new Request('https://workout.example.com/index.html'), env)

  expect(response).toBe(asset)
  expect(touched).toEqual([])
})

test('O3 a non-GET request outside /api/ is also passed to env.ASSETS unchanged', async () => {
  const { env, asset, assetRequests } = testEnv()
  const request = new Request('https://workout.example.com/some/form', { method: 'POST', body: 'a=1' })

  const response = await worker.fetch(request, env)

  expect(response).toBe(asset)
  expect(assetRequests[0]).toBe(request)
})

test('O3 an /api request is never passed to env.ASSETS', async () => {
  const { env, assetRequests } = testEnv()
  const token = await access.sign()

  await worker.fetch(apiRequest('/api/me'), env)
  await worker.fetch(apiRequest('/api/me', token), env)
  await worker.fetch(apiRequest('/api/no-such-route', token), env)

  expect(assetRequests).toEqual([])
})

test('O3 GET /api/login for an authenticated user answers 302 with Location /', async () => {
  const { env } = testEnv()
  const token = await access.sign({ email: 'x@example.com' })

  const response = await worker.fetch(apiRequest('/api/login', token), env)

  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('/')
})

test('O3 an unknown /api route for an authenticated user is 404 not found', async () => {
  const { env } = testEnv()
  const token = await access.sign()

  const response = await worker.fetch(apiRequest('/api/no-such-route', token), env)

  expect(response.status).toBe(404)
  expect(await response.json()).toEqual({ error: 'not found' })
})

test('O3 a known /api path with the wrong method is 404 not found', async () => {
  const { env } = testEnv()
  const token = await access.sign()

  const response = await worker.fetch(apiRequest('/api/me', token, { method: 'DELETE' }), env)

  expect(response.status).toBe(404)
  expect(await response.json()).toEqual({ error: 'not found' })
})
