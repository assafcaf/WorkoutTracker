import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, RefObject } from 'react'
import { ChartReadout } from './ChartReadout'
import { ticksFor } from './axis'
import './LiftChart.css'

export type LiftChartPoint = {
  id: string
  /** Epoch ms: points sit on a time axis, so a deload week shows at its real width. */
  at: number
  value: number
  /** A deload Session: a hollow point inside a grey band, never joined to the line. */
  deload: boolean
  /** A real record (`liftPrs` / `isRealRecord`): the standing one wears the gold ring. */
  record: boolean
  /** v7: kept for callers; the chart draws no per-point labels. */
  label?: string
  /** The readout's title: `Fri 9 Oct`. */
  date: string
  /** The readout's line: `60 kg × 10, 10`. */
  readout: string
}

export type LiftChartProps = {
  points: LiftChartPoint[]
  /** The chart's accessible name: one sentence on where the line went. */
  summary: string
  /** How a value tick reads (and the record's `PR 90`). */
  tickText(value: number): string
  /** Joins consecutive points as steps (top-set weight) rather than slopes (est. strength). */
  step?: boolean
  /** A caption over the value ticks, e.g. `est. strength, kg`; left out, none. */
  axisLabel?: string
  /** `Deload 21–25 Sep`: the caption under each deload band. */
  bandCaption(fromAt: number, toAt: number): string
  /** Opens a point's Session from its readout. */
  onOpenSession?: (sessionId: string) => void
}

/** The index of the point whose x is nearest `x`. */
export function nearestIndex(xs: number[], x: number): number {
  let best = 0
  xs.forEach((px, i) => {
    if (Math.abs(px - x) < Math.abs(xs[best] - x)) best = i
  })
  return best
}

const HEIGHT = 168
const PAD_TOP = 26
const PAD_BOTTOM = 8
const PAD_X = 8
const FALLBACK_WIDTH = 300
const GAP_MS = 14 * 24 * 3600_000
/** The width of one character of the 0.75rem label font, as a share of the root font size. */
const CHAR_EM = 0.75 * 0.62

function useWidth(): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(FALLBACK_WIDTH)
  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    const measure = (): void => {
      const w = element.getBoundingClientRect().width
      if (w > 0) setWidth(w)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

function rootFontPx(): number {
  if (typeof document === 'undefined') return 16
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(px) && px > 0 ? px : 16
}

/** Runs of consecutive deload points, as index ranges. */
function deloadRuns(points: { deload: boolean }[]): [number, number][] {
  const runs: [number, number][] = []
  points.forEach((p, i) => {
    if (!p.deload) return
    const last = runs[runs.length - 1]
    if (last && last[1] === i - 1) last[1] = i
    else runs.push([i, i])
  })
  return runs
}

/**
 * The items (centre x, width) kept so that none touches another, taken in `order`: each one kept
 * is at least `gap` px clear of every one kept before it, inside 0..`span`. Returns kept indexes.
 */
export function placeLabels(items: { x: number; width: number }[], order: number[], gap: number, span: number): number[] {
  const leftOf = (i: number) => Math.max(0, Math.min(span - items[i].width, items[i].x - items[i].width / 2))
  const kept: number[] = []
  for (const i of order) {
    const left = leftOf(i)
    const right = left + items[i].width
    if (kept.every((k) => right + gap <= leftOf(k) || leftOf(k) + items[k].width + gap <= left)) kept.push(i)
  }
  return kept
}

/**
 * One lift over time (study §3 Chart, v7): the non-deload Sessions joined in one 2 px ink line
 * (steps for the top-set weight, slopes for est. strength), three hairline gridlines labelled on
 * the right, and no point labels. The latest point is a filled ink dot; the standing record --
 * the best real record in the range -- is a gold ring with `PR 90`. A deload is a grey band with
 * a hollow point, its caption in one lane under the axis. A gap of 14 days or more  * A gap of 14 days or more is dashed.
 * DX-18: the plot is one scrub area -- drag across it (or use the arrow keys) and the readout
 * above the chart follows the nearest Session; untouched, it reads the latest one.
 */
export function LiftChart({ points, summary, tickText, step = false, axisLabel, bandCaption, onOpenSession }: LiftChartProps): JSX.Element {
  const [ref, width] = useWidth()
  const [selected, setSelected] = useState<number | null>(null)
  if (points.length === 0) return <div className="lift-chart" />

  const charPx = rootFontPx() * CHAR_EM
  const values = points.map((p) => p.value)
  const ticks = ticksFor(Math.min(...values), Math.max(...values), 2)
  const low = ticks[0]
  const high = ticks[ticks.length - 1]
  const yOf = (v: number): number => PAD_TOP + (1 - (v - low) / (high - low || 1)) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
  const first = points[0].at
  const last = points[points.length - 1].at
  const xOf = (at: number): number => (last === first ? width / 2 : PAD_X + ((at - first) / (last - first)) * (width - 2 * PAD_X))
  const placed = points.map((p) => ({ ...p, x: xOf(p.at), y: yOf(p.value) }))
  const end = placed.length - 1
  const at = selected !== null && selected < placed.length ? selected : end
  const chosen = placed[at]
  const pick = (event: PointerEvent<HTMLDivElement>): void => {
    const left = event.currentTarget.getBoundingClientRect().left
    setSelected(nearestIndex(placed.map((p) => p.x), event.clientX - left))
  }
  const onKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? Math.min(end, at + 1)
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? Math.max(0, at - 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? end
              : null
    if (next === null) return
    event.preventDefault()
    setSelected(next)
  }

  // The line: non-deload points, as steps or slopes; a long gap is dashed.
  const line = placed.filter((p) => !p.deload)
  const solid: string[] = []
  const dashed: string[] = []
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1]
    const b = line[i]
    const d = step ? `M${a.x},${a.y} H${b.x} V${b.y}` : `M${a.x},${a.y} L${b.x},${b.y}`
    ;(b.at - a.at >= GAP_MS ? dashed : solid).push(d)
  }
  const lastLine = line.length > 0 ? placed.lastIndexOf(line[line.length - 1]) : -1

  // The standing record: the highest real record in the range, the latest of equals.
  let best = -1
  placed.forEach((p, i) => {
    if (p.record && !p.deload && (best === -1 || p.value >= placed[best].value)) best = i
  })
  const prText = best === -1 ? '' : `PR ${tickText(placed[best].value)}`
  const prWidth = prText.length * charPx + 4
  const prX = best === -1 ? 0 : Math.max(prWidth / 2, Math.min(width - prWidth / 2, placed[best].x))

  // Deload bands: half the gap either side of the run.
  const bands = deloadRuns(points).map(([a, b]) => {
    const before = a > 0 ? placed[a - 1].x : placed[a].x - 28
    const after = b < end ? placed[b + 1].x : placed[b].x + 28
    const from = Math.max(0, Math.min(placed[a].x - 6, (placed[a].x + before) / 2))
    const to = Math.min(width, Math.max(placed[b].x + 6, (placed[b].x + after) / 2))
    return { from, to, caption: bandCaption(points[a].at, points[b].at) }
  })
  const bandItems = bands.map((b) => ({ x: (b.from + b.to) / 2, width: b.caption.length * charPx + 4 }))
  const bandKept = new Set(placeLabels(bandItems, bandItems.map((_, i) => bandItems.length - 1 - i), 8, width))
  const leftOfBand = (i: number) => Math.max(0, Math.min(width - bandItems[i].width, bandItems[i].x - bandItems[i].width / 2))

  return (
    <div className="lift-chart">
      <ChartReadout date={chosen.date} value={chosen.readout} sessionId={chosen.id} onOpenSession={onOpenSession} />
      {axisLabel ? <p className="lift-chart-axis-label">{axisLabel}</p> : null}
      <div className="lift-chart-grid">
        <div className="lift-chart-canvas" ref={ref}>
          <svg className="lift-chart-svg" role="img" aria-label={summary} width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
            {bands.map((b, i) => (
              <rect key={`band${i}`} className="lift-chart-band" x={b.from} width={b.to - b.from} y={0} height={HEIGHT} />
            ))}
            {ticks.map((tick) => (
              <line key={tick} className="lift-chart-grid-line" x1={0} x2={width} y1={yOf(tick)} y2={yOf(tick)} />
            ))}
            {solid.length > 0 ? <path className="lift-chart-line" d={solid.join(' ')} /> : null}
            {dashed.length > 0 ? <path className="lift-chart-line lift-chart-gap" d={dashed.join(' ')} /> : null}
            {selected !== null ? <line className="lift-chart-cursor" x1={chosen.x} x2={chosen.x} y1={0} y2={HEIGHT} /> : null}
            {placed.map((p, i) => {
              const kind = p.deload ? 'deload' : i === best ? 'record' : i === lastLine ? 'last' : null
              if (kind === null && selected !== i) return null
              return (
                <circle
                  key={p.id}
                  className={`lift-chart-point${kind ? ` lift-chart-point-${kind}` : ''}`}
                  data-record={kind === 'record' ? '' : undefined}
                  aria-pressed={selected === i}
                  data-selected={i === at ? '' : undefined}
                  cx={p.x}
                  cy={p.y}
                  r={kind === 'record' ? 5.5 : kind === 'deload' ? 4 : 4.5}
                />
              )
            })}
            {best === -1 ? null : (
              <text className="lift-chart-pr" x={prX} y={Math.max(12, placed[best].y - 11)} textAnchor="middle">
                {prText}
              </text>
            )}
          </svg>
          <div
            className="lift-chart-scrub"
            role="slider"
            tabIndex={0}
            aria-label="Sessions on the chart"
            aria-valuemin={1}
            aria-valuemax={placed.length}
            aria-valuenow={at + 1}
            aria-valuetext={`${chosen.date} · ${chosen.readout}${chosen.deload ? ' · deload' : ''}${chosen.record ? ' · PR' : ''}`}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture?.(event.pointerId)
              pick(event)
            }}
            onPointerMove={(event) => {
              if (event.buttons > 0 || event.pointerType === 'touch') pick(event)
            }}
            onKeyDown={onKey}
          />
        </div>
        <div className="lift-chart-y" aria-hidden="true" style={{ height: HEIGHT }}>
          {ticks.map((tick) => (
            <span key={tick} className="lift-chart-tick" style={{ top: yOf(tick) }}>
              {tickText(tick)}
            </span>
          ))}
        </div>
        <div className="lift-chart-under" aria-hidden="true">
          <div className="lift-chart-dates">
            <span>{placed[0].date.replace(/^\S+ /, '')}</span>
            {end > 0 ? <span>{placed[end].date.replace(/^\S+ /, '')}</span> : null}
          </div>
          {bands.length > 0 ? (
            <div className="lift-chart-bands">
              {bands.map((b, i) =>
                bandKept.has(i) ? (
                  <span key={`bl${i}`} className="lift-chart-band-label" style={{ left: leftOfBand(i) }}>
                    {b.caption}
                  </span>
                ) : null,
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
