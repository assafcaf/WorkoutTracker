import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { ChartReadout } from './ChartReadout'
import { ticksFor } from './axis'
import './LiftChart.css'

export type LiftChartPoint = {
  id: string
  /** Epoch ms: points sit on a time axis, so a deload week shows at its real width. */
  at: number
  value: number
  /** A deload Session: a hollow point inside a shaded band, never joined to the line. */
  deload: boolean
  /** A real record: filled in the accent. */
  record: boolean
  /** Drawn over the point where it fits: the top-set reps (`8`) or the top set (`62.5×8`). */
  label: string
  /** The readout's title: `Fri 9 Oct`. */
  date: string
  /** The readout's line: `60 kg × 10, 10`. */
  readout: string
}

export type LiftChartProps = {
  points: LiftChartPoint[]
  /** The chart's accessible name: one sentence on where the line went. */
  summary: string
  /** How a value tick reads. */
  tickText(value: number): string
  /** Joins consecutive points as steps (top-set weight) rather than slopes (est. max). */
  step?: boolean
  /** A caption over the value ticks, e.g. `est. max, kg`. */
  axisLabel?: string
  /** `Deload 21–25 Sep`: the caption under each deload band, by the band's first point id. */
  bandCaption(fromAt: number, toAt: number): string
  /** Opens a point's Session from its readout. */
  onOpenSession?: (sessionId: string) => void
}

const HEIGHT = 168
const PAD_TOP = 24
const PAD_BOTTOM = 10
const PAD_X = 14
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
 * One lift over time (v6 §6.3): the non-deload Sessions joined as steps (weight) or a line (est.
 * max), each point labelled where its label fits, real records filled in the accent. Deload
 * Sessions are hollow, unjoined, inside a shaded band whose caption sits in one lane under the
 * axis -- never inside the plot, never overprinting. A gap of 14 days or more (a missed week of the lift) is a dashed segment.
 * Each point owns a full-height column to tap or focus; the readout sits above the chart.
 */
export function LiftChart({ points, summary, tickText, step = false, axisLabel, bandCaption, onOpenSession }: LiftChartProps): JSX.Element {
  const [ref, width] = useWidth()
  const [selected, setSelected] = useState<number | null>(null)
  if (points.length === 0) return <div className="lift-chart" />

  const charPx = rootFontPx() * CHAR_EM
  const values = points.map((p) => p.value)
  const ticks = ticksFor(Math.min(...values), Math.max(...values), 3)
  const low = ticks[0]
  const high = ticks[ticks.length - 1]
  const yOf = (v: number): number => PAD_TOP + (1 - (v - low) / (high - low || 1)) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
  const first = points[0].at
  const last = points[points.length - 1].at
  const xOf = (at: number): number => (last === first ? width / 2 : PAD_X + ((at - first) / (last - first)) * (width - 2 * PAD_X))
  const placed = points.map((p) => ({ ...p, x: xOf(p.at), y: yOf(p.value) }))
  const end = placed.length - 1
  const chosen = selected !== null && selected < placed.length ? placed[selected] : null
  const toggle = (i: number): void => setSelected((current) => (current === i ? null : i))

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

  // Point labels: the latest first, then newest to oldest, each only where it fits.
  const labelItems = placed.map((p) => ({ x: p.x, width: p.label.length * charPx + 4 }))
  const order = placed.map((_, i) => end - i).filter((i) => !placed[i].deload)
  const labelled = new Set(placeLabels(labelItems, order, 4, width))

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
      {chosen ? (
        <ChartReadout
          date={chosen.date}
          value={chosen.readout}
          sessionId={chosen.id}
          onOpenSession={onOpenSession}
        />
      ) : null}
      {axisLabel ? <p className="lift-chart-axis-label">{axisLabel}</p> : null}
      <div className="lift-chart-grid">
        <div className="lift-chart-y" aria-hidden="true" style={{ height: HEIGHT }}>
          {ticks.map((tick) => (
            <span key={tick} className="lift-chart-tick" style={{ top: yOf(tick) }}>
              {tickText(tick)}
            </span>
          ))}
        </div>
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
            {placed.map((p, i) => (
              <circle
                key={p.id}
                className={`lift-chart-point${p.deload ? ' lift-chart-point-deload' : p.record ? ' lift-chart-point-record' : ''}`}
                data-record={p.record ? '' : undefined}
                aria-pressed={selected === i}
                cx={p.x}
                cy={p.y}
                r={p.record || i === end ? 5 : 3.5}
              />
            ))}
            {placed.map((p, i) => {
              if (!labelled.has(i)) return null
              const half = labelItems[i].width / 2
              const anchor = p.x + half > width ? 'end' : p.x - half < 0 ? 'start' : 'middle'
              const x = anchor === 'end' ? width : anchor === 'start' ? 0 : p.x
              return (
                <text key={`l${p.id}`} className="lift-chart-label" x={x} y={Math.max(12, p.y - 9)} textAnchor={anchor}>
                  {p.label}
                </text>
              )
            })}
          </svg>
          <div className="lift-chart-hits">
            {placed.map((p, i) => {
              const from = i === 0 ? 0 : (placed[i - 1].x + p.x) / 2
              const to = i === end ? width : (p.x + placed[i + 1].x) / 2
              return (
                <button
                  key={p.id}
                  type="button"
                  className="lift-chart-hit btn-quiet"
                  style={{ left: from, width: Math.max(0, to - from) }}
                  aria-label={`${p.date} · ${p.readout}${p.deload ? ' · deload' : ''}${p.record ? ' · PR' : ''}`}
                  aria-pressed={selected === i}
                  onClick={() => toggle(i)}
                  onKeyDown={(event: KeyboardEvent) => {
                    if (event.key === 'ArrowRight' && i < end) {
                      event.preventDefault()
                      setSelected(i + 1)
                      ;(event.currentTarget.nextElementSibling as HTMLElement | null)?.focus()
                    } else if (event.key === 'ArrowLeft' && i > 0) {
                      event.preventDefault()
                      setSelected(i - 1)
                      ;(event.currentTarget.previousElementSibling as HTMLElement | null)?.focus()
                    }
                  }}
                  tabIndex={i === (selected ?? end) ? 0 : -1}
                />
              )
            })}
          </div>
        </div>
        <span aria-hidden="true" />
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
