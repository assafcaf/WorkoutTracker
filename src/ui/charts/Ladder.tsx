import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
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
const MIN_PAD_LEFT = 40
const PAD_RIGHT = 24
const WEIGHT_PLOT = 100
const BARS_TOP = 6
const BARS_PLOT = 54
const MINI_HEIGHT = 48
const MINI_PAD = 6
const DOT_RADIUS = 3.5
const BAR_WIDTH = 4
const BAND_HALF = 8
/** The caption under the weight panel; HTML, so it wraps instead of running into the axis. */
const CAPTION = 'reps at that weight · tick is the target'
/** `--text-xs` at the default root size, when the page cannot be measured (tests). */
const FALLBACK_FONT = 12

/**
 * V1-31: the chart's text size in SVG user units. Axis text is `--text-xs` (CSS px) inside a
 * viewBox, so its size in user units is the CSS value whatever the chart's width; it grows with
 * the root font size (large text). Measured off the caption, which uses the same token.
 */
function useLabelFont(active: boolean): [RefObject<HTMLParagraphElement>, number] {
  const probe = useRef<HTMLParagraphElement>(null)
  const [font, setFont] = useState(FALLBACK_FONT)
  useLayoutEffect(() => {
    const element = probe.current
    if (element === null) return
    const measure = (): void => {
      const size = Number.parseFloat(getComputedStyle(element).fontSize)
      setFont(Number.isFinite(size) && size > 0 ? size : FALLBACK_FONT)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [active])
  return [probe, font]
}

/** A label's width in user units, from its length: tabular digits run about 0.6 em. */
function textWidth(text: string, font: number): number {
  return text.length * font * 0.6
}

/**
 * Of labels along one line (`at` is their centre, in order), the ones that fit without touching:
 * the first and the last are kept, the rest only with `gap` clear of the kept ones on each side.
 */
function spaced<T>(items: T[], at: (item: T) => number, size: (item: T) => number, gap: number): T[] {
  if (items.length <= 2) return items
  const first = items[0]
  const last = items[items.length - 1]
  const clear = (a: T, b: T): boolean => Math.abs(at(a) - at(b)) >= (size(a) + size(b)) / 2 + gap
  const kept: T[] = [first]
  for (const item of items.slice(1, -1)) {
    if (clear(kept[kept.length - 1], item) && clear(item, last)) kept.push(item)
  }
  if (clear(kept[kept.length - 1], last)) kept.push(last)
  else if (kept.length > 1) kept[kept.length - 1] = last
  else kept.push(last)
  return kept
}

/**
 * The ladder (E18-T8, O19): a lift's working weight as a step line with a dot per Session over
 * reps-at-that-weight bars that start at zero, on a calendar x axis. Deload Sessions are hollow
 * dots off the line in a hatched band, gaps break the line with their labels. Dragging (or the
 * arrow keys) snaps to the nearest Session and docks its readout above the tab bar; it stays
 * after release. Hand-drawn SVG, tokens only.
 *
 * V1-31: the weight panel and the reps panel are two SVGs on one x scale with the reps caption
 * between them as HTML, and every label is laid out from the measured text size: weight ticks
 * keep a line apart, the left margin fits the widest, dates keep clear and inside the chart. No
 * label overprints another at any width or text size.
 */
export function Ladder({ view, title, variant = 'full', onOpenSession }: LadderProps): JSX.Element {
  const mini = variant === 'mini'
  const hatchId = useId()
  const [probe, font] = useLabelFont(!mini && view.points.length > 0)
  const [selected, setSelected] = useState<number | null>(null)
  const { points } = view

  if (points.length === 0) return <div className="ladder" />

  const line = font * 1.25
  const left = mini
    ? MINI_PAD
    : Math.max(MIN_PAD_LEFT, Math.ceil(Math.max(0, ...view.ticks.map((tick) => textWidth(tick.label, font))) + 8))
  const right = mini ? MINI_PAD : PAD_RIGHT
  const plotWidth = VIEW_WIDTH - left - right
  const span = view.to - view.from
  const xOf = (at: number): number => (span <= 0 ? left + plotWidth / 2 : left + ((at - view.from) / span) * plotWidth)

  // The weight panel's rows, top down, each only when it has text: the axis title, the deload
  // and gap labels, the stall bracket's label over its bracket, then the plot.
  const deloads = points.filter((point) => point.deload)
  let cursor = 0
  const titleY = cursor + font
  if (view.axisLabel && !mini) cursor += line
  const bandY = cursor + font
  if ((deloads.length > 0 || view.gaps.length > 0) && !mini) cursor += line + 2
  const bracketY = cursor + font
  if (view.bracket && !mini) cursor += line + 8
  const top = mini ? MINI_PAD : cursor + line / 2 + 2
  const bottom = mini ? MINI_HEIGHT - MINI_PAD : top + WEIGHT_PLOT
  const weightHeight = bottom + line / 2 + 2

  const levers = view.ticks.length > 0 ? view.ticks.map((tick) => tick.lever) : points.map((point) => point.lever)
  const low = Math.min(...levers)
  const high = Math.max(...levers)
  const yOf = (lever: number): number => (high === low ? (top + bottom) / 2 : top + (1 - (lever - low) / (high - low)) * (bottom - top))

  // Now the tick labels can be spaced by their real heights.
  const tickLabels = mini ? [] : spaced(view.ticks, (tick) => yOf(tick.lever), () => line, 0)

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

  // A label centred on `x`, moved in so it stays inside the chart.
  const inside = (x: number, text: string): number => {
    const half = textWidth(text, font) / 2
    return Math.min(Math.max(x, half), VIEW_WIDTH - half)
  }
  // The band row: the first deload's label and the gaps' labels, kept apart.
  const bandLabels = spaced(
    [
      ...(deloads[0] ? [{ key: 'deload', x: inside(xOf(deloads[0].at), 'Deload'), text: 'Deload' }] : []),
      ...view.gaps.map((gap) => ({
        key: `gap-${gap.from}`,
        x: inside(xOf((gap.from + gap.to) / 2), gap.label),
        text: gap.label,
      })),
    ].sort((a, b) => a.x - b.x),
    (label) => label.x,
    (label) => textWidth(label.text, font),
    font / 2,
  )

  // The reps panel: bars from zero, then the dates under them, inside the chart and kept apart.
  const barsBottom = BARS_TOP + BARS_PLOT
  const datesY = barsBottom + 4 + font
  const barsHeight = barsBottom + 4 + line
  const maxReps = Math.max(1, ...points.map((point) => Math.max(point.reps, point.target ?? 0)))
  const barTop = (reps: number): number => barsBottom - (reps / maxReps) * BARS_PLOT
  const dates = spaced(
    view.dates.map((date) => {
      const half = textWidth(date.label, font) / 2
      return { ...date, x: Math.min(Math.max(xOf(date.at), half), VIEW_WIDTH - half) }
    }),
    (date) => date.x,
    (date) => textWidth(date.label, font),
    font / 2,
  )

  const select = (index: number): void => setSelected(Math.min(Math.max(index, 0), points.length - 1))

  const scrub = (event: PointerEvent<SVGSVGElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const at = view.from + ((x - left) / plotWidth) * span
    select(nearestPointIndex(points, at))
  }
  const scrubProps = {
    onPointerDown: scrub,
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => {
      if (event.buttons > 0 || event.pointerType === 'touch') scrub(event)
    },
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    select(selected === null ? points.length - 1 : selected + step)
  }

  const chosen: LadderPoint | null = selected === null ? null : points[selected]
  const reference = view.reference ?? null
  const referenceText = reference
    ? (() => {
        const x = xOf(reference.at)
        const fits = x + 10 + textWidth(reference.label, font) <= VIEW_WIDTH
        return { x: fits ? x + 10 : x - 10, anchor: fits ? 'start' : 'end' }
      })()
    : null

  /** A deload band and a gap's line, in a panel from `y1` to `y2`. */
  const bands = (panel: string, y1: number, y2: number): JSX.Element => (
    <>
      {deloads.map((point) => (
        <rect
          key={point.id}
          className={panel === 'w' ? 'ladder-deload-band' : 'ladder-deload-band-reps'}
          x={xOf(point.at) - BAND_HALF}
          y={y1}
          width={BAND_HALF * 2}
          height={y2 - y1}
          fill={`url(#${hatchId}${panel})`}
        />
      ))}
      {view.gaps.map((gap) => {
        const x = xOf((gap.from + gap.to) / 2)
        return (
          <g key={`${gap.from}-${gap.to}`} className={panel === 'w' ? 'ladder-gap' : 'ladder-gap-reps'}>
            <line className="ladder-gap-line" x1={x} x2={x} y1={y1} y2={y2} />
          </g>
        )
      })}
      {chosen ? <line className="ladder-cursor" x1={xOf(chosen.at)} x2={xOf(chosen.at)} y1={y1} y2={y2} /> : null}
    </>
  )
  const hatch = (panel: string): JSX.Element => (
    <defs>
      <pattern id={`${hatchId}${panel}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line className="ladder-hatch-line" x1="0" y1="0" x2="0" y2="4" />
      </pattern>
    </defs>
  )

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
          viewBox={`0 0 ${VIEW_WIDTH} ${weightHeight}`}
          {...scrubProps}
        >
          {hatch('w')}
          {view.axisLabel ? (
            <text className="ladder-axis-title" x={0} y={titleY}>
              {view.axisLabel}
            </text>
          ) : null}
          <g data-axis="lever">
            {view.ticks.map((tick) => (
              <g key={tick.lever}>
                <line className="ladder-grid" x1={left} x2={VIEW_WIDTH - right} y1={yOf(tick.lever)} y2={yOf(tick.lever)} />
                {tickLabels.includes(tick) ? (
                  <text className="ladder-axis-label" x={left - 6} y={yOf(tick.lever)} textAnchor="end" dominantBaseline="middle">
                    {tick.label}
                  </text>
                ) : null}
              </g>
            ))}
          </g>
          {bands('w', top, weightHeight)}
          {bandLabels.map((label) => (
            <text key={label.key} className="ladder-band-label" x={label.x} y={bandY} textAnchor="middle">
              {label.text}
            </text>
          ))}
          {lineSvg}
          {view.bracket ? (
            <g className="ladder-bracket">
              <path
                className="ladder-bracket-line"
                d={`M${xOf(view.bracket.from)} ${top - 4} V${top - 10} H${xOf(view.bracket.to)} V${top - 4}`}
              />
              <text
                className="ladder-bracket-label"
                x={inside((xOf(view.bracket.from) + xOf(view.bracket.to)) / 2, view.bracket.label)}
                y={bracketY}
                textAnchor="middle"
              >
                {view.bracket.label}
              </text>
            </g>
          ) : null}
          {reference && referenceText ? (
            <g className="ladder-reference" data-at={reference.at} data-lever={reference.lever}>
              <line
                className="ladder-reference-line"
                x1={xOf(reference.at) - 8}
                x2={xOf(reference.at) + 8}
                y1={yOf(reference.lever)}
                y2={yOf(reference.lever)}
              />
              <text
                className="ladder-axis-label"
                x={referenceText.x}
                y={yOf(reference.lever)}
                textAnchor={referenceText.anchor}
                dominantBaseline="middle"
              >
                {reference.label}
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
        </svg>
        <p ref={probe} className="ladder-caption">
          {CAPTION}
        </p>
        <svg className="ladder-svg ladder-svg-reps" aria-hidden="true" viewBox={`0 0 ${VIEW_WIDTH} ${barsHeight}`} {...scrubProps}>
          {hatch('r')}
          {bands('r', 0, barsBottom)}
          <line className="ladder-baseline" x1={left} x2={VIEW_WIDTH - right} y1={barsBottom} y2={barsBottom} />
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
                  height={barsBottom - barY}
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
            {dates.map((date) => (
              <text key={date.at} className="ladder-axis-label" x={date.x} y={datesY} textAnchor="middle">
                {date.label}
              </text>
            ))}
          </g>
        </svg>
      </div>
      {chosen ? <LadderReadout rows={chosen.readout} onOpenSession={onOpenSession} /> : null}
    </div>
  )
}
