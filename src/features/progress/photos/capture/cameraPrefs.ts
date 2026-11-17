/**
 * Device-local camera choices (photos v2): which camera each view uses, and the deviceId that
 * opened the plain back camera. localStorage, never synced: they describe this phone.
 */
import type { PhotoAngle, PhotoCamera } from '../../../../storage/photoStore'

const facingKey = (view: PhotoAngle): string => `photoCamera.${view}`
const deviceKey = (facing: PhotoCamera): string => `photoCameraDevice.${facing}`

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode or storage full: the choice lasts this session only.
  }
}

/** The camera last used for `view`; the front camera when never chosen. */
export function savedFacing(view: PhotoAngle): PhotoCamera {
  return read(facingKey(view)) === 'environment' ? 'environment' : 'user'
}

export function saveFacing(view: PhotoAngle, facing: PhotoCamera): void {
  write(facingKey(view), facing)
}

export function savedDeviceId(facing: PhotoCamera): string | null {
  return read(deviceKey(facing))
}

export function saveDeviceId(facing: PhotoCamera, id: string): void {
  write(deviceKey(facing), id)
}

export function forgetDeviceId(facing: PhotoCamera): void {
  try {
    localStorage.removeItem(deviceKey(facing))
  } catch {
    // Nothing to forget.
  }
}
