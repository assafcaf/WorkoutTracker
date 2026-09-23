import { useState } from 'react'
import type { Exercise, ExercisePlan, Program, Workout } from '../types'
import { assertPlansAreInCatalog } from '../data/catalog'
import './ProgramPicker.css'

export type ProgramPickerProps = {
  programs: Program[]
  catalog: Map<string, Exercise>
  activeProgramId: string
  onChoose(programId: string, workoutId: string): void
}

/**
 * One line of a workout: the exercise's name, its rep target and its set count, as in
 * "Back squat 8-10 x 4".
 */
function planLine(plan: ExercisePlan, catalog: Map<string, Exercise>): string {
  const name = catalog.get(plan.exerciseId)?.name ?? plan.exerciseId
  const [low, high] = plan.repRange
  return `${name} ${low}-${high} x ${plan.sets}`
}

/**
 * Lists the active program's workouts, each with its exercises, and collapses the rest.
 */
export function ProgramPicker(props: ProgramPickerProps): JSX.Element {
  const { programs, catalog, activeProgramId, onChoose } = props
  const [othersOpen, setOthersOpen] = useState(false)

  // Fail before anything renders, so a program referencing an id the catalog lacks leaves no
  // half-built picker behind.
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
        <button
          type="button"
          className="start-workout"
          onClick={() => onChoose(program.id, workout.id)}
        >
          Start {workout.name}
        </button>
      </section>
    )
  }

  return (
    <div className="program-picker">
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
