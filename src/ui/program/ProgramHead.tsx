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

/**
 * "Start a deload week", in the head's overflow (the Programs panel) while no deload is on
 * (V4-08): a choice made every 6-8 weeks, so it is not a control on the page itself.
 */
export function ProgramDeloadStart({ onStart }: { onStart(): void }): JSX.Element {
  return (
    <button type="button" className="program-deload-start btn-secondary" onClick={onStart}>
      Start a deload week
    </button>
  )
}

/**
 * The one line under the Program's title while a deload is on (V4-08): "Deload week · lighter
 * Presets · End", End turning it off. Train says "Deload week · Presets 10% lighter" meanwhile.
 */
export function ProgramDeloadLine({ onEnd }: { onEnd(): void }): JSX.Element {
  return (
    <p className="program-deload-line">
      <span>Deload week · lighter Presets · </span>
      <button type="button" className="program-deload-end btn-quiet" aria-label="End deload week" onClick={onEnd}>
        End
      </button>
    </p>
  )
}
