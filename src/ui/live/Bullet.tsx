import './live.css'

export type BulletProps = {
  /** Today's amount, drawn as the filled bar. */
  today: number
  /** The amount compared against, drawn as a tick; null draws no tick. */
  last: number | null
  /** What the bar says, for a screen reader: "Today 1,530 kg · last time 1,470 kg". */
  label: string
  /** `wide` is the projection line's bar; `small` a compact row's. */
  size?: 'wide' | 'small'
}

/**
 * A bullet bar (Progress Dashboard S2/S3): today's amount filled along a thin track, with a tick
 * where the compared amount sits. The scale leaves 15% headroom past the larger of the two.
 */
export function Bullet({ today, last, label, size = 'wide' }: BulletProps): JSX.Element {
  const max = Math.max(today, last ?? 0, 1) * 1.15
  const fill = (100 * today) / max
  return (
    <span className={size === 'small' ? 'bullet bullet--small' : 'bullet'} role="img" aria-label={label}>
      <span className="bullet-track" />
      {today > 0 ? <span className="bullet-fill" style={{ width: `${fill.toFixed(1)}%` }} /> : null}
      {last === null ? null : (
        <span className="bullet-mark" style={{ left: `${((100 * last) / max).toFixed(1)}%` }} />
      )}
    </span>
  )
}
