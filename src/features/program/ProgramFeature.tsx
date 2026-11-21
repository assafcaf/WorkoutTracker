import { useState } from 'react'
import type { Exercise, ExercisePlan, LibraryExercise, Program, Session, UserProgram, Workout } from '../../types'
import { copyProgram, uuid, visiblePrograms } from '../../domain/programs'
import { resolveExercise } from '../../data/resolve'
import { ServiceError, type ProgramsLoad } from '../../services'
import { IN_PROGRESS_MESSAGE } from '../../services/programs'
import { AppShell } from '../../ui/AppShell'
import { Icon } from '../../ui/icons'
import { ProgramEditor, type ExerciseSettings } from '../../ui/ProgramEditor'
import { weekStart, type Weekday } from '../../domain/stats/weeks'
import { isDeloadWeek } from '../../domain/deload'
import { lastEntriesOf, nextLoadText } from '../../domain/planLoad'
import { applyBodyweight } from '../../domain/bodyweight'
import { workoutMinutes } from '../../domain/stats/train'
import { kgCellText, liftPlan } from '../dashboard/trainCard'
import { ProgramLinks, ProgramPage } from '../../ui/ProgramPage'
import { ProgramsList } from '../../ui/program/ProgramsList'
import { DeloadWeekPanel } from '../../ui/program/DeloadWeekPanel'
import { familyWeekly } from '../../domain/programVolume'
import { isBackupDue } from '../../ui/BackupBadge'
import { wholeCount } from '../../ui/program/planText'
import { ProgramChoices } from '../dashboard/DashboardView'
import { programChoiceSummary } from '../dashboard/DashboardScreen'
import { useServiceData } from '../useServiceData'
import { musclesLine, progressModel } from '../progress/Home'
import { useServices } from '../ServicesProvider'
import type { AppRoute } from '../routes'

export type ProgramFeatureProps = {
  navigate(to: AppRoute): void
  onInSession(inSession: boolean): void
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
}

/** A page pushed over the Program tab inside this screen group (DX-04): Programs, Deload week. */
type SubPage = 'programs' | 'deload'

/** What the editor was opened on: the Program it starts from, and whether it is new (E9-T9). */
type EditorTarget = { initial: Program; isNew: boolean; mode: 'new' | 'edit' | 'copy' }

/** The line the editor shows when a save rejects (E9-T9 O9, copied for E11-T11). */
const SAVE_ERROR = 'Couldn’t save — try again'

/**
 * `catalog` plus every library Exercise a Program's Plan points at, resolved the way the set
 * screen resolves it, so the Program tab can name and map every Plan a trainee's own Program
 * prescribes from the library rather than the bundled catalog (mirrors `App.tsx`'s own helper).
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

/**
 * The Program tab as its own container over services (E11-T11, O10): lists, switches, creates,
 * copies, edits, deletes and resets Programs through `services.programs`, wrapping the existing
 * `ProgramPage` and `ProgramEditor` the way `App.tsx` used to.
 */
export function ProgramFeature(props: ProgramFeatureProps): JSX.Element {
  const { onInSession, now = Date.now } = props
  const services = useServices()
  const programsData = useServiceData<ProgramsLoad>((s) => s.programs.load(), ['programs'])
  const catalogData = useServiceData((s) => s.catalog.load(), [])
  const gymEquipmentData = useServiceData(
    (s) => s.preferences.gymEquipment().catch(() => null),
    ['preferences'],
  )
  const weekStartData = useServiceData(
    (s) => s.preferences.weekStart().then((day): Weekday => day as Weekday).catch((): Weekday => 1),
    ['preferences'],
  )
  // V1-16: each Exercise's stored weight step and Bodyweight override, offered in the editor's
  // row options; the live Session reads the same two settings.
  const exerciseSettingsData = useServiceData(
    (s) =>
      Promise.all([s.preferences.weightSteps(), s.preferences.bodyweightOverrides()])
        .then(([weightSteps, bodyweight]): ExerciseSettings => ({ weightSteps, bodyweight }))
        .catch((): ExerciseSettings => ({ weightSteps: {}, bodyweight: {} })),
    ['preferences'],
  )
  const deloadData = useServiceData((s) => s.preferences.deloadWeek().catch((): null => null), ['preferences'])
  // Every finished Session and the one in progress, so "This week" (E5-T20) counts them all.
  const sessionsData = useServiceData(
    (s) =>
      Promise.all([s.sessions.list(), s.sessions.resumeActive()])
        .then(([done, active]): Session[] => (active ? [...done, active] : done))
        .catch((): Session[] => []),
    ['sessions'],
  )

  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [programMessage, setProgramMessage] = useState<string | null>(null)
  // Held here, not in the page, so the Programs page a Copy or New was opened from is still
  // open on coming back from the editor.
  const [subPage, setSubPage] = useState<SubPage | null>(null)
  // The Settings row says when a backup is due (the marker the gear used to carry).
  const lastExportedData = useServiceData((s) => s.preferences.lastExportedAt().catch((): null => null), ['preferences'])

  // The tab's shell shows at once, so the tab bar and heading do not wait on the Programs.
  if (programsData.status !== 'ready' || catalogData.status !== 'ready') {
    return <AppShell title="Program">{null}</AppShell>
  }

  // `services.programs.load()`'s own `programs` is already the merged (bundled + user) list
  // (`services/programs.ts` calls `mergePrograms` itself); the bundled-only list -- which
  // `bundledProgramIds` below needs, the way `App.tsx` kept it distinct from its merged
  // `programs` -- comes from `services.catalog.load()` instead.
  const { programs, userPrograms, activeProgramId } = programsData.data
  const { catalog, library, bundledPrograms } = catalogData.data
  const gymEquipment = gymEquipmentData.status === 'ready' ? gymEquipmentData.data : null
  const sessions = sessionsData.status === 'ready' ? sessionsData.data : []
  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
  const offeredPrograms = visiblePrograms(programs)
  const programCatalog = withProgramExercises(catalog, programs, libraryMap)

  /** Opens the editor on `target`, with no save error left from an earlier one. */
  function openEditor(target: EditorTarget): void {
    setSaveError(null)
    setEditor(target)
    onInSession(true)
  }

  function handleNewProgram(): void {
    openEditor({
      initial: { id: `user-${uuid()}`, name: '', units: 'kg', workouts: [], sessionsPerWeek: 1 },
      isNew: true,
      mode: 'new',
    })
  }

  function handleEditProgram(id: string): void {
    const program = programs.find((candidate) => candidate.id === id)
    if (program) openEditor({ initial: program, isNew: false, mode: 'edit' })
  }

  function handleCopyProgram(id: string): void {
    const program = programs.find((candidate) => candidate.id === id)
    if (program) openEditor({ initial: copyProgram(program, Date.now()), isNew: false, mode: 'copy' })
  }

  function closeEditor(): void {
    setEditor(null)
    setSaveError(null)
    onInSession(false)
  }

  /**
   * Stores the Exercise settings changed in the editor (V1-16): each weight step as is, and each
   * Bodyweight value against the Exercise's own, so a value back at its default drops the override.
   */
  function saveExerciseSettings(settings: ExerciseSettings | undefined): Promise<unknown> {
    if (settings === undefined) return Promise.resolve()
    return Promise.all([
      ...Object.entries(settings.weightSteps).map(([id, step]) => services.preferences.setWeightStep(id, step)),
      ...Object.entries(settings.bodyweight).map(([id, value]) =>
        services.preferences.setBodyweight(id, value, resolveListExercise(id)?.bodyweight ?? false),
      ),
    ])
  }

  function handleSaveProgram(program: Program, settings?: ExerciseSettings): void {
    const stored = userPrograms.find((candidate) => candidate.id === program.id)
    const toSave: UserProgram = { ...program, createdAt: stored?.createdAt ?? Date.now() }
    services.programs
      .save(toSave)
      .then(() => saveExerciseSettings(settings))
      .then(() => {
        closeEditor()
      })
      .catch((error: unknown) => {
        if (error instanceof ServiceError && error.code === 'in-progress') {
          setSaveError(IN_PROGRESS_MESSAGE)
          return
        }
        setSaveError(SAVE_ERROR)
      })
  }

  function handleDeleteProgram(id: string): void {
    services.programs
      .remove(id)
      .then(() => {
        setProgramMessage(null)
      })
      .catch((error: unknown) => {
        if (error instanceof ServiceError && error.code === 'in-progress') {
          setProgramMessage(IN_PROGRESS_MESSAGE)
          return
        }
        setProgramMessage(null)
      })
  }

  function handleResetProgram(id: string): void {
    services.programs
      .reset(id)
      .then(() => {
        setProgramMessage(null)
      })
      .catch(() => {
        // The stored edit stands; the Program tab keeps showing it.
      })
  }

  function handleActiveProgramChange(id: string): void {
    services.programs.setActive(id).catch(() => {
      // Nothing to recover to here; a later read will surface the same failure.
    })
  }

  /** `ExerciseList.resolve`-style lookup: a catalog id or a library id to its `Exercise`. */
  function resolveListExercise(id: string): Exercise | undefined {
    return resolveExercise(id, catalog, libraryMap)
  }

  const active = offeredPrograms.find((program) => program.id === activeProgramId) ?? null
  const at = now()
  const weekStartsOn: Weekday = weekStartData.status === 'ready' ? weekStartData.data : 1
  // V4-08: the Deload week; Train's Presets follow the same stored week.
  const deloadOn = deloadData.status === 'ready' && isDeloadWeek(deloadData.data, at, weekStartsOn)
  // V6-15: the loads and minutes read finished Sessions, as Train does.
  const finished = sessions.filter((session) => session.finishedAt != null)
  // V6-15 / N2: the kg each lift opens on and the minutes, as Train says them -- the one pair of
  // functions the Program tab and the Program editor both read.
  function planLoadOf(plan: ExercisePlan): string {
    const listed = resolveListExercise(plan.exerciseId)
    if (listed === undefined) return '–'
    const exercise = applyBodyweight(
      listed,
      exerciseSettingsData.status === 'ready' ? exerciseSettingsData.data.bodyweight : {},
    )
    return kgCellText(liftPlan(exercise, plan, finished, at, deloadOn))
  }
  function minutesIn(program: Program) {
    return (workout: Workout): number => workoutMinutes(program, workout, finished).minutes
  }

  if (editor) {
    // Full screen, no shell and no tab bar (S7b): the editor carries its own Cancel / title /
    // Save bar, and the way out of it is its own Cancel or Save.
    return (
      <ProgramEditor
        key={editor.initial.id}
        initial={editor.initial}
        isNew={editor.isNew}
        title={editor.mode === 'copy' ? 'Copy program' : undefined}
        resolve={resolveListExercise}
        library={library}
        gymEquipment={gymEquipment}
        onSave={handleSaveProgram}
        onCancel={closeEditor}
        saveError={saveError}
        exerciseSettings={exerciseSettingsData.status === 'ready' ? exerciseSettingsData.data : undefined}
        // V5-10: a lifted Plan shows the load it is on now, as the Program tab's kg column does.
        nowLoad={(exerciseId, plan) => {
          const exercise = resolveListExercise(exerciseId)
          if (exercise === undefined || lastEntriesOf(sessions, exerciseId).length === 0) return null
          return nextLoadText(exercise, plan, sessions)
        }}
        loadOf={planLoadOf}
        minutesOf={minutesIn(editor.initial)}
      />
    )
  }

  const backupDue =
    lastExportedData.status === 'ready' && sessionsData.status === 'ready'
      ? isBackupDue(lastExportedData.data, at, finished.length > 0)
      : false
  function setDeload(on: boolean): void {
    void services.preferences.setDeloadWeek(on ? weekStart(at, weekStartsOn) : null).catch(() => undefined)
  }
  const links = {
    onOpenPrograms: () => setSubPage('programs'),
    onOpenDeload: active ? () => setSubPage('deload') : undefined,
    deloadOn,
    onOpenExercises: () => props.navigate({ tab: 'exercises' }),
    onOpenSettings: () => props.navigate({ tab: 'settings' }),
    backupDue,
  }

  if (subPage === 'programs') {
    return (
      <AppShell title="Programs" onBack={() => setSubPage(null)}>
        <ProgramsList
          programs={offeredPrograms}
          activeProgramId={activeProgramId}
          onChoose={handleActiveProgramChange}
          onCopy={handleCopyProgram}
          onNew={handleNewProgram}
          onDelete={handleDeleteProgram}
          onReset={handleResetProgram}
          userProgramIds={new Set(userPrograms.map((program) => program.id))}
          bundledProgramIds={new Set(bundledPrograms.map((program) => program.id))}
          message={programMessage}
        />
      </AppShell>
    )
  }

  if (subPage === 'deload' && active) {
    return (
      <AppShell title="Deload week" onBack={() => setSubPage(null)}>
        <DeloadWeekPanel on={deloadOn} onStart={() => setDeload(true)} onEnd={() => setDeload(false)} />
      </AppShell>
    )
  }

  // DX-04 first run: the same rows as Train's, then the list group (Settings among it).
  if (!active) {
    return (
      <AppShell title="Choose a Program">
        <div className="program-page">
          <ProgramChoices
            options={offeredPrograms.map((program) => ({ id: program.id, name: program.name, summary: programChoiceSummary(program) }))}
            canUse
            onChoose={handleActiveProgramChange}
          />
          {/* DX-04: the choices above are the Programs; no second "Programs ›" row here, so the
              list's own "New program" sits under them. */}
          <ul className="program-rows">
            <li>
              <button type="button" className="program-row cell" onClick={handleNewProgram}>
                <span className="program-row-label">New program</span>
                <Icon name="Plus" size={18} />
              </button>
            </li>
          </ul>
          <ProgramLinks {...links} onOpenPrograms={undefined} />
        </div>
      </AppShell>
    )
  }

  // DX-04: the title is the active Program, its meta line under it and Edit, the one header action.
  const sets = wholeCount(familyWeekly(active, (id) => programCatalog.get(id), libraryMap).total)
  const workoutCount = active.workouts.filter((workout) => !workout.hidden).length
  return (
    <AppShell
      title={active.name}
      subtitle={`${active.sessionsPerWeek}× a week · ${workoutCount} workout${workoutCount === 1 ? '' : 's'} · ${sets} sets${deloadOn ? ' · Deload week' : ''}`}
      actions={
        <button
          type="button"
          className="program-page-head-edit btn-quiet"
          aria-label={`Edit ${active.name}`}
          onClick={() => handleEditProgram(active.id)}
        >
          Edit
        </button>
      }
    >
      <ProgramPage
        program={active}
        catalog={programCatalog}
        library={libraryMap}
        programMessage={programMessage}
        // V6-03: a Plan's row opens the one Lift page.
        onOpenLift={(exerciseId) => props.navigate({ tab: 'lift', exerciseId })}
        // DX-03: one row into Progress › Muscles.
        onOpenMuscles={() => props.navigate({ tab: 'muscles' })}
        // DX-03: the verdict Progress › Muscles gives, over the same Sessions.
        muscleVerdict={musclesLine(
          progressModel(
            { program: active, sessions: finished, resolve: resolveListExercise, library: libraryMap, weekStart: weekStartsOn, bodyLog: [] },
            at,
          ),
        )}
        // V6-15: the kg each lift opens on and the minutes, as Train says them.
        loadOf={planLoadOf}
        minutesOf={minutesIn(active)}
        links={links}
      />
    </AppShell>
  )
}
