import type { ProgressPages } from './pages'

export type ProgressFeatureProps = {
  /** The pages to draw; the registered ones by default. */
  pages?: ProgressPages
}

export function ProgressFeature(props: ProgressFeatureProps): JSX.Element {
  void props
  return <div />
}
