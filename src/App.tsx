import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  Exercise,
  LibraryExercise,
  Muscle,
  Program,
  Session,
  SetEntry,
  Video,
  Workout,
} from './types'
import { loadCatalog, loadPrograms } from './data/catalog'
import { MUSCLES, loadLibrary, loadVideos } from './data/library'
import { photoUrls } from './data/photos'
import { resolveExercise } from './data/resolve'
import { useServiceWorkerUpdate } from './pwa/registerSW'
import {
  BackupFormatError,
  downloadOrShare,
  exportBackup,
  importBackup,
  importPlan,
  readBackup,
} from './storage/backup'
import type { ImportPlan } from './storage/backup'
import { db, isStorageAvailable } from './storage/db'
import {
  ACTIVE_PROGRAM_ID_KEY,
  getActiveProgramId,
  getGymEquipment,
  getLastExportedAt,
  setActiveProgramId,
} from './storage/settingsStore'
import {
  finishSession,
  getActiveSession,
  getLastEntriesFor,
  listSessions,
  setSwap,
  startOrResumeSession,
} from './storage/sessionStore'
import { ActionBarSlot, AppShell } from './ui/AppShell'
import type { Tab } from './ui/AppShell'
import { AlternativesList } from './ui/AlternativesList'
import { BackupBadge, isBackupDue } from './ui/BackupBadge'
import { ExerciseDetail } from './ui/ExerciseDetail'
import { ExerciseList } from './ui/ExerciseList'
import { HistoryList } from './ui/HistoryList'
import { ImportConfirm } from './ui/ImportConfirm'
import { LibraryList } from './ui/LibraryList'
import { ProgramPicker } from './ui/ProgramPicker'
import { ResumeCard } from './ui/ResumeCard'
import { SetScreen } from './ui/SetScreen'
import { Settings } from './ui/Settings'
import { StorageUnavailableBanner } from './ui/StorageUnavailableBanner'
import { UpdatePill } from './ui/UpdatePill'

type View = 'picker' | 'settings' | 'list' | 'set' | 'history' | 'exercises'

/**
 * The tab each view sits under, and `null` for the views that are inside a session: a
 * workout in progress shows the header and the action bar, but no way out of it by tab.
 */
const TAB_OF: Record<View, Tab | null> = {
  picker: 'workout',
  exercises: 'exercises',
  history: 'history',
  settings: 'settings',
  list: null,
  set: null,
}

/** The tab a view's shell is on, as `AppShell` takes it: no tab bar for the in-session views. */
function tabFor(view: View): Tab | undefined {
  return TAB_OF[view] ?? undefined
}

/** The set the set screen is on, with the history it was opened against. */
type OpenSet = { exerciseId: string; setIndex: number; history: SetEntry[] }

/**
 * The in-app exercise detail overlay (E5-T8): rendered over whatever view is current without
 * unmounting it, so a set screen's dial state survives a trip through "Exercise info". `heading`
 * overrides the library entry's own name, since a catalog exercise's own name (e.g. "Deadlift")
 * can differ from the library entry it maps to ("Barbell Deadlift").
 *
 * The ranked alternatives overlay (E5-T12) is rendered the same way, over whatever view is
 * current. `plannedId` is the workout plan's own `exerciseId` -- the swap `setSwap` is recorded
 * against -- even when the set screen it was opened from is itself already showing a swapped-in
 * exercise.
 */
type Overlay = { kind: 'detail'; libraryId: string; heading?: string } | { kind: 'alternatives'; plannedId: string }

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

/** A chosen backup file, read and counted, waiting for the trainee to confirm or cancel it. */
type PendingImport = {
  text: string
  currentCount: number
  incomingCount: number
  plan: ImportPlan
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
 * The workout plan's own `exerciseId` for `exerciseId` on screen: `exerciseId` itself when it
 * is a plan's id (unswapped, or the plan id itself), or the plan whose recorded swap
 * (`session.swaps`) is `exerciseId` (E5-T12) -- so a swapped-in exercise's set screen can still
 * be matched back to the `ExercisePlan` (sets, rep range, rest) that prescribed it.
 */
function plannedExerciseIdFor(session: Session, exerciseId: string): string {
  const swapped = Object.entries(session.swaps ?? {}).find(([, doneId]) => doneId === exerciseId)
  return swapped ? swapped[0] : exerciseId
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

  return <AppViews trailing={needRefresh ? <UpdatePill onUpdate={update} /> : null} />
}

type AppViewsProps = {
  /**
   * The shell header's trailing slot, carried down from `App` so it rides every shell this
   * component renders rather than being re-parented into whichever screen is up when an
   * update is found — that is what keeps "Update ready" in place across a tab change.
   */
  trailing?: ReactNode
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
function AppViews({ trailing }: AppViewsProps): JSX.Element {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [view, setView] = useState<View>('picker')
  const [session, setSession] = useState<Session | null>(null)
  const [openSet, setOpenSet] = useState<OpenSet | null>(null)
  const [history, setHistory] = useState<Session[]>([])
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [library, setLibrary] = useState<LibraryExercise[]>([])
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryMuscle, setLibraryMuscle] = useState('')
  const [libraryEquipment, setLibraryEquipment] = useState('')
  // The in-app detail overlay (E5-T8). Looked up against `library` at render time, so it is
  // never stale once the library has loaded, and stays `null` until something opens it.
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  // The gym's saved equipment (E5-T12's Out of scope: passed through as-is, no settings UI).
  const [gymEquipment, setGymEquipment] = useState<string[] | null>(null)
  // The harvested exercise videos (E5-T7), keyed by library id; loaded once alongside the
  // library so the detail overlay can show one when it has it.
  const [videos, setVideos] = useState<Map<string, Video>>(new Map())

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
        const gymEquipmentList = storageAvailable ? await getGymEquipment() : null
        // Loaded here rather than lazily on the Exercises tab (E5-T3's original scheme), so the
        // in-app detail overlay (E5-T8) and the ranked alternatives overlay (E5-T12) can open
        // from a set screen too, without waiting on a fetch mid-session.
        const loadedLibrary = await loadLibrary()
        const loadedVideos = await loadVideos()

        if (cancelled) return
        setSession(inProgress)
        setView(inProgress ? 'list' : 'picker')
        setLibrary([...loadedLibrary.values()])
        setGymEquipment(gymEquipmentList)
        setVideos(loadedVideos)
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

  // The backup-due marker the Settings tab carries in the nav, computed once here so the tab
  // bar and the Settings screen's own `BackupBadge` never disagree about whether one is due.
  const settingsBadge = isBackupDue(lastExportedAt, Date.now())

  // Keyed the same way `loadLibrary()` hands it out, so `resolveExercise` (E5-T6) can answer a
  // swapped-in library id (E5-T12) the same way it answers every other caller.
  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))

  /** `ExerciseList.resolve`: a catalog id or a library id (a swap, E5-T12) to its `Exercise`. */
  function resolveListExercise(id: string): Exercise | undefined {
    return resolveExercise(id, catalog, libraryMap)
  }

  /**
   * `SetScreen.onOpenAlternatives`: opens the ranked alternatives overlay (E5-T12) for the plan
   * behind `exerciseId` on screen, matched back to its planned id through `session.swaps` when
   * the screen already shows a swapped-in exercise.
   */
  function handleOpenAlternatives(exerciseId: string): void {
    if (!session) return
    setOverlay({ kind: 'alternatives', plannedId: plannedExerciseIdFor(session, exerciseId) })
  }

  /**
   * `AlternativesList.onChoose`: records the swap for the session in progress, closes the
   * overlay and returns to the exercise list, which is where the swapped-in exercise's own row
   * now lives. `session` is updated in place with the swap `setSwap` just wrote, so the list
   * reflects it without a re-fetch.
   */
  function handleChooseAlternative(plannedId: string, chosenId: string): void {
    if (!session) return
    setSwap(session.id, plannedId, chosenId)
      .then(() => {
        setSession((current) =>
          current ? { ...current, swaps: { ...current.swaps, [plannedId]: chosenId } } : current,
        )
        setOverlay(null)
        setOpenSet(null)
        setView('list')
      })
      .catch(() => {
        // Nothing was recorded; the overlay stays open so the trainee can try again.
      })
  }

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

  /** Hands the browser a backup of everything logged so far. */
  function handleExport(): void {
    exportBackup(Date.now())
      .then(async (file) => {
        await downloadOrShare(file)
        setState((current) =>
          current.status === 'ready' ? { ...current, lastExportedAt: file.exportedAt } : current,
        )
      })
      .catch(() => {
        // Nothing was written; the settings screen stays up with nothing to undo.
      })
  }

  /**
   * Reads and counts the chosen backup file so the trainee can see what importing it would
   * do before anything is written, or says why it cannot be read at all.
   */
  function handleImportFile(text: string): void {
    let incoming: Session[]
    try {
      incoming = readBackup(text).sessions
    } catch (error) {
      setPendingImport(null)
      setImportError(
        error instanceof BackupFormatError ? error.message : 'backup file could not be read',
      )
      return
    }

    listSessions()
      .then((current) => {
        setImportError(null)
        setPendingImport({
          text,
          currentCount: current.length,
          incomingCount: incoming.length,
          plan: importPlan(current, incoming),
        })
      })
      .catch(() => {
        // Without the sessions on the phone the confirmation would name the wrong counts.
      })
  }

  /** Replaces the whole database with the file already read into `pendingImport`. */
  function handleImportConfirm(): void {
    if (!pendingImport) return
    const { text } = pendingImport
    setPendingImport(null)
    importBackup(text).catch(() => {
      setImportError('the backup could not be imported')
    })
  }

  /** Shows the Exercises tab; the library itself is loaded once, up front, on mount. */
  function handleShowExercises(): void {
    setView('exercises')
  }

  /** Opens the in-app detail overlay for `libraryId`, optionally headed by a different name. */
  function handleOpenInfo(libraryId: string, heading?: string): void {
    setOverlay({ kind: 'detail', libraryId, heading })
  }

  /**
   * `SetScreen.onOpenInfo`: opens the overlay for the catalog exercise on screen, headed by its
   * own catalog name (e.g. "Deadlift") rather than the library entry's own name (e.g. "Barbell
   * Deadlift"), which can differ.
   */
  function handleOpenInfoForExercise(exerciseId: string): void {
    const exercise = catalog.get(exerciseId)
    if (!exercise) return
    handleOpenInfo(exercise.libraryId, exercise.name)
  }

  /**
   * Moves to the tab that was pressed. History goes through `handleShowHistory`, and Exercises
   * through `handleShowExercises`, so their data is loaded before the list they feed is shown.
   */
  function handleTabChange(tab: Tab): void {
    if (tab === 'history') {
      handleShowHistory()
      return
    }
    if (tab === 'exercises') {
      handleShowExercises()
      return
    }
    setView(tab === 'workout' ? 'picker' : 'settings')
  }

  // Built up by whichever view branch below matches, then rendered once at the end alongside
  // the detail overlay -- rather than each branch returning straight away -- so the overlay can
  // sit over the current view's own JSX without unmounting it (E5-T8).
  let content: JSX.Element | null = null

  if (content === null && view === 'settings') {
    content = (
      <AppShell
        title="Settings"
        tab={tabFor(view)}
        onTabChange={handleTabChange}
        trailing={trailing}
        settingsBadge={settingsBadge}
      >
        <Settings
          programs={programs}
          activeProgramId={activeProgramId}
          onActiveProgramChange={handleActiveProgramChange}
          onExport={handleExport}
          onImportFile={handleImportFile}
        />
        <BackupBadge lastExportedAt={lastExportedAt} now={Date.now()} />
        {importError ? <div role="alert">{importError}</div> : null}
        {pendingImport ? (
          <ImportConfirm
            currentCount={pendingImport.currentCount}
            incomingCount={pendingImport.incomingCount}
            plan={pendingImport.plan}
            onConfirm={handleImportConfirm}
            onCancel={() => setPendingImport(null)}
          />
        ) : null}
      </AppShell>
    )
  }

  // A session whose program has since been retired has nowhere to be shown; the picker is
  // what is left.
  const located = session ? locateSession(programs, session) : null

  if (content === null && view === 'set' && session && located && openSet) {
    // A swapped-in exercise's set screen (E5-T12): `openSet.exerciseId` is the *done* id, which
    // is not in `workout.exercises` (that still lists the planned id) -- matched back to its
    // `ExercisePlan` through `session.swaps`, so the swapped-in exercise still opens with the
    // plan's own sets, rep range and rest. `resolveListExercise` answers the done id's own
    // `Exercise` either way, catalog or library (E5-T6).
    const plannedId = plannedExerciseIdFor(session, openSet.exerciseId)
    const plan = located.workout.exercises.find((candidate) => candidate.exerciseId === plannedId)
    const exercise = resolveListExercise(openSet.exerciseId)
    if (plan && exercise) {
      content = (
        // No tab prop: a set being logged is inside the session, and the way out of it is the
        // back control to the exercise list. The screen fills the action bar itself, because
        // "Log set" is gated by the set on its dials, which is the screen's own state.
        <AppShell
          title={exercise.name}
          onBack={() => setView('list')}
          action={<ActionBarSlot />}
          trailing={trailing}
        >
          {/* Keyed by the set, so opening another set -- or an extra one past the plan --
              opens it preset afresh, while logging within one set screen leaves it standing. */}
          <SetScreen
            key={`${openSet.exerciseId}#${openSet.setIndex}`}
            exercise={exercise}
            plan={plan}
            setIndex={openSet.setIndex}
            sessionId={session.id}
            lastEntries={presetHistory(openSet.history, session, openSet.exerciseId)}
            onLogged={(logged) => setSession(logged)}
            onAddSet={handleAddSet}
            onOpenInfo={handleOpenInfoForExercise}
            onOpenAlternatives={handleOpenAlternatives}
          />
        </AppShell>
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

  if (content === null && view === 'list' && session && located) {
    content = (
      // The header names the workout that is on, the action bar holds the one action that ends
      // it, and there is no tab bar: backing out of a session is the back control's job, and it
      // leaves the session in progress to come back to.
      <AppShell
        title={located.workout.name}
        onBack={() => setView('picker')}
        action={
          <button type="button" onClick={handleFinish}>
            Finish workout
          </button>
        }
        trailing={trailing}
      >
        <ExerciseList
          program={located.program}
          workout={located.workout}
          resolve={resolveListExercise}
          session={session}
          onOpenSet={handleOpenSet}
          onFinish={handleFinish}
        />
      </AppShell>
    )
  }

  if (content === null && view === 'history') {
    content = (
      <AppShell
        title="History"
        tab={tabFor(view)}
        onTabChange={handleTabChange}
        trailing={trailing}
        settingsBadge={settingsBadge}
      >
        <HistoryList sessions={history} programs={programs} />
      </AppShell>
    )
  }

  if (content === null && view === 'exercises') {
    // Every distinct raw `equipment` string in the library, sorted, with a `'none'` sentinel
    // standing in for the exercises free-exercise-db gives no equipment at all.
    const libraryEquipmentOptions = Array.from(
      new Set(library.map((exercise) => exercise.equipment)),
    )
      .sort((a, b) => {
        if (a === null) return 1
        if (b === null) return -1
        return a.localeCompare(b)
      })
      .map((equipment) => equipment ?? 'none')

    const search = librarySearch.trim().toLowerCase()
    const filteredLibrary = library.filter((exercise) => {
      const matchesSearch = search === '' || exercise.name.toLowerCase().includes(search)
      const matchesMuscle =
        libraryMuscle === '' || exercise.primaryMuscles.includes(libraryMuscle as Muscle)
      const matchesEquipment =
        libraryEquipment === ''
          ? true
          : libraryEquipment === 'none'
            ? exercise.equipment === null
            : exercise.equipment === libraryEquipment

      return matchesSearch && matchesMuscle && matchesEquipment
    })

    content = (
      <AppShell
        title="Exercises"
        tab={tabFor(view)}
        onTabChange={handleTabChange}
        trailing={trailing}
        settingsBadge={settingsBadge}
      >
        <input
          type="search"
          aria-label="Search exercises"
          value={librarySearch}
          onChange={(event) => setLibrarySearch(event.target.value)}
        />
        <select
          aria-label="Muscle"
          value={libraryMuscle}
          onChange={(event) => setLibraryMuscle(event.target.value)}
        >
          <option value="">All muscles</option>
          {MUSCLES.map((muscle) => (
            <option key={muscle} value={muscle}>
              {muscle}
            </option>
          ))}
        </select>
        <select
          aria-label="Equipment"
          value={libraryEquipment}
          onChange={(event) => setLibraryEquipment(event.target.value)}
        >
          <option value="">All equipment</option>
          {libraryEquipmentOptions.map((equipment) => (
            <option key={equipment} value={equipment}>
              {equipment}
            </option>
          ))}
        </select>
        {filteredLibrary.length === 0 ? (
          <p>No exercises match</p>
        ) : (
          <LibraryList library={filteredLibrary} onOpen={handleOpenInfo} />
        )}
      </AppShell>
    )
  }

  if (content === null) {
    content = (
      <AppShell
        title="Workout"
        tab={tabFor('picker')}
        onTabChange={handleTabChange}
        trailing={trailing}
        settingsBadge={settingsBadge}
      >
        {!storageAvailable ? <StorageUnavailableBanner /> : null}
        {staleActiveProgramNotice ? (
          <p>The saved active program no longer exists; showing the first program instead.</p>
        ) : null}
        <BackupBadge lastExportedAt={lastExportedAt} now={Date.now()} />
        {session && located ? (
          <ResumeCard
            programName={located.program.name}
            workoutName={located.workout.name}
            onResume={() => handleChoose(session.programId, session.workoutId)}
          />
        ) : null}
        <fieldset disabled={!storageAvailable}>
          <ProgramPicker
            programs={programs}
            catalog={catalog}
            activeProgramId={activeProgramId}
            onChoose={handleChoose}
          />
        </fieldset>
      </AppShell>
    )
  }

  // The detail overlay's entry, looked up from the already-loaded library by the id the
  // overlay was opened with; `null` while the entry cannot be found (the library has not
  // finished loading yet, or, in principle, a stale/bad id), in which case the overlay simply
  // does not render rather than showing a broken screen.
  const overlayEntry =
    overlay?.kind === 'detail' ? library.find((entry) => entry.id === overlay.libraryId) ?? null : null
  const catalogLibraryIds = new Set(
    Array.from(catalog.values(), (exercise) => exercise.libraryId),
  )

  // The alternatives overlay's target (E5-T12): the planned exercise's own library entry, so
  // `alternativesFor` ranks against the same profile the plan actually prescribes -- `null`
  // while it cannot be resolved (the library or catalog have not finished loading yet).
  const alternativesTarget: LibraryExercise | null =
    overlay?.kind === 'alternatives'
      ? (() => {
          const plannedExercise = resolveListExercise(overlay.plannedId)
          return plannedExercise ? libraryMap.get(plannedExercise.libraryId) ?? null : null
        })()
      : null

  return (
    <>
      {content}
      {overlay?.kind === 'detail' && overlayEntry ? (
        <ExerciseDetail
          entry={overlayEntry}
          video={videos.get(overlayEntry.id)}
          heading={overlay.heading}
          photos={photoUrls(overlayEntry, catalogLibraryIds, import.meta.env.BASE_URL)}
          onBack={() => setOverlay(null)}
        />
      ) : null}
      {overlay?.kind === 'alternatives' && alternativesTarget ? (
        <AlternativesList
          target={alternativesTarget}
          library={libraryMap}
          gymEquipment={gymEquipment}
          onChoose={(chosenId) => handleChooseAlternative(overlay.plannedId, chosenId)}
          onOpenDetail={handleOpenInfo}
        />
      ) : null}
    </>
  )
}
