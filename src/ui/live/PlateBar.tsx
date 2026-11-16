/**
 * PlateBar -- one side of the bar, drawn (study §1.2 "Walking to the bar"): the sleeve, the plates
 * on it from the collar out, heaviest first, each as tall as its weight says. Shown under the
 * weight at the bar only when the plates change; "Same plates" otherwise (SetScreen decides).
 *
 * It is a picture of the Plate line beside it, so it is hidden from a screen reader: the line
 * ("Per side: 25") is what is read.
 */
export type PlateBarProps = {
  /** The plates on one side, in loading order (`platesFor(...).perSide`). */
  perSide: readonly number[]
}

/**
 * A plate's drawn height as a share of the drawing's (CSS sets that, 56 px or 40 on a short
 * screen): 25 kg is the full height, a 1.25 kg change plate about a third.
 */
function plateHeight(kg: number): string {
  return `${Math.round(Math.min(100, 32 + Math.sqrt(kg / 25) * 68))}%`
}

/** A plate's drawn width in px: the big plates are thicker. */
function plateWidth(kg: number): number {
  return kg >= 15 ? 14 : kg >= 5 ? 10 : 7
}

export function PlateBar({ perSide }: PlateBarProps): JSX.Element {
  return (
    <span className="plate-bar" aria-hidden="true">
      <span className="plate-bar-shaft" />
      <span className="plate-bar-collar" />
      {perSide.map((kg, at) => (
        <span
          key={at}
          className="plate-bar-plate"
          data-heavy={kg >= 10 ? 'true' : undefined}
          style={{ height: plateHeight(kg), width: plateWidth(kg) }}
        />
      ))}
      <span className="plate-bar-sleeve" />
    </span>
  )
}
