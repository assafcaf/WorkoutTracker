import { createElement } from 'react'
import type { LiftStatusKind } from '../../domain/stats/status'
import './figures.css'

/** What a status says about the lift, and so its colour: better, level, or lower. */
export type StatusTone = 'up' | 'flat' | 'down'

/**
 * A lift status's tone: Moving and Ready are `up` (green: Ready is the best news the app gives,
 * never a warning); Lowered and Slipping are `down` (rust); Flat, Hold, Break and Too new are
 * `flat` (ink-3).
 */
export function statusTone(kind: LiftStatusKind): StatusTone {
  if (kind === 'moving' || kind === 'ready') return 'up'
  if (kind === 'lowered' || kind === 'slipping') return 'down'
  return 'flat'
}

/**
 * StatusMark -- a status as a glyph and a word in the status colour, with no box and no border
 * (study §3, Status): `↑ Moving`, `↑ Ready`, `= Flat`, `↓ Lowered`. On a row it sits under the
 * name; on a lift page it is the first line. Advice is a separate ink sentence, never inside it.
 *
 * Props:
 *   - `tone`: `up` | `flat` | `down` (see `statusTone` for a lift status's).
 *   - `glyph`: the glyph before the word (a lift status's is `LiftStatus.glyph`).
 *   - `children`: the word or short phrase (`Moving`, `Up to 15 kg`).
 *   - `as`: `span` (default) or `p`.
 *   - `className`: a site's layout class, added to `status-mark`.
 *
 * Glyph and word are one text node (`↑ Moving`), coloured together through `data-tone`.
 */
export type StatusMarkProps = {
  tone: StatusTone
  glyph: string
  children: string
  as?: 'span' | 'p'
  className?: string
}

export function StatusMark({ tone, glyph, children, as = 'span', className }: StatusMarkProps): JSX.Element {
  return createElement(
    as,
    { className: className === undefined ? 'status-mark' : `status-mark ${className}`, 'data-tone': tone },
    `${glyph} ${children}`,
  )
}
