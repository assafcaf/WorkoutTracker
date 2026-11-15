import { useEffect, useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applySessionChanges } from '../../domain/sessionChanges'
import type { Program, Session, Workout } from '../../types'
import { Snackbar } from '../../ui/Snackbar'
import { AlternativesOverlay } from '../overlays/AlternativesOverlay'
import { DetailOverlay } from '../overlays/DetailOverlay'
import { useServices } from '../ServicesProvider'
import { useServiceData } from '../useServiceData'

/** How long "<new> replaces <old> in Workout A · Undo" stays. */
export const PROGRAM_SWAP_UNDO_MS = 8000

/** The active Program and its shown Workouts that plan `exerciseId`. */
function workoutsWith(program: Program | undefined, exerciseId: string): Workout[] {
  return program?.workouts.filter((w) => !w.hidden && w.exercises.some((plan) => plan.exerciseId === exerciseId)) ?? []
}

/**
 * V6R-02: Progress's "Swap ›" as a real swap. It opens the live Session's short swap list
 * (`AlternativesOverlay`, V6-10: the lifter's logged lifts first, none already in the Workout),
 * headed "Replace <lift> in Workout A". The choice replaces the lift in the active Program's
 * Workouts that plan it -- the same `applySessionChanges` swap the summary's "Save to Program"
 * writes -- and a snackbar offers Undo, which puts the Program back as it was stored.
 */
export function useProgramSwap(): {
  /** Whether `exerciseId` is in the active Program, so a swap has somewhere to go. */
  canSwap(exerciseId: string): boolean
  openSwap(exerciseId: string): void
  /** The overlays and the snackbar; render it once, anywhere on the page. */
  swapUi: JSX.Element
} {
  const services = useServices()
  const catalogData = useServiceData((s) => s.catalog.load(), [])
  const programsData = useServiceData((s) => s.programs.load(), ['programs'])
  const gymData = useServiceData((s) => s.preferences.gymEquipment().catch(() => null), ['preferences'])
  const sessionsData = useServiceData((s) => s.sessions.list().catch((): Session[] => []), ['sessions'])
  const [swapFor, setSwapFor] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ message: string; run(): Promise<void> } | null>(null)

  useEffect(() => {
    if (undo === null) return
    const timer = setTimeout(() => setUndo(null), PROGRAM_SWAP_UNDO_MS)
    return () => clearTimeout(timer)
  }, [undo])

  const ready = catalogData.status === 'ready' && programsData.status === 'ready'
  const active =
    programsData.status === 'ready'
      ? programsData.data.programs.find((p) => p.id === programsData.data.activeProgramId)
      : undefined

  function canSwap(exerciseId: string): boolean {
    return ready && workoutsWith(active, exerciseId).length > 0
  }

  async function swapInProgram(plannedId: string, chosenId: string, oldName: string, newName: string): Promise<void> {
    const { programs, userPrograms, activeProgramId } = await services.programs.load()
    const program = programs.find((p) => p.id === activeProgramId)
    if (!program) return
    const workouts = workoutsWith(program, plannedId)
    if (workouts.length === 0) return
    const stored = userPrograms.find((p) => p.id === program.id)
    const swapped = workouts.reduce(
      (next, w) => applySessionChanges(next, w.id, [{ kind: 'swap', from: plannedId, to: chosenId }]),
      program,
    )
    await services.programs.save({ ...swapped, createdAt: stored?.createdAt ?? Date.now() })
    setSwapFor(null)
    setDetail(null)
    setUndo({
      message: `${newName} replaces ${oldName} in ${workouts.map((w) => w.name).join(' and ')}`,
      // A bundled Program had no stored copy: Undo removes the one the swap made.
      run: () => (stored ? services.programs.save(stored) : services.programs.reset(program.id)),
    })
  }

  let overlay: JSX.Element | null = null
  if (swapFor !== null && ready) {
    const { catalog, library, videos } = catalogData.data
    const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
    const nameOf = (id: string): string => resolveExercise(id, catalog, libraryMap)?.name ?? id
    const workouts = workoutsWith(active, swapFor)
    const gymEquipment = gymData.status === 'ready' ? gymData.data : null
    const choose = (chosenId: string): void => {
      swapInProgram(swapFor, chosenId, nameOf(swapFor), nameOf(chosenId)).catch(() => {
        // Nothing was saved; the list stays up for another try.
      })
    }
    overlay =
      detail !== null ? (
        <DetailOverlay
          libraryId={detail}
          plannedId={swapFor}
          catalog={catalog}
          library={library}
          videos={videos}
          gymEquipment={gymEquipment}
          onBack={() => setDetail(null)}
          onOpenDetail={setDetail}
          onSwap={choose}
        />
      ) : (
        <AlternativesOverlay
          plannedId={swapFor}
          heading={`Replace ${nameOf(swapFor)} in ${workouts.map((w) => w.name).join(' and ')}`}
          catalog={catalog}
          library={library}
          gymEquipment={gymEquipment}
          loggedIds={
            new Set(
              (sessionsData.status === 'ready' ? sessionsData.data : []).flatMap((s) =>
                s.entries.map((entry) => entry.exerciseId),
              ),
            )
          }
          taken={workouts.flatMap((w) => w.exercises.map((plan) => plan.exerciseId))}
          onPick={choose}
          onOpenDetail={setDetail}
          onClose={() => setSwapFor(null)}
        />
      )
  }

  const swapUi = (
    <>
      {overlay}
      {undo === null ? null : (
        <Snackbar
          message={undo.message}
          actionLabel="Undo"
          onAction={() => {
            const was = undo
            setUndo(null)
            was.run().catch(() => {
              // The swap stands; the Program tab can still change it back.
            })
          }}
        />
      )}
    </>
  )

  return {
    canSwap,
    openSwap: (exerciseId) => {
      setUndo(null)
      setDetail(null)
      setSwapFor(exerciseId)
    },
    swapUi,
  }
}
