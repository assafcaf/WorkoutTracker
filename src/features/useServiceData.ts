import { useEffect, useRef, useState } from 'react'
import type { ChangeTopic, Services } from '../services'
import { useServices } from './ServicesProvider'

export type ServiceData<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'ready'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: unknown }

const LOADING = { status: 'loading', data: undefined, error: undefined } as const

/**
 * Reads `read(services)` on mount and again whenever one of `topics` fires on the bus. `read`
 * may be a new function on every render: the latest one is used, and only the topics' content
 * (not the array's identity) restarts the subscription. A result arriving after a newer read
 * started, or after unmount, is dropped.
 */
export function useServiceData<T>(
  read: (s: Services) => Promise<T>,
  topics: ChangeTopic[],
): ServiceData<T> {
  const services = useServices()
  const [state, setState] = useState<ServiceData<T>>(LOADING)
  const readRef = useRef(read)
  readRef.current = read
  const topicsKey = [...topics].sort().join(',')

  useEffect(() => {
    let active = true
    let latest = 0

    const run = (): void => {
      const call = ++latest
      let pending: Promise<T>
      try {
        pending = readRef.current(services)
      } catch (error) {
        pending = Promise.reject(error)
      }
      pending.then(
        (data) => {
          if (active && call === latest) setState({ status: 'ready', data, error: undefined })
        },
        (error: unknown) => {
          if (active && call === latest) setState({ status: 'error', data: undefined, error })
        },
      )
    }

    const unsubscribes = topicsKey
      .split(',')
      .filter((topic) => topic !== '')
      .map((topic) => services.bus.subscribe(topic as ChangeTopic, run))
    run()

    return () => {
      active = false
      unsubscribes.forEach((unsubscribe) => unsubscribe())
    }
  }, [services, topicsKey])

  return state
}
