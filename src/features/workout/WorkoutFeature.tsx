import { useEffect, useState } from 'react'
import { assertPlansAreInCatalog } from '../../data/catalog'
import { resolveExercise } from '../../data/resolve'
import { nextExerciseAfter } from '../../domain/flow'
import { familyOf } from '../../domain/muscles'
import { latestSet } from '../../domain/rest'
import { ServiceError } from '../../services'
import type {
  Exercise,
  LibraryExercise,
  Program,
  Session,
  SetEntry,
  VolumeBaseline,
  Workout,
} from '../../types'
import { ActionBarSlot, AppShell } from '../../ui/AppShell'
import { BackupBadge } from '../../ui/BackupBadge'
import { ElapsedTime } from '../../ui/ElapsedTime'
import { ExerciseList } from '../../ui/ExerciseList'
import { NoProgram } from '../../ui/NoProgram'
import { ResumeCard } from '../../ui/ResumeCard'
import { SessionSummary } from '../../ui/SessionSummary'
import { SetScreen } from '../../ui/SetScreen'
import { StorageUnavailableBanner } from '../../ui/StorageUnavailableBanner'
import { WorkoutStartButtons } from '../../ui/WorkoutStartButtons'
import { AlternativesOverlay } from '../overlays/AlternativesOverlay'
import { DetailOverlay } from '../overlays/DetailOverlay'
import type { AppRoute } from '../routes'
import { useServices, useSyncControls } from '../ServicesProvider'
import { useServiceData } from '../useServiceData'

export type WorkoutFeatureProps = {
  /** Sends the app to another tab: the Program tab from "Choose a program", Exercises from a summary. */
  navigate(to: AppRoute): void
  /** Told `true` on the exercise list and set screen, `false` on the picker. */
  onInSession(inSession: boolean): void
  /**
   * Whether a Session in progress opens straight into its exercise list (the app's launch), or
   * the picker offers resuming it (the tab reached again later). Defaults to `true`.
   */
  landInSession?: boolean
}

type View = 'picker' | 'list' | 'set'

/**
 * The set the set screen is on, with the history it was opened against, and whether "Add set"
 * opened it as an extra set past the plan (E6-T1).
 */
type OpenSet = {
  exerciseId: string
  setIndex: number
  history: SetEntry[]
  extra: boolean
  weightStep: number | null
}

/** The detail overlay (E5-T8, E5-T15) or the ranked alternatives overlay (E5-T12). */
type Overlay =
  | { kind: 'detail'; libraryId: string; heading?: string; plannedId?: string }
  | { kind: 'alternatives'; plannedId: string }

/** The Programs the picker offers, and whether storage could be read at all. */
type ProgramsView = {
  programs: Program[]
  activeProgramId: string | null
  staleActiveProgramNotice: boolean
  storageAvailable: boolean
}

/** The session in progress when the tab opened, with its list's "Last time" and bars. */
type Resumed = {
  session: Session | null
  lastSwaps: Record<string, string>
  lastEntries: Map<string, SetEntry[]>
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
 * The workout plan's own `exerciseId` for `exerciseId` on screen: itself, or the plan whose
 * recorded swap (`session.swaps`) is `exerciseId` (E5-T12).
 */
function plannedExerciseIdFor(session: Session, exerciseId: string): string {
  const swapped = Object.entries(session.swaps ?? {}).find(([, doneId]) => doneId === exerciseId)
  return swapped ? swapped[0] : exerciseId
}

/**
 * `catalog` plus every library Exercise a Program's Plan points at (E9-T9), so a Program built
 * from the library passes `assertPlansAreInCatalog`.
 */
function withProgramExercises(
  catalog: Map<string, Exercise>,
  programs: Program[],
  library: Map<string, LibraryExercise>,
): Map<string, Exercise> {
  const extended = new Map(catalog)
  for (const program of programs) {
    for (const workout of program.workouts) {
      for (const plan of workout.exercises) {
        if (extended.has(plan.exerciseId)) continue
        const exercise = resolveExercise(plan.exerciseId, catalog, library)
        if (exercise) extended.set(plan.exerciseId, exercise)
      }
    }
  }
  return extended
}

/** A read that answers `fallback` when storage cannot answer, as `App.tsx` does. */
function orElse<T>(read: Promise<T>, fallback: T): Promise<T> {
  return read.catch(() => fallback)
}

/**
 * The Workout tab as its own container over the services (E11-T10, O9): the picker, the
 * exercise list and set screen of the Session in progress, the swap overlays and the summary.
 * A Session in progress wins on mount, so reopening the tab lands back in it.
 */
export function WorkoutFeature({
  navigate,
  onInSession,
  landInSession = true,
}: WorkoutFeatureProps): JSX.Element {
  const services = useServices()
  const { syncNow } = useSyncControls()

  const catalogData = useServiceData((s) => s.catalog.load(), [])
  const programsData = useServiceData<ProgramsView>(async (s) => {
    try {
      const loaded = await s.programs.load()
      return {
        programs: loaded.programs,
        activeProgramId: loaded.activeProgramId,
        staleActiveProgramNotice: loaded.staleActiveProgramNotice,
        storageAvailable: true,
      }
    } catch (error) {
      if (!(error instanceof ServiceError) || error.code !== 'storage-unavailable') throw error
      // Storage cannot be read: the bundled Programs are shown, and nothing can be started.
      const { bundledPrograms } = await s.catalog.load()
      return {
        programs: bundledPrograms,
        activeProgramId: bundledPrograms[0]?.id ?? null,
        staleActiveProgramNotice: false,
        storageAvailable: false,
      }
    }
  }, ['programs'])
  const gymEquipmentData = useServiceData(
    (s) => orElse(s.preferences.gymEquipment(), null),
    ['preferences'],
  )
  const lastExportedAtData = useServiceData(
    (s) => orElse(s.preferences.lastExportedAt(), null),
    ['preferences'],
  )
  const volumeBaselineData = useServiceData(
    (s) => orElse<VolumeBaseline>(s.preferences.volumeBaseline(), { period: 'last' }),
    ['preferences'],
  )
  const sessionsData = useServiceData(
    (s) => orElse<Session[]>(s.sessions.list(), []),
    ['sessions'],
  )

  const [resumed, setResumed] = useState(false)
  const [view, setView] = useState<View>('picker')
  const [session, setSession] = useState<Session | null>(null)
  const [openSet, setOpenSet] = useState<OpenSet | null>(null)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [summarySession, setSummarySession] = useState<Session | null>(null)
  const [lastSwaps, setLastSwaps] = useState<Record<string, string>>({})
  const [lastEntries, setLastEntries] = useState<Map<string, SetEntry[]>>(new Map())

  const loadedPrograms = programsData.status === 'ready' ? programsData.data.programs : null

  // Once the Programs are known, the Session in progress (if any) is resumed, with the
  // "Last time" swaps and progression bars its list shows. Only once: later changes to the
  // Programs do not move the trainee.
  useEffect(() => {
    if (loadedPrograms === null || resumed) return
    let cancelled = false

    async function resume(programs: Program[]): Promise<Resumed> {
      const inProgress = await services.sessions.resumeActive()
      return {
        session: inProgress,
        lastSwaps: await services.sessions.lastSwapsForSession(inProgress, programs),
        lastEntries: await services.sessions.lastEntriesForSession(inProgress, programs),
      }
    }

    resume(loadedPrograms)
      .catch((): Resumed => ({ session: null, lastSwaps: {}, lastEntries: new Map() }))
      .then((found) => {
        if (cancelled) return
        setSession(found.session)
        setLastSwaps(found.lastSwaps)
        setLastEntries(found.lastEntries)
        setView(found.session && landInSession ? 'list' : 'picker')
        setResumed(true)
      })
    return () => {
      cancelled = true
    }
  }, [services, loadedPrograms, resumed, landInSession])

  const programs = loadedPrograms ?? []
  // A session whose program has since been retired has nowhere to be shown; the picker is
  // what is left.
  const located = session ? locateSession(programs, session) : null
  const inSession = resumed && located !== null && (view === 'list' || view === 'set')

  useEffect(() => {
    onInSession(inSession)
  }, [inSession, onInSession])

  if (catalogData.status === 'error' || programsData.status === 'error') {
    const error = catalogData.status === 'error' ? catalogData.error : programsData.error
    return (
      <div role="alert">
        Could not load the workout programs: {error instanceof Error ? error.message : String(error)}
      </div>
    )
  }

  if (catalogData.status !== 'ready' || programsData.status !== 'ready' || !resumed) {
    return <div />
  }

  const { catalog, library, videos } = catalogData.data
  const { activeProgramId, staleActiveProgramNotice, storageAvailable } = programsData.data
  const gymEquipment = gymEquipmentData.status === 'ready' ? gymEquipmentData.data : null
  const lastExportedAt = lastExportedAtData.status === 'ready' ? lastExportedAtData.data : null
  const volumeBaseline: VolumeBaseline =
    volumeBaselineData.status === 'ready' ? volumeBaselineData.data : { period: 'last' }
  const sessions = sessionsData.status === 'ready' ? sessionsData.data : []

  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))

  /** `ExerciseList.resolve`: a catalog id or a library id (a swap, E5-T12) to its `Exercise`. */
  function resolveListExercise(id: string): Exercise | undefined {
    return resolveExercise(id, catalog, libraryMap)
  }

  /** Adds the last entries of `doneId`, just swapped in, to the list's progression bars. */
  function loadLastEntriesOf(doneId: string): void {
    services.sessions
      .lastEntriesFor(doneId)
      .then((entries) => {
        setLastEntries((current) => new Map(current).set(doneId, entries))
      })
      .catch(() => {
        // No history for the bar; the row still shows and opens as before.
      })
  }

  /** Records `plannedId` swapped for `doneId` on the Session in progress, in place. */
  function applySwap(plannedId: string, doneId: string): Promise<void> {
    if (!session) return Promise.reject(new Error('no session in progress'))
    return services.sessions.applySwap(session.id, plannedId, doneId).then(() => {
      setSession((current) =>
        current ? { ...current, swaps: { ...current.swaps, [plannedId]: doneId } } : current,
      )
      loadLastEntriesOf(doneId)
    })
  }

  /** `AlternativesOverlay.onPick`: swaps, closes the overlay and returns to the exercise list. */
  function handleChooseAlternative(plannedId: string, chosenId: string): void {
    applySwap(plannedId, chosenId)
      .then(() => {
        setOverlay(null)
        setOpenSet(null)
        setView('list')
      })
      .catch(() => {
        // Nothing was recorded; the overlay stays open so the trainee can try again.
      })
  }

  /** `DetailOverlay.onSwap`, opened from a live set (E5-T15): swaps and closes the overlay. */
  function handleChooseFromDetail(plannedId: string, chosenId: string): void {
    applySwap(plannedId, chosenId)
      .then(() => setOverlay(null))
      .catch(() => {
        // Nothing was recorded; the overlay stays open so the trainee can try again.
      })
  }

  /** `ExerciseList.onApplySwap`: applies last time's swap of `plannedId` to this session. */
  function handleApplySwap(plannedId: string, doneId: string): void {
    applySwap(plannedId, doneId).catch(() => {
      // Nothing was recorded; the "Last time" offer stays so the trainee can try again.
    })
  }

  /** `ExerciseList.onUndoSwap`: removes today's swap of `plannedId`. */
  function handleUndoSwap(plannedId: string): void {
    if (!session) return
    services.sessions
      .undoSwap(session.id, plannedId)
      .then(() => {
        setSession((current) => {
          if (!current) return current
          const swaps = { ...current.swaps }
          delete swaps[plannedId]
          return { ...current, swaps }
        })
      })
      .catch(() => {
        // The swap stands; the list keeps showing it as it is stored.
      })
  }

  /** Starts the chosen workout, or resumes the session already in progress, and lists it. */
  function handleChoose(programId: string, workoutId: string): void {
    services.sessions
      .start(programId, workoutId)
      .then(async (started) => {
        const startedLastSwaps = await services.sessions.lastSwapsForSession(started, programs)
        const startedLastEntries = await services.sessions.lastEntriesForSession(started, programs)
        setSession(started)
        setLastSwaps(startedLastSwaps)
        setLastEntries(startedLastEntries)
        setOpenSet(null)
        setView('list')
      })
      .catch(() => {
        // The picker stays up; nothing was started, so there is nothing to undo.
      })
  }

  /** Opens a set of an exercise, against what that exercise was last lifted with. */
  function handleOpenSet(exerciseId: string, setIndex: number): void {
    Promise.all([
      services.sessions.lastEntriesFor(exerciseId),
      services.preferences.weightStep(exerciseId),
    ])
      .then(([history, weightStep]) => {
        setOpenSet({ exerciseId, setIndex, history, extra: false, weightStep })
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
        ? { ...current, setIndex: nextSetIndex, extra: true }
        : current,
    )
  }

  /** Finishes the session in progress, then returns to the picker under its summary (M16). */
  function handleFinish(): void {
    if (!session) return
    services.sessions
      .finish(session.id)
      .then((finished) => {
        setSession(null)
        setOpenSet(null)
        setView('picker')
        setSummarySession(finished)
        // Not awaited: finishing never waits on the sync it starts.
        void syncNow()
      })
      .catch(() => {
        // The list stays up; nothing was cleared, so there is nothing to undo.
      })
  }

  /** `ExerciseList.onSaveNote`: stores the Session note; empty removes it (E14-T4). */
  async function handleSaveNote(text: string): Promise<void> {
    if (!session) return
    setSession(await services.sessions.setNote(session.id, text))
    void syncNow()
  }

  /** `ExerciseList.onDiscard`: discards the Session in progress and returns to the picker. */
  function handleDiscard(): void {
    if (!session) return
    services.sessions
      .discard(session.id)
      .then(() => {
        setSession(null)
        setOpenSet(null)
        setView('picker')
        void syncNow()
      })
      .catch(() => {
        // The list stays up; nothing was discarded.
      })
  }

  /** `SetScreen.onOpenInfo`: the detail overlay for the catalog exercise on screen (E5-T15). */
  function handleOpenInfoForExercise(exerciseId: string): void {
    const exercise = catalog.get(exerciseId)
    if (!exercise) return
    const plannedId = session ? plannedExerciseIdFor(session, exerciseId) : exerciseId
    setOverlay({ kind: 'detail', libraryId: exercise.libraryId, heading: exercise.name, plannedId })
  }

  /** `SetScreen.onOpenAlternatives`: the ranked alternatives for the plan behind `exerciseId`. */
  function handleOpenAlternatives(exerciseId: string): void {
    if (!session) return
    setOverlay({ kind: 'alternatives', plannedId: plannedExerciseIdFor(session, exerciseId) })
  }

  /** Opens the plain detail overlay for `libraryId`, offering no swap. */
  function handleOpenDetail(libraryId: string): void {
    setOverlay({ kind: 'detail', libraryId })
  }

  let content: JSX.Element | null = null

  if (view === 'set' && session && located && openSet) {
    const plannedId = plannedExerciseIdFor(session, openSet.exerciseId)
    const plan = located.workout.exercises.find((candidate) => candidate.exerciseId === plannedId)
    const exercise = resolveListExercise(openSet.exerciseId)
    if (plan && exercise) {
      const primaryMuscle = libraryMap.get(exercise.libraryId)?.primaryMuscles[0]
      const family = primaryMuscle === undefined ? undefined : familyOf(primaryMuscle)
      // Rest is Session-wide: it follows the Session's latest Set, by its own Exercise's Plan rest.
      const latest = latestSet(session.entries)
      const latestPlan =
        latest === null
          ? undefined
          : located.workout.exercises.find(
              (candidate) =>
                candidate.exerciseId === plannedExerciseIdFor(session, latest.exerciseId),
            )
      const restFrom =
        latest === null || latestPlan === undefined
          ? null
          : { entry: latest, planRestSeconds: latestPlan.restSeconds }
      const nextId = nextExerciseAfter(located.workout, session, openSet.exerciseId)
      const nextName = nextId === null ? null : (resolveListExercise(nextId)?.name ?? null)
      content = (
        <AppShell title={exercise.name} onBack={() => setView('list')} action={<ActionBarSlot />}>
          <ElapsedTime startedAt={session.startedAt} />
          <SetScreen
            key={`${openSet.exerciseId}#${openSet.setIndex}`}
            exercise={exercise}
            plan={plan}
            setIndex={openSet.setIndex}
            sessionId={session.id}
            lastEntries={services.sessions.presetHistory(
              openSet.history,
              session,
              openSet.exerciseId,
            )}
            lastTime={openSet.history}
            sessionStartedAt={session.startedAt}
            extra={openSet.extra}
            weightStep={openSet.weightStep}
            onWeightStepChange={(step) => {
              services.preferences.setWeightStep(openSet.exerciseId, step).catch(() => {
                // Nothing to recover to here; the screen keeps the step it already has.
              })
            }}
            family={family}
            earlierSessions={sessions.filter(
              (earlier) => earlier.finishedAt !== null && earlier.startedAt < session.startedAt,
            )}
            logged={session.entries.filter((entry) => entry.exerciseId === openSet.exerciseId)}
            onEditSet={async (setIndex, values) => {
              setSession(
                await services.sessions.updateSet(session.id, openSet.exerciseId, setIndex, values),
              )
            }}
            onDeleteSet={async (setIndex) => {
              const { session: updated, removed } = await services.sessions.deleteSet(
                session.id,
                openSet.exerciseId,
                setIndex,
              )
              setSession(updated)
              return removed
            }}
            onRestoreSet={async (entry) => {
              setSession(await services.sessions.restoreSet(session.id, entry))
            }}
            restFrom={restFrom}
            onSetRest={async (entry, restSeconds) => {
              setSession(
                await services.sessions.setRest(
                  session.id,
                  entry.exerciseId,
                  entry.setIndex,
                  restSeconds,
                ),
              )
            }}
            programName={located.program.name}
            onUseRestForExercise={async (restSeconds) => {
              // The Plan this Exercise sits under -- a swap writes the Plan it was swapped
              // under -- in the Session's Program; a bundled Program becomes the user's copy.
              const { programs: current, userPrograms } = await services.programs.load()
              const program = current.find((candidate) => candidate.id === session.programId)
              if (program === undefined) throw new Error('The Program is gone')
              const stored = userPrograms.find((candidate) => candidate.id === program.id)
              await services.programs.save({
                ...program,
                workouts: program.workouts.map((workout) =>
                  workout.id !== session.workoutId
                    ? workout
                    : {
                        ...workout,
                        exercises: workout.exercises.map((candidate) =>
                          candidate.exerciseId === plannedId
                            ? { ...candidate, restSeconds }
                            : candidate,
                        ),
                      },
                ),
                createdAt: stored?.createdAt ?? Date.now(),
              })
            }}
            onLog={(id, entry) => services.sessions.logSet(id, entry)}
            onLogged={(logged) => {
              setSession(logged)
              setOpenSet((current) => (current ? { ...current, extra: false } : current))
            }}
            onAddSet={handleAddSet}
            onOpenInfo={handleOpenInfoForExercise}
            onOpenAlternatives={handleOpenAlternatives}
            upNext={nextName}
            onFinishExercise={() => {
              if (nextId === null) {
                setView('list')
                return
              }
              const loggedNext = session.entries.filter(
                (entry) => entry.exerciseId === nextId,
              ).length
              handleOpenSet(nextId, loggedNext + 1)
            }}
          />
        </AppShell>
      )
    }
  }

  if (content === null && view === 'list' && session && located) {
    content = (
      <AppShell
        title={located.workout.name}
        onBack={() => setView('picker')}
        action={
          <button type="button" className="finish-workout" onClick={handleFinish}>
            Finish workout
          </button>
        }
      >
        <ElapsedTime startedAt={session.startedAt} />
        <ExerciseList
          program={located.program}
          workout={located.workout}
          resolve={resolveListExercise}
          session={session}
          onOpenSet={handleOpenSet}
          onFinish={handleFinish}
          lastSwaps={lastSwaps}
          lastEntries={lastEntries}
          onUndoSwap={handleUndoSwap}
          onApplySwap={handleApplySwap}
          sessions={sessions}
          volumeBaseline={volumeBaseline}
          onDiscard={handleDiscard}
          note={session.note}
          onSaveNote={handleSaveNote}
        />
      </AppShell>
    )
  }

  if (content === null) {
    // Fail before anything renders, so a program referencing an id the catalog lacks leaves no
    // half-built Workout tab behind.
    const programCatalog = withProgramExercises(catalog, programs, libraryMap)
    for (const program of programs) assertPlansAreInCatalog(program, programCatalog)
    const activeProgram =
      activeProgramId === null ? null : programs.find((program) => program.id === activeProgramId)
    if (activeProgram === undefined) {
      throw new Error(`no program ${activeProgramId} among the loaded programs`)
    }

    content = (
      <AppShell title="Workout">
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
        {activeProgram === null ? (
          <NoProgram onChooseProgram={() => navigate({ tab: 'program' })} />
        ) : (
          <fieldset className="workout-picker" disabled={!storageAvailable}>
            <WorkoutStartButtons
              program={activeProgram}
              onStart={(workoutId) => handleChoose(activeProgram.id, workoutId)}
            />
          </fieldset>
        )}
      </AppShell>
    )
  }

  return (
    <>
      {content}
      {overlay?.kind === 'detail' ? (
        <DetailOverlay
          libraryId={overlay.libraryId}
          heading={overlay.heading}
          plannedId={overlay.plannedId}
          catalog={catalog}
          library={library}
          videos={videos}
          gymEquipment={gymEquipment}
          onBack={() => setOverlay(null)}
          onOpenDetail={handleOpenDetail}
          onSwap={
            overlay.plannedId !== undefined
              ? (id) => handleChooseFromDetail(overlay.plannedId!, id)
              : undefined
          }
        />
      ) : null}
      {summarySession ? (
        <SessionSummary
          session={summarySession}
          resolve={resolveListExercise}
          library={libraryMap}
          earlierSessions={sessions.filter(
            (other) =>
              other.id !== summarySession.id &&
              other.finishedAt !== undefined &&
              other.startedAt < summarySession.startedAt,
          )}
          planFor={(exerciseId) =>
            programs
              .find((program) => program.id === summarySession.programId)
              ?.workouts.find((workout) => workout.id === summarySession.workoutId)
              ?.exercises.find((plan) => plan.exerciseId === exerciseId)
          }
          onClose={() => setSummarySession(null)}
          onBrowse={(muscles) => {
            setSummarySession(null)
            navigate({ tab: 'exercises', muscles })
          }}
        />
      ) : null}
      {overlay?.kind === 'alternatives' ? (
        <AlternativesOverlay
          plannedId={overlay.plannedId}
          catalog={catalog}
          library={library}
          gymEquipment={gymEquipment}
          onPick={(chosenId) => handleChooseAlternative(overlay.plannedId, chosenId)}
          onOpenDetail={handleOpenDetail}
          onClose={() => setOverlay(null)}
        />
      ) : null}
    </>
  )
}
