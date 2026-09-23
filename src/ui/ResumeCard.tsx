export type ResumeCardProps = {
  programName: string
  workoutName: string
  onResume(): void
}

/**
 * Names the workout a session is already in progress on, and resumes it -- rather than the
 * trainee restarting from a bare picker.
 *
 * E3-T5 stub -- the markup is not written yet, which is what makes `src/App.test.tsx`'s
 * O12 tests red. The implementer replaces this body with a `<button class="resume-workout">`
 * naming `workoutName` (and, per the ticket, `programName`), wired to `onResume`. No stylesheet
 * is imported here yet either: E3-T1's O6 audit would fail on an unimported one, and adding the
 * import is implementation.
 */
export function ResumeCard(_props: ResumeCardProps): JSX.Element {
  return <></>
}
