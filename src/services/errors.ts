export type ServiceErrorCode =
  | 'not-found'
  | 'invalid-backup'
  | 'in-progress'
  | 'storage-unavailable'
  | 'storage-failed'

export class ServiceError extends Error {
  readonly code: ServiceErrorCode

  constructor(code: ServiceErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'ServiceError'
  }
}

export async function callStorage<T>(
  deps: { storageAvailable: boolean },
  op: () => Promise<T>,
  message: string,
): Promise<T> {
  if (!deps.storageAvailable) {
    throw new ServiceError('storage-unavailable', message)
  }

  try {
    return await op()
  } catch (err) {
    if (err instanceof ServiceError) {
      throw err
    }
    throw new ServiceError('storage-failed', message)
  }
}
