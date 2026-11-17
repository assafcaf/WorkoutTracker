import type { ServiceDeps } from './deps'
import { callStorage } from './errors'
import type { ImageIo } from '../storage/photoImage'
import { add, list, remove, restore, type NewPhoto, type Photo } from '../storage/photoStore'

export type PhotoService = {
  /** Every photo, newest day first. */
  list(): Promise<Photo[]>
  /** Re-encodes and stores a photo; announces the change. */
  add(input: NewPhoto): Promise<Photo>
  remove(id: string): Promise<void>
  /** Puts a removed photo back exactly as it was (the Undo of a delete). */
  restore(photo: Photo): Promise<void>
}

/**
 * Builds the `PhotoService` over `src/storage/photoStore.ts` through `callStorage`. Each write
 * notifies the `'preferences'` topic once it lands (there is no photos topic). `imageIo` is the
 * re-encoding seam, for tests.
 */
export function createPhotoService(deps: ServiceDeps, imageIo?: ImageIo): PhotoService {
  const write = async <T>(op: () => Promise<T>, message: string): Promise<T> => {
    const result = await callStorage(deps, op, message)
    deps.bus.emit('preferences')
    return result
  }
  return {
    list: () => callStorage(deps, list, 'photo read failed'),
    add: (input) => write(() => add(input, imageIo), 'photo write failed'),
    remove: (id) => write(() => remove(id), 'photo write failed'),
    restore: (photo) => write(() => restore(photo), 'photo write failed'),
  }
}
