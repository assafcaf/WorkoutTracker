import { useEffect, useState } from 'react'
import type { Exercise, Program, Session, SetEntry, Workout } from './types'
import { loadCatalog, loadPrograms } from './data/catalog'
import { useServiceWorkerUpdate } from './pwa/registerSW'
import { db, isStorageAvailable } from './storage/db'
import {
  ACTIVE_PROGRAM_ID_KEY,
  getActiveProgramId,
  getLastExportedAt,
  setActiveProgramId,
} from './storage/settingsStore'
import {
  finishSession,
  getActiveSession,
  getLastEntriesFor,
  listSessions,
  startOrResumeSession,
} from './storage/sessionStore'
import { BackupBadge } from './ui/BackupBadge'
import { ExerciseList } from './ui/ExerciseList'
import { HistoryList } from './ui/HistoryList'
import { ProgramPicker } from './ui/ProgramPicker'
import { SetScreen } from './ui/SetScreen'
import { Settings } from './ui/Settings'
import { StorageUnavailableBanner } from './ui/StorageUnavailableBanner'
import { UpdatePill } from './ui/UpdatePill'

type View = 'picker' | 'settings' | 'list' | 'set' | 'history'

/** The set the set screen is on, with the history it was opened against. */
type OpenSet = { exerciseId: string; setIndex: number; history: SetEntry[] }

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      catalog: Map<string, Exercise>
      programs: Program[]
      storageAvailable: boolean
      activeProgramId: string
      staleActiveProgramNotice: boolean
      lastExportedAt: number | null
    }

/** The program and workout a session was started from, or null when the program is gone. */
function locateSession(
  programs: Program[],
  session: Session,
): { program: Program; workout: Workout } | null {
  const program = programs.find((candidate) => candidate.id === session.programId)
  const workout = program?.workouts.find((candidate) => candidate.id === session.workoutId)
  return program && workout ? { program, workout } : null
}

/**
 * What a set opens preset from: today's sets for the exercise laid over the last finished
 * session's, so a set past the plan opens on the set before it as it was actually lifted.
 */
function presetHistory(history: SetEntry[], session: Session, exerciseId: string): SetEntry[] {
  const today = session.entries.filter((entry) => entry.exerciseId === exerciseId)
  const older = history.filter(
    (entry) => !today.some((logged) => logged.setIndex === entry.setIndex),
  )
  return [...older, ...today]
}

/** The session in progress, or null when there is none or storage cannot be read. */
async function activeSessionOrNull(storageAvailable: boolean): Promise<Session | null> {
  if (!storageAvailable) return null
  try {
    return await getActiveSession()
  } catch {
    return null
  }
}

/**
 * The whole app: the views below, with the "Update ready" control over them.
 *
 * The control lives here rather than in a view because a new deployment must never interrupt
 * a workout: it is offered once an update is waiting and stays offered, whatever the session
 * moves on to, until the trainee presses it. Registering the worker from here is also what
 * starts the app listening for that update.
 */
export function App(): JSX.Element {
  const { needRefresh, update } = useServiceWorkerUpdate()

  return (
    <>
      {needRefresh ? <UpdatePill onUpdate={update} /> : null}
      <AppViews />
    </>
  )
}

/**
 * The app's views: loads the catalog and programs, resolves the active program, and renders
 * the session in progress — its exercise list or one of its set screens — or the picker, or a
 * route to Settings, or a hard-error screen when the programs fail to load.
 *
 * A session in progress wins on mount, so reopening the app lands back in it.
 *
 * E1-T8 extends this routing with the history list rather than replacing it.
 */
function AppViews(): JSX.Element {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [view, setView] = useState<View>('picker')
  const [session, setSession] = useState<Session | null>(null)
  const [openSet, setOpenSet] = useState<OpenSet | null>(null)
  const [history, setHistory] = useState<Session[]>([])

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        const catalog = loadCatalog()
        const programs = loadPrograms(catalog)
        const storageAvailable = await isStorageAvailable()
        const storedRow = await db.settings.get(ACTIVE_PROGRAM_ID_KEY)
        const storedProgramId = typeof storedRow?.value === 'string' ? storedRow.value : undefined
        const activeProgramId = await getActiveProgramId(programs)
        const staleActiveProgramNotice =
          storedProgramId !== undefined &&
          !programs.some((program) => program.id === storedProgramId)
        const inProgress = await activeSessionOrNull(storageAvailable)
        const lastExportedAt = storageAvailable ? await getLastExportedAt() : null

        if (cancelled) return
        setSession(inProgress)
        setView(inProgress ? 'list' : 'picker')
        setState({
          status: 'ready',
          catalog,
          programs,
          storageAvailable,
          activeProgramId,
          staleActiveProgramNotice,
          lastExportedAt,
        })
      } catch (error) {
        if (cancelled) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') return <div />

  if (state.status === 'error') {
    return <div role="alert">Could not load the workout programs: {state.message}</div>
  }

  const { catalog, programs, storageAvailable, activeProgramId, staleActiveProgramNotice, lastExportedAt } =
    state

  function handleActiveProgramChange(id: string): void {
    setActiveProgramId(id)
      .then(() => {
        setState((current) =>
          current.status === 'ready'
            ? { ...current, activeProgramId: id, staleActiveProgramNotice: false }
            : current,
        )
      })
      .catch(() => {
        // Nothing to recover to here; a later read will surface the same failure.
      })
  }

  /** Starts the chosen workout, or resumes the session already in progress, and lists it. */
  function handleChoose(programId: string, workoutId: string): void {
    startOrResumeSession(programId, workoutId, Date.now())
      .then((started) => {
        setSession(started)
        setOpenSet(null)
        setView('list')
      })
      .catch(() => {
        // The picker stays up; nothing was started, so there is nothing to undo.
      })
  }

  /** Opens a set of an exercise, against what that exercise was last lifted with. */
  function handleOpenSet(exerciseId: string, setIndex: number): void {
    getLastEntriesFor(exerciseId)
      .then((history) => {
        setOpenSet({ exerciseId, setIndex, history })
        setView('set')
      })
      .catch(() => {
        // Without the history the preset would be wrong; the list stays up instead.
      })
  }

  /** Moves the open set past the plan; the history it was opened against still holds. */
  function handleAddSet(exerciseId: string, nextSetIndex: number): void {
    setOpenSet((current) =>
      current && current.exerciseId === exerciseId
        ? { ...current, setIndex: nextSetIndex }
        : current,
    )
  }

  if (view === 'settings') {
    return (
      <div>
        <button type="button" onClick={() => setView('picker')}>
          Back
        </button>
        <Settings
          programs={programs}
          activeProgramId={activeProgramId}
          onActiveProgramChange={handleActiveProgramChange}
        />
      </div>
    )
  }

  // A session whose program has since been retired has nowhere to be shown; the picker is
  // what is left.
  const located = session ? locateSession(programs, session) : null

  if (view === 'set' && session && located && openSet) {
    const plan = located.workout.exercises.find(
      (candidate) => candidate.exerciseId === openSet.exerciseId,
    )
    const exercise = catalog.get(openSet.exerciseId)
    if (plan && exercise) {
      return (
        // Keyed by the set, so opening another set -- or an extra one past the plan -- opens
        // it preset afresh, while logging within one set screen leaves it standing.
        <SetScreen
          key={`${openSet.exerciseId}#${openSet.setIndex}`}
          exercise={exercise}
          plan={plan}
          setIndex={openSet.setIndex}
          sessionId={session.id}
          lastEntries={presetHistory(openSet.history, session, openSet.exerciseId)}
          onLogged={(logged) => setSession(logged)}
          onAddSet={handleAddSet}
        />
      )
    }
  }

  /** Finishes the session in progress, then returns to the picker. */
  function handleFinish(): void {
    if (!session) return
    finishSession(session.id, Date.now())
      .then(() => {
        setSession(null)
        setOpenSet(null)
        setView('picker')
      })
      .catch(() => {
        // The list stays up; nothing was cleared, so there is nothing to undo.
      })
  }

  /** Loads the finished sessions and shows them. */
  function handleShowHistory(): void {
    listSessions()
      .then((sessions) => {
        setHistory(sessions)
        setView('history')
      })
      .catch(() => {
        // The picker stays up; without the sessions there is nothing to show.
      })
  }

  if (view === 'list' && session && located) {
    return (
      <ExerciseList
        program={located.program}
        workout={located.workout}
        catalog={catalog}
        session={session}
        onOpenSet={handleOpenSet}
        onFinish={handleFinish}
      />
    )
  }

  if (view === 'history') {
    return (
      <div>
        <button type="button" onClick={() => setView('picker')}>
          Back
        </button>
        <HistoryList sessions={history} programs={programs} />
      </div>
    )
  }

  return (
    <div>
      {!storageAvailable ? <StorageUnavailableBanner /> : null}
      {staleActiveProgramNotice ? (
        <p>The saved active program no longer exists; showing the first program instead.</p>
      ) : null}
      <button type="button" onClick={() => setView('settings')}>
        Settings
      </button>
      <BackupBadge lastExportedAt={lastExportedAt} now={Date.now()} />
      <button type="button" onClick={handleShowHistory}>
        History
      </button>
      <fieldset disabled={!storageAvailable}>
        <ProgramPicker
          programs={programs}
          catalog={catalog}
          activeProgramId={activeProgramId}
          onChoose={handleChoose}
        />
      </fieldset>
    </div>
  )
}
