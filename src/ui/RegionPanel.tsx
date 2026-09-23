import type { Region } from '../domain/muscles'
import type { Muscle } from '../types'

export type RegionPanelProps = {
  region: Region
  count: number
  contributors: { exerciseId: string; name: string; sets: number }[]
  onBrowse(muscles: Muscle[]): void
  onClose(): void
}

/**
 * The panel a tapped body-map region opens (E5-T20, M9): the region's set count, the exercises
 * that contributed to it, "Browse exercises" and "Close".
 *
 * Stub: E5-T20's red commit. The code-writer implements it.
 */
export function RegionPanel(_props: RegionPanelProps): JSX.Element | null {
  return null
}
