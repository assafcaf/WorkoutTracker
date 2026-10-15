// The view model the Ladder chart draws (E18-T8, O19). Ladder owns this shape; the lift page
// (E18-T11) maps the stats engine's ladder data onto it, so the chart never learns a rule.
// A lever is the comparable weight in kg (BW as 0, assistance negative), higher is better.

/** What the docked readout lists for one Session. Every string is copy the mapper wrote. */
export type LadderReadoutRows = {
  /** The Session's id, handed back by the readout's `Open session` button. */
  sessionId: string
  /** `Wed 14 Oct · Workout A`. */
  title: string
  /** One line per working set, e.g. `62.5 kg × 8`. */
  workingSets: string[]
  /** The record the Session set, e.g. `Heaviest weight +2.5 kg`; null when none. */
  record: string | null
  /** The estimated 1RM, e.g. `79.2 kg`; null on a lift with no e1RM. Drawn labelled `estimated`. */
  e1rm: string | null
  /** The warm-ups, e.g. `20 × 10 · 37.5 × 5`; null when none. Drawn as `not counted`. */
  warmups: string | null
  /** The Session's note, when it has one. */
  note: string | null
}

/** One Session: a dot on the ladder and a reps bar under it. */
export type LadderPoint = {
  id: string
  /** Start of the Session, epoch ms. */
  at: number
  /** The top set's lever. */
  lever: number
  /** Reps at the top lever (the bar). */
  reps: number
  /** The tread's target reps (the tick on the bar); null when the lift has no Plan. */
  target: number | null
  /** A deload Session: hollow dot off the step line, hatched band. */
  deload: boolean
  /** The Session set a record. */
  record: boolean
  readout: LadderReadoutRows
}

/** A stretch with no Session, drawn as a break in the line with its label. */
export type LadderGap = { from: number; to: number; label: string }

/** A value tick on the lever axis, e.g. `{ lever: -27, label: 'BW−27' }`. */
export type LadderTick = { lever: number; label: string }

/** A stretch of Sessions at one lever. */
export type LadderTread = { lever: number; from: number; to: number; current: boolean }

export type LadderView = {
  /** The calendar the x axis spans, epoch ms. */
  from: number
  to: number
  /** `assistance · less is better` on an assisted lift, else null. */
  axisLabel: string | null
  /** Lever ticks, lowest first; the weight panel spans the first to the last. */
  ticks: LadderTick[]
  treads: LadderTread[]
  /** In date order. */
  points: LadderPoint[]
  gaps: LadderGap[]
  /** X-axis labels: a date (epoch ms) and its text. */
  dates: { at: number; label: string }[]
  /** A reference tick at an earlier date's top set (`4 weeks ago`); absent draws nothing. */
  reference?: { at: number; lever: number; label: string } | null
  /** A bracket over a stall, `from`..`to` (epoch ms), above the weight panel; absent draws nothing. */
  bracket?: { from: number; to: number; label: string } | null
}

/** The index of the point nearest `at`, or -1 with no points. A tie goes to the earlier. */
export function nearestPointIndex(points: LadderPoint[], at: number): number {
  let best = -1
  for (let index = 0; index < points.length; index++) {
    if (best === -1 || Math.abs(points[index].at - at) < Math.abs(points[best].at - at)) best = index
  }
  return best
}
