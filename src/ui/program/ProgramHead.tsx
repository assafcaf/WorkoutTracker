import { Icon } from '../icons'
import '../ProgramPage.css'

export type ProgramHeadActionsProps = {
  /** The active Program's name, which names the Edit button (`Edit A/B Split`). */
  name: string
  onEdit(): void
  programsOpen: boolean
  onOpenPrograms(): void
}

/** S7a's head actions: `Edit` on the active Program, and the overflow opening the Programs panel. */
export function ProgramHeadActions({
  name,
  onEdit,
  programsOpen,
  onOpenPrograms,
}: ProgramHeadActionsProps): JSX.Element {
  return (
    <>
      <button type="button" className="program-page-head-edit btn-quiet" aria-label={`Edit ${name}`} onClick={onEdit}>
        Edit
      </button>
      <button
        type="button"
        className="program-page-more icon-btn"
        aria-label="Programs"
        aria-haspopup="dialog"
        aria-expanded={programsOpen}
        onClick={onOpenPrograms}
      >
        <Icon name="Ellipsis" size={22} />
      </button>
    </>
  )
}
