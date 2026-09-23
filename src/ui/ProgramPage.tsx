import { useState } from 'react'
import type { Exercise, ExercisePlan, LibraryExercise, Program, Workout } from '../types'
import { assertPlansAreInCatalog } from '../data/catalog'
import './ProgramPage.css'

export type ProgramPageProps = {
  programs: Program[]
  activeProgramId: string
  catalog: Map<string, Exercise>
  library: Map<string, LibraryExercise>
  onChooseProgram(id: string): void
}

/**
 * One line of a workout's plan: the exercise's name, its rep target, its set count and its
 * rest, as in "Back squat 8-10 x 4, rest 180s" (M13 -- `ProgramPicker`'s line gains rest here).
 */
function planLine(plan: ExercisePlan, catalog: Map<string, Exercise>): string {
  const name = catalog.get(plan.exerciseId)?.name ?? plan.exerciseId
  const [low, high] = plan.repRange
  return `${name} ${low}-${high} x ${plan.sets}, rest ${plan.restSeconds}s`
}

/**
 * The Program tab (E5-T18): the active program's name, a card per workout listing its
 * exercises, and the rest of the loaded programs collapsed under a disclosure -- carried over
 * from `ProgramPicker` (E1-T2), which this replaces on the Workout tab (M12).
 *
 * Stub for the red commit: neither the per-workout body map (`prescribedWeekly` +
 * `toRegionCounts` + `BodyMap`, `scale="session"`) nor the program switcher (Settings'
 * "Active program" radio-group pattern, `onChooseProgram`) is wired in yet -- see
 * ProgramPage.test.tsx's M13 tests. `library` and `onChooseProgram` are not yet consulted.
 */
export function ProgramPage(props: ProgramPageProps): JSX.Element {
  const { programs, activeProgramId, catalog, library, onChooseProgram } = props
  const [othersOpen, setOthersOpen] = useState(false)
  // Not yet consulted by this stub -- see the note above.
  void library
  void onChooseProgram

  // Fail before anything renders, so a program referencing an id the catalog lacks leaves no
  // half-built page behind -- the same rule `ProgramPicker` enforced.
  for (const program of programs) assertPlansAreInCatalog(program, catalog)

  const active = programs.find((program) => program.id === activeProgramId)
  if (!active) throw new Error(`no program ${activeProgramId} among the loaded programs`)
  const others = programs.filter((program) => program.id !== activeProgramId)

  function renderWorkout(program: Program, workout: Workout): JSX.Element {
    return (
      <section key={`${program.id}/${workout.id}`} className="workout-card">
        <h3>{workout.name}</h3>
        <ul>
          {workout.exercises.map((plan) => (
            <li key={plan.exerciseId}>{planLine(plan, catalog)}</li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <div className="program-page">
      <h2>{active.name}</h2>
      {active.workouts.map((workout) => renderWorkout(active, workout))}
      <button
        type="button"
        className="other-programs-toggle"
        aria-expanded={othersOpen}
        onClick={() => setOthersOpen((open) => !open)}
      >
        Other programs ({others.length})
      </button>
      {othersOpen
        ? others.map((program) => (
            <section key={program.id}>
              <h2>{program.name}</h2>
              {program.workouts.map((workout) => renderWorkout(program, workout))}
            </section>
          ))
        : null}
    </div>
  )
}
