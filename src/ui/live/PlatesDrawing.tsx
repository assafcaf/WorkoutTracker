import type { PlateLoading } from '../../domain/plates'

export type PlatesDrawingProps = {
  loading: PlateLoading | null
  barKg: number
}

/** The heaviest plate's height; lighter ones scale down from it, never under a third. */
const TALLEST_PX = 96

/**
 * The bar and the plates on one side of it, mirrored (Progress Dashboard S3b): the bar's sleeve
 * across the width, the collar, then each plate heaviest first, its height by its weight.
 * Drawn from boxes, not an svg: it is a picture of a thing, not a chart.
 */
export function PlatesDrawing({ loading, barKg }: PlatesDrawingProps): JSX.Element {
  const perSide = loading?.perSide ?? []
  const heaviest = Math.max(...perSide, 1)
  const side = (mirror: boolean) => (
    <div className="plates-side" data-mirror={mirror ? 'true' : undefined}>
      <span className="plates-collar" />
      {perSide.map((kg, index) => (
        <span
          key={index}
          className="plates-plate"
          data-heavy={kg >= 10 ? 'true' : undefined}
          style={{ height: Math.max(TALLEST_PX / 3, (TALLEST_PX * kg) / heaviest) }}
        >
          {mirror ? null : <span className="plates-plate-kg">{kg}</span>}
        </span>
      ))}
    </div>
  )

  return (
    <div
      className="plates-drawing"
      role="img"
      aria-label={perSide.length === 0 ? `Bar only, ${barKg} kg` : `Per side ${perSide.join(' and ')} kg`}
    >
      <span className="plates-sleeve" />
      {side(true)}
      <span className="plates-bar">
        <span className="plates-bar-kg">bar {barKg} kg</span>
      </span>
      {side(false)}
    </div>
  )
}
