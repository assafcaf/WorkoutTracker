import type { ChangeTopic, Services } from '../services'

export type ServiceData<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'ready'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: unknown }

/**
 * Reads `read(services)` on mount and again whenever one of `topics` fires on the bus.
 *
 * STUB (E11-T9 test-designer): not implemented yet.
 */
export function useServiceData<T>(
  _read: (s: Services) => Promise<T>,
  _topics: ChangeTopic[],
): ServiceData<T> {
  throw new Error('not implemented: useServiceData')
}
