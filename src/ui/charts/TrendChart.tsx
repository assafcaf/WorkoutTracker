import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import './LineChart.css'
import './TrendChart.css'
import { ChartReadout } from './ChartReadout'
import { formatValue, ticksFor } from './axis'

export type TrendChartPoint = {
  id: string
  /** Epoch ms; points are drawn in the order given, evenly spaced. */
  at: number
  value: number
  /** Beat every earlier point: drawn in the record ink. */
  record: boolean
  /** The point's date as its labels read it, e.g. `12 Oct`. */
  date: string
  /** The value with its unit, e.g. `88.7 kg`. */
  valueText: string
  /** The Set behind it and any record, e.g. `Best set 70 × 8 · New best`. */
  detail: string
}

export type TrendChartProps = {
  points: TrendChartPoint[]
  /** The chart's accessible name: one sentence on where the trend went. */
  summary: string
  /** How a value tick reads; the plain number when omitted (assistance passes its size). */
  tickText?: (value: number) => string
}

const HEIGHT = 132
const PAD_Y = 12
const PAD_X = 10
const FALLBACK_WIDTH = 260

/** The plot's width in CSS px, re-measured as the container resizes (text size, rotation). */
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

/**
 * A lift's trend, one point per Session (the Exercise History overlay): the LineChart's look
 * (secondary line, record points in the primary ink) drawn at the plot's measured width in CSS
 * px, so no dot stretches. Every word is HTML beside the plot -- the two outer value ticks on
 * the left, the first and last dates below -- so large text wraps instead of overprinting. Each
 * point owns a full-height column to tap (or focus and press); the chosen point's readout opens
 * under the chart.
 */
export function TrendChart({ points, summary, tickText = formatValue }: TrendChartProps): JSX.Element {
  const [ref, width] = useWidth()
  const [selected, setSelected] = useState<number | null>(null)
  if (points.length === 0) return <div className="trend-chart" />

  const values = points.map((p) => p.value)
  const ticks = ticksFor(Math.min(...values), Math.max(...values))
  const low = ticks[0]
  const high = ticks[ticks.length - 1]
  const yOf = (v: number): number => PAD_Y + (1 - (v - low) / (high - low)) * (HEIGHT - 2 * PAD_Y)
  const xOf = (i: number): number =>
    points.length === 1 ? width / 2 : PAD_X + (i / (points.length - 1)) * (width - 2 * PAD_X)
  const placed = points.map((p, i) => ({ ...p, x: xOf(i), y: yOf(p.value) }))
  const last = placed.length - 1
  const chosen = selected !== null && selected < placed.length ? placed[selected] : null
  const toggle = (i: number): void => setSelected((current) => (current === i ? null : i))

  return (
    <div className="trend-chart line-chart" data-records="">
      <div className="trend-chart-grid">
        <div className="trend-chart-y" aria-hidden="true" style={{ height: HEIGHT }}>
          <span className="trend-chart-tick" style={{ top: yOf(high) }}>
            {tickText(high)}
          </span>
          <span className="trend-chart-tick" style={{ top: yOf(low) }}>
            {tickText(low)}
          </span>
        </div>
        <div className="trend-chart-canvas" ref={ref}>
          <svg
            className="trend-chart-svg"
            role="img"
            aria-label={summary}
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
          >
            {ticks.map((tick) => (
              <line key={tick} className="line-chart-grid" x1={0} x2={width} y1={yOf(tick)} y2={yOf(tick)} />
            ))}
            {placed.length > 1 ? (
              <polyline className="line-chart-line" points={placed.map((p) => `${p.x},${p.y}`).join(' ')} />
            ) : null}
            {placed.map((p, i) => (
              <circle
                key={p.id}
                className={`line-chart-point ${p.record ? 'line-chart-record' : 'line-chart-plain'}${i === last ? ' trend-chart-latest' : ''}`}
                data-value={p.value}
                data-record={p.record ? '' : undefined}
                aria-pressed={selected === i}
                cx={p.x}
                cy={p.y}
                r={i === last || p.record ? 5 : 3.5}
              />
            ))}
          </svg>
          <div className="trend-chart-hits">
            {placed.map((p, i) => {
              const from = i === 0 ? 0 : (placed[i - 1].x + p.x) / 2
              const to = i === last ? width : (p.x + placed[i + 1].x) / 2
              return (
                <button
                  key={p.id}
                  type="button"
                  className="trend-chart-hit btn-quiet"
                  style={{ left: from, width: Math.max(0, to - from) }}
                  aria-label={`${p.date} · ${p.valueText} · ${p.detail}`}
                  aria-pressed={selected === i}
                  onClick={() => toggle(i)}
                  onKeyDown={(event: KeyboardEvent) => {
                    if (event.key === 'ArrowRight' && i < last) {
                      event.preventDefault()
                      setSelected(i + 1)
                      ;(event.currentTarget.nextElementSibling as HTMLElement | null)?.focus()
                    } else if (event.key === 'ArrowLeft' && i > 0) {
                      event.preventDefault()
                      setSelected(i - 1)
                      ;(event.currentTarget.previousElementSibling as HTMLElement | null)?.focus()
                    }
                  }}
                  tabIndex={i === (selected ?? last) ? 0 : -1}
                />
              )
            })}
          </div>
        </div>
        <span aria-hidden="true" />
        <div className="trend-chart-dates" aria-hidden="true">
          <span>{placed[0].date}</span>
          {last > 0 ? <span>{placed[last].date}</span> : null}
        </div>
      </div>
      {chosen ? <ChartReadout date={chosen.date} value={chosen.valueText} detail={chosen.detail} /> : null}
    </div>
  )
}
