import './ResumeCard.css'

export type ResumeCardProps = {
  programName: string
  workoutName: string
  onResume(): void
}

/**
 * Names the workout a session is already in progress on, and resumes it -- rather than the
 * trainee restarting from a bare picker.
 *
 * Rendered above `ProgramPicker` in the picker return whenever a session is in progress and
 * its program still resolves, so a trainee who backed out of the exercise list finds their
 * session waiting instead of a bare picker.
 */
export function ResumeCard(props: ResumeCardProps): JSX.Element {
  const { programName, workoutName, onResume } = props

  return (
    <section className="resume-card">
      <p className="resume-card-program">{programName}</p>
      <button type="button" className="resume-workout" onClick={onResume}>
        Resume {workoutName}
      </button>
    </section>
  )
}
