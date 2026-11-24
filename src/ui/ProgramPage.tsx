import type { Exercise, ExercisePlan, LibraryExercise, Program, Workout } from '../types'
import { assertPlansAreInCatalog } from '../data/catalog'
import { workoutEstimate } from '../domain/dashboard'
import { familyWeekly } from '../domain/programVolume'
import { formatRest } from '../domain/rest'
import { useState } from 'react'
import { Icon } from './icons'
import { planRowText, wholeCount, workoutSizeText } from './program/planText'
import './ProgramPage.css'

/** The rest a Plan's row leaves unsaid (DX-16): only a different one is written out. */
const USUAL_REST_SECONDS = 90

export type ProgramPageProps = {
  /** The active Program. */
  program: Program
  catalog: Map<string, Exercise>
  library: Map<string, LibraryExercise>
  /**
   * V6-15: the load a Plan's next Session opens on, as Train says it ("47.5 → 62.5", "70",
   * "BW+5", "–" with none). Omitted, the row says sets × reps only.
   */
  loadOf?(plan: ExercisePlan): string
  /** V6-15: a Workout's minutes as Train estimates them; omitted, the plan estimate. */
  minutesOf?(workout: Workout): number
  /** DX-16: a Plan's row opens that lift's page. */
  onOpenLift?(exerciseId: string): void
  /** DX-03: the muscles row opens Progress › Muscles. */
  onOpenMuscles?(): void
  /** DX-03: the Muscles verdict, the same line Progress › Muscles gives; omitted, the row gives the count only. */
  muscleVerdict?: string
  /** The list group under the Workouts (DX-04). */
  links: ProgramLinksProps
  /**
   * Saves a new Workout order: every Workout id of the Program, hidden ones kept in place. The
   * order is the rotation Train follows. Omitted, the order cannot be changed here.
   */
  onReorderWorkouts?(workoutIds: string[]): void
  /** A line the page shows when set (a refused change). */
  programMessage?: string | null
}

/**
 * The Program tab's body (DX-04, DX-16, DX-03): each Workout as a plain list -- a section header
 * ("Workout A · 23 sets · ~70 min") and one row per Plan, its name on the left and `4 × 8–10 ·
 * 47.5 → 62.5 kg` on the right, the rest only where it is not the usual 1:30; a row opens the
 * lift's page. Then one muscles row ("69 sets a week · Shoulders above range ›") into
 * Progress › Muscles, and the list group: Programs, Deload week, Exercises, Settings.
 *
 * The title ("A/B Split"), its meta line and Edit are the shell's large header (`ProgramFeature`).
 */
export function ProgramPage(props: ProgramPageProps): JSX.Element {
  const { program, catalog, library, links, programMessage = null } = props
  // Fail before anything renders, so a program referencing an id the catalog lacks leaves no
  // half-built page behind.
  assertPlansAreInCatalog(program, catalog)
  const lookup = (id: string): Exercise | undefined => catalog.get(id)
  const workouts = program.workouts.filter((workout) => !workout.hidden)
  const [ordering, setOrdering] = useState(false)
  const canOrder = props.onReorderWorkouts !== undefined && workouts.length > 1

  /** Moves a shown Workout one place; hidden Workouts keep their slots in the stored order. */
  function move(workoutId: string, by: -1 | 1): void {
    const shown = workouts.map((workout) => workout.id)
    const from = shown.indexOf(workoutId)
    const to = from + by
    if (from < 0 || to < 0 || to >= shown.length) return
    ;[shown[from], shown[to]] = [shown[to], shown[from]]
    let next = 0
    const ids = program.workouts.map((workout) => (workout.hidden ? workout.id : shown[next++]))
    props.onReorderWorkouts?.(ids)
  }

  function renderPlan(plan: ExercisePlan, index: number): JSX.Element {
    const name = catalog.get(plan.exerciseId)?.name ?? plan.exerciseId
    const prescription = planRowText(plan, props.loadOf ? props.loadOf(plan) : null)
    const rest = plan.restSeconds !== USUAL_REST_SECONDS ? `${formatRest(plan.restSeconds)} rest` : null
    const content = (
      <>
        <span className="program-plan-name">{name}</span>
        <span className="program-plan-figure">
          {prescription}
          {rest ? <span className="program-plan-rest">{` · ${rest}`}</span> : null}
        </span>
      </>
    )
    return (
      <li key={`${plan.exerciseId}-${index}`} className="program-plan" data-exercise-id={plan.exerciseId}>
        {props.onOpenLift ? (
          <button type="button" className="program-plan-row cell" onClick={() => props.onOpenLift?.(plan.exerciseId)}>
            {content}
          </button>
        ) : (
          <div className="program-plan-row">{content}</div>
        )}
      </li>
    )
  }

  function renderWorkout(workout: Workout, index: number): JSX.Element {
    const { sets, minutes: planned } = workoutEstimate(workout)
    const minutes = props.minutesOf?.(workout) ?? planned
    const headingId = `program-workout-${workout.id}`
    return (
      <section key={workout.id} className="program-workout" aria-labelledby={headingId}>
        <div className="program-workout-head">
          <h2 className="program-workout-title" id={headingId}>
            {ordering ? `${index + 1}. ${workout.name}` : `${workout.name} · ${workoutSizeText(sets, minutes)}`}
          </h2>
          {ordering ? (
            <span className="program-workout-move">
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move ${workout.name} up`}
                disabled={index === 0}
                onClick={() => move(workout.id, -1)}
              >
                <Icon name="ChevronUp" size={22} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move ${workout.name} down`}
                disabled={index === workouts.length - 1}
                onClick={() => move(workout.id, 1)}
              >
                <Icon name="ChevronDown" size={22} />
              </button>
            </span>
          ) : null}
        </div>
        {/* While ordering, the Workouts read as one short list: their Plans fold away. */}
        {ordering ? null : (
          <ul className="program-plans" aria-label={workout.name}>
            {workout.exercises.map(renderPlan)}
          </ul>
        )}
      </section>
    )
  }

  const { total } = familyWeekly(program, lookup, library)
  const count = `${wholeCount(total)} sets a week`
  const muscles = props.muscleVerdict ? `${count} · ${props.muscleVerdict}` : count

  return (
    <div className="program-page">
      {programMessage ? (
        <p className="program-page-message" role="status">
          {programMessage}
        </p>
      ) : null}
      {canOrder ? (
        <div className="program-order">
          <p className="program-order-note">
            {ordering ? 'Train follows this order, then starts again.' : 'Workouts rotate in this order.'}
          </p>
          <button
            type="button"
            className="program-order-toggle btn-quiet"
            aria-pressed={ordering}
            onClick={() => setOrdering(!ordering)}
          >
            {ordering ? 'Done' : 'Change order'}
          </button>
        </div>
      ) : null}
      {workouts.map(renderWorkout)}
      <ul className="program-rows">
        <li>
          <RowButton label={muscles} onClick={props.onOpenMuscles} />
        </li>
      </ul>
      <ProgramLinks {...links} />
    </div>
  )
}

export type ProgramLinksProps = {
  /** Omitted (first run, where the Programs are the page's own rows), no Programs row is drawn. */
  onOpenPrograms?(): void
  /** Omitted (no Program yet), the Deload week row is not drawn. */
  onOpenDeload?(): void
  /** The Deload week is on this week. */
  deloadOn?: boolean
  onOpenExercises(): void
  onOpenSettings(): void
  /** A backup is due: the Settings row says so. */
  backupDue?: boolean
}

/**
 * DX-04: the Program tab's list group, plain rows with chevrons: Programs (switch, copy, new),
 * Deload week, Exercises (the library) and Settings -- the one way into Settings.
 */
export function ProgramLinks(props: ProgramLinksProps): JSX.Element {
  return (
    <ul className="program-rows program-links" aria-label="More">
      {props.onOpenPrograms ? (
        <li>
          <RowButton label="Programs" onClick={props.onOpenPrograms} />
        </li>
      ) : null}
      {props.onOpenDeload ? (
        <li>
          <RowButton label="Deload week" detail={props.deloadOn ? 'On this week' : undefined} onClick={props.onOpenDeload} />
        </li>
      ) : null}
      <li>
        <RowButton label="Exercises" onClick={props.onOpenExercises} />
      </li>
      <li>
        <RowButton label="Settings" detail={props.backupDue ? 'A backup is due' : undefined} onClick={props.onOpenSettings} />
      </li>
    </ul>
  )
}

function RowButton({ label, detail, onClick }: { label: string; detail?: string; onClick?: () => void }): JSX.Element {
  return (
    <button type="button" className="program-row cell" onClick={onClick}>
      <span className="program-row-label">{label}</span>
      {detail ? <span className="program-row-detail">{detail}</span> : null}
      <Icon name="ChevronRight" size={18} />
    </button>
  )
}
