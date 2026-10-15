import { useId, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import './Ladder.css'
import { LadderReadout } from './LadderReadout'
import { nearestPointIndex } from './ladderView'
import type { LadderPoint, LadderView } from './ladderView'

export type LadderProps = {
  view: LadderView
  title: string
  /** `mini` is the 48 px list variant: the step line only, no text, no bars, no scrub. */
  variant?: 'full' | 'mini'
  /** Handed the Session id when the readout's `Open session` is pressed. */
  onOpenSession?: (sessionId: string) => void
}

const VIEW_WIDTH = 320
const PAD_LEFT = 40
const PAD_RIGHT = 24
const WEIGHT_TOP = 28
const WEIGHT_BOTTOM = 128
const BARS_TOP = 150
const BARS_BOTTOM = 204
const DATES_Y = 222
const FULL_HEIGHT = 232
const MINI_HEIGHT = 48
const MINI_PAD = 6
const DOT_RADIUS = 3.5
const BAR_WIDTH = 4
const BAND_HALF = 8

/**
 * The ladder (E18-T8, O19): a lift's working weight as a step line with a dot per Session over
 * reps-at-that-weight bars that start at zero, on a calendar x axis. Deload Sessions are hollow
 * dots off the line in a hatched band, gaps break the line with their labels. Dragging (or the
 * arrow keys) snaps to the nearest Session and docks its readout above the tab bar; it stays
 * after release. Hand-drawn SVG, tokens only.
 */
export function Ladder({ view, title, variant = 'full', onOpenSession }: LadderProps): JSX.Element {
  const mini = variant === 'mini'
  const hatchId = useId()
  const [selected, setSelected] = useState<number | null>(null)
  const { points } = view

  if (points.length === 0) return <div className="ladder" />

  const height = mini ? MINI_HEIGHT : FULL_HEIGHT
  const left = mini ? MINI_PAD : PAD_LEFT
  const right = mini ? MINI_PAD : PAD_RIGHT
  const plotWidth = VIEW_WIDTH - left - right
  const span = view.to - view.from
  const xOf = (at: number): number => (span <= 0 ? left + plotWidth / 2 : left + ((at - view.from) / span) * plotWidth)

  const levers = view.ticks.length > 0 ? view.ticks.map((tick) => tick.lever) : points.map((point) => point.lever)
  const low = Math.min(...levers)
  const high = Math.max(...levers)
  const top = mini ? MINI_PAD : WEIGHT_TOP
  const bottom = mini ? MINI_HEIGHT - MINI_PAD : WEIGHT_BOTTOM
  const yOf = (lever: number): number => (high === low ? (top + bottom) / 2 : top + (1 - (lever - low) / (high - low)) * (bottom - top))

  const onLine = points.filter((point) => !point.deload)
  const lineSegments: string[] = []
  let current = ''
  onLine.forEach((point, index) => {
    const x = xOf(point.at)
    const y = yOf(point.lever)
    const previous = onLine[index - 1]
    const broken = previous !== undefined && view.gaps.some((gap) => gap.from < point.at && gap.to > previous.at)
    if (index === 0 || broken) {
      if (current) lineSegments.push(current)
      current = `M${x} ${y}`
    } else {
      current += ` H${x} V${y}`
    }
  })
  if (current) lineSegments.push(current)

  const currentTread = view.treads.find((tread) => tread.current)
  const treadPath = currentTread
    ? `M${xOf(currentTread.from)} ${yOf(currentTread.lever)} H${xOf(currentTread.to)}`
    : null

  const lineSvg = (
    <>
      {lineSegments.map((d, index) => (
        <path key={index} className="ladder-line" d={d} />
      ))}
      {treadPath ? <path className="ladder-tread-current" d={treadPath} /> : null}
    </>
  )

  if (mini) {
    return (
      <div className="ladder ladder-mini">
        <svg className="ladder-svg" role="img" aria-label={title} viewBox={`0 0 ${VIEW_WIDTH} ${MINI_HEIGHT}`} height={MINI_HEIGHT}>
          {lineSvg}
        </svg>
      </div>
    )
  }

  const barsHeight = BARS_BOTTOM - BARS_TOP
  const maxReps = Math.max(1, ...points.map((point) => Math.max(point.reps, point.target ?? 0)))
  const barTop = (reps: number): number => BARS_BOTTOM - (reps / maxReps) * barsHeight
  const deloads = points.filter((point) => point.deload)

  const select = (index: number): void => setSelected(Math.min(Math.max(index, 0), points.length - 1))

  const scrub = (event: PointerEvent<SVGSVGElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const at = view.from + ((x - left) / plotWidth) * span
    select(nearestPointIndex(points, at))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    select(selected === null ? points.length - 1 : selected + step)
  }

  const chosen: LadderPoint | null = selected === null ? null : points[selected]

  return (
    <div className="ladder" data-selected={chosen ? '' : undefined}>
      <div
        className="ladder-scrub"
        role="group"
        aria-label={`${title}: scrub with the arrow keys`}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <svg
          className="ladder-svg"
          role="img"
          aria-label={title}
          viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
          onPointerDown={scrub}
          onPointerMove={(event) => {
            if (event.buttons > 0 || event.pointerType === 'touch') scrub(event)
          }}
        >
          <defs>
            <pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line className="ladder-hatch-line" x1="0" y1="0" x2="0" y2="4" />
            </pattern>
          </defs>
          {view.axisLabel ? (
            <text className="ladder-axis-title" x={0} y={12}>
              {view.axisLabel}
            </text>
          ) : null}
          <g data-axis="lever">
            {view.ticks.map((tick) => (
              <g key={tick.lever}>
                <line className="ladder-grid" x1={left} x2={VIEW_WIDTH - right} y1={yOf(tick.lever)} y2={yOf(tick.lever)} />
                <text className="ladder-axis-label" x={left - 6} y={yOf(tick.lever)} textAnchor="end" dominantBaseline="middle">
                  {tick.label}
                </text>
              </g>
            ))}
          </g>
          {deloads.map((point, index) => (
            <g key={point.id} className="ladder-deload-band">
              <rect
                x={xOf(point.at) - BAND_HALF}
                y={top}
                width={BAND_HALF * 2}
                height={BARS_BOTTOM - top}
                fill={`url(#${hatchId})`}
              />
              {index === 0 ? (
                <text className="ladder-band-label" x={xOf(point.at)} y={top - 6} textAnchor="middle">
                  Deload
                </text>
              ) : null}
            </g>
          ))}
          {view.gaps.map((gap) => {
            const x = xOf((gap.from + gap.to) / 2)
            return (
              <g key={`${gap.from}-${gap.to}`} className="ladder-gap">
                <line className="ladder-gap-line" x1={x} x2={x} y1={top} y2={BARS_BOTTOM} />
                <text className="ladder-band-label" x={x} y={top - 6} textAnchor="middle">
                  {gap.label}
                </text>
              </g>
            )
          })}
          {lineSvg}
          {view.bracket ? (
            <g className="ladder-bracket">
              <path
                className="ladder-bracket-line"
                d={`M${xOf(view.bracket.from)} ${top - 2} V${top - 8} H${xOf(view.bracket.to)} V${top - 2}`}
              />
              <text
                className="ladder-bracket-label"
                x={(xOf(view.bracket.from) + xOf(view.bracket.to)) / 2}
                y={top - 12}
                textAnchor="middle"
              >
                {view.bracket.label}
              </text>
            </g>
          ) : null}
          {view.reference ? (
            <g className="ladder-reference" data-at={view.reference.at} data-lever={view.reference.lever}>
              <line
                className="ladder-reference-line"
                x1={xOf(view.reference.at) - 8}
                x2={xOf(view.reference.at) + 8}
                y1={yOf(view.reference.lever)}
                y2={yOf(view.reference.lever)}
              />
              <text className="ladder-axis-label" x={xOf(view.reference.at) + 10} y={yOf(view.reference.lever)} dominantBaseline="middle">
                {view.reference.label}
              </text>
            </g>
          ) : null}
          {points.map((point, index) => (
            <circle
              key={point.id}
              className={[
                'ladder-dot',
                point.deload ? 'ladder-dot-deload' : '',
                point.record ? 'ladder-dot-record' : '',
                selected === index ? 'ladder-dot-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-at={point.at}
              data-lever={point.lever}
              cx={xOf(point.at)}
              cy={yOf(point.lever)}
              r={selected === index ? DOT_RADIUS + 1.5 : DOT_RADIUS}
            />
          ))}
          <text className="ladder-axis-title" x={0} y={BARS_TOP - 8}>
            reps at that weight · tick is the target
          </text>
          <line className="ladder-baseline" x1={left} x2={VIEW_WIDTH - right} y1={BARS_BOTTOM} y2={BARS_BOTTOM} />
          {points.map((point, index) => {
            const x = xOf(point.at)
            const barY = barTop(point.reps)
            return (
              <g key={point.id}>
                <rect
                  className={`ladder-bar${point.deload ? ' ladder-bar-deload' : ''}${selected === index ? ' ladder-bar-selected' : ''}`}
                  data-at={point.at}
                  data-reps={point.reps}
                  x={x - BAR_WIDTH / 2}
                  y={barY}
                  width={BAR_WIDTH}
                  height={BARS_BOTTOM - barY}
                />
                {point.target !== null ? (
                  <line
                    className="ladder-target"
                    data-at={point.at}
                    data-target={point.target}
                    x1={x - BAR_WIDTH}
                    x2={x + BAR_WIDTH}
                    y1={barTop(point.target)}
                    y2={barTop(point.target)}
                  />
                ) : null}
              </g>
            )
          })}
          <g data-axis="dates">
            {view.dates.map((date) => (
              <text key={date.at} className="ladder-axis-label" x={xOf(date.at)} y={DATES_Y} textAnchor="middle">
                {date.label}
              </text>
            ))}
          </g>
          {chosen ? (
            <line className="ladder-cursor" x1={xOf(chosen.at)} x2={xOf(chosen.at)} y1={top} y2={BARS_BOTTOM} />
          ) : null}
        </svg>
      </div>
      {chosen ? <LadderReadout rows={chosen.readout} onOpenSession={onOpenSession} /> : null}
    </div>
  )
}
