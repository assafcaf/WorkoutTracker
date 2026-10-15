import { createElement } from 'react'
import type { ComponentType, FunctionComponent } from 'react'
import { AppShell } from '../../ui/AppShell'
import { MusclesPage } from './MusclesPage'
import type { AppRoute } from '../routes'
import { LiftPage } from './LiftPage'
import { AllLifts } from './AllLifts'
import { Home } from './Home'

/** The pages the Progress tab pushes. `home` is the tab's own screen; the others push over it. */
export type ProgressPage =
  | { kind: 'home' }
  | { kind: 'lifts' }
  | { kind: 'lift'; exerciseId: string }
  | { kind: 'muscles' }

export type ProgressPageKind = ProgressPage['kind']

/** What the group hands every page it draws. */
export type ProgressPageProps<K extends ProgressPageKind = ProgressPageKind> = {
  page: Extract<ProgressPage, { kind: K }>
  /** Pushes a page over this one. */
  push(page: ProgressPage): void
  /** Sends the app to a route (a Session's summary); the group's own `navigate`, when it has one. */
  navigate?: (to: AppRoute) => void
  /** The page's Back control; `undefined` on the home page, which is the tab itself. */
  onBack: (() => void) | undefined
}

export type ProgressPages = { [K in ProgressPageKind]: ComponentType<ProgressPageProps<K>> }

function placeholder(title: string): FunctionComponent<Pick<ProgressPageProps, 'onBack'>> {
  const Placeholder = ({ onBack }: Pick<ProgressPageProps, 'onBack'>): JSX.Element =>
    createElement(AppShell, { title, onBack, children: null })
  Placeholder.displayName = `${title}Placeholder`
  return Placeholder
}

/**
 * One registration per page; the page's ticket replaces its placeholder with the real screen
 * (one line each, so tickets adding different pages never touch the same line).
 */
export const PROGRESS_PAGES: ProgressPages = {
  home: placeholder('Progress'),
  lift: placeholder('Lift'),
  lifts: placeholder('All lifts'),
  muscles: placeholder('Muscles'),
}

PROGRESS_PAGES.muscles = MusclesPage
// E18-T11: the lift page (appended, so tickets registering other pages never touch this line).
PROGRESS_PAGES.lift = LiftPage

// E18-T10 registers its pages (append-only, so tickets adding other pages never touch these lines).
PROGRESS_PAGES.home = Home
PROGRESS_PAGES.lifts = AllLifts
