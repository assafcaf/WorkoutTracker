import { useState } from 'react'
import type { ComponentType } from 'react'
import type { AppRoute } from '../routes'
import { PROGRESS_PAGES } from './pages'
import type { ProgressPage, ProgressPageKind, ProgressPageProps, ProgressPages } from './pages'

export type ProgressFeatureProps = {
  /** The pages to draw; the registered ones by default. */
  pages?: ProgressPages
  /** Sends the app to a route (a Session's summary); handed to every page. */
  navigate?: (to: AppRoute) => void
}

/**
 * The Progress tab's screen group: it stays mounted while the trainee moves between its pages,
 * so what a page loaded is loaded once. A page pushes over the one below and Back returns to
 * it; the home page is the tab itself and has no Back.
 */
export function ProgressFeature({ pages = PROGRESS_PAGES, navigate }: ProgressFeatureProps): JSX.Element {
  const [stack, setStack] = useState<ProgressPage[]>([{ kind: 'home' }])
  const page = stack[stack.length - 1]
  const Page = pages[page.kind] as ComponentType<ProgressPageProps<ProgressPageKind>>

  return (
    <Page
      page={page}
      navigate={navigate}
      push={(next) => setStack((current) => [...current, next])}
      onBack={stack.length > 1 ? () => setStack((current) => current.slice(0, -1)) : undefined}
    />
  )
}
