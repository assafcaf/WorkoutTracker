import type { Program } from '../types'
import './WorkoutStartButtons.css'

export type WorkoutStartButtonsProps = {
  program: Program
  onStart(workoutId: string): void
}

/**
 * The Workout tab's content (E5-T18, M12): the active program's name and a start button per
 * workout -- nothing else. The plan itself, and switching programs, live on the Program tab.
 */
export function WorkoutStartButtons(props: WorkoutStartButtonsProps): JSX.Element {
  const { program, onStart } = props

  return (
    <div className="workout-start-buttons">
      <h2>{program.name}</h2>
      {program.workouts.map((workout) => (
        <section key={workout.id} className="workout-card">
          <h3>{workout.name}</h3>
          <button type="button" className="start-workout" onClick={() => onStart(workout.id)}>
            Start {workout.name}
          </button>
        </section>
      ))}
    </div>
  )
}
