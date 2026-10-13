// Axis arithmetic shared by LineChart and BarChart (E17-T10, O19): clean value ticks for the
// y-axis, and which points the x-axis labels with their dates.
import { formatDay } from '../../domain/dates'

const TICK_TARGET = 4
/** Up to this many points, the x-axis labels every one; past it, only the first and last. */
const MAX_X_LABELS = 6

/** A clean step (1, 2 or 5 times a power of ten) giving about `TICK_TARGET` ticks over `span`. */
function niceStep(span: number): number {
  const raw = span / TICK_TARGET
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

/** Clean ticks covering `min`..`max`, lowest first. A flat series gets a band around its value. */
export function ticksFor(min: number, max: number): number[] {
  const span = max - min
  const step = niceStep(span > 0 ? span : Math.max(Math.abs(max), 1))
  const low = Math.floor(min / step) * step
  const high = Math.max(Math.ceil(max / step) * step, low + step)
  const ticks: number[] = []
  for (let tick = low; tick <= high + step / 2; tick += step) {
    ticks.push(Number(tick.toPrecision(12)))
  }
  return ticks
}

export function formatValue(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/** The indexes, of `count` points, the x-axis labels: all of a few, else the first and last. */
export function labelledIndexes(count: number): number[] {
  if (count <= MAX_X_LABELS) return Array.from({ length: count }, (_, index) => index)
  return [0, count - 1]
}

/** A point's `at` (epoch ms) as the x-axis reads it, e.g. "Tue 13 Oct". */
export function dateLabel(at: number, now: Date): string {
  return formatDay(new Date(at), now)
}
