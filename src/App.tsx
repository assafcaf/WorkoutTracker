import { useCallback, useRef, useState } from 'react'
import type { Services } from './services'
import type { Muscle } from './types'
import { ExercisesFeature } from './features/exercises/ExercisesFeature'
import type { LibraryFilters } from './features/exercises/ExercisesFeature'
import { ProgramFeature } from './features/program/ProgramFeature'
import { ProgressFeature } from './features/progress/ProgressFeature'
import type { AppRoute } from './features/routes'
import { ServicesProvider } from './features/ServicesProvider'
import { SessionsScreen } from './features/sessions/SessionsScreen'
import { SettingsFeature } from './features/settings/SettingsFeature'
import { useServiceData } from './features/useServiceData'
import { WorkoutFeature } from './features/workout/WorkoutFeature'
import { useServiceWorkerUpdate } from './pwa/registerSW'
import { AppShell, ShellChromeContext } from './ui/AppShell'
import type { Tab } from './ui/AppShell'
import { isBackupDue } from './ui/BackupBadge'
import { Segmented } from './ui/controls'
import { LiveStrip, type LiveStatus } from './ui/LiveStrip'
import { UpdatePill } from './ui/UpdatePill'
import { useLandOnWorkout } from './ui/useLandOnWorkout'

/** The Program tab's two sides (S7a): the program itself, and the exercise library. */
type ProgramSide = 'program' | 'exercises'

/**
 * The tab on screen; on the Program tab the side showing, and for Exercises the muscles a
 * region panel's "Browse exercises" opened it on (M9) -- `null` when reached any other way.
 */
type Shown = { tab: Tab; side: ProgramSide; muscles: Muscle[] | null; sessionId?: string }

/**
 * What a screen group reports about being inside a session or an editor. The shell needs no
 * report: a screen with a back control, an action bar or a header of its own is drawn without
 * the tab bar.
 */
function ignoreInSession(): void {}

/**
 * The whole app (E11-T15): the services every screen group reads through, and the tab on
 * screen. Each tab is its own screen group; this component only chooses which one shows and
 * carries what every shell shares -- the tab bar, the Settings gear's backup marker and the
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

/** Where a screen group's route lands: its tab, and on the Program tab its side. */
function destinationOf(to: AppRoute): Shown {
  switch (to.tab) {
    case 'exercises':
      return { tab: 'program', side: 'exercises', muscles: to.muscles }
    case 'history':
      return { tab: 'sessions', side: 'program', muscles: null, sessionId: to.sessionId }
    case 'progress':
      return { tab: 'lifts', side: 'program', muscles: null }
    case 'program':
      return { tab: 'program', side: 'program', muscles: null }
    case 'workout':
      return { tab: 'dashboard', side: 'program', muscles: null }
  }
}

/**
 * The four tabs (Train, Progress, Sessions, Program), the full-screen Settings page off the
 * Dashboard's gear, and the Live session.
 *
 * A workout in progress is a full-screen Live session with the tabs hidden. Its chevron
 * minimises it: the tabs come back with a live strip pinned to the top of every one, and the
 * strip brings the session back where it was -- the Dashboard's screen group stays mounted
 * across tabs while a session is live, so its exercise and set are never lost.
 */
function Tabs({ trailing }: { trailing: JSX.Element | null }): JSX.Element {
  const [shown, setShown] = useState<Shown>({ tab: 'dashboard', side: 'program', muscles: null })
  const [settingsOpen, setSettingsOpen] = useState(false)
  // True until the trainee first moves: only the app's launch opens a Session in progress
  // straight into its Live session; the Dashboard reached again offers resuming it.
  const [launching, setLaunching] = useState(true)
  // Counts every move, so pressing the tab already on screen opens it afresh (the Program tab
  // without a refused Delete's line), as it always has.
  const [visit, setVisit] = useState(0)
  // The Dashboard's own count: it only opens afresh while no session is live, so a minimised
  // session keeps its place however the trainee moves between tabs.
  const [dashboardVisit, setDashboardVisit] = useState(0)
  // The Exercises search and filters, kept here so a visit to another tab leaves them as they were.
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>({ search: '', muscle: '', equipment: '' })
  const [live, setLive] = useState<LiveStatus | null>(null)
  const [minimised, setMinimised] = useState(false)
  const liveRef = useRef<LiveStatus | null>(null)
  const lastExportedAt = useServiceData((s) => s.preferences.lastExportedAt(), ['preferences'])

  // Returning to the app with no workout in progress lands on the Dashboard (E8-T7); with one,
  // the Live session -- or the tab it was minimised over -- stays put.
  useLandOnWorkout(() => {
    if (liveRef.current === null && (shown.tab !== 'dashboard' || settingsOpen)) show(destinationOf({ tab: 'workout' }))
  })

  /** Shows a tab (closing Settings), and on the Program tab a side. */
  function show(next: Shown): void {
    setLaunching(false)
    setSettingsOpen(false)
    setVisit((count) => count + 1)
    if (liveRef.current === null) setDashboardVisit((count) => count + 1)
    setShown(next)
  }

  /** Moves to a tab or route a screen group asked for, e.g. Exercises filtered to muscles. */
  function navigate(to: AppRoute): void {
    show(destinationOf(to))
  }

  /** The Live session's report: what the strip shows, and `null` once the session is over. */
  const handleLive = useCallback((status: LiveStatus | null) => {
    const ended = liveRef.current !== null && status === null
    liveRef.current = status
    setLive(status)
    if (ended) {
      // Finished or discarded: back on the Dashboard, where the summary opens.
      setMinimised(false)
      setSettingsOpen(false)
      setShown((current) => ({ ...current, tab: 'dashboard' }))
    }
  }, [])

  const handleMinimise = useCallback(() => {
    setLaunching(false)
    setMinimised(true)
  }, [])
  const handleRestore = useCallback(() => setMinimised(false), [])

  // The backup-due marker the Settings gear carries: none while the last export is still being
  // read, and due when storage cannot say, as before.
  const settingsBadge =
    lastExportedAt.status === 'loading'
      ? false
      : isBackupDue(lastExportedAt.status === 'ready' ? lastExportedAt.data : null, Date.now())

  const liveOnScreen = live !== null && !minimised
  const onDashboard = shown.tab === 'dashboard' && !settingsOpen

  const programSwitch = (
    <Segmented
      name="program-side"
      label="Program view"
      value={shown.side}
      options={[
        { value: 'program', label: 'Program' },
        { value: 'exercises', label: 'Exercises' },
      ]}
      onChange={(side) => show({ tab: 'program', side, muscles: null })}
    />
  )

  return (
    <ShellChromeContext.Provider
      value={{
        tab: shown.tab,
        onTabChange: (tab) => show({ tab, side: 'program', muscles: null }),
        trailing,
        lead: shown.tab === 'program' && !settingsOpen ? programSwitch : undefined,
        onOpenSettings: () => {
          setLaunching(false)
          setSettingsOpen(true)
        },
        settingsBadge,
      }}
    >
      {live !== null && minimised ? <LiveStrip status={live} onReturn={handleRestore} /> : null}
      <WorkoutFeature
        key={dashboardVisit}
        navigate={navigate}
        onInSession={ignoreInSession}
        landInSession={launching}
        shown={onDashboard}
        minimised={minimised}
        onMinimise={handleMinimise}
        onRestore={handleRestore}
        onLive={handleLive}
      />
      {liveOnScreen ? null : settingsOpen ? (
        <AppShell title="Settings" onBack={() => setSettingsOpen(false)}>
          <SettingsFeature navigate={navigate} onInSession={ignoreInSession} />
        </AppShell>
      ) : (
        <>
          {shown.tab === 'sessions' ? (
            <SessionsScreen key={visit} navigate={navigate} onInSession={ignoreInSession} />
          ) : null}
          {shown.tab === 'lifts' ? (
            <ProgressFeature key={visit} />
          ) : null}
          {shown.tab === 'program' && shown.side === 'program' ? (
            <ProgramFeature key={visit} navigate={navigate} onInSession={ignoreInSession} />
          ) : null}
          {shown.tab === 'program' && shown.side === 'exercises' ? (
            <AppShell key={visit} title="Exercises">
              <ExercisesFeature
                initialMuscles={shown.muscles}
                navigate={navigate}
                filters={libraryFilters}
                onFiltersChange={setLibraryFilters}
              />
            </AppShell>
          ) : null}
        </>
      )}
    </ShellChromeContext.Provider>
  )
}
