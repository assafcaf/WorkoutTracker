import './CourtStripe.css'

/**
 * The court's one stripe cue (E10-T5): the green-over-clay bands dropped into the Shell
 * header, the session summary and the PR medallion -- and nowhere else. Purely decorative, so
 * it is `aria-hidden`.
 */
export function CourtStripe(): JSX.Element {
  return <span className="court-stripe" aria-hidden="true" />
}
