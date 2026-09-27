import type { ChangeBus } from './changes'

export type ServiceDeps = {
  now: () => number
  bus: ChangeBus
  storageAvailable: boolean
}
