/**
 * Device-local camera choices (photos v2): which camera each view uses, and the deviceId that
 * opened the plain back camera. localStorage, never synced: they describe this phone.
 */
import type { PhotoAngle, PhotoCamera, PhotoMode } from '../../../../storage/photoStore'

const facingKey = (view: PhotoAngle): string => `photoCamera.${view}`
const modeKey = (view: PhotoAngle): string => `photoMode.${view}`
const VIEW_KEY = 'photoView'
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

/** Mirror for front and side, stand for back (a single mirror cannot show your back with the screen in view). */
export const defaultMode = (view: PhotoAngle): PhotoMode => (view === 'back' ? 'stand' : 'mirror')

/** How `view` was last taken: mirror or stand, remembered per view. */
export function savedMode(view: PhotoAngle): PhotoMode {
  const value = read(modeKey(view))
  return value === 'mirror' || value === 'stand' ? value : defaultMode(view)
}

export function saveMode(view: PhotoAngle, mode: PhotoMode): void {
  write(modeKey(view), mode)
}

/** The view the camera opens on: the last one used, else front. */
export function savedView(): PhotoAngle {
  const value = read(VIEW_KEY)
  return value === 'side' || value === 'back' ? value : 'front'
}

export function saveView(view: PhotoAngle): void {
  write(VIEW_KEY, view)
}
