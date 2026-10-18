import { SUPPORTED_VERSIONS, VERSION_HEADER, isSupportedVersion, versionOf } from '../contract'
import { json } from './http'

/** Null when the request's contract version is served; otherwise the 426 that names the range. */
export function versionGate(request: Request): Response | null {
  const version = versionOf(request.headers.get(VERSION_HEADER))
  if (version !== null && isSupportedVersion(version)) return null
  return json({ error: 'update required', supported: SUPPORTED_VERSIONS }, 426)
}
