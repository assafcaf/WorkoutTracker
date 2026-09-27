import type { ReactNode } from 'react'
import type { Services } from '../services'
import type { UseSync } from './useSync'

/**
 * Hands `services` to every descendant, and runs `useSync(services.sync)` once for all of them.
 *
 * STUB (E11-T9 test-designer): not implemented yet.
 */
export function ServicesProvider(_props: { services: Services; children: ReactNode }): JSX.Element {
  throw new Error('not implemented: ServicesProvider')
}

/** The services the nearest `ServicesProvider` holds. STUB (E11-T9 test-designer). */
export function useServices(): Services {
  throw new Error('not implemented: useServices')
}

/** The provider's one `UseSync`. STUB (E11-T9 test-designer). */
export function useSyncControls(): UseSync {
  throw new Error('not implemented: useSyncControls')
}
