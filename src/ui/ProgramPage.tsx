import type { Exercise, ExercisePlan, LibraryExercise, Program, Session, Workout } from '../types'
import { assertPlansAreInCatalog } from '../data/catalog'
import { toRegionCounts, weekSets } from '../domain/muscles'
import { prescribedWeekly, programGaps } from '../domain/programVolume'
import { BodyMap } from './body/BodyMap'
import './Settings.css'
import './ProgramPage.css'

export type ProgramPageProps = {
  programs: Program[]
  activeProgramId: string
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
  } = props

  // Fail before anything renders, so a program referencing an id the catalog lacks leaves no
  // half-built page behind -- the same rule `ProgramPicker` enforced.
  for (const program of programs) assertPlansAreInCatalog(program, catalog)

  const active = programs.find((program) => program.id === activeProgramId)
  if (!active) throw new Error(`no program ${activeProgramId} among the loaded programs`)

  // The whole active program's prescribed weekly volume (M14/M15's prescribed side) -- distinct
  // from a single workout card's session-scale map (`renderWorkout` below), which is why the
  // fixtures band the same muscle differently at the two scales.
  const prescribedMuscleCounts = prescribedWeekly(active, catalog, library)
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
      </section>
    )
  }

  return (
    <div className="program-page">
      <h2>{active.name}</h2>
      {active.workouts.map((workout) => renderWorkout(active, workout))}

      <section className="program-page-weekly">
        <h3>Weekly volume</h3>
        <div className="program-page-map">
          <BodyMap counts={prescribedRegionCounts} scale="week" />
        </div>
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
          <div className="program-page-map">
            <BodyMap counts={prescribedRegionCounts} scale="week" />
          </div>
          <div className="program-page-map">
            <BodyMap counts={doneRegionCounts} scale="week" />
          </div>
        </div>
        {noSetsThisWeek && <p>No sets logged in the last 7 days</p>}
      </section>

      <fieldset className="settings-group">
        <legend className="settings-legend">Active program</legend>
        {programs.map((program) => {
          const checked = program.id === activeProgramId
          return (
            <label
              key={program.id}
              className={`settings-action${checked ? ' settings-action-active' : ''}`}
            >
              <input
                type="radio"
                name="program-page-active-program"
                value={program.id}
                checked={checked}
                onChange={() => {
                  if (!checked) onChooseProgram(program.id)
                }}
              />
              <span className="settings-action-label">{program.name}</span>
            </label>
          )
        })}
      </fieldset>
    </div>
  )
}
