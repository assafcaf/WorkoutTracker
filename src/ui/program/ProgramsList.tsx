import { useState } from 'react'
import type { Program } from '../../types'
import { Icon } from '../icons'
import '../ProgramPage.css'

export type ProgramsListProps = {
  programs: Program[]
  activeProgramId: string | null
  /** Makes a Program the active one. */
  onChoose(id: string): void
  onCopy(id: string): void
  onNew(): void
  onDelete?(id: string): void
  onReset?(id: string): void
  /** A Program's id is here when the trainee owns a copy of it (Delete, or Reset when bundled). */
  userProgramIds?: Set<string>
  /** A Program's id is here when it ships with the app. */
  bundledProgramIds?: Set<string>
  /** A refused change's line, shown under the list. */
  message?: string | null
}

/** `3× a week · 2 workouts`. */
function sizeOf(program: Program): string {
  const workouts = program.workouts.filter((workout) => !workout.hidden).length
  return `${program.sessionsPerWeek}× a week · ${workouts} workout${workouts === 1 ? '' : 's'}`
}

/**
 * The Programs page (DX-04), pushed over the Program tab: every Program as a plain row, the
 * active one ticked; a tap on a row makes it active. Each row carries one trailing "Copy", and a
 * Program of the trainee's own a quiet Delete (or Reset to original, for an edited bundled one)
 * that asks once more in place. "New program" closes the list. Editing is the Program tab's
 * "Edit", on the active Program only.
 */
export function ProgramsList(props: ProgramsListProps): JSX.Element {
  const { programs, activeProgramId, userProgramIds = new Set(), bundledProgramIds = new Set() } = props
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  return (
    <div className="programs-list-page">
      <ul className="program-rows programs-list" aria-label="Programs">
        {programs.map((program) => {
          const active = program.id === activeProgramId
          const owned = userProgramIds.has(program.id)
          const bundled = bundledProgramIds.has(program.id)
          const confirming = confirmingId === program.id
          return (
            <li key={program.id} className="programs-list-item" data-program-id={program.id}>
              <button
                type="button"
                className="programs-list-choose cell"
                aria-pressed={active}
                onClick={() => {
                  if (!active) props.onChoose(program.id)
                }}
              >
                <span className="programs-list-text">
                  <span className="programs-list-name">{program.name}</span>
                  <span className="programs-list-size">{active ? `Active · ${sizeOf(program)}` : sizeOf(program)}</span>
                </span>
                {active ? <Icon name="Check" size={20} /> : null}
              </button>
              <span className="programs-list-actions">
                <button
                  type="button"
                  className="programs-list-action btn-quiet"
                  aria-label={`Copy ${program.name}`}
                  onClick={() => props.onCopy(program.id)}
                >
                  Copy
                </button>
                {owned && !confirming ? (
                  <button
                    type="button"
                    className="programs-list-action programs-list-danger btn-quiet"
                    aria-label={bundled ? `Reset ${program.name} to original` : `Delete ${program.name}`}
                    onClick={() => setConfirmingId(program.id)}
                  >
                    {bundled ? 'Reset' : 'Delete'}
                  </button>
                ) : null}
                {confirming ? (
                  <button
                    type="button"
                    className="programs-list-action programs-list-danger btn-quiet"
                    onClick={() => {
                      setConfirmingId(null)
                      if (bundled) props.onReset?.(program.id)
                      else props.onDelete?.(program.id)
                    }}
                  >
                    Confirm
                  </button>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
      {props.message ? (
        <p className="program-page-message" role="status">
          {props.message}
        </p>
      ) : null}
      <ul className="program-rows">
        <li>
          <button type="button" className="program-row cell" onClick={props.onNew}>
            <span className="program-row-label">New program</span>
            <Icon name="Plus" size={18} />
          </button>
        </li>
      </ul>
    </div>
  )
}
