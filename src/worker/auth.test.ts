// @vitest-environment node
import { beforeAll, expect, test } from 'vitest'
import { requireUser } from './auth'
import { AUD, TEAM_DOMAIN, accessKeys, apiRequest, testEnv, type AccessKeys } from '../test/access'

let access: AccessKeys
let stranger: AccessKeys

beforeAll(async () => {
  access = await accessKeys()
  // Same kid, different key: a token a forger signed, presented as if from the team.
  stranger = await accessKeys()
})

test('O2 requireUser returns the email claim of a valid Access JWT', async () => {
  const { env } = testEnv()
  const token = await access.sign({ email: 'x@example.com' })

  expect(await requireUser(apiRequest('/api/me', token), env, access.keys)).toBe('x@example.com')
})

test('O1 requireUser returns null when the request carries no Cf-Access-Jwt-Assertion header', async () => {
  const { env } = testEnv()

  expect(await requireUser(apiRequest('/api/me'), env, access.keys)).toBeNull()
})

test('O1 requireUser returns null for a token whose signature does not verify against the team certs', async () => {
  const { env } = testEnv()
  const forged = await stranger.sign({ email: 'x@example.com' })

  expect(await requireUser(apiRequest('/api/me', forged), env, access.keys)).toBeNull()
})

test('O1 requireUser returns null for a token whose aud is not ACCESS_AUD', async () => {
  const { env } = testEnv()
  const token = await access.sign({ aud: 'some-other-access-application' })

  expect(await requireUser(apiRequest('/api/me', token), env, access.keys)).toBeNull()
})

test('O1 requireUser returns null for an expired token', async () => {
  const { env } = testEnv()
  const token = await access.sign({ exp: Math.floor(Date.now() / 1000) - 600 })

  expect(await requireUser(apiRequest('/api/me', token), env, access.keys)).toBeNull()
})

test('O1 requireUser returns null for a token issued by a different team domain', async () => {
  const { env } = testEnv()
  const token = await access.sign({ iss: 'https://otherteam.cloudflareaccess.com' })

  expect(await requireUser(apiRequest('/api/me', token), env, access.keys)).toBeNull()
})

test('O1 requireUser returns null for a malformed token', async () => {
  const { env } = testEnv()

  expect(await requireUser(apiRequest('/api/me', 'not.a.jwt'), env, access.keys)).toBeNull()
})

test('O1 requireUser returns null for a verified token that carries no email claim', async () => {
  const { env } = testEnv()
  const token = await access.sign({ email: undefined })

  expect(await requireUser(apiRequest('/api/me', token), env, access.keys)).toBeNull()
})

test('O1 requireUser does not trust the plain Cf-Access-Authenticated-User-Email header', async () => {
  const { env } = testEnv()
  const request = apiRequest('/api/me', undefined, {
    headers: { 'Cf-Access-Authenticated-User-Email': 'x@example.com' },
  })

  expect(await requireUser(request, env, access.keys)).toBeNull()
})

test('O2 requireUser attributes a request to DEV_USER_EMAIL when ACCESS_AUD and ACCESS_TEAM_DOMAIN are unset', async () => {
  const { env } = testEnv({ DEV_USER_EMAIL: 'dev@example.com' })

  expect(await requireUser(apiRequest('/api/me'), env, access.keys)).toBe('dev@example.com')
})

test('O2 requireUser fails closed when ACCESS_AUD, ACCESS_TEAM_DOMAIN and DEV_USER_EMAIL are all unset', async () => {
  const { env } = testEnv({})
  // A token that would verify, were the Worker configured to accept it.
  const token = await access.sign()

  expect(await requireUser(apiRequest('/api/me', token), env, access.keys)).toBeNull()
})

test('O2 requireUser ignores DEV_USER_EMAIL when Access is configured', async () => {
  const { env } = testEnv({
    ACCESS_AUD: AUD,
    ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
    DEV_USER_EMAIL: 'dev@example.com',
  })

  expect(await requireUser(apiRequest('/api/me'), env, access.keys)).toBeNull()
})
