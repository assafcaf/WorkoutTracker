import { useState } from 'react'
import type { Services } from './services'
import type { Muscle } from './types'
import { ExercisesFeature } from './features/exercises/ExercisesFeature'
import type { LibraryFilters } from './features/exercises/ExercisesFeature'
import { HistoryFeature } from './features/history/HistoryFeature'
import { ProgramFeature } from './features/program/ProgramFeature'
import type { AppRoute } from './features/routes'
import { ServicesProvider } from './features/ServicesProvider'
import { SettingsFeature } from './features/settings/SettingsFeature'
import { useServiceData } from './features/useServiceData'
import { WorkoutFeature } from './features/workout/WorkoutFeature'
import { useServiceWorkerUpdate } from './pwa/registerSW'
import { AppShell, ShellChromeContext } from './ui/AppShell'
import type { Tab } from './ui/AppShell'
import { isBackupDue } from './ui/BackupBadge'
import { UpdatePill } from './ui/UpdatePill'
import { useLandOnWorkout } from './ui/useLandOnWorkout'

/**
 * The tab on screen, and for Exercises the muscles a region panel's "Browse exercises" opened it
 * on (M9) -- `null` when the tab was reached any other way.
 */
type Shown = { tab: Tab; muscles: Muscle[] | null }

/**
 * What a screen group reports about being inside a session or an editor. The shell needs no
 * report: a screen with a back control or an action bar is drawn without the tab bar.
 */
function ignoreInSession(): void {}

/**
 * The whole app (E11-T15): the services every screen group reads through, and the tab on
 * screen. Each tab is its own screen group; this component only chooses which one shows and
 * carries what every shell shares -- the tab bar, the Settings tab's backup marker and the
 * "Update ready" control.
 *
 * The control lives here rather than in a screen group because a new deployment must never
 * interrupt a workout: it is offered once an update is waiting and stays offered, whatever the
 * session moves on to, until the trainee presses it. Registering the worker from here is also
 * what starts the app listening for that update.
 */
export function App({ services }: { services: Services }): JSX.Element {
  const { needRefresh, update } = useServiceWorkerUpdate()

  return (
    <ServicesProvider services={services}>
      <Tabs trailing={needRefresh ? <UpdatePill onUpdate={update} /> : null} />
    </ServicesProvider>
  )
}

/** The tab on screen, its screen group, and the chrome every shell below it shares. */
function Tabs({ trailing }: { trailing: JSX.Element | null }): JSX.Element {
  const [shown, setShown] = useState<Shown>({ tab: 'workout', muscles: null })
  // True until the trainee first moves: only the app's launch opens a Session in progress
  // straight into its exercise list; the Workout tab reached again offers resuming it.
  const [launching, setLaunching] = useState(true)
  // Counts every move, so pressing the tab already on screen opens it afresh (History, not
  // Stats; the Program tab without a refused Delete's line), as it always has.
  const [visit, setVisit] = useState(0)
  // The Exercises search and filters, kept here so a visit to another tab leaves them as they were.
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>({ search: '', muscle: '', equipment: '' })
  const lastExportedAt = useServiceData((s) => s.preferences.lastExportedAt(), ['preferences'])

  // Returning to the app outside a workout lands on the Workout tab (E8-T7); on that tab the
  // picker, or mid-session the exercise list or set screen, stays put.
  useLandOnWorkout(() => {
    if (shown.tab !== 'workout') show('workout')
  })

  /** Shows `tab`, and for Exercises the muscles it opens filtered to. */
  function show(tab: Tab, muscles: Muscle[] | null = null): void {
    setLaunching(false)
    setVisit((count) => count + 1)
    setShown({ tab, muscles })
  }

  /** Moves to a tab or route a screen group asked for, e.g. Exercises filtered to muscles. */
  function navigate(to: AppRoute): void {
    show(to.tab, to.tab === 'exercises' ? to.muscles : null)
  }

  // The backup-due marker the Settings tab carries in the nav: none while the last export is
  // still being read, and due when storage cannot say, as before.
  const settingsBadge =
    lastExportedAt.status === 'loading'
      ? false
      : isBackupDue(lastExportedAt.status === 'ready' ? lastExportedAt.data : null, Date.now())

  return (
    <ShellChromeContext.Provider
      value={{
        tab: shown.tab,
        onTabChange: (tab) => show(tab),
        trailing,
        settingsBadge,
      }}
    >
      {shown.tab === 'workout' ? (
        <WorkoutFeature
          key={visit}
          navigate={navigate}
          onInSession={ignoreInSession}
          landInSession={launching}
        />
      ) : null}
      {shown.tab === 'program' ? (
        <ProgramFeature key={visit} navigate={navigate} onInSession={ignoreInSession} />
      ) : null}
      {shown.tab === 'exercises' ? (
        <AppShell key={visit} title="Exercises">
          <ExercisesFeature
            initialMuscles={shown.muscles}
            navigate={navigate}
            filters={libraryFilters}
            onFiltersChange={setLibraryFilters}
          />
        </AppShell>
      ) : null}
      {shown.tab === 'history' ? (
        <HistoryFeature key={visit} navigate={navigate} onInSession={ignoreInSession} />
      ) : null}
      {shown.tab === 'settings' ? (
        <AppShell key={visit} title="Settings">
          <SettingsFeature navigate={navigate} onInSession={ignoreInSession} />
        </AppShell>
      ) : null}
    </ShellChromeContext.Provider>
  )
}
