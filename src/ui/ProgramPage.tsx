import { useState } from 'react'
import type {
  Exercise,
  ExercisePlan,
  LibraryExercise,
  Muscle,
  Program,
  Session,
  Workout,
} from '../types'
import { assertPlansAreInCatalog } from '../data/catalog'
import { toRegionCounts, weekSets } from '../domain/muscles'
import { visiblePrograms } from '../domain/programs'
import { prescribedWeekly, programGaps } from '../domain/programVolume'
import { BodyMap } from './body/BodyMap'
import { BodyMapLegend } from './body/BodyMapLegend'
import './Settings.css'
import './ProgramPage.css'

export type ProgramPageProps = {
  programs: Program[]
  /** Null when no Program is active yet (E9-T2); E9-T6 owns what this page shows then. */
  activeProgramId: string | null
  catalog: Map<string, Exercise>
  library: Map<string, LibraryExercise>
  onChooseProgram(id: string): void
  /**
   * This week's logged sets, for the "This week" done map (M15). Optional -- and defaults to
   * `[]` -- only because this task does not own `App.tsx`; E5-T20 wires it from there.
   */
  sessions?: Session[]
  /** "Now", for `weekSets`'s 7-day window (M15). Defaults to `Date.now()`. */
  now?: number
  /** Resolves a set entry's exerciseId for `weekSets` (M15). Defaults to a catalog lookup. */
  resolve?: (id: string) => Exercise | undefined
  /** Program tab actions (E9-T3). Optional here -- E9-T9 wires all of these from `App.tsx`. */
  onNewProgram?(): void
  onEditProgram?(id: string): void
  onCopyProgram?(id: string): void
  onDeleteProgram?(id: string): void
  onResetProgram?(id: string): void
  /** A Program's id is in this set when the trainee can Edit/Copy/Delete/Reset it (E9-T3). */
  userProgramIds?: Set<string>
  /** A Program's id is in this set when it ships with the app (E9-T3). */
  bundledProgramIds?: Set<string>
  /** An error line shown on the Program tab when set (E9-T3; E9-T10 wires it from `App.tsx`). */
  programMessage?: string | null
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
 * exercises with a small body map of that workout's sets, and a program switcher -- an
 * always-visible radio list of every loaded program, the active one checked, the same shape as
 * Settings' "Active program" group (operator ruling: no "Other programs" disclosure). Carried
 * over from `ProgramPicker` (E1-T2), which this replaces on the Workout tab (M12).
 */
export function ProgramPage(props: ProgramPageProps): JSX.Element {
  const {
    programs,
    activeProgramId,
    catalog,
    library,
    onChooseProgram,
    sessions = [],
    now = Date.now(),
    resolve = (id: string) => catalog.get(id),
    onNewProgram,
    onEditProgram,
    onCopyProgram,
    onDeleteProgram,
    onResetProgram,
    userProgramIds = new Set<string>(),
    bundledProgramIds = new Set<string>(),
    programMessage = null,
  } = props
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // Fail before anything renders, so a program referencing an id the catalog lacks leaves no
  // half-built page behind -- the same rule `ProgramPicker` enforced.
  for (const program of programs) assertPlansAreInCatalog(program, catalog)

  // No active Program (a new user, E9-T2) skips the active Program's own sections below.
  const active =
    activeProgramId === null ? null : programs.find((program) => program.id === activeProgramId)
  if (active === undefined) {
    throw new Error(`no program ${activeProgramId} among the loaded programs`)
  }

  // The whole active program's prescribed weekly volume (M14/M15's prescribed side) -- distinct
  // from a single workout card's session-scale map (`renderWorkout` below), which is why the
  // fixtures band the same muscle differently at the two scales.
  const prescribedMuscleCounts = active
    ? prescribedWeekly(active, catalog, library)
    : new Map<Muscle, number>()
  const prescribedRegionCounts = toRegionCounts(prescribedMuscleCounts)
  const gaps = programGaps(prescribedMuscleCounts)

  // "This week"'s done side (M15): real sets logged in the last 7 days up to `now`.
  const doneMuscleCounts = weekSets(sessions, now, resolve, library)
  const doneRegionCounts = toRegionCounts(doneMuscleCounts)
  const noSetsThisWeek = doneMuscleCounts.size === 0

  function renderWorkout(program: Program, workout: Workout): JSX.Element {
    // One workout's sets at weight 1: the workout as a program of its own, done once a week.
    const oneWorkout: Program = { ...program, workouts: [workout], sessionsPerWeek: 1 }
    const counts = toRegionCounts(prescribedWeekly(oneWorkout, catalog, library))
    return (
      <section key={`${program.id}/${workout.id}`} className="workout-card">
        <h3>{workout.name}</h3>
        <ul>
          {workout.exercises.map((plan) => (
            <li key={plan.exerciseId}>{planLine(plan, catalog)}</li>
          ))}
        </ul>
        <div className="program-page-map">
          <BodyMap counts={counts} scale="session" />
        </div>
        <BodyMapLegend scale="session" />
      </section>
    )
  }

  function renderProgramRow(program: Program): JSX.Element {
    const checked = program.id === activeProgramId
    const isUser = userProgramIds.has(program.id)
    const isBundled = bundledProgramIds.has(program.id)
    const confirming = confirmingId === program.id
    return (
      <div key={program.id} data-program-id={program.id} className="program-page-switcher-row">
        <label className={`settings-action${checked ? ' settings-action-active' : ''}`}>
          <input
            type="radio"
            className="settings-radio"
            name="program-page-active-program"
            value={program.id}
            checked={checked}
            onChange={() => {
              if (!checked) onChooseProgram(program.id)
            }}
          />
          <span className="settings-action-label">{program.name}</span>
        </label>
        <button
          type="button"
          className="program-page-edit"
          onClick={() => onEditProgram?.(program.id)}
        >
          Edit
        </button>
        <button
          type="button"
          className="program-page-copy"
          onClick={() => onCopyProgram?.(program.id)}
        >
          Copy
        </button>
        {isUser && !isBundled && !confirming && (
          <button
            type="button"
            className="program-page-delete"
            onClick={() => setConfirmingId(program.id)}
          >
            Delete
          </button>
        )}
        {isUser && isBundled && !confirming && (
          <button
            type="button"
            className="program-page-reset"
            onClick={() => setConfirmingId(program.id)}
          >
            Reset to original
          </button>
        )}
        {confirming && (
          <button
            type="button"
            className="program-page-confirm"
            onClick={() => {
              setConfirmingId(null)
              if (isBundled) onResetProgram?.(program.id)
              else onDeleteProgram?.(program.id)
            }}
          >
            Confirm
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="program-page">
      {activeProgramId !== null && (
        <fieldset className="settings-group program-page-switcher">
          <legend className="settings-legend">Active program</legend>
          <button type="button" className="program-page-new" onClick={() => onNewProgram?.()}>
            New program
          </button>
          {programs.map((program) => renderProgramRow(program))}
        </fieldset>
      )}

      {activeProgramId !== null && programMessage && (
        <p className="program-page-message" role="status">
          {programMessage}
        </p>
      )}

      {active && (
        <>
          <h2>{active.name}</h2>
          {active.workouts.map((workout) => renderWorkout(active, workout))}

          <section className="program-page-weekly">
            <h3>Weekly volume</h3>
            <div className="program-page-map">
              <BodyMap counts={prescribedRegionCounts} scale="week" />
            </div>
            <BodyMapLegend scale="week" />
            {gaps.length > 0 && (
              <ul className="program-page-gaps">
                {gaps.map((muscle) => (
                  <li key={muscle}>{`No direct ${muscle} work`}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="program-page-thisweek">
            <h3>This week</h3>
            <div className="program-page-thisweek-maps">
              <figure className="program-page-map">
                <BodyMap counts={prescribedRegionCounts} scale="week" />
                <figcaption>Planned</figcaption>
              </figure>
              <figure className="program-page-map">
                <BodyMap counts={doneRegionCounts} scale="week" />
                <figcaption>Done</figcaption>
              </figure>
            </div>
            <BodyMapLegend scale="week" />
            {noSetsThisWeek && <p>No sets logged in the last 7 days</p>}
          </section>
        </>
      )}

      {activeProgramId === null && (
        <section className="program-page-newuser">
          <h2>Choose a program</h2>
          <ul className="program-page-newuser-list">
            {visiblePrograms(programs).map((program) => (
              <li key={program.id}>
                <button
                  type="button"
                  className="program-page-use"
                  onClick={() => onChooseProgram(program.id)}
                >
                  {`Use this ${program.name}`}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="program-page-new" onClick={() => onNewProgram?.()}>
            New program
          </button>
        </section>
      )}

    </div>
  )
}
