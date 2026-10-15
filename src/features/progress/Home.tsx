import type { AppRoute } from '../routes'
import type { ProgressPageProps } from './pages'

type HomeProps = ProgressPageProps<'home'> & {
  navigate?: (to: AppRoute) => void
  now?: () => number
}

// Stub (E18-T10 red commit): the Progress home is not built yet.
export function Home(_props: HomeProps): JSX.Element | null {
  return null
}
