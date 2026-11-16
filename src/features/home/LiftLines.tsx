import type { HomeLifts, LiftLine } from './homeModel'

const W = 44
const H = 30

/**
 * One lift's 12 weeks as a word-sized line (home.md §2, Block 2): a grey trend, ending in one dot
 * of meaning -- green moving, ink-3 flat, rust lowered, grey on a Break -- or a gold ring when the
 * lift set a PR in the Session just finished. A lift without a verdict yet is a dashed line.
 */
function Spark({ line }: { line: LiftLine }): JSX.Element {
  if (line.tone === 'new' || line.values.length < 2) {
    return (
      <svg className="home-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <line className="home-spark-empty" x1={2} x2={W - 2} y1={H - 6} y2={H - 6} />
      </svg>
    )
  }
  const values = line.values
  const low = Math.min(...values)
  const high = Math.max(...values)
  const points = values.map((v, i): [number, number] => [
    (i * (W - 8)) / (values.length - 1) + 3,
    H - 5 - ((v - low) / (high - low || 1)) * (H - 10),
  ])
  const [lx, ly] = points[points.length - 1]
  return (
    <svg className="home-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline className="home-spark-line" points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} />
      {line.pr ? (
        <circle className="home-spark-pr" cx={lx} cy={ly} r={3.6} />
      ) : (
        <circle className="home-spark-end" data-tone={line.tone} cx={lx} cy={ly} r={3.2} />
      )}
    </svg>
  )
}

const TONE_WORDS: Record<LiftLine['tone'], string> = {
  up: 'moving',
  flat: 'flat',
  down: 'lowered',
  grey: 'as you left it',
  new: 'too new for a line',
}

/**
 * The Lifts block's picture: a row per workout after its A/B chip, one 44 x 30 sparkline per lift,
 * each a button into that lift's page named after it. With no Program yet, seven dashed lines.
 */
export function LiftLines({
  lifts,
  onOpenLift,
}: {
  lifts: HomeLifts
  onOpenLift?(exerciseId: string): void
}): JSX.Element {
  if (lifts.rows.length === 0) {
    return (
      <div className="home-sparks" aria-hidden="true">
        <div className="home-spark-row">
          <span className="home-spark-cells">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} className="home-spark-cell">
                <Spark line={{ exerciseId: String(i), name: '', values: [], tone: 'new', pr: false }} />
              </span>
            ))}
          </span>
        </div>
      </div>
    )
  }
  return (
    <div className="home-sparks">
      {lifts.rows.map((row) => (
        <div key={row.workoutId} className="home-spark-row" role="group" aria-label={`${row.name} lifts`}>
          <span className="home-chip" data-tone={row.tone} aria-hidden="true">
            {row.letter}
          </span>
          <span className="home-spark-cells">
            {row.lines.map((line) => (
              <button
                key={line.exerciseId}
                type="button"
                className="home-spark-cell cell"
                aria-label={`${line.name}: ${TONE_WORDS[line.tone]}${line.pr ? ', PR today' : ''}`}
                onClick={() => onOpenLift?.(line.exerciseId)}
              >
                <Spark line={line} />
              </button>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}
