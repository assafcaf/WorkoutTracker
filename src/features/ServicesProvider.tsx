import { createContext, useContext, type ReactNode } from 'react'
import type { Services } from '../services'
import { useSync, type UseSync } from './useSync'

type ServicesContextValue = { services: Services; syncControls: UseSync }

const ServicesContext = createContext<ServicesContextValue | null>(null)

/** Hands `services` to every descendant, and runs `useSync(services.sync)` once for all of them. */
export function ServicesProvider({
  services,
  children,
}: {
  services: Services
  children: ReactNode
}): JSX.Element {
  const syncControls = useSync(services.sync)
  return (
    <ServicesContext.Provider value={{ services, syncControls }}>{children}</ServicesContext.Provider>
  )
}

function useServicesContext(): ServicesContextValue {
  const value = useContext(ServicesContext)
  if (value === null) throw new Error('no ServicesProvider above this component')
  return value
}

/** The services the nearest `ServicesProvider` holds. */
export function useServices(): Services {
  return useServicesContext().services
}

/** The provider's one `UseSync`. */
export function useSyncControls(): UseSync {
  return useServicesContext().syncControls
}
