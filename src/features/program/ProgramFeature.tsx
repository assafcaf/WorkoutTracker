import { useState } from 'react'
import type { Exercise, LibraryExercise, Program, UserProgram } from '../../types'
import { copyProgram, uuid, visiblePrograms } from '../../domain/programs'
import { resolveExercise } from '../../data/resolve'
import { ServiceError, type ProgramsLoad } from '../../services'
import { IN_PROGRESS_MESSAGE } from '../../services/programs'
import { ProgramEditor } from '../../ui/ProgramEditor'
import { ProgramPage } from '../../ui/ProgramPage'
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

  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [programMessage, setProgramMessage] = useState<string | null>(null)

  if (programsData.status !== 'ready' || catalogData.status !== 'ready') return <></>

  // `services.programs.load()`'s own `programs` is already the merged (bundled + user) list
  // (`services/programs.ts` calls `mergePrograms` itself); the bundled-only list -- which
  // `bundledProgramIds` below needs, the way `App.tsx` kept it distinct from its merged
  // `programs` -- comes from `services.catalog.load()` instead.
  const { programs, userPrograms, activeProgramId: loadedActiveProgramId } = programsData.data
  const { catalog, library, bundledPrograms } = catalogData.data
  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
  const offeredPrograms = visiblePrograms(programs)
  const programCatalog = withProgramExercises(catalog, programs, libraryMap)
  // `services.programs.load` reports `activeProgramId: null` with nothing stored and no Session
  // (E9-T2's own rule: a new trainee has no Program until they choose one) -- a render-time
  // default only, so the Program tab still leads with one rather than the chooser; it writes
  // nothing, unlike `handleActiveProgramChange`, which is the trainee's own choice.
  const activeProgramId = loadedActiveProgramId ?? offeredPrograms[0]?.id ?? null

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
    return (
      <ProgramEditor
        key={editor.initial.id}
        initial={editor.initial}
        isNew={editor.isNew}
        resolve={resolveListExercise}
        library={library}
        gymEquipment={null}
        onSave={handleSaveProgram}
        onCancel={closeEditor}
        saveError={saveError}
      />
    )
  }

  return (
    <ProgramPage
      programs={offeredPrograms}
      activeProgramId={activeProgramId}
      catalog={programCatalog}
      library={libraryMap}
      onChooseProgram={handleActiveProgramChange}
      resolve={resolveListExercise}
      onNewProgram={handleNewProgram}
      onEditProgram={handleEditProgram}
      onCopyProgram={handleCopyProgram}
      onDeleteProgram={handleDeleteProgram}
      onResetProgram={handleResetProgram}
      programMessage={programMessage}
      userProgramIds={new Set(userPrograms.map((program) => program.id))}
      bundledProgramIds={new Set(bundledPrograms.map((program) => program.id))}
    />
  )
}
