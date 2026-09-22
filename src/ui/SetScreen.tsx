import { useEffect, useState } from 'react'
import { validateEntry } from '../domain/dial'
import { presetForSet } from '../domain/prefill'
import { restState } from '../domain/rest'
import { logSet } from '../storage/sessionStore'
import { RepsDial } from './RepsDial'
import { WeightDial } from './WeightDial'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

export type SetScreenProps = {
  exercise: Exercise
  plan: ExercisePlan
  setIndex: number
  sessionId: string
  lastEntries: SetEntry[]
  onLogged(session: Session, nextSetIndex: number): void
}

/** How often the rest timer re-reads the clock; it derives everything from timestamps. */
const TICK_MS = 500

/** The set on the dials: which one it is and the two values it will be logged with. */
type OpenSet = { setIndex: number; weightKg: number | null; reps: number }

/** The remaining rest as "m:ss", counting the part-second still to go as a whole one. */
function formatRest(remainingSeconds: number): string {
  const total = Math.ceil(remainingSeconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * The entries the next set presets from: the just-logged one laid over the history, so set 3
 * opens on what set 2 was actually lifted with rather than on last week's numbers.
 */
function mergeEntry(entries: SetEntry[], entry: SetEntry): SetEntry[] {
  const merged = [...entries]
  const at = merged.findIndex(
    (stored) => stored.exerciseId === entry.exerciseId && stored.setIndex === entry.setIndex,
  )
  if (at >= 0) merged[at] = entry
  else merged.push(entry)
  return merged
}

function openSetFor(
  exercise: Exercise,
  plan: ExercisePlan,
  setIndex: number,
  lastEntries: SetEntry[],
): OpenSet {
  return { setIndex, ...presetForSet({ exercise, plan, setIndex, lastEntries }) }
}

/**
 * The screen one set is logged from: the two dials, the keypad behind each readout, the rest
 * timer and the log button.
 *
 * The screen owns which set is open. Logging persists the set through the session store, then
 * opens the next one preset from the entry just logged; `onLogged` tells the caller, which
 * owns the navigation. An entry `validateEntry` rejects is shown inline and written nowhere --
 * the rule is E1-T2's, the message is this screen's.
 */
export function SetScreen(props: SetScreenProps): JSX.Element {
  const { exercise, plan, sessionId, onLogged } = props

  const [history, setHistory] = useState<SetEntry[]>(props.lastEntries)
  const [open, setOpen] = useState<OpenSet>(() =>
    openSetFor(exercise, plan, props.setIndex, props.lastEntries),
  )
  const [error, setError] = useState<string | null>(null)
  const [lastLoggedAt, setLastLoggedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())

  // The rest left is a function of the clock, so a slept phone cannot desync it: re-read the
  // time on a tick rather than counting down a number of our own.
  useEffect(() => {
    if (lastLoggedAt === null) return
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(tick)
  }, [lastLoggedAt])

  const rest = restState(lastLoggedAt, plan.restSeconds, now)

  async function log(): Promise<void> {
    const validation = validateEntry(open.weightKg, open.reps)
    if (!validation.ok) {
      setError(validation.error)
      return
    }

    const loggedAt = Date.now()
    const entry: SetEntry = {
      exerciseId: exercise.id,
      setIndex: open.setIndex,
      weightKg: open.weightKg,
      reps: open.reps,
      loggedAt,
    }

    try {
      const session = await logSet(sessionId, entry)
      const merged = mergeEntry(history, entry)
      const nextSetIndex = open.setIndex + 1
      setError(null)
      setHistory(merged)
      setLastLoggedAt(loggedAt)
      setOpen(openSetFor(exercise, plan, nextSetIndex, merged))
      onLogged(session, nextSetIndex)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <div className="set-screen">
      <h2>{exercise.name}</h2>
      <p className="set-counter">{`Set ${open.setIndex} of ${plan.sets}`}</p>

      <WeightDial
        exercise={exercise}
        value={open.weightKg}
        onChange={(weightKg) => setOpen({ ...open, weightKg })}
      />
      <RepsDial value={open.reps} onChange={(reps) => setOpen({ ...open, reps })} />

      {error === null ? null : (
        <p className="set-error" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="log-set" onClick={() => void log()}>
        Log set
      </button>

      <p className="rest-timer">
        <span role="timer" aria-label="Rest remaining">
          {formatRest(rest.remainingSeconds)}
        </span>
        {rest.isOver ? ' rest over' : ' rest'}
      </p>
    </div>
  )
}
