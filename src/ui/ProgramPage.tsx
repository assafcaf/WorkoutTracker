import { useState } from 'react'
import type { Exercise, LibraryExercise, Muscle, Program, Session, Workout } from '../types'
import { assertPlansAreInCatalog } from '../data/catalog'
import { workoutEstimate } from '../domain/dashboard'
import { toRegionCounts, type MuscleFamily, type Region } from '../domain/muscles'
import { muscleLabel } from '../domain/muscleLabels'
import type { Weekday } from '../domain/stats/weeks'
import { visiblePrograms } from '../domain/programs'
import {
  exerciseFamily,
  FAMILIES,
  familyWeekly,
  plannedContributors,
  prescribedWeekly,
  programGaps,
} from '../domain/programVolume'
import { formatRest } from '../domain/rest'
import { plannedAgainstRange, WEEKLY_SET_RANGE } from '../domain/setRange'
import { BodyMap } from './body/BodyMap'
import { BodyMapLegend } from './body/BodyMapLegend'
import { Segmented } from './controls'
import { RegionPanel } from './RegionPanel'
import { musclesForRegion } from './regionMuscles'
import { ProgramHeadActions } from './program/ProgramHead'
import {
  CHOOSE_LINE,
  CHOOSE_TITLE,
  FAMILY_LABELS,
  plural,
  programSizeLine,
  setsRepsText,
  wholeCount,
  wholeCounts,
} from './program/planText'
import './Settings.css'
import './program/ProgramFamily.css'
import './ProgramPage.css'

export type ProgramPageProps = {
  programs: Program[]
  /** Null when no Program is active yet (E9-T2); E9-T6 owns what this page shows then. */
  activeProgramId: string | null
  catalog: Map<string, Exercise>
  library: Map<string, LibraryExercise>
  onChooseProgram(id: string): void
  /**
   * Unused since V2-06: the "This week" planned-vs-done card moved to Progress › Muscles (its
   * This week segment), so the Program tab shows the plan only. Kept so callers still type-check.
   */
  sessions?: Session[]
  /** Unused since V2-06 (see `sessions`). */
  now?: number
  /** Unused since V2-06 (see `sessions`). */
  weekStartsOn?: Weekday
  /** Unused since V2-06 (see `sessions`). */
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
  /**
   * Whether the Programs panel (the header's overflow: switch, New, Edit, Copy, Delete, Reset)
   * is open. Given, the caller holds it -- so the panel is still open on returning from the
   * editor it opened; omitted, the page holds its own, closed at first.
   */
  programsOpen?: boolean
  onProgramsOpenChange?(open: boolean): void
  /**
   * More of the overflow's actions, drawn at the foot of the Programs panel -- the Program tab
   * puts "Start a deload week" here (V4-08).
   */
  programsActions?: JSX.Element | null
  /**
   * Where the head (the title, its size line, Edit and the overflow) goes: `inline` draws it at
   * the top of the page; `none` leaves it to the caller -- the Program tab hands it to the
   * shell's large page title (`ProgramHeadActions`, `programSizeLine`). Defaults to `inline`.
   */
  head?: 'inline' | 'none'
  /** "Browse exercises" on a tapped region's panel: the region's muscles (E22-T10). */
  onBrowse?(muscles: Muscle[]): void
}

/**
 * The Program tab (Progress Dashboard S7a): the active program's name and size, its planned
 * weekly sets by muscle family, and a card per workout with a table of its exercises -- family
 * dot, sets × reps, rest and the load the next session opens on. `Edit` opens the editor on the
 * active program; the overflow opens the Programs panel, the always-visible radio list of every
 * loaded program with each one's own actions (operator ruling, E5-T18: no "Other programs"
 * disclosure inside it). Below the workouts sit the planned muscle map with its gaps (M14); what
 * was done lives on Progress › Muscles (V2-06).
 */
export function ProgramPage(props: ProgramPageProps): JSX.Element {
  const {
    programs,
    activeProgramId,
    catalog,
    library,
    onChooseProgram,
    onNewProgram,
    onEditProgram,
    onCopyProgram,
    onDeleteProgram,
    onResetProgram,
    userProgramIds = new Set<string>(),
    bundledProgramIds = new Set<string>(),
    programMessage = null,
    head = 'inline',
    onBrowse,
  } = props
  // The tapped region on the planned map (E22-T10, O24).
  const [tapped, setTapped] = useState<Region | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [ownProgramsOpen, setOwnProgramsOpen] = useState(false)
  const programsOpen = props.programsOpen ?? ownProgramsOpen
  function setProgramsOpen(open: boolean): void {
    setOwnProgramsOpen(open)
    props.onProgramsOpenChange?.(open)
  }

  // Fail before anything renders, so a program referencing an id the catalog lacks leaves no
  // half-built page behind -- the same rule `ProgramPicker` enforced.
  for (const program of programs) assertPlansAreInCatalog(program, catalog)

  // No active Program (a new user, E9-T2) skips the active Program's own sections below.
  const active =
    activeProgramId === null ? null : programs.find((program) => program.id === activeProgramId)
  if (active === undefined) {
    throw new Error(`no program ${activeProgramId} among the loaded programs`)
  }

  const lookup = (id: string) => catalog.get(id)
  const workouts = active ? active.workouts.filter((workout) => !workout.hidden) : []

  // The whole active program's prescribed weekly volume (M14/M15's prescribed side).
  const prescribedMuscleCounts = active
    ? prescribedWeekly(active, catalog, library)
    : new Map<Muscle, number>()
  const prescribedRegionCounts = toRegionCounts(prescribedMuscleCounts)
  const gaps = programGaps(prescribedMuscleCounts)
  const planRange = active ? plannedAgainstRange(active, lookup, library) : []

  /** The panel for the tapped region: its planned Sets and Exercises. */
  function renderRegionPanel(): JSX.Element | null {
    if (tapped === null || !active) return null
    const region = tapped
    const muscles = musclesForRegion(region)
    const tenth = (value: number) => Math.round(value * 10) / 10
    const count = prescribedRegionCounts.get(region) ?? 0
    const rows = plannedContributors(active, muscles, catalog, library).map(({ exerciseId, sets }) => ({
      exerciseId,
      name: catalog.get(exerciseId)?.name ?? exerciseId,
      sets,
    }))
    return (
      <RegionPanel
        region={region}
        count={tenth(count)}
        contributors={rows.map((row) => ({ ...row, sets: tenth(row.sets) }))}
        onBrowse={(browse) => onBrowse?.(browse)}
        onClose={() => setTapped(null)}
      />
    )
  }

  function renderWeeklySets(program: Program): JSX.Element {
    const { total, families } = familyWeekly(program, lookup, library)
    const counts = wholeCounts(FAMILIES.map((family) => families[family]))
    const countOf = (family: MuscleFamily) => counts[FAMILIES.indexOf(family)]
    const described = FAMILIES.map((family) => `${FAMILY_LABELS[family]} ${countOf(family)}`)
    return (
      <section className="program-page-volume card" aria-labelledby="program-page-volume-title">
        <div className="program-page-card-head">
          <h3 className="program-page-card-title" id="program-page-volume-title">
            Weekly sets, planned
          </h3>
          <span className="program-page-card-total">{`${wholeCount(total)} sets`}</span>
        </div>
        <div
          className="program-page-volume-bar"
          role="img"
          aria-label={`${described.join(', ')} sets a week`}
        >
          {FAMILIES.filter((family) => families[family] > 0).map((family) => (
            <span
              key={family}
              className="program-page-volume-segment program-family"
              data-family={family}
              style={{ flexGrow: families[family] }}
            />
          ))}
        </div>
        <ul className="program-page-legend">
          {FAMILIES.map((family) => (
            <li key={family} className="program-page-legend-item" data-family={family}>
              <span className="muscle-dot program-family" data-family={family} aria-hidden="true" />
              {FAMILY_LABELS[family]}
              <b className="program-page-legend-count">{countOf(family)}</b>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  function renderWorkout(program: Program, workout: Workout): JSX.Element {
    const { sets, minutes } = workoutEstimate(workout)
    return (
      <section key={`${program.id}/${workout.id}`} className="workout-card card">
        <div className="program-page-card-head">
          <h3 className="program-page-workout-title">{workout.name}</h3>
          <span className="program-page-card-note">{`${sets} sets · ~${minutes} min`}</span>
        </div>
        <table className="program-page-table">
          <thead>
            <tr>
              <th scope="col" className="program-page-th">
                Exercise
              </th>
              <th scope="col" className="program-page-th program-page-num">
                Sets × reps
              </th>
              <th scope="col" className="program-page-th program-page-num">
                Rest
              </th>
            </tr>
          </thead>
          <tbody>
            {workout.exercises.map((plan, index) => {
              const exercise = catalog.get(plan.exerciseId)
              const family = exerciseFamily(exercise, library)
              return (
                <tr key={`${plan.exerciseId}-${index}`} className="program-page-row" data-exercise-id={plan.exerciseId}>
                  <td className="program-page-exercise">
                    <span
                      className="muscle-dot program-family"
                      data-family={family ?? undefined}
                      aria-hidden="true"
                    />
                    {exercise?.name ?? plan.exerciseId}
                  </td>
                  <td className="program-page-num">{setsRepsText(plan)}</td>
                  <td className="program-page-num program-page-rest">{formatRest(plan.restSeconds)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
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
        {/* One segment per row, all sharing a name, so the rows still form one native radio
            group while each keeps its own action buttons beside it. */}
        <Segmented
          name="program-page-active-program"
          label="Active program"
          value={activeProgramId ?? ''}
          options={[{ value: program.id, label: program.name }]}
          onChange={() => {
            if (!checked) onChooseProgram(program.id)
          }}
        />
        <button
          type="button"
          className="program-page-edit btn-secondary"
          onClick={() => onEditProgram?.(program.id)}
        >
          Edit
        </button>
        <button
          type="button"
          className="program-page-copy btn-secondary"
          onClick={() => onCopyProgram?.(program.id)}
        >
          Copy
        </button>
        {isUser && !isBundled && !confirming && (
          <button
            type="button"
            className="program-page-delete btn-danger"
            onClick={() => setConfirmingId(program.id)}
          >
            Delete
          </button>
        )}
        {isUser && isBundled && !confirming && (
          <button
            type="button"
            className="program-page-reset btn-danger"
            onClick={() => setConfirmingId(program.id)}
          >
            Reset to original
          </button>
        )}
        {confirming && (
          <button
            type="button"
            className="program-page-confirm btn-danger"
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

  const message =
    programMessage === null || programMessage === '' ? null : (
      <p className="program-page-message" role="status">
        {programMessage}
      </p>
    )

  return (
    <div className="program-page">
      {active && head === 'inline' && (
        <div className="program-page-head">
          <div className="program-page-head-text">
            <h2 className="program-page-title">{active.name}</h2>
            <p className="program-page-subtitle">{programSizeLine(active)}</p>
          </div>
          <div className="program-page-head-actions">
            <ProgramHeadActions
              name={active.name}
              onEdit={() => onEditProgram?.(active.id)}
              programsOpen={programsOpen}
              onOpenPrograms={() => setProgramsOpen(true)}
            />
          </div>
        </div>
      )}

      {activeProgramId !== null && programsOpen && (
        <div
          className="program-page-programs overlay-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="program-page-programs-title"
        >
          <div className="program-page-programs-head">
            <h2 className="program-page-programs-title" id="program-page-programs-title">
              Programs
            </h2>
            <button
              type="button"
              className="program-page-programs-done btn-quiet"
              onClick={() => setProgramsOpen(false)}
            >
              Done
            </button>
          </div>
          <fieldset className="settings-group program-page-switcher">
            <legend className="settings-legend">Active program</legend>
            {programs.map((program) => renderProgramRow(program))}
          </fieldset>
          {message}
          <button type="button" className="program-page-new btn-secondary" onClick={() => onNewProgram?.()}>
            New program
          </button>
          {props.programsActions ?? null}
        </div>
      )}

      {activeProgramId !== null && !programsOpen && message}

      {active && (
        <>
          {renderWeeklySets(active)}
          {workouts.map((workout) => renderWorkout(active, workout))}

          <section className="program-page-weekly card">
            <h3 className="program-page-section-heading">Muscles, planned per week</h3>
            <div className="program-page-map">
              <BodyMap
                counts={prescribedRegionCounts}
                scale="week"
                onRegionTap={setTapped}
              />
            </div>
            <BodyMapLegend scale="week" />
            <p className="program-page-range-note">
              Sets per week, against {WEEKLY_SET_RANGE.min}–{WEEKLY_SET_RANGE.max}
            </p>
            <ul className="program-page-range">
              {planRange.map(({ muscle, planned, standing }) => (
                <li key={muscle} className="program-page-range-row" data-standing={standing}>
                  <span>{muscleLabel(muscle)}</span>
                  <span>
                    {planned}
                    {standing === 'below' && ` · below ${WEEKLY_SET_RANGE.min}`}
                    {standing === 'above' && ` · above ${WEEKLY_SET_RANGE.max}`}
                  </span>
                </li>
              ))}
            </ul>
            {gaps.length > 0 && (
              <ul className="program-page-gaps">
                {gaps.map((muscle) => (
                  <li key={muscle} className="program-page-gap">{`No direct ${muscleLabel(muscle).toLowerCase()} work`}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {renderRegionPanel()}

      {activeProgramId === null && (
        <section className="program-page-newuser">
          {head === 'inline' && (
            <>
              <h2 className="program-page-title">{CHOOSE_TITLE}</h2>
              <p className="program-page-subtitle">{CHOOSE_LINE}</p>
            </>
          )}
          <div className="program-page-newuser-list">
            {visiblePrograms(programs).map((program) => (
              <div key={program.id} className="program-page-newuser-card card">
                <span className="program-page-newuser-name">{program.name}</span>
                <span className="program-page-newuser-size">{newUserSize(program)}</span>
                <button
                  type="button"
                  className="program-page-use program-page-use-primary btn-primary"
                  onClick={() => onChooseProgram(program.id)}
                >
                  {`Use this ${program.name}`}
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="program-page-new program-page-new-secondary btn-secondary"
            onClick={() => onNewProgram?.()}
          >
            New program
          </button>
        </section>
      )}
    </div>
  )
}

/** A program's size on the new-user chooser: `3× per week · 2 workouts`. */
function newUserSize(program: Program): string {
  const workouts = program.workouts.filter((workout) => !workout.hidden).length
  return `${program.sessionsPerWeek}× per week · ${plural(workouts, 'workout', 'workouts')}`
}
