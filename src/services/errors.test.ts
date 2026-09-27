import { expect, test } from 'vitest'
import { callStorage, ServiceError } from './errors'

// O6: callStorage(deps, op, message) rejects, unwraps and passes through per errors.ts's contract.

test('O6 callStorage rejects with storage-unavailable and does not run op when deps.storageAvailable is false', async () => {
  let ran = false
  const op = async () => {
    ran = true
    return 'value'
  }

  await expect(callStorage({ storageAvailable: false }, op, 'could not save session')).rejects.toMatchObject({
    code: 'storage-unavailable',
  })
  expect(ran).toBe(false)
})

test('O6 callStorage rejects with storage-failed and the given message when op rejects with a plain error', async () => {
  const op = async (): Promise<never> => {
    throw new Error('disk full')
  }

  const rejection = callStorage({ storageAvailable: true }, op, 'could not save session')
  await expect(rejection).rejects.toBeInstanceOf(ServiceError)
  await expect(rejection).rejects.toMatchObject({
    code: 'storage-failed',
    message: 'could not save session',
  })
})

test('O6 callStorage passes a ServiceError from op through unchanged', async () => {
  const original = new ServiceError('not-found', 'session 42 is gone')
  const op = async (): Promise<never> => {
    throw original
  }

  const rejection = callStorage({ storageAvailable: true }, op, 'could not save session')
  await expect(rejection).rejects.toBe(original)
})

test('O6 callStorage resolves with op result when deps.storageAvailable is true', async () => {
  const op = async () => 'session-saved'

  await expect(callStorage({ storageAvailable: true }, op, 'could not save session')).resolves.toBe(
    'session-saved',
  )
})
