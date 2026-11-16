import './figures.css'

/**
 * PrTag -- the gold `PR` tag, for real records only (study §3, PR). It goes on the Set that
 * earned the record, or before a record's line. A rep best never wears it: decide with
 * `isRealRecord` / `asPr` (src/domain/stats/records.ts) before rendering one.
 *
 * Props:
 *   - `label`: its accessible name, `Personal record` by default; `null` leaves it unnamed (its
 *     text, `PR`, is then what is read), as where the cell around it already names the Set.
 *   - `className`: a site's layout class, added to `tag tag-pr`.
 */
export type PrTagProps = {
  label?: string | null
  className?: string
}

export function PrTag({ label = 'Personal record', className }: PrTagProps): JSX.Element {
  return (
    <span className={className === undefined ? 'tag tag-pr' : `tag tag-pr ${className}`} aria-label={label ?? undefined}>
      PR
    </span>
  )
}
