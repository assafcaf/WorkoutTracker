import { swapPreset } from '../../domain/swapPreset'
import { useEffect, useRef, useState } from 'react'
import { assertPlansAreInCatalog } from '../../data/catalog'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import { validateEntry } from '../../domain/dial'
import { nextExerciseAfter } from '../../domain/flow'
import { currentExerciseId, liveProgress, planFor } from '../../domain/liveProgress'
import { presetForSet } from '../../domain/prefill'
import { workingSets } from '../../domain/setKind'
import { formatSet } from '../../domain/setText'
import { isBarbell } from '../../domain/plates'
import { familyOf } from '../../domain/muscles'
import { latestSet, restLengthOf } from '../../domain/rest'
import { countsTowardStats } from '../../domain/setKind'
import { formatDay } from '../../domain/dates'
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
import { ActionBarSlot, AppShell, SettingsButton } from '../../ui/AppShell'
import { LiveHeader } from '../../ui/LiveHeader'
import type { LiveStatus } from '../../ui/LiveStrip'
import { BackupBadge } from '../../ui/BackupBadge'
import { ExerciseList } from '../../ui/ExerciseList'
import { NoProgram } from '../../ui/NoProgram'
import { ResumeCard } from '../../ui/ResumeCard'
import { SessionSummary } from '../../ui/SessionSummary'
import { SetScreen } from '../../ui/SetScreen'
import { StorageUnavailableBanner } from '../../ui/StorageUnavailableBanner'
import { WorkoutStartButtons } from '../../ui/WorkoutStartButtons'
import { ExerciseHistoryOverlay } from '../../ui/ExerciseHistoryOverlay'
import { LiveSessionBar } from '../../ui/live/LiveSessionBar'
import type { LiveView } from '../../ui/live/LiveSessionBar'
import { UpNextRows } from '../../ui/live/UpNextRows'
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
  /**
   * Whether the Dashboard is the screen showing (default `true`). `false` draws nothing while
   * no Live session is on screen, but keeps the session's place -- the exercise, the set --
   * for when the trainee returns to it.
   */
  shown?: boolean
  /** Whether the Live session is minimised to the app root's live strip (default `false`). */
  minimised?: boolean
  /**
   * The Live session header's chevron. Unset -- no app root to hold a live strip -- minimising
   * returns to the Dashboard's picker, which offers resuming the session.
   */
  onMinimise?(): void
  /** Brings a minimised Live session back on screen: resuming it, or starting a workout. */
  onRestore?(): void
  /** Told what the live strip shows while a session is in progress, and `null` once none is. */
  onLive?(status: LiveStatus | null): void
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
  exerciseNote: string | null
  /** What the Set presets from instead of `history`, for a swapped-in Exercise never logged. */
  seed?: SetEntry[]
  /** The Set the screen is on after logging, which its key (`setIndex`) does not follow. */
  liveSetIndex?: number
  /** A logged Set to open for editing: a done cell tapped in the All view. */
  editSetIndex?: number
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
 * The done id of the exercise the Live session is on: `current` while it still has planned
 * working Sets to log, else the next Plan after it with some left (`nextExerciseAfter`), else
 * null once every planned Set is in.
 */
function currentExerciseOf(workout: Workout, session: Session, current: string | null): string | null {
  if (current !== null) {
    const plan = workout.exercises.find(
      (candidate) => candidate.exerciseId === plannedExerciseIdFor(session, current),
    )
    const logged = session.entries.filter(
      (entry) => entry.exerciseId === current && countsTowardStats(entry),
    ).length
    if (plan !== undefined && logged < plan.sets) return current
  }
  return nextExerciseAfter(workout, session, current ?? '')
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
  shown = true,
  minimised = false,
  onMinimise,
  onRestore,
  onLive,
}: WorkoutFeatureProps): JSX.Element | null {
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
  const trackEffortData = useServiceData(
    (s) => orElse(s.preferences.trackEffort(), false),
    ['preferences'],
  )
  const plateInventoryData = useServiceData(
    (s) => orElse(s.preferences.plateInventory(), null),
    ['preferences'],
  )
  const bodyweightOverridesData = useServiceData(
    (s) => orElse<Record<string, boolean>>(s.preferences.bodyweightOverrides(), {}),
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
  const [historyFor, setHistoryFor] = useState<string | null>(null)
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

  // Minimising takes the set screen down; it comes back on the Set it had moved on to by
  // logging, not the one it was first opened on.
  useEffect(() => {
    if (!minimised) return
    setOpenSet((current) =>
      current && current.liveSetIndex !== undefined
        ? { ...current, setIndex: current.liveSetIndex, liveSetIndex: undefined, extra: false }
        : current,
    )
  }, [minimised])

  // What the live strip says, reported whenever it changes: the workout, its clock, the rest
  // after the latest Set and the set due next.
  let liveStatus: LiveStatus | null = null
  if (inSession && session && located && catalogData.status === 'ready') {
    const { catalog, library } = catalogData.data
    const libraryById = new Map(library.map((entry) => [entry.id, entry] as const))
    const latest = latestSet(session.entries)
    const latestPlan =
      latest === null
        ? undefined
        : located.workout.exercises.find(
            (candidate) => candidate.exerciseId === plannedExerciseIdFor(session, latest.exerciseId),
          )
    const nextId = currentExerciseOf(located.workout, session, openSet?.exerciseId ?? null)
    const nextName = nextId === null ? null : (resolveExercise(nextId, catalog, libraryById)?.name ?? nextId)
    const nextSet = session.entries.filter((entry) => entry.exerciseId === nextId).length + 1
    liveStatus = {
      workoutName: located.workout.name,
      startedAt: session.startedAt,
      restEndsAt:
        latest === null || latestPlan === undefined
          ? null
          : latest.loggedAt + restLengthOf(latest, latestPlan.restSeconds) * 1000,
      next: nextName === null ? null : `${nextName} · set ${nextSet}`,
    }
  }
  const liveKey = liveStatus === null ? '' : JSON.stringify(liveStatus)
  const latestLiveStatus = useRef(liveStatus)
  latestLiveStatus.current = liveStatus
  useEffect(() => {
    onLive?.(latestLiveStatus.current)
  }, [liveKey, onLive])

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
  const bodyweightOverrides =
    bodyweightOverridesData.status === 'ready' ? bodyweightOverridesData.data : {}

  /**
   * `ExerciseList.resolve`: a catalog id or a library id (a swap, E5-T12) to its `Exercise`, with
   * the trainee's Bodyweight override applied (E16-T13).
   */
  function resolveListExercise(id: string): Exercise | undefined {
    const exercise = resolveExercise(id, catalog, libraryMap)
    return exercise && applyBodyweight(exercise, bodyweightOverrides)
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

  /** Swaps, then opens the chosen Exercise's Set `setIndex` (E16-T12), keeping the trainee logging. */
  function swapAndOpen(plannedId: string, chosenId: string): void {
    const setIndex = openSet?.liveSetIndex ?? openSet?.setIndex ?? 1
    const planned = resolveListExercise(plannedId)
    const chosen = resolveListExercise(chosenId)
    const plan = located?.workout.exercises.find((candidate) => candidate.exerciseId === plannedId)
    if (!session || !planned || !chosen || !plan) return
    const today = session.entries.filter((entry) => entry.exerciseId === plannedId)
    Promise.all([
      services.sessions.lastEntriesFor(plannedId),
      services.sessions.lastEntriesFor(chosenId),
      services.preferences.weightStep(chosenId),
    ])
      .then(async ([plannedLast, chosenLast, weightStep]) => {
        await applySwap(plannedId, chosenId)
        const preset = swapPreset({ planned, chosen, plan, setIndex, plannedLast, chosenLast, today })
        const seed: SetEntry[] | undefined =
          chosenLast.length > 0
            ? undefined
            : [{ exerciseId: chosenId, setIndex: 1, ...preset, loggedAt: 0 }]
        setOverlay(null)
        setOpenSet({
          exerciseId: chosenId,
          setIndex,
          history: chosenLast,
          extra: false,
          weightStep,
          exerciseNote: null,
          seed,
        })
        setView('set')
        loadExerciseNote(chosenId)
      })
      .catch(() => {
        // Nothing was recorded; the overlay stays open so the trainee can try again.
      })
  }

  /** `AlternativesOverlay.onPick`: swaps and opens the chosen Exercise at the same Set. */
  function handleChooseAlternative(plannedId: string, chosenId: string): void {
    swapAndOpen(plannedId, chosenId)
  }

  /** `DetailOverlay.onSwap`, opened from a live set (E5-T15): swaps and opens it at the same Set. */
  function handleChooseFromDetail(plannedId: string, chosenId: string): void {
    swapAndOpen(plannedId, chosenId)
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
        onRestore?.()
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
        setOpenSet({ exerciseId, setIndex, history, extra: false, weightStep, exerciseNote: null })
        setView('set')
        loadExerciseNote(exerciseId)
      })
      .catch(() => {
        // Without the history the preset would be wrong; the list stays up instead.
      })
  }

  /** A done cell tapped in All: opens its Exercise on the Now view with that Set to edit. */
  function handleOpenLogged(exerciseId: string, setIndex: number): void {
    if (!session) return
    const logged = session.entries.filter((entry) => entry.exerciseId === exerciseId).length
    Promise.all([
      services.sessions.lastEntriesFor(exerciseId),
      services.preferences.weightStep(exerciseId),
    ])
      .then(([history, weightStep]) => {
        setOpenSet({
          exerciseId,
          setIndex: logged + 1,
          history,
          extra: false,
          weightStep,
          exerciseNote: null,
          editSetIndex: setIndex,
        })
        setView('set')
        loadExerciseNote(exerciseId)
      })
      .catch(() => {
        // The All view stays up; nothing was opened.
      })
  }

  /** The Set the All view's Log button logs: the current Exercise's next one, at its Preset. */
  function quickLogEntry(): { entry: SetEntry; position: number } | null {
    if (!session || !located) return null
    const id = currentExerciseId(located.workout, session)
    if (id === null) return null
    const plan = planFor(located.workout, session, id)
    const exercise = resolveListExercise(id)
    if (!plan || !exercise) return null
    const today = session.entries.filter((entry) => entry.exerciseId === id)
    const setIndex = today.length + 1
    const position = workingSets(today).length + 1
    const preset = presetForSet({
      exercise,
      plan,
      setIndex,
      lastEntries: lastEntries.get(id) ?? [],
      today,
    })
    const entry: SetEntry = {
      exerciseId: id,
      setIndex,
      weightKg: preset.weightKg,
      reps: preset.reps,
      ...(preset.loadKg ? { loadKg: preset.loadKg } : {}),
      loggedAt: 0,
      ...(plan.amrapLast === true && position === plan.sets ? { kind: 'amrap' as const } : {}),
    }
    return { entry, position }
  }

  /** The All view's Log button: one tap logs the pre-filled Set, a whole-Session put. */
  function handleQuickLog(): void {
    const next = quickLogEntry()
    if (!session || next === null) return
    if (!validateEntry(next.entry.weightKg, next.entry.reps, next.entry.loadKg).ok) return
    services.sessions
      .logSet(session.id, { ...next.entry, loggedAt: Date.now() })
      .then(setSession)
      .catch(() => {
        // Nothing was logged; the button stays for another try.
      })
  }

  /** Fills in the open set's Exercise note once it is read; the screen is already up. */
  function loadExerciseNote(exerciseId: string): void {
    services.preferences
      .exerciseNote(exerciseId)
      .then((exerciseNote) => {
        setOpenSet((current) =>
          current && current.exerciseId === exerciseId ? { ...current, exerciseNote } : current,
        )
      })
      .catch(() => {
        // Without the note the screen offers Add note; the set itself is unaffected.
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

  // The Exercise History overlay (E16-T7), over the Set screen; closing it changes nothing under it.
  let historyOverlay: JSX.Element | null = null
  if (historyFor !== null && session && located) {
    const historyPlan = located.workout.exercises.find(
      (candidate) => candidate.exerciseId === plannedExerciseIdFor(session, historyFor),
    )
    const historyExercise = resolveListExercise(historyFor)
    if (historyPlan && historyExercise) {
      historyOverlay = (
        <ExerciseHistoryOverlay
          exercise={historyExercise}
          sessions={sessions}
          plan={historyPlan}
          onClose={() => setHistoryFor(null)}
        />
      )
    }
  }

  // The Live session is on screen unless the trainee minimised it to the live strip.
  const liveOnScreen = inSession && !minimised

  /** The chevron: to the app root's live strip, or with no root to hold one, to the picker. */
  function handleMinimise(): void {
    if (onMinimise) onMinimise()
    else setView('picker')
  }

  /** "Now": the set the session is on -- the open exercise while it has sets left, else the next. */
  function handleNow(): void {
    if (!session || !located) return
    const current = openSet?.exerciseId ?? null
    const target =
      currentExerciseOf(located.workout, session, current) ??
      current ??
      located.workout.exercises[0]?.exerciseId ??
      null
    if (target === null) return
    const logged = session.entries.filter((entry) => entry.exerciseId === target).length
    handleOpenSet(target, logged + 1)
  }

  /** The Live session's header (S2/S3), with its Now | All switch under the row. */
  function liveHeader(liveSession: Session, workoutName: string, heading = true): JSX.Element {
    return (
      <LiveHeader
        workoutName={workoutName}
        heading={heading}
        startedAt={liveSession.startedAt}
        onMinimise={handleMinimise}
        onFinish={handleFinish}
      />
    )
  }
  // The Live session's projection line and its Now | All switch (Progress Dashboard S2/S3),
  // over both views of the Session in progress.
  const liveBar = (shown: LiveView): JSX.Element | null =>
    session && located ? (
      <LiveSessionBar
        progress={liveProgress({
          workout: located.workout,
          session,
          earlier: sessions,
          resolve: resolveListExercise,
        })}
        workoutName={located.workout.name}
        view={shown}
        onViewChange={(next) => {
          if (next === shown) return
          if (next === 'all') setView('list')
          else handleNow()
        }}
      />
    ) : null

  let content: JSX.Element | null = null

  if (liveOnScreen && view === 'set' && session && located && openSet) {
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
        <AppShell
          title={exercise.name}
          header={liveHeader(session, located.workout.name, false)}
          action={<ActionBarSlot />}
        >
          {liveBar('now')}
          <SetScreen
            key={`${openSet.exerciseId}#${openSet.setIndex}#${openSet.editSetIndex ?? ''}`}
            editSetIndex={openSet.editSetIndex}
            upcoming={
              <UpNextRows
                workout={located.workout}
                session={session}
                resolve={resolveListExercise}
                lastEntries={lastEntries}
                sessions={sessions}
                volumeBaseline={volumeBaseline}
                currentId={openSet.exerciseId}
                onOpen={handleOpenSet}
              />
            }
            exercise={exercise}
            plates={isBarbell(libraryMap.get(exercise.libraryId)) ? (plateInventoryData.status === 'ready' ? plateInventoryData.data : null) : null}
            plan={plan}
            setIndex={openSet.setIndex}
            sessionId={session.id}
            // Last time's Sets alone: today's reach the Preset apart, through `logged` (E16-T6).
            lastEntries={openSet.seed ?? openSet.history}
            lastTime={openSet.history}
            sessionStartedAt={session.startedAt}
            extra={openSet.extra}
            weightStep={openSet.weightStep}
            exerciseNote={openSet.exerciseNote}
            onSaveExerciseNote={async (text) => {
              await services.preferences.setExerciseNote(openSet.exerciseId, text)
              loadExerciseNote(openSet.exerciseId)
            }}
            onBodyweightChange={(value) =>
              services.preferences.setBodyweight(
                openSet.exerciseId,
                value,
                resolveExercise(openSet.exerciseId, catalog, libraryMap)?.bodyweight ?? false,
              )
            }
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
            trackEffort={trackEffortData.status === 'ready' && trackEffortData.data}
            onSetEffort={async (setIndex, rir) => {
              setSession(
                await services.sessions.setEffort(session.id, openSet.exerciseId, setIndex, rir),
              )
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
            onLogged={(logged, nextSetIndex) => {
              setSession(logged)
              setOpenSet((current) =>
                current ? { ...current, extra: false, liveSetIndex: nextSetIndex } : current,
              )
            }}
            onAddSet={handleAddSet}
            onOpenInfo={handleOpenInfoForExercise}
            onOpenAlternatives={handleOpenAlternatives}
            onOpenHistory={setHistoryFor}
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

  if (content === null && liveOnScreen && view === 'list' && session && located) {
    const quick = quickLogEntry()
    content = (
      <AppShell
        title={located.workout.name}
        header={liveHeader(session, located.workout.name)}
        action={
          quick === null ? undefined : (
            <button type="button" className="log-set btn-primary" onClick={handleQuickLog}>
              {`Log set ${quick.position} · ${formatSet(quick.entry)}`}
            </button>
          )
        }
      >
        {liveBar('all')}
        <ExerciseList
          currentId={currentExerciseId(located.workout, session)}
          onOpenLogged={handleOpenLogged}
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

  // Off the Dashboard with no Live session on screen, nothing is drawn; the session's place is
  // kept for the live strip to return to.
  if (content === null && !shown) return null

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
      <AppShell
        title="Dashboard"
        subtitle={formatDay(new Date(), new Date())}
        actions={<SettingsButton />}
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
            onResume={() =>
              minimised && onRestore
                ? onRestore()
                : handleChoose(session.programId, session.workoutId)
            }
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
      {liveOnScreen && overlay?.kind === 'detail' ? (
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
          workoutName={
            programs
              .find((program) => program.id === summarySession.programId)
              ?.workouts.find((workout) => workout.id === summarySession.workoutId)?.name
          }
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
      {liveOnScreen ? historyOverlay : null}
      {liveOnScreen && overlay?.kind === 'alternatives' ? (
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
