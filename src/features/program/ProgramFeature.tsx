import { useState } from 'react'
import type { Exercise, LibraryExercise, Program, Session, UserProgram } from '../../types'
import { copyProgram, uuid, visiblePrograms } from '../../domain/programs'
import { resolveExercise } from '../../data/resolve'
import { ServiceError, type ProgramsLoad } from '../../services'
import { IN_PROGRESS_MESSAGE } from '../../services/programs'
import { AppShell } from '../../ui/AppShell'
import { ProgramEditor } from '../../ui/ProgramEditor'
import type { Weekday } from '../../domain/stats/weeks'
import { ProgramPage } from '../../ui/ProgramPage'
import { ProgramHeadActions } from '../../ui/program/ProgramHead'
import { CHOOSE_LINE, CHOOSE_TITLE, programSizeLine } from '../../ui/program/planText'
import { useServiceData } from '../useServiceData'
import { useServices } from '../ServicesProvider'
import type { AppRoute } from '../routes'

export type ProgramFeatureProps = {
  navigate(to: AppRoute): void
  onInSession(inSession: boolean): void
}

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
  const { onInSession } = props
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
  // Held here, not in the page, so the Programs panel an Edit, Copy or New was opened from is
  // still open on coming back from the editor.
  const [programsOpen, setProgramsOpen] = useState(false)

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

  function handleSaveProgram(program: Program): void {
    const stored = userPrograms.find((candidate) => candidate.id === program.id)
    const toSave: UserProgram = { ...program, createdAt: stored?.createdAt ?? Date.now() }
    services.programs
      .save(toSave)
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
      />
    )
  }

  // S7a: the shell's large page title is the active Program itself, with its size line and the
  // head's Edit and overflow beside it; the page below draws no head of its own.
  const active = offeredPrograms.find((program) => program.id === activeProgramId) ?? null
  return (
    <AppShell
      title={active ? active.name : CHOOSE_TITLE}
      subtitle={active ? programSizeLine(active) : CHOOSE_LINE}
      actions={
        active ? (
          <ProgramHeadActions
            name={active.name}
            onEdit={() => handleEditProgram(active.id)}
            programsOpen={programsOpen}
            onOpenPrograms={() => setProgramsOpen(true)}
          />
        ) : undefined
      }
    >
      <ProgramPage
        head="none"
        programs={offeredPrograms}
        activeProgramId={activeProgramId}
        catalog={programCatalog}
        library={libraryMap}
        onChooseProgram={handleActiveProgramChange}
        sessions={sessions}
        now={Date.now()}
        weekStartsOn={weekStartData.status === 'ready' ? weekStartData.data : 1}
        resolve={resolveListExercise}
        onNewProgram={handleNewProgram}
        onEditProgram={handleEditProgram}
        onCopyProgram={handleCopyProgram}
        onDeleteProgram={handleDeleteProgram}
        onResetProgram={handleResetProgram}
        programMessage={programMessage}
        userProgramIds={new Set(userPrograms.map((program) => program.id))}
        bundledProgramIds={new Set(bundledPrograms.map((program) => program.id))}
        programsOpen={programsOpen}
        onProgramsOpenChange={setProgramsOpen}
        onBrowse={(muscles) => props.navigate({ tab: 'exercises', muscles })}
      />
    </AppShell>
  )
}
