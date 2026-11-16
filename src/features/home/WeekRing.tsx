import type { WeekRing as Ring } from './homeModel'

const SIZE = 112
const R = 48
const C = SIZE / 2
/** The gap between two arcs, in degrees. */
const GAP = 14

function point(deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [C + R * Math.sin(rad), C - R * Math.cos(rad)]
}

function arcPath(from: number, to: number): string {
  const [x0, y0] = point(from)
  const [x1, y1] = point(to)
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

/**
 * v7 Home: the week as a ring, one arc per planned Session (home.md §2, Block 1). A done arc is
 * filled in its workout's colour, today's due one is a dashed live arc, an open one is heat-0.
 * The centre reads `2/3` over "this week"; the accessible name says it in words.
 */
export function WeekRing({ ring }: { ring: Ring }): JSX.Element {
  const n = ring.arcs.length
  return (
    <span className="home-ring" role="img" aria-label={`${ring.done} of ${ring.planned} sessions this week`}>
      <svg className="home-ring-svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {ring.arcs.map((arc, i) => {
          const from = (i * 360) / n + GAP / 2
          const to = ((i + 1) * 360) / n - GAP / 2
          return (
            <path
              key={i}
              className="home-ring-arc"
              d={arcPath(from, to)}
              data-kind={arc.kind}
              data-tone={arc.kind === 'done' ? arc.tone : undefined}
            />
          )
        })}
      </svg>
      <span className="home-ring-centre" aria-hidden="true">
        <span className="home-ring-count">
          {ring.done}
          <span className="home-ring-of">/{ring.planned}</span>
        </span>
        <span className="home-ring-label">this week</span>
      </span>
    </span>
  )
}
