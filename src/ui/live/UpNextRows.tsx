import { baselineVolume, exerciseVolume } from '../../domain/exerciseVolume'
import { formatKg } from '../../domain/liveProgress'
import { presetForSet } from '../../domain/prefill'
import { workingSets } from '../../domain/setKind'
import { loadText } from '../../domain/setText'
import type { Exercise, Session, SetEntry, VolumeBaseline, Workout } from '../../types'
import { Bullet } from './Bullet'
import './live.css'

export type UpNextRowsProps = {
  workout: Workout
  session: Session
  /** A catalog or library id to its Exercise, a swap included. */
  resolve(id: string): Exercise | undefined
  /** Last time's Sets of each Exercise, keyed by the id done, as the exercise list has them. */
  lastEntries: Map<string, SetEntry[]>
  /** Every finished Session, for each row's volume bar. */
  sessions: Session[]
  volumeBaseline: VolumeBaseline
  /** The Exercise on the steppers, which is left out. */
  currentId: string
  /** The Session is a deload (E21): each row's Preset is the deloaded one. */
  deload?: boolean
  /** Opens `exerciseId` at Set `setIndex`. */
  onOpen(exerciseId: string, setIndex: number): void
}

/**
 * The rest of the Workout under the steppers (Progress Dashboard S3): one compact row per other
 * Exercise -- its name, "3 × 10–12 · 8 kg", a dot per planned Set (filled once logged) and its
 * volume against the chosen baseline. A tap opens its next Set.
 */
export function UpNextRows(props: UpNextRowsProps): JSX.Element {
  const { workout, session, resolve, lastEntries, sessions, volumeBaseline, currentId, onOpen } = props
  const now = Date.now()
  return (
    <ul className="upnext" aria-label="Rest of the workout">
      {workout.exercises.map((plan) => {
        const id = session.swaps?.[plan.exerciseId] ?? plan.exerciseId
        if (id === currentId) return null
        const exercise = resolve(id)
        const today = session.entries.filter((entry) => entry.exerciseId === id)
        const working = workingSets(today).length
        const preset =
          exercise === undefined
            ? null
            : presetForSet({
                exercise,
                plan,
                setIndex: today.length + 1,
                lastEntries: lastEntries.get(id) ?? [],
                today,
                deload: props.deload,
              })
        const load =
          preset === null ? '' : exercise?.bodyweight ? loadText({ weightKg: null, loadKg: preset.loadKg }) : `${loadText(preset)} kg`
        const todayVolume = exercise === undefined ? 0 : exerciseVolume(exercise, session.entries).amount
        const base = exercise === undefined ? null : baselineVolume(exercise, sessions, volumeBaseline, now)
        return (
          <li key={plan.exerciseId}>
            <button type="button" className="upnext-row cell" onClick={() => onOpen(id, today.length + 1)}>
              <span className="upnext-name">
                <span className="upnext-title">{exercise?.name ?? id}</span>
                <span className="upnext-plan">
                  {`${plan.sets} × ${plan.repRange[0]}–${plan.repRange[1]}`}
                  {load === '' ? '' : ` · ${load}`}
                </span>
              </span>
              <span className="upnext-side">
                <span className="upnext-dots" aria-label={`${working} of ${plan.sets} sets logged`}>
                  {Array.from({ length: plan.sets }, (_, at) => (
                    <i key={at} className={at < working ? 'upnext-dot upnext-dot--done' : 'upnext-dot'} />
                  ))}
                </span>
                {exercise?.bodyweight ? (
                  <span className="upnext-note">bodyweight</span>
                ) : base === null ? null : (
                  <Bullet
                    size="small"
                    today={todayVolume}
                    last={base}
                    label={`Today ${formatKg(todayVolume)} kg · baseline ${formatKg(base)} kg`}
                  />
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
