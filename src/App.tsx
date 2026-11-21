import { useCallback, useRef, useState } from 'react'
import type { Services } from './services'
import type { Muscle } from './types'
import { ExercisesFeature } from './features/exercises/ExercisesFeature'
import type { LibraryFilters } from './features/exercises/ExercisesFeature'
import { ProgramFeature } from './features/program/ProgramFeature'
import { LiftPage } from './features/progress/LiftPage'
import { MusclesPage } from './features/progress/MusclesPage'
import { ProgressFeature } from './features/progress/ProgressFeature'
import type { AppRoute } from './features/routes'
import { ServicesProvider } from './features/ServicesProvider'
import { SessionsScreen } from './features/sessions/SessionsScreen'
import { SettingsFeature } from './features/settings/SettingsFeature'
import { WorkoutFeature } from './features/workout/WorkoutFeature'
import { useServiceWorkerUpdate } from './pwa/registerSW'
import { AppShell, ShellChromeContext } from './ui/AppShell'
import type { Tab } from './ui/AppShell'
import { LiveStrip, type LiveStatus } from './ui/LiveStrip'
import { SignInToUpdatePill, UpdatePill } from './ui/UpdatePill'
import { useLandOnWorkout } from './ui/useLandOnWorkout'

/**
 * A page pushed over the Program tab (DX-04, DX-06): the Exercises library (with the muscles a
 * region panel's "Browse exercises" opened it on, `null` when reached any other way), Settings,
 * or Progress › Muscles from the Program's muscles row. Each keeps the tab bar and goes back to
 * Program.
 */
type ProgramPushed = { kind: 'exercises'; muscles: Muscle[] | null } | { kind: 'settings' } | { kind: 'muscles' }

/** The tab on screen, and on Sessions the Session a route opened. */
type Shown = { tab: Tab; sessionId?: string }

/**
 * What a screen group reports about being inside a session or an editor. The shell needs no
 * report: a full-screen mode says so to its own shell.
 */
function ignoreInSession(): void {}

/**
 * The whole app (E11-T15): the services every screen group reads through, and the tab on
 * screen. Each tab is its own screen group; this component only chooses which one shows and
 * carries what every shell shares -- the tab bar and the "Update ready" control.
 *
 * The control lives here rather than in a screen group because a new deployment must never
 * interrupt a workout: it is offered once an update is waiting and stays offered, whatever the
 * session moves on to, until the trainee presses it. Registering the worker from here is also
 * what starts the app listening for that update.
 */
export function App({ services }: { services: Services }): JSX.Element {
  const { needRefresh, signInToUpdate, update } = useServiceWorkerUpdate()

  return (
    <ServicesProvider services={services}>
      <Tabs
        trailing={
          needRefresh ? (
            <UpdatePill onUpdate={update} />
          ) : signInToUpdate ? (
            <SignInToUpdatePill />
          ) : null
        }
      />
    </ServicesProvider>
  )
}

/** Where a screen group's route lands: its tab. */
function destinationOf(
  to: Exclude<AppRoute, { tab: 'lift' } | { tab: 'exercises' } | { tab: 'settings' } | { tab: 'muscles' }>,
): Shown {
  switch (to.tab) {
    case 'history':
      return { tab: 'sessions', sessionId: to.sessionId }
    case 'progress':
      return { tab: 'progress' }
    case 'program':
      return { tab: 'program' }
    case 'workout':
      return { tab: 'train' }
  }
}

/**
 * The four tabs (Train, Sessions, Progress, Program), the pages pushed over them, and the Live
 * session.
 *
 * DX-06: every page pushed over a tab -- the Lift page over any tab, Exercises and Settings over
 * Program -- keeps the tab bar, with a back chevron and a centred title; a tab pressed leaves
 * the page for that tab.
 *
 * A workout in progress is a full-screen Live session with the tabs hidden. Its chevron
 * minimises it: the tabs come back with one live strip just above the tab bar (DX-09), and the
 * strip brings the session back where it was -- the Train tab's screen group stays mounted
 * across tabs while a session is live, so its exercise and set are never lost.
 */
function Tabs({ trailing }: { trailing: JSX.Element | null }): JSX.Element {
  const [shown, setShown] = useState<Shown>({ tab: 'train' })
  const [programPushed, setProgramPushed] = useState<ProgramPushed | null>(null)
  // True until the trainee first moves: only the app's launch opens a Session in progress
  // straight into its Live session; Train reached again shows its strip.
  const [launching, setLaunching] = useState(true)
  // Counts every move, so pressing the tab already on screen opens it afresh.
  const [visit, setVisit] = useState(0)
  // Train's own count: it only opens afresh while no session is live, so a minimised session
  // keeps its place however the trainee moves between tabs.
  const [trainVisit, setTrainVisit] = useState(0)
  // The Exercises search and filters, kept here so a visit to another tab leaves them as they were.
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>({ search: '', muscle: '', equipment: '' })
  const [live, setLive] = useState<LiveStatus | null>(null)
  const [minimised, setMinimised] = useState(false)
  // V6-03: the one Lift page, pushed over the tab it was opened from (which stays as it was).
  const [lift, setLift] = useState<string | null>(null)
  const liveRef = useRef<LiveStatus | null>(null)

  // Returning to the app with no workout in progress lands on Train (E8-T7); with one, the Live
  // session -- or the tab it was minimised over -- stays put.
  useLandOnWorkout(() => {
    if (liveRef.current === null && (shown.tab !== 'train' || lift !== null)) show({ tab: 'train' })
  })

  /** Shows a tab, leaving any page pushed over the one before. */
  function show(next: Shown): void {
    setLaunching(false)
    setProgramPushed(null)
    setLift(null)
    setVisit((count) => count + 1)
    if (liveRef.current === null) setTrainVisit((count) => count + 1)
    setShown(next)
  }

  /** Pushes a page over Program (Exercises, Settings). */
  function pushOverProgram(page: ProgramPushed): void {
    setLaunching(false)
    setLift(null)
    if (shown.tab !== 'program') {
      setVisit((count) => count + 1)
      setShown({ tab: 'program' })
    }
    setProgramPushed(page)
  }

  /** Moves to a tab or route a screen group asked for, e.g. Exercises filtered to muscles. */
  function navigate(to: AppRoute): void {
    if (to.tab === 'lift') {
      setLaunching(false)
      setLift(to.exerciseId)
      return
    }
    if (to.tab === 'exercises') {
      pushOverProgram({ kind: 'exercises', muscles: to.muscles ?? null })
      return
    }
    if (to.tab === 'settings' || to.tab === 'muscles') {
      pushOverProgram({ kind: to.tab })
      return
    }
    show(destinationOf(to))
  }

  /** The Live session's report: what the strip shows, and `null` once the session is over. */
  const handleLive = useCallback((status: LiveStatus | null) => {
    const ended = liveRef.current !== null && status === null
    liveRef.current = status
    setLive(status)
    if (ended) {
      // Finished or discarded: back on Train, where the summary opens.
      setMinimised(false)
      setProgramPushed(null)
      setLift(null)
      setShown({ tab: 'train' })
    }
  }, [])

  const handleMinimise = useCallback(() => {
    setLaunching(false)
    setMinimised(true)
  }, [])
  const handleRestore = useCallback(() => setMinimised(false), [])

  const liveOnScreen = live !== null && !minimised
  const liftOpen = lift !== null
  const onTrain = shown.tab === 'train' && !liftOpen

  return (
    <ShellChromeContext.Provider
      value={{
        tab: shown.tab,
        onTabChange: (tab) => show({ tab }),
        trailing,
      }}
    >
      {live !== null && minimised ? <LiveStrip status={live} onReturn={handleRestore} /> : null}
      <WorkoutFeature
        key={trainVisit}
        navigate={navigate}
        onInSession={ignoreInSession}
        landInSession={launching}
        shown={onTrain}
        minimised={minimised}
        onMinimise={handleMinimise}
        onRestore={handleRestore}
        onLive={handleLive}
      />
      {liveOnScreen ? null : (
        <>
          {liftOpen ? (
            <LiftPage
              key={lift}
              page={{ kind: 'lift', exerciseId: lift }}
              push={() => {}}
              navigate={navigate}
              onBack={() => setLift(null)}
            />
          ) : null}
          {/* The tab under the Lift page keeps its place (a summary open, a scroll) for Back. */}
          <div className="app-tab-host" style={{ display: liftOpen ? 'none' : 'contents' }}>
            {shown.tab === 'sessions' ? (
              <SessionsScreen key={visit} navigate={navigate} onInSession={ignoreInSession} initialSessionId={shown.sessionId} />
            ) : null}
            {shown.tab === 'progress' ? <ProgressFeature key={visit} navigate={navigate} /> : null}
            {shown.tab === 'program' && programPushed?.kind === 'settings' ? (
              <AppShell title="Settings" onBack={() => setProgramPushed(null)}>
                <SettingsFeature navigate={navigate} onInSession={ignoreInSession} />
              </AppShell>
            ) : null}
            {shown.tab === 'program' && programPushed?.kind === 'muscles' ? (
              <MusclesPage page={{ kind: 'muscles' }} push={() => {}} navigate={navigate} onBack={() => setProgramPushed(null)} />
            ) : null}
            {shown.tab === 'program' && programPushed?.kind === 'exercises' ? (
              <AppShell title="Exercises" onBack={() => setProgramPushed(null)}>
                <ExercisesFeature
                  initialMuscles={programPushed.muscles}
                  navigate={navigate}
                  onOpenLift={(exerciseId) => navigate({ tab: 'lift', exerciseId })}
                  filters={libraryFilters}
                  onFiltersChange={setLibraryFilters}
                />
              </AppShell>
            ) : null}
            {/* Program stays mounted under a pushed page, so Back finds it as it was. */}
            {shown.tab === 'program' ? (
              <div style={{ display: programPushed ? 'none' : 'contents' }}>
                <ProgramFeature key={visit} navigate={navigate} onInSession={ignoreInSession} />
              </div>
            ) : null}
          </div>
        </>
      )}
    </ShellChromeContext.Provider>
  )
}
