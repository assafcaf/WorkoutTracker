import type { Exercise, Session } from '../types'

export type SessionEditorProps = {
  session: Session
  /** The name of the Workout the Session was performed from, shown as the editor's heading. */
  workoutName: string
  resolve: (id: string) => Exercise | undefined
  /** Opens that Exercise's first Set on the Dials (E12-T9). */
  focusExerciseId?: string
  onSave(draft: Session): Promise<void>
  onCancel(): void
  /** Rendered by E12-T7. */
  onDelete?(): void
}

/** The History editor (E12-T6): edits a draft of a finished Session, saved in one write. */
export function SessionEditor(props: SessionEditorProps): JSX.Element {
  void props
  return <div className="session-editor" />
}
