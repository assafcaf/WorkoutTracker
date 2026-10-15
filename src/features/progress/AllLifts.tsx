import type { ProgressPageProps } from './pages'

type AllLiftsProps = ProgressPageProps<'lifts'> & {
  now?: () => number
}

// Stub (E18-T10 red commit): All lifts is not built yet.
export function AllLifts(_props: AllLiftsProps): JSX.Element | null {
  return null
}
