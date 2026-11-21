import type { Weekday } from '../../domain/stats/weeks'
import { swapSeed } from '../../domain/swapPreset'
import { useContext, useEffect, useRef, useState } from 'react'
import { assertPlansAreInCatalog } from '../../data/catalog'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import { validateEntry } from '../../domain/dial'
import { nextExerciseAfter } from '../../domain/flow'
import { currentExerciseId, planFor } from '../../domain/liveProgress'
import { exerciseDoneLine, liveRecordCount } from '../../domain/exerciseVerdict'
import { formatDay } from '../../domain/dates'
import { isSessionPrSet } from '../../domain/prMoment'
import { presetForSet } from '../../domain/prefill'
import { sessionPlans } from '../../domain/sessionPlans'
import { workingSets } from '../../domain/setKind'
import { formatSet } from '../../domain/setText'
import { isBarbell } from '../../domain/plates'
import { familyOf } from '../../domain/muscles'
import { latestSet, restLengthOf } from '../../domain/rest'
import { countsTowardStats } from '../../domain/setKind'
import { applySessionChanges } from '../../domain/sessionChanges'
import { ServiceError } from '../../services'
import type { Services } from '../../services'
import type {
  BodyLog,
  Exercise,
  LibraryExercise,
  Program,
  Session,
  SetEntry,
  VolumeBaseline,
  Workout,
} from '../../types'
import { ActionBarSlot, AppShell, ShellChromeContext } from '../../ui/AppShell'
import { LiveHeader } from '../../ui/LiveHeader'
import type { LiveStatus } from '../../ui/LiveStrip'
import { ExerciseList } from '../../ui/ExerciseList'
import { SessionSummary } from '../../ui/SessionSummary'
import { SetScreen, loggedText } from '../../ui/SetScreen'
import { Snackbar } from '../../ui/Snackbar'
import type { Handover } from '../../ui/SetScreen'
import { StorageUnavailableBanner } from '../../ui/StorageUnavailableBanner'
import { ExerciseHistoryOverlay } from '../../ui/ExerciseHistoryOverlay'
import { LiveSessionBar } from '../../ui/live/LiveSessionBar'
import type { LiveView } from '../../ui/live/LiveSessionBar'
import { AlternativesOverlay } from '../overlays/AlternativesOverlay'
import { ExercisePicker } from '../../ui/ExercisePicker'
import { DashboardScreen } from '../dashboard/DashboardScreen'
import { HomeScreen } from '../home/HomeScreen'
import { liftPlan } from '../dashboard/trainCard'
import { appliedStep } from '../../domain/stats/status'
import { DetailOverlay } from '../overlays/DetailOverlay'
import type { AppRoute } from '../routes'
import { useServices, useSyncControls } from '../ServicesProvider'
import { useServiceData } from '../useServiceData'
import { useAppBadge } from '../../ui/useAppBadge'
import { useWakeLock } from '../../ui/useWakeLock'
import { useRestPush } from './useRestPush'

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
  /**
   * v7: which screen the Home tab shows while no Live session is on screen -- `home`, the landing
   * dashboard, or `today`, the workout page pushed over it. Default `today`: on its own (no app
   * root around it) the feature opens on the workout page, as the Train tab did.
   */
  page?: 'home' | 'today'
  /** v7: Home's Today panel opens the workout page, on `workoutId` when Home's arrows picked one. */
  onOpenToday?(workoutId?: string): void
  /** The workout the workout page opens on instead of the one due. */
  todayWorkoutId?: string
  /** v7: the workout page's Back, to Home. */
  onCloseToday?(): void
}

type View = 'picker' | 'list' | 'set'

/** V6 (V5-01): how long "Workout discarded · Undo" stays on Train. */
const DISCARD_UNDO_MS = 8000

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
  /** The Set the screen is on after logging, which its key (`setIndex`) does not follow. */
  liveSetIndex?: number
  /** A logged Set to open for editing: a done cell tapped in the All view. */
  editSetIndex?: number
  /**
   * V3-01: the Exercise this one took over from when its last Set was logged, with its last
   * time's Sets and the log message, for the Just done block over the dock (V4-01).
   */
  handover?: { exerciseId: string; history: SetEntry[]; message: string }
}

/**
 * `open` keyed on the Set it has moved on to by logging (`liveSetIndex`), not the one it was
 * first opened on, so a screen mounted from it again (after minimising, or Undo of a Discard)
 * opens where the trainee was. V6R-01: remounted at its old key, the screen counted Set 1 again.
 */
function settledOpenSet(open: OpenSet): OpenSet {
  return open.liveSetIndex === undefined
    ? open
    : { ...open, setIndex: open.liveSetIndex, liveSetIndex: undefined, extra: false }
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
  /** The Set the Now view opens on, or null to land on All (or the picker). */
  openSet: OpenSet | null
}

/** The program and workout a session was started from, or null when the program is gone. */
function locateSession(
  programs: Program[],
  session: Session,
): { program: Program; workout: Workout } | null {
  const program = programs.find((candidate) => candidate.id === session.programId)
  const workout = program?.workouts.find((candidate) => candidate.id === session.workoutId)
  // The Plans added to the Session follow the Workout's own (E19-T13), so every view sees them.
  if (program && workout && session.added?.length) {
    return { program, workout: { ...workout, exercises: sessionPlans(workout, session) } }
  }
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
 * Where the Now view opens when the Live session comes on screen (V1-01): the Exercise the
 * Session is on, at its next Set; null once every planned Set is in, when All is shown instead.
 */
function nowSetOf(workout: Workout, session: Session): { exerciseId: string; setIndex: number } | null {
  const exerciseId = currentExerciseId(workout, session)
  if (exerciseId === null) return null
  const logged = session.entries.filter((entry) => entry.exerciseId === exerciseId).length
  return { exerciseId, setIndex: logged + 1 }
}

/** A Set of `exerciseId` to open, against what that Exercise was last lifted with. */
async function loadOpenSet(services: Services, exerciseId: string, setIndex: number): Promise<OpenSet> {
  const [history, weightStep] = await Promise.all([
    services.sessions.lastEntriesFor(exerciseId),
    services.preferences.weightStep(exerciseId),
  ])
  return { exerciseId, setIndex, history, extra: false, weightStep, exerciseNote: null }
}

/**
 * The Set the Now view opens on for `session` (`nowSetOf`), its Exercise note read too; null
 * when nothing is left to open or the Set cannot be read, so the caller lands on All instead.
 */
async function openNowSet(
  services: Services,
  located: { workout: Workout } | null,
  session: Session,
): Promise<OpenSet | null> {
  const target = located === null ? null : nowSetOf(located.workout, session)
  if (target === null) return null
  try {
    const [opened, exerciseNote] = await Promise.all([
      loadOpenSet(services, target.exerciseId, target.setIndex),
      services.preferences.exerciseNote(target.exerciseId).catch(() => null),
    ])
    return { ...opened, exerciseNote }
  } catch {
    return null
  }
}

/** The planned working Sets not yet logged today, Plan by Plan (an extra Set covers no other). */
function plannedSetsLeft(workout: Workout, session: Session): number {
  const done = workingSets(session.entries)
  return workout.exercises.reduce((left, plan) => {
    const doneId = session.swaps?.[plan.exerciseId] ?? plan.exerciseId
    const logged = done.filter((entry) => entry.exerciseId === doneId).length
    return left + Math.max(0, plan.sets - logged)
  }, 0)
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
  page = 'today',
  todayWorkoutId,
  onOpenToday,
  onCloseToday,
}: WorkoutFeatureProps): JSX.Element | null {
  const services = useServices()
  const { syncNow } = useSyncControls()
  // The app root's way into Settings, which the Dashboard's gear opens.
  const chrome = useContext(ShellChromeContext)

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
  const volumeBaselineData = useServiceData(
    (s) => orElse<VolumeBaseline>(s.preferences.volumeBaseline(), { period: 'last' }),
    ['preferences'],
  )
  const trackEffortData = useServiceData(
    (s) => orElse(s.preferences.trackEffort(), false),
    ['preferences'],
  )
  const keepScreenOnData = useServiceData(
    (s) => orElse(s.preferences.keepScreenOnDuringRest(), true),
    ['preferences'],
  )
  const weekStartData = useServiceData(
    (s) => orElse<Weekday>(s.preferences.weekStart().then((day) => day as Weekday), 1),
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
  const bodyLogData = useServiceData(
    (s) => orElse<BodyLog>(s.preferences.bodyLog(), []),
    ['preferences'],
  )
  const bodyLog = bodyLogData.status === 'ready' ? bodyLogData.data : []
  const sessionsData = useServiceData(
    (s) => orElse<Session[]>(s.sessions.list(), []),
    ['sessions'],
  )

  const [resumed, setResumed] = useState(false)
  const [view, setView] = useState<View>('picker')
  const [session, setSession] = useState<Session | null>(null)
  const [openSet, setOpenSet] = useState<OpenSet | null>(null)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  // V1-17: the swap just made from Now, for its Undo snackbar on the swapped-in Exercise's screen.
  // The screen reads it once as it opens; it is dropped as soon as that screen has it.
  const [swapUndo, setSwapUndo] = useState<{ plannedId: string; name: string; setIndex: number } | null>(null)
  useEffect(() => {
    if (swapUndo !== null) setSwapUndo(null)
  }, [swapUndo])
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [summarySession, setSummarySession] = useState<Session | null>(null)
  const [lastSwaps, setLastSwaps] = useState<Record<string, string>>({})
  const [lastEntries, setLastEntries] = useState<Map<string, SetEntry[]>>(new Map())
  // V6 (V5-01): the Session just discarded, as it was on screen, while "Workout discarded · Undo"
  // shows on Train for DISCARD_UNDO_MS.
  const [discarded, setDiscarded] = useState<{ session: Session; openSet: OpenSet | null; view: View } | null>(null)
  useEffect(() => {
    if (discarded === null) return
    const timer = setTimeout(() => setDiscarded(null), DISCARD_UNDO_MS)
    return () => clearTimeout(timer)
  }, [discarded])

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
        // Reopened, the Session lands on Now (V1-01), so a running Rest shows with no tap.
        openSet:
          inProgress && landInSession ? await openNowSet(services, locateSession(programs, inProgress), inProgress) : null,
      }
    }

    resume(loadedPrograms)
      .catch((): Resumed => ({ session: null, lastSwaps: {}, lastEntries: new Map(), openSet: null }))
      .then((found) => {
        if (cancelled) return
        setSession(found.session)
        setLastSwaps(found.lastSwaps)
        setLastEntries(found.lastEntries)
        setOpenSet(found.openSet)
        setView(found.session && landInSession ? (found.openSet ? 'set' : 'list') : 'picker')
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

  // V4-07: the Exercise after the open one, read ahead, so its last Set hands over in the same
  // render as the log (no frame of the done state). Only its history and weight step; the note
  // follows after the hand-over.
  const prefetched = useRef<OpenSet | null>(null)
  const aheadId =
    session && located && openSet ? nextExerciseAfter(located.workout, session, openSet.exerciseId) : null
  useEffect(() => {
    if (aheadId === null || prefetched.current?.exerciseId === aheadId) return
    let cancelled = false
    loadOpenSet(services, aheadId, 1)
      .then((opened) => {
        if (!cancelled) prefetched.current = opened
      })
      .catch(() => {
        // Not read ahead: the hand-over reads it then.
      })
    return () => {
      cancelled = true
    }
  }, [services, aheadId])

  // Minimising takes the set screen down; it comes back on the Set it had moved on to by
  // logging, not the one it was first opened on.
  useEffect(() => {
    if (!minimised) return
    setOpenSet((current) => (current ? settledOpenSet(current) : current))
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

  // The screen stays on while a rest runs, on every view of the Session, when the setting is on.
  // The timeout re-renders at the rest's end so the lock is let go then.
  const restEndsAt = liveStatus === null ? null : liveStatus.restEndsAt
  const [, setRestTick] = useState(0)
  useEffect(() => {
    if (restEndsAt === null) return
    const remaining = restEndsAt - Date.now()
    if (remaining <= 0) return
    const timer = setTimeout(() => setRestTick((tick) => tick + 1), remaining)
    return () => clearTimeout(timer)
  }, [restEndsAt])
  useWakeLock(
    keepScreenOnData.status === 'ready' &&
      keepScreenOnData.data &&
      restEndsAt !== null &&
      restEndsAt > Date.now(),
  )
  // The rest's "Rest over" push, and the app icon badge for the whole Session (E24-T10).
  useRestPush(restEndsAt, liveStatus === null ? null : liveStatus.next)
  useAppBadge(inSession)

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

  /**
   * V5-02: what a Set of `doneId` presets from as "last time", given its own history `own` -- the
   * one derivation the Now view, the All view's cells and its Log button share. Its own history
   * when it has one; for an Exercise swapped in with none, the planned Exercise's last time laid
   * over its Rungs (`swapSeed`), with `askStartWeight` when the equipment differs. The planned
   * Exercise's history is read from `lastEntries`, which holds every Plan of the Session.
   */
  function presetSourceFor(doneId: string, own: SetEntry[]): { entries: SetEntry[]; askStartWeight: boolean } {
    const plain = { entries: own, askStartWeight: false }
    if (!session || !located || own.length > 0) return plain
    const plannedId = plannedExerciseIdFor(session, doneId)
    if (plannedId === doneId) return plain
    const plan = located.workout.exercises.find((candidate) => candidate.exerciseId === plannedId)
    const planned = resolveListExercise(plannedId)
    const chosen = resolveListExercise(doneId)
    if (!plan || !planned || !chosen) return plain
    const equipmentOf = (exercise: Exercise): string | null =>
      libraryMap.get(exercise.libraryId)?.equipment ?? null
    const seed = swapSeed({
      planned,
      chosen,
      plan,
      plannedLast: lastEntries.get(plannedId) ?? [],
      chosenLast: own,
      today: session.entries.filter((entry) => entry.exerciseId === plannedId),
      sameEquipment: equipmentOf(planned) === equipmentOf(chosen),
    })
    return seed ?? plain
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
    Promise.all([
      services.sessions.lastEntriesFor(plannedId),
      services.sessions.lastEntriesFor(chosenId),
      services.preferences.weightStep(chosenId),
    ])
      .then(async ([plannedLast, chosenLast, weightStep]) => {
        await applySwap(plannedId, chosenId)
        setSwapUndo({ plannedId, name: planned.name, setIndex })
        // V5-02: both histories go in the map before the screen opens, so its first render
        // presets from the same derivation (`presetSourceFor`) as All and its Log button.
        setLastEntries((current) => new Map(current).set(plannedId, plannedLast).set(chosenId, chosenLast))
        setOverlay(null)
        setOpenSet({
          exerciseId: chosenId,
          setIndex,
          history: chosenLast,
          extra: false,
          weightStep,
          exerciseNote: null,
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

  /** V1-17: the swap snackbar's Undo on Now: removes the swap and reopens the planned Exercise. */
  function handleUndoSwapOnNow(plannedId: string, setIndex: number): void {
    if (!session) return
    services.sessions
      .undoSwap(session.id, plannedId)
      .then(async () => {
        const [opened, exerciseNote] = await Promise.all([
          loadOpenSet(services, plannedId, setIndex),
          services.preferences.exerciseNote(plannedId).catch(() => null),
        ])
        setSession((current) => {
          if (!current) return current
          const swaps = { ...current.swaps }
          delete swaps[plannedId]
          return { ...current, swaps }
        })
        setOpenSet({ ...opened, exerciseNote })
        setView('set')
      })
      .catch(() => {
        // The swap stands; All still offers "Undo swap" beside the row.
      })
  }

  /** Starts the chosen workout, or resumes the session already in progress, and lists it. */
  function handleChoose(programId: string, workoutId: string): void {
    // A new start ends the discarded Session's Undo (V5-01).
    setDiscarded(null)
    services.sessions
      .start(programId, workoutId)
      .then(async (started) => {
        const startedLastSwaps = await services.sessions.lastSwapsForSession(started, programs)
        const startedLastEntries = await services.sessions.lastEntriesForSession(started, programs)
        // Started or resumed, the Session opens on Now (V1-01); All is one tap away.
        const nowSet = await openNowSet(services, locateSession(programs, started), started)
        setSession(started)
        setLastSwaps(startedLastSwaps)
        setLastEntries(startedLastEntries)
        setOpenSet(nowSet)
        setView(nowSet ? 'set' : 'list')
        onRestore?.()
      })
      .catch(() => {
        // The picker stays up; nothing was started, so there is nothing to undo.
      })
  }

  /** Opens a set of an exercise, against what that exercise was last lifted with. */
  function handleOpenSet(exerciseId: string, setIndex: number): void {
    loadOpenSet(services, exerciseId, setIndex)
      .then((opened) => {
        setOpenSet(opened)
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

  /**
   * V6-01, V6-05: one lift as this Session opens it, from its status at the Session's start -- the
   * value Train, the Program tab and Progress show: eased on a Break, and the load it offers.
   */
  function liftPlanFor(exerciseId: string): ReturnType<typeof liftPlan> | null {
    if (!session || !located) return null
    const plan = planFor(located.workout, session, exerciseId)
    const exercise = resolveListExercise(exerciseId)
    if (!plan || !exercise) return null
    const earlier = sessions.filter((other) => other.finishedAt !== null && other.startedAt < session.startedAt)
    return liftPlan(exercise, plan, earlier, session.startedAt, session.deload === true)
  }

  /** Whether `exerciseId`'s Presets open lighter this Session: a deload, or the lift's Break. */
  function easedFor(exerciseId: string): boolean {
    return session?.deload === true || liftPlanFor(exerciseId)?.advice?.kind === 'eased'
  }

  /** V7R-01: the step up `exerciseId`'s Presets hold this Session (Ready, as Home and Train say). */
  function stepUpFor(exerciseId: string): number {
    return appliedStep(liftPlanFor(exerciseId)?.advice)
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
      lastEntries: presetSourceFor(id, lastEntries.get(id) ?? []).entries,
      today,
      deload: easedFor(id),
      stepUp: stepUpFor(id),
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

  /** V3-01: "Add set" on a handed-over Exercise: back on its screen, at one more Set past its Plan. */
  function handleAddSetTo(exerciseId: string): void {
    if (!session) return
    const logged = session.entries.filter((entry) => entry.exerciseId === exerciseId).length
    loadOpenSet(services, exerciseId, logged + 1)
      .then((opened) => {
        setOpenSet({ ...opened, extra: true })
        setView('set')
        loadExerciseNote(exerciseId)
      })
      .catch(() => {
        // The next Exercise stays on screen; nothing was opened.
      })
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

  /** `ExercisePicker.onPick`: adds the Exercise to the Session in progress as a 3 x 8-12 Plan. */
  async function handleAddExercise(exerciseId: string): Promise<void> {
    if (!session) return
    try {
      setSession(await services.sessions.addExercise(session.id, exerciseId))
      loadLastEntriesOf(exerciseId)
      setAdding(false)
    } catch {
      // The picker stays up; nothing was added.
    }
  }

  /** `ExerciseList.onDiscard`: discards the Session in progress and returns to the picker. */
  function handleDiscard(): void {
    if (!session) return
    const was = { session, openSet, view }
    services.sessions
      .discard(session.id)
      .then(() => {
        setSession(null)
        setOpenSet(null)
        setView('picker')
        // V5-01: Train offers it back for DISCARD_UNDO_MS.
        setDiscarded(was)
        void syncNow()
      })
      .catch(() => {
        // The list stays up; nothing was discarded.
      })
  }

  /**
   * V5-01: Undo on "Workout discarded": the Session stored live again and back on screen where it
   * was, on the same Exercise and Set. Its rest follows from its Sets' times, so it runs on.
   */
  function handleUndoDiscard(): void {
    if (discarded === null) return
    const was = discarded
    setDiscarded(null)
    services.sessions
      .undiscard(was.session.id)
      .then((restored) => {
        setSession(restored)
        setOpenSet(was.openSet === null ? null : settledOpenSet(was.openSet))
        setView(was.view === 'set' && was.openSet === null ? 'list' : was.view)
        onRestore?.()
        void syncNow()
      })
      .catch(() => {
        // The Session stays discarded; Train stays as it is.
      })
  }

  /** `SetScreen.onOpenInfo`: the detail overlay for the catalog exercise on screen (E5-T15). */
  // Resolves library and custom exercises too, not only catalog ones: an exercise the app cannot
  // describe still opens the overlay, which says so, rather than the tap doing nothing.
  function handleOpenInfoForExercise(exerciseId: string): void {
    const exercise = resolveListExercise(exerciseId)
    const plannedId = session ? plannedExerciseIdFor(session, exerciseId) : exerciseId
    setOverlay({
      kind: 'detail',
      libraryId: exercise?.libraryId ?? exerciseId,
      heading: exercise?.name,
      plannedId,
    })
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

  /**
   * The Live session's header (S2/S3): the Sets count in its title row (V1-10), Finish asking
   * first while planned Sets are left (V1-06), and the Now | All switch under the row.
   */
  function liveHeader(
    liveSession: Session,
    workout: Workout,
    shown: LiveView,
    heading = true,
  ): JSX.Element {
    return (
      <LiveHeader
        workoutName={workout.name}
        heading={heading}
        startedAt={liveSession.startedAt}
        onMinimise={handleMinimise}
        onFinish={handleFinish}
        sets={{
          done: workingSets(liveSession.entries).length,
          planned: workout.exercises.reduce((sum, plan) => sum + plan.sets, 0),
        }}
        setsLeft={plannedSetsLeft(workout, liveSession)}
        prs={liveRecordCount(
          sessions.filter((earlier) => earlier.finishedAt !== null && earlier.startedAt < liveSession.startedAt),
          liveSession,
          resolveListExercise,
          (id) => planFor(workout, liveSession, id),
        )}
      >
        <LiveSessionBar
          view={shown}
          onViewChange={(next) => {
            if (next === shown) return
            if (next === 'all') setView('list')
            else handleNow()
          }}
        />
      </LiveHeader>
    )
  }

  let content: JSX.Element | null = null

  if (liveOnScreen && view === 'set' && session && located && openSet) {
    const plannedId = plannedExerciseIdFor(session, openSet.exerciseId)
    const plan = located.workout.exercises.find((candidate) => candidate.exerciseId === plannedId)
    const exercise = resolveListExercise(openSet.exerciseId)
    const presetSource = presetSourceFor(openSet.exerciseId, openSet.history)
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
      // V4-07: a finished Exercise reopened from All goes "Back to" the one the Session is on.
      const onNow = currentExerciseId(located.workout, session)
      const backId =
        onNow !== null && onNow !== openSet.exerciseId
          ? onNow
          : nextExerciseAfter(located.workout, session, openSet.exerciseId)
      const backName = backId === null ? null : (resolveListExercise(backId)?.name ?? null)
      const backPlan = backId === null ? undefined : planFor(located.workout, session, backId)
      const backSet =
        backId === null || backPlan === undefined
          ? undefined
          : Math.min(
              backPlan.sets,
              workingSets(session.entries.filter((entry) => entry.exerciseId === backId)).length + 1,
            )
      const earlierSessions = sessions.filter(
        (earlier) => earlier.finishedAt !== null && earlier.startedAt < session.startedAt,
      )
      // V3-01: the Exercise just finished, as this one's screen shows it while its rest runs.
      const handover: Handover | null = (() => {
        const from = openSet.handover
        if (from === undefined) return null
        const fromExercise = resolveListExercise(from.exerciseId)
        const fromPlan = planFor(located.workout, session, from.exerciseId)
        if (!fromExercise || !fromPlan) return null
        const fromSets = workingSets(session.entries.filter((entry) => entry.exerciseId === from.exerciseId)).sort(
          (a, b) => a.setIndex - b.setIndex,
        )
        const last = fromSets[fromSets.length - 1]
        // V4-01: its Sets and one comparison with last time, its Records counted.
        const fromAll = session.entries.filter((entry) => entry.exerciseId === from.exerciseId)
        const isRecord = (entry: SetEntry): boolean =>
          earlierSessions.length > 0 &&
          isSessionPrSet(fromExercise, fromPlan, earlierSessions, { ...session, entries: fromAll }, entry)
        const lastFirst = workingSets(from.history.filter((entry) => entry.exerciseId === from.exerciseId)).sort(
          (a, b) => a.setIndex - b.setIndex,
        )[0]
        return {
          name: fromExercise.name,
          line: exerciseDoneLine({
            today: fromAll,
            last: from.history.filter((entry) => entry.exerciseId === from.exerciseId),
            lastDay: lastFirst === undefined ? '' : formatDay(new Date(lastFirst.loggedAt), new Date()),
            plannedSets: fromPlan.sets,
            isRecord,
          }),
          prs: fromSets.filter(isRecord).length,
          message: from.message,
          onAddSet: () => handleAddSetTo(from.exerciseId),
          effort:
            last === undefined
              ? null
              : {
                  ordinal: fromSets.length,
                  value: last.rir ?? null,
                  onPick: (rir) => {
                    services.sessions
                      .setEffort(session.id, from.exerciseId, last.setIndex, rir)
                      .then(setSession)
                      .catch(() => {
                        // The pick stays unstored; the chips show what is stored.
                      })
                  },
                },
        }
      })()
      content = (
        <AppShell
          title={exercise.name}
          header={liveHeader(session, located.workout, 'now', false)}
          action={<ActionBarSlot />}
        >
          <SetScreen
            key={`${openSet.exerciseId}#${openSet.setIndex}#${openSet.editSetIndex ?? ''}`}
            editSetIndex={openSet.editSetIndex}
            swappedFrom={
              swapUndo === null
                ? null
                : {
                    name: swapUndo.name,
                    onUndo: () => handleUndoSwapOnNow(swapUndo.plannedId, swapUndo.setIndex),
                  }
            }
            deload={easedFor(openSet.exerciseId)}
            advice={liftPlanFor(openSet.exerciseId)?.advice ?? null}
            exercise={exercise}
            plates={isBarbell(libraryMap.get(exercise.libraryId)) ? (plateInventoryData.status === 'ready' ? plateInventoryData.data : null) : null}
            // V6-16: the Session's first barbell lift, no Warm-up logged yet: the ramp in one line.
            warmupLine={
              isBarbell(libraryMap.get(exercise.libraryId)) &&
              session.entries.every(
                (entry) =>
                  entry.kind !== 'warmup' &&
                  (entry.exerciseId === exercise.id ||
                    !isBarbell(libraryMap.get(resolveListExercise(entry.exerciseId)?.libraryId ?? ''))),
              )
            }
            plan={plan}
            setIndex={openSet.setIndex}
            sessionId={session.id}
            // Last time's Sets alone: today's reach the Preset apart, through `logged` (E16-T6).
            // A swap with no history of its own presets as All does (V5-02).
            lastEntries={presetSource.entries}
            askStartWeight={presetSource.askStartWeight}
            swapFor={
              plannedId === openSet.exerciseId
                ? null
                : {
                    name: resolveListExercise(plannedId)?.name ?? plannedId,
                    onUndo: session.entries.some((entry) => entry.exerciseId === openSet.exerciseId)
                      ? undefined
                      : () => handleUndoSwapOnNow(plannedId, openSet.liveSetIndex ?? openSet.setIndex),
                  }
            }
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
            earlierSessions={earlierSessions}
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
              // V3-01: the Exercise's last planned Set hands over to the next unfinished one,
              // its rest still running; with none left the screen stays, on Finish workout.
              const from = openSet.exerciseId
              const next = currentExerciseOf(located.workout, logged, from)
              if (next !== null && next !== from) {
                const fromSets = logged.entries.filter((entry) => entry.exerciseId === from)
                const entry = latestSet(fromSets)
                const message =
                  entry === null ? '' : loggedText(workingSets(fromSets).length, entry.weightKg, entry.reps)
                const count = logged.entries.filter((candidate) => candidate.exerciseId === next).length
                const handover = { exerciseId: from, history: openSet.history, message }
                // V4-07: with the next Exercise read ahead, the hand-over lands in the same render
                // as the log, so the done state never paints in between.
                const ahead = prefetched.current
                if (ahead !== null && ahead.exerciseId === next) {
                  setOpenSet({ ...ahead, setIndex: count + 1, handover })
                  loadExerciseNote(next)
                  return
                }
                loadOpenSet(services, next, count + 1)
                  .then((opened) => {
                    setOpenSet({ ...opened, handover })
                    loadExerciseNote(next)
                  })
                  .catch(() => {
                    // Without the next Exercise's history the screen stays on this one, done.
                  })
                return
              }
              setOpenSet((current) =>
                current
                  ? { ...current, extra: false, liveSetIndex: nextSetIndex, handover: undefined }
                  : current,
              )
            }}
            onAddSet={handleAddSet}
            onOpenInfo={handleOpenInfoForExercise}
            onOpenAlternatives={handleOpenAlternatives}
            onOpenHistory={setHistoryFor}
            upNext={backName}
            upNextSet={backSet}
            handover={handover}
            onFinishWorkout={handleFinish}
            // V3-01: an Exercise reopened from All once done offers "Go to <next>" on Now, where
            // the Session's rest keeps running; with none left, Finish workout.
            onFinishExercise={() => {
              if (backId === null) {
                setView('list')
                return
              }
              const logged = session.entries.filter((entry) => entry.exerciseId === backId).length
              handleOpenSet(backId, logged + 1)
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
        header={liveHeader(session, located.workout, 'all')}
        action={
          quick === null ? undefined : (
            <button type="button" className="log-set btn-primary" onClick={handleQuickLog}>
              {`Log set ${quick.position} · ${formatSet(quick.entry)}`}
            </button>
          )
        }
      >
        <ExerciseList
          deload={session.deload === true}
          easedFor={easedFor}
          stepUpFor={stepUpFor}
          currentId={currentExerciseId(located.workout, session)}
          onOpenLogged={handleOpenLogged}
          program={located.program}
          workout={located.workout}
          resolve={resolveListExercise}
          session={session}
          onOpenSet={handleOpenSet}
          onFinish={handleFinish}
          lastSwaps={lastSwaps}
          // V5-02: a swapped-in Exercise's cells preset as its Now view does.
          lastEntries={Object.values(session.swaps ?? {}).reduce(
            (map, doneId) => map.set(doneId, presetSourceFor(doneId, lastEntries.get(doneId) ?? []).entries),
            new Map(lastEntries),
          )}
          onUndoSwap={handleUndoSwap}
          onApplySwap={handleApplySwap}
          sessions={sessions}
          volumeBaseline={volumeBaseline}
          onDiscard={handleDiscard}
          note={session.note}
          onSaveNote={handleSaveNote}
          onAddExercise={() => setAdding(true)}
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

    const notices =
      !storageAvailable || staleActiveProgramNotice ? (
        <>
          {!storageAvailable ? <StorageUnavailableBanner /> : null}
          {staleActiveProgramNotice ? (
            <p>The saved active program no longer exists; showing the first program instead.</p>
          ) : null}
        </>
      ) : null
    const resume =
      session && located
        ? {
            programName: located.program.name,
            workoutName: located.workout.name,
            onResume: () =>
              minimised && onRestore ? onRestore() : handleChoose(session.programId, session.workoutId),
          }
        : null
    const discardedSnackbar =
      discarded === null ? null : <Snackbar message="Session discarded" actionLabel="Undo" onAction={handleUndoDiscard} />

    // v7: the Home tab opens on the landing dashboard; its Today panel pushes the workout page.
    content =
      page === 'home' ? (
        <AppShell title="Home" ownHeader>
          <HomeScreen
            resume={resume}
            notices={notices}
            canStart={storageAvailable}
            onStartWorkout={(workoutId) => {
              if (activeProgram !== null && storageAvailable) handleChoose(activeProgram.id, workoutId)
            }}
            onPickPlan={(programId, workoutId) => {
              if (!storageAvailable) return
              services.programs
                .setActive(programId)
                .then(() => handleChoose(programId, workoutId))
                .catch(() => undefined)
            }}
            onOpenToday={(workoutId) => onOpenToday?.(workoutId)}
            onOpenSession={(sessionId) => navigate({ tab: 'history', sessionId })}
            onOpenSessions={() => navigate({ tab: 'history' })}
            onOpenProgress={() => navigate({ tab: 'progress' })}
            onOpenLift={(exerciseId) => navigate({ tab: 'lift', exerciseId })}
            onOpenSettings={() => chrome.onOpenSettings?.()}
          />
          {discardedSnackbar}
        </AppShell>
      ) : null

    // The workout page (once the Train tab) draws its own large title, so the shell draws none.
    content = content ?? (
      <AppShell title="Dashboard" ownHeader onBack={onCloseToday}>
        <DashboardScreen
          onBack={onCloseToday}
          initialWorkoutId={todayWorkoutId}
          onStartWorkout={(workoutId) => {
            if (activeProgram !== null && storageAvailable) handleChoose(activeProgram.id, workoutId)
          }}
          onOpenSettings={() => chrome.onOpenSettings?.()}
          // The week strip opens Sessions (V3-09).
          onOpenSessions={() => navigate({ tab: 'history' })}
          // V5-14: a done day opens that workout's summary, as the Sessions calendar does.
          onOpenSession={(sessionId) => navigate({ tab: 'history', sessionId })}
          // V6-03: a lift's name opens the one Lift page.
          onOpenLift={(exerciseId) => navigate({ tab: 'lift', exerciseId })}
          // A backup due is the gear's marker here (S1); Settings spells it out in full.
          notices={notices}
          resume={resume}
        />
        {discardedSnackbar}
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
          weekStartsOn={weekStartData.status === 'ready' ? weekStartData.data : 1}
          program={programs.find((program) => program.id === summarySession.programId)}
          session={summarySession}
          bodyLog={bodyLog}
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
            ?? summarySession.added?.find((plan) => plan.exerciseId === exerciseId)
          }
          workout={programs
            .find((program) => program.id === summarySession.programId)
            ?.workouts.find((workout) => workout.id === summarySession.workoutId)}
          onSaveChanges={async (changes) => {
            // The user's copy of the Program; a bundled Program becomes one on first save.
            const { programs: current, userPrograms } = await services.programs.load()
            const program = current.find((candidate) => candidate.id === summarySession.programId)
            if (program === undefined) throw new Error('The Program is gone')
            const stored = userPrograms.find((candidate) => candidate.id === program.id)
            await services.programs.save({
              ...applySessionChanges(program, summarySession.workoutId, changes),
              createdAt: stored?.createdAt ?? Date.now(),
            })
          }}
          onClose={() => setSummarySession(null)}
          onBrowse={(muscles) => {
            setSummarySession(null)
            navigate({ tab: 'exercises', muscles })
          }}
          onOpenLift={(exerciseId) => navigate({ tab: 'lift', exerciseId })}
        />
      ) : null}
      {liveOnScreen ? historyOverlay : null}
      {liveOnScreen && adding && session && located ? (
        <ExercisePicker
          library={library}
          taken={[
            ...located.workout.exercises.map((plan) => plan.exerciseId),
            ...Object.values(session.swaps ?? {}),
          ]}
          onPick={(id) => void handleAddExercise(id)}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {liveOnScreen && overlay?.kind === 'alternatives' ? (
        <AlternativesOverlay
          plannedId={overlay.plannedId}
          catalog={catalog}
          library={library}
          gymEquipment={gymEquipment}
          // V6-10: lifts the lifter has logged lead the swap list.
          loggedIds={new Set(sessions.flatMap((past) => past.entries.map((entry) => entry.exerciseId)))}
          // ...but never one already in today's Workout.
          taken={[...located.workout.exercises.map((plan) => plan.exerciseId), ...Object.values(session?.swaps ?? {})]}
          onPick={(chosenId) => handleChooseAlternative(overlay.plannedId, chosenId)}
          onOpenDetail={handleOpenDetail}
          onClose={() => setOverlay(null)}
        />
      ) : null}
    </>
  )
}
